# Friction log

Format per entry (hackathon friction-log fields): task attempted · steps taken · expected vs actual · severity (blocker/major/minor) · workaround · suggestion.

## F-1: Vega SDK has no Windows path
- Task: set up Vega development on Windows 11
- Steps: read install docs; searched for WSL guidance
- Expected: a Windows or WSL route, or a cloud simulator
- Actual: macOS/Ubuntu only; virtual device needs KVM/Hypervisor.framework, so WSL/VirtualBox fail
- Severity: major
- Workaround: wait for a Mac; plan B Fire OS device
- Suggestion: state Windows unsupported on the first page, and offer a hosted Vega Virtual Device or WSL2 nested-virt guide

## F-2: Vega docs are hard to pin to one version
- Task: find the supported React Native version and libraries for a new Vega app
- Steps: read release notes, supported-libraries page, focus docs, multi-TV sample and blog
- Expected: one current page per topic and a platform matrix
- Actual: URLs versioned 0.21–0.24 with inconsistent paths; two doc trees (/docs/vega/ and /docs/vega-api/); sample and blog name the same layout differently; no macOS version matrix (only "Apple Silicon M1–M4"); QR library workarounds (legacy-peer-deps, fast-text-encoding) easy to miss
- Severity: minor
- Workaround: cross-check release notes against the sample repo
- Suggestion: a single "latest" alias per page, one compatibility matrix (SDK × RN × macOS × chip), and install notes inline on each library page

## F-3: Claude models on Bedrock blocked behind an undiscoverable form
- Task: compare models for TV explanations via the Converse API
- Steps: listed inference profiles (Claude Haiku 4.5 and Sonnet 5.5 appear), called Converse
- Expected: models listed for the account are invocable, or the listing says they are not
- Actual: Haiku → ResourceNotFoundException "Model use case details have not been submitted"; Sonnet 5.5 → AccessDeniedException "not available for this account"; Nova Premier listed but end-of-life
- Severity: major
- Workaround: Nova 2 Lite / Nova Pro meanwhile; owner submits the use-case form
- Suggestion: mark inference profiles the caller cannot invoke (and EOL ones) in list-inference-profiles output
