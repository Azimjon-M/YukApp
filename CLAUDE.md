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
