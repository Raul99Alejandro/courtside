# Demo video

Status: draft for review (19 Oct). Nothing below has been changed in the video yet; section 5 lists what fails.

## 1. The file

| | |
|---|---|
| File | `courtside-demo.mp4` |
| Duration | 1:57.4 (117.4 s) |
| Video | H.264, 1920×1080, 30 fps, about 1.1 Mbit/s |
| Audio | AAC, 48 kHz, mono, integrated loudness −17.2 LUFS |
| Size | 19,663,301 bytes |
| Where | Drive folder "Courtside – video demo (hackathon)", inside `courtside-entrega.zip` → `1-video-final/`; on the Mac in `~/Desktop/courtside-video/` |

### What `courtside-entrega.zip` contains

It holds the final video **and** every input used to build it (46 files, 33,010,879 bytes, identical to the Mac copy).

| Folder / file | Duration or size | What it is |
|---|---|---|
| `1-video-final/courtside-demo.mp4` | 117.4 s, 1920×1080 | The final cut |
| `2-tomas-vvd/toma-maestra.mov` | 160.0 s container, picture ends at 118.9 s; 962×540 | Master take: screen recording of the TV area of the Vega Virtual Device (join, remote, cards, two questions, level-up) |
| `2-tomas-vvd/toma-jugadas.mov` | 45.0 s, 962×540 | Second take: Right on the remote through moments 2' to 36' |
| `2-tomas-vvd/captura-vvd.png` | 1160×568 | Full VVD window (app plus remote panel), first run |
| `3-narracion/vo_01.wav` … `vo_12.wav` | 6.3, 8.4, 8.6, 4.2, 13.1, 9.1, 10.1, 5.2, 7.5, 12.1, 3.3, 12.3 s | Narration, one file per line |
| `3-narracion/guion.txt` | 12 lines | Narration text (`twenty twenty-two`, `A. W. S.` written for the voice) |
| `4-musica/musica.wav` | 29.3 s | Music; the video loops it 5× with 3 s crossfades |
| `5-graficos/*.png` | 1920×1080 (sala 1920×1088) | Title, living room, honesty, tech, end cards, phone composites, 12 caption overlays, Vega badge, TV frame background |
| `6-telefono/1-join.jpg`, `2-pick.jpg`, `3-ask.jpg` | 750×1624, 750×1624, 375×812 | Screenshots of the deployed phone page |
| `6-telefono/tv-who.png`, `tv-answer.png` | 962×540 | Stills from the master take used in the phone composites |
| `7-scripts/graphics.py`, `build.py` | | The scripts that draw the graphics and edit the video |

### How it was rendered

All on the Mac mini (M6), locally, no cloud services:

- Screen takes: macOS `screencapture -v -R100,128,962,540` over the VVD window while a script drove the app with `vega exec vda shell inputd-cli button_press KEY_*` and called the Courtside HTTP API (`POST /households/{code}/viewers`, `/questions`, `/viewers/{name}/got-it`).
- Takes converted to constant frame rate: `ffmpeg -i toma.mov -fps_mode cfr -r 30 -c:v libx264 -crf 10 …` (the screen recordings are variable frame rate).
- Narration: Kokoro-82M (`mlx-community/Kokoro-82M-bf16`, voice `am_michael`) through `mlx_audio.tts.generate`.
- Music: MiniMax-Music3 (`mlx-community/MiniMax-Music3-4bit`), instrumental.
- Living-room image: Z-Image Turbo (local).
- Graphics: Pillow 12.3 (`graphics.py`), fonts Avenir Next / Avenir Next Condensed.
- Edit: ffmpeg 7.1 (the `~/ia-local/.venv` build, which has drawtext and libass), `build.py`: cuts and scales each segment, puts the TV picture in an 80 % frame with the badge, concatenates, overlays captions while each line plays, places the narration with `adelay`, ducks the music under it with `sidechaincompress`, normalises with `loudnorm=I=-16`.

```bash
cd ~/Desktop/courtside-video
~/ia-local/.venv/bin/python -I build/graphics.py
~/ia-local/.venv/bin/python -I build/build.py      # writes courtside-demo.mp4 in about 15 s
```

## 2. Scenes

