# Reality checks

Every assumption about the outside world, checked before we build on it.
Entry format:

## RC-<n>: <assumption>
- Result: confirmed | refuted | partial
- Evidence: <links, commands, output excerpts>
- Decision: <what we do because of it>
- Date: <YYYY-MM-DD>

## RC-1: Vega can be developed on Windows
- Result: refuted
- Evidence: https://developer.amazon.com/docs/vega/0.23/install-vega-sdk.html (macOS/Ubuntu only); community thread on VirtualBox/WSL (needs KVM / Hypervisor.framework)
- Decision: Vega work on the owner's Mac mini from 2026-10-10; Fire TV Stick 4K Plus (Fire OS 8) as plan B
- Date: 2026-10-04

## RC-2: Any current Fire TV Stick runs Fire OS
- Result: refuted
- Evidence: XDA and PCWorld on Fire TV Stick HD (2025) running Vega OS; BGR on the newest Fire TV Stick 4K running Vega OS; MobilityArena list (4K Plus, 4K Max run Fire OS 8)
- Decision: plan B device is Fire TV Stick 4K Plus (ASIN B0F7Z3CBVF)
- Date: 2026-10-04

## RC-3: A third-party app can use the remote's microphone
- Result: refuted
- Evidence: Vega Content Launcher docs (Alexa delivers only search/play intents); github.com/mertmr/tv-assistant notes
- Decision: free-form voice comes from each viewer's phone (QR pairing); Alexa is phase 2a
- Date: 2026-10-04

