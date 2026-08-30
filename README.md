# AILEXSI SoundStation

A standalone electronic instrument and groove workstation. Open it, arm the engine, press Play. Drums, bass, and a dual-oscillator synth run from one master clock. You can perform live, record the actual master audio, save the session, reopen it in the same musical state, and export a WAV that is the sound you heard.

This is not a DAW and not a generic production dashboard. It is one playable machine: pattern sequencers, hands-on knobs, mixer, effects, transport, record, save, export.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://127.0.0.1:43217`). Click **Arm Engine** — the browser needs a gesture before Web Audio can start — then **Play**.

```bash
npm test      # engine, project, sequencer, WAV tests
npm run build
```

## Play

A factory groove in A minor is already programmed on pattern **A01** for drums, bass, and synth.

| Do this | How |
| --- | --- |
| Start / stop | **Play** or Space |
| Reset to step 1 | **Reset** or Esc |
| Tap tempo | **Tap** or T |
| Tempo | BPM knob, or `[` `]` (±1, Shift ±5) |
| Program drums | Click a pad. Shift-click for accent. Voice buttons preview the hit. |
| Program bass / synth | Click a step to toggle. Drag a lit step vertically to change pitch. Shift = accent. Alt = slide. |
| Switch patterns | A01–B08 on each instrument. Live changes wait for the next step, beat, or bar (Performance quantize). |
| Perform | Mute groups, Open / Crush / Space / Drop macros, master filter sweep, delay, hall, drive. |
| Mixer / FX | Volume, pan, mute, solo, meters, delay/reverb sends, distortion target, compressor. |

Every knob and every step changes the sound or the sequence. There are no decorative controls.

## Record

**Rec** (or `R`) captures the **master audio output** as PCM — the mix you hear, including instruments, mixer, and effects. Stop with Rec again. **Play Take** replays that recording. Duration and BPM are stored with the take.

If recording fails (autoplay, mute, or a silent take), the status line says so. Nothing is faked.

## Save and reopen

- **Save** / `S` writes the full project to this browser (tempo, instruments, parameters, patterns, mixer, FX, routing, performance automation, take metadata).
- **Reload** opens the last saved session.
- **File** downloads `*.soundstation.json`.
- **Open** loads a downloaded project.
- **New** starts a fresh factory groove.

Audio takes are stored in IndexedDB so a refresh can restore the last take with the project.

## Export

**Export WAV** / `X` writes a real WAV file:

- If a take exists and transport is stopped, you get that recorded performance.
- Otherwise the current patterns are rendered offline for 4 bars through the same engine (tempo, swing, mixer, FX, automation-ready state).

The file is 16-bit stereo PCM. MP3 is not bundled; WAV is the archival format.

## Keyboard

| Key | Action |
| --- | --- |
| Space | Play / stop |
| Esc | Reset |
| R | Record |
| T | Tap tempo |
| [ ] | Tempo |
| 1–8 | Drums A01–A08 |
| Shift+1–8 | Bass patterns |
| Alt+1–8 | Synth patterns |
| M / B / L | Mute drums / bass / synth |
| S | Save |
| X | Export WAV |

Shortcuts are ignored while you type in the project name field. Open **Keys** on the instrument for the same map.

## Architecture

Audio engine, instrument state, pattern state, UI state, and project state are separate. React never owns the clock.

- `src/engine/` — master clock, synthesis, mixer, FX, recorder, offline export, command reducer
- `src/engine/reduce.ts` — deterministic project mutations (`START`, `SET_STEP`, `SET_NOTE`, `SET_TEMPO`, `SET_PARAMETER`, `MUTE_CHANNEL`, `CHANGE_PATTERN`, `SET_MIX`, `RECORD_AUTOMATION`, …)
- `src/ui/` — chassis, knobs, sequencers, meters. UI subscribes; it does not schedule notes.

The same command bus is the future local-AI surface. A later editor can issue those commands without clicking the UI. `station.handoff()` returns structured musical state (tempo, key, patterns, parameters, mixer, FX, automation) for AILEXSI Core. This repo stays standalone.

## Tests

Vitest covers project creation, pattern create/switch/clear/duplicate, tempo, mute/solo, mixer, parameters, persistence round-trip, transport flags, sequencer planning, drum DSP energy, and WAV encode/decode. The audio graph is exercised in the browser by playing, recording, and exporting.

## What this is not

Not Cubase. Not fake MIDI. Not a shell of knobs. Not the AILEXSI AI editor (that comes later). Not coupled to Resonance Studio.
