import { MasterClock } from './clock'
import { getDrumBuffer } from './drums'
import { downloadArrayBuffer, renderProjectOffline } from './exporter'
import {
  applyFx,
  applyMixer,
  createAudioGraph,
  peakFromAnalyser,
  rebuildReverb,
  type AudioGraph,
} from './graph'
import { beatsFromPulse, clamp, stepDurationSec, tapTempoBpm } from './music'
import {
  handoffPayload,
  loadLatestTake,
  loadLocalProject,
  parseProject,
  projectFilename,
  saveLocalProject,
  saveTakeAudio,
  serializeProject,
} from './persist'
import { MasterRecorder, takeToBuffer, takeToWav, type TakeAudio } from './recorder'
import { createInitialProject } from './reduce'
import { reduce } from './reduce'
import {
  createBassVoice,
  createLeadVoice,
  routeLeadLfo,
  silenceVoice,
  syncBassParams,
  syncLeadParams,
  triggerBass,
  triggerLead,
  type BassVoice,
  type LeadVoice,
} from './voices'
import type {
  Command,
  MeterBank,
  Playhead,
  Project,
  UiSnapshot,
} from './types'

type Listener = (project: Project) => void
type ClockListener = (playhead: Playhead) => void

const emptyMeters = (): MeterBank => ({
  kick: 0,
  snare: 0,
  ch: 0,
  oh: 0,
  clap: 0,
  perc: 0,
  drums: 0,
  bass: 0,
  synth: 0,
  masterL: 0,
  masterR: 0,
})

export class SoundStation {
  project: Project = createInitialProject()
  playhead: Playhead = { pulse: 0, step16: 0, beat: 0, bar: 0, time: 0 }
  recording = false
  playingTake = false
  lastError: string | null = null
  armed = false
  lastTake: TakeAudio | null = null

  private ctx: AudioContext | null = null
  private graph: AudioGraph | null = null
  private clock: MasterClock | null = null
  private bass: BassVoice | null = null
  private lead: LeadVoice | null = null
  private recorder: MasterRecorder | null = null
  private takeSource: AudioBufferSourceNode | null = null
  private taps: number[] = []
  private listeners = new Set<Listener>()
  private clockListeners = new Set<ClockListener>()
  private meters = emptyMeters()
  private scratch = new Float32Array(256)
  private meterTimer: number | null = null
  private chokeOh: AudioBufferSourceNode | null = null
  private lastReverbKey = ''

  get audioContext(): AudioContext | null {
    return this.ctx
  }

  snapshot(): UiSnapshot {
    return {
      project: this.project,
      playhead: this.playhead,
      recording: this.recording,
      playingTake: this.playingTake,
      lastError: this.lastError,
      armed: this.armed,
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.project)
    return () => this.listeners.delete(fn)
  }

  onClock(fn: ClockListener): () => void {
    this.clockListeners.add(fn)
    return () => this.clockListeners.delete(fn)
  }

  getMeters(): MeterBank {
    return this.meters
  }

