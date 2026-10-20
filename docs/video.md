# Demo video

Version 3 (20 Oct), after the review from the PC: whole VVD window, StatsBomb logo, AI disclosure, new line 07,
card zoom, "Claude + Nova", and a new Alexa scene. Section 5 is the rules check.

## 1. The file

| | |
|---|---|
| File | `courtside-demo.mp4` |
| Duration | 2:19.7 (139.7 s) |
| Video | H.264, 1920×1080, 30 fps |
| Audio | AAC, 48 kHz, mono, integrated loudness −17.1 LUFS |
| Where | Drive folder "Courtside – video demo (hackathon)" as a loose `courtside-demo.mp4`; on the Mac in `~/Desktop/courtside-video/` |

`courtside-entrega.zip` in the same Drive folder is the **previous** version (v2, 1:57) with its inputs; it was not rebuilt.

### Inputs of this version

| Input | What it is |
|---|---|
| `tv-master.mov` (Mac) | Master take, whole VVD window 1160×568, household 2YNW4C, recorded from 19:54 UTC: joins, remote, cards, Leo's and Sam's questions, level-up |
| `moments_cfr.mp4` (Mac) | Right on the remote through moments 2' to 36' (TV picture only) |
| `tv-alexa.mov` (Mac) | VVD window during the Alexa take, 22:56:57 to 23:26:57 UTC |
| `video/alexa-console-take2.mp4` (repo) | Alexa developer console, recorded on the Windows PC; second 0 = 23:03:13 UTC; times in `video/alexa-console-take2.md` |
| `vo/vo_01.wav` … `vo_13.wav` | Narration (Kokoro-82M, `am_michael`); 07 regenerated, 13 new |
| `musica.wav` | Music (MiniMax-Music3), looped 5× with 3 s crossfades |
| `build/logo/hudl-statsbomb-logo-white.png` | Official logo, Hudl StatsBomb media pack (`statsbomb.com/media-pack` → `hudl.bynder.com`, collection "Hudl Statsbomb Logos", asset "hudl-statsbomb-logo-white", Usage Rights "External Use Approved"), 2258×344 PNG |
| `phone/*.jpg` | Screenshots of the deployed phone page; "Join the room" shows 2YNW4C |

`video/alexa-console-take.mp4` (take 1) is not used: the TV did not show the answer during that take (section 4).

### How it was rendered

On the Mac mini, locally:

- Screen takes: macOS `screencapture -v -R100,100,1160,568` of the whole VVD window, driven by `inputd-cli button_press KEY_*` and the Courtside HTTP API (joins, phone questions, got-it). The TV picture is cut out of the window (`crop=962:540:0:28`) for the TV scenes.
- Takes converted to constant frame rate: `ffmpeg -i take.mov -fps_mode cfr -r 30 …`.
- Alexa split screen: `build/alexa.py` lines up the console clip and the VVD recording by UTC (console 17.0 s, VVD 23:03:30 UTC) and puts the console chat column (crop 440×740) next to the VVD window.
- Graphics: Pillow 12.3 (`graphics.py`); edit: ffmpeg 7.1 (`build.py`): segments, 80 % TV frame with badge, the window-to-TV zoom (`zoompan`, eased, 1 s), captions while each line plays, narration placed with `adelay`, music ducked with `sidechaincompress`, `loudnorm=I=-16`.

```bash
cd ~/Desktop/courtside-video
~/ia-local/.venv/bin/python -I build/graphics.py
~/ia-local/.venv/bin/python -I build/alexa.py ~/Repos/courtside/video/alexa-console-take2.mp4 2026-10-20T23:03:13+00:00 \
    build/alexa_vvd_part.mp4 2026-10-20T23:03:17.409+00:00 2026-10-20T23:03:30+00:00 17
~/ia-local/.venv/bin/python -I build/build.py      # writes courtside-demo.mp4
```

## 2. Scenes

Times are in the final cut. "Master" times are seconds in the master take (30 fps copy).

