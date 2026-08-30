import { useEffect, useRef } from 'react'
import { PATTERN_TITLES } from '../engine/defaults'
import { midiName } from '../engine/music'
import type { DrumStep, DrumVoiceId, MelodicStep } from '../engine/types'

export function DrumRow({
  voice,
  label,
  steps,
  onToggle,
  onAccent,
  playheadStep,
}: {
  voice: DrumVoiceId
  label: string
  steps: DrumStep[]
  onToggle: (step: number) => void
  onAccent: (step: number) => void
  playheadStep: number
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    for (const el of row.querySelectorAll<HTMLButtonElement>('[data-step]')) {
      el.classList.toggle('playhead', Number(el.dataset.step) === playheadStep)
    }
  }, [playheadStep])

  return (
    <div className={`grid items-center gap-2 ${label ? 'grid-cols-[56px_1fr]' : 'grid-cols-1'}`}>
      {label ? <div className="engraved text-[10px]">{label}</div> : null}
      <div ref={rowRef} className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
        {steps.map((step, i) => (
          <button
            key={`${voice}-${i}`}
            data-step={i}
            type="button"
            aria-label={`${label} step ${i + 1}`}
            className={`step h-7 ${step.on ? 'on' : ''} ${step.on && step.velocity > 0.92 ? 'accent' : ''} ${i % 4 === 0 ? 'mt-0' : ''}`}
            onClick={(e) => {
              if (e.shiftKey) onAccent(i)
              else onToggle(i)
            }}
          />
        ))}
      </div>
    </div>
  )
}

export function MelodicRow({
  steps,
  onToggle,
  onPitch,
  onAccent,
  onSlide,
  playheadStep,
  minNote,
  maxNote,
}: {
  steps: MelodicStep[]
  onToggle: (step: number) => void
  onPitch: (step: number, note: number) => void
  onAccent: (step: number) => void
  onSlide: (step: number) => void
  playheadStep: number
  minNote: number
  maxNote: number
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    for (const el of row.querySelectorAll<HTMLButtonElement>('[data-step]')) {
      el.classList.toggle('playhead', Number(el.dataset.step) === playheadStep)
    }
  }, [playheadStep])

  return (
    <div ref={rowRef} className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
      {steps.map((step, i) => (
        <button
          key={i}
          data-step={i}
          type="button"
          aria-label={`Step ${i + 1} ${midiName(step.note)}`}
          className={`step flex h-11 flex-col items-center justify-center ${step.on ? 'on' : ''} ${step.accent ? 'accent' : ''}`}
          onClick={(e) => {
            if (e.altKey) onSlide(i)
            else if (e.shiftKey) onAccent(i)
            else onToggle(i)
          }}
          onPointerDown={(e) => {
            if (!step.on) return
            const startY = e.clientY
            const startNote = step.note
            const move = (ev: PointerEvent) => {
              const dn = Math.round((startY - ev.clientY) / 8)
              onPitch(i, Math.min(maxNote, Math.max(minNote, startNote + dn)))
            }
            const up = () => {
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', up)
            }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
          }}
        >
          <span className={`font-mono text-[9px] ${step.on ? 'text-void' : 'text-mute'}`}>
            {step.on ? midiName(step.note) : '·'}
          </span>
          {step.slide && <span className="text-[8px] text-cyan">→</span>}
        </button>
      ))}
    </div>
  )
}

export function PatternBank({
  order,
  active,
  pending,
  onSelect,
}: {
  order: string[]
  active: string
  pending: string | null
  onSelect: (id: string) => void
}) {
  const bankA = order.filter((id) => id.startsWith('A')).slice(0, 8)
  const bankB = order.filter((id) => id.startsWith('B')).slice(0, 8)
  return (
    <div className="flex flex-wrap gap-1">
      {[...bankA, ...bankB].map((id) => {
        const isActive = id === active
        const isPending = id === pending
        return (
          <button
            key={id}
            type="button"
            title={PATTERN_TITLES[id] ?? id}
            onClick={() => onSelect(id)}
            className={`hw-btn min-w-10 px-1.5 py-1 font-mono text-[10px] ${isActive ? 'active' : ''} ${isPending ? 'text-cyan' : ''}`}
          >
            {id}
          </button>
        )
      })}
    </div>
  )
}
