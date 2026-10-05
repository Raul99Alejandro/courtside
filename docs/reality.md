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
