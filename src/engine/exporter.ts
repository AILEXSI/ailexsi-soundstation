import { getDrumBuffer } from './drums'
import { applyFx, applyMixer, createAudioGraph } from './graph'
import { stepDurationSec } from './music'
import { planPerformance } from './scheduler'
import { createBassVoice, createLeadVoice, triggerBass, triggerLead } from './voices'
import { encodeWav, hasAudibleSignal, mixToStereo } from './wav'
import type { Project } from './types'

export interface ExportResult {
  buffer: ArrayBuffer
  sampleRate: number
  durationSec: number
  audible: boolean
}

export async function renderProjectOffline(
  project: Project,
  bars = 4,
  sampleRate = 44100,
): Promise<ExportResult> {
  const plan = planPerformance(project, bars, 0.02)
  const last = plan[plan.length - 1]
  const tail = 1.6
  const duration = (last?.playhead.time ?? 1) + stepDurationSec(project.transport.bpm, project.transport.swing, last?.playhead.pulse ?? 0) + tail
  const Offline = globalThis.OfflineAudioContext
  if (!Offline) {
    throw new Error('OfflineAudioContext is not available in this environment')
  }
  const ctx = new Offline(2, Math.ceil(duration * sampleRate), sampleRate)
  const graph = createAudioGraph(ctx, ctx.destination)
  applyMixer(graph, project.mixer, project)
  applyFx(graph, project.fx)
  const bass = createBassVoice(ctx, graph.bassBus.input)
  const lead = createLeadVoice(ctx, graph.synthBus.input)

  for (const step of plan) {
    const stepLen = stepDurationSec(project.transport.bpm, project.transport.swing, step.playhead.pulse)
    for (const hit of step.drums) {
      const voice = project.drums.voices[hit.voice]
      const dest = graph.drums[hit.voice]
      if (!voice || !dest) continue
      const buf = getDrumBuffer(ctx, hit.voice, { ...voice, velocity: hit.velocity })
      const src = ctx.createBufferSource()
      const pan = ctx.createStereoPanner()
      pan.pan.value = voice.pan
      src.buffer = buf
      src.connect(pan)
      pan.connect(dest)
      src.start(step.playhead.time)
    }
    if (step.bass) triggerBass(ctx, bass, project.bass.params, step.bass, step.playhead.time, stepLen)
    if (step.synth) triggerLead(ctx, lead, project.synth.params, step.synth, step.playhead.time, stepLen)
  }

  const rendered = await ctx.startRendering()
  const channels = mixToStereo(
    [rendered.getChannelData(0), rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : rendered.getChannelData(0)],
  )
  const wav = encodeWav(channels, rendered.sampleRate)
  return {
    buffer: wav,
    sampleRate: rendered.sampleRate,
    durationSec: rendered.duration,
    audible: hasAudibleSignal(channels),
  }
}

export function downloadArrayBuffer(filename: string, buffer: ArrayBuffer, mime: string): void {
  const blob = new Blob([buffer], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
