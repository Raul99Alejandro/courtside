# Courtside TV

React Native app shared across Vega OS, Fire OS and web, based on the Amazon multi-TV sample
(see `THIRD_PARTY.md`). Screens live in `packages/shared` and import the pure domain core from
`../src/core` through the `@courtside/core` alias (Metro, TypeScript and Vitest are all configured).

Layout: `packages/shared` (screens, navigation, focus, remote-control keys), `apps/expo` (web and
Fire OS / Android TV), `apps/vega` (Vega OS, builds only on macOS / Ubuntu with the Vega SDK, not on Windows).

## Commands (Windows, Node 24, Yarn 4 through Corepack)

Run from `courtside/tv`. First time: create nothing, just install (about 4 minutes, about 1 GB, includes the Vega packages).

    yarn install
    yarn test                                   # Vitest in packages/shared (core wiring)
    yarn web                                    # Expo web dev server at http://localhost:8082
    npx playwright install chromium             # once
    yarn shot                                   # with `yarn web` running: saves shots/hello.png at 1920x1080
    node scripts/shot.mjs <url> <out.png> 390 844   # custom size, for example the phone view

D-pad on the web build is the keyboard: arrow keys move focus, Enter selects, Backspace goes back.
Pressing right on the first screen closes the drawer.

Notes: `tv/` has its own `yarn.lock` and is excluded from the repo-root TypeScript and Vitest
(their `include` lists do not reach it). Expo prints version-mismatch warnings (inherited from the
sample); the web bundle builds regardless. Type checking: `yarn workspace @courtside/expo typecheck`.
