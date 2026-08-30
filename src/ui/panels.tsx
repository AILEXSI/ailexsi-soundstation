import { useMemo, useState } from 'react'
import {
  PATTERN_TITLES,
  TEMPO_DECK_MAX,
  TEMPO_DECK_MIN,
  TEMPO_PRESETS,
} from '../engine/defaults'
import { DRUM_VOICES, PATTERN_IDS } from '../engine/types'
import type { DrumVoiceId, Waveform } from '../engine/types'
import { clamp } from '../engine/music'
import { Fader, HwButton, Knob, Led, LiveMeter } from './controls'
import { usePlayhead, useProject, useStation } from './station-context'
import { DrumRow, MelodicRow, PatternBank } from './steps'

const DRUM_LABELS: Record<DrumVoiceId, string> = {
  kick: 'KICK',
  snare: 'SNAR',
  ch: 'CHH',
  oh: 'OHH',
  clap: 'CLAP',
  perc: 'PERC',
}

const WAVES: Waveform[] = ['sawtooth', 'square', 'triangle', 'sine']

export function TransportBar() {
  const station = useStation()
  const playing = useProject((p) => p.transport.playing)
  const recording = useProject(() => station.recording)
  const ph = usePlayhead()

  return (
    <section className="panel flex flex-wrap items-center gap-3 rounded-md px-3 py-2">
      <div className="flex items-center gap-2">
        <HwButton active={playing} onClick={() => station.dispatch({ type: playing ? 'STOP' : 'START' })}>
          {playing ? 'Stop' : 'Play'}
        </HwButton>
        <HwButton onClick={() => station.dispatch({ type: 'RESET' })}>Reset</HwButton>
        <HwButton danger active={recording} className={recording ? 'rec' : ''} onClick={() => void station.recordToggle()}>
          Rec
        </HwButton>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((b) => (
            <Led key={b} on={playing && ph.beat === b} color={b === 0 ? 'amber' : 'cyan'} />
          ))}
        </div>
        <div className="font-mono text-xs text-mist">
          BAR {ph.bar + 1}.{ph.beat + 1}
          <span className="text-mute"> · </span>
          STEP {String(ph.step16 + 1).padStart(2, '0')}
        </div>
        {recording && <span className="font-mono text-[10px] tracking-widest text-rec">REC</span>}
      </div>
    </section>
  )
}

export function TempoDeck() {
  const station = useStation()
  const bpm = useProject((p) => p.transport.bpm)
  const swing = useProject((p) => p.transport.swing)
  const sliderValue = clamp(bpm, TEMPO_DECK_MIN, TEMPO_DECK_MAX)
  const setBpm = (next: number) => station.dispatch({ type: 'SET_TEMPO', bpm: Math.round(next) })

  return (
    <section className="panel rounded-md px-3 py-3" data-testid="tempo-deck">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="engraved text-[10px]">Master tempo</div>
          <div className="font-display text-lg tracking-[0.22em] text-brass">SPEED</div>
        </div>
        <p className="font-mono text-[10px] tracking-[0.16em] text-mute">
          120–150 deck · 1 BPM · clock follows SET_TEMPO
        </p>
      </header>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-[140px]">
          <div className="font-display text-6xl leading-none text-amber tabular-nums md:text-7xl">{bpm}</div>
          <div className="engraved mt-1 text-[11px]">BPM</div>
        </div>
        <div className="min-w-0 flex-1">
          <label className="block">
            <span className="sr-only">Tempo slider</span>
            <input
              type="range"
              className="tempo-slider"
              min={TEMPO_DECK_MIN}
              max={TEMPO_DECK_MAX}
              step={1}
              value={sliderValue}
              aria-label="Tempo"
              aria-valuemin={TEMPO_DECK_MIN}
              aria-valuemax={TEMPO_DECK_MAX}
              aria-valuenow={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
            />
          </label>
          <div className="mt-1 flex justify-between font-mono text-[9px] tracking-[0.14em] text-mute">
            <span>120</span>
            <span className="text-brass">138</span>
            <span className="text-amber">140</span>
            <span className="text-brass">142</span>
            <span>150</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <HwButton className="min-w-12 px-3 py-2" onClick={() => setBpm(bpm - 1)}>
              −1
            </HwButton>
            <input
              type="number"
              className="hw-input w-[4.5rem] px-2 py-1 text-center font-mono text-sm tabular-nums"
              min={40}
              max={240}
              step={1}
              value={bpm}
              aria-label="BPM value"
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) setBpm(n)
              }}
            />
            <HwButton className="min-w-12 px-3 py-2" onClick={() => setBpm(bpm + 1)}>
              +1
            </HwButton>
            {TEMPO_PRESETS.map((preset) => (
              <HwButton key={preset} active={bpm === preset} onClick={() => setBpm(preset)}>
                {preset}
              </HwButton>
            ))}
            <HwButton onClick={() => station.tapTempo()}>Tap</HwButton>
          </div>
        </div>
        <Knob
          label="Swing"
          value={swing}
          defaultValue={0}
          onChange={(v) => station.dispatch({ type: 'SET_SWING', swing: v })}
        />
      </div>
      <SceneBank />
    </section>
  )
}

