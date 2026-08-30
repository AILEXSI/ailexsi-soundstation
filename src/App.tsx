import { useEffect, useState } from 'react'
import { BassPanel, DrumMachine, MixerFx, PerformanceStrip, RecordSaveBar, SynthPanel, TempoDeck, TransportBar } from './ui/panels'
import { HwButton } from './ui/controls'
import { StationProvider, useStation } from './ui/station-context'

function Boot() {
  const station = useStation()
  const [on, setOn] = useState(station.armed)
  const [err, setErr] = useState<string | null>(null)

  if (on) return <Deck />

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="chassis w-full max-w-xl rounded-xl px-8 py-12 text-center">
        <div className="engraved text-[11px]">AILEXSI LABORATORY</div>
        <h1 className="mt-3 font-display text-5xl tracking-[0.28em] text-brass">AILEXSI</h1>
        <div className="mt-1 font-display text-2xl tracking-[0.46em] text-mist">SOUNDSTATION</div>
        <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-mist/80">
          A standalone groove instrument. Arm the engine, press Play. Night Drive is already rolling at 140 BPM —
          four-on-the-floor, trance-pump bass, and a progressive set you can ride. Touch the pads. Ride the tempo.
          Record the room, not the mouse.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <HwButton
            className="px-8 py-3 text-sm"
            onClick={() => {
              void station
                .arm()
                .then(() => setOn(true))
                .catch((e) => setErr(e instanceof Error ? e.message : 'Audio engine failed'))
            }}
          >
            Arm Engine
          </HwButton>
          {err && <div className="font-mono text-xs text-rec">{err}</div>}
        </div>
        <div className="mt-8 font-mono text-[10px] tracking-[0.28em] text-mute">SS-01 · PATTERN GROOVE WORKSTATION</div>
      </div>
    </div>
  )
}

function Deck() {
  const station = useStation()
  const [keys, setKeys] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === 's') {
          e.preventDefault()
          station.save()
        }
        return
      }
      switch (e.key) {
        case ' ':
          e.preventDefault()
          station.dispatch({ type: station.project.transport.playing ? 'STOP' : 'START' })
          break
        case 'Escape':
          station.dispatch({ type: 'RESET' })
          break
        case 'r':
        case 'R':
          void station.recordToggle()
          break
        case 't':
        case 'T':
          station.tapTempo()
          break
        case '[':
          station.dispatch({ type: 'SET_TEMPO', bpm: station.project.transport.bpm - (e.shiftKey ? 5 : 1) })
          break
        case ']':
          station.dispatch({ type: 'SET_TEMPO', bpm: station.project.transport.bpm + (e.shiftKey ? 5 : 1) })
          break
        case 'm':
        case 'M':
          station.dispatch({
            type: station.project.mixer.drums.mute ? 'UNMUTE_CHANNEL' : 'MUTE_CHANNEL',
            channel: 'drums',
          })
          break
        case 'b':
        case 'B':
          station.dispatch({
            type: station.project.mixer.bass.mute ? 'UNMUTE_CHANNEL' : 'MUTE_CHANNEL',
            channel: 'bass',
          })
          break
        case 'l':
        case 'L':
          station.dispatch({
            type: station.project.mixer.synth.mute ? 'UNMUTE_CHANNEL' : 'MUTE_CHANNEL',
            channel: 'synth',
          })
          break
        case 's':
        case 'S':
          station.save()
          break
        case 'x':
        case 'X':
          void station.exportWav(4)
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8': {
          const id = `A0${e.key}`
          const inst = e.shiftKey ? 'bass' : e.altKey ? 'synth' : 'drums'
          station.dispatch({ type: 'CHANGE_PATTERN', instrument: inst, patternId: id })
          break
        }
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [station])

  return (
    <div className="mx-auto min-h-screen max-w-[1600px] p-3 md:p-5">
      <div className="chassis rounded-xl p-3 md:p-4">
        <header className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <div className="engraved text-[10px]">AILEXSI LABORATORY</div>
            <div className="font-display text-3xl tracking-[0.22em] text-brass">SOUNDSTATION</div>
          </div>
          <div className="font-mono text-[10px] tracking-[0.24em] text-mute">SS-01 · LIVE GROOVE INSTRUMENT</div>
        </header>
        <div className="flex flex-col gap-3">
          <TransportBar />
          <TempoDeck />
          <PerformanceStrip />
          <div className="grid gap-3 xl:grid-cols-2">
            <DrumMachine />
            <BassPanel />
            <SynthPanel />
            <MixerFx />
          </div>
          <RecordSaveBar keysOpen={keys} onToggleKeys={() => setKeys((v) => !v)} />
          {keys && <KeysLegend />}
        </div>
      </div>
    </div>
  )
}

function KeysLegend() {
  const rows = [
    ['Space', 'Play / Stop'],
    ['Esc', 'Reset to step 1'],
    ['R', 'Record take'],
    ['T', 'Tap tempo'],
    ['[ ]', 'Tempo ±1 · Shift ±5 · SPEED deck for drag / presets'],
    ['1–8', 'Drums pattern A01–A08'],
    ['Shift+1–8', 'Bass pattern'],
    ['Alt+1–8', 'Synth pattern'],
    ['M / B / L', 'Mute drums / bass / synth'],
    ['S', 'Save session'],
    ['X', 'Export WAV'],
    ['Pads', 'Click toggle · Shift accent · Alt slide · Drag pitch'],
  ]
  return (
    <aside className="panel rounded-md px-4 py-3">
      <div className="engraved mb-2 text-[10px]">Keyboard</div>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([k, d]) => (
          <div key={k} className="flex justify-between gap-3 font-mono text-[11px]">
            <span className="text-brass">{k}</span>
            <span className="text-mist">{d}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}

export default function App() {
  return (
    <StationProvider>
      <Boot />
    </StationProvider>
  )
}
