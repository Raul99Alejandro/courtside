# Vega on the Mac mini: 10 Oct runbook

Goal: Courtside running in the Vega Virtual Device (VVD), screenshot and short recording for the demo.
Everything here was prepared on Windows, where the Vega SDK does not exist. What is verified and what is not:

- Verified on Windows: `yarn check:vega` (types against the real `@amazon-devices/*` 0.72 type packages, every import resolves) and a Metro bundle for platform `kepler` (JS side only).
- Never run until today: `vega build`, the manifest, the VVD launch, key events on Vega. Expect a fix or two. Section 8 lists the likely ones.

Versions: Vega SDK 0.24 (RN 0.72 and 0.83 both supported). We use the **RN 0.72 line** (react 18.2.0, react-native 0.72.0, `@amazon-devices/react-native-kepler` ~2.1.0, libraries 2.x, react-navigation ports 7.x) because it is the one the AmazonAppDev sample ships and tests, and 0.83 is early access with known gaps (no `setNativeProps`, no Chrome DevTools).

Docs: install https://developer.amazon.com/docs/vega/0.24/install-vega-sdk.html, run https://developer.amazon.com/docs/vega/0.24/run-apps.html, VVD issues https://developer.amazon.com/docs/vega/0.22/kvd-issues.html, release notes https://developer.amazon.com/docs/vega/0.24/vega-release-notes.html.

## 0. Before sitting down (do on Windows, 2 minutes)

On `main` after the controller merges `vega-wiring`, push. On the Mac you need: the repo, and the two git-ignored inputs the app imports:

- `courtside/build/moments-3869685.json` (generate with `npm run data:build` in `courtside/`, or copy the file from the Windows PC)
- `courtside/cards/cards-3869685.json` is committed.

Success: `ls courtside/build/moments-3869685.json` prints the path on the Mac.

## 1. Prerequisites

```bash
node --version        # 18 or newer (20 LTS is fine)
corepack enable       # Yarn 4.5.0 is pinned in tv/package.json
yarn --version        # 4.5.0
```

Install Homebrew from https://brew.sh if missing, then the SDK's utilities (this also installs Rosetta on Apple Silicon):

```bash
[[ $(arch) == "arm64" ]] && softwareupdate --install-rosetta --agree-to-license; brew update && brew install binutils coreutils gawk findutils grep jq lz4 gnu-sed watchman
```

Success: no errors; `watchman --version` prints a version.

## 2. Install the Vega SDK

Close VS Code first, then:

```bash
curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh | bash && source ~/vega/env
vega --version
```

Accept the default directory (`~/vega/sdk`). Success: `vega --version` prints the active SDK version (0.24.x) and CLI version. Add `source ~/vega/env` to `~/.zshrc` so new terminals have `vega`.

## 3. Start the Virtual Device

```bash
vega virtual-device start            # add --timeout 120 if it is slow to boot
```

Success: a VVD window opens and the command ends with "Virtual device ready". Check with `vega device list` (VirtualDevice:Tv shown as running).

If registration is asked: choose "Register this device" (top right), note the code, enter it at amazon.com/code.

## 4. Install dependencies

```bash
cd courtside/tv
yarn install
```