| # | Start–end (s) | What is on screen | Narration (starts at) | Source |
|---|---|---|---|---|
| 1 | 0.0–4.5 | Title card: scarves, "Courtside", tagline, chip "Fire TV · Vega OS" | none | `title.png` |
| 2 | 4.5–11.5 | Living room from behind the sofa; label "AI-generated illustration" top left | 01 (4.8): "Watching soccer together is great, until half the room doesn't know what offside means." | `sala.png` (Z-Image) + `ai_label.png` |
| 3 | 11.5–23.5 | **Whole VVD window** (title bar "Vega Virtual Device", remote panel) for 3.2 s, 1 s zoom onto the TV picture; "Nobody here yet", then Leo joins; code 2YNW4C | 02 (11.8): "Courtside is a Fire TV app that explains every moment of a real match to each person in the room, at their own level." | Master 0.0–12.0 |
| 4 | 23.5–32.8 | "Join from your phone": TV still with Leo, Maya, Sam next to two phone screens (Join the room 2YNW4C; Who are you?) | 03 (23.8): "Everyone scans the code with their phone and picks a level: beginner, fan, or expert. No accounts, nothing to install." | `phones_join.png` |
| 5 | 32.8–38.8 | TV: focus moves across Leo, Maya, Sam | 04 (33.1): "From there, it's all on the TV, driven by the remote." | Master 25.5–31.5 |
| 6 | 38.8–48.3 | Replay at 4× through real moments 2' to 35', score changing | 12 (39.1): "Courtside replays real matches from open play-by-play data. Every dot is where a player actually stood in the 2022 final, moment by moment, goal by goal." | Moments 0–38, 4× |
| 7 | 48.3–52.1 | Di María scores, 2–0 | (12 continues) | Moments 37.0–40.8 |
| 8 | 52.1–57.1 | Messi scores at 107', 3–2, three layers | 05 (52.4): "This is Messi's goal in extra time of the 2022 final. Leo, a beginner, learns what a goal is. Maya, a fan, gets the context. Sam, the expert, gets the tactics." | Master 44.5–49.5 |
| 9 | 57.1–66.1 | Card zoom: starts with Leo's block whole, pans down, ends on Sam's | (05 continues) | Master 64.5–73.5 |
| 10 | 66.1–75.9 | "How the AI stays honest" | 06 (66.4): "Every card is built from computed match facts and checked by a second model, so the AI never invents a score or a player." | `honesty.png` |
| 11 | 75.9–79.9 | "Ask from your phone, by typing or by voice": TV answer still + phone ask screen | 07 (76.2): "Anyone can ask a question from their phone, by typing or by voice. Leo asks why the goal counted. The answer appears on the TV, with his name, at his level." | `phones_ask.png` |
| 12 | 79.9–87.4 | TV: "Leo asked from their phone", basic answer | (07 continues) | Master 81.0–88.5 |
| 13 | 87.4–93.4 | TV: "Sam asked", tactical answer (last 2 s frozen) | 08 (87.7): "Sam asks why France couldn't stop Messi, and gets a tactical answer." | Master 99.0–103.0 + hold |
| 14 | 93.4–110.4 | **Alexa split screen.** Left: console chat (open court side → link household two y n w four c → "Linked…" → "this is maya why was messi's goal not offside" → "It's on your TV, Maya."). Right: VVD window on "Messi scores"; at 105.0 the TV switches to "Maya asked … why was messi's goal not offside", intermediate answer | 13 (98.4): "Or ask Alexa from across the room. The answer lands on the TV, labelled with who asked, at their level." | Console take 2, 17.0–34.0 s (23:03:30–23:03:47 UTC) + `tv-alexa.mov` 392.6–409.6 s; answer on the TV at 23:03:41.6 UTC |
| 15 | 110.4–118.9 | Replay with the toast "Leo moved up to Fan" (frozen on the toast) | 09 (110.7): "Courtside remembers what each person has understood. When Leo has learned enough, he moves up to Fan." | Master 113.5–116.0 + hold |
| 16 | 118.9–131.7 | "One codebase. Built on AWS.": Vega OS, Fire OS, Web; Bedrock (Claude + Nova), Transcribe, API Gateway + Lambda, DynamoDB, Alexa skill (simulator) | 10 (119.2): "One React Native codebase runs on Vega OS, Fire OS and the web, backed by AWS: Amazon Bedrock, Transcribe, Lambda and DynamoDB." | `tech.png` |
| 17 | 131.7–139.7 | End card: "Courtside", tagline, "Shown running on the Vega Virtual Device (Vega SDK 0.24).", repo, "Data: StatsBomb Open Data" + **StatsBomb logo** + "Analysis is ours, not StatsBomb's.", "Narration: AI voice (Kokoro TTS). Music: AI-generated." | 11 (132.0): "Courtside. Everyone in the room, in the game." | `end.png` |

