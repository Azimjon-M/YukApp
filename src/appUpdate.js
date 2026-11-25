// Majburiy yangilash (Azimjon, 2026-11-25: «eski versiyada ishlamasin faqat oxirgi versiya … Majburiy bo'lsin»).
// Ilova o'z versionCode'ini har so'rovda yuboradi (api.js X-App-Version); serverda (YukPlatform data/apk/latest.json)
// yangirog'i bo'lsa — server 426 «update» beradi va /pub/app eng so'nggi versiyani aytadi. Shunda butun ekranni
// UpdateGate.js yopadi: «Yangilash» → APK yuklanadi → Android o'rnatish oynasi. Bu faylda react-native yo'q (testlar Node'da).
import { useSyncExternalStore } from "react";

// own — o'rnatilgan versionCode, latest — /pub/app javobidagi android ({ version, versionCode, size, url })
export const isOutdated = (own, latest) => Boolean(own && latest && Number(latest.versionCode) > Number(own));

let current = null; // eng so'nggi versiya (server aytgan) yoki null
let stale = 0; // server 426 qaytargan marta — UpdateGate /pub/app ni qayta so'raydi
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

export function setLatest(latest) {
  current = latest && typeof latest === "object" && Number(latest.versionCode) ? latest : null;
  emit();
}
// api.js: server «eski versiya» dedi
export function markStale() {
  stale += 1;
  emit();
}
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
let snapshot = { latest: null, stale: 0 };
const read = () => {
  if (snapshot.latest !== current || snapshot.stale !== stale) snapshot = { latest: current, stale };
  return snapshot;
};
export const useAppUpdate = () => useSyncExternalStore(subscribe, read, read);

// «29.6 MB»
export const sizeText = (bytes) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : "");
