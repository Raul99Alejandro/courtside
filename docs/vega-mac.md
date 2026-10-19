# Vega on the Mac mini: what happened on 19 Oct

First real run of `tv/apps/vega/MAC-RUNBOOK.md`. Machine: Mac mini, Apple M6, macOS 27.0.1, 32 GB.
Result: Courtside runs in the Vega Virtual Device (SDK 0.24.12112, Vega CLI 1.4.5), goes live
(household code from the AWS backend, QR shown), D-pad and Enter reach the app. Plan B was not needed.
Screenshot: `~/Desktop/courtside-vega.png`.

Each problem below is also a friction-log entry (F-12 to F-17).

## 1. Fresh Mac: no Homebrew, Node or Rosetta (setup)

The runbook assumed Node was installed. Added: Homebrew installer (owner typed the password),
`brew install node@20` and `brew link --force node@20` together with the SDK utilities,
`sudo softwareupdate --install-rosetta --agree-to-license` (owner typed the password).
The Vega installer asks two questions (component directory, install VS Code extension); Enter
keeps the defaults. It adds `source ~/vega/env` to `.zshrc`, `.zprofile` and `.profile` by itself.

## 2. `build-kepler` ignored our Metro aliases (blocker, fixed)

`yarn build:vega:debug` failed with `Unable to resolve module @react-navigation/native`, although
`yarn check:vega` bundled fine. Cause: the Vega CLI loads `metro.config.js` through
`@react-native-community/cli-plugin-metro` 11.x, whose `loadMetroConfig` merges an override config
*after* ours. When an out-of-tree platform (kepler) exists, that override sets its own
`resolver.resolveRequest` (react-native to react-native-kepler only), so our `resolveRequest` (aliases
plus the `.js` to `.ts` retry for `src/core`) never runs. `check:vega` calls Metro directly and is not
affected, so it gave a false green.

Fix: `tv/apps/vega/babel-plugin-aliases.js`, registered in `babel.config.js`, rewrites import
sources at transform time (same `aliases.js` table, same `src/core` `.js` rule; `react-native` is
left to the CLI). The `resolveRequest` in `metro.config.js` stays for `check:vega`.

## 3. App launched, then killed after 16 s with no JS error in the log (blocker, fixed)

`vega run-app` said "Successfully launched", the VVD stayed on the launcher. Device log:
`Transition timed out ... Creating surfaces`, then `crashed with signal 3` / `AppNotResponding`.
No JS error was logged. A throwaway `index.js` (plain `Text`) rendered fine, and the same entry
with an error boundary around `App` surfaced the red box:
`Objects are not valid as a React child (found: object with keys {$$typeof, type, key, ref, props})`.

Cause: `react-tv-space-navigation@6.0.0-beta1` ships its dist with React 19's JSX runtime inlined
(elements tagged `Symbol.for('react.transitional.element')`). The Vega line is React 18.2, which
does not recognise those elements. Only one copy of `react` was installed; the mismatch is inside
the library's bundle.

Fix: the Vega app pins `react-tv-space-navigation` to `5.2.0` (dist uses `react.element`, and
exports the same `DefaultFocus`, `SpatialNavigationRoot/Node/FocusableView`, `Directions`,
`SpatialNavigation.configureRemoteControl` that shared uses). Expo stays on 6.0.0-beta1 (React 19).

## 4. Screenshot commands in the runbook do not work on this VVD (major, workaround)

- `vega exec vda shell gwsi-tool-screenshooter /tmp/x.png` hung and left a 0-byte file.
- `screenshooter /tmp/x.png` failed: `creating a buffer file for 8294400 B failed: Permission denied`.
- Right after, `vega exec vda shell` answered `No running instances of com.amazon.dev.shell.service`
  and a little later the VVD process was gone (`vega virtual-device status` → `running:false`).
  `vega virtual-device start` brought it back.

Workaround: capture the VVD window from macOS: `screencapture -x -o -l<windowId> file.png`
(needs Screen Recording permission for the terminal/app that runs it, granted by the owner in
System Settings). The window id comes from `CGWindowListCopyWindowInfo` (owner `vega-virtual-device`).
For video: Cmd+Shift+5, "Record Selected Window", click the VVD window.

## 5. Small differences from the runbook (minor)

- The vpkg is `build/aarch64-debug/vega_aarch64.vpkg`, not `CourtsideVega_aarch64.vpkg`.
- `build-kepler` prints `Invoking 'build-vega'`; the current template uses `build-vega`.
- The build adds the `[[needs.module]]` entries for the `@amazon-devices/*` libraries to
  `manifest.toml` by itself (committed) and writes `buildinfo.json` (now git-ignored).
- `loggingctl log` has no `--no-pager`; `vega exec vda shell loggingctl log -o short-precise -f`
  works. Grep the app's own lines by `com.courtside.tv.vega[` and JS lines by `KeplerScript-JavaScript`.
- `vega device launch-app -a com.courtside.tv.vega.main -d VirtualDevice` relaunches without reinstalling.
- Remote keys from the CLI: `vega exec vda shell inputd-cli button_press KEY_RIGHT` (also
  `KEY_LEFT`, `KEY_UP`, `KEY_DOWN`, `KEY_ENTER`, `KEY_BACK`).

## 6. Open item: each key logs twice

`[Kepler] Key pressed: Right (eventType: right)` appears twice per press, microseconds apart.
Could be two log sinks or two `TVEventHandler` listeners. The "Who's watching" screen with no
viewers has a single focusable, so a double move is not visible there. Check with two viewers
joined: if focus jumps two cards per press, make `RemoteControlManager.kepler.ts` ignore the
duplicate (same eventType within a few ms) or find the second registration.

## 7. App bugs the VVD found while recording the demo (fixed)

- **Crash after every phone question.** `navigation.popTo` is undefined: the `@amazon-devices/react-navigation__*`
  "7.0.x" ports are aliases of React Navigation 6 (`temporary-alias-for-package`). Found by printing the error stack
  in short chunks (the device log truncates long lines) and mapping `bundle:line:col` through
  `build/debugging/Debug/srcmap/*.map` with `source-map`. Fix: `navigation/popTo.ts` (F-18).
- **Pitch names and arrows pile up between moments.** The Vega `react-native-svg` port does not remove children on
  update. Fix: `<Svg key={moment.id}>` in `Pitch.tsx` (F-19).
- The VVD itself restarted once on its own during a take ("Vega Virtual Device is ready" splash); relaunching the
  app was enough.