Times are in the final cut. "Master" times are seconds in the master take after the 30 fps conversion; "Moments" is the second take.

| # | Start–end (s) | What is on screen | Narration (starts at) | Source |
|---|---|---|---|---|
| 1 | 0.0–4.5 | Title card: scarves, "Courtside", "Every person in the room gets the match at their level.", chip "Fire TV · Vega OS" | none (music only) | `title.png` |
| 2 | 4.5–11.5 | Living room from behind the sofa: boy points at the TV, woman, grandfather with a phone; slow zoom | 01 (4.8): "Watching soccer together is great, until half the room doesn't know what offside means." | `sala.png` (generated) |
| 3 | 11.5–20.5 | TV: "Who's watching?", "Nobody here yet", then Leo's card appears as he joins (Maya and Sam join after the cut); QR and code XKJ5WA | 02 (11.8): "Courtside is a Fire TV app that explains every moment of a real match to each person in the room, at their own level." | Master 2.0–11.0 |
| 4 | 20.5–29.8 | "Join from your phone": TV still with Leo, Maya, Sam next to two phone screens (Join the room with XKJ5WA; Who are you?) | 03 (20.8): "Everyone scans the code with their phone and picks a level: beginner, fan, or expert. No accounts, nothing to install." | `phones_join.png` |
| 5 | 29.8–35.8 | TV: focus moves across Leo, Maya, Sam with the remote | 04 (30.0): "From there, it's all on the TV, driven by the remote." | Master 25.0–31.0 |
| 6 | 35.8–45.3 | Replay pitch at 4× through real moments 2' to 35' (De Paul offside, Mac Allister, Tagliafico, Messi penalty 1–0, Mac Allister assist), score changing | 12 (36.0): "Courtside replays real matches from open play-by-play data. Every dot is where a player actually stood in the 2022 final, moment by moment, goal by goal." | Moments 0–38, sped up 4× |
| 7 | 45.3–49.1 | Di María scores, 2–0, normal speed | (12 continues) | Moments 37.0–40.8 |
| 8 | 49.1–53.1 | Messi scores at 107', 3–2, three layers: Leo basic, Maya intermediate, Sam tactical | 05 (49.3): "This is Messi's goal in extra time of the 2022 final. Leo, a beginner, learns what a goal is. Maya, a fan, gets the context. Sam, the expert, gets the tactics." | Master 44.0–48.0 |
| 9 | 53.1–63.1 | Same card, zoomed, panning down from Leo to Sam | (05 continues) | Master 65.0–75.0, crop 440×248 |
| 10 | 63.1–72.9 | "How the AI stays honest": computed facts only, fixed definitions (IFAB), a judge on every card | 06 (63.3): "Every card is built from computed match facts and checked by a second model, so the AI never invents a score or a player." | `honesty.png` |
| 11 | 72.9–76.9 | "Ask from your phone, by voice or text": TV answer still next to the phone ask screen | 07 (73.1): "Anyone can ask a question from their phone, by voice. Leo asks why the goal counted. The answer appears on the TV, with his name, at his level." | `phones_ask.png` |
| 12 | 76.9–83.9 | TV: "Leo asked from their phone", the question and the basic-layer answer | (07 continues) | Master 81.0–88.0 |
| 13 | 83.9–89.9 | TV: "Sam asked", tactical answer (last 2 s frozen) | 08 (84.1): "Sam asks why France couldn't stop Messi, and gets a tactical answer." | Master 100.5–104.5 + hold |
| 14 | 89.9–98.4 | Replay with the toast "Leo moved up to Fan" (frozen on the toast) | 09 (90.1): "Courtside remembers what each person has understood. When Leo has learned enough, he moves up to Fan." | Master 113.3–115.8 + hold |
| 15 | 98.4–110.4 | "One codebase. Built on AWS.": Vega OS (RN 0.72), Fire OS (Expo), Web; Bedrock (Claude), Transcribe, API Gateway + Lambda, DynamoDB, Alexa skill (simulator) | 10 (98.7): "One React Native codebase runs on Vega OS, Fire OS and the web, backed by AWS: Amazon Bedrock, Transcribe, Lambda and DynamoDB." | `tech.png` |
| 16 | 110.4–117.4 | End card: "Courtside", "Everyone in the room, in the game.", "Shown running on the Vega Virtual Device (Vega SDK 0.24).", repo URL, "Data: StatsBomb Open Data. Analysis is ours, not StatsBomb's." | 11 (110.9): "Courtside. Everyone in the room, in the game." | `end.png` |

