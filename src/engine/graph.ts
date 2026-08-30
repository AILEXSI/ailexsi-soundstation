import { clamp, hzFromNorm } from './music'
import type { DistortionTarget, FilterType, FxState, MixerState, Project } from './types'

export interface Bus {
  input: GainNode
  panner: StereoPannerNode
  insert: GainNode
  sendDelay: GainNode
  sendReverb: GainNode
  sendDist: GainNode
  dry: GainNode
  analyser: AnalyserNode
  mute: GainNode
}

export interface AudioGraph {
  ctx: BaseAudioContext
  drums: Record<string, GainNode>
  drumBus: Bus
  bassBus: Bus
  synthBus: Bus
  delay: DelayNode
  delayFb: GainNode
  delayOut: GainNode
  delayL: DelayNode
  reverb: ConvolverNode
  reverbGain: GainNode
  distortion: WaveShaperNode
  distortionMix: GainNode
  distIn: GainNode
  masterFilter: BiquadFilterNode
  compressor: DynamicsCompressorNode
  master: GainNode
  masterAnalyser: AnalyserNode
  recorderTap: GainNode
  destination: AudioNode
}

function makeCurve(amount: number): Float32Array {
  const n = 2048
  const curve = new Float32Array(n)
  const k = amount * 80
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
  }
  return curve
}

export function makeReverbIR(ctx: BaseAudioContext, size: number, damp: number): AudioBuffer {
  const seconds = 0.6 + size * 2.6
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  const decay = 2.2 + damp * 3
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c)
    for (let i = 0; i < len; i++) {
      const env = (1 - i / len) ** decay
      data[i] = (Math.random() * 2 - 1) * env * (c === 0 ? 1 : 0.92)
    }
  }
  return buf
}

function createBus(ctx: BaseAudioContext): Bus {
  const input = ctx.createGain()
  const insert = ctx.createGain()
  const panner = ctx.createStereoPanner()
  const mute = ctx.createGain()
  const sendDelay = ctx.createGain()
  const sendReverb = ctx.createGain()
  const sendDist = ctx.createGain()
  const dry = ctx.createGain()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.4
  sendDelay.gain.value = 0.05
  sendReverb.gain.value = 0.1
  sendDist.gain.value = 0
  dry.gain.value = 1
  input.connect(insert)
  insert.connect(panner)
  panner.connect(mute)
  mute.connect(analyser)
  mute.connect(sendDelay)
  mute.connect(sendReverb)
  mute.connect(sendDist)
  mute.connect(dry)
  return { input, panner, insert, sendDelay, sendReverb, sendDist, dry, analyser, mute }
}

export function createAudioGraph(ctx: BaseAudioContext, destination: AudioNode): AudioGraph {
  const drums: Record<string, GainNode> = {}
  for (const id of ['kick', 'snare', 'ch', 'oh', 'clap', 'perc']) {
    drums[id] = ctx.createGain()
  }
  const drumBus = createBus(ctx)
  const bassBus = createBus(ctx)
  const synthBus = createBus(ctx)
  for (const g of Object.values(drums)) g.connect(drumBus.input)

  const delay = ctx.createDelay(1.5)
  const delayFb = ctx.createGain()
  const delayOut = ctx.createGain()
  const delayL = ctx.createDelay(1.5)
  delay.delayTime.value = 0.28
  delayL.delayTime.value = 0.31
  delayFb.gain.value = 0.35
  delayOut.gain.value = 0.2
  drumBus.sendDelay.connect(delay)
  bassBus.sendDelay.connect(delay)
  synthBus.sendDelay.connect(delay)
  delay.connect(delayFb)
  delayFb.connect(delay)
  delay.connect(delayL)
  delay.connect(delayOut)
  delayL.connect(delayOut)

  const reverb = ctx.createConvolver()
  reverb.buffer = makeReverbIR(ctx, 0.48, 0.4)
  const reverbGain = ctx.createGain()
  reverbGain.gain.value = 0.18
  drumBus.sendReverb.connect(reverb)
  bassBus.sendReverb.connect(reverb)
  synthBus.sendReverb.connect(reverb)
  reverb.connect(reverbGain)

  const distIn = ctx.createGain()
  const distortion = ctx.createWaveShaper()
  distortion.curve = makeCurve(0.22) as unknown as Float32Array<ArrayBuffer>
  distortion.oversample = '2x'
  const distortionMix = ctx.createGain()
  distortionMix.gain.value = 0.12
  drumBus.sendDist.connect(distIn)
  bassBus.sendDist.connect(distIn)
  synthBus.sendDist.connect(distIn)
  distIn.connect(distortion)
  distortion.connect(distortionMix)

  const sum = ctx.createGain()
  drumBus.dry.connect(sum)
  bassBus.dry.connect(sum)
  synthBus.dry.connect(sum)
  delayOut.connect(sum)
  reverbGain.connect(sum)
  distortionMix.connect(sum)

  const masterFilter = ctx.createBiquadFilter()
  masterFilter.type = 'lowpass'
  masterFilter.frequency.value = 16000
  masterFilter.Q.value = 0.7

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -14
  compressor.ratio.value = 2.4
  compressor.attack.value = 0.008
  compressor.release.value = 0.16
  compressor.knee.value = 8

  const master = ctx.createGain()
  master.gain.value = 0.82
  const masterAnalyser = ctx.createAnalyser()
  masterAnalyser.fftSize = 512
  masterAnalyser.smoothingTimeConstant = 0.35
  const recorderTap = ctx.createGain()

  sum.connect(masterFilter)
  masterFilter.connect(compressor)
  compressor.connect(master)
  master.connect(masterAnalyser)
  master.connect(recorderTap)
  master.connect(destination)

  drumBus.sendDist.gain.value = 1

  return {
    ctx,
    drums,
    drumBus,
    bassBus,
    synthBus,
    delay,
    delayFb,
    delayOut,
    delayL,
    reverb,
    reverbGain,
    distortion,
    distortionMix,
    distIn,
    masterFilter,
    compressor,
    master,
    masterAnalyser,
    recorderTap,
    destination,
  }
}

