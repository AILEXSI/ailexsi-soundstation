function writeString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}

export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = Math.max(1, channels.length)
  const length = channels[0]?.length ?? 0
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = length * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = channels[c]?.[i] ?? 0
      const s = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }
  return buffer
}

export function decodeWav(buffer: ArrayBuffer): { sampleRate: number; channels: Float32Array[] } {
  const view = new DataView(buffer)
  const sampleRate = view.getUint32(24, true)
  const numChannels = view.getUint16(22, true)
  const bits = view.getUint16(34, true)
  const dataSize = view.getUint32(40, true)
  const frames = dataSize / (numChannels * (bits / 8))
  const channels = Array.from({ length: numChannels }, () => new Float32Array(frames))
  let offset = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = view.getInt16(offset, true)
      const ch = channels[c]
      if (ch) ch[i] = s / (s < 0 ? 0x8000 : 0x7fff)
      offset += 2
    }
  }
  return { sampleRate, channels }
}

export function mixToStereo(input: Float32Array[], length?: number): [Float32Array, Float32Array] {
  if (input.length >= 2 && input[0] && input[1]) {
    const n = length ?? Math.min(input[0].length, input[1].length)
    return [input[0].subarray(0, n), input[1].subarray(0, n)]
  }
  const mono = input[0] ?? new Float32Array(length ?? 0)
  const n = length ?? mono.length
  return [mono.subarray(0, n), mono.subarray(0, n)]
}

export function concatChannels(chunks: Array<{ l: Float32Array; r: Float32Array }>): [Float32Array, Float32Array] {
  let total = 0
  for (const c of chunks) total += c.l.length
  const l = new Float32Array(total)
  const r = new Float32Array(total)
  let o = 0
  for (const c of chunks) {
    l.set(c.l, o)
    r.set(c.r, o)
    o += c.l.length
  }
  return [l, r]
}

export function peakOf(channel: Float32Array): number {
  let p = 0
  for (let i = 0; i < channel.length; i++) p = Math.max(p, Math.abs(channel[i] ?? 0))
  return p
}

export function hasAudibleSignal(channels: Float32Array[], threshold = 0.0008): boolean {
  return channels.some((ch) => peakOf(ch) >= threshold)
}

export function wavBlob(channels: Float32Array[], sampleRate: number): Blob {
  return new Blob([encodeWav(channels, sampleRate)], { type: 'audio/wav' })
}
