import { describe, expect, it } from 'vitest';
import { DIDNT_CATCH, makeTranscriber, parseWav, type StreamClient } from '../src/api/transcribe.js';
import { wav } from './wav.js';

const fake = (results: { IsPartial: boolean; text: string }[][], seen: unknown[] = []): StreamClient => ({
  async send(command) {
    seen.push(command);
    return { TranscriptResultStream: (async function* () {
      for (const rs of results) yield { TranscriptEvent: { Transcript: { Results: rs.map(r => ({ IsPartial: r.IsPartial, Alternatives: [{ Transcript: r.text }] })) } } };
    })() };
  },
});

describe('parseWav', () => {
  it('accepts 16 kHz mono PCM16 up to 8 s', () => {
    const r = parseWav(wav(16000 * 8));
    expect(r.ok && r.pcm.byteLength).toBe(16000 * 8 * 2);
  });
  it('skips a LIST chunk before data', () => {
    const r = parseWav(wav(16000, 16000, 1, { listChunk: true }));
    expect(r.ok && r.pcm.byteLength).toBe(32000);
  });
  it('rejects under 0.1 s', () => {
    expect(parseWav(wav(1599)).ok).toBe(false);
    expect(parseWav(wav(1600)).ok).toBe(true);
  });
  it('rejects over 8 s, wrong rate, stereo, junk and over 300 KB', () => {
    expect(parseWav(wav(16000 * 8 + 2)).ok).toBe(false);
    expect(parseWav(wav(16000, 44100)).ok).toBe(false);
    expect(parseWav(wav(16000, 16000, 2)).ok).toBe(false);
    expect(parseWav(new Uint8Array(100)).ok).toBe(false);
    expect(parseWav(wav(16000, 16000, 1, { format: 3, bits: 32 })).ok).toBe(false); // float
    expect(parseWav(wav(16000, 16000, 1, { bits: 8 })).ok).toBe(false);
    expect(parseWav(new Uint8Array(300 * 1024 + 1)).ok).toBe(false);
  });
});

describe('makeTranscriber', () => {
  it('joins final segments and ignores partials', async () => {
    const t = makeTranscriber(fake([[{ IsPartial: true, text: 'what' }], [{ IsPartial: false, text: 'What is' }], [{ IsPartial: false, text: 'offside?' }]]));
    expect(await t(new Uint8Array(20000))).toBe('What is offside?');
  });
  it('asks Transcribe for en-US, 16000 Hz, pcm and streams all the audio', async () => {
    const seen: { input: { LanguageCode: string; MediaSampleRateHertz: number; MediaEncoding: string; AudioStream: AsyncIterable<{ AudioEvent: { AudioChunk: Uint8Array } }> } }[] = [];
    await makeTranscriber(fake([], seen))(new Uint8Array(20000));
    const i = seen[0]!.input;
    expect([i.LanguageCode, i.MediaSampleRateHertz, i.MediaEncoding]).toEqual(['en-US', 16000, 'pcm']);
    let n = 0;
    for await (const c of i.AudioStream) n += c.AudioEvent.AudioChunk.byteLength;
    expect(n).toBe(20000);
  });
  it('returns an empty string when nothing was said', async () => {
    expect(await makeTranscriber(fake([]))(new Uint8Array(100))).toBe('');
    expect(DIDNT_CATCH).toBe("I didn't catch that - try again or type it.");
  });
});
