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
| `src/app/login.js` | «Telegram orqali kirish» |
| `src/app/rol.js` | haydovchi yoki yuk beruvchi |
| `src/app/(tabs)/index.js` | 📋 Yuklar (haydovchi) / 🚚 Bo'sh mashinalar (yuk beruvchi) |
| `src/app/(tabs)/sozlamalar.js` | hisob, pauza, sozlamalar, chiqish |
| `src/app/yonalish.js` | 📍 Qayerdan → 🏁 Qayerga |
| `src/api.js` | server bilan aloqa (token, 401 / 403, qayta urinish) |
| `src/appLogin.js` | kirish qadamlari (kod → Telegram → so'rab turish) |
| `src/session.js` | kim kirgan (token telefonning xavfsiz xotirasida) |
| `src/components/LoadCard.js` | yuk / mashina kartochkasi, 📞 qo'ng'iroq |

## Tekshirish

```bash
npm test
```

```bash
npm run lint
```