function SceneBank() {
  const station = useStation()
  const drums = useProject((p) => p.drums.activePatternId)
  const bass = useProject((p) => p.bass.activePatternId)
  const synth = useProject((p) => p.synth.activePatternId)
  const pending = useProject((p) => p.drums.pendingPatternId)
  const bankA = PATTERN_IDS.filter((id) => id.startsWith('A'))
  const bankB = PATTERN_IDS.filter((id) => id.startsWith('B'))

  return (
    <div className="mt-4 border-t border-brass/10 pt-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="engraved text-[10px]">Scene · drums + bass + synth</div>
        <div className="font-mono text-[10px] tracking-[0.16em] text-mist">
          {PATTERN_TITLES[drums] ?? drums}
          {drums === bass && drums === synth ? '' : ' · split'}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {[bankA, bankB].map((bank) => (
          <div key={bank[0]} className="flex flex-wrap gap-1">
            {bank.map((id) => {
              const allOn = drums === id && bass === id && synth === id
              const queued = pending === id
              return (
                <button
                  key={id}
                  type="button"
                  title={PATTERN_TITLES[id]}
                  onClick={() => station.dispatch({ type: 'CHANGE_SCENE', patternId: id })}
                  className={`hw-btn min-w-16 px-2 py-1 text-left font-mono text-[10px] ${allOn ? 'active' : ''} ${queued ? 'text-cyan' : ''}`}
                >
                  <span className="text-brass">{id}</span>
                  <span className="ml-1 tracking-normal text-mist/80 normal-case">
                    {PATTERN_TITLES[id] ?? id}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export function PerformanceStrip() {
  const station = useStation()
  const q = useProject((p) => p.performance.quantize)
  const macros = useProject((p) => p.performance.macros)
  const mixer = useProject((p) => p.mixer)
  const cutoff = useProject((p) => p.fx.filter.cutoff)
  const res = useProject((p) => p.fx.filter.resonance)
  const delay = useProject((p) => p.fx.delay.mix)
  const reverb = useProject((p) => p.fx.reverb.mix)
  const drive = useProject((p) => p.fx.distortion.mix)

  return (
    <section className="panel flex flex-wrap items-end gap-4 rounded-md px-3 py-3">
      <div>
        <div className="engraved mb-2 text-[10px]">Performance</div>
        <div className="flex flex-wrap gap-1">
          {(['step', 'beat', 'bar'] as const).map((mode) => (
            <HwButton key={mode} active={q === mode} onClick={() => station.dispatch({ type: 'SET_QUANTIZE', mode })}>
              {mode}
            </HwButton>
          ))}
        </div>
      </div>
      <div className="flex gap-1">
        {(['drums', 'bass', 'synth'] as const).map((ch) => (
          <HwButton
            key={ch}
            active={mixer[ch].mute}
            onClick={() => station.dispatch({ type: mixer[ch].mute ? 'UNMUTE_CHANNEL' : 'MUTE_CHANNEL', channel: ch })}
          >
            Mute {ch}
          </HwButton>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Knob label="Open" value={macros.open} onChange={(v) => station.dispatch({ type: 'SET_MACRO', id: 'open', value: v })} />
        <Knob label="Crush" value={macros.crush} onChange={(v) => station.dispatch({ type: 'SET_MACRO', id: 'crush', value: v })} />
        <Knob label="Space" value={macros.space} onChange={(v) => station.dispatch({ type: 'SET_MACRO', id: 'space', value: v })} />
        <Knob label="Drop" value={macros.drop} onChange={(v) => station.dispatch({ type: 'SET_MACRO', id: 'drop', value: v })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Knob label="Sweep" value={cutoff} defaultValue={0.92} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.filter.cutoff', value: v })} />
        <Knob label="Res" value={res} defaultValue={0.12} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.filter.resonance', value: v })} />
        <Knob label="Delay" value={delay} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.delay.mix', value: v })} />
        <Knob label="Hall" value={reverb} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.reverb.mix', value: v })} />
        <Knob label="Drive" value={drive} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.distortion.mix', value: v })} />
      </div>
    </section>
  )
}

export function DrumMachine() {
  const station = useStation()
  const drums = useProject((p) => p.drums)
  const ph = usePlayhead()
  const pattern = drums.patterns[drums.activePatternId]
  const stepCount = pattern?.steps ?? 16
  const playStep = ph.pulse % stepCount

  return (
    <section className="panel min-w-0 rounded-md p-3">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-display text-lg tracking-[0.28em] text-brass">DRUMS</div>
          <div className="engraved text-[10px]">{pattern?.name ?? 'Six-voice analog engine'}</div>
        </div>
        <PatternBank
          order={drums.patternOrder}
          active={drums.activePatternId}
          pending={drums.pendingPatternId}
          onSelect={(id) => station.dispatch({ type: 'CHANGE_PATTERN', instrument: 'drums', patternId: id })}
        />
      </header>
      <div className="mb-3 flex flex-wrap gap-2">
        <HwButton onClick={() => station.dispatch({ type: 'DUPLICATE_PATTERN', instrument: 'drums', patternId: drums.activePatternId })}>
          Dup
        </HwButton>
        <HwButton onClick={() => station.dispatch({ type: 'CLEAR_PATTERN', instrument: 'drums', patternId: drums.activePatternId })}>
          Clear
        </HwButton>
        <HwButton
          active={stepCount === 32}
          onClick={() =>
            station.dispatch({
              type: 'SET_PATTERN_LENGTH',
              instrument: 'drums',
              patternId: drums.activePatternId,
              steps: stepCount === 16 ? 32 : 16,
            })
          }
        >
          {stepCount}
        </HwButton>
      </div>
      <div className="space-y-1.5">
        {DRUM_VOICES.map((voice) => (
          <div key={voice} className="flex items-center gap-2">
            <HwButton
              className="min-w-12"
              onClick={() => void station.arm().then(() => station.triggerPreviewDrum(voice))}
            >
              {DRUM_LABELS[voice]}
            </HwButton>
            <div className="min-w-0 flex-1 space-y-1">
              {pattern && (
                <DrumRow
                  voice={voice}
                  label=""
                  steps={pattern.tracks[voice].slice(0, 16)}
                  playheadStep={playStep < 16 ? playStep : -1}
                  onToggle={(step) => station.dispatch({ type: 'TOGGLE_DRUM_STEP', voice, step })}
                  onAccent={(step) => {
                    const cell = pattern.tracks[voice][step]
                    if (!cell) return
                    station.dispatch({
                      type: 'SET_STEP',
                      instrument: 'drums',
                      patternId: drums.activePatternId,
                      voice,
                      step,
                      data: { on: true, velocity: cell.velocity > 0.92 ? 0.7 : 1 },
                    })
                  }}
                />
              )}
              {pattern && pattern.steps === 32 && (
                <DrumRow
                  voice={voice}
                  label=""
                  steps={pattern.tracks[voice].slice(16, 32)}
                  playheadStep={playStep >= 16 ? playStep % 16 : -1}
                  onToggle={(step) => station.dispatch({ type: 'TOGGLE_DRUM_STEP', voice, step: step + 16 })}
                  onAccent={(step) => {
                    const cell = pattern.tracks[voice][step + 16]
                    if (!cell) return
                    station.dispatch({
                      type: 'SET_STEP',
                      instrument: 'drums',
                      patternId: drums.activePatternId,
                      voice,
                      step: step + 16,
                      data: { on: true, velocity: cell.velocity > 0.92 ? 0.7 : 1 },
                    })
                  }}
                />
              )}
            </div>
            <HwButton
              active={drums.voices[voice].mute}
              onClick={() =>
                station.dispatch({
                  type: drums.voices[voice].mute ? 'UNMUTE_CHANNEL' : 'MUTE_CHANNEL',
                  channel: `drums.${voice}`,
                })
              }
            >
              M
            </HwButton>
            <HwButton
              active={drums.voices[voice].solo}
              onClick={() =>
                station.dispatch({
                  type: drums.voices[voice].solo ? 'UNSOLO_CHANNEL' : 'SOLO_CHANNEL',
                  channel: `drums.${voice}`,
                })
              }
            >
              S
            </HwButton>
          </div>
        ))}
      </div>
      <DrumVoiceKnobs />
    </section>
  )
}

function DrumVoiceKnobs() {
  const station = useStation()
  const [voice, setVoice] = useState<DrumVoiceId>('kick')
  const voices = useProject((p) => p.drums.voices)
  const params = voices[voice] ?? voices.kick
  const path = (key: string) => `drums.voices.${voice}.${key}`
  return (
    <div className="mt-3 border-t border-brass/10 pt-3">
      <div className="mb-2 flex flex-wrap gap-1">
        {DRUM_VOICES.map((id) => (
          <HwButton key={id} active={voice === id} onClick={() => setVoice(id)}>
            {DRUM_LABELS[id]}
          </HwButton>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Knob label="Level" value={params.level} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: path('level'), value: v })} />
        <Knob label="Pan" value={params.pan} min={-1} max={1} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: path('pan'), value: v })} />
        <Knob label="Pitch" value={params.pitch} min={-1} max={1} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: path('pitch'), value: v })} />
        <Knob label="Decay" value={params.decay} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: path('decay'), value: v })} />
        <Knob label="Tone" value={params.tone} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: path('tone'), value: v })} />
      </div>
    </div>
  )
}

export function BassPanel() {
  const station = useStation()
  const bass = useProject((p) => p.bass)
  const ph = usePlayhead()
  const pattern = bass.patterns[bass.activePatternId]
  const playStep = pattern ? ph.pulse % pattern.steps : 0
  const p = bass.params

  return (
    <section className="panel min-w-0 rounded-md p-3">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-display text-lg tracking-[0.28em] text-brass">BASS</div>
          <div className="engraved text-[10px]">{pattern?.name ?? 'Monophonic analog line'}</div>
        </div>
        <PatternBank
          order={bass.patternOrder}
          active={bass.activePatternId}
          pending={bass.pendingPatternId}
          onSelect={(id) => station.dispatch({ type: 'CHANGE_PATTERN', instrument: 'bass', patternId: id })}
        />
      </header>
      <div className="mb-3 flex flex-wrap gap-2">
        {WAVES.map((w) => (
          <HwButton key={w} active={p.waveform === w} onClick={() => station.dispatch({ type: 'SET_PARAMETER', path: 'bass.params.waveform', value: w })}>
            {w.slice(0, 3)}
          </HwButton>
        ))}
        <HwButton onClick={() => station.dispatch({ type: 'CLEAR_PATTERN', instrument: 'bass', patternId: bass.activePatternId })}>Clear</HwButton>
        <HwButton onClick={() => station.dispatch({ type: 'DUPLICATE_PATTERN', instrument: 'bass', patternId: bass.activePatternId })}>Dup</HwButton>
        <HwButton
          active={(pattern?.steps ?? 16) === 32}
          onClick={() =>
            station.dispatch({
              type: 'SET_PATTERN_LENGTH',
              instrument: 'bass',
              patternId: bass.activePatternId,
              steps: (pattern?.steps ?? 16) === 16 ? 32 : 16,
            })
          }
        >
          {pattern?.steps ?? 16}
        </HwButton>
        <HwButton
          active={p.mute}
          onClick={() => station.dispatch({ type: p.mute ? 'UNMUTE_CHANNEL' : 'MUTE_CHANNEL', channel: 'bass' })}
        >
          Mute
        </HwButton>
      </div>
      {pattern && (
        <div className="space-y-1">
          <MelodicRow
            steps={pattern.notes.slice(0, 16)}
            playheadStep={playStep < 16 ? playStep : -1}
            minNote={24}
            maxNote={48}
            onToggle={(step) => station.dispatch({ type: 'TOGGLE_MELODIC_STEP', instrument: 'bass', step })}
            onPitch={(step, note) =>
              station.dispatch({ type: 'SET_NOTE', instrument: 'bass', patternId: bass.activePatternId, step, note })
            }
            onAccent={(step) => {
              const cell = pattern.notes[step]
              if (!cell) return
              station.dispatch({
                type: 'SET_STEP',
                instrument: 'bass',
                patternId: bass.activePatternId,
                step,
                data: { accent: !cell.accent, on: true },
              })
            }}
            onSlide={(step) => {
              const cell = pattern.notes[step]
              if (!cell) return
              station.dispatch({
                type: 'SET_STEP',
                instrument: 'bass',
                patternId: bass.activePatternId,
                step,
                data: { slide: !cell.slide, on: true },
              })
            }}
          />
          {pattern.steps === 32 && (
            <MelodicRow
              steps={pattern.notes.slice(16, 32)}
              playheadStep={playStep >= 16 ? playStep % 16 : -1}
              minNote={24}
              maxNote={48}
              onToggle={(step) => station.dispatch({ type: 'TOGGLE_MELODIC_STEP', instrument: 'bass', step: step + 16 })}
              onPitch={(step, note) =>
                station.dispatch({ type: 'SET_NOTE', instrument: 'bass', patternId: bass.activePatternId, step: step + 16, note })
              }
              onAccent={(step) => {
                const cell = pattern.notes[step + 16]
                if (!cell) return
                station.dispatch({
                  type: 'SET_STEP',
                  instrument: 'bass',
                  patternId: bass.activePatternId,
                  step: step + 16,
                  data: { accent: !cell.accent, on: true },
                })
              }}
              onSlide={(step) => {
                const cell = pattern.notes[step + 16]
                if (!cell) return
                station.dispatch({
                  type: 'SET_STEP',
                  instrument: 'bass',
                  patternId: bass.activePatternId,
                  step: step + 16,
                  data: { slide: !cell.slide, on: true },
                })
              }}
            />
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Knob label="Cut" value={p.cutoff} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'bass.params.cutoff', value: v })} />
        <Knob label="Res" value={p.resonance} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'bass.params.resonance', value: v })} />
        <Knob label="Env" value={p.envMod} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'bass.params.envMod', value: v })} />
        <Knob label="Dec" value={p.decay} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'bass.params.decay', value: v })} />
        <Knob label="Acc" value={p.accent} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'bass.params.accent', value: v })} />
        <Knob label="Glide" value={p.glide} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'bass.params.glide', value: v })} />
        <Knob label="Tune" value={p.tuning} min={-12} max={12} step={1} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'bass.params.tuning', value: v })} />
        <Knob label="Level" value={p.level} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'bass.params.level', value: v })} />
      </div>
    </section>
  )
}

