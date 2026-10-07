# Product feedback

Answers to the hackathon's five product-feedback questions, tool by tool. Details and workarounds are in `friction-log.md` (entries F-n). Items that need the Vega SDK are marked "pending 10 Oct": the SDK only runs on macOS or Ubuntu, and the Mac mini is available from 10 October, so what is written for Vega below comes from documentation, type packages and bundling checks, not from a running device.

Questions:
1. Which developer tools, APIs and SDKs did you use and for what?
2. What worked well?
3. What needs work?
4. How was your onboarding experience (zero to hello world)?
5. Would you build with these devices and services again? Yes/No and why.

---

## 1. Vega SDK and React Native for Vega

1. **Used:** the Vega SDK 0.24 documentation, the `@amazon-devices/*` type packages (react-native-kepler, react-native-svg, react-native-qrcode-svg and others) and the Amazon multi-TV sample app as the layout for one codebase shared by Vega, Fire OS and web. On Windows we typechecked against the real type packages and produced a Metro bundle for the Vega platform; `vega build` and the Vega Virtual Device run are pending 10 Oct.
2. **Worked well:** the multi-TV sample shows a clean split (shared screens, a Vega app, an Expo app) that gave us a web preview and a Fire OS fallback for free. Plain React Native code (SVG pitch, Animated, focus handling) moved across platforms with little change. The supported-libraries page made it clear which packages have a Vega version.
3. **Needs work:** no Windows or WSL path, stated only deep in the install docs (F-1). Docs are spread over versioned URLs (0.21 to 0.24) and two trees (`/docs/vega/` and `/docs/vega-api/`), the sample and the blog describe the same layout differently, and there is no compatibility matrix of SDK, React Native version, macOS version and chip (F-2). Library install notes (legacy peer deps, polyfills for QR) are easy to miss. A hosted virtual device would remove the Mac requirement. Real runtime behaviour (key events, focus, Virtual Device launch, M6 chip support): pending 10 Oct.
4. **Onboarding:** zero to hello world on Windows is impossible, so for us it was zero to "typechecks and bundles" after reading several doc trees. Zero to a running Vega app: pending 10 Oct.
5. **Again?** Yes, for the shared-codebase model and the reach of Fire TV, but this answer is provisional until the Vega Virtual Device run on 10 Oct; if it needs more than two fixes we will say so here.

## 2. Fire TV and Fire OS

1. **Used:** Fire TV as the target device family; the Expo/React Native app (`tv/apps/expo`) as the Fire OS build; the web build as the development preview. Plan B device: Fire TV Stick 4K Plus (Fire OS 8). Device runs: pending 10 Oct.
2. **Worked well:** Fire OS being Android means the standard React Native toolchain applies; D-pad navigation maps onto arrow keys in the web preview, so most screens could be checked in a browser at 1920x1080.
3. **Needs work:** it is not obvious which Fire TV devices run Fire OS and which run Vega OS; newer sticks (Stick HD, 4K) run Vega OS, while 4K Plus and 4K Max run Fire OS 8 (RC-2), and this took press articles to find out. A mic on the remote is not available to third-party apps for free-form speech (RC-3), so we moved voice to the phone and Alexa. A device-chooser table on the developer site (OS, SDK, store) would save a purchase mistake.
4. **Onboarding:** web preview in minutes; on-device: pending 10 Oct.
5. **Again?** Yes: a big screen in a shared room is exactly where Courtside makes sense, and Fire TV is a large installed base. Caveat: choose the device from the table above, not from the product name.

## 3. Alexa Skills Kit and the Alexa simulator

1. **Used:** a custom skill (en-US, invocation "court side") with one intent and an `AMAZON.SearchQuery` slot, ASK CLI deployment through `skill-package`, the Alexa simulator for testing, request signature and timestamp verification in our own Lambda function URL endpoint, and `personId` for speaker recognition.
2. **Worked well:** the interaction model and manifest as files in the repository deploy repeatably; the simulator's JSON shows exactly what the endpoint receives, which made the endpoint testable offline with recorded requests; `personId` makes "who asked" a first-class idea.
3. **Needs work:** the one-free-text-slot rule for an intent (`AMAZON.SearchQuery`) only surfaced when we deployed the model, not in editing or local validation (friction log). The simulator sends no `personId`, so the best feature cannot be shown without a physical device with Voice ID set up; we used a spoken-name fallback ("this is Leo"). Skills get 8 seconds, which is short for a model call; an asynchronous answer pattern for custom skills would help. Verification of the request signature in a Lambda is boilerplate everyone repeats; a managed option would help.
4. **Onboarding:** a working hello world was quick once the account was linked; the time went into the interaction-model rules and the endpoint verification, not into the console.
5. **Again?** Yes. Voice from the sofa is the most natural way to ask "why was that offside?", and the skill model fits it. We would build with Voice ID testable in the simulator.

