export function getPath(obj: unknown, path: string): unknown {
  const parts = path.split('.').filter(Boolean)
  let cur: unknown = obj
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const parts = path.split('.').filter(Boolean)
  if (parts.length === 0) return obj
  const root = structuredClone(obj) as Record<string, unknown>
  let cur: Record<string, unknown> = root
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (key === undefined) return obj
    const next = cur[key]
    if (next === null || typeof next !== 'object') {
      cur[key] = {}
    } else {
      cur[key] = Array.isArray(next) ? next.slice() : { ...(next as object) }
    }
    cur = cur[key] as Record<string, unknown>
  }
  const last = parts[parts.length - 1]
  if (last === undefined) return obj
  cur[last] = value
  return root as T
}

export function muteTarget(project: unknown, channel: string, muted: boolean): unknown {
  if (channel === 'master') return setPath(project, 'mixer.master.mute', muted)
  if (channel === 'drums' || channel === 'bass' || channel === 'synth') {
    return setPath(project, `mixer.${channel}.mute`, muted)
  }
  if (channel.startsWith('drums.')) {
    const voice = channel.slice(6)
    return setPath(project, `drums.voices.${voice}.mute`, muted)
  }
  if (channel === 'drums-inst') return setPath(project, 'drums.voices.kick.mute', muted)
  return setPath(project, `${channel}.params.mute`, muted)
}

export function soloTarget(project: unknown, channel: string, solo: boolean): unknown {
  if (channel === 'drums' || channel === 'bass' || channel === 'synth') {
    return setPath(project, `mixer.${channel}.solo`, solo)
  }
  if (channel.startsWith('drums.')) {
    const voice = channel.slice(6)
    return setPath(project, `drums.voices.${voice}.solo`, solo)
  }
  return setPath(project, `${channel}.params.solo`, solo)
}
