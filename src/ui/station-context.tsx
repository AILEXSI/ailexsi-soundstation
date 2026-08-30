import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createStation, type SoundStation } from '../engine'
import type { Playhead, Project } from '../engine/types'

const StationContext = createContext<SoundStation | null>(null)

export function StationProvider({ children }: { children: ReactNode }) {
  const ref = useRef<SoundStation | null>(null)
  if (!ref.current) ref.current = createStation()
  return <StationContext.Provider value={ref.current}>{children}</StationContext.Provider>
}

export function useStation(): SoundStation {
  const s = useContext(StationContext)
  if (!s) throw new Error('StationProvider missing')
  return s
}

export function useProject<T>(selector: (project: Project) => T): T {
  const station = useStation()
  const sel = useRef(selector)
  sel.current = selector
  const [value, setValue] = useState(() => selector(station.project))
  useEffect(() => {
    return station.subscribe((project) => {
      const next = sel.current(project)
      setValue((prev) => (Object.is(prev, next) ? prev : next))
    })
  }, [station])
  return value
}

export function usePlayhead(): Playhead {
  const station = useStation()
  const [ph, setPh] = useState(station.playhead)
  useEffect(() => station.onClock(setPh), [station])
  return ph
}

export function useFlag(read: (s: SoundStation) => boolean): boolean {
  const station = useStation()
  const [v, setV] = useState(() => read(station))
  useEffect(() => {
    return station.subscribe(() => setV(read(station)))
  }, [station, read])
  return v
}
