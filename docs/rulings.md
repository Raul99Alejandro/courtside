# Rulings

Technical decisions taken by the AI: decision — why — cost if wrong.

- Phone voice = MediaRecorder clip → backend transcription (Bedrock audio model if supported, else Transcribe), plus a typed fallback — works on iPhone and Android and keeps audio in our AWS account — cost if wrong: 2–4 s extra latency per question vs in-browser recognition.
