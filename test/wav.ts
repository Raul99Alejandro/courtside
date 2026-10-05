export function wav(samples: number, rate = 16000, channels = 1, opts: { format?: number; bits?: number; listChunk?: boolean } = {}): Uint8Array {
  const { format = 1, bits = 16, listChunk = false } = opts;
  const data = samples * 2;
  const list = listChunk ? 8 + 6 : 0;
  const b = new Uint8Array(44 + list + data);
  const v = new DataView(b.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + list + data, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, format, true); v.setUint16(22, channels, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * channels * 2, true); v.setUint16(32, channels * 2, true); v.setUint16(34, bits, true);
  let o = 36;
  if (listChunk) { w(o, 'LIST'); v.setUint32(o + 4, 6, true); o += 14; }
  w(o, 'data'); v.setUint32(o + 4, data, true);
  return b;
}
