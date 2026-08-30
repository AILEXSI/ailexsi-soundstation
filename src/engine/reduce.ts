import { createEmptyProject, createFactoryProject, emptyDrumPattern, emptyMelodicPattern } from './defaults'
import { clamp, lerp } from './music'
import { canCommitPattern } from './music'
import { muteTarget, setPath, soloTarget } from './path'
import { DRUM_VOICES, PATTERN_IDS } from './types'
import type { Command, DrumPattern, InstrumentId, MelodicPattern, Project } from './types'

function touch(project: Project): Project {
  project.meta.updatedAt = new Date().toISOString()
  return project
}

function instrumentBlock(project: Project, instrument: InstrumentId) {
  return project[instrument]
}

function ensureDrumPattern(project: Project, id: string): DrumPattern {
  const existing = project.drums.patterns[id]
  if (existing) return existing
  const created = emptyDrumPattern(id)
  project.drums.patterns[id] = created
  if (!project.drums.patternOrder.includes(id)) project.drums.patternOrder.push(id)
  return created
}

function ensureMelodicPattern(
  project: Project,
  instrument: 'bass' | 'synth',
  id: string,
): MelodicPattern {
  const existing = project[instrument].patterns[id]
  if (existing) return existing
  const created = emptyMelodicPattern(id, instrument === 'bass' ? 33 : 57)
  project[instrument].patterns[id] = created
  if (!project[instrument].patternOrder.includes(id)) project[instrument].patternOrder.push(id)
  return created
}

function resizeDrumPattern(pattern: DrumPattern, steps: 16 | 32): DrumPattern {
  const next = emptyDrumPattern(pattern.id, steps)
  next.name = pattern.name
  for (const voice of DRUM_VOICES) {
    for (let i = 0; i < steps; i++) {
      const src = pattern.tracks[voice][i] ?? pattern.tracks[voice][i % pattern.steps]
      if (src) next.tracks[voice][i] = { ...src }
    }
  }
  return next
}

function resizeMelodic(pattern: MelodicPattern, steps: 16 | 32, root: number): MelodicPattern {
  const next = emptyMelodicPattern(pattern.id, root, steps)
  next.name = pattern.name
  for (let i = 0; i < steps; i++) {
    const src = pattern.notes[i] ?? pattern.notes[i % pattern.steps]
    if (src) next.notes[i] = { ...src }
  }
  return next
}

function applyMacro(project: Project, id: keyof Project['performance']['macros'], value: number): Project {
  const v = clamp(value, 0, 1)
  project.performance.macros[id] = v
  if (id === 'open') {
    project.bass.params.cutoff = lerp(0.22, 0.86, v)
    project.synth.params.cutoff = lerp(0.24, 0.9, v)
    project.fx.filter.cutoff = lerp(0.55, 1, v)
    project.fx.reverb.mix = lerp(0.06, 0.34, v)
  } else if (id === 'crush') {
    project.fx.distortion.drive = lerp(0.05, 0.85, v)
    project.fx.distortion.mix = lerp(0.04, 0.55, v)
    project.bass.params.cutoff = lerp(0.5, 0.18, v)
    project.fx.filter.cutoff = lerp(0.95, 0.42, v)
  } else if (id === 'space') {
    project.fx.delay.mix = lerp(0.04, 0.42, v)
    project.fx.reverb.mix = lerp(0.08, 0.48, v)
    project.fx.delay.feedback = lerp(0.22, 0.58, v)
  } else if (id === 'drop') {
    project.drums.voices.ch.mute = v > 0.55
    project.drums.voices.oh.mute = v > 0.55
    project.drums.voices.perc.mute = v > 0.7
    project.synth.params.level = lerp(0.58, 0.12, v)
    project.mixer.synth.volume = lerp(0.64, 0.18, v)
  }
  return project
}

function nextUnusedId(order: string[]): string {
  for (const id of PATTERN_IDS) {
    if (!order.includes(id)) return id
  }
  let n = 1
  while (order.includes(`X${n}`)) n += 1
  return `X${n}`
}

