import { clamp, hzFromNorm, mtof } from './music'
import type { BassParams, MelodicStep, SynthParams, Waveform } from './types'

export interface BassVoice {
  osc: OscillatorNode
  filter: BiquadFilterNode
  filter2: BiquadFilterNode
  vca: GainNode
  panner: StereoPannerNode
  lastMidi: number
}

export interface LeadVoice {
  oscA: OscillatorNode
  oscB: OscillatorNode
  mixA: GainNode
  mixB: GainNode
  filter: BiquadFilterNode
  vca: GainNode
  panner: StereoPannerNode
  lfo: OscillatorNode
  lfoGain: GainNode
  lastMidi: number
  lfoDest: AudioParam
}

function wave(node: OscillatorNode, w: Waveform): void {
  node.type = w
}

export function createBassVoice(ctx: BaseAudioContext, dest: AudioNode): BassVoice {
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.value = mtof(33)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 600
  filter.Q.value = 8
  const filter2 = ctx.createBiquadFilter()
  filter2.type = 'lowpass'
  filter2.frequency.value = 900
  filter2.Q.value = 1.4
  const vca = ctx.createGain()
  vca.gain.value = 0
  const panner = ctx.createStereoPanner()
  osc.connect(filter)
  filter.connect(filter2)
  filter2.connect(vca)
  vca.connect(panner)
  panner.connect(dest)
  osc.start()
  return { osc, filter, filter2, vca, panner, lastMidi: 33 }
}

export function syncBassParams(voice: BassVoice, params: BassParams, when: number): void {
  wave(voice.osc, params.waveform)
  voice.panner.pan.setTargetAtTime(params.pan, when, 0.02)
  const cutoff = hzFromNorm(params.cutoff, 60, 5200)
  voice.filter.frequency.setTargetAtTime(cutoff, when, 0.03)
  voice.filter2.frequency.setTargetAtTime(cutoff * 1.4, when, 0.03)
  voice.filter.Q.setTargetAtTime(lerpQ(params.resonance, 0.7, 16), when, 0.03)
}

function lerpQ(t: number, a: number, b: number): number {
  return a + (b - a) * clamp(t, 0, 1)
}

export function triggerBass(
  _ctx: BaseAudioContext,
  voice: BassVoice,
  params: BassParams,
  step: MelodicStep,
  time: number,
  stepLen: number,
): void {
  const midi = step.note + params.tuning
  const freq = mtof(midi)
  const prev = mtof(voice.lastMidi)
  const glide = step.slide ? clamp(params.glide, 0, 1) * 0.22 : 0
  voice.osc.frequency.cancelScheduledValues(time)
  if (glide > 0.001) {
    voice.osc.frequency.setValueAtTime(Math.max(20, prev), time)
    voice.osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq), time + glide)
  } else {
    voice.osc.frequency.setValueAtTime(Math.max(20, freq), time)
  }
  voice.lastMidi = midi
  wave(voice.osc, params.waveform)

  const accent = step.accent ? 1 + params.accent * 0.9 : 1
  const cutoff = hzFromNorm(params.cutoff, 70, 4800)
  const envAmt = params.envMod * accent * 3800
  const peak = Math.min(12000, cutoff + envAmt)
  const dec = lerpQ(params.decay, 0.06, 0.55) * (step.accent ? 1.15 : 1)
  voice.filter.frequency.cancelScheduledValues(time)
  voice.filter.frequency.setValueAtTime(peak, time)
  voice.filter.frequency.exponentialRampToValueAtTime(Math.max(70, cutoff), time + dec)
  voice.filter.Q.setValueAtTime(lerpQ(params.resonance, 0.8, 14), time)
  voice.filter2.frequency.setValueAtTime(Math.min(14000, peak * 1.35), time)
  voice.filter2.frequency.exponentialRampToValueAtTime(Math.max(90, cutoff * 1.3), time + dec)

  const vel = step.velocity * params.level * (step.accent ? 1.12 : 0.86)
  const gate = Math.max(0.03, step.gate * stepLen)
  const g = voice.vca.gain
  g.cancelScheduledValues(time)
  g.setValueAtTime(Math.max(0.0001, g.value || 0.0001), time)
  g.exponentialRampToValueAtTime(Math.max(0.0001, vel), time + 0.004)
  g.exponentialRampToValueAtTime(0.0001, time + gate + dec * 0.35)
  voice.panner.pan.setValueAtTime(params.pan, time)
}

export function createLeadVoice(ctx: BaseAudioContext, dest: AudioNode): LeadVoice {
  const oscA = ctx.createOscillator()
  const oscB = ctx.createOscillator()
  oscA.type = 'sawtooth'
  oscB.type = 'triangle'
  oscA.frequency.value = mtof(57)
  oscB.frequency.value = mtof(57)
  const mixA = ctx.createGain()
  const mixB = ctx.createGain()
  mixA.gain.value = 0.7
  mixB.gain.value = 0.4
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1400
  filter.Q.value = 2
  const vca = ctx.createGain()
  vca.gain.value = 0
  const panner = ctx.createStereoPanner()
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 2.2
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0
  oscA.connect(mixA)
  oscB.connect(mixB)
  mixA.connect(filter)
  mixB.connect(filter)
  filter.connect(vca)
  vca.connect(panner)
  panner.connect(dest)
  lfo.connect(lfoGain)
  lfoGain.connect(filter.frequency)
  oscA.start()
  oscB.start()
  lfo.start()
  return {
    oscA,
    oscB,
    mixA,
    mixB,
    filter,
    vca,
    panner,
    lfo,
    lfoGain,
    lastMidi: 57,
    lfoDest: filter.frequency,
  }
}

