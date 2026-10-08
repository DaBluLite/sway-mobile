# Sway Music

Sway is an ecosystem of apps that help you discover, organise, and enjoy your music. This repository hosts the **mobile** app, a React Native music and internet radio player, which allows you to listen to radio stations, connect your own Subsonic/OpenSubsonic music server, and keep your favourite stations and music together in one app.

You can use Sway for radio without configuring a music server, or enable Subsonic during setup to browse and stream your personal collection.

## What the app does

- **Internet radio:** Discover and search stations through [Radio Browser](https://www.radio-browser.info/), save favourites, revisit listening history, and organise stations into curated collections.
- **Your music library:** Connect to a Subsonic/OpenSubsonic-compatible server to browse albums, artists, genres, and songs, search your collection, and manage playlists and starred music.
- **Playback controls:** Manage the queue, play next, shuffle, repeat, and set a sleep timer. Autoplay can extend the queue with similar songs.
- **Spotify library transfer:** Authorise Spotify to read playlists, liked songs, saved albums, and followed artists, then review matches against music on your Subsonic server. This matches existing music—it does not download audio from Spotify or provide Spotify playback.
- **Car view:** A simplified interface with larger playback controls and configurable shortcuts to music and stations. This is an in-app view, not an Android Auto or CarPlay integration.
- **Appearance and storage:** Customise the app's appearance, inspect local storage usage, and clear cached files.
- **Android audio options:** Request exclusive access to a USB DAC and enable best-effort sample-rate and bit-depth matching. Availability depends on the device, DAC, and playback path; bit-perfect output is not guaranteed.

## Getting started in the app

1. Complete the welcome flow and choose your country for radio discovery.
2. Either skip music-server setup to use radio, or enable Subsonic and enter your server URL and credentials.
3. Use **Home** to discover content, **Library** to find saved stations and music, and **Search** to look for something specific.
4. Open **Now Playing** for playback controls, or use **Settings** to adjust the experience and start a Spotify library transfer.

Radio and music streaming require a network connection. The current music playback path streams directly from the server; offline playback is not currently wired into that path.

## Development

The app uses TypeScript, React 19, and React Native 0.87, with React Navigation, MMKV-backed local storage, and native audio playback integrations. The repository contains Android and iOS projects; Android-specific audio features are not available on iOS.

### Prerequisites

- Node.js **22.11.0 or newer**.
- pnpm. The repository's pnpm configuration applies a patch to `react-native-track-player`.
- A working [React Native development environment](https://reactnative.dev/docs/set-up-your-environment).
- Android Studio and the Android SDK for Android development.
- macOS, Xcode, Ruby/Bundler, and CocoaPods for iOS development.

### Install dependencies

From the repository root:

```sh
pnpm install
```

Installation also needs access to the Git-hosted `@dablulite/rn-audio-stream` dependency at `git.dablulite.dev`.

For iOS, install the Ruby dependencies from the repository root, then install pods from `ios/`:

```sh
bundle install
cd ios
bundle exec pod install
cd ..
```

### Run the app

Start Metro:

```sh
pnpm start
```

In a separate terminal, build and launch the app:

```sh
# Android emulator or connected device
pnpm android

# iOS simulator or connected device (macOS only)
pnpm ios
```

### Checks

```sh
pnpm lint
pnpm test
```

### Project layout

- `src/screens/` — browsing, playback, onboarding, car view, and settings screens.
- `src/components/` — shared UI and navigation components.
- `src/contexts/` — playback, library, playlists, favourites, history, theme, and other shared state.
- `src/services/` — Subsonic access, Spotify authorisation and transfer matching, and storage/cache services.
- `src/utils/` — shared helpers and native audio bridges.
- `android/` and `ios/` — native platform projects.
