# Courtside: texts for YouTube and Devpost

Ready to paste. Fire TV track. Replace `https://youtu.be/vB66eTqTEc0` once the video is uploaded.

---

## YouTube

**Title:** Courtside: a Fire TV app that explains soccer to everyone in the room, at their own level

**Description:**

Courtside is a Fire TV app that explains each moment of a real soccer match to everyone in the living room at their own level. It replays the match from open play-by-play data on a 2D pitch; every moment gets a card with up to three layers (basic, intermediate, tactical), and each viewer sees the layer for their level. It remembers which ideas each person has understood, so a beginner is not told what offside is twice, and moves up to Fan once they have learned enough. Anyone can ask a question from their phone (typed or by voice) or through Alexa, and the answer appears on the TV with their name, written at their level.

In this video: the Courtside Vega build running in the Vega Virtual Device (Vega SDK 0.24) on a Mac mini, driven by the remote; three viewers (beginner, fan, expert) joining with a code; the three layers of a card for one goal; questions answered on the TV; a question through the Alexa skill "court side" in the Alexa developer console simulator, answered on the TV "via Alexa"; and a beginner moving up to Fan. Every TV shot is the real app talking to the deployed AWS backend, and every answer is the one Amazon Bedrock returned live. To keep the recording repeatable, the joins and phone questions were sent by a script to the same API the phone page calls, and the Alexa phrases were typed into the simulator. We had no physical Fire TV; the same React Native code also runs on Fire OS and the web.

Data: StatsBomb Open Data (the 2022 final, Argentina vs France). The moment selection, explanations and analysis are ours, not StatsBomb's. The living-room picture is an AI-generated illustration; the narration is an AI voice (Kokoro TTS) and the music is AI-generated.

Video: https://youtu.be/vB66eTqTEc0
Try it: https://d3igz6igrmkgis.cloudfront.net/
Code: https://github.com/Raul99Alejandro/courtside (MIT)

---

## Devpost: basics

**Project name:** Courtside

**Tagline (187 characters):**

A Fire TV app that explains each moment of a real soccer match to everyone in the room at their own level, remembers what each person learned, and answers questions from a phone or Alexa.

---

## Devpost: story

## Inspiration

Watching soccer together is great until half the room doesn't know what offside means. The expert wants to talk about the press, the newcomer wants to know why the goal didn't count. A TV is shared, but understanding isn't: each person needs a different explanation of the same moment, at the same time, on the same screen.

## What it does

