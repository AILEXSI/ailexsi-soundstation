import { describe, expect, it } from 'vitest'
import { canCommitPattern, midiName, mtof, stepDurationSec, tapTempoBpm } from './music'
import { parseProject, serializeProject, handoffPayload } from './persist'
import { createEmptyProject, createFactoryProject } from './defaults'
import { reduce } from './reduce'
import { decodeWav, encodeWav, hasAudibleSignal, peakOf } from './wav'
import { renderDrumVoice } from './drums'
import { planPerformance, plannedHits } from './scheduler'
import { setPath, getPath } from './path'

describe('clock math', () => {
  it('keeps 16ths at 120 BPM at 125ms', () => {
    expect(stepDurationSec(120, 0, 0)).toBeCloseTo(0.125, 6)
    expect(stepDurationSec(120, 0, 1)).toBeCloseTo(0.125, 6)
  })

  it('swings odd steps later', () => {
    const even = stepDurationSec(120, 0.4, 0)
    const odd = stepDurationSec(120, 0.4, 1)
    expect(odd).toBeGreaterThan(even)
    expect(even + odd).toBeCloseTo(0.25, 5)
  })

  it('quantizes pattern changes', () => {
    expect(canCommitPattern('step', 7)).toBe(true)
    expect(canCommitPattern('beat', 4)).toBe(true)
    expect(canCommitPattern('beat', 5)).toBe(false)
    expect(canCommitPattern('bar', 0)).toBe(true)
    expect(canCommitPattern('bar', 8)).toBe(false)
  })

  it('computes tap tempo', () => {
    expect(tapTempoBpm([0, 500, 1000])).toBe(120)
    expect(tapTempoBpm([0])).toBeNull()
  })
})

describe('music', () => {
  it('names notes and converts midi', () => {
    expect(midiName(69)).toBe('A4')
    expect(mtof(69)).toBeCloseTo(440, 5)
  })
})

describe('project + commands', () => {
  it('creates a factory groove with tempo, patterns, mixer and fx', () => {
    const p = createFactoryProject()
    expect(p.transport.bpm).toBe(124)
    expect(p.drums.patterns.A01?.tracks.kick[0]?.on).toBe(true)
    expect(p.bass.patterns.A01?.notes[0]?.on).toBe(true)
    expect(p.synth.patterns.A01?.notes[0]?.on).toBe(true)
    expect(p.mixer.drums.volume).toBeGreaterThan(0)
    expect(p.fx.delay.mix).toBeGreaterThan(0)
  })

  it('starts, stops, sets tempo and switches patterns', () => {
    let p = createEmptyProject()
    p = reduce(p, { type: 'SET_TEMPO', bpm: 130 })
    expect(p.transport.bpm).toBe(130)
    p = reduce(p, { type: 'START' })
    expect(p.transport.playing).toBe(true)
    p = reduce(p, { type: 'CHANGE_PATTERN', instrument: 'drums', patternId: 'A02' })
    expect(p.drums.pendingPatternId).toBe('A02')
    p = reduce(p, { type: 'COMMIT_PENDING_PATTERNS', pulse: 0 })
    expect(p.drums.activePatternId).toBe('A02')
    p = reduce(p, { type: 'STOP' })
    expect(p.transport.playing).toBe(false)
  })

  it('toggles drum and bass steps and notes', () => {
    let p = createEmptyProject()
    p = reduce(p, { type: 'TOGGLE_DRUM_STEP', voice: 'kick', step: 1 })
    expect(p.drums.patterns.A01?.tracks.kick[1]?.on).toBe(true)
    p = reduce(p, { type: 'SET_NOTE', instrument: 'bass', patternId: 'A01', step: 3, note: 40 })
    expect(p.bass.patterns.A01?.notes[3]?.note).toBe(40)
    expect(p.bass.patterns.A01?.notes[3]?.on).toBe(true)
    p = reduce(p, { type: 'TOGGLE_MELODIC_STEP', instrument: 'synth', step: 5 })
    expect(p.synth.patterns.A01?.notes[5]?.on).toBe(true)
  })

  it('mutes, solos, and mixes without losing other state', () => {
    let p = createFactoryProject()
    p = reduce(p, { type: 'MUTE_CHANNEL', channel: 'drums' })
    expect(p.mixer.drums.mute).toBe(true)
    p = reduce(p, { type: 'UNMUTE_CHANNEL', channel: 'drums' })
    expect(p.mixer.drums.mute).toBe(false)
    p = reduce(p, { type: 'SOLO_CHANNEL', channel: 'bass' })
    expect(p.mixer.bass.solo).toBe(true)
    p = reduce(p, { type: 'SET_MIX', channel: 'synth', param: 'volume', value: 0.33 })
    expect(p.mixer.synth.volume).toBeCloseTo(0.33)
    p = reduce(p, { type: 'SET_PARAMETER', path: 'bass.params.cutoff', value: 0.2 })
    expect(p.bass.params.cutoff).toBe(0.2)
  })

  it('duplicates, clears, and resizes patterns', () => {
    let p = createFactoryProject()
    p = reduce(p, { type: 'DUPLICATE_PATTERN', instrument: 'drums', patternId: 'A01' })
    expect(p.drums.activePatternId).not.toBe('A01')
    const id = p.drums.activePatternId
    expect(p.drums.patterns[id]?.tracks.kick[0]?.on).toBe(true)
    p = reduce(p, { type: 'CLEAR_PATTERN', instrument: 'drums', patternId: id })
    expect(p.drums.patterns[id]?.tracks.kick[0]?.on).toBe(false)
    p = reduce(p, { type: 'SET_PATTERN_LENGTH', instrument: 'bass', patternId: 'A01', steps: 32 })
    expect(p.bass.patterns.A01?.steps).toBe(32)
    expect(p.bass.patterns.A01?.notes).toHaveLength(32)
  })

  it('persists and reopens the same musical state', () => {
    const original = createFactoryProject()
    original.transport.bpm = 118
    original.bass.params.cutoff = 0.17
    const json = serializeProject(original)
    const loaded = parseProject(json)
    expect(loaded.transport.bpm).toBe(118)
    expect(loaded.bass.params.cutoff).toBe(0.17)
    expect(loaded.drums.patterns.A01?.tracks.snare[4]?.on).toBe(true)
    expect(handoffPayload(loaded).tempo).toBe(118)
  })

  it('path get/set is used by SET_PARAMETER', () => {
    const p = setPath(createEmptyProject(), 'fx.delay.mix', 0.44)
    expect(getPath(p, 'fx.delay.mix')).toBe(0.44)
  })
})