## RC-6: The phone page can capture a spoken question reliably on iPhone and Android
- Result: partial
- Evidence: Web Speech API is not Baseline; on Chrome audio goes to a vendor service (https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition); iOS WebKit recognition fails silently without Dictation, in home-screen apps, and after audio playback (https://bugs.webkit.org/show_bug.cgi?id=225298, https://developer.apple.com/forums/thread/728822). MediaRecorder works on iOS Safari 14.5+ (audio/mp4) and Chrome (webm/opus) (https://webkit.org/blog/11353/mediarecorder-api/). Transcribe streaming needs a SigV4-presigned WebSocket with 16-bit PCM (https://docs.aws.amazon.com/transcribe/latest/dg/websocket.html); $0.01/min (https://aws.amazon.com/transcribe/pricing/).
- Decision: push-to-talk records a 5–8 s clip with MediaRecorder (mp4 first, then webm) and uploads it; the backend transcribes it. Audio-input support of Nova 2 Lite on Bedrock is unconfirmed: probe it in Part 2, with Transcribe batch as the fallback. A typed text box sits next to the mic button. Web Speech only as an optional fast path on Chrome Android.
- Date: 2026-10-04

## RC-4: StatsBomb Open Data may be used in a public, free hackathon demo
- Result: partial
- Evidence: https://github.com/statsbomb/open-data README — "freely available for public use for research projects and genuine interest in football analytics"; asks to "state the data source as StatsBomb and use our logo, available in our Media Pack". User agreement (https://raw.githubusercontent.com/statsbomb/open-data/master/LICENSE.pdf, 8 Sep 2023): 1.2.1 may not "edit, distort, distribute, reproduce, sell or in any way provide the data to any external or third party"; 1.2.2 may not "commercially exploit the data or any analysis derived from the use of the Service"; 1.4 publications must carry the StatsBomb logo.
- Decision: free, non-commercial demo only. Never commit or bundle the raw JSON; fetch it from StatsBomb's GitHub at build time. Derived artefacts we ship (curated moments, explanations) are our analysis. Show the StatsBomb logo + "Data: StatsBomb Open Data" in README, app and video end card, plus "analysis is ours, not StatsBomb's". A commercial Appstore version must license a data feed (StatsBomb, Opta or similar) — say so in the Potential Impact story. Check media-pack logo terms before committing the logo file.
- Date: 2026-10-04

## RC-5: The chosen match has 360 freeze-frames for the key moments
- Result: confirmed
- Evidence: `node spikes/statsbomb/probe.mjs` → match 3869685 (Final, Argentina vs France); events 4407 (Shot 38, Pass 1263, Foul Committed 48, Offside 1); three-sixty 3683 frames, avg 16.7 players per frame; 83.6% of events have a frame; all 6 regulation/extra-time goals, 35/38 shots and every offside-related event have one (only the 2 shoot-out penalties and 1 extra-time shot lack one).
- Decision: use match 3869685; the pitch draws ball + actor for every moment and the visible players from the 360 frame when present.
- Date: 2026-10-04

## RC-7: The TV app can be React Native shared across Vega, Fire OS and a web preview
- Result: confirmed (versions to pin on 2026-10-10)
- Evidence: Vega SDK 0.24 supports RN 0.83 and 0.72 (https://developer.amazon.com/docs/vega/0.24/vega-release-notes.html; known issues: no setNativeProps, no Chrome DevTools on 0.83). Supported libraries (https://developer.amazon.com/docs/vega-api/0.22/supported-libraries.html): @amazon-devices/react-native-svg, @amazon-devices/react-native-reanimated, @amazon-devices/react-native-qrcode-svg (needs legacy-peer-deps and possibly fast-text-encoding). Focus follows react-native-tvos (TVFocusGuideView, hasTVPreferredFocus, useTVEventHandler) (https://developer.amazon.com/docs/vega/0.22/focus-management). https://github.com/AmazonAppDev/react-native-multi-tv-app-sample: "Single codebase running on Android TV, Apple TV, Fire TV FOS, Fire TV Vega OS and Web" (Yarn workspaces: apps/expo-multi-tv, apps/vega, packages/shared-ui; web via `yarn dev:web`); Amazon blog https://developer.amazon.com/apps-and-games/blogs/2026/05/sharing-your-vega-app-across-platforms ("shared never imports from OS packages"). VVD documented on Apple Silicon M1–M4; a past Apple Silicon regression was fixed (https://developer.amazon.com/docs/vega/0.22/kvd-issues.html).
- Decision: base `tv` on the multi-TV sample layout (shared screens + Vega app + Expo app for web/Fire OS). Pitch with react-native-svg, animation with RN Animated first, QR with react-native-qrcode-svg, alias @amazon-devices/* on web/Android. Key events behind a per-platform file. Open risk: M6 is newer than the documented M1–M4 — first thing on 10 Oct.
- Date: 2026-10-04

## RC-8: A Bedrock model writes good layered explanations fast enough
- Result: partial
- Evidence: `spikes/bedrock/compare.mjs` on 10 key moments of match 3869685 (us-east-1, profile counterpart): Nova 2 Lite p50 1335 ms / max 1395 ms; Nova Pro p50 1484 ms / max 2021 ms; Claude Haiku 4.5 → "Model use case details have not been submitted for this account"; Claude Sonnet 5.5 → "not available for this account"; Nova Premier → end of life. Quality review (controller): both Nova models parrot raw coordinates, misplace zones (calls the centre "right sideline"), the basic layer rarely defines its jargon (penalty, offside), tactical layer is generic filler.
- Decision: (1) never send raw coordinates — the pipeline computes context first (score before/after, minute and phase, named pitch zone, the concept being taught, from the 360 frame where relevant) and the prompt teaches that concept; (2) pre-generated explanations are checked by domain evals (R-05 jargon rule, length, no coordinates); (3) re-run with Claude once the owner submits the Anthropic use-case form in the Bedrock console; latency is only critical for live questions (Nova 2 Lite ~1.3 s is acceptable there).
- Date: 2026-10-04

### RC-8 update (same day): enriched context
- Evidence: `spikes/bedrock/compare2.mjs` sends computed context (score before, phase, named zone, concept_to_teach) with a system prompt. Nova 2 Lite p50 1191 ms (in/out 2567/820 tokens for 10 moments); Nova Pro p50 1077 ms; gpt-oss-120b p50 5004 ms with reasoning noise. GPT-6.1 Sol, GPT-6 Luna, GPT-5.6 Luna, GPT-5.5, Claude Sonnet 5.5 and Opus 5.5 → AccessDeniedException "not available for this account" (us. and global. profiles); Claude Haiku 4.5 still waiting on the use-case form. Quality: Nova 2 Lite now defines terms correctly in the basic layer and gives game-state context; two factual slips remain (says Messi's 107' goal "ties the match" — it made it 3-2; invents the receiver of an offside pass). Nova Pro is shorter and more generic.
- Decision: the pipeline also computes outcome facts (score after, "puts X ahead / levels / pulls one back", receiver if known) so the model never infers them; an eval checks every generated card against those facts. Nova 2 Lite is the working default; re-test Claude Haiku 4.5 once the form propagates; frontier-model access is an account restriction (support case = owner decision).
- Amazon text models available (list-foundation-models --by-provider amazon): Nova 2 Lite, Nova Lite, Nova Micro, Nova Pro (Premier is end-of-life); Nova 2 Lite is the newest. With `reasoningConfig` medium: facts correct on all 9 answered moments (107' "breaks the 2-2 tie"), p50 10.3 s, max 21.4 s, ~20k output tokens per 10 moments, 1 empty answer, and it wrote "World Cup" once.
- Decision (final for Part 1): pre-generation = Nova 2 Lite with reasoning (medium) + evals (facts, length, no coordinates, no "World Cup"/FIFA marks, non-empty) + retry; live questions = Nova 2 Lite without reasoning (~1.2 s) fed with computed facts. Claude Haiku 4.5 re-tested once its form propagates; switch only if clearly better.
- Re-test 2026-10-05 after the Anthropic use-case form: Claude Haiku 4.5 p50 2319 ms (in/out 2397/1067); Claude Sonnet 4.6 p50 3680 ms (2407/1094); Claude Sonnet 5 → "not available for this account". Quality (controller): Sonnet 4.6 best — correct offside definition (second-to-last defender), every score fact right (107' → 3–2), real game-state reasoning; it wrote "World Cup" in 4 cards (prompt + eval must ban it). Haiku 4.5 good basics and facts, some invented tactical claims ("high defensive line", "numerical advantage"). Nova 2 Lite with reasoning matches Haiku on facts at ~10 s.
- Decision (supersedes the Nova ruling): pre-generation = Claude Sonnet 4.6 (offline, quality first); live questions = Claude Haiku 4.5 (~2.3 s), Nova 2 Lite as fallback if Claude errors or throttles. Evals from R-05 gate every generated card. Verify Claude charges post as Amazon Bedrock (not Marketplace) so credits apply.

## RC-9: Alexa can route a spoken question to the Courtside TV and know who spoke
- Result: partial (route a confirmed in docs; device/locale details unconfirmed)
- Evidence: custom-skill personalization — scope `alexa::person_id:read`, `context.System.person.personId` when the speaker's Voice ID is recognised with "Personalize skills" on; recognition "isn't guaranteed" (https://developer.amazon.com/en-US/docs/alexa/custom-skills/add-personalization-to-your-skill.html, https://developer.amazon.com/en-US/docs/alexa/custom-skills/test-troubleshoot-personalization.html); console simulator can test personalization (en-US, ja-JP) (https://developer.amazon.com/en-US/docs/alexa/custom-skills/test-personalization-alexa-simulator.html). Alexa+ MCP toolkit: US-only, account linking identifies the account owner, not the speaker (https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking.html). Vega Content Launcher: search/play intents only (https://developer.amazon.com/docs/vega/0.21/content-launcher-overview).
- Decision: phase 2a = classic custom skill (en-US), AMAZON.SearchQuery slot, endpoint calls our backend, which pushes the answer to the TV over our WebSocket labelled with the speaker (personId → viewer mapping, guest fallback); phone path stays as backup. Go/no-go 16 Oct depends on MVP being recordable and on whether the owner has an Echo-class device (else simulator-only demo).
- Date: 2026-10-06

## RC-10: Amazon Nova can replace Claude Haiku 4.5 for live answers and the generation judge
- Result: judge yes, live answers no
- Evidence: `spikes/nova-vs-haiku/compare.ts` (us-east-1, profile counterpart), 20 questions on match 3869685 moments (7 basic, 6 intermediate, 7 tactical; rule, moment and tactics questions) through the production `answerQuestion` path with the model chain forced to one model (4 s timeout like production). Blind scoring by Claude Sonnet 4.6, one call per pair, 1-5, order randomised. Live answers (base run): Haiku 4.5 latency p50 1429 / p95 3315 ms, checks first try 19/20, after retry 20/20, fallback 0; Nova 2 Lite p50 1285 / p95 3000, 20/20, 20/20, fallback 0, mean 3.35 vs Haiku 4.05, wins/ties/losses 2/4/14; Nova Pro p50 953 / p95 1270, 20/20, mean 3.2 vs 4.2, 3/0/17, answers terse (13 words); Nova 2 Lite reasoning low p50 3178 / p95 4014, first try 16/20, fallback 4/20 (timeouts), mean 3.05 vs 4.05, 4/3/13. Gap is largest in tactical (Nova 2.4-3.1 vs Haiku 3.4-3.9) and thinnest in intermediate. Nova answers are shorter and vaguer ("a rules check by the referee"), and miss the second-last-defender condition. Tweak (one rerun): inject the canonical DEFINITIONS plus "answer directly first, explain the idea" into the system prompt: Nova 2 Lite 3.5 vs Haiku 4.5 (1/2/17), Nova Pro 3.7 vs 4.4 (4/2/14), Nova 2 Lite low 3.45 vs 4.4; Haiku improved as much as Nova, so the gap did not close. Generation judge (existing judgeBasic and judgeFacts prompts, 10 stored cards, 40 clean verdicts plus 20 deliberately corrupted lines: invented VAR clause and a wrong definition): Haiku passes 40/40 clean and rejects 20/20 corrupted; Nova 2 Lite agrees on 59/60 (one false reject of a clean line), Nova Pro 60/60.
- Side finding: for a rule question with no moment on screen, the live path gives the model no canonical definition (only moment facts carry definitions), so answers rely on model memory; adding DEFINITIONS to the live system prompt is cheap and helps every model.
- Decision: keep Claude Haiku 4.5 for live answers (accept the Marketplace billing for a few cents of traffic; Nova stays the error fallback); switch the generation judge to Nova Pro (covered by credits, offline, 60/60 agreement; sample is small, so keep Nova 2 Lite as its fallback). Re-test live answers if a newer Nova is released.
- Date: 2026-10-07
