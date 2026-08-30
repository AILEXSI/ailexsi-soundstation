import { DRUM_VOICES, PATTERN_IDS } from './types'
import type {
  BassParams,
  ChannelMix,
  DrumPattern,
  DrumStep,
  DrumVoiceId,
  DrumVoiceParams,
  MelodicPattern,
  MelodicStep,
  Project,
  SynthParams,
} from './types'

/** Progressive psytrance pocket. The clock still accepts 40–240 via SET_TEMPO. */
export const FACTORY_BPM = 140
export const TEMPO_DECK_MIN = 120
export const TEMPO_DECK_MAX = 150
export const TEMPO_PRESETS = [128, 138, 140, 142, 145] as const

export const PATTERN_TITLES: Record<string, string> = {
  A01: 'Night Drive',
  A02: 'Dawn Gate',
  A03: 'Roll In',
  A04: 'Lift',
  A05: 'Peak Sun',
  A06: 'Void Break',
  A07: 'Second Sun',
  A08: 'Afterglow',
  B01: 'Kick Bed',
  B02: 'Hat Bed',
  B03: 'Gallop',
  B04: 'Walk Down',
  B05: 'Fifths',
  B06: 'Acid Run',
  B07: 'Tribal',
  B08: 'Air Cut',
}

const A1 = 33
const Bb = 34
const C2 = 36
const D2 = 38
const E2 = 40
const A2 = 45
const G1 = 31
const F1 = 29
const E1 = 28
const A3 = 57
const C4 = 60
const D4 = 62
const E4 = 64
const F4 = 65
const G4 = 67
const A4 = 69
const C5 = 72

function emptyDrumStep(): DrumStep {
  return { on: false, velocity: 0.85 }
}

function emptyMelodicStep(note: number): MelodicStep {
  return { on: false, note, velocity: 0.8, accent: false, slide: false, gate: 0.55 }
}

function sized<T>(n: number, make: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => make(i))
}

export function emptyDrumPattern(id: string, steps: 16 | 32 = 16): DrumPattern {
  const tracks = {} as Record<DrumVoiceId, DrumStep[]>
  for (const voice of DRUM_VOICES) tracks[voice] = sized(steps, emptyDrumStep)
  return { id, name: PATTERN_TITLES[id] ?? id, steps, tracks }
}

export function emptyMelodicPattern(id: string, root: number, steps: 16 | 32 = 16): MelodicPattern {
  return { id, name: PATTERN_TITLES[id] ?? id, steps, notes: sized(steps, () => emptyMelodicStep(root)) }
}

function voice(partial: Partial<DrumVoiceParams>): DrumVoiceParams {
  return {
    level: 0.8,
    pan: 0,
    pitch: 0,
    decay: 0.45,
    tone: 0.55,
    mute: false,
    solo: false,
    ...partial,
  }
}

function mix(partial: Partial<ChannelMix> = {}): ChannelMix {
  return {
    volume: 0.78,
    pan: 0,
    mute: false,
    solo: false,
    sendDelay: 0.08,
    sendReverb: 0.12,
    ...partial,
  }
}

const BASS_DEFAULT: BassParams = {
  waveform: 'sawtooth',
  cutoff: 0.3,
  resonance: 0.66,
  envMod: 0.74,
  decay: 0.26,
  accent: 0.8,
  glide: 0.1,
  tuning: 0,
  level: 0.8,
  pan: 0,
  mute: false,
  solo: false,
}

const SYNTH_DEFAULT: SynthParams = {
  oscA: { waveform: 'sawtooth', octave: 0, level: 0.62, detune: -5 },
  oscB: { waveform: 'square', octave: 0, level: 0.4, detune: 11 },
  cutoff: 0.34,
  resonance: 0.36,
  ampEnv: { attack: 0.012, decay: 0.2, sustain: 0.4, release: 0.3 },
  filterEnv: { attack: 0.01, decay: 0.16, sustain: 0.18, release: 0.24, amount: 0.5 },
  lfo: { rate: 0.14, amount: 0.24, dest: 'cutoff' },
  glide: 0.06,
  level: 0.56,
  pan: 0.06,
  mute: false,
  solo: false,
}

function drumOn(p: DrumPattern, voiceId: DrumVoiceId, steps: number[], vel = 0.9): void {
  for (const s of steps) {
    const cell = p.tracks[voiceId][s]
    if (cell) {
      cell.on = true
      cell.velocity = vel
    }
  }
}

