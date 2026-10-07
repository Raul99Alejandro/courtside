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
