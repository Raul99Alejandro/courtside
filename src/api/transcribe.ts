import { StartStreamTranscriptionCommand, TranscribeStreamingClient } from '@aws-sdk/client-transcribe-streaming';

export const SAMPLE_RATE = 16000;
export const MAX_AUDIO_SECONDS = 8;
export const MAX_WAV_BYTES = 300 * 1024;
export const DIDNT_CATCH = "I didn't catch that - try again or type it.";

/** Turns 16 kHz mono PCM16 into text ('' when nothing was said). */
export type Transcriber = (pcm: Uint8Array) => Promise<string>;

export type WavResult = { ok: true; pcm: Uint8Array } | { ok: false; message: string };

const NOT_AUDIO = 'That recording is not valid audio';
const TOO_LONG = 'That recording is too long - keep it under 8 seconds';

/** Validates a canonical PCM16 mono 16 kHz WAV (the phone writes exactly this) and returns its samples. */
export function parseWav(wav: Uint8Array): WavResult {
  const bad = (message: string): WavResult => ({ ok: false, message });
  if (wav.byteLength > MAX_WAV_BYTES) return bad(TOO_LONG);
  if (wav.byteLength < 44) return bad(NOT_AUDIO);
  const v = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return bad(NOT_AUDIO);
  let fmtOk = false;
  let o = 12;
  while (o + 8 <= wav.byteLength) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    if (id === 'fmt ') {
      if (size < 16 || o + 8 + 16 > wav.byteLength) return bad(NOT_AUDIO);
      fmtOk = v.getUint16(o + 8, true) === 1 && v.getUint16(o + 10, true) === 1 && v.getUint32(o + 12, true) === SAMPLE_RATE && v.getUint16(o + 22, true) === 16;
      if (!fmtOk) return bad(NOT_AUDIO);
    } else if (id === 'data') {
      if (!fmtOk) return bad(NOT_AUDIO);
      const start = o + 8;
      const len = Math.min(size, wav.byteLength - start) & ~1;
      if (len > MAX_AUDIO_SECONDS * SAMPLE_RATE * 2) return bad(TOO_LONG);
      return { ok: true, pcm: wav.subarray(start, start + len) };
    }
    o += 8 + size + (size & 1);
  }
  return bad(NOT_AUDIO);
}

export interface StreamClient { send(command: unknown): Promise<unknown> }

type Seg = { IsPartial?: boolean; Alternatives?: { Transcript?: string }[] };
type TranscribeOutput = { TranscriptResultStream?: AsyncIterable<{ TranscriptEvent?: { Transcript?: { Results?: Seg[] } } }> };

/** Streams the PCM to Amazon Transcribe and joins the final segments. The client is injectable for tests. */
export function makeTranscriber(client: StreamClient = new TranscribeStreamingClient({})): Transcriber {
  return async pcm => {
    async function* audio() {
      const CHUNK = 8192;
      for (let i = 0; i < pcm.byteLength; i += CHUNK) yield { AudioEvent: { AudioChunk: pcm.subarray(i, i + CHUNK) } };
    }
    const out = await client.send(new StartStreamTranscriptionCommand({
      LanguageCode: 'en-US', MediaSampleRateHertz: SAMPLE_RATE, MediaEncoding: 'pcm', AudioStream: audio(),
    })) as TranscribeOutput;
    const parts: string[] = [];
    for await (const ev of out.TranscriptResultStream ?? []) {
      for (const r of ev.TranscriptEvent?.Transcript?.Results ?? []) {
        if (r.IsPartial) continue;
        const t = r.Alternatives?.[0]?.Transcript?.trim();
        if (t) parts.push(t);
      }
    }
    return parts.join(' ').trim();
  };
}