type MelHit = {
  i: number
  note: number
  accent?: boolean
  slide?: boolean
  gate?: number
  vel?: number
}

function noteOn(p: MelodicPattern, hits: MelHit[]): void {
  for (const h of hits) {
    const step = p.notes[h.i]
    if (!step) continue
    step.on = true
    step.note = h.note
    step.accent = Boolean(h.accent)
    step.slide = Boolean(h.slide)
    step.gate = h.gate ?? 0.38
    step.velocity = h.vel ?? (h.accent ? 1 : 0.76)
  }
}

function fourOnTheFloor(p: DrumPattern, vel = 1): void {
  drumOn(p, 'kick', [0, 4, 8, 12], vel)
}

function offbeatHats(p: DrumPattern, vel = 0.7): void {
  drumOn(p, 'oh', [2, 6, 10, 14], vel)
}

function sixteenths(p: DrumPattern, even = 0.5, odd = 0.28): void {
  drumOn(p, 'ch', [0, 2, 4, 6, 8, 10, 12, 14], even)
  drumOn(p, 'ch', [1, 3, 5, 7, 9, 11, 13, 15], odd)
}

function clapTwoAndFour(p: DrumPattern, vel = 0.68): void {
  drumOn(p, 'clap', [4, 12], vel)
}

/** Rolling 16ths after each kick — the trance pump, never a root pad on the downbeat. */
function roll(root: number, a = root, b = root, c = root): MelHit[] {
  return [
    { i: 1, note: root, gate: 0.34 },
    { i: 2, note: a, gate: 0.36 },
    { i: 3, note: b, gate: 0.32 },
    { i: 5, note: root, gate: 0.34 },
    { i: 6, note: a, gate: 0.36 },
    { i: 7, note: c, gate: 0.32 },
    { i: 9, note: root, gate: 0.34 },
    { i: 10, note: a, gate: 0.36 },
    { i: 11, note: b, gate: 0.32 },
    { i: 13, note: root, gate: 0.34, accent: true },
    { i: 14, note: a, gate: 0.36 },
    { i: 15, note: c, gate: 0.4, accent: true },
  ]
}

function factoryDrums(id: string): DrumPattern {
  const p = emptyDrumPattern(id, 16)
  switch (id) {
    case 'A01':
      fourOnTheFloor(p, 1)
      sixteenths(p, 0.52, 0.3)
      offbeatHats(p, 0.74)
      clapTwoAndFour(p, 0.7)
      drumOn(p, 'perc', [7, 15], 0.42)
      break
    case 'A02':
      fourOnTheFloor(p, 0.88)
      drumOn(p, 'perc', [8], 0.28)
      break
    case 'A03':
      fourOnTheFloor(p, 0.98)
      drumOn(p, 'ch', [0, 2, 4, 6, 8, 10, 12, 14], 0.46)
      offbeatHats(p, 0.68)
      drumOn(p, 'perc', [3, 11], 0.36)
      break
    case 'A04':
      fourOnTheFloor(p, 1)
      sixteenths(p, 0.58, 0.36)
      offbeatHats(p, 0.78)
      clapTwoAndFour(p, 0.76)
      drumOn(p, 'perc', [3, 7, 11, 15], 0.5)
      break
    case 'A05':
      fourOnTheFloor(p, 1)
      sixteenths(p, 0.62, 0.4)
      offbeatHats(p, 0.82)
      clapTwoAndFour(p, 0.84)
      drumOn(p, 'snare', [4, 12], 0.38)
      drumOn(p, 'perc', [1, 3, 7, 9, 11, 15], 0.48)
      break
    case 'A06':
      drumOn(p, 'perc', [0, 4, 8, 12], 0.32)
      drumOn(p, 'oh', [6, 14], 0.4)
      drumOn(p, 'ch', [2, 10], 0.22)
      break
    case 'A07':
      fourOnTheFloor(p, 1)
      sixteenths(p, 0.6, 0.38)
      offbeatHats(p, 0.8)
      clapTwoAndFour(p, 0.72)
      drumOn(p, 'perc', [2, 3, 6, 7, 10, 11, 14, 15], 0.44)
      break
    case 'A08':
      fourOnTheFloor(p, 0.94)
      drumOn(p, 'ch', [0, 2, 4, 6, 8, 10, 12, 14], 0.4)
      offbeatHats(p, 0.7)
      drumOn(p, 'perc', [15], 0.34)
      break
    case 'B01':
      fourOnTheFloor(p, 1)
      break
    case 'B02':
      fourOnTheFloor(p, 0.96)
      sixteenths(p, 0.55, 0.32)
      offbeatHats(p, 0.72)
      break
    case 'B03':
      fourOnTheFloor(p, 1)
      offbeatHats(p, 0.76)
      clapTwoAndFour(p, 0.64)
      drumOn(p, 'perc', [3, 6, 11, 14], 0.5)
      break
    case 'B04':
      fourOnTheFloor(p, 0.98)
      sixteenths(p, 0.48, 0.26)
      offbeatHats(p, 0.66)
      break
    case 'B05':
      fourOnTheFloor(p, 1)
      sixteenths(p, 0.56, 0.34)
      offbeatHats(p, 0.78)
      clapTwoAndFour(p, 0.7)
      break
    case 'B06':
      fourOnTheFloor(p, 0.97)
      drumOn(p, 'ch', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 0.42)
      offbeatHats(p, 0.7)
      break
    case 'B07':
      fourOnTheFloor(p, 1)
      drumOn(p, 'perc', [2, 3, 6, 7, 10, 11, 13, 14, 15], 0.62)
      drumOn(p, 'oh', [2, 10], 0.55)
      clapTwoAndFour(p, 0.5)
      break
    case 'B08':
      drumOn(p, 'oh', [2, 10], 0.36)
      drumOn(p, 'perc', [8], 0.24)
      drumOn(p, 'ch', [0, 8], 0.18)
      break
    default:
      break
  }
  return p
}

