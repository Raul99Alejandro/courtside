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

## F-4: Most third-party frontier models listed but "not available for this account"
- Task: compare OpenAI and Anthropic models on Bedrock for short explanations
- Steps: list-foundation-models and list-inference-profiles show GPT-6.x, GPT-5.x, Claude Sonnet/Opus 5.5; Converse with us. and global. profiles
- Expected: listed models invocable, or a clear reason and a self-service way to request access
- Actual: AccessDeniedException "not available for this account … contact AWS Sales"
- Severity: major
- Workaround: Amazon Nova 2 Lite (works, ~1.2 s)
- Suggestion: show per-account availability in the catalog and the API, and a self-service request path for hackathon/credit accounts

## F-5: HTTP API `ANY` route breaks the CORS preflight
- Task: let the static site (CloudFront origin) call the HTTP API (another origin) from a browser
- Steps: configured `corsPreflight` on the HTTP API; first routed everything with an `ANY` route; checked with curl and then with a real browser
- Expected: API Gateway answers the OPTIONS preflight from the CORS settings and the POST goes through
- Actual: an `ANY` route also matches OPTIONS, so the preflight reached our Lambda instead of API Gateway's CORS handling and the browser blocked the call; curl showed nothing wrong because curl sends no preflight
- Severity: major
- Workaround: declare GET and POST routes explicitly (comment in `infra/lib/stack.ts`); a browser check from the deployed site is part of the deploy routine
- Suggestion: warn at deploy when `corsPreflight` is set together with an `ANY` or `OPTIONS`-matching route, and say so on the CORS documentation page

## F-6: Lambda reserved concurrency fails on a new account (quota of 10)
- Task: reserve concurrency for the Alexa Lambda so a flood cannot starve the other functions
- Steps: set `reservedConcurrentExecutions` in CDK; deployed
- Expected: reservation of a few executions works, or the problem shows before the deploy
- Actual: a new account has a Lambda concurrency limit of 10 and Lambda keeps at least 10 unreserved, so no reservation is possible; CloudFormation failed mid-deploy, and the quota showed up only there
- Severity: minor
- Workaround: context value `alexaReservedConcurrency` set to "off" until the quota is raised; the stack test covers both settings
- Suggestion: surface the unreserved-minimum rule and the account's current limit in CDK/CloudFormation validation (or `cdk diff`), and in the reserved-concurrency console field

## F-7: Alexa custom-skill free-text slot rule only appears at deploy
- Task: add a spoken question ("ask court side why was that offside") with a free-text slot
- Steps: wrote the interaction model with an `AMAZON.SearchQuery` slot; validated locally; deployed the skill with the ASK CLI
- Expected: invalid slot usage rejected while editing or by a local validate step
- Actual: the rule that an intent may have only one free-text slot was reported only when the model was deployed
- Severity: minor
- Workaround: one intent with one `query` slot and carrier phrases; the model file is checked into `skill-package`
- Suggestion: a validate command (or editor schema) in the ASK CLI that applies the same slot rules as the console build

## F-8: Alexa simulator sends no personId
- Task: test "who asked" (voice recognition) before owning a device with Voice ID set up
- Steps: ran utterances in the simulator; inspected the request JSON
- Expected: a way to set a test person in the simulator
- Actual: `context.System.person` is never present in simulator requests, so recognised-voice behaviour cannot be exercised there at all
- Severity: major for personalised skills
- Workaround: the skill also accepts a spoken name ("this is Leo, why was that offside"); the `personId` path is tested with recorded requests in `test/alexa`; anyone else is Guest
- Suggestion: let the simulator send a configurable `personId` (and a toggle for "recognised" vs "unrecognised")

## F-9: Vega docs drift between versions
- Task: pin versions for a Vega app (React Native line, library versions, manifest)
- Steps: compared SDK 0.22, 0.23 and 0.24 pages, the release notes, the sample repo and the supported-libraries page
- Expected: one current page per topic
- Actual: the same topic exists under several versions with different paths; the supported-libraries page and the SDK release notes list different React Native lines (0.72 and 0.83); we had to choose a line from the sample's lockfile and the type packages
- Severity: minor
- Workaround: pinned the 0.72 line and recorded the choice in `tv/apps/vega/MAC-RUNBOOK.md`; real verification is pending 10 Oct
- Suggestion: a `latest` alias per page and a single support matrix (SDK, React Native, library versions)

## F-10: Windows shell quoting corrupted regex edits
- Task: edit code containing regular expressions through shell one-liners
- Steps: used `node -e` and heredocs from Git Bash on Windows
- Expected: backslashes pass through unchanged
- Actual: `\b` and other escapes were silently turned into control characters or dropped; three fix rounds were spent before the cause was clear
- Severity: minor
- Workaround: edit regex lines with an editor tool, not a shell string; write files instead of inlining them
- Suggestion: none for AWS; noted because this is the setup a Windows developer for Vega/Fire TV will have

## F-11: A cards-file generator should be incremental from day one
- Task: regenerate explanation cards after the checks changed
- Steps: ran the full generator against Bedrock each time
- Expected: only changed cards re-run
- Actual: every run re-ran about 40 moments with several model calls each (generation plus judge), so a small rule change cost a full run
- Severity: minor
- Workaround: the generator now regenerates only missing cards or cards failing today's checks, and `--all` forces a full run
- Suggestion: Bedrock prompt caching and a batch mode would cut the cost of such offline runs further

