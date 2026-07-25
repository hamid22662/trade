# TradeLog — Local-first Forex & Crypto Journal

A React Native / Expo trading journal with platform-local persistence:

- Web/PWA: IndexedDB through Dexie.
- Android/iOS native: `expo-sqlite` for journal data and the app document
  directory for chart images.
- Public runtime settings: same-origin `/app-config.json`, copied unchanged
  beside the PWA files during the web build.

## Run locally

```bash
npm install
npx expo install --fix --npm
npx expo start --go
```

Then scan the QR code using Expo Go on Android.

## Verify the project

```bash
npm run check
npm run build:android-apk
```

The first command validates the local-first boundary, type-checks the project,
runs the IndexedDB persistence smoke test, round-trips a portable backup,
validates public runtime configuration parsing, PWA installability metadata,
the offline app shell, and creates the web build. The second command runs the
native Gradle `assembleRelease` task and verifies the resulting installable APK.

## Upgrade from the first test build

1. Stop Expo in the terminal with `Ctrl + C`.
2. Extract the updated project ZIP into a new folder.
3. Run the commands above inside the new `tradelog` folder.
4. Run `npx expo start -c --go` to clear Expo’s cache.

The app database uses the same file name (`tradelog.db`). Existing journal data remains available when the same Expo Go project/app environment is used. Existing closed trades are recalculated when the updated app starts.

See `docs/STAGE_4_ANDROID_LOCAL_STORAGE_FA.md` for the Android storage design
and the device test checklist.

See `docs/STAGE_6_7_BACKUP_AND_STAGE_8_APP_CONFIG_FA.md` for the portable
Drive/Files backup flow, static `app-config.json`, sponsor banner, and privacy
design.

See `docs/STAGE_12_PWA_VERIFICATION_FA.md` and
`docs/STAGE_13_APK_PIPELINE_VERIFICATION_FA.md` for the PWA/offline and APK
pipeline implementation reports.

## Important calculation assumption

The default account currency is USD. The included default symbols contain their pip/point size and contract size. For USDJPY the entry price is used to convert the pip value to USD. Cross pairs and broker-specific CFDs may require custom symbol configuration in a later version.

See `UPDATE_V2_1.md` for calculation examples and what changed in this version.
