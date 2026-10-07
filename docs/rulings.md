# Rulings

Technical decisions taken by the AI: decision — why — cost if wrong.

- Phone voice = MediaRecorder clip → backend transcription (Bedrock audio model if supported, else Transcribe), plus a typed fallback — works on iPhone and Android and keeps audio in our AWS account — cost if wrong: 2–4 s extra latency per question vs in-browser recognition.
- `tv` follows AmazonAppDev/react-native-multi-tv-app-sample (shared UI + Vega app + Expo web/Fire OS app) — official pattern, gives the Windows web preview and plan B for free — cost if wrong: Vega/Expo RN version mismatch to resolve on 10 Oct.
- Explanations: Nova 2 Lite (reasoning for pre-generation, none for live questions) — newest Amazon model available to the account, correct facts with reasoning, Amazon-native for judges — cost if wrong: weaker tactical prose than frontier models.
- Explanations (2026-10-05): Sonnet 4.6 pre-generation, Haiku 4.5 live, Nova 2 Lite fallback — best measured quality per role among models the account can invoke — cost if wrong: cents per run; Claude spend might bypass promotional credits if billed via Marketplace.
- Live answers vs judge on Nova (2026-10-07, RC-10): live answers stay on Haiku 4.5 (Nova scores 3.2-3.5 vs 4.0-4.5 blind, 14-17 losses of 20, no prompt tweak closed it); the generation judge moves to Nova Pro, Nova 2 Lite fallback (100% agreement with Haiku on 60 verdicts, catches all corrupted lines) — credit-covered where it matters and quality kept where viewers hear it — cost if wrong: a few cents of Marketplace billing for live traffic, or a missed bad card if the judge sample was too easy.
