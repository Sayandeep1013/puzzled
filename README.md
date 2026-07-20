# Puzzled

A local-first jigsaw puzzle game for **Android** and **iOS**, built with **Expo SDK 57**, React
Native, and TypeScript.

Repository: [github.com/Sayandeep1013/puzzled](https://github.com/Sayandeep1013/puzzled)

Right now the app ships:

- Home screen + playable Game screen
- Pure TypeScript **game engine** (piece generation, paths, layout, snap/lock, completion)
- **Skia drag board** — clip pieces from one image, drag from tray, snap when close
- Local catalog + SQLite progress contracts (cloud sync later via Supabase)
- Development-build support for native feel-testing on device

Architecture details live in [TECH.md](./TECH.md). Read that before changing engine or dependency
rules.

---

## Requirements

| Tool           | Version                                      |
| -------------- | -------------------------------------------- |
| Node.js        | **22.13+** (Expo SDK 57)                     |
| npm            | comes with Node                              |
| Git            | any recent version                           |
| Android Studio | required for Android emulator / device       |
| Xcode          | macOS only, required for local iOS Simulator |

Optional but recommended:

- [Expo Orbit](https://expo.dev/orbit) or Expo Go / a **development build** for device testing
- EAS CLI (`npm i -g eas-cli`) for cloud iOS builds from Windows

---

## Clone and install

```bash
git clone https://github.com/Sayandeep1013/puzzled.git
cd puzzled
npm ci
```

Use `npm ci` (not a casual `npm install`) so everyone materializes the same tree from
`package-lock.json`.

Copy the env template if you need local overrides later:

```bash
cp .env.example .env
```

No backend keys are required for the local-first milestone. Leave Supabase vars empty until cloud
sync is implemented.

---

## Run the app (feel the board)

This project uses **native Skia + gestures**. For real look-and-feel, use a **development build**
(APK / debug install). Expo Go is not the recommended loop for this app.

### Option A — Local Android debug build (Android Studio)

Best when you want fast feel-testing with hot reload on an emulator or USB phone.

#### A1. Install Android Studio (Windows)

1. Download Android Studio from https://developer.android.com/studio
2. Run the installer
3. Under **Select components to install**, keep:
   - **Android Studio**
   - **Android Virtual Device**
4. Finish install and open Android Studio
5. In the Setup Wizard, choose **Standard** install and accept licenses
6. Let it download the default SDK tools, then finish

#### A2. Install the SDK Expo needs

Puzzled uses Expo SDK 57 / React Native, which expects **Android SDK Platform 36**.

1. Open Android Studio
2. Go to **Settings** (or **More Actions → Settings**)
3. **Languages & Frameworks → Android SDK**
4. Open the **SDK Platforms** tab
5. Enable **Show Package Details**
6. Under **Android 16.0 (“Baklava”)**, check:
   - **Android SDK Platform 36**
   - **Sources for Android 36** (optional but useful)
7. Open the **SDK Tools** tab and confirm these are installed:
   - Android SDK Build-Tools
   - Android SDK Platform-Tools
   - Android Emulator
   - Android SDK Command-line Tools
8. Click **Apply** / **OK** and wait for downloads

Note the **Android SDK Location** shown at the top of that screen (usually  
`C:\Users\<you>\AppData\Local\Android\Sdk`).

#### A3. Set Windows environment variables

1. Open **Start → Edit environment variables for your account**
   (or Control Panel → User Accounts → Change my environment variables)
2. Under **User variables**, click **New**:
   - Name: `ANDROID_HOME`
   - Value: your SDK path, e.g. `C:\Users\<you>\AppData\Local\Android\Sdk`
3. Edit **Path** → **New** and add:
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\emulator`
4. Click **OK** on all dialogs
5. **Close and reopen** PowerShell / Cursor terminals (env vars only apply to new shells)

Verify:

```powershell
echo $env:ANDROID_HOME
adb version
```

You should see the SDK path and an `adb` version. If `adb` is not recognized, the Path entry is wrong or the terminal was not restarted.

#### A4. Create an emulator (AVD)

1. In Android Studio welcome screen: **More Actions → Virtual Device Manager**
   (or the phone icon in an open project)
2. Click **Create Device**
3. Pick a phone (Pixel 7 / Pixel 8 is fine) → **Next**
4. Download a system image if needed (prefer a recent **Google APIs** image, API 35 or 36)
5. Finish the wizard
6. Press **Play** on the device to boot the emulator once and confirm it works

Keep the emulator running while you build.

#### A5. Or use a physical Android phone

1. On the phone: **Settings → About phone** → tap **Build number** 7 times
2. **Settings → Developer options** → enable **USB debugging**
3. Plug into the PC with a data USB cable
4. Accept the RSA fingerprint prompt on the phone
5. Verify:

```powershell
adb devices
```

You should see your device as `device` (not `unauthorized`).

#### A6. Build and run Puzzled

From the repo root:

```powershell
cd D:\Projects\Puzzled
npm ci
npm run android
```

That runs `expo run:android` and will:

1. Generate the native `android/` folder (first time; gitignored)
2. Compile a **debug APK**
3. Install it on the running emulator or connected phone
4. Start Metro and open the app

First compile can take several minutes. Later JS/TS changes usually only need Metro.

#### A7. Day-to-day loop after the first install

1. Start emulator (or plug in phone)
2. In the project:

```powershell
npx expo start --dev-client
```

3. Open the installed **Puzzled** app on the device (not Expo Go)
4. If it does not connect automatically, shake device / open dev menu and reload, or scan/connect to the Metro URL
5. Home → **Start puzzle** → drag pieces

Rebuild native code only when native deps / plugins change:

```powershell
npm run android
```

#### A8. Common Android Studio problems

| Problem                        | Fix                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `ANDROID_HOME` / SDK not found | Re-check env vars; restart terminal; confirm SDK path in Android Studio            |
| `adb` not found                | Add `%ANDROID_HOME%\platform-tools` to Path; restart terminal                      |
| No devices                     | Start an AVD, or fix USB debugging / try another cable                             |
| Device `unauthorized`          | Unlock phone and accept the debugging prompt; `adb kill-server` then `adb devices` |
| Build fails on licenses        | In SDK Manager accept licenses, or run `sdkmanager --licenses` from cmdline-tools  |
| Emulator is slow               | Enable Windows Hyper-V / WHPX if available; allocate more RAM in AVD settings      |
| Old JS bundle                  | `npx expo start --dev-client -c`, force-close Puzzled, reopen                      |

Official Expo environment guide: https://docs.expo.dev/get-started/set-up-your-environment/

### Option B — EAS cloud development APK (no local Android SDK)

Use this when Android Studio is not set up (common on a clean Windows machine).

```bash
npm i -g eas-cli
eas login
eas build:configure   # once per machine/repo if prompted
npm run build:dev:android
```

`eas.json` profile `development` builds an **internal APK** with the dev client.

1. Wait for the EAS build to finish (Expo dashboard / CLI link)
2. Download the `.apk` on your phone (or transfer from the download page)
3. Allow install from that source if Android asks
4. Install the APK
5. On your PC, start Metro:

```bash
npx expo start --dev-client
```

6. Open **Puzzled** on the phone
7. Connect to the bundler:
   - same Wi‑Fi: scan the QR / pick the LAN URL
   - different network: press `s` in the terminal for tunnel mode, then reconnect

You can keep using the same installed APK while changing JS/TS. Only rebuild the APK when native
dependencies or `app.json` plugins change.

### Option C — Preview APK (standalone-ish internal build)

For a shareable internal APK that does not require Metro during a quick demo of a frozen JS bundle,
use the `preview` profile (still not a Play Store release):

```bash
eas build --profile preview --platform android
```

Prefer **development** (Option B) while actively tuning drag/snap feel, because Metro hot-reload is
faster.

### Option D — Engine-only (no UI / no APK)

```bash
npm test
```

### What you should feel in Game

1. Home shows **First Light** (4×4 starter, 16 pieces — easy to judge snap feel)
2. Start puzzle → image pieces sit in a tray under the board
3. Drag a piece; it lifts with an accent stroke
4. Drop near the correct cell → it snaps and locks
5. Counter updates; status flips to completed when all pieces lock

Production boards stay 8×8 / 9×9 / 10×10 — bump `gridSize` on the catalog entry when you want denser
play.

### APK testing checklist

| Check    | Pass when                                           |
| -------- | --------------------------------------------------- |
| Install  | APK installs; app icon **Puzzled** opens            |
| Home     | Brand + First Light card visible                    |
| Navigate | **Start puzzle** opens the board                    |
| Image    | Sunrise landscape shows on pieces (not blank tiles) |
| Drag     | Piece follows finger without large lag              |
| Snap     | Piece locks when released near the correct cell     |
| Miss     | Far drop stays unlocked in the tray/board area      |
| Progress | Header counter increases on each lock               |
| Complete | All 16 locks → completed messaging                  |

Tune next: snap threshold (`DEFAULT_SNAP_THRESHOLD_RATIO`), tray spacing, tab size, cell size.

### Stale cache after a pull

```bash
npm run clean:caches
npm ci
npx expo start --dev-client -c
```

If the phone still loads an old bundle, force-close Puzzled and reopen it against Metro.

---

## Verify the game engine

The engine is pure TypeScript under `src/game-engine/core`. It does not need a device to prove it
works.

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run doctor
```

Or one dependency health pass:

```bash
npm run deps:check
```

### Engine coverage (current)

| Area                       | Module                   | Tests                                       |
| -------------------------- | ------------------------ | ------------------------------------------- |
| Seeded complementary edges | `edges.ts`               | 8 / 9 / 10 grids, borders, determinism      |
| Piece + path generation    | `generate.ts`, `path.ts` | counts, paths, bounds                       |
| Tab/blank mating           | `mating.test.ts`         | shared-edge peaks align in board space      |
| Coordinates                | `coordinates.ts`         | board ↔ image ↔ screen round-trips          |
| Tray / scatter layout      | `layout.ts`              | below-board placement, seeded scatter       |
| Session reducers           | `session.ts`             | raise, snap/lock, far drop, full completion |
| Bootstrap API              | `playable.ts`            | full 8/9/10 session + playthrough           |

Entry point for features:

```ts
import { createPlayablePuzzle, dropPiece } from '@/game-engine';
```

---

## Project layout

```text
src/
  app/                 Expo Router routes (Home, Game)
  features/            Screen UI + orchestration
  game-engine/
    core/              Pure rules (no React / Skia / SQLite)
    rendering/         Future Skia adapters
    interaction/       Future gesture controllers
  data/                Catalog + SQLite repositories
  shared/              Theme tokens
```

Dependency direction: routes → features → engine + repository interfaces → local adapters.

---

## Dependencies (multi-dev)

Keep installs reproducible:

1. **Always commit** `package-lock.json` with dependency changes
2. Add Expo / React Native packages with:

   ```bash
   npx expo install <package>
   ```

3. After pulling dependency commits, run `npm ci`
4. Before merging a dependency PR:

   ```bash
   npm run deps:check
   ```

5. Do not commit `node_modules/`, `.expo/`, `dist/`, or secret `.env` files
6. Node must stay on `>=22.13.0`

Scripts of interest:

| Script                            | Purpose                              |
| --------------------------------- | ------------------------------------ |
| `npm start`                       | Expo / Metro                         |
| `npm test`                        | Jest engine tests                    |
| `npm run typecheck`               | TypeScript                           |
| `npm run lint`                    | ESLint                               |
| `npm run format` / `format:check` | Prettier                             |
| `npm run doctor`                  | Expo Doctor                          |
| `npm run deps:check`              | Expo version check + Doctor          |
| `npm run clean:caches`            | Clear `.expo`, Metro cache, coverage |

---

## Development workflow

1. Create a branch from `main`
2. Prefer small PRs (engine, UI, data) that respect folder boundaries
3. Run `npm test && npm run typecheck && npm run lint` before opening a PR
4. Do not import React, Skia, or SQLite from `src/game-engine/core`
5. Bump `GENERATOR_ALGORITHM_VERSION` in `constants.ts` if generation math changes incompatibly with
   saved sessions

Suggested next implementation order (also in TECH.md):

1. Skia board rendering from `PieceLocalPath` + image clip
2. Gesture drag / z-order / snap animation on Reanimated shared values
3. Persist sessions through `SQLiteProgressRepository`
4. Wire Home progress from real summaries
5. Optional Supabase auth + sync

---

## Troubleshooting

| Symptom                               | Fix                                                        |
| ------------------------------------- | ---------------------------------------------------------- |
| `engine-strict` / Node version errors | Upgrade to Node 22.13+                                     |
| Expo Doctor version mismatch          | `npx expo install --fix` then `npm run doctor`             |
| Metro can’t resolve `@/…`             | Confirm `tsconfig` paths; restart with `npx expo start -c` |
| Android build / SDK issues            | Open Android Studio SDK Manager; accept licenses           |
| iOS from Windows                      | Use EAS Build; local Simulator needs macOS                 |
| Tests fail after pull                 | `npm ci` then `npm test`                                   |

---

## License

See [LICENSE](./LICENSE).
