# YukApp — context for Claude

Android app (Expo SDK 58, React Native 0.88, Expo Router, JavaScript) for YukPlatform. Read `AGENTS.md` (Expo rules:
fetch versioned docs, `npx expo install`, never edit `android/`). Project background, the user and his rules:
`../YukPlatform/CLAUDE.md` (talk to Azimjon in **Uzbek (Latin)**; code comments in Uzbek; explain new things as you go).

- Started 2026-11-23 at his request («YukPlatform darajasida papka yaratib ichiga ilova quramiz»): sibling folder, its own
  git repo: GitHub `Azimjon-M/YukApp` (**public** since 2026-11-24 — never commit keys, tokens, real phones), branch `main` (created and first pushed 2026-11-24 at his «yangi repo
  ochib push qil»; local `master` renamed to `main` before that). Push after work like YukPlatform; never commit `keys/`,
  `apk/`, real phones or tokens. Backend is NOT changed from here — only `https://yuk.gtpro.uz/pub` is used
  (`../YukPlatform/apps/mobile/API.md`, `apps/api/src/public.js` header). A missing endpoint → tell him which and why,
  the server side adds it.
- `@yuk/shared` = `file:../YukPlatform/packages/shared` (symlink) + `metro.config.js` `watchFolders`. Needs the sibling
  checkout; an Expo cloud build would not see it (local build or vendoring needed then).
- Login (since 0.2.0, 2026-11-24, his «telefon raqami yoki username ni kiritsin, agar bizda bo'lsagina botdan kod olsin»):
  `src/codeLogin.js` state machine — `parseLogin` (shared `typedPhone` / `telegramUsername` → "+998…" or "@name") →
  POST /pub/auth/code { login } → { requestId, expiresIn, resendIn, digits } → POST /pub/auth/code/verify
  { requestId, code } → { token, me }. 404 not_found / 403 not_member { missing } / 409 bot_blocked → `state.problem` →
  login screen shows the «Ro'yxatdan o'tish» guide (bot Start → join channel + group from /pub/config `required` → share
  phone in the bot → come back). 400 wrong { attemptsLeft }, 410 expired, 429 limit { retryIn }. `ApiError.data` = full
  error JSON. requestId/code never in state or logs. The old «Telegram orqali kirish» (POST /pub/auth/app + polling,
  `appLogin.js`) was removed from the app; the server endpoints stay for 0.1.0 installs. The server side was specified in
  a prompt for his server chat (2026-11-24) — the app needs it deployed before 0.2.0 can log in.
  Token in expo-secure-store (`src/storage.js`; localStorage on web). 401 with a token → `leave()`; 403 blocked → «Uzr».
- Screens: login, holat (loading/blocked/offline), rol, yonalish + `(app)` group. Stack.Protected guards in
  `src/app/_layout.js`.
- **Navigation (0.3.0, 2026-11-24, his «Saidbarli bo'lsin ammo pastdagi panel ham bo'lsin»):** sidebar = custom
  `src/components/SideMenu.js` (Modal + Animated, ☰ `MenuButton` in every header) — deliberately NOT expo-router/drawer
  (needs reanimated + gesture-handler native builds). Sidebar picks a section, each section has its own bottom tabs:
  `(app)/(asosiy)` (0.4.0) «📋 Yuklar» (index = `components/LoadsFeed.js`, Segmented Menga mos/Hammasi inside) · «🎛 Filtr»
  (filtr.js, driver only, `href: null` for shippers) · «⏸ Pauza / ▶️ Davom etish» (pauza.js is a dummy route; the tab's
  `tabBarButton` toggles `PATCH /pub/me {active}`) · `(app)/sozlamalar` «E'lon» (index: bot active, filter summary →
  /filtr, route) · «Hisob» (hisob.js:
  account, role, sign out, delete) · `(app)/haqida` «Dastur haqida»: author Meliboev Azimjon (t.me/gt_rushsher) and his
  support cards Visa 4231…6273 / Humo 9860…4705 (he asked to show them publicly; tap = copy via expo-clipboard).
  Sidebar layout (2026-11-25, his «tepada Yuklar va Botni ochish … pastda Sozlamalar va dastur haqida»): top group =
  Yuklar + «Botni ochish» with the bot's own Telegram photo `assets/bot.jpg` (160×160, fetched via Bot API); bottom group.