This pulls `@amazon-devices/*` from the public npm registry (no login needed; checked on 2026-10-06). Peer-dependency warnings are normal (qrcode-svg's doc asks for `legacy-peer-deps` under npm; Yarn does not enforce peers).

Success: finishes with "Done"; `ls apps/vega/node_modules/@amazon-devices` lists kepler, react-native-svg, react-navigation__native and so on.

Quick sanity before building (same checks as on Windows):

```bash
yarn check:vega
```

Success: `vega check: ... 0 problem(s)` and `vega bundle ok`.

## 5. Build

```bash
yarn build:vega:debug        # = react-native build-kepler --build-type Debug inside apps/vega
ls apps/vega/build/*/*.vpkg
```

Success: a `.vpkg` named for your CPU, for example `apps/vega/build/aarch64-debug/CourtsideVega_aarch64.vpkg`. The architecture must match the Mac (aarch64 on Apple Silicon).

## 6. Run in the VVD

```bash
cd apps/vega
vega run-app build/aarch64-debug/<the .vpkg from step 5> com.courtside.tv.vega.main -d VirtualDevice
```

(Use the path `ls` printed; the component id is `com.courtside.tv.vega.main`, from `manifest.toml` and `app.json`.)

Success: the Courtside "Who's watching" screen appears in the VVD, then goes live after a couple of seconds (the app opens the WebSocket in `wsUrl` from `packages/shared/src/config.generated.ts` and the QR code shows the phone join URL). Press the arrow keys (VVD maps them to the remote D-pad) and Enter: focus moves between viewers.

JS reloads while developing: `yarn dev:vega` in `tv/` starts Metro (`react-native start`); reopen the app in the VVD.

## 7. Screenshot, recording, logs

```bash
vega exec vda shell gwsi-tool-screenshooter /tmp/courtside.png
vega exec vda pull /tmp/courtside.png ~/Desktop/courtside.png      # copy off the VVD (see `vega exec vda --help` if pull differs)
vega exec vda shell loggingctl log -o short-precise -f              # live device log; Ctrl+C to stop
```

The docs list no video command for VVD: record the VVD window with macOS Screenshot (Cmd+Shift+5, "Record Selected Portion"). Success: PNG opens at 1920x1080-ish with the app visible.

Stop: `vega virtual-device stop`.

## 8. Troubleshooting (likeliest first)

1. **Metro error "unable to resolve module ..." during build.** The aliases live in `apps/vega/aliases.js` (community name to `@amazon-devices/*` port) and `metro.config.js`. Run `yarn check:vega` for which import fails. If the error is about `react-native` itself, the Vega CLI already redirects it: delete the `'react-native'` line in `aliases.js` (we added it because stock 0.72 is only a placeholder; Metro bundles fine on Windows with it).
2. **`vega package install` or build rejects `manifest.toml`.** We trimmed the sample's media sections (no playback). Generate a fresh manifest in a scratch folder with `vega project generate -t blank` (or `vega project generate --help`), diff its `[wants]/[needs]` against ours and copy the differences. The id must stay `com.courtside.tv.vega` and the component `...main`, equal to `app.json` `name`.
3. **App opens but arrow keys do nothing.** Keys come from `packages/shared/src/app/remote-control/RemoteControlManager.kepler.ts` (`TVEventHandler`, event types `left/right/up/down/select/back`). Run the log command and press a key: the line `[Kepler] Key pressed` should print. If a key arrives with another `eventType`, add it to `EVENT_TYPE_MAPPING`. Fallback: `useTVEventHandler` from `@amazon-devices/react-native-kepler`.
4. **Text looks different (wrong font).** The Expo app loads Barlow Condensed, Atkinson Hyperlegible and Kalam through `expo-font`; the Vega app does not load custom fonts yet, so the system font is used. Layout is the same, glyph widths differ slightly. Bundling fonts on Vega is a follow-up, not a blocker for the screenshot.
5. **Blank screen, red error about `TextEncoder`.** `index.js` imports `fast-text-encoding` first for the QR library; make sure it is installed (`ls apps/vega/node_modules/fast-text-encoding`).
6. **App starts but never goes live.** Check the device log for a network error. The manifest asks for `com.amazon.network.privilege.net-info`; the VVD must have internet (open Safari on the Mac to check). The URLs are public and need no keys.
7. **VVD will not boot or crashes on this Apple Silicon (the Mac is newer than M4; docs name M1 to M4).** Try in order: (a) `vega virtual-device stop && vega virtual-device start --timeout 180`; (b) `vega sdk install` to take the newest SDK/VVD image, then restart; (c) disconnect USB hubs and audio interfaces, close memory-heavy apps (VVD wants more than 2 GB free); (d) release notes for SDK 0.24 say a cluster of Apple Silicon blockers was fixed, so confirm `vega --version` is 0.24 or newer; (e) the Ubuntu x86_64 route (needs KVM) on another machine; (f) a physical Vega device (Fire TV Stick 4K Select) with `vega device list` and `-d <device>` in step 6; (g) plan B below. Take notes of the exact error for the friction log either way.
8. **Anything with the native build (`build-kepler`).** Confirm `node --version` is 18 or newer and that `yarn install` ran in `tv/` (not in `tv/apps/vega`). `yarn workspace @courtside/vega run clean` then `yarn install` resets it.

## 9. Plan B: Fire OS stick with the Expo app

If the VVD does not work by lunch, the demo does not depend on Vega: `apps/expo` already runs the same shared screens on a Fire OS stick (Android-based Fire TV).

1. On the stick: Settings, My Fire TV, About, click the device name seven times; Developer Options, ADB debugging on, Apps from Unknown Sources on. Note its IP under About, Network.
2. On the Mac: install Android Studio (SDK platform-tools) and `adb connect <stick-ip>:5555`; accept the prompt on the TV. Success: `adb devices` lists the stick as `device`.
3. `cd courtside/tv && yarn install && yarn dev:android` (runs `EXPO_TV=1 expo run:android`, builds the APK and installs it). Success: Courtside opens on the TV.
4. Capture: `adb exec-out screencap -p > courtside.png` and `adb shell screenrecord /sdcard/c.mp4` then `adb pull /sdcard/c.mp4`.
5. No stick at hand: `yarn dev:web` and open http://localhost:8082 (Chrome, full-screen, arrow keys and Enter) for a screen recording of the same screens.

Tell the owner which path was used so the promo video says "Fire TV" or "Vega" truthfully.
