# Yuk Ekspert — Android ilova

Expo (React Native) ilova. Backend — YukPlatform'dagi `/pub` API (`https://yuk.gtpro.uz/pub`), Mini App va sayt
ishlatadigan xuddi o'sha server. Qo'llanma: `../YukPlatform/apps/mobile/API.md`.

## Ishga tushirish

Bu papka `YukPlatform` papkasi **yonida** turishi kerak (`D:\ShaxsiyProject\YukApp` va `D:\ShaxsiyProject\YukPlatform`):
ilova `@yuk/shared` kodini (viloyatlar, transport turlari, yuk matnlari) to'g'ridan-to'g'ri o'sha yerdan oladi.

```bash
npm install
npx expo start
```

**Telefonda:** Play Market'dan **Expo Go** ni o'rnating, telefon va kompyuter bitta Wi-Fi'da bo'lsin, terminaldagi QR
kodni Expo Go bilan skanerlang. Kod o'zgarsa ilova o'zi yangilanadi.

**Emulyatorda:** Android Studio emulyatorini yoqing va `npx expo start --android`.

## Sinov server bilan

Haqiqiy server o'rniga boshqa server (masalan, kompyuterdagi sinov serveri):

```bash
EXPO_PUBLIC_API_URL=http://localhost:3011 npx expo start
```

Sozlamalar pastida «🧪 Sinov server: …» yozuvi chiqadi. Android emulyator uchun: `adb reverse tcp:3011 tcp:3011`.

## Tuzilishi

| Fayl | Nima |
|---|---|
| `src/app/_layout.js` | ildiz: sessiya va qaysi ekran ochiq bo'lishi (kirish / rol / bo'limlar) |
| `src/app/login.js` | kirish: telefon raqami yoki @username → botdan kod; «Ro'yxatdan o'tish» yo'riqnomasi |
| `src/app/rol.js` | haydovchi yoki yuk beruvchi |
| `src/app/(tabs)/index.js` | 📋 Yuklar (haydovchi) / 🚚 Bo'sh mashinalar (yuk beruvchi) |
| `src/app/(tabs)/sozlamalar.js` | hisob, pauza, sozlamalar, chiqish |
| `src/app/yonalish.js` | 📍 Qayerdan → 🏁 Qayerga |
| `src/api.js` | server bilan aloqa (token, 401 / 403, qayta urinish) |
| `src/appLogin.js` | kirish qadamlari (kod → Telegram → so'rab turish) |
| `src/session.js` | kim kirgan (token telefonning xavfsiz xotirasida) |
| `src/components/LoadCard.js` | yuk / mashina kartochkasi, 📞 qo'ng'iroq |

## APK yig'ish

```bash
npm run apk
```

Natija: `apk/yuk-ekspert-<versiya>.apk` (har doim haqiqiy serverga ulanadi). To'liq yig'ish ~12 daqiqa.
Kerak: Android Studio (uning JDK si) va Android SDK. Windows'da SDK dagi `cmake\<versiya>\bin\ninja.exe` kamida 1.12
bo'lishi kerak (uzun fayl yo'llari uchun) — skript eskisini ko'rsa, nima qilishni aytadi.

Kompyuter xotirasi yetmasa yoki aksincha tezroq yig'moqchi bo'lsangiz: `YUK_BUILD_WORKERS` (odatda 2) va
`YUK_CXX_JOBS` (odatda 3) — bir vaqtda nechta ish bajariladi (`scripts/native-build.gradle` da batafsil).

Telefonga USB orqali o'rnatish (telefonda «USB orqali tuzatish» yoqilgan bo'lsin):

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r apk\yuk-ekspert-0.1.0.apk
```

APK `keys/yuk-release.jks` kaliti bilan imzolanadi (paroli `keys/storepass.txt` da, ikkalasi ham git'ga kirmaydi).
**`keys/` papkasining zaxira nusxasini saqlang** (flesh, Google Drive): kalit yo'qolsa, yangi versiyani eski ilova ustidan
o'rnatib bo'lmaydi — foydalanuvchilar ilovani o'chirib, qaytadan o'rnatishi kerak bo'ladi.

Yangi versiya chiqarishdan oldin `app.json` da `version` (masalan, 0.2.0) va `android.versionCode` ni (+1) oshiring.

## Tekshirish

```bash
npm test
```

```bash
npm run lint
```
