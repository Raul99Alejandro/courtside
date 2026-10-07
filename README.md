# Courtside

Courtside explains a soccer match to everyone in the living room at their own level, on Fire TV.
It replays real matches from open play-by-play data on a 2D pitch, explains each moment in layers
(basic / intermediate / tactical) per viewer, remembers what each viewer already understood, and lets
anyone ask a question by voice from their phone.

Status: in development for the Amazon "Build, Ship, Shape" hackathon (Fire TV track).

## Data

Data: StatsBomb Open Data — https://github.com/statsbomb/open-data

The match data is StatsBomb's; the moment selection, explanations and analysis are ours. This is a non-commercial hackathon project.

## Deploy

```
npm run web:build
npm run cdk -- deploy -c ownerEmail=<email> --outputs-file cdk-outputs.json
node scripts/smoke.mjs
```


## Alexa

Skill "court side" (en-US, development stage, tested in the Alexa simulator). Say "link household" and the six character code from the TV once, then "ask court side why was that offside". The answer appears on the TV, labelled with who asked and written at their level. A recognised voice (personId) is answered as its linked viewer ("I am Leo"); the simulator has no voices, so "this is Leo, why was that offside" names the viewer instead; anyone else is Guest, answered at the easiest level in the room.

Trust model: the household code is the only secret. Everyone who has it, on the phone page or on Alexa, may choose any viewer name in the household, including by saying it. Failed links are limited to 5 per Alexa account per hour, and wrong household codes on the phone path to 20 per hour per source address (then HTTP 429 for that address only; the address is kept only as a salted hash for an hour), with a 5000 per hour backstop for the whole service. Alexa gives a skill 8 seconds; if the answer takes longer Alexa says so, but the answer can still arrive on the TV afterwards.
