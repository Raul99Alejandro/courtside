# Alexa console take 4 (Windows PC, 21 Oct UTC)

`alexa-console-take4.mp4`: 70 s, 1376x960, no audio. Same setup as the earlier takes (Alexa developer console,
skill "court side", Test tab, Development, en-US, debug bar cropped). Phrases were typed, not spoken.
Backend and Vega app at 539565a, so the TV labels the answer "via Alexa".
TV: household H59FVJ (Leo, Maya, Sam) on "Messi scores" (107', 3-2), recorded on the Mac 03:09:25 to 03:39:25 UTC.

Take second 0 = 03:15:29 UTC (plus or minus 1 s).

| Take s | UTC (approx.) | Event |
|---|---|---|
| 0 to 10 | 03:15:29 | Previous conversation (take 3) still on screen while the page reloads |
| about 12 to 15 | 03:15:41 | Empty simulator |
| about 16 to 22 | 03:15:45 | "open court side" sent, welcome reply |
| about 23 to 26 | 03:15:52 | "link household H59FVJ" sent, "Linked..." reply |
| about 28 | 03:15:57 | "this is Maya, why was Messi's goal not offside" sent (typing dots at 29 s) |
| 31.5 | 03:16:00.5 | Backend stored the answer (label Maya, via alexa); "It's on your TV, Maya." on screen by 33 s |

Use the take from about 12 s on. Answer text (correct this time): "Messi wasn't in an offside position when he shot,
so the goal counted. You need at least two opposing players between you and the goal line when the ball is played
to you for it to be onside, and Messi had that."