Every TV scene (3, 5–9, 12–14) carries the badge "Running on Vega Virtual Device" and sits in an 80 % frame; captions of the narration run in the band below. One frame per scene: `docs/video-frames/scene-NN-SSS.Ss.png` (1280 px wide).

## 3. What is real and what is not

Real:

- **The app on Vega.** Every TV shot is the Courtside Vega build (`vega_aarch64.vpkg`, debug) running in the Vega Virtual Device, SDK 0.24.12112, on the Mac mini; recorded from the screen, not re-drawn. Only cropping, scaling, a 4× speed-up (scene 6) and freeze frames (13, 14) were applied.
- **The backend.** Household XKJ5WA, the three viewers, both questions, both answers and Leo's promotion went through the deployed AWS API; the answers on screen are the ones Bedrock returned live during the take.
- **The match data.** StatsBomb Open Data, match 3869685 (2022 final). Scores, minutes, players and positions on the pitch come from it; the cards are the committed `cards/cards-3869685.json`.
- **The phone screens** are screenshots of the deployed phone page (`phone.html`) in a 375×812 browser.

Not real or staged:

- **The joins and questions were sent by a script**, calling the same API endpoints the phone page calls, not by tapping on a phone. The phone screenshots are real pages but are not the ones that sent the requests: "Who are you?" and the ask screen come from the previous take (household X443G2, no code visible on them); "Join the room" shows XKJ5WA.
- **The ask screen shows a typed question**, while the narration says "by voice". Voice questions exist (Transcribe), but none was asked in this video.
- **Generated:** the living-room image (Z-Image Turbo, scene 2), the narration voice (Kokoro-82M), the music (MiniMax-Music3), every card, caption and the badge (Pillow).
- **Not shown:** the Alexa skill (only listed on the tech card) and the Fire OS build (listed, not shown).

## 4. Fixes made to the app while recording

Recording surfaced two Vega-only bugs, both fixed on `main` before the final takes (details in `docs/vega-mac.md` section 7, friction log F-18 and F-19): the app crashed after every phone question (`popTo` missing in the Vega React Navigation ports), and pitch names and arrows piled up between moments (Vega `react-native-svg`).

## 5. Review against the rules

| Rule | Result | Evidence / what to change |
|---|---|---|
| Shorter than 3 minutes | **Pass** | 1:57.4 |
| Shows the Vega simulator or a Fire TV | **Pass, weak** | All TV shots are the VVD, but cropped to the TV picture: the VVD window (title bar "Vega Virtual Device", remote panel) never appears; "Vega" is only claimed by our own badge and the end card. Fix: open or close with a few seconds of the whole VVD window (as in `captura-vvd.png`). |
| No copyrighted broadcast material | **Pass, with a note** | No match footage, broadcaster graphics, FIFA or "World Cup" marks. The generated TV in scene 2 shows a generic pitch with a blurred bar at the top that reads as a broadcast score bug; it contains no legible logo, but could be cropped or regenerated to be safe. Music is generated, no third-party tracks. |
| StatsBomb logo appears | **Fail** | Only the text "Data: StatsBomb Open Data" (in the app and on the end card). The logo is not in the video. `docs/reality.md` RC-4 asks for the logo from the StatsBomb media pack. Fix: add the logo to the end card (and optionally next to the text in scene 6), after checking the media-pack terms. |
| The voice says it is AI | **Fail** | No line, caption or card says the narration is synthetic. Fix: add a spoken and on-screen line, for example at the end: "Narration by an AI voice." or a caption "AI-generated narration (Kokoro TTS)". |

Other notes for the reviewer:

- Scene 13's answer says "second period of extra time"; it is the model's live wording, not edited.
- The tech card names "Amazon Bedrock: Claude"; the README lists Claude Sonnet 4.6 (cards, offline) and Claude Haiku 4.5 (live) with Nova 2 Lite as fallback.
- Audio is mono.
