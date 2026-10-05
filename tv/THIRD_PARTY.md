# Third-party code

This workspace started from the official Amazon sample
[AmazonAppDev/react-native-multi-tv-app-sample](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample),
commit `d435082446b4c834b0b4af8968f83666fd70a116` (4 Oct 2026), licence MIT-0 (MIT No Attribution).
The licence text is kept in `LICENSE` in this folder. Copied files keep their
`Copyright Amazon.com, Inc. or its affiliates` headers.

Changes: video player, catalogue, details, explore and TV screens removed; folders renamed
(`packages/shared-ui` to `packages/shared`, `apps/expo-multi-tv` to `apps/expo`); package scope
`@multi-tv` changed to `@courtside`; husky and commitlint removed; `src/core` wired in as `@courtside/core`.
