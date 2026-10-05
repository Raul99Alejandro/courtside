export function wav(samples: number, rate = 16000, channels = 1): Uint8Array {
  const data = samples * 2;
  const b = new Uint8Array(44 + data);
  const v = new DataView(b.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + data, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, channels, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * channels * 2, true); v.setUint16(32, channels * 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, data, true);
  return b;
}
