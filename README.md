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

