import { concatChannels, encodeWav, hasAudibleSignal } from './wav'

const WORKLET = `
class SSCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.armed = false
    this.port.onmessage = (e) => {
      if (e.data === 'start') this.armed = true
      if (e.data === 'stop') this.armed = false
    }
  }
  process(inputs) {
    if (!this.armed) return true
    const input = inputs[0]
    if (!input || !input[0]) return true
    const l = new Float32Array(input[0])
    const r = new Float32Array(input[1] || input[0])
    this.port.postMessage({ l, r }, [l.buffer, r.buffer])
    return true
  }
}
registerProcessor('ss-capture', SSCapture)
`

export interface TakeAudio {
  id: string
  sampleRate: number
  left: Float32Array
  right: Float32Array
  durationSec: number
}

export class MasterRecorder {
  private node: AudioWorkletNode | ScriptProcessorNode | null = null
  private chunks: Array<{ l: Float32Array; r: Float32Array }> = []
  private armed = false
  private workletReady = false
  private fallback: ScriptProcessorNode | null = null
  lastError: string | null = null

  constructor(private ctx: AudioContext) {}

  async prepare(tap: AudioNode): Promise<void> {
    if (this.node) return
    try {
      const blob = new Blob([WORKLET], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      await this.ctx.audioWorklet.addModule(url)
      URL.revokeObjectURL(url)
      const node = new AudioWorkletNode(this.ctx, 'ss-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      })
      node.port.onmessage = (e: MessageEvent<{ l: Float32Array; r: Float32Array }>) => {
        if (!this.armed) return
        this.chunks.push(e.data)
      }
      tap.connect(node)
      const mute = this.ctx.createGain()
      mute.gain.value = 0
      node.connect(mute)
      mute.connect(this.ctx.destination)
      this.node = node
      this.workletReady = true
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Worklet failed'
      this.installFallback(tap)
    }
  }

  private installFallback(tap: AudioNode): void {
    const proc = this.ctx.createScriptProcessor(2048, 2, 2)
    proc.onaudioprocess = (ev) => {
      if (!this.armed) return
      const l = new Float32Array(ev.inputBuffer.getChannelData(0))
      const r = new Float32Array(ev.inputBuffer.getChannelData(1) ?? ev.inputBuffer.getChannelData(0))
      this.chunks.push({ l, r })
    }
    tap.connect(proc)
    const mute = this.ctx.createGain()
    mute.gain.value = 0
    proc.connect(mute)
    mute.connect(this.ctx.destination)
    this.fallback = proc
    this.node = proc
  }

  start(): void {
    this.chunks = []
    this.armed = true
    this.lastError = null
    if (this.node instanceof AudioWorkletNode) this.node.port.postMessage('start')
  }

  stop(): TakeAudio | null {
    this.armed = false
    if (this.node instanceof AudioWorkletNode) this.node.port.postMessage('stop')
    if (this.chunks.length === 0) {
      this.lastError = 'Recording captured no audio'
      return null
    }
    const [left, right] = concatChannels(this.chunks)
    this.chunks = []
    if (!hasAudibleSignal([left, right])) {
      this.lastError = 'Recording was silent — check master level and unmute'
    }
    return {
      id: `take-${Date.now()}`,
      sampleRate: this.ctx.sampleRate,
      left,
      right,
      durationSec: left.length / this.ctx.sampleRate,
    }
  }

  get isRecording(): boolean {
    return this.armed
  }

  get ready(): boolean {
    return this.workletReady || this.fallback !== null
  }
}

export function takeToWav(take: TakeAudio): ArrayBuffer {
  return encodeWav([take.left, take.right], take.sampleRate)
}

export function takeToBuffer(ctx: BaseAudioContext, take: TakeAudio): AudioBuffer {
  const buf = ctx.createBuffer(2, take.left.length, take.sampleRate)
  buf.copyToChannel(take.left as unknown as Float32Array<ArrayBuffer>, 0)
  buf.copyToChannel(take.right as unknown as Float32Array<ArrayBuffer>, 1)
  return buf
}