- **«📝 E'lon berish» chat (2026-11-25, his «Saidbarga E'lon berish qo'sh. Yuklar pastida … chat bo'lsin … bot qanday
  ishlayotgan bo'lsa qarab ko'r»):** sidebar top group Yuklar → 📝 E'lon berish → Botni ochish; route `(app)/elon.js` →
  `components/LoadChat.js`: bubbles (bot left / me right), input bar, «Tushunyapman…» while the server parses (POST timeout
  60 s, no retry), confirm card [✅ Yuborish] [❌ Bekor qilish], phone stage with saved-phone buttons (or type it), after
  send polls `/pub/me/load-chat/posts/:id` every 3 s for the result. Conversation kept in a module variable (per chatId)
  until the app closes; the draft itself lives on the server (shared with the bot). Drivers see a notice + «🔄 Rolni
  almashtirish». Server: YukPlatform `loadChat.js`. Keyboard: KeyboardAvoidingView padding, offset insets.top + 56 —
  check on the phone.
- **No roles in the app (2026-11-25, his «Ilovamizda Rol narsa bo'lmasin! Saidbardagi Haydovchini yo'qot! uni o'rniga
  Obuna»):** `rol.js` deleted, (app) guarded by `signedIn` only, Hisob has no role row/button; `session.js` silently
  `PUT /pub/me/role haydovchi` for any signed-in user whose role isn't haydovchi (server feed is driver-only; each role's
  settings stay stashed on the server — a bot shipper who opens the app becomes a driver in the bot too; shippers ≈ 0).
  Sidebar badge = «⭐ Pro obuna» / «🆓 Obuna: Bepul» (`me.plan`). E'lon berish is open to everyone (server load-chat has
  no role check; the poster never receives his own load — pipeline skips `post.shipper`).
- **E'lon berish: voice + guide (same day, his «Chat yoki audio yozib oladigan bo'lsin. Tepaga obrazavanya qo'y (nma
  yozish / nmani aytish)»):** `LoadChat.js` list header `Guide` (collapsible: 📍📦🚚💰📞 lines with samples + a sentence to
  say). 🎤 button when the input is empty: `expo-audio` (plugin in app.json → RECORD_AUDIO) `useAudioRecorder` AAC-ADTS mono
  16 kHz 32 kbps; recording bar «🗑 · 0:07 · ➤», ≥ 1.5 s, auto-send at 2 min; upload = `new File(uri).upload(url,
  {BINARY_CONTENT})` with `api.js` `uploadHeaders("audio/aac")` / `readUpload` → server `POST /pub/me/load-chat/voice`
  (Gemini transcription, YukPlatform server.js `transcribeVoice`) → `{transcript, view}`; my bubble shows «🎤 N s «text»».
- **Telegram-like chat (2026-11-25, his «Audio yuborishni ushlab turadigan … jo'natgan audiosini o'zida saqlab … boshqa
  qurilmadan kirsa … eshitadigan … chat mukammal telegram chatiga o'xshasin»):** history lives on the server (YukPlatform
  `load_chat` table): `GET /pub/me/load-chat[?after=id]` → `{intro, messages, used, limit}`, every action returns the new
  messages; `merge()` keeps the list sorted, buttons only on the last `active` question. My message appears at once with 🕓,
  then ✓ + time. 🎤 = PanResponder on the mic: hold → record, release → send, slide left < −90 → cancel, slide up < −80 →
  🔒 lock (🗑 / ➤). Voice bubble ▶/❚❚ + progress + duration + transcript; one shared `useAudioPlayer`, source =
  `api.js voiceSource(id)` (URL + auth headers; own fresh recording plays from the local file). After «✅ Yuborish» polls
  `?after=` every 3 s (≤ 3 min) for the result message. List is `inverted` (newest at the bottom, anchored — scrollToEnd
  used to jump to the top sometimes); any response that contains my own message turns every older `active` off (a
  cancelled form disappears at once).