export function SynthPanel() {
  const station = useStation()
  const synth = useProject((p) => p.synth)
  const ph = usePlayhead()
  const pattern = synth.patterns[synth.activePatternId]
  const playStep = pattern ? ph.pulse % pattern.steps : 0
  const p = synth.params

  return (
    <section className="panel min-w-0 rounded-md p-3">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-display text-lg tracking-[0.28em] text-brass">SYNTH</div>
          <div className="engraved text-[10px]">{pattern?.name ?? 'Dual oscillator · filter · LFO'}</div>
        </div>
        <PatternBank
          order={synth.patternOrder}
          active={synth.activePatternId}
          pending={synth.pendingPatternId}
          onSelect={(id) => station.dispatch({ type: 'CHANGE_PATTERN', instrument: 'synth', patternId: id })}
        />
      </header>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="engraved text-[9px]">Osc A</span>
        {WAVES.map((w) => (
          <HwButton key={w} active={p.oscA.waveform === w} onClick={() => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.oscA.waveform', value: w })}>
            {w.slice(0, 3)}
          </HwButton>
        ))}
        <span className="engraved ml-2 text-[9px]">Osc B</span>
        {WAVES.map((w) => (
          <HwButton key={`b-${w}`} active={p.oscB.waveform === w} onClick={() => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.oscB.waveform', value: w })}>
            {w.slice(0, 3)}
          </HwButton>
        ))}
        <HwButton onClick={() => station.dispatch({ type: 'CLEAR_PATTERN', instrument: 'synth', patternId: synth.activePatternId })}>Clear</HwButton>
        <HwButton
          active={(pattern?.steps ?? 16) === 32}
          onClick={() =>
            station.dispatch({
              type: 'SET_PATTERN_LENGTH',
              instrument: 'synth',
              patternId: synth.activePatternId,
              steps: (pattern?.steps ?? 16) === 16 ? 32 : 16,
            })
          }
        >
          {pattern?.steps ?? 16}
        </HwButton>
      </div>
      {pattern && (
        <div className="space-y-1">
          <MelodicRow
            steps={pattern.notes.slice(0, 16)}
            playheadStep={playStep < 16 ? playStep : -1}
            minNote={48}
            maxNote={84}
            onToggle={(step) => station.dispatch({ type: 'TOGGLE_MELODIC_STEP', instrument: 'synth', step })}
            onPitch={(step, note) =>
              station.dispatch({ type: 'SET_NOTE', instrument: 'synth', patternId: synth.activePatternId, step, note })
            }
            onAccent={(step) => {
              const cell = pattern.notes[step]
              if (!cell) return
              station.dispatch({
                type: 'SET_STEP',
                instrument: 'synth',
                patternId: synth.activePatternId,
                step,
                data: { accent: !cell.accent, on: true },
              })
            }}
            onSlide={(step) => {
              const cell = pattern.notes[step]
              if (!cell) return
              station.dispatch({
                type: 'SET_STEP',
                instrument: 'synth',
                patternId: synth.activePatternId,
                step,
                data: { slide: !cell.slide, on: true },
              })
            }}
          />
          {pattern.steps === 32 && (
            <MelodicRow
              steps={pattern.notes.slice(16, 32)}
              playheadStep={playStep >= 16 ? playStep % 16 : -1}
              minNote={48}
              maxNote={84}
              onToggle={(step) => station.dispatch({ type: 'TOGGLE_MELODIC_STEP', instrument: 'synth', step: step + 16 })}
              onPitch={(step, note) =>
                station.dispatch({ type: 'SET_NOTE', instrument: 'synth', patternId: synth.activePatternId, step: step + 16, note })
              }
              onAccent={(step) => {
                const cell = pattern.notes[step + 16]
                if (!cell) return
                station.dispatch({
                  type: 'SET_STEP',
                  instrument: 'synth',
                  patternId: synth.activePatternId,
                  step: step + 16,
                  data: { accent: !cell.accent, on: true },
                })
              }}
              onSlide={(step) => {
                const cell = pattern.notes[step + 16]
                if (!cell) return
                station.dispatch({
                  type: 'SET_STEP',
                  instrument: 'synth',
                  patternId: synth.activePatternId,
                  step: step + 16,
                  data: { slide: !cell.slide, on: true },
                })
              }}
            />
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Knob label="A Lev" value={p.oscA.level} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.oscA.level', value: v })} />
        <Knob label="B Lev" value={p.oscB.level} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.oscB.level', value: v })} />
        <Knob label="Detune" value={p.oscB.detune} min={-24} max={24} step={1} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.oscB.detune', value: v })} />
        <Knob label="Cut" value={p.cutoff} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.cutoff', value: v })} />
        <Knob label="Res" value={p.resonance} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.resonance', value: v })} />
        <Knob label="FEnv" value={p.filterEnv.amount} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.filterEnv.amount', value: v })} />
        <Knob label="Atk" value={p.ampEnv.attack} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.ampEnv.attack', value: v })} />
        <Knob label="Dec" value={p.ampEnv.decay} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.ampEnv.decay', value: v })} />
        <Knob label="Sus" value={p.ampEnv.sustain} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.ampEnv.sustain', value: v })} />
        <Knob label="Rel" value={p.ampEnv.release} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.ampEnv.release', value: v })} />
        <Knob label="LFO" value={p.lfo.rate} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.lfo.rate', value: v })} />
        <Knob label="Mod" value={p.lfo.amount} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.lfo.amount', value: v })} />
        <Knob label="Glide" value={p.glide} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.glide', value: v })} />
        <Knob label="Level" value={p.level} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.level', value: v })} />
      </div>
      <div className="mt-2 flex gap-1">
        {(['cutoff', 'pitch', 'amp'] as const).map((dest) => (
          <HwButton key={dest} active={p.lfo.dest === dest} onClick={() => station.dispatch({ type: 'SET_PARAMETER', path: 'synth.params.lfo.dest', value: dest })}>
            LFO {dest}
          </HwButton>
        ))}
      </div>
    </section>
  )
}

export function MixerFx() {
  const station = useStation()
  const mixer = useProject((p) => p.mixer)
  const fx = useProject((p) => p.fx)
  const read = useMemo(
    () => ({
      drums: () => station.getMeters().drums,
      bass: () => station.getMeters().bass,
      synth: () => station.getMeters().synth,
      master: () => station.getMeters().masterL,
    }),
    [station],
  )

  return (
    <section className="panel min-w-0 rounded-md p-3">
      <header className="mb-3">
        <div className="font-display text-lg tracking-[0.28em] text-brass">MIX · FX</div>
        <div className="engraved text-[10px]">Buses · sends · master</div>
      </header>
      <div className="flex flex-wrap gap-5">
        {(['drums', 'bass', 'synth'] as const).map((ch) => (
          <div key={ch} className="flex flex-col items-center gap-2">
            <div className="engraved text-[9px]">{ch}</div>
            <div className="flex gap-2">
              <Fader label="Vol" value={mixer[ch].volume} onChange={(v) => station.dispatch({ type: 'SET_MIX', channel: ch, param: 'volume', value: v })} />
              <LiveMeter read={read[ch]} />
            </div>
            <Knob label="Pan" value={mixer[ch].pan} min={-1} max={1} size={46} onChange={(v) => station.dispatch({ type: 'SET_MIX', channel: ch, param: 'pan', value: v })} />
            <Knob label="Dly" value={mixer[ch].sendDelay} size={46} onChange={(v) => station.dispatch({ type: 'SET_MIX', channel: ch, param: 'sendDelay', value: v })} />
            <Knob label="Rev" value={mixer[ch].sendReverb} size={46} onChange={(v) => station.dispatch({ type: 'SET_MIX', channel: ch, param: 'sendReverb', value: v })} />
            <div className="flex gap-1">
              <HwButton active={mixer[ch].mute} onClick={() => station.dispatch({ type: mixer[ch].mute ? 'UNMUTE_CHANNEL' : 'MUTE_CHANNEL', channel: ch })}>
                M
              </HwButton>
              <HwButton active={mixer[ch].solo} onClick={() => station.dispatch({ type: mixer[ch].solo ? 'UNSOLO_CHANNEL' : 'SOLO_CHANNEL', channel: ch })}>
                S
              </HwButton>
            </div>
          </div>
        ))}
        <div className="flex flex-col items-center gap-2">
          <div className="engraved text-[9px]">Master</div>
          <div className="flex gap-2">
            <Fader label="Vol" value={mixer.master.volume} onChange={(v) => station.dispatch({ type: 'SET_MIX', channel: 'master', param: 'volume', value: v })} />
            <LiveMeter read={read.master} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-brass/10 pt-3">
        <Knob label="Dly T" value={fx.delay.time} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.delay.time', value: v })} />
        <Knob label="Dly Fb" value={fx.delay.feedback} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.delay.feedback', value: v })} />
        <Knob label="Dly" value={fx.delay.mix} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.delay.mix', value: v })} />
        <Knob label="Size" value={fx.reverb.size} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.reverb.size', value: v })} />
        <Knob label="Damp" value={fx.reverb.damp} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.reverb.damp', value: v })} />
        <Knob label="Hall" value={fx.reverb.mix} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.reverb.mix', value: v })} />
        <Knob label="Drive" value={fx.distortion.drive} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.distortion.drive', value: v })} />
        <Knob label="Crush" value={fx.distortion.mix} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.distortion.mix', value: v })} />
        <Knob label="Thr" value={fx.compressor.threshold} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.compressor.threshold', value: v })} />
        <Knob label="Ratio" value={fx.compressor.ratio} onChange={(v) => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.compressor.ratio', value: v })} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {(['drums', 'bass', 'synth', 'master'] as const).map((t) => (
          <HwButton key={t} active={fx.distortion.target === t} onClick={() => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.distortion.target', value: t })}>
            Dist {t}
          </HwButton>
        ))}
        <HwButton active={fx.delay.pingPong} onClick={() => station.dispatch({ type: 'SET_PARAMETER', path: 'fx.delay.pingPong', value: !fx.delay.pingPong })}>
          Ping
        </HwButton>
      </div>
    </section>
  )
}

export function RecordSaveBar({ keysOpen, onToggleKeys }: { keysOpen: boolean; onToggleKeys: () => void }) {
  const station = useStation()
  const name = useProject((p) => p.meta.name)
  const takes = useProject((p) => p.meta.takes)
  const last = takes[takes.length - 1]
  const err = useProject(() => station.lastError)
  const playingTake = useProject(() => station.playingTake)

  return (
    <section className="panel flex flex-wrap items-center gap-3 rounded-md px-3 py-2">
      <input
        className="hw-input px-2 py-1 font-mono text-sm"
        value={name}
        aria-label="Project name"
        onChange={(e) => station.dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
      />
      <HwButton onClick={() => station.save()}>Save</HwButton>
      <HwButton onClick={() => station.loadSaved()}>Reload</HwButton>
      <HwButton onClick={() => station.downloadProject()}>File</HwButton>
      <label className="hw-btn cursor-pointer px-2.5 py-1 text-[11px] tracking-[0.14em] uppercase">
        Open
        <input
          type="file"
          accept=".json,.soundstation.json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            void file.text().then((t) => station.openProjectFile(t))
            e.target.value = ''
          }}
        />
      </label>
      <HwButton onClick={() => station.newProject()}>New</HwButton>
      <HwButton onClick={() => void station.exportWav(4)}>Export WAV</HwButton>
      <HwButton active={playingTake} onClick={() => station.playLastTake()}>
        Play Take
      </HwButton>
      <div className="font-mono text-[11px] text-mist">
        {last ? `TAKE ${last.durationSec.toFixed(1)}s · ${last.bpm} BPM` : 'NO TAKE'}
      </div>
      {err && <div className="font-mono text-[11px] text-rec">{err}</div>}
      <HwButton active={keysOpen} onClick={onToggleKeys} className="ml-auto">
        Keys
      </HwButton>
    </section>
  )
}
