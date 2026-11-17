# HabitScape: working notes for Claude

## Source of truth: the Obsidian vault
The project's decisions and concept map live in the `GameProjects` Obsidian vault, not in this repo:
`C:/Users/roger/Desktop/Games/GameProjects/HabitScape/`

- Start with `HabitScape - Start here.md`, then the `Ontology/` notes for what you're touching.
- `Decisions/` is authoritative. If a repo doc (e.g. `DEVELOPMENT_NOTES.md`) disagrees, the vault wins.
- Keep it current: follow `HabitScape - AI Guide.md` (record decisions the same session, update concept notes, park questions in `HabitScape - Open questions.md`).

## EAS build budget (hard rule)
The user is on Expo's free plan, about 20 builds a month, and won't pay for more.
- **Never run `eas build` without the user's explicit OK for that specific build.**
- Batch changes; most changes don't get their own build. When proposing one, say what's in it and why it can't wait.
- Verify for free first: the checks below, then a dev client or local Gradle build on the `Pixel_9` emulator (Android SDK at `%LOCALAPPDATA%\Android\Sdk`).

## Checks before calling work done
```bash
npx tsc --noEmit
npx expo lint
npx jest
npx expo install --check
```
All four must be clean (lint warnings are OK, errors are not).

## Testing the app yourself (background, no windows)
The user may be gaming on another monitor: never open windows or take focus.
```bash
powershell -NoProfile -ExecutionPolicy Bypass -File test-env/start.ps1   # Firebase emulators + headless emulator + Metro
powershell -NoProfile -ExecutionPolicy Bypass -File test-env/build.ps1   # only after native changes (-Prebuild after app.json plugin changes)
node test-env/drive.mjs launch                                           # then: ui, tap "<text>", type, shot, reload, logs
powershell -NoProfile -ExecutionPolicy Bypass -File test-env/stop.ps1
# Security rules only (no Android emulator needed):
npx firebase-tools@15.34.0 emulators:exec --only auth,firestore --project demo-habitscape "node test-env/rules-check.mjs"
```
**Before driving the emulator, read the vault note `Ontology/Test environment snags.md`. Whenever anything trips you up (emulator, Firebase emulators, Metro, Gradle, `drive.mjs`), add a row there the same session.** The user wants this kind of knowledge in the vault, not in Claude's private memory.

After a crash or hard power-off, start with `start.ps1 -Wipe` (fresh emulator data), then reinstall the app with `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`. The user's PC once froze with the emulator on 4 cores; keep it at 2.
The app uses the local Firebase emulators (never production) and has Sentry off in this mode. Create test accounts only there. Heavy files live in `E:/HabitScapeTestEnv` (emulator image, Gradle cache, temp, logs, screenshots) because C: is nearly full. Details: vault note `Ontology/Test environment.md`.

## Art
Icons are original pixel art (no Jagex sprites). Source of truth: `art/icons.json` (palette + 16×16 grids); export with `node scripts/render-icons.mjs` (writes `art/export/`, not committed). Every new or changed icon follows the vault note `HabitScape - Art bible.md` and passes its review checklist. Never hand-edit exported PNGs.

## Conventions
- Expo SDK 54. Add or upgrade Expo packages with `npx expo install`, never a bare `npm install <pkg>@latest`.
- Skill IDs are display names with OSRS British spelling (`Defence`). Renaming a skill or moving an activity between skills needs a migration in `src/services/migrations.ts`.
- The activity catalog is `src/constants/activities.ts`; XP per completion is the activity's `baseXP` (cadence never scales it).
- Bump `android.versionCode` in `app.json` for every Play upload.
- `docs/` is the GitHub Pages site (landing, privacy policy, account deletion), deployed on push to `master` when `docs/` changes. The app is not published for the web.