## 4. Amazon Bedrock

1. **Used:** the Converse API from Lambda and from an offline generator: Claude Sonnet 4.6 for pre-generating explanation cards, Claude Haiku 4.5 for live questions and for a judge that checks each card against computed facts, Nova 2 Lite as fallback, through US inference profiles in us-east-1. We measured Nova Lite, Nova Pro, gpt-oss and several frontier models before choosing (`docs/reality.md` RC-8).
2. **Worked well:** one API for all models made comparison and fallback trivial (a list of model ids tried in order). Latency was good: Nova 2 Lite about 1.2 s, Haiku 4.5 about 2.3 s, Sonnet 4.6 about 3.7 s per short answer. Token usage comes back in every response, which made cost tracking exact. Claude Sonnet 4.6 produced correct definitions and score facts; used with computed facts and a judge it gave us checkable output.
3. **Needs work:** model access on a new account was the biggest obstacle. The catalogue and inference-profile list show models the account cannot call: Claude Haiku returned "Model use case details have not been submitted", Sonnet 5 and Opus 5.5, GPT-5.x and GPT-6.x returned AccessDenied "not available for this account", and Nova Premier is listed although end-of-life (F-3, F-4). The use-case form is hard to find and propagation time is unclear. Marketplace billing for third-party models may bypass promotional credits; this is hard to see before you spend. Please show per-account availability in the list calls and offer a self-service request path.
4. **Onboarding:** a first Converse call with a Nova model took minutes; the first call to a Claude model had to wait for the use-case form and its propagation.
5. **Again?** Yes. Having Amazon and third-party models behind one API with fallbacks is why the product can be honest and fast; we would ask for clearer access status.

## 5. AWS CDK, Lambda, API Gateway, DynamoDB, CloudFront and Transcribe

1. **Used:** AWS CDK (TypeScript) with cdk-nag for one stack; Lambda for the HTTP API, the WebSocket handlers and the Alexa endpoint; API Gateway HTTP API and WebSocket API (live push of answers to the TV); DynamoDB with TTL for households, viewers, sessions and rate counters; S3 and CloudFront for the static web build; Transcribe streaming for phone voice questions; AWS Budgets with a monthly cap.
2. **Worked well:** one `cdk deploy` creates everything and redeploys in minutes; cdk-nag forced us to write down a reason for each exception, which doubles as security documentation. DynamoDB TTL and conditional writes covered rate limits and counters without extra services. WebSocket API made the "answer appears on the TV" effect simple. Transcribe streaming accepts our short WAV clips with low latency.
3. **Needs work:** an HTTP API `ANY` route also catches `OPTIONS` and silently breaks the CORS preflight that API Gateway would otherwise answer (F-5). A new account has a Lambda concurrency limit of 10, and Lambda requires 10 unreserved, so reserving concurrency fails at CloudFormation deploy with a message that does not mention the account quota (F-6). Rate-limit and per-source-address data needs manual care; HTTP API supplies the source IP, but this is only visible in the event reference. cdk-nag rules for a small public demo (WAF, access logs) conflict with a tiny budget and need individual suppressions.
4. **Onboarding:** CDK bootstrap and a first deploy were quick. Errors found only at deploy or in a real browser (account quota, CORS) cost more than the initial setup.
5. **Again?** Yes. Serverless with CDK fits a hackathon budget (the whole demo is covered by a USD 20 monthly budget) and scales to zero.

## 6. StatsBomb Open Data

1. **Used:** event data and 360 freeze frames for match 3869685 (World Cup 2022 Final) as the source of moments; a pipeline turns events into curated moments with computed facts (score, zone, concept), never sending raw coordinates to a model.
2. **Worked well:** rich, consistent JSON; 360 frames exist for 83.6 % of events, including all regulation and extra-time goals and every offside-related event (RC-5); the public repository needs no key. Event types map cleanly onto teachable concepts (offside, penalty, cards).
3. **Needs work:** the user agreement restricts redistribution and commercial use, so we fetch data at build time and ship only derived analysis; a clear one-page summary of what may be shipped in an app would help. Naming of fields differs between event types, and some tournament marks (the competition name) must not appear in generated text, so we check for them.
4. **Onboarding:** minutes: clone the repository, read the documentation, run a probe script.
5. **Again?** Yes, with the non-commercial note: it is the best free dataset for explaining a game, and a licensed feed would be needed for a commercial release.
