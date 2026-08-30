import { pulseToPlayhead, stepDurationSec } from './music'
import type { Playhead } from './types'

export interface ClockConfig {
  getBpm: () => number
  getSwing: () => number
  now: () => number
  scheduleAhead?: number
  lookaheadMs?: number
  onStep: (playhead: Playhead) => void
  setTimeoutFn?: (fn: () => void, ms: number) => number
  clearTimeoutFn?: (id: number) => void
}

export class MasterClock {
  private pulse = 0
  private nextTime = 0
  private running = false
  private timer: number | null = null
  private readonly cfg: Required<Omit<ClockConfig, 'setTimeoutFn' | 'clearTimeoutFn'>> & {
    setTimeoutFn: (fn: () => void, ms: number) => number
    clearTimeoutFn: (id: number) => void
  }

  constructor(cfg: ClockConfig) {
    this.cfg = {
      scheduleAhead: 0.14,
      lookaheadMs: 20,
      setTimeoutFn: (fn, ms) => window.setTimeout(fn, ms),
      clearTimeoutFn: (id) => window.clearTimeout(id),
      ...cfg,
    }
  }

  get isRunning(): boolean {
    return this.running
  }

  get playhead(): Playhead {
    return pulseToPlayhead(this.pulse, this.nextTime)
  }

  start(fromPulse = this.pulse): void {
    this.pulse = fromPulse
    this.nextTime = this.cfg.now() + 0.04
    this.running = true
    this.tick()
  }

  stop(): void {
    this.running = false
    if (this.timer !== null) {
      this.cfg.clearTimeoutFn(this.timer)
      this.timer = null
    }
  }

  reset(): void {
    this.stop()
    this.pulse = 0
    this.nextTime = this.cfg.now()
  }

  setPulse(pulse: number): void {
    this.pulse = Math.max(0, Math.floor(pulse))
  }

  private tick = (): void => {
    if (!this.running) return
    const horizon = this.cfg.now() + this.cfg.scheduleAhead
    while (this.nextTime < horizon) {
      const playhead = pulseToPlayhead(this.pulse, this.nextTime)
      this.cfg.onStep(playhead)
      this.nextTime += stepDurationSec(this.cfg.getBpm(), this.cfg.getSwing(), this.pulse)
      this.pulse += 1
    }
    this.timer = this.cfg.setTimeoutFn(this.tick, this.cfg.lookaheadMs)
  }
}

export function planPulses(
  bpm: number,
  swing: number,
  bars: number,
  startTime = 0,
): Playhead[] {
  const total = Math.max(1, bars) * 16
  const out: Playhead[] = []
  let t = startTime
  for (let pulse = 0; pulse < total; pulse++) {
    out.push(pulseToPlayhead(pulse, t))
    t += stepDurationSec(bpm, swing, pulse)
  }
  return out
}