  async arm(): Promise<void> {
    if (this.armed && this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext
    this.ctx = new Ctx({ latencyHint: 'interactive' })
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    this.graph = createAudioGraph(this.ctx, this.ctx.destination)
    this.bass = createBassVoice(this.ctx, this.graph.bassBus.input)
    this.lead = createLeadVoice(this.ctx, this.graph.synthBus.input)
    this.syncAudio()
    this.recorder = new MasterRecorder(this.ctx)
    await this.recorder.prepare(this.graph.recorderTap)
    this.clock = new MasterClock({
      getBpm: () => this.project.transport.bpm,
      getSwing: () => this.project.transport.swing,
      now: () => this.ctx!.currentTime,
      onStep: (ph) => this.handleStep(ph),
    })
    this.armed = true
    this.startMeters()
    this.emit()
  }

  dispatch(command: Command): void {
    if (command.type === 'START') {
      void this.start()
      return
    }
    if (command.type === 'STOP') {
      this.stop()
      return
    }
    if (command.type === 'RESET') {
      this.reset()
      return
    }
    const prevFx = this.project.fx
    this.project = reduce(this.project, command)
    if (command.type === 'SET_PARAMETER' && this.recording) {
      this.project = reduce(this.project, {
        type: 'RECORD_AUTOMATION',
        event: { beat: beatsFromPulse(this.playhead.pulse), path: command.path, value: command.value },
      })
    }
    if (command.type === 'SET_MACRO' && this.recording) {
      this.project = reduce(this.project, {
        type: 'RECORD_AUTOMATION',
        event: { beat: beatsFromPulse(this.playhead.pulse), path: `performance.macros.${command.id}`, value: command.value },
      })
    }
    if (
      command.type === 'SET_PARAMETER' ||
      command.type === 'SET_MACRO' ||
      command.type === 'SET_MIX' ||
      command.type === 'MUTE_CHANNEL' ||
      command.type === 'UNMUTE_CHANNEL' ||
      command.type === 'SOLO_CHANNEL' ||
      command.type === 'UNSOLO_CHANNEL' ||
      command.type === 'LOAD_PROJECT' ||
      command.type === 'NEW_PROJECT'
    ) {
      this.syncAudio()
      if (
        prevFx.reverb.size !== this.project.fx.reverb.size ||
        prevFx.reverb.damp !== this.project.fx.reverb.damp
      ) {
        this.maybeRebuildReverb()
      }
      if (this.lead) routeLeadLfo(this.lead, this.project.synth.params.lfo.dest)
    }
    this.emit()
  }

  async start(): Promise<void> {
    await this.arm()
    if (!this.clock || !this.ctx) return
    this.stopTake()
    this.project = reduce(this.project, { type: 'START' })
    if (!this.clock.isRunning) this.clock.start(this.playhead.pulse)
    this.emit()
  }

  stop(): void {
    this.clock?.stop()
    const now = this.ctx?.currentTime ?? 0
    if (this.bass) silenceVoice(this.bass.vca, now)
    if (this.lead) silenceVoice(this.lead.vca, now)
    this.project = reduce(this.project, { type: 'STOP' })
    this.emit()
  }

  reset(): void {
    this.clock?.reset()
    this.playhead = { pulse: 0, step16: 0, beat: 0, bar: 0, time: 0 }
    const now = this.ctx?.currentTime ?? 0
    if (this.bass) silenceVoice(this.bass.vca, now)
    if (this.lead) silenceVoice(this.lead.vca, now)
    this.project = reduce(this.project, { type: 'RESET' })
    this.clockListeners.forEach((fn) => fn(this.playhead))
    this.emit()
  }

  tapTempo(): void {
    const now = performance.now()
    if (this.taps.length && now - (this.taps[this.taps.length - 1] ?? 0) > 2200) this.taps = []
    this.taps.push(now)
    if (this.taps.length > 6) this.taps.shift()
    const bpm = tapTempoBpm(this.taps)
    if (bpm) this.dispatch({ type: 'SET_TEMPO', bpm })
  }

  async recordToggle(): Promise<void> {
    await this.arm()
    if (this.recording) {
      this.stopRecording()
      return
    }
    if (!this.recorder) {
      this.lastError = 'Recorder is not ready'
      this.emit()
      return
    }
    this.project = structuredClone(this.project)
    this.project.performance.automation = []
    this.recorder.start()
    this.recording = true
    this.lastError = null
    if (!this.project.transport.playing) await this.start()
    this.emit()
  }

  stopRecording(): TakeAudio | null {
    if (!this.recorder || !this.recording) return null
    const take = this.recorder.stop()
    this.recording = false
    if (!take) {
      this.lastError = this.recorder.lastError ?? 'Recording failed'
      this.emit()
      return null
    }
    this.lastTake = take
    this.project = reduce(this.project, {
      type: 'ADD_TAKE',
      take: {
        id: take.id,
        createdAt: new Date().toISOString(),
        durationSec: take.durationSec,
        bpm: this.project.transport.bpm,
        events: this.project.performance.automation.slice(),
      },
    })
    void saveTakeAudio(take).catch((err) => {
      this.lastError = err instanceof Error ? err.message : 'Could not store take'
      this.emit()
    })
    this.emit()
    return take
  }

  playLastTake(): void {
    if (!this.ctx || !this.lastTake || !this.graph) {
      this.lastError = 'No take to play'
      this.emit()
      return
    }
    this.stop()
    this.stopTake()
    const src = this.ctx.createBufferSource()
    src.buffer = takeToBuffer(this.ctx, this.lastTake)
    src.connect(this.graph.master)
    src.onended = () => {
      this.playingTake = false
      this.takeSource = null
      this.emit()
    }
    src.start()
    this.takeSource = src
    this.playingTake = true
    this.emit()
  }

  stopTake(): void {
    try {
      this.takeSource?.stop()
    } catch {
      /* already stopped */
    }
    this.takeSource = null
    this.playingTake = false
  }

  save(): void {
    this.project = structuredClone(this.project)
    this.project.meta.updatedAt = new Date().toISOString()
    saveLocalProject(this.project)
    this.emit()
  }

  loadSaved(): boolean {
    const loaded = loadLocalProject()
    if (!loaded) {
      this.lastError = 'No saved project in this browser'
      this.emit()
      return false
    }
    this.project = loaded
    this.syncAudio()
    void loadLatestTake(loaded.meta.takes).then((take) => {
      this.lastTake = take
      this.emit()
    })
    this.emit()
    return true
  }

  downloadProject(): void {
    const json = serializeProject(this.project)
    downloadArrayBuffer(projectFilename(this.project), new TextEncoder().encode(json).buffer, 'application/json')
  }

  openProjectFile(text: string): void {
    try {
      this.project = parseProject(text)
      this.syncAudio()
      this.lastError = null
      this.emit()
    } catch {
      this.lastError = 'Could not open project file'
      this.emit()
    }
  }

  newProject(): void {
    this.reset()
    this.project = reduce(this.project, { type: 'NEW_PROJECT' })
    this.lastTake = null
    this.syncAudio()
    this.emit()
  }

  async exportWav(bars = 4): Promise<void> {
    try {
      if (this.lastTake && !this.project.transport.playing) {
        downloadArrayBuffer(
          `${this.project.meta.name.replace(/\s+/g, '-')}-take.wav`,
          takeToWav(this.lastTake),
          'audio/wav',
        )
        return
      }
      const result = await renderProjectOffline(this.project, bars, this.ctx?.sampleRate ?? 44100)
      if (!result.audible) this.lastError = 'Export rendered silent — add notes or unmute channels'
      downloadArrayBuffer(`${this.project.meta.name.replace(/\s+/g, '-')}-loop.wav`, result.buffer, 'audio/wav')
      this.emit()
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Export failed'
      this.emit()
    }
  }

  async exportLoopWav(bars = 4): Promise<ArrayBuffer> {
    const result = await renderProjectOffline(this.project, bars, this.ctx?.sampleRate ?? 44100)
    return result.buffer
  }

  handoff() {
    return handoffPayload(this.project)
  }

  triggerPreviewDrum(voice: keyof Project['drums']['voices']): void {
    if (!this.ctx || !this.graph) return
    const dest = this.graph.drums[voice]
    const params = this.project.drums.voices[voice]
    if (!dest || !params) return
    const buf = getDrumBuffer(this.ctx, voice, { ...params, velocity: 1 })
    const src = this.ctx.createBufferSource()
    const pan = this.ctx.createStereoPanner()
    pan.pan.value = params.pan
    src.buffer = buf
    src.connect(pan)
    pan.connect(dest)
    src.start()
  }

  private handleStep(playhead: Playhead): void {
    this.playhead = playhead
    const before = this.project
    this.project = reduce(this.project, { type: 'COMMIT_PENDING_PATTERNS', pulse: playhead.pulse })
    if (before !== this.project && (
      before.drums.activePatternId !== this.project.drums.activePatternId ||
      before.bass.activePatternId !== this.project.bass.activePatternId ||
      before.synth.activePatternId !== this.project.synth.activePatternId
    )) {
      this.emit()
    }
    this.fireStep(playhead)
    const delayMs = Math.max(0, (playhead.time - (this.ctx?.currentTime ?? 0)) * 1000)
    window.setTimeout(() => {
      this.clockListeners.forEach((fn) => fn(playhead))
    }, delayMs)
  }

  private fireStep(playhead: Playhead): void {
    if (!this.ctx || !this.graph || !this.bass || !this.lead) return
    const { bpm, swing } = this.project.transport
    const stepLen = stepDurationSec(bpm, swing, playhead.pulse)
    const t = playhead.time

    const drumPat = this.project.drums.patterns[this.project.drums.activePatternId]
    if (drumPat) {
      const idx = playhead.pulse % drumPat.steps
      for (const voiceId of Object.keys(drumPat.tracks) as Array<keyof typeof drumPat.tracks>) {
        const cell = drumPat.tracks[voiceId][idx]
        const params = this.project.drums.voices[voiceId]
        const dest = this.graph.drums[voiceId]
        if (!cell?.on || !params || !dest) continue
        const buf = getDrumBuffer(this.ctx, voiceId, { ...params, velocity: cell.velocity })
        const src = this.ctx.createBufferSource()
        const pan = this.ctx.createStereoPanner()
        pan.pan.value = params.pan
        src.buffer = buf
        src.connect(pan)
        pan.connect(dest)
        if (voiceId === 'ch' && this.chokeOh) {
          try {
            this.chokeOh.stop(t)
          } catch {
            /* already gone */
          }
          this.chokeOh = null
        }
        src.start(t)
        if (voiceId === 'oh') this.chokeOh = src
      }
    }

    const bassPat = this.project.bass.patterns[this.project.bass.activePatternId]
    const bassStep = bassPat?.notes[playhead.pulse % (bassPat?.steps ?? 16)]
    if (bassStep?.on) triggerBass(this.ctx, this.bass, this.project.bass.params, bassStep, t, stepLen)

    const synthPat = this.project.synth.patterns[this.project.synth.activePatternId]
    const synthStep = synthPat?.notes[playhead.pulse % (synthPat?.steps ?? 16)]
    if (synthStep?.on) triggerLead(this.ctx, this.lead, this.project.synth.params, synthStep, t, stepLen)
  }

  private syncAudio(): void {
    if (!this.graph || !this.ctx || !this.bass || !this.lead) return
    applyMixer(this.graph, this.project.mixer, this.project)
    applyFx(this.graph, this.project.fx)
    const now = this.ctx.currentTime
    syncBassParams(this.bass, this.project.bass.params, now)
    syncLeadParams(this.lead, this.project.synth.params, now)
  }

  private maybeRebuildReverb(): void {
    if (!this.graph) return
    const key = `${this.project.fx.reverb.size}:${this.project.fx.reverb.damp}`
    if (key === this.lastReverbKey) return
    this.lastReverbKey = key
    rebuildReverb(this.graph, this.project.fx.reverb.size, this.project.fx.reverb.damp)
  }

  private startMeters(): void {
    if (this.meterTimer !== null) return
    const tick = () => {
      this.readMeters()
      this.meterTimer = window.setTimeout(tick, 40)
    }
    tick()
  }

  private readMeters(): void {
    const g = this.graph
    if (!g) return
    const s = this.scratch
    const decay = 0.62
    const bump = (prev: number, next: number) => Math.max(next, prev * decay)
    this.meters.drums = bump(this.meters.drums, peakFromAnalyser(g.drumBus.analyser, s))
    this.meters.bass = bump(this.meters.bass, peakFromAnalyser(g.bassBus.analyser, s))
    this.meters.synth = bump(this.meters.synth, peakFromAnalyser(g.synthBus.analyser, s))
    this.meters.masterL = bump(this.meters.masterL, peakFromAnalyser(g.masterAnalyser, s))
    this.meters.masterR = this.meters.masterL
    this.meters.kick = bump(this.meters.kick, g.drums.kick?.gain.value ? this.meters.drums * 0.8 : this.meters.kick * decay)
    this.meters.snare = bump(this.meters.snare, this.meters.drums)
    this.meters.ch = bump(this.meters.ch, this.meters.drums * 0.5)
    this.meters.oh = bump(this.meters.oh, this.meters.drums * 0.5)
    this.meters.clap = bump(this.meters.clap, this.meters.drums * 0.6)
    this.meters.perc = bump(this.meters.perc, this.meters.drums * 0.4)
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.project)
  }
}

export function createStation(): SoundStation {
  const station = new SoundStation()
  const saved = loadLocalProject()
  if (saved) station.project = saved
  return station
}

export { clamp }