function anyInstrumentSolo(mixer: MixerState): boolean {
  return mixer.drums.solo || mixer.bass.solo || mixer.synth.solo
}

function anyDrumSolo(project: Project): boolean {
  return Object.values(project.drums.voices).some((v) => v.solo)
}

export function applyMixer(graph: AudioGraph, mixer: MixerState, project: Project): void {
  const instSolo = anyInstrumentSolo(mixer)
  const setBus = (bus: Bus, mix: MixerState['drums'], extraMute: boolean) => {
    const silenced = mix.mute || extraMute || (instSolo && !mix.solo)
    bus.mute.gain.value = silenced ? 0 : 1
    bus.panner.pan.value = mix.pan
    bus.insert.gain.value = mix.volume
    bus.sendDelay.gain.value = mix.sendDelay
    bus.sendReverb.gain.value = mix.sendReverb
  }
  setBus(graph.drumBus, mixer.drums, false)
  setBus(graph.bassBus, mixer.bass, project.bass.params.mute)
  setBus(graph.synthBus, mixer.synth, project.synth.params.mute)
  graph.master.gain.value = mixer.master.mute ? 0 : mixer.master.volume

  const drumSolo = anyDrumSolo(project)
  for (const [id, node] of Object.entries(graph.drums)) {
    const voice = project.drums.voices[id as keyof typeof project.drums.voices]
    if (!voice) continue
    node.gain.value = voice.mute || (drumSolo && !voice.solo) ? 0 : 1
  }
}

export function applyFx(graph: AudioGraph, fx: FxState): void {
  graph.delay.delayTime.value = 0.05 + fx.delay.time * 0.7
  graph.delayL.delayTime.value = 0.05 + fx.delay.time * 0.7 * (fx.delay.pingPong ? 1.12 : 1)
  graph.delayFb.gain.value = clamp(fx.delay.feedback, 0, 0.85)
  graph.delayOut.gain.value = fx.delay.mix
  graph.reverbGain.gain.value = fx.reverb.mix
  graph.distortion.curve = makeCurve(fx.distortion.drive) as unknown as Float32Array<ArrayBuffer>
  graph.distortionMix.gain.value = fx.distortion.mix
  graph.masterFilter.type = fx.filter.type
  graph.masterFilter.frequency.value = hzFromNorm(fx.filter.cutoff, 80, 18000)
  graph.masterFilter.Q.value = 0.4 + fx.filter.resonance * 14
  graph.compressor.threshold.value = -8 - fx.compressor.threshold * 18
  graph.compressor.ratio.value = 1.2 + fx.compressor.ratio * 8
  graph.compressor.attack.value = 0.002 + fx.compressor.attack * 0.04
  graph.compressor.release.value = 0.04 + fx.compressor.release * 0.4
  retargetDistortion(graph, fx.distortion.target)
}

export function rebuildReverb(graph: AudioGraph, size: number, damp: number): void {
  graph.reverb.buffer = makeReverbIR(graph.ctx, size, damp)
}

export function peakFromAnalyser(analyser: AnalyserNode, scratch: Float32Array): number {
  analyser.getFloatTimeDomainData(scratch as unknown as Float32Array<ArrayBuffer>)
  let p = 0
  for (let i = 0; i < scratch.length; i++) p = Math.max(p, Math.abs(scratch[i] ?? 0))
  return p
}

export function setFilterType(filter: BiquadFilterNode, type: FilterType): void {
  filter.type = type
}

export function retargetDistortion(graph: AudioGraph, target: DistortionTarget): void {
  graph.drumBus.sendDist.gain.value = target === 'drums' || target === 'master' ? 1 : 0
  graph.bassBus.sendDist.gain.value = target === 'bass' || target === 'master' ? 1 : 0
  graph.synthBus.sendDist.gain.value = target === 'synth' || target === 'master' ? 1 : 0
  if (target === 'master') {
    graph.drumBus.dry.gain.value = 0.55
    graph.bassBus.dry.gain.value = 0.55
    graph.synthBus.dry.gain.value = 0.55
  } else {
    graph.drumBus.dry.gain.value = 1
    graph.bassBus.dry.gain.value = 1
    graph.synthBus.dry.gain.value = 1
  }
}