function factoryBass(id: string): MelodicPattern {
  const p = emptyMelodicPattern(id, A1, 16)
  switch (id) {
    case 'A01':
      noteOn(p, roll(A1, A1, C2, G1))
      break
    case 'A02':
      noteOn(p, [
        { i: 2, note: A1, gate: 0.62 },
        { i: 6, note: A1, gate: 0.62 },
        { i: 10, note: A1, gate: 0.62 },
        { i: 14, note: A1, gate: 0.7, accent: true },
      ])
      break
    case 'A03':
      noteOn(p, roll(A1, C2, A1, E2))
      break
    case 'A04':
      noteOn(p, [
        { i: 1, note: A1, gate: 0.3 },
        { i: 2, note: A1, gate: 0.28, slide: true },
        { i: 5, note: G1, gate: 0.3 },
        { i: 6, note: A1, gate: 0.32 },
        { i: 7, note: C2, gate: 0.28, accent: true },
        { i: 9, note: A1, gate: 0.3 },
        { i: 10, note: A1, gate: 0.28 },
        { i: 13, note: G1, gate: 0.3, slide: true },
        { i: 14, note: A1, gate: 0.32 },
        { i: 15, note: E2, gate: 0.4, accent: true },
      ])
      break
    case 'A05':
      noteOn(p, [
        { i: 1, note: A1, gate: 0.32, accent: true },
        { i: 2, note: A1, gate: 0.3 },
        { i: 3, note: A2, gate: 0.26 },
        { i: 5, note: A1, gate: 0.32 },
        { i: 6, note: C2, gate: 0.3 },
        { i: 7, note: E2, gate: 0.28, accent: true },
        { i: 9, note: A1, gate: 0.32 },
        { i: 10, note: G1, gate: 0.28, slide: true },
        { i: 11, note: A1, gate: 0.3 },
        { i: 13, note: A1, gate: 0.32, accent: true },
        { i: 14, note: C2, gate: 0.3 },
        { i: 15, note: A2, gate: 0.42, accent: true },
      ])
      break
    case 'A06':
      noteOn(p, [
        { i: 2, note: A1, gate: 0.8, vel: 0.55 },
        { i: 10, note: G1, gate: 0.7, vel: 0.48 },
      ])
      break
    case 'A07':
      noteOn(p, [
        { i: 1, note: A1, gate: 0.32 },
        { i: 2, note: A1, gate: 0.3 },
        { i: 3, note: Bb, gate: 0.28 },
        { i: 5, note: C2, gate: 0.32 },
        { i: 6, note: A1, gate: 0.3 },
        { i: 7, note: G1, gate: 0.28, slide: true },
        { i: 9, note: F1, gate: 0.34, accent: true },
        { i: 10, note: F1, gate: 0.3 },
        { i: 11, note: G1, gate: 0.28 },
        { i: 13, note: A1, gate: 0.34, accent: true },
        { i: 14, note: C2, gate: 0.3 },
        { i: 15, note: E2, gate: 0.4, accent: true },
      ])
      break
    case 'A08':
      noteOn(p, roll(A1, A1, A1, C2))
      break
    case 'B01':
      noteOn(p, [
        { i: 2, note: A1, gate: 0.55 },
        { i: 6, note: A1, gate: 0.55 },
        { i: 10, note: A1, gate: 0.55 },
        { i: 14, note: A1, gate: 0.6, accent: true },
      ])
      break
    case 'B02':
      noteOn(p, roll(A1, A1, A1, A1))
      break
    case 'B03':
      noteOn(p, [
        { i: 1, note: A1, gate: 0.28 },
        { i: 2, note: A1, gate: 0.26 },
        { i: 5, note: A1, gate: 0.28 },
        { i: 6, note: A1, gate: 0.24 },
        { i: 7, note: C2, gate: 0.3, accent: true },
        { i: 9, note: A1, gate: 0.28 },
        { i: 10, note: A1, gate: 0.26 },
        { i: 13, note: A1, gate: 0.28 },
        { i: 14, note: G1, gate: 0.24, slide: true },
        { i: 15, note: A1, gate: 0.36, accent: true },
      ])
      break
    case 'B04':
      noteOn(p, [
        { i: 1, note: A1, gate: 0.32 },
        { i: 2, note: A1, gate: 0.3 },
        { i: 3, note: A1, gate: 0.28 },
        { i: 5, note: G1, gate: 0.32 },
        { i: 6, note: G1, gate: 0.3 },
        { i: 7, note: G1, gate: 0.28 },
        { i: 9, note: F1, gate: 0.32, accent: true },
        { i: 10, note: F1, gate: 0.3 },
        { i: 11, note: F1, gate: 0.28 },
        { i: 13, note: E1, gate: 0.34, accent: true },
        { i: 14, note: E1, gate: 0.3 },
        { i: 15, note: G1, gate: 0.36 },
      ])
      break
    case 'B05':
      noteOn(p, [
        { i: 1, note: A1, gate: 0.34 },
        { i: 2, note: E2, gate: 0.32 },
        { i: 3, note: A1, gate: 0.3 },
        { i: 5, note: A1, gate: 0.34 },
        { i: 6, note: E2, gate: 0.32 },
        { i: 7, note: A1, gate: 0.3 },
        { i: 9, note: A1, gate: 0.34, accent: true },
        { i: 10, note: E2, gate: 0.32 },
        { i: 11, note: A1, gate: 0.3 },
        { i: 13, note: A1, gate: 0.34, accent: true },
        { i: 14, note: E2, gate: 0.32 },
        { i: 15, note: A2, gate: 0.4, accent: true },
      ])
      break
    case 'B06':
      noteOn(p, [
        { i: 1, note: C2, gate: 0.28, slide: true },
        { i: 2, note: A1, gate: 0.3 },
        { i: 3, note: G1, gate: 0.26, slide: true },
        { i: 5, note: A1, gate: 0.3 },
        { i: 6, note: C2, gate: 0.28, slide: true },
        { i: 7, note: D2, gate: 0.32, accent: true },
        { i: 9, note: A1, gate: 0.3 },
        { i: 10, note: G1, gate: 0.26, slide: true },
        { i: 11, note: A1, gate: 0.28 },
        { i: 13, note: E2, gate: 0.3, accent: true, slide: true },
        { i: 14, note: C2, gate: 0.28 },
        { i: 15, note: A1, gate: 0.4, accent: true },
      ])
      break
    case 'B07':
      noteOn(p, [
        { i: 2, note: A1, gate: 0.5 },
        { i: 3, note: A1, gate: 0.28 },
        { i: 6, note: A1, gate: 0.5 },
        { i: 7, note: C2, gate: 0.3 },
        { i: 10, note: A1, gate: 0.5 },
        { i: 11, note: G1, gate: 0.28 },
        { i: 14, note: A1, gate: 0.55, accent: true },
      ])
      break
    case 'B08':
      noteOn(p, [{ i: 2, note: A1, gate: 0.9, vel: 0.4 }])
      break
    default:
      break
  }
  return p
}

