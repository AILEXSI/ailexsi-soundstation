import { clamp, lerp } from './music'
import type { DrumVoiceId, DrumVoiceParams } from './types'

export interface DrumHitParams extends DrumVoiceParams {
  velocity: number
}

function env(t: number, decay: number): number {
  if (t < 0) return 0
  return Math.exp(-t / Math.max(0.004, decay))
}

function white(seed: { x: number }): number {
  seed.x = (seed.x * 16807 + 11) % 2147483647
  return (seed.x / 2147483647) * 2 - 1
}

function applyOnePole(x: number, state: { y: number }, coeff: number): number {
  state.y += coeff * (x - state.y)
  return state.y
}

export function kickLength(decay: number, sampleRate: number): number {
  return Math.floor(sampleRate * lerp(0.12, 0.72, clamp(decay, 0, 1)))
}

export function renderKick(out: Float32Array, sampleRate: number, p: DrumHitParams): void {
  const seed = { x: 9011 }
  const startHz = lerp(92, 168, clamp(p.tone, 0, 1)) * 2 ** p.pitch
  const endHz = lerp(38, 58, clamp(p.pitch + 0.5, 0, 1))
  const decay = lerp(0.08, 0.42, p.decay)
  const clickAmt = lerp(0.04, 0.28, p.tone) * p.velocity
  const bodyAmt = p.level * p.velocity
  let phase = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate
    const f = endHz + (startHz - endHz) * Math.exp(-t * 28)
    phase += (2 * Math.PI * f) / sampleRate
    const body = Math.sin(phase) * env(t, decay)
    const click = white(seed) * env(t, 0.004) * clickAmt
    const sat = Math.tanh(body * (1.4 + p.tone * 0.8))
    out[i] = (sat * bodyAmt + click) * 1.15
  }
}

export function renderSnare(out: Float32Array, sampleRate: number, p: DrumHitParams): void {
  const seed = { x: 4241 }
  const toneHz = lerp(160, 240, p.tone) * 2 ** (p.pitch * 0.8)
  const decay = lerp(0.05, 0.28, p.decay)
  const hp = { y: 0 }
  const bp = { y: 0 }
  let phase = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate
    phase += (2 * Math.PI * toneHz) / sampleRate
    const body = Math.sin(phase) * env(t, decay * 0.55) * lerp(0.2, 0.55, 1 - p.tone)
    const n = white(seed)
    const bright = applyOnePole(n, hp, lerp(0.18, 0.55, p.tone))
    const air = n - applyOnePole(n, bp, 0.08)
    const noise = (bright * 0.7 + air * 0.45) * env(t, decay)
    out[i] = (body + noise) * p.level * p.velocity * 1.05
  }
}

export function renderHat(out: Float32Array, sampleRate: number, p: DrumHitParams, open: boolean): void {
  const seed = { x: open ? 1777 : 311 }
  const decay = open ? lerp(0.08, 0.55, p.decay) : lerp(0.012, 0.07, p.decay)
  const hp = { y: 0 }
  const metallic = [2 ** (p.pitch * 0.4) * 248, 2 ** (p.pitch * 0.4) * 367, 2 ** (p.pitch * 0.4) * 523]
  const phases = [0, 0.2, 0.7]
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate
    let metal = 0
    for (let m = 0; m < metallic.length; m++) {
      const hz = metallic[m] ?? 300
      phases[m] = (phases[m] ?? 0) + (2 * Math.PI * hz) / sampleRate
      metal += Math.sign(Math.sin(phases[m] ?? 0))
    }
    const n = white(seed)
    const bright = n - applyOnePole(n, hp, lerp(0.08, 0.22, 1 - p.tone))
    const mix = bright * 0.82 + metal * 0.08 * p.tone
    out[i] = mix * env(t, decay) * p.level * p.velocity * (open ? 0.7 : 0.62)
  }
}

export function renderClap(out: Float32Array, sampleRate: number, p: DrumHitParams): void {
  const seed = { x: 9901 }
  const bursts = [0, 0.011, 0.023, 0.038]
  const decay = lerp(0.04, 0.22, p.decay)
  const bp = { y: 0 }
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate
    let burst = 0
    for (const b of bursts) {
      if (t >= b) burst += env(t - b, 0.011)
    }
    const n = white(seed)
    const band = n - applyOnePole(n, bp, lerp(0.12, 0.28, p.tone))
    const tail = env(t, decay) * 0.55
    out[i] = band * (burst * 0.85 + tail) * p.level * p.velocity * 0.95
  }
}

export function renderPerc(out: Float32Array, sampleRate: number, p: DrumHitParams): void {
  const seed = { x: 1559 }
  const a = lerp(520, 880, (p.pitch + 1) / 2) * lerp(0.9, 1.15, p.tone)
  const b = a * 1.47
  const decay = lerp(0.04, 0.26, p.decay)
  let pa = 0
  let pb = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate
    pa += (2 * Math.PI * a) / sampleRate
    pb += (2 * Math.PI * b) / sampleRate
    const body = (Math.sin(pa) + Math.sin(pb) * 0.55) * env(t, decay)
    const tick = white(seed) * env(t, 0.006) * 0.25
    out[i] = (body + tick) * p.level * p.velocity * 0.72
  }
}

export function renderDrumVoice(
  voice: DrumVoiceId,
  sampleRate: number,
  p: DrumHitParams,
): Float32Array {
  const seconds =
    voice === 'kick'
      ? lerp(0.14, 0.7, p.decay)
      : voice === 'oh'
        ? lerp(0.12, 0.62, p.decay)
        : voice === 'ch'
          ? lerp(0.03, 0.1, p.decay)
          : lerp(0.1, 0.38, p.decay)
  const out = new Float32Array(Math.max(32, Math.floor(sampleRate * seconds)))
  if (voice === 'kick') renderKick(out, sampleRate, p)
  else if (voice === 'snare') renderSnare(out, sampleRate, p)
  else if (voice === 'ch') renderHat(out, sampleRate, p, false)
  else if (voice === 'oh') renderHat(out, sampleRate, p, true)
  else if (voice === 'clap') renderClap(out, sampleRate, p)
  else renderPerc(out, sampleRate, p)
  return out
}

const bufferCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>()

function cacheKey(voice: DrumVoiceId, p: DrumHitParams): string {
  return [
    voice,
    p.level.toFixed(2),
    p.pitch.toFixed(2),
    p.decay.toFixed(2),
    p.tone.toFixed(2),
    p.velocity.toFixed(2),
  ].join('|')
}

export function getDrumBuffer(
  ctx: BaseAudioContext,
  voice: DrumVoiceId,
  p: DrumHitParams,
): AudioBuffer {
  let map = bufferCache.get(ctx)
  if (!map) {
    map = new Map()
    bufferCache.set(ctx, map)
  }
  const key = cacheKey(voice, p)
  const hit = map.get(key)
  if (hit) return hit
  const samples = renderDrumVoice(voice, ctx.sampleRate, p)
  const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate)
  buf.copyToChannel(samples as unknown as Float32Array<ArrayBuffer>, 0)
  map.set(key, buf)
  if (map.size > 80) {
    const first = map.keys().next().value
    if (first) map.delete(first)
  }
  return buf
}
