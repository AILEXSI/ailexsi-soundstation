import { useEffect, useId, useRef, type PointerEvent as ReactPointerEvent } from 'react'

export function Knob({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  defaultValue,
  onChange,
  size = 54,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  defaultValue?: number
  onChange: (v: number) => void
  size?: number
}) {
  const gid = useId().replace(/:/g, '')
  const start = useRef({ y: 0, v: 0 })
  const span = max - min
  const t = span === 0 ? 0 : (value - min) / span
  const angle = -135 + t * 270

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { y: e.clientY, v: value }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const dy = start.current.y - e.clientY
    const next = start.current.v + (dy / 140) * span
    const snapped = Math.round(next / step) * step
    onChange(Math.min(max, Math.max(min, snapped)))
  }
  const onDouble = () => {
    if (defaultValue !== undefined) onChange(defaultValue)
  }

  return (
    <div className="flex w-[68px] flex-col items-center gap-1">
      <div className="font-mono text-[10px] tabular-nums text-brass">{formatVal(value)}</div>
      <div
        className="relative cursor-ns-resize touch-none select-none"
        style={{ width: size, height: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onDoubleClick={onDouble}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(3))}
      >
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <circle cx="32" cy="32" r="28" fill="#0c0e13" stroke="rgba(212,180,106,0.22)" />
          <circle cx="32" cy="32" r="22" fill={`url(#${gid})`} stroke="#2c2618" />
          <path
            d="M32 32 L32 12"
            stroke="#ffb12a"
            strokeWidth="2.4"
            strokeLinecap="round"
            transform={`rotate(${angle} 32 32)`}
          />
          <circle cx="32" cy="32" r="4" fill="#d4b46a" />
          <defs>
            <radialGradient id={gid} cx="35%" cy="30%">
              <stop offset="0%" stopColor="#3a3f4c" />
              <stop offset="70%" stopColor="#1a1d24" />
              <stop offset="100%" stopColor="#0b0d12" />
            </radialGradient>
          </defs>
        </svg>
      </div>
      <div className="engraved text-[9px]">{label}</div>
    </div>
  )
}

function formatVal(v: number): string {
  if (Math.abs(v) >= 10) return v.toFixed(0)
  if (Math.abs(v) >= 1) return v.toFixed(1)
  return v.toFixed(2)
}

export function Fader({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const span = max - min
  const t = span === 0 ? 0 : (value - min) / span

  const setFromEvent = (clientY: number) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const p = 1 - (clientY - r.top) / r.height
    onChange(min + Math.min(1, Math.max(0, p)) * span)
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={ref}
        className="fader-track relative h-24 w-6 cursor-ns-resize touch-none rounded-sm"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          setFromEvent(e.clientY)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) setFromEvent(e.clientY)
        }}
        role="slider"
        aria-label={label}
        aria-valuenow={Number(value.toFixed(3))}
      >
        <div
          className="absolute left-0.5 right-0.5 rounded-[2px] bg-brass"
          style={{ height: 8, bottom: `calc(${t * 100}% - 4px)` }}
        />
      </div>
      <div className="engraved text-[8px]">{label}</div>
    </div>
  )
}

export function Led({ on, color = 'amber' }: { on: boolean; color?: 'amber' | 'cyan' | 'red' }) {
  return <span className={`led ${color} ${on ? 'on' : ''}`} />
}

export function HwButton({
  children,
  active,
  danger,
  onClick,
  className = '',
  title,
}: {
  children: React.ReactNode
  active?: boolean
  danger?: boolean
  onClick?: () => void
  className?: string
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`hw-btn px-2.5 py-1 text-[11px] tracking-[0.14em] uppercase ${active ? 'active' : ''} ${danger ? 'danger' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

export function Meter({ value, vertical = true }: { value: number; vertical?: boolean }) {
  const segs = 12
  const lit = Math.round(Math.min(1, Math.max(0, value)) * segs)
  return (
    <div className={`flex ${vertical ? 'h-24 flex-col-reverse' : 'w-24 flex-row'} gap-[2px]`}>
      {Array.from({ length: segs }, (_, i) => (
        <div
          key={i}
          className={`meter-seg ${vertical ? 'h-1.5 w-2' : 'h-2 w-1.5'} ${i < lit ? (i > segs - 3 ? 'hot' : 'lit') : ''}`}
        />
      ))}
    </div>
  )
}

export function LiveMeter({ read }: { read: () => number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const el = ref.current
      if (el) {
        const v = Math.min(1, read())
        el.style.setProperty('--m', String(v))
        const segs = el.querySelectorAll('[data-seg]')
        const lit = Math.round(v * segs.length)
        segs.forEach((s, i) => {
          s.classList.toggle('lit', i < lit && i <= segs.length - 3)
          s.classList.toggle('hot', i < lit && i > segs.length - 3)
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [read])
  return (
    <div ref={ref} className="flex h-24 flex-col-reverse gap-[2px]">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} data-seg className="meter-seg h-1.5 w-2" />
      ))}
    </div>
  )
}