function factorySynth(id: string): MelodicPattern {
  const p = emptyMelodicPattern(id, A3, 16)
  switch (id) {
    case 'A01':
      noteOn(p, [
        { i: 0, note: A3, gate: 0.72, accent: true },
        { i: 4, note: C4, gate: 0.55 },
        { i: 8, note: E4, gate: 0.65, accent: true },
        { i: 12, note: G4, gate: 0.5 },
        { i: 14, note: E4, gate: 0.4 },
      ])
      break
    case 'A02':
      noteOn(p, [
        { i: 0, note: A3, gate: 0.92, vel: 0.55 },
        { i: 8, note: C4, gate: 0.85, vel: 0.48 },
      ])
      break
    case 'A03':
      noteOn(p, [
        { i: 0, note: A3, gate: 0.6, accent: true },
        { i: 4, note: C4, gate: 0.5 },
        { i: 8, note: E4, gate: 0.58 },
        { i: 10, note: C4, gate: 0.4 },
        { i: 12, note: A3, gate: 0.55 },
      ])
      break
    case 'A04':
      noteOn(p, [
        { i: 0, note: A3, gate: 0.45, accent: true },
        { i: 2, note: C4, gate: 0.4 },
        { i: 4, note: E4, gate: 0.42 },
        { i: 6, note: G4, gate: 0.4 },
        { i: 8, note: A4, gate: 0.5, accent: true },
        { i: 12, note: E4, gate: 0.42 },
        { i: 14, note: C4, gate: 0.38 },
      ])
      break
    case 'A05':
      noteOn(p, [
        { i: 0, note: A4, gate: 0.38, accent: true },
        { i: 3, note: E4, gate: 0.32 },
        { i: 6, note: C5, gate: 0.3 },
        { i: 8, note: A4, gate: 0.4, accent: true },
        { i: 11, note: G4, gate: 0.32 },
        { i: 14, note: E4, gate: 0.36 },
      ])
      break
    case 'A06':
      noteOn(p, [
        { i: 0, note: A3, gate: 0.95, vel: 0.5 },
        { i: 8, note: E4, gate: 0.9, vel: 0.46 },
        { i: 12, note: G4, gate: 0.7, vel: 0.4 },
      ])
      break
    case 'A07':
      noteOn(p, [
        { i: 0, note: A3, gate: 0.42, accent: true },
        { i: 2, note: E4, gate: 0.38 },
        { i: 4, note: A4, gate: 0.4 },
        { i: 7, note: G4, gate: 0.34 },
        { i: 8, note: F4, gate: 0.45, accent: true },
        { i: 11, note: E4, gate: 0.36 },
        { i: 14, note: A4, gate: 0.4 },
      ])
      break
    case 'A08':
      noteOn(p, [
        { i: 0, note: A4, gate: 0.7, accent: true },
        { i: 4, note: E4, gate: 0.58 },
        { i: 8, note: C4, gate: 0.62 },
        { i: 12, note: A3, gate: 0.75 },
      ])
      break
    case 'B01':
      noteOn(p, [{ i: 0, note: A3, gate: 0.88, vel: 0.42 }])
      break
    case 'B02':
      noteOn(p, [
        { i: 0, note: A3, gate: 0.5 },
        { i: 4, note: C4, gate: 0.45 },
        { i: 8, note: E4, gate: 0.5 },
      ])
      break
    case 'B03':
      noteOn(p, [
        { i: 0, note: E4, gate: 0.3, accent: true },
        { i: 4, note: A3, gate: 0.28 },
        { i: 8, note: E4, gate: 0.3, accent: true },
        { i: 12, note: G4, gate: 0.28 },
      ])
      break
    case 'B04':
      noteOn(p, [
        { i: 0, note: A4, gate: 0.5, accent: true },
        { i: 4, note: G4, gate: 0.45 },
        { i: 8, note: F4, gate: 0.45 },
        { i: 12, note: E4, gate: 0.55 },
      ])
      break
    case 'B05':
      noteOn(p, [
        { i: 0, note: A3, gate: 0.55, accent: true },
        { i: 4, note: E4, gate: 0.5 },
        { i: 8, note: A4, gate: 0.55, accent: true },
        { i: 12, note: E4, gate: 0.45 },
      ])
      break
    case 'B06':
      noteOn(p, [
        { i: 0, note: A3, gate: 0.28, accent: true },
        { i: 2, note: C4, gate: 0.24 },
        { i: 4, note: D4, gate: 0.24 },
        { i: 6, note: E4, gate: 0.26 },
        { i: 8, note: G4, gate: 0.3, accent: true },
        { i: 10, note: E4, gate: 0.24 },
        { i: 12, note: C4, gate: 0.26 },
        { i: 14, note: A3, gate: 0.32 },
      ])
      break
    case 'B07':
      noteOn(p, [
        { i: 0, note: A3, gate: 0.22, accent: true },
        { i: 3, note: A3, gate: 0.18 },
        { i: 6, note: C4, gate: 0.2 },
        { i: 8, note: A3, gate: 0.22, accent: true },
        { i: 11, note: E4, gate: 0.2 },
        { i: 14, note: A3, gate: 0.24 },
      ])
      break
    case 'B08':
      noteOn(p, [
        { i: 0, note: A3, gate: 0.98, vel: 0.44 },
        { i: 8, note: E4, gate: 0.9, vel: 0.38 },
      ])
      break
    default:
      break
  }
  return p
}

