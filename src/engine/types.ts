export const PROJECT_VERSION = 1 as const

export type InstrumentId = 'drums' | 'bass' | 'synth'
export type MixChannelId = 'drums' | 'bass' | 'synth' | 'master'
export type DrumVoiceId = 'kick' | 'snare' | 'ch' | 'oh' | 'clap' | 'perc'
export type Waveform = 'sine' | 'triangle' | 'sawtooth' | 'square'
export type QuantizeMode = 'step' | 'beat' | 'bar'
export type FilterType = 'lowpass' | 'highpass' | 'bandpass'
export type LfoDest = 'cutoff' | 'pitch' | 'amp'
export type DistortionTarget = 'drums' | 'bass' | 'synth' | 'master'

export const DRUM_VOICES: readonly DrumVoiceId[] = [
  'kick',
  'snare',
  'ch',
  'oh',
  'clap',
  'perc',
]

export const PATTERN_IDS: readonly string[] = (() => {
  const ids: string[] = []
  for (const bank of ['A', 'B'] as const) {
    for (let i = 1; i <= 8; i++) ids.push(`${bank}${String(i).padStart(2, '0')}`)
  }
  return ids
})()

export interface DrumStep {
  on: boolean
  velocity: number
}

export interface MelodicStep {
  on: boolean
  note: number
  velocity: number
  accent: boolean
  slide: boolean
  gate: number
}

export interface DrumVoiceParams {
  level: number
  pan: number
  pitch: number
  decay: number
  tone: number
  mute: boolean
  solo: boolean
}

export interface BassParams {
  waveform: Waveform
  cutoff: number
  resonance: number
  envMod: number
  decay: number
  accent: number
  glide: number
  tuning: number
  level: number
  pan: number
  mute: boolean
  solo: boolean
}

export interface OscParams {
  waveform: Waveform
  octave: number
  level: number
  detune: number
}

export interface EnvParams {
  attack: number
  decay: number
  sustain: number
  release: number
}

export interface SynthParams {
  oscA: OscParams
  oscB: OscParams
  cutoff: number
  resonance: number
  ampEnv: EnvParams
  filterEnv: EnvParams & { amount: number }
  lfo: { rate: number; amount: number; dest: LfoDest }
  glide: number
  level: number
  pan: number
  mute: boolean
  solo: boolean
}

export interface PatternMeta {
  id: string
  name: string
  steps: 16 | 32
}

export interface DrumPattern extends PatternMeta {
  tracks: Record<DrumVoiceId, DrumStep[]>
}

export interface MelodicPattern extends PatternMeta {
  notes: MelodicStep[]
}

export interface ChannelMix {
  volume: number
  pan: number
  mute: boolean
  solo: boolean
  sendDelay: number
  sendReverb: number
}

export interface MixerState {
  drums: ChannelMix
  bass: ChannelMix
  synth: ChannelMix
  master: { volume: number; mute: boolean }
}

export interface FxState {
  delay: { time: number; feedback: number; mix: number; pingPong: boolean }
  reverb: { size: number; damp: number; mix: number }
  distortion: { drive: number; mix: number; target: DistortionTarget }
  filter: { cutoff: number; resonance: number; type: FilterType }
  compressor: { threshold: number; ratio: number; attack: number; release: number }
}

export interface AutomationEvent {
  beat: number
  path: string
  value: number | string | boolean
}

export interface PerformanceState {
  quantize: QuantizeMode
  macros: { open: number; crush: number; space: number; drop: number }
  automation: AutomationEvent[]
}

export interface TakeMeta {
  id: string
  createdAt: string
  durationSec: number
  bpm: number
  events: AutomationEvent[]
}

export interface Project {
  version: typeof PROJECT_VERSION
  meta: {
    name: string
    createdAt: string
    updatedAt: string
    key: string
    scale: string
    takes: TakeMeta[]
  }
  transport: {
    bpm: number
    swing: number
    playing: boolean
  }
  drums: {
    voices: Record<DrumVoiceId, DrumVoiceParams>
    patterns: Record<string, DrumPattern>
    patternOrder: string[]
    activePatternId: string
    pendingPatternId: string | null
  }
  bass: {
    params: BassParams
    patterns: Record<string, MelodicPattern>
    patternOrder: string[]
    activePatternId: string
    pendingPatternId: string | null
  }
  synth: {
    params: SynthParams
    patterns: Record<string, MelodicPattern>
    patternOrder: string[]
    activePatternId: string
    pendingPatternId: string | null
  }
  mixer: MixerState
  fx: FxState
  performance: PerformanceState
}

export type Command =
  | { type: 'START' }
  | { type: 'STOP' }
  | { type: 'RESET' }
  | { type: 'SET_TEMPO'; bpm: number }
  | { type: 'SET_SWING'; swing: number }
  | { type: 'CREATE_PATTERN'; instrument: InstrumentId; name?: string }
  | {
      type: 'SET_STEP'
      instrument: 'drums'
      patternId: string
      voice: DrumVoiceId
      step: number
      data: Partial<DrumStep>
    }
  | {
      type: 'SET_STEP'
      instrument: 'bass' | 'synth'
      patternId: string
      step: number
      data: Partial<MelodicStep>
    }
  | {
      type: 'SET_NOTE'
      instrument: 'bass' | 'synth'
      patternId: string
      step: number
      note: number
    }
  | { type: 'TOGGLE_DRUM_STEP'; voice: DrumVoiceId; step: number }
  | { type: 'TOGGLE_MELODIC_STEP'; instrument: 'bass' | 'synth'; step: number }
  | { type: 'SET_PARAMETER'; path: string; value: number | string | boolean }
  | { type: 'MUTE_CHANNEL'; channel: string }
  | { type: 'UNMUTE_CHANNEL'; channel: string }
  | { type: 'SOLO_CHANNEL'; channel: string }
  | { type: 'UNSOLO_CHANNEL'; channel: string }
  | { type: 'CHANGE_PATTERN'; instrument: InstrumentId; patternId: string }
  | { type: 'COMMIT_PENDING_PATTERNS'; pulse: number }
  | { type: 'CLEAR_PATTERN'; instrument: InstrumentId; patternId: string }
  | { type: 'DUPLICATE_PATTERN'; instrument: InstrumentId; patternId: string }
  | { type: 'RENAME_PATTERN'; instrument: InstrumentId; patternId: string; name: string }
  | { type: 'SET_PATTERN_LENGTH'; instrument: InstrumentId; patternId: string; steps: 16 | 32 }
  | { type: 'SET_QUANTIZE'; mode: QuantizeMode }
  | { type: 'SET_MACRO'; id: keyof PerformanceState['macros']; value: number }
  | { type: 'SET_MIX'; channel: MixChannelId; param: keyof ChannelMix | 'volume'; value: number }
  | { type: 'LOAD_PROJECT'; project: Project }
  | { type: 'NEW_PROJECT' }
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'ADD_TAKE'; take: TakeMeta }
  | { type: 'RECORD_AUTOMATION'; event: AutomationEvent }

export interface Playhead {
  pulse: number
  step16: number
  beat: number
  bar: number
  time: number
}

export interface ScheduledHit {
  time: number
  pulse: number
  instrument: InstrumentId
  voice?: DrumVoiceId
  stepIndex: number
}

export interface UiSnapshot {
  project: Project
  playhead: Playhead
  recording: boolean
  playingTake: boolean
  lastError: string | null
  armed: boolean
}

export interface MeterBank {
  kick: number
  snare: number
  ch: number
  oh: number
  clap: number
  perc: number
  drums: number
  bass: number
  synth: number
  masterL: number
  masterR: number
}