function commitPending(project: Project, pulse: number): Project {
  const q = project.performance.quantize
  if (!canCommitPattern(q, pulse)) return project
  if (project.drums.pendingPatternId) {
    project.drums.activePatternId = project.drums.pendingPatternId
    project.drums.pendingPatternId = null
  }
  if (project.bass.pendingPatternId) {
    project.bass.activePatternId = project.bass.pendingPatternId
    project.bass.pendingPatternId = null
  }
  if (project.synth.pendingPatternId) {
    project.synth.activePatternId = project.synth.pendingPatternId
    project.synth.pendingPatternId = null
  }
  return project
}

export function reduce(input: Project, command: Command): Project {
  if (command.type === 'LOAD_PROJECT') return structuredClone(command.project)
  if (command.type === 'NEW_PROJECT') return createFactoryProject()

  const project = structuredClone(input)

  switch (command.type) {
    case 'START':
      project.transport.playing = true
      return touch(project)
    case 'STOP':
      project.transport.playing = false
      return touch(project)
    case 'RESET':
      project.transport.playing = false
      return touch(project)
    case 'SET_TEMPO':
      project.transport.bpm = clamp(Math.round(command.bpm), 40, 240)
      return touch(project)
    case 'SET_SWING':
      project.transport.swing = clamp(command.swing, 0, 1)
      return touch(project)
    case 'SET_QUANTIZE':
      project.performance.quantize = command.mode
      return touch(project)
    case 'SET_PROJECT_NAME':
      project.meta.name = command.name.slice(0, 64)
      return touch(project)
    case 'SET_PARAMETER':
      return touch(setPath(project, command.path, command.value))
    case 'SET_MIX': {
      if (command.channel === 'master') {
        if (command.param === 'volume') project.mixer.master.volume = clamp(command.value, 0, 1)
        return touch(project)
      }
      const ch = project.mixer[command.channel]
      if (command.param === 'volume' || command.param === 'sendDelay' || command.param === 'sendReverb') {
        ch[command.param] = clamp(command.value, 0, 1)
      } else if (command.param === 'pan') {
        ch.pan = clamp(command.value, -1, 1)
      }
      return touch(project)
    }
    case 'MUTE_CHANNEL':
      return touch(muteTarget(project, command.channel, true) as Project)
    case 'UNMUTE_CHANNEL':
      return touch(muteTarget(project, command.channel, false) as Project)
    case 'SOLO_CHANNEL':
      return touch(soloTarget(project, command.channel, true) as Project)
    case 'UNSOLO_CHANNEL':
      return touch(soloTarget(project, command.channel, false) as Project)
    case 'CHANGE_PATTERN': {
      const block = instrumentBlock(project, command.instrument)
      if (!block.patterns[command.patternId]) return project
      if (project.transport.playing) block.pendingPatternId = command.patternId
      else {
        block.activePatternId = command.patternId
        block.pendingPatternId = null
      }
      return touch(project)
    }
    case 'COMMIT_PENDING_PATTERNS':
      return commitPending(project, command.pulse)
    case 'SET_STEP': {
      if (command.instrument === 'drums') {
        const pattern = ensureDrumPattern(project, command.patternId)
        const row = pattern.tracks[command.voice]
        const step = row[command.step]
        if (!step) return project
        Object.assign(step, command.data)
        if (step.velocity !== undefined) step.velocity = clamp(step.velocity, 0, 1)
      } else {
        const pattern = ensureMelodicPattern(project, command.instrument, command.patternId)
        const step = pattern.notes[command.step]
        if (!step) return project
        Object.assign(step, command.data)
        if (step.note !== undefined) step.note = clamp(step.note, 12, 96)
        if (step.velocity !== undefined) step.velocity = clamp(step.velocity, 0, 1)
        if (step.gate !== undefined) step.gate = clamp(step.gate, 0.05, 1)
      }
      return touch(project)
    }
    case 'SET_NOTE': {
      const pattern = ensureMelodicPattern(project, command.instrument, command.patternId)
      const step = pattern.notes[command.step]
      if (!step) return project
      step.note = clamp(command.note, 12, 96)
      step.on = true
      return touch(project)
    }
    case 'TOGGLE_DRUM_STEP': {
      const pattern = ensureDrumPattern(project, project.drums.activePatternId)
      const step = pattern.tracks[command.voice][command.step]
      if (!step) return project
      step.on = !step.on
      if (step.on && step.velocity < 0.05) step.velocity = 0.85
      return touch(project)
    }
    case 'TOGGLE_MELODIC_STEP': {
      const pattern = ensureMelodicPattern(project, command.instrument, project[command.instrument].activePatternId)
      const step = pattern.notes[command.step]
      if (!step) return project
      step.on = !step.on
      return touch(project)
    }
    case 'CLEAR_PATTERN': {
      if (command.instrument === 'drums') {
        project.drums.patterns[command.patternId] = emptyDrumPattern(
          command.patternId,
          project.drums.patterns[command.patternId]?.steps ?? 16,
        )
      } else {
        const root = command.instrument === 'bass' ? 33 : 57
        project[command.instrument].patterns[command.patternId] = emptyMelodicPattern(
          command.patternId,
          root,
          project[command.instrument].patterns[command.patternId]?.steps ?? 16,
        )
      }
      return touch(project)
    }
    case 'DUPLICATE_PATTERN': {
      const block = instrumentBlock(project, command.instrument)
      const src = block.patterns[command.patternId]
      if (!src) return project
      const id = nextUnusedId(block.patternOrder)
      const copy = structuredClone(src) as DrumPattern | MelodicPattern
      copy.id = id
      copy.name = `${src.name}*`
      if (command.instrument === 'drums') project.drums.patterns[id] = copy as DrumPattern
      else project[command.instrument].patterns[id] = copy as MelodicPattern
      block.patternOrder.push(id)
      block.activePatternId = id
      return touch(project)
    }
    case 'CREATE_PATTERN': {
      const block = instrumentBlock(project, command.instrument)
      const id = nextUnusedId(block.patternOrder)
      if (command.instrument === 'drums') project.drums.patterns[id] = emptyDrumPattern(id)
      else {
        const root = command.instrument === 'bass' ? 33 : 57
        project[command.instrument].patterns[id] = emptyMelodicPattern(id, root)
      }
      if (command.name) {
        const p = block.patterns[id]
        if (p) p.name = command.name
      }
      block.patternOrder.push(id)
      block.activePatternId = id
      return touch(project)
    }
    case 'RENAME_PATTERN': {
      const pattern = instrumentBlock(project, command.instrument).patterns[command.patternId]
      if (pattern) pattern.name = command.name.slice(0, 16)
      return touch(project)
    }
    case 'SET_PATTERN_LENGTH': {
      if (command.instrument === 'drums') {
        const cur = project.drums.patterns[command.patternId]
        if (cur) project.drums.patterns[command.patternId] = resizeDrumPattern(cur, command.steps)
      } else {
        const cur = project[command.instrument].patterns[command.patternId]
        if (cur) {
          project[command.instrument].patterns[command.patternId] = resizeMelodic(
            cur,
            command.steps,
            command.instrument === 'bass' ? 33 : 57,
          )
        }
      }
      return touch(project)
    }
    case 'SET_MACRO':
      return touch(applyMacro(project, command.id, command.value))
    case 'ADD_TAKE':
      project.meta.takes = [...project.meta.takes, command.take].slice(-12)
      return touch(project)
    case 'RECORD_AUTOMATION':
      project.performance.automation = [...project.performance.automation, command.event].slice(-4000)
      return project
    default:
      return project
  }
}

export function createInitialProject(): Project {
  return createFactoryProject()
}

export { createEmptyProject }