export function createEmptyProject(name = 'Untitled Session'): Project {
  const now = new Date().toISOString()
  const drumsPatterns: Record<string, DrumPattern> = {}
  const bassPatterns: Record<string, MelodicPattern> = {}
  const synthPatterns: Record<string, MelodicPattern> = {}
  for (const id of PATTERN_IDS) {
    drumsPatterns[id] = emptyDrumPattern(id)
    bassPatterns[id] = emptyMelodicPattern(id, A1)
    synthPatterns[id] = emptyMelodicPattern(id, A3)
  }
  return {
    version: 1,
    meta: {
      name,
      createdAt: now,
      updatedAt: now,
      key: 'A',
      scale: 'minor',
      takes: [],
    },
    transport: { bpm: FACTORY_BPM, swing: 0, playing: false },
    drums: {
      voices: {
        kick: voice({ level: 0.97, decay: 0.46, tone: 0.44, pitch: -0.04 }),
        snare: voice({ level: 0.62, decay: 0.28, tone: 0.6, pan: 0.06 }),
        ch: voice({ level: 0.48, decay: 0.14, tone: 0.74, pan: 0.2 }),
        oh: voice({ level: 0.5, decay: 0.52, tone: 0.7, pan: -0.16 }),
        clap: voice({ level: 0.58, decay: 0.34, tone: 0.58, pan: 0.08 }),
        perc: voice({ level: 0.46, decay: 0.24, tone: 0.52, pitch: 0.1, pan: -0.14 }),
      },
      patterns: drumsPatterns,
      patternOrder: [...PATTERN_IDS],
      activePatternId: 'A01',
      pendingPatternId: null,
    },
    bass: {
      params: { ...BASS_DEFAULT },
      patterns: bassPatterns,
      patternOrder: [...PATTERN_IDS],
      activePatternId: 'A01',
      pendingPatternId: null,
    },
    synth: {
      params: structuredClone(SYNTH_DEFAULT),
      patterns: synthPatterns,
      patternOrder: [...PATTERN_IDS],
      activePatternId: 'A01',
      pendingPatternId: null,
    },
    mixer: {
      drums: mix({ volume: 0.84, sendReverb: 0.07, sendDelay: 0.03 }),
      bass: mix({ volume: 0.8, sendReverb: 0.04, sendDelay: 0.08 }),
      synth: mix({ volume: 0.6, sendReverb: 0.24, sendDelay: 0.2, pan: 0.05 }),
      master: { volume: 0.8, mute: false },
    },
    fx: {
      delay: { time: 0.32, feedback: 0.34, mix: 0.14, pingPong: true },
      reverb: { size: 0.52, damp: 0.38, mix: 0.16 },
      distortion: { drive: 0.26, mix: 0.1, target: 'bass' },
      filter: { cutoff: 0.84, resonance: 0.14, type: 'lowpass' },
      compressor: { threshold: 0.42, ratio: 0.42, attack: 0.18, release: 0.48 },
    },
    performance: {
      quantize: 'bar',
      macros: { open: 0.3, crush: 0.1, space: 0.26, drop: 0 },
      automation: [],
    },
  }
}

export function createFactoryProject(): Project {
  const project = createEmptyProject('AILEXSI Night Drive')
  for (const id of PATTERN_IDS) {
    project.drums.patterns[id] = factoryDrums(id)
    project.bass.patterns[id] = factoryBass(id)
    project.synth.patterns[id] = factorySynth(id)
  }
  return project
}

export const BASS_PARAM_DEFAULTS = BASS_DEFAULT
export const SYNTH_PARAM_DEFAULTS = SYNTH_DEFAULT
