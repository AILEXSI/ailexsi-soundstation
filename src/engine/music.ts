export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function mtof(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export function midiName(midi: number): string {
  const n = Math.round(midi)
  const oct = Math.floor(n / 12) - 1
  const name = NOTE_NAMES[((n % 12) + 12) % 12]
  return `${name}${oct}`
}

export function hzFromNorm(norm: number, min = 40, max = 12000): number {
  const t = clamp(norm, 0, 1)
  return min * (max / min) ** t
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20)
}

export function stepDurationSec(bpm: number, swing: number, pulse: number): number {
  const sixteenth = 60 / Math.max(20, bpm) / 4
  const s = clamp(swing, 0, 1)
  if (s <= 0) return sixteenth
  return pulse % 2 === 0 ? sixteenth * (1 - s * 0.45) : sixteenth * (1 + s * 0.45)
}

export function pulseToPlayhead(pulse: number, time = 0): {
  pulse: number
  step16: number
  beat: number
  bar: number
  time: number
} {
  const step16 = ((pulse % 16) + 16) % 16
  const beat = Math.floor(step16 / 4)
  const bar = Math.floor(pulse / 16)
  return { pulse, step16, beat, bar, time }
}

export function canCommitPattern(quantize: 'step' | 'beat' | 'bar', pulse: number): boolean {
  if (quantize === 'step') return true
  if (quantize === 'beat') return pulse % 4 === 0
  return pulse % 16 === 0
}

export function beatsFromPulse(pulse: number): number {
  return pulse / 4
}

export function tapTempoBpm(tapsMs: number[]): number | null {
  if (tapsMs.length < 2) return null
  const intervals: number[] = []
  for (let i = 1; i < tapsMs.length; i++) {
    const a = tapsMs[i - 1]
    const b = tapsMs[i]
    if (a === undefined || b === undefined) continue
    const d = b - a
    if (d > 2200) return null
    intervals.push(d)
  }
  if (intervals.length === 0) return null
  const avg = intervals.reduce((s, n) => s + n, 0) / intervals.length
  return clamp(Math.round(60000 / avg), 40, 240)
}

export function nextPatternName(existing: string[]): string {
  for (const bank of ['A', 'B']) {
    for (let i = 1; i <= 16; i++) {
      const name = `${bank}${String(i).padStart(2, '0')}`
      if (!existing.includes(name)) return name
    }
  }
  return `P${existing.length + 1}`
}
