# Rulings

Technical decisions taken by the AI: decision — why — cost if wrong.

- Phone voice = MediaRecorder clip → backend transcription (Bedrock audio model if supported, else Transcribe), plus a typed fallback — works on iPhone and Android and keeps audio in our AWS account — cost if wrong: 2–4 s extra latency per question vs in-browser recognition.
- `tv` follows AmazonAppDev/react-native-multi-tv-app-sample (shared UI + Vega app + Expo web/Fire OS app) — official pattern, gives the Windows web preview and plan B for free — cost if wrong: Vega/Expo RN version mismatch to resolve on 10 Oct.
- Explanations: Nova 2 Lite (reasoning for pre-generation, none for live questions) — newest Amazon model available to the account, correct facts with reasoning, Amazon-native for judges — cost if wrong: weaker tactical prose than frontier models.