- **Chat polish (2026-11-25, his tests):** voice ≥ 3 s; 3 failed voices in a row → server sends a «write it like this»
  example (`voiceHelp`); a text without route or cargo info → bot note «✏️ E'londa … yozilmagan» + the text quoted
  (`failed` + `editText`) with «✏️ Tahrirlash» (puts it back into the input); confirm stage also has «✏️ Tahrirlash»; phone
  stage = card + `PhoneAsk` (input prefilled with the saved/own phone, chips for other saved ones) + «✅ Yuborish»
  (`pickLoadPhone(phone, true)` → server sets the phone AND sends) + «❌ E'lonni bekor qilish».
- **Filtr + new-loads badge (0.4.0, 2026-11-24, his «Yuklar, Filtr va Pauza … Filter esa Mashina, Qayerdan va Guruhlar
  huddi botdagidek … e'lonlar kelsa Yuklar btn qizil va ichida raqam … Saidbardagi Yuklar gaham»):** filter = bot's
  «🎛 Filtr»: source tezkor «🌐 Hamma guruhlar» | guruhlarim «📌 Faqat tanlangan» (`components/GroupPicker.js`, GET
  /pub/me/feed-sources, open/closed tabs, search, select all, 20 per page) + `TRUCK_FILTERS` chips + `REGIONS` chips; pure
  logic `src/filterForm.js` (tested; guruhlarim with 0 groups → saved as tezkor like the bot) → `PUT /pub/me/profile
  {profile: {...old, feed}, role: "haydovchi"}` → back to Yuklar. Driver without a profile on «Menga mos» → redirected
  to /filtr. **Server side (YukPlatform `20e6dac`, made from this server):** `/pub/loads?view=mine` for tezkor/guruhlarim
  drivers used to answer 409 `feed`; now it filters with shared `rawLoadWanted` (group + region + truck, same as bot
  pipeline) — needs the production restart (`supervisorctl restart yuk`) to be live. Badge: `src/newLoads.js`
  `NewLoadsProvider` (in `(app)/_layout.js`) polls view=mine limit 50 every 30 s while the app is active, counts ids >
  last seen (stored via `storage.js` `saveValue` key `yuk_seen_<kind>`; first run = no badge), off when paused;
  `markSeen` from LoadsFeed when «Menga mos» is shown and focused; red `tabBarBadge` + sidebar pill (`badgeText`, «50+»).
  No push notifications (app closed = nothing). `src/toast.js` = ToastAndroid. Don't `pkill -f`/`pgrep -f` a pattern
  that is also in the same bash command — it kills the tool's own shell (exit 144).
- **Feed scroll (0.9.2, 2026-11-25, his «telegramdagi btn kabi aqilli»):** `LoadsFeed` FlatList uses
  `maintainVisibleContentPosition` (autoscrollToTopThreshold 80) — scrolled down, the visible card stays put when new
  loads arrive on top. Round «↑» button bottom-right with the count of new loads above the viewport (pure logic
  `src/unseenJump.js`, tested; viewability ≥60% = seen): 1st press → oldest unseen (`scrollToIndex`, viewPosition 1),
  next press → top.
- **Push notifications (0.10.0, 2026-11-25, his «notification … boshida so'rattirsang … skip … muloyimlik bilan yana
  so'ratish … Qayerdan qayergaligi va telefon qilish»):** `expo-notifications` (plugin: monochrome icon, color, default
  channel `yuklar`). `src/notify.js`: channel `yuklar` (HIGH), category `yuk` with action `call` «📞 Qo'ng'iroq qilish»;
  foreground → nothing shown (feed shows it); tap → `/`, `call` → `tel:` from `data.phone`; FCM device token →
  `POST /pub/me/push {token, platform}` (server side: YukPlatform `apps/api/src/push.js` + `fcm.js`, 2026-11-25). Ask flow `src/notifyAsk.js`
  (tested) + `components/NotifyPrompt.js` Modal in `(app)/_layout`: first login «Yoqish / Keyinroq», still off → every
  3 days «Yoqish / Keyinroq / Kerak emas» (never again); `!canAskAgain` → `Linking.openSettings()`. Sozlamalar → E'lon
  has «📲 Telefonga bildirishnoma». `google-services.json` is gitignored, plugged in by `app.config.js` only if present
  (no file = no token, app still builds). Server must send **data-only** FCM v1 messages, android priority high, data:
  `title` («📍 Qayerdan → Qayerga»), `message` (text), `channelId: "yuklar"`, `categoryId: "yuk"`, `body` = JSON string
  `{"phone":"+998…","postId":…}` (becomes `content.data`) — keys from expo-notifications `NotificationData.kt`.
- **Battery (0.11.0, 2026-11-25):** after notifications are granted, NotifyPrompt asks the same polite way (key
  `yuk_battery_ask`) to exempt the app from battery optimization: `expo-battery` `isBatteryOptimizationEnabledAsync` →
  `expo-intent-launcher` `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (`package:` uri; permission in app.json). Sozlamalar
  shows the battery state + Infinix/Tecno/Xiaomi «Auto-start» hint. No background JS polling — delivery is FCM only.
- **Open from notification (0.11.1, 2026-11-25, his «bosib ilovaga o'tsam u hali kelmagan … yashil … tepada bo'lishi
  kerak»):** tap → `openPost.js` `setOpenPost(data.postId)` (module store, survives cold start) → LoadsFeed loads at once
  (no 3 s wait), finds the id → `scrollToIndex` viewPosition 0 + green `colors.ok` border overlay in `Appear` (2.5 s,
  fades); not found within 15 s → toast. `clearOpenPost` only inside the timer (calling it earlier re-runs the effect and
  cancels the scroll). 0.11.2: the push `body.item` (server sends the card) is inserted at once — no wait; without it a
  centered «Kuting…» overlay after 250 ms. Blue glow and spring are separate animations (a stopped sequence left the
  blue border stuck).
  0.11.3 (his «tepaga scroll qilsam reload … o'zidan-o'zi eng yangisiga scroll»): after the target scroll the list is in
  `hold` — `maintainVisibleContentPosition` without `autoscrollToTopThreshold`, so loads arriving later stack ABOVE the
  target (counted on «↑»), no jump. Released when the user drags up to the top from below, or «↑» goes to the top.
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
- **APK built on the server (2026-11-25, his «faqat arm64-v8a … bot MiniApp da yuklab oladigan qil»):** JDK + SDK in
  `/data/android`; `build-apk.mjs` picks them on Linux, `YUK_ARCHS=arm64-v8a`, 16 workers. Release =
  `bash /data/ops/yukapp-release.sh` (needs `google-services.json` + `keys/` here, both gitignored) → published at
  `https://yuk.gtpro.uz/pub/app/android`, bot /ilovalar and Mini App «📱 Ilova» (YukPlatform CLAUDE.md). After each
  change: push only; build + version bump ONLY when he says «build qil» (he batches small changes, 2026-11-25).
- **Forced update (2026-11-25, his «eski versiyada ishlamasin faqat oxirgi versiya … Majburiy bo'lsin»):** every request
  sends `X-App-Version: <android.versionCode>` (session.js → api.js `appVersion`, Android only); server answers 426
  `update` when `data/apk/latest.json` is newer. `components/UpdateGate.js` (root `_layout`, above every screen) checks
  `GET /pub/app` on start / foreground / after a 426 (`appUpdate.js` store) → full-screen Modal, no close:
  «⬇️ Yangilash» = `File.downloadFileAsync` to cache/apk → legacy `getContentUriAsync` → intent VIEW
  (`application/vnd.android.package-archive`, FLAG_GRANT_READ) — user taps «O'rnatish»; fallback «🌐 Brauzerda».
  0.13.0: progress bar (downloadFileAsync `onProgress`, total = Content-Length or /pub/app size, % + MB); an already
  fully downloaded APK (same size) is not downloaded again — the installer opens at once.
  `REQUEST_INSTALL_PACKAGES` in app.json. Server pushes «📲 Yuk Ekspert yangilandi» (data `type: update`) once per new
  versionCode. Every release is forced, so a release MUST bump versionCode (release script refuses otherwise).
- **Workflow from the server (2026-11-24, his «sen o'zgarishlar qilasan, men gitdan olib telefonimga build qilib test qilaman»):**
  Claude also works on a clone at `/data/YukApp` on the YukPlatform server (Linux, next to `/data/YukPlatform`, so
  `@yuk/shared` resolves) — edits, `npm test`, `npx eslint src test`, push to `main`. No Android SDK/phone there: he
  pulls on his Windows PC and builds/installs (`npm run apk` or `npx expo run:android`). Before he builds: keep
  `version`/`versionCode` bumps in mind, and say what to test.
