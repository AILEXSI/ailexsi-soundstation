import { createFactoryProject } from './defaults'
import { PROJECT_VERSION } from './types'
import type { Project, TakeMeta } from './types'
import type { TakeAudio } from './recorder'

const PROJECT_KEY = 'ailexsi-soundstation.project'
const DB_NAME = 'ailexsi-soundstation'
const DB_VERSION = 1
const TAKE_STORE = 'takes'

export function serializeProject(project: Project): string {
  return JSON.stringify(project)
}

function patternHasHits(project: Project, id: string): boolean {
  const drums = project.drums.patterns[id]
  const bass = project.bass.patterns[id]
  const synth = project.synth.patterns[id]
  const drumHits = drums ? Object.values(drums.tracks).some((row) => row.some((step) => step.on)) : false
  const bassHits = bass?.notes.some((step) => step.on) ?? false
  const synthHits = synth?.notes.some((step) => step.on) ?? false
  return drumHits || bassHits || synthHits
}

/** Stock v1 factory only programmed A01. Upgrade those saves to the psytrance bank. */
export function isStockLegacyFactory(project: Project): boolean {
  if (project.meta.name !== 'AILEXSI Factory Groove') return false
  return !patternHasHits(project, 'A02') && !patternHasHits(project, 'A05')
}

export function migrateProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') return createFactoryProject()
  const p = raw as Project
  if (p.version !== PROJECT_VERSION) {
    const next = createFactoryProject()
    if (typeof p.meta?.name === 'string') next.meta.name = p.meta.name
    if (typeof p.transport?.bpm === 'number') next.transport.bpm = p.transport.bpm
    return next
  }
  if (!p.drums?.patterns || !p.bass?.patterns || !p.synth?.patterns) return createFactoryProject()
  const cloned = structuredClone(p)
  if (isStockLegacyFactory(cloned)) return createFactoryProject()
  return cloned
}

export function parseProject(json: string): Project {
  return migrateProject(JSON.parse(json) as unknown)
}

export function saveLocalProject(project: Project): void {
  localStorage.setItem(PROJECT_KEY, serializeProject(project))
}

export function loadLocalProject(): Project | null {
  const raw = localStorage.getItem(PROJECT_KEY)
  if (!raw) return null
  try {
    return parseProject(raw)
  } catch {
    return null
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(TAKE_STORE)) db.createObjectStore(TAKE_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveTakeAudio(take: TakeAudio): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TAKE_STORE, 'readwrite')
    tx.objectStore(TAKE_STORE).put(
      {
        id: take.id,
        sampleRate: take.sampleRate,
        left: take.left,
        right: take.right,
        durationSec: take.durationSec,
      },
      take.id,
    )
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadTakeAudio(id: string): Promise<TakeAudio | null> {
  const db = await openDb()
  const row = await new Promise<TakeAudio | null>((resolve, reject) => {
    const tx = db.transaction(TAKE_STORE, 'readonly')
    const req = tx.objectStore(TAKE_STORE).get(id)
    req.onsuccess = () => resolve((req.result as TakeAudio | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return row
}

export async function loadLatestTake(takes: TakeMeta[]): Promise<TakeAudio | null> {
  const last = takes[takes.length - 1]
  if (!last) return null
  return loadTakeAudio(last.id)
}

export function projectFilename(project: Project): string {
  const safe = project.meta.name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'session'
  return `${safe}.soundstation.json`
}

export function handoffPayload(project: Project) {
  return {
    format: 'ailexsi-core-handoff',
    version: 1,
    name: project.meta.name,
    tempo: project.transport.bpm,
    swing: project.transport.swing,
    key: project.meta.key,
    scale: project.meta.scale,
    patterns: {
      drums: project.drums.patterns,
      bass: project.bass.patterns,
      synth: project.synth.patterns,
    },
    selection: {
      drums: project.drums.activePatternId,
      bass: project.bass.activePatternId,
      synth: project.synth.activePatternId,
    },
    instruments: {
      drums: project.drums.voices,
      bass: project.bass.params,
      synth: project.synth.params,
    },
    mixer: project.mixer,
    effects: project.fx,
    automation: project.performance.automation,
    takes: project.meta.takes,
  }
}