## F-12: Vega CLI build silently drops the app's Metro resolveRequest
- Task: build the Vega app with `react-native build-kepler` (Vega SDK 0.24, RN 0.72 line)
- Steps: aliases for community package names in `metro.config.js` `resolver.resolveRequest`; `check:vega` (direct Metro) passed; ran the Vega build
- Expected: the build uses the project's Metro resolver
- Actual: `Unable to resolve module @react-navigation/native`; the RN CLI 11 `loadMetroConfig` merges its kepler platform `resolveRequest` over the project's, with no warning
- Severity: blocker
- Workaround: a local Babel plugin rewrites import sources before resolution (`tv/apps/vega/babel-plugin-aliases.js`)
- Suggestion: chain to the project's resolveRequest instead of replacing it, or warn when one is overridden; document the alias pattern for shared monorepo code

## F-13: A render error on Vega shows up only as "AppNotResponding"
- Task: launch the first build in the Vega Virtual Device
- Steps: `vega run-app`, watched the VVD and `loggingctl`
- Expected: a red box or a JS error line in the device log
- Actual: back on the launcher after 16 s; log said `Transition timed out ... Creating surfaces` and `crashed with signal 3`, no JS error; only an error boundary around the root revealed the error
- Severity: major
- Workaround: temporary entry with an error boundary and a global error handler
- Suggestion: log uncaught render errors to `loggingctl` and name them in the ANR crash reason

## F-14: react-tv-space-navigation 6 beta does not work on Vega's React 18
- Task: run the shared TV screens (spatial navigation) on Vega
- Steps: bisected with a minimal entry, then grepped node_modules for React 19's element symbol
- Expected: the Vega-recommended focus library runs on the Vega RN 0.72 line
- Actual: 6.0.0-beta1 inlines React 19's JSX runtime; React 18.2 rejects its elements ("Objects are not valid as a React child")
- Severity: blocker
- Workaround: Vega app pins 5.2.0 (same API surface we use); Expo keeps 6.0.0-beta1
- Suggestion: a compatibility note on the Vega focus-management page naming the version range per React line

## F-15: VVD screenshot tools fail and take the device shell down
- Task: screenshot the app in the VVD from the CLI (runbook step 7)
- Steps: `gwsi-tool-screenshooter /tmp/x.png`, then `screenshooter /tmp/x.png`
- Expected: a PNG on the device to pull
- Actual: first hung and left 0 bytes; second failed with "creating a buffer file ... Permission denied"; then `com.amazon.dev.shell.service` was gone and the VVD exited
- Severity: major
- Workaround: macOS `screencapture -l<windowId>` of the VVD window (Screen Recording permission), Cmd+Shift+5 for video
- Suggestion: a supported `vega virtual-device screenshot` / `record` command

## F-16: Fresh Mac setup has more prerequisites than the install page lists
- Task: install the Vega SDK on a new Apple Silicon Mac (M6, macOS 27)
- Steps: Homebrew, Node 20, SDK utilities, Rosetta, `get_vvm.sh`
- Expected: one script that checks or installs prerequisites
- Actual: no Homebrew or Node on the machine; two password prompts (Homebrew, Rosetta); installer stops on two interactive questions. The VVD itself booted first try on the M6, newer than the documented M1 to M4
- Severity: minor
- Workaround: install them in order; Enter for installer defaults
- Suggestion: a prerequisite check in `get_vvm.sh` and a non-interactive flag; list newer chips as supported

## F-17: Small runbook drifts against SDK 0.24.12112
- Task: follow the runbook written before any Vega build had run
- Steps: build, run, logs, key input
- Expected: names and commands as in the docs
- Actual: vpkg is `vega_aarch64.vpkg`; `build-kepler` forwards to `build-vega`; the build edits `manifest.toml` (`needs.module` per library) and writes `buildinfo.json`; `loggingctl` has no `--no-pager`; key input via `inputd-cli button_press KEY_*` is not in the run-apps doc
- Severity: minor
- Workaround: runbook updated (`docs/vega-mac.md`)
- Suggestion: document `inputd-cli` and the manifest auto-edit on the run-apps page

## F-18: Vega's React Navigation "7.0.x" ports are v6 underneath
- Task: return from a live answer to the replay on Vega
- Steps: answer screen calls `navigation.popTo('Replay')`; reproduced on the VVD, mapped the red-box frame through the build's source map
- Expected: `@amazon-devices/react-navigation__*` 7.0.x behave like React Navigation 7
- Actual: "undefined is not a function" in Answer.tsx; the packages declare `temporary-alias-for-package` core 6.4.10 / native-stack 6.9.15, so v7 APIs such as `popTo` are missing while the version number says 7
- Severity: major (the TV app crashed after every phone question)
- Workaround: `navigation/popTo.ts` uses `popTo` when present, else `navigate` (v6 pops back to a screen already in the stack)
- Suggestion: version the ports after the upstream major they wrap, or list the missing v7 APIs on the library page