**Try it, nothing to install:** open [the TV app](https://d3igz6igrmkgis.cloudfront.net/tv/) on a laptop (arrow keys and Enter act as the remote), scan the QR code with your phone, pick a level and ask "why was that offside?".

Courtside replays a real match (the 2022 final, Argentina vs France) from open play-by-play data on a 2D pitch: every dot is where a player actually stood. For each of 37 curated moments there is a card with up to three layers: basic for beginners, intermediate for fans, tactical for experts. Up to three viewers watch at once, and the card shows one row per layer the room needs, each labelled with who it is for.

- **It remembers.** A concept counts as understood when a viewer presses "Got it", or after its basic explanation was shown to them twice without them asking about it. Understood concepts are not explained again. Once a beginner has understood five concepts, the TV announces "Leo moved up to Fan"; the viewer can undo it.
- **Three ways to ask.** The D-pad's "Why?" answers at the easiest level in the room. A phone, paired by a six-character code or QR, asks by voice (transcribed by Amazon Transcribe in our AWS account) or by typing. The Alexa custom skill "court side" takes "this is Maya, why was Messi's goal not offside?". Every answer appears on the TV within seconds, labelled with who asked and how, and written at their level.
- **No accounts.** Viewers are first names chosen by the household; the code is the only secret.

## How we built it

- **One React Native codebase** in the layout of Amazon's multi-TV sample: shared screens, a Vega OS app, an Expo app for Fire OS, and a web export. We ran it in the Vega Virtual Device (SDK 0.24.12112) on a Mac mini; the web build is the hosted demo.
- **A pure domain core** (TypeScript, no I/O) shared by the TV app, the phone page and the backend.
- **Domain rules as tests.** Nine rules, R-01 to R-09 (who sees which layer, when a concept counts as understood, what a card may say), live in YAML with concrete examples approved by the product owner. One test file runs every approved example against the real code; change a rule and the tests change with it.
- **An honesty pipeline.** StatsBomb events become moments with computed facts: minute and phase, score before and after, the effect on the score, a named pitch zone, the concept to teach, the 360 freeze frame where it matters. Models never see raw coordinates. Jargon is defined from a fixed catalogue based on the IFAB Laws of the Game. **Claude Sonnet 4.6** writes the cards offline; deterministic checks enforce word limits, defined jargon, no coordinates and no tournament marks; **Amazon Nova Pro** then judges each layer and rejects any number or claim not in the computed facts. A failing card is regenerated with the problems listed, up to three times.
- **Live answers:** **Claude Haiku 4.5** on Amazon Bedrock, given the same computed facts and definitions, with Nova 2 Lite as fallback. We chose each model by measurement: Nova Pro agreed with Haiku on 60 of 60 judge verdicts, including 20 deliberately corrupted lines, while for live answers a blind comparison favoured Haiku.
- **Serverless backend** with AWS CDK: Lambda behind API Gateway (HTTP API, plus a WebSocket API that pushes answers to the TV), DynamoDB with TTL, CloudFront and S3, and a Lambda function URL for Alexa that verifies request signatures.
- **Cost caps and privacy:** 300 characters per question, 30 questions per hour per household, service-wide hourly and daily caps, throttled APIs, an AWS Budget. Audio is not stored, answers expire after an hour, and access logs are off so caller addresses are not kept.
- 243 automated tests in the root project, plus the TV app's own.

## Challenges we ran into

- **No Windows path for Vega.** We wrote the Vega app blind (type packages, Metro bundles) and first ran it when a Mac mini arrived.
- **The first Vega build broke in ways the web never showed:** the Vega CLI silently replaced our Metro resolver, a focus library shipped React 19 elements to Vega's React 18, Vega's "7.0" React Navigation ports are v6 underneath (the TV crashed after every phone question), and its SVG port left old player names on the pitch. Each is fixed and logged.
- **Models invent soccer facts.** Early drafts said Messi's 107th-minute goal "ties the match". Computing the facts first, then judging against them, fixed that class of error.
- **Alexa's simulator sends no voice identity**, so we added a spoken name ("this is Leo").

## Accomplishments that we're proud of

- Three viewers, three explanations, one screen, without anyone being talked down to or lost.
- The model never decides a fact: code computes them, a second model checks them.
- Product rules that are executable tests, not a document nobody reads.

## What we learned

- Language models are good writers and poor witnesses: give them facts, then check the output against those facts.
- Choose models per job by measuring: the best writer, the fastest answerer and the strictest judge were three different models.
- Test on the real device early; most of our Vega bugs were invisible on the web.

## What's next

- Run the judge on live answers too: today they are checked only by a word limit.
- Reconnect the TV's live link on its own after a long idle.
- Voice ID on a real Echo device, more matches, and a licensed data feed for a commercial Appstore release.

---

## Built with

React Native, TypeScript, Vega SDK (Vega OS), Vega Virtual Device, Expo (Fire OS), react-native-svg, react-tv-space-navigation, Amazon Bedrock, Claude Sonnet 4.6, Claude Haiku 4.5, Amazon Nova Pro, Amazon Nova 2 Lite, Amazon Transcribe, AWS Lambda, Amazon API Gateway (HTTP and WebSocket), Amazon DynamoDB, Amazon CloudFront, Amazon S3, AWS CDK, cdk-nag, AWS Budgets, Alexa Skills Kit, ASK CLI, Vite, Vitest, StatsBomb Open Data

## Try it out links

- Hosted TV app (the full app built for the web; arrow keys and Enter): https://d3igz6igrmkgis.cloudfront.net/tv/
- Landing page (TV app and phone page): https://d3igz6igrmkgis.cloudfront.net/
- Code (MIT): https://github.com/Raul99Alejandro/courtside
- Video: https://youtu.be/vB66eTqTEc0

---

## Additional info (for judges and organizers)

### AWS Builder: which AWS services and how

Courtside's backend runs on AWS in us-east-1, deployed as one AWS CDK stack (`infra/lib/stack.ts`).

- **Amazon Bedrock (Converse API):** Claude Sonnet 4.6 writes the explanation cards offline from computed match facts; Amazon Nova Pro judges every card layer against those facts (Nova 2 Lite as its fallback); Claude Haiku 4.5 answers live questions from the phone and Alexa (Nova 2 Lite as fallback). The live model chain is a CDK context value, so it can be switched without code changes.
- **Amazon Transcribe (streaming):** turns a phone's short voice clip into text in our own account; the audio is not stored.
- **AWS Lambda + Amazon API Gateway HTTP API:** households, viewers, pairing, questions and learning state, throttled to 10 requests per second.
- **API Gateway WebSocket API + Lambda:** pushes each answer to the TV, labelled with who asked and whether it came from the phone or Alexa.
- **Lambda function URL:** the Alexa skill endpoint, with request signature and timestamp verification.
- **Amazon DynamoDB:** households, viewers, sessions and rate-limit counters, with conditional writes and TTL so nothing lingers.
- **Amazon CloudFront + Amazon S3:** the landing page, the phone page and the TV app's web build.
- **AWS Budgets:** a USD 20 monthly budget guards the account; per-household and service-wide caps bound model spend.
- **AWS CDK + cdk-nag:** every cdk-nag suppression carries a written reason.

### Open Source

- Project repository URL: https://github.com/Raul99Alejandro/courtside
- GitHub username: Raul99Alejandro
- Description: Courtside is a new open-source project (MIT), built for this hackathon. Useful pieces for other Fire TV and Vega developers: a working example of one React Native codebase for Vega OS, Fire OS and the web based on Amazon's multi-TV sample; a Babel plugin that restores import aliases the Vega CLI build drops (`tv/apps/vega/babel-plugin-aliases.js`); workarounds for the Vega React Navigation and react-native-svg ports; a pattern for turning approved domain rules (YAML with examples) into tests; and a generate-then-judge pipeline that keeps model-written explanations tied to computed facts. The match data is not redistributed: it is fetched from StatsBomb's repository at build time.

### Feature requests

- Critical: a Vega development path on Windows (a hosted Vega Virtual Device, or WSL2 guidance). Today the SDK needs macOS or Ubuntu, so a Windows developer cannot run a Vega app at all.
- Important: the Alexa simulator should send a configurable personId, so skills that answer "who asked" can be tested without a physical device with Voice ID.
- Important: Vega library ports should match the upstream major they claim (the React Navigation "7.0.x" ports are v6), or list the missing APIs.
- Important: a single Vega compatibility matrix (SDK, React Native line, library versions, macOS and chip) and a "latest" alias per docs page.
- Nice-to-have: a supported `vega virtual-device screenshot` / `record` command, and uncaught render errors named in the device log.

### Friction log (summary; full log with 20 entries in the repo)

Full log: https://github.com/Raul99Alejandro/courtside/blob/main/friction-log.md

1. **Vega CLI build (F-12).** Task: build the Vega app with shared monorepo code. Expected: the build uses the project's Metro resolver. Actual: "Unable to resolve module"; the CLI merges its own resolveRequest over the project's with no warning, while a direct Metro bundle passed. Severity: blocker. Workaround: a Babel plugin rewrites imports before resolution. Suggestion: chain to the project's resolver, or warn when it is overridden.
2. **Focus library on Vega (F-13, F-14).** Task: launch the first build in the Vega Virtual Device. Expected: a red box or a JS error in the log. Actual: back on the launcher after 16 s with "AppNotResponding"; only a temporary error boundary showed that react-tv-space-navigation 6 beta inlines React 19 elements that Vega's React 18 rejects. Severity: blocker. Workaround: pin 5.2.0 on Vega. Suggestion: log render errors to loggingctl and list version ranges per React line on the focus page.
3. **Vega React Navigation ports (F-18).** Task: return from an answer to the replay. Expected: the "7.0.x" ports behave like React Navigation 7. Actual: popTo is undefined (they are v6 underneath); the TV crashed after every phone question. Severity: major. Workaround: use popTo when present, else navigate. Suggestion: version the ports after the upstream major.
4. **Vega react-native-svg (F-19).** Task: step through moments on the SVG pitch. Expected: each moment draws only its own names and arrows. Actual: removed children stayed on screen and piled up (web and Fire OS were correct). Severity: major. Workaround: a key per moment remounts the drawing. Suggestion: fix child removal in the port.
5. **Bedrock model access (F-3, F-4).** Task: compare models via Converse. Expected: listed models are invocable, or the listing says they are not. Actual: Claude Haiku needed an undiscoverable use-case form; several listed frontier models returned "not available for this account". Severity: major. Workaround: Nova meanwhile, then the form. Suggestion: show per-account availability in the list calls and a self-service request path.

### Feedback Q1: tools, APIs and SDKs used, and for what

- Vega SDK 0.24 (Vega CLI, Vega Virtual Device, `@amazon-devices/*` packages for SVG, QR codes and navigation): the Vega OS build of the TV app, run and recorded in the Vega Virtual Device on a Mac mini.
- Amazon's react-native-multi-tv-app-sample: the layout for one codebase across Vega OS, Fire OS (Expo) and the web.
- Alexa Skills Kit, ASK CLI and the Alexa developer console simulator: the custom skill "court side" (one intent with an AMAZON.SearchQuery slot), deployed from files in the repository.
- Amazon Bedrock (Converse): Claude Sonnet 4.6 for cards, Amazon Nova Pro as the judge, Claude Haiku 4.5 for live answers, Nova 2 Lite as fallback.
- Amazon Transcribe streaming: phone voice questions.
- AWS CDK, Lambda, API Gateway (HTTP and WebSocket), DynamoDB, CloudFront, S3, AWS Budgets: backend, live push to the TV, hosting and cost guard.
- StatsBomb Open Data: events and 360 freeze frames for the match.

### Feedback Q2: what worked well

- Vega Virtual Device: it booted first try on an Apple M6, newer than the documented M1 to M4, and remote keys can be sent from the CLI (`inputd-cli button_press`), which let us script the demo recording.
- The multi-TV sample: plain React Native (SVG pitch, Animated, spatial focus) moved across Vega, Fire OS and the web with few changes, and the web build gave us a hosted demo for free.
- Bedrock: one API for Claude and Nova made measuring models and chaining fallbacks trivial; token usage in every response made cost tracking exact.
- API Gateway WebSocket made "the answer appears on the TV" simple; DynamoDB TTL and conditional writes covered rate limits without extra services.
- Alexa: the interaction model as files deploys repeatably, and the simulator's JSON made the endpoint testable offline with recorded requests.

### Feedback Q3: what needs work

- Vega: no Windows path (F-1); docs spread over versioned URLs and two trees (F-2, F-9); the CLI build drops the project's Metro resolver (F-12); render errors appear only as "AppNotResponding" (F-13); the React Navigation and SVG ports behave differently from what their versions suggest (F-18, F-19); the screenshot tools hang and take the device shell down (F-15); the app's live link did not recover after a long idle (F-20, which we still have to fix on our side too).
- Fire TV: it is not obvious which devices run Fire OS and which run Vega OS; we learned it from press articles. The remote's microphone is not available for free-form speech, so voice moved to the phone and Alexa.
- Alexa: the one-free-text-slot rule appears only at deploy (F-7); the simulator sends no personId (F-8); 8 seconds is short for a model call.
- Bedrock: listed models the account cannot call, behind a hard-to-find form (F-3, F-4).
- API Gateway: an HTTP API `ANY` route silently breaks the CORS preflight (F-5). Lambda: reserved concurrency fails mid-deploy on a new account's quota of 10 (F-6).

### Feedback Q4: onboarding

- Web preview of the TV app: minutes, thanks to the multi-TV sample.
- Vega: on Windows, zero to "typechecks and bundles" only. On a fresh Mac, the SDK and the Vega Virtual Device were running within an afternoon after installing Homebrew, Node and Rosetta (more than the install page lists, F-16); getting our real app to run took several fixes (F-12 to F-14).
- Alexa: hello world was quick; the time went into interaction-model rules and request verification.
- Bedrock: a first Nova call took minutes; Claude had to wait for the use-case form.
- CDK: bootstrap and first deploy were quick; errors found only at deploy or in a browser (quota, CORS) cost more.
- StatsBomb Open Data: minutes; clone, read the docs, probe.

### Feedback Q5: would you build with these again?

Yes. A big screen in a shared room is exactly where per-viewer explanations make sense, and one React Native codebase reaches Vega OS, Fire OS and the web. Vega took more fixes than we hoped (a build resolver, a focus library, two library ports), but the Vega Virtual Device ran the app faithfully once they were in, and each fix is documented. Bedrock let us pick the right model for each job and keep a fallback, and the serverless backend fits a USD 20 monthly budget. We would ask for a Windows path to Vega and a simulator that can send a voice identity.
