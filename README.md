# Chess Royale 3D

A cross-platform, offline-first 3D chess game for Android and iOS. It includes computer opponents, same-device play, private online rooms, legal move enforcement, promotion, undo, saved games, move history, hints, haptics, settings, and opt-in rewarded AdMob hints.

The original app icon is stored at `assets/icon.png` and is wired as the iOS icon, Android adaptive icon, and splash artwork.

## Architecture

- Expo + React Native + TypeScript
- React Three Fiber / Three.js procedural 3D board (no paid assets)
- `chess.js` for complete chess rules
- Alpha-beta engine with three local difficulty levels
- Firebase Anonymous Auth, Firestore listeners, and authoritative Cloud Functions
- Google Mobile Ads rewarded video; test IDs are used in development
- AsyncStorage for offline resume and preferences

Online moves are validated inside a Firestore transaction in a trusted Cloud Function. Direct client writes to rooms are denied by `firestore.rules`.

## Run locally

Requirements: Node 22 LTS, Android Studio and/or Xcode. Expo Go is not enough because Google Mobile Ads requires native code.

```bash
npm install
cp .env.example .env
npx expo prebuild
npx expo run:android
```

On Windows PowerShell, use `Copy-Item .env.example .env`. For iOS, run the iOS build on macOS.

## Configure Firebase online play

1. Create a Firebase project and enable Anonymous Authentication.
2. Create a Firestore database.
3. Add a web app and copy its config fields into `.env`.
4. Install the Firebase CLI, log in, and select the project:

```bash
firebase use --add
cd functions && npm install && npm run build && cd ..
firebase deploy --only functions,firestore:rules
```

Cloud Functions deployment requires a Firebase Blaze plan. Add App Check enforcement before a public launch to reduce API abuse.

## Configure AdMob

Development builds always use Google's rewarded test unit. Before release:

1. Create Android and iOS apps in AdMob.
2. Replace the sample app IDs in `app.json`.
3. Put each rewarded unit ID in `.env`.
4. Add Google's User Messaging Platform consent flow and update your store data-safety disclosures for the countries you distribute to.
5. Build a fresh native binary after changing app IDs.

Never click live ads while testing. Rewarded ads appear only after the player taps **Hint · Ad**. If ads are unavailable, the current build grants a clearly labeled practice hint so gameplay never deadlocks.

## Verification

```bash
npm run typecheck
npm test
npx expo-doctor
cd functions && npm run build
```

Before store submission, test on low/mid/high-end physical devices, slow and interrupted networks, app background/restore, room reconnects, every promotion choice, castling, en passant, all draw conditions, ad consent, ad unavailability, and airplane mode.

## Release checklist

- Change `com.example.chessroyale` to a package/bundle ID you own.
- Replace the EAS project ID and AdMob test app IDs.
- Deploy Firebase Functions and rules; enable App Check and budget alerts.
- Provide support URL, privacy policy URL, terms, screenshots, icon, feature graphic, age rating, and data-safety answers.
- Add crash reporting/analytics only after consent review.
- Run accessibility, localization, battery, thermal, and memory testing.
- Build signed binaries with `eas build --platform all --profile production`.

## Important product note

The included AI is a compact on-device alpha-beta opponent intended for casual play. For tournament-strength play, integrate a licensed Stockfish native module and preserve its GPL obligations.
