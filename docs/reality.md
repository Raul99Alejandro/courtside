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
