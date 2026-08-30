import { canCommitPattern, stepDurationSec } from './music'
import type { DrumVoiceId, Playhead, Project, ScheduledHit } from './types'

export interface PlannedStep {
  playhead: Playhead
  drums: Array<{ voice: DrumVoiceId; velocity: number }>
  bass: Project['bass']['patterns'][string]['notes'][number] | null
  synth: Project['synth']['patterns'][string]['notes'][number] | null
  active: {
    drums: string
    bass: string
    synth: string
  }
}

function resolveActive(project: Project, pulse: number): { drums: string; bass: string; synth: string } {
  const q = project.performance.quantize
  const commit = canCommitPattern(q, pulse)
  return {
    drums:
      commit && project.drums.pendingPatternId
        ? project.drums.pendingPatternId
        : project.drums.activePatternId,
    bass:
      commit && project.bass.pendingPatternId
        ? project.bass.pendingPatternId
        : project.bass.activePatternId,
    synth:
      commit && project.synth.pendingPatternId
        ? project.synth.pendingPatternId
        : project.synth.activePatternId,
  }
}

export function planPerformance(project: Project, bars: number, startTime = 0.05): PlannedStep[] {
  const total = Math.max(1, bars) * 16
  const out: PlannedStep[] = []
  let t = startTime
  const running = structuredClone(project)
  for (let pulse = 0; pulse < total; pulse++) {
    const active = resolveActive(running, pulse)
    running.drums.activePatternId = active.drums
    running.bass.activePatternId = active.bass
    running.synth.activePatternId = active.synth
    if (canCommitPattern(running.performance.quantize, pulse)) {
      running.drums.pendingPatternId = null
      running.bass.pendingPatternId = null
      running.synth.pendingPatternId = null
    }
    const drumPat = running.drums.patterns[active.drums]
    const bassPat = running.bass.patterns[active.bass]
    const synthPat = running.synth.patterns[active.synth]
    const dStep = drumPat ? pulse % drumPat.steps : 0
    const bStep = bassPat ? pulse % bassPat.steps : 0
    const sStep = synthPat ? pulse % synthPat.steps : 0
    const drums: PlannedStep['drums'] = []
    if (drumPat) {
      for (const [voice, row] of Object.entries(drumPat.tracks)) {
        const cell = row[dStep]
        if (cell?.on) drums.push({ voice: voice as DrumVoiceId, velocity: cell.velocity })
      }
    }
    out.push({
      playhead: { pulse, step16: pulse % 16, beat: Math.floor((pulse % 16) / 4), bar: Math.floor(pulse / 16), time: t },
      drums,
      bass: bassPat?.notes[bStep]?.on ? bassPat.notes[bStep]! : null,
      synth: synthPat?.notes[sStep]?.on ? synthPat.notes[sStep]! : null,
      active,
    })
    t += stepDurationSec(running.transport.bpm, running.transport.swing, pulse)
  }
  return out
}

export function plannedHits(steps: PlannedStep[]): ScheduledHit[] {
  const hits: ScheduledHit[] = []
  for (const step of steps) {
    for (const d of step.drums) {
      hits.push({
        time: step.playhead.time,
        pulse: step.playhead.pulse,
        instrument: 'drums',
        voice: d.voice,
        stepIndex: step.playhead.pulse,
      })
    }
    if (step.bass) {
      hits.push({
        time: step.playhead.time,
        pulse: step.playhead.pulse,
        instrument: 'bass',
        stepIndex: step.playhead.pulse,
      })
    }
    if (step.synth) {
      hits.push({
        time: step.playhead.time,
        pulse: step.playhead.pulse,
        instrument: 'synth',
        stepIndex: step.playhead.pulse,
      })
    }
  }
  return hits
}
