# YukApp — context for Claude

Android app (Expo SDK 58, React Native 0.88, Expo Router, JavaScript) for YukPlatform. Read `AGENTS.md` (Expo rules:
fetch versioned docs, `npx expo install`, never edit `android/`). Project background, the user and his rules:
`../YukPlatform/CLAUDE.md` (talk to Azimjon in **Uzbek (Latin)**; code comments in Uzbek; explain new things as you go).

- Started 2026-11-23 at his request («YukPlatform darajasida papka yaratib ichiga ilova quramiz»): sibling folder, its own
  git repo (no remote yet). Backend is NOT changed from here — only `https://yuk.gtpro.uz/pub` is used
  (`../YukPlatform/apps/mobile/API.md`, `apps/api/src/public.js` header). A missing endpoint → tell him which and why,
  the server side adds it.
- `@yuk/shared` = `file:../YukPlatform/packages/shared` (symlink) + `metro.config.js` `watchFolders`. Needs the sibling
  checkout; an Expo cloud build would not see it (local build or vendoring needed then).
- Login: `src/appLogin.js` state machine (POST /pub/auth/app → open tg:// then https t.me → poll every pollMs, AppState
  "active" polls at once, 410 → expired, offline → keep polling at 5 s). Code/token never logged or put in state.
  Token in expo-secure-store (`src/storage.js`; localStorage on web). 401 with a token → `leave()`; 403 blocked → «Uzr».
- Screens: login, holat (loading/blocked/offline), rol, (tabs)/index (loads or trucks by role), (tabs)/sozlamalar,
  yonalish. Stack.Protected guards in `src/app/_layout.js`.
- v1 does NOT have: settings form (driver vehicle / shipper filter — users go to the bot), «📦 Yuk berish», maps,
  phone share, push notifications. «Hisobdan chiqish» offers «Faqat ilovadan» (token only) or «Butunlay» (POST logout).
- Testing without his Telegram: scratch fake server (real `public.js` + in-memory store + auto-confirm of app logins)
  — recreate when needed; `EXPO_PUBLIC_API_URL=http://localhost:3011`. `npm test` (node --test, pure modules only),
  `npx eslint src test`. Web (`npx expo start --web`) is only for quick checks: `Alert` does nothing there.
- Emulator: AVD `Pixel_10_Pro`, SDK in `%LOCALAPPDATA%\Android\Sdk`, JDK = Android Studio `jbr`.
- **APK (2026-11-23, his «apk qilib ber»):** `npm run apk` = `scripts/build-apk.mjs`: prebuild → `gradlew assembleRelease`
  (`-PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64`, EXPO_PUBLIC_API_URL removed → production) → copy to
  gitignored `apk/yuk-ekspert-<version>.apk` → `apksigner` re-sign with `keys/yuk-release.jks` (alias `yukekspert`,
  password in `keys/storepass.txt`, both gitignored, created by Claude — never print the password). The Expo template
  signs release with the public debug key; we never ship that. Losing `keys/` = no in-place updates. Bump `version` +
  `android.versionCode` per release. Icons (blue #2481cc + white truck) drawn with System.Drawing from the 🚚 glyph.
  `expo-system-ui` added so `userInterfaceStyle: light` applies on Android.
- **First successful APK (2026-11-24, his «qurilma o'rnatdim … o'rnatishing mumkin»):** the 2026-11-23 build never
  finished (no `apk/`). Fixed on the way, all outside `android/`: (1) Windows 260-char paths — ninja 1.10 from SDK CMake
  3.22.1 can't create them («mkdir … No such file», reanimated; «Filename longer than 260 characters», gesture-handler
  codegen in `:app`). `scripts/native-build.gradle` (Gradle `--init-script`) moves every module's CMake dir to
  `YUK_CXX_DIR` (`D:\Android\cx\<name>`), and `D:\Android\Sdk\cmake\3.22.1\bin\ninja.exe` was replaced with the official
  ninja 1.12.1 (his OK; old one kept as `ninja-1.10.2.exe`, zip in `D:\Android\tools\ninja-1.12.1`; LongPathsEnabled = 1
  on this PC). `build-apk.mjs` refuses to build on Windows when any SDK ninja is < 1.12. (2) «LLVM ERROR: out of memory»
  — 20 cores → ninja runs 22 clang per module while Gradle builds several modules; 16 GB RAM, C: almost full (pagefile
  can't grow). Now `--max-workers=2` (`YUK_BUILD_WORKERS`) + CMake job pool 3 (`YUK_CXX_JOBS`) → 11.5 min full build.
  (3) apksigner with the same `file:` for `--ks-pass` and `--key-pass` reads line 2 for the key → «end of file»;
  `--key-pass` dropped (PKCS12: key password = store password). Result `apk/yuk-ekspert-0.1.0.apk` 66 MB, signer
  `CN=Yuk Ekspert, C=UZ` (SHA-256 a48f15e2…). Installed on his phone Infinix X6873 (Android 16, arm64) via adb; starts,
  no crash. Login with his Telegram not checked by Claude (he was using the phone).