TV scenes carry the badge "Running on Vega Virtual Device" and sit in an 80 % frame; narration captions run below. One frame per scene: `docs/video-frames/scene-NN-SSS.Ss.png` (1280 px). Scene 9's frame is mid-pan, so its top line is cut on purpose.

## 3. What is real and what is not

Real:

- **The app on Vega.** Every TV shot is the Courtside Vega build running in the Vega Virtual Device (SDK 0.24.12112) on the Mac mini, recorded from the screen; scene 3 and the Alexa scene show the whole simulator window. Only cropping, scaling, a 4× speed-up (scene 6) and freeze frames (13, 15) were applied.
- **Alexa.** Scene 14 is a real run: the phrases were typed into the Alexa developer console (skill "court side", Test, en-US, Development) on the Windows PC, and the skill pushed Maya's answer through the AWS backend to the TV. The two screens were recorded on two machines and lined up by UTC; the console shows "It's on your TV, Maya." and the TV switches at 23:03:41.6 UTC, the same second the backend logged the answer.
- **The backend.** Household 2YNW4C, viewers, Leo's and Sam's questions, Maya's Alexa question and Leo's promotion went through the deployed AWS API; answers are the ones Bedrock returned live.
- **The match data.** StatsBomb Open Data, match 3869685 (2022 final); cards from the committed `cards/cards-3869685.json`.

Staged or generated:

- **Joins, phone questions and the promotion were sent by a script** to the same endpoints the phone page calls, not by tapping a phone. "Who are you?" and the ask screen are screenshots from an earlier take (no code visible); "Join the room" shows 2YNW4C.
- **No question in the video is spoken**: the phone question is typed; the Alexa phrases were typed in the console. The narration says phones can ask "by typing or by voice" (both exist), and for Alexa it does not say "voice".
- **Generated:** the living-room image (labelled), the narration voice and the music (both disclosed on the end card), and every card, caption and badge.
- **Not shown:** the Fire OS build (only listed).

## 4. App issues found while recording

- **The TV labels Alexa answers "from their phone".** In scene 14 the TV shows "Maya asked · from their phone" although the question came from Alexa; the answer screen has one fixed label. Not changed in the video.
- **The Vega app does not recover its live link after a long idle.** With the app open about 3 hours, answers stopped reaching the TV: Alexa take 1 (22:40 and 22:44 UTC) and a direct API question got answers in the backend but the TV stayed on the replay. Relaunching the app fixed it; take 2 was recorded right after. Friction log F-20.
- Fixed earlier (in `main`): crash after every phone question (`popTo`, F-18) and pitch labels piling up (Vega `react-native-svg`, F-19).

## 5. Review against the rules

| Rule | Result | Evidence |
|---|---|---|
| Shorter than 3 minutes | **Pass** | 2:19.7 |
| Shows the Vega simulator or a Fire TV | **Pass** | Scene 3 opens on the whole Vega Virtual Device window (title bar, remote panel) before zooming in; scene 14 shows the whole window again next to the Alexa console. |
| No copyrighted broadcast material | **Pass, with a note** | No match footage, broadcaster graphics, FIFA or "World Cup" marks; music generated. Scene 2's generated TV shows a blurred bar at the top that reads like a score bug, with no legible logo; it is labelled "AI-generated illustration". |
| StatsBomb logo appears | **Pass** | Official white logo next to "Data: StatsBomb Open Data" on the end card (scene 17), from the Hudl StatsBomb media pack, "External Use Approved"; the open-data licence (§1.4) asks for it. |
| The voice says it is AI | **Pass (on screen)** | End card: "Narration: AI voice (Kokoro TTS). Music: AI-generated."; scene 2 labels the generated picture. The narration itself does not say it is synthetic. |

Other notes: the Alexa scene relies on two clocks (Mac and PC, ±1 s); audio is mono; the line in scene 13's answer ("second period of extra time") is the model's live wording.
