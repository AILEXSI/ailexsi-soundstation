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
  return { id, name: id, steps, tracks }
}

export function emptyMelodicPattern(id: string, root: number, steps: 16 | 32 = 16): MelodicPattern {
  return { id, name: id, steps, notes: sized(steps, () => emptyMelodicStep(root)) }
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
  cutoff: 0.38,
  resonance: 0.55,
  envMod: 0.62,
  decay: 0.42,
  accent: 0.7,
  glide: 0.22,
  tuning: 0,
  level: 0.72,
  pan: 0,
  mute: false,
  solo: false,
}

const SYNTH_DEFAULT: SynthParams = {
  oscA: { waveform: 'sawtooth', octave: 0, level: 0.7, detune: 0 },
  oscB: { waveform: 'triangle', octave: 0, level: 0.45, detune: 8 },
  cutoff: 0.42,
  resonance: 0.28,
  ampEnv: { attack: 0.02, decay: 0.28, sustain: 0.55, release: 0.18 },
  filterEnv: { attack: 0.01, decay: 0.22, sustain: 0.25, release: 0.2, amount: 0.55 },
  lfo: { rate: 0.28, amount: 0.18, dest: 'cutoff' },
  glide: 0.08,
  level: 0.58,
  pan: 0.08,
  mute: false,
  solo: false,
}

function factoryDrumsA01(): DrumPattern {
  const p = emptyDrumPattern('A01', 16)
  const on = (voice: DrumVoiceId, steps: number[], vel = 0.9) => {
    for (const s of steps) {
      const cell = p.tracks[voice][s]
      if (cell) {
        cell.on = true
        cell.velocity = vel
      }
    }
  }
  on('kick', [0, 4, 8, 12], 1)
  on('snare', [4, 12], 0.92)
  on('ch', [0, 2, 4, 6, 8, 10, 12, 14], 0.55)
  on('ch', [1, 3, 5, 7, 9, 11, 13, 15], 0.32)
  on('oh', [2, 10], 0.7)
  on('clap', [4, 12], 0.62)
  on('perc', [3, 7, 11, 14], 0.48)
  return p
}

function factoryBassA01(): MelodicPattern {
  const p = emptyMelodicPattern('A01', 33, 16)
  const hits: Array<[number, number, boolean, boolean, number]> = [
    [0, 33, true, false, 0.7],
    [2, 33, false, false, 0.4],
    [4, 36, false, true, 0.65],
    [6, 40, true, false, 0.55],
    [8, 33, false, false, 0.7],
    [10, 31, false, true, 0.5],
    [11, 33, false, true, 0.45],
    [12, 36, false, false, 0.6],
    [13, 38, false, true, 0.45],
    [14, 40, true, false, 0.7],
  ]
  for (const [i, note, accent, slide, gate] of hits) {
    const step = p.notes[i]
    if (!step) continue
    step.on = true
    step.note = note
    step.accent = accent
    step.slide = slide
    step.gate = gate
    step.velocity = accent ? 1 : 0.75
  }
  return p
}

function factorySynthA01(): MelodicPattern {
  const p = emptyMelodicPattern('A01', 57, 16)
  const line: Array<[number, number, number]> = [
    [0, 57, 0.8],
    [2, 60, 0.55],
    [4, 64, 0.7],
    [6, 69, 0.6],
    [8, 67, 0.75],
    [10, 64, 0.5],
    [12, 60, 0.65],
    [14, 64, 0.55],
  ]
  for (const [i, note, gate] of line) {
    const step = p.notes[i]
    if (!step) continue
    step.on = true
    step.note = note
    step.gate = gate
    step.accent = i === 0 || i === 8
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
    bassPatterns[id] = emptyMelodicPattern(id, 33)
    synthPatterns[id] = emptyMelodicPattern(id, 57)
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
    transport: { bpm: 124, swing: 0.08, playing: false },
    drums: {
      voices: {
        kick: voice({ level: 0.95, decay: 0.42, tone: 0.48, pitch: 0 }),
        snare: voice({ level: 0.78, decay: 0.32, tone: 0.62, pan: 0.04 }),
        ch: voice({ level: 0.52, decay: 0.18, tone: 0.72, pan: 0.22 }),
        oh: voice({ level: 0.48, decay: 0.58, tone: 0.68, pan: -0.18 }),
        clap: voice({ level: 0.62, decay: 0.36, tone: 0.6, pan: 0.1 }),
        perc: voice({ level: 0.5, decay: 0.28, tone: 0.55, pitch: 0.12, pan: -0.12 }),
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
      drums: mix({ volume: 0.82, sendReverb: 0.08, sendDelay: 0.04 }),
      bass: mix({ volume: 0.76, sendReverb: 0.06, sendDelay: 0.1 }),
      synth: mix({ volume: 0.64, sendReverb: 0.22, sendDelay: 0.18, pan: 0.06 }),
      master: { volume: 0.82, mute: false },
    },
    fx: {
      delay: { time: 0.38, feedback: 0.36, mix: 0.16, pingPong: true },
      reverb: { size: 0.48, damp: 0.4, mix: 0.18 },
      distortion: { drive: 0.22, mix: 0.12, target: 'drums' },
      filter: { cutoff: 0.92, resonance: 0.12, type: 'lowpass' },
      compressor: { threshold: 0.45, ratio: 0.4, attack: 0.2, release: 0.45 },
    },
    performance: {
      quantize: 'bar',
      macros: { open: 0.35, crush: 0.12, space: 0.28, drop: 0 },
      automation: [],
    },
  }
}

export function createFactoryProject(): Project {
  const project = createEmptyProject('AILEXSI Factory Groove')
  project.drums.patterns.A01 = factoryDrumsA01()
  project.bass.patterns.A01 = factoryBassA01()
  project.synth.patterns.A01 = factorySynthA01()
  return project
}

export const BASS_PARAM_DEFAULTS = BASS_DEFAULT
export const SYNTH_PARAM_DEFAULTS = SYNTH_DEFAULT