export function syncLeadParams(voice: LeadVoice, params: SynthParams, when: number): void {
  wave(voice.oscA, params.oscA.waveform)
  wave(voice.oscB, params.oscB.waveform)
  voice.mixA.gain.setTargetAtTime(params.oscA.level, when, 0.02)
  voice.mixB.gain.setTargetAtTime(params.oscB.level, when, 0.02)
  voice.oscB.detune.setTargetAtTime(params.oscB.detune, when, 0.02)
  voice.panner.pan.setTargetAtTime(params.pan, when, 0.02)
  const cutoff = hzFromNorm(params.cutoff, 80, 9000)
  voice.filter.frequency.setTargetAtTime(cutoff, when, 0.025)
  voice.filter.Q.setTargetAtTime(lerpQ(params.resonance, 0.3, 12), when, 0.03)
  voice.lfo.frequency.setTargetAtTime(lerpQ(params.lfo.rate, 0.08, 14), when, 0.03)
  const amt =
    params.lfo.dest === 'cutoff'
      ? params.lfo.amount * 1800
      : params.lfo.dest === 'pitch'
        ? params.lfo.amount * 28
        : params.lfo.amount * 0.18
  voice.lfoGain.gain.setTargetAtTime(amt, when, 0.03)
}

export function routeLeadLfo(voice: LeadVoice, dest: 'cutoff' | 'pitch' | 'amp'): void {
  voice.lfoGain.disconnect()
  if (dest === 'cutoff') {
    voice.lfoGain.connect(voice.filter.frequency)
    voice.lfoDest = voice.filter.frequency
  } else if (dest === 'pitch') {
    voice.lfoGain.connect(voice.oscA.frequency)
    voice.lfoGain.connect(voice.oscB.frequency)
    voice.lfoDest = voice.oscA.frequency
  } else {
    voice.lfoGain.connect(voice.vca.gain)
    voice.lfoDest = voice.vca.gain
  }
}

export function triggerLead(
  _ctx: BaseAudioContext,
  voice: LeadVoice,
  params: SynthParams,
  step: MelodicStep,
  time: number,
  stepLen: number,
): void {
  const midi = step.note + params.oscA.octave * 12
  const midiB = step.note + params.oscB.octave * 12
  const freqA = mtof(midi)
  const freqB = mtof(midiB)
  const glide = params.glide * 0.18
  const prevA = mtof(voice.lastMidi)
  voice.oscA.frequency.cancelScheduledValues(time)
  voice.oscB.frequency.cancelScheduledValues(time)
  if (glide > 0.004) {
    voice.oscA.frequency.setValueAtTime(Math.max(20, prevA), time)
    voice.oscA.frequency.exponentialRampToValueAtTime(Math.max(20, freqA), time + glide)
    voice.oscB.frequency.setValueAtTime(Math.max(20, prevA * (freqB / freqA)), time)
    voice.oscB.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), time + glide)
  } else {
    voice.oscA.frequency.setValueAtTime(Math.max(20, freqA), time)
    voice.oscB.frequency.setValueAtTime(Math.max(20, freqB), time)
  }
  voice.oscB.detune.setValueAtTime(params.oscB.detune, time)
  wave(voice.oscA, params.oscA.waveform)
  wave(voice.oscB, params.oscB.waveform)
  voice.mixA.gain.setValueAtTime(params.oscA.level, time)
  voice.mixB.gain.setValueAtTime(params.oscB.level, time)
  voice.lastMidi = midi

  const cutoff = hzFromNorm(params.cutoff, 90, 8600)
  const peak = Math.min(14000, cutoff + params.filterEnv.amount * (step.accent ? 1.4 : 1) * 4200)
  const fa = Math.max(0.002, params.filterEnv.attack)
  const fd = Math.max(0.02, params.filterEnv.decay)
  const fr = Math.max(0.02, params.filterEnv.release)
  voice.filter.Q.setValueAtTime(lerpQ(params.resonance, 0.4, 11), time)
  voice.filter.frequency.cancelScheduledValues(time)
  voice.filter.frequency.setValueAtTime(cutoff, time)
  voice.filter.frequency.linearRampToValueAtTime(peak, time + fa)
  voice.filter.frequency.exponentialRampToValueAtTime(
    Math.max(80, cutoff + params.filterEnv.sustain * (peak - cutoff)),
    time + fa + fd,
  )

  const vel = params.level * step.velocity * (step.accent ? 1.08 : 0.9)
  const gate = Math.max(0.04, step.gate * stepLen)
  const atk = Math.max(0.003, params.ampEnv.attack)
  const dec = Math.max(0.02, params.ampEnv.decay)
  const rel = Math.max(0.03, params.ampEnv.release)
  const sus = params.ampEnv.sustain * vel
  const g = voice.vca.gain
  g.cancelScheduledValues(time)
  g.setValueAtTime(Math.max(0.0001, g.value || 0.0001), time)
  g.linearRampToValueAtTime(Math.max(0.0001, vel), time + atk)
  g.linearRampToValueAtTime(Math.max(0.0001, sus), time + atk + dec)
  g.setValueAtTime(Math.max(0.0001, sus), time + gate)
  g.exponentialRampToValueAtTime(0.0001, time + gate + rel)
  voice.filter.frequency.setValueAtTime(
    Math.max(80, cutoff + params.filterEnv.sustain * (peak - cutoff)),
    time + gate,
  )
  voice.filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff), time + gate + fr)
  voice.panner.pan.setValueAtTime(params.pan, time)
}

export function silenceVoice(gain: GainNode, time: number): void {
  gain.gain.cancelScheduledValues(time)
  gain.gain.setTargetAtTime(0.0001, time, 0.01)
}