describe('sequencer planning', () => {
  it('schedules factory hits on the expected pulses', () => {
    const plan = planPerformance(createFactoryProject(), 1)
    expect(plan).toHaveLength(16)
    expect(plan[0]?.drums.some((d) => d.voice === 'kick')).toBe(true)
    expect(plan[4]?.drums.some((d) => d.voice === 'snare')).toBe(true)
    expect(plan[0]?.bass?.on).toBe(true)
    expect(plan[0]?.synth?.on).toBe(true)
    expect(plannedHits(plan).length).toBeGreaterThan(10)
  })

  it('applies pending pattern on the next bar when quantized', () => {
    let p = createFactoryProject()
    p.performance.quantize = 'bar'
    p.transport.playing = true
    p = reduce(p, { type: 'CHANGE_PATTERN', instrument: 'drums', patternId: 'A03' })
    p = reduce(p, { type: 'CLEAR_PATTERN', instrument: 'drums', patternId: 'A03' })
    const plan = planPerformance(p, 2)
    expect(plan[0]?.active.drums).toBe('A03')
    expect(plan[16]?.active.drums).toBe('A03')
  })
})

describe('drum engine', () => {
  it('renders audible kick and snare buffers', () => {
    const kick = renderDrumVoice('kick', 44100, {
      level: 0.9,
      pan: 0,
      pitch: 0,
      decay: 0.5,
      tone: 0.5,
      mute: false,
      solo: false,
      velocity: 1,
    })
    const snare = renderDrumVoice('snare', 44100, {
      level: 0.9,
      pan: 0,
      pitch: 0,
      decay: 0.4,
      tone: 0.6,
      mute: false,
      solo: false,
      velocity: 1,
    })
    expect(peakOf(kick)).toBeGreaterThan(0.2)
    expect(peakOf(snare)).toBeGreaterThan(0.1)
    expect(hasAudibleSignal([kick])).toBe(true)
  })
})

describe('wav export codec', () => {
  it('roundtrips PCM through WAV', () => {
    const l = new Float32Array(64).map((_, i) => Math.sin(i / 4) * 0.5)
    const r = new Float32Array(64).map((_, i) => Math.cos(i / 5) * 0.5)
    const buf = encodeWav([l, r], 44100)
    const decoded = decodeWav(buf)
    expect(decoded.sampleRate).toBe(44100)
    expect(decoded.channels).toHaveLength(2)
    expect(decoded.channels[0]?.[8]).toBeCloseTo(l[8] ?? 0, 2)
  })
})
