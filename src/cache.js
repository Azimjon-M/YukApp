// Telefon xotirasidagi kesh (fayl, expo-file-system): ilova yopilib qayta ochilsa ham oxirgi ma'lumot darhol ko'rinadi.
//   me          — oxirgi /pub/me javobi: ilova serverni kutmasdan ochiladi, server javobi kelgach yangilanadi
//   feed_<id>_* — «📋 Yuklar» dagi oxirgi 10 daqiqalik e'lonlar
// Token bu yerda EMAS (u xavfsiz xotirada — storage.js). Brauzerda (web sinov) — localStorage.
// O'qish sinxron (kichik fayl, ekran chizilishidan oldin kerak), yozish — fonda.
import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";

const web = Platform.OS === "web";
const fileOf = (key) => new File(Paths.document, `yuk-cache-${key}.json`);

export function readCache(key) {
  try {
    const text = web ? globalThis.localStorage?.getItem(`yuk-cache-${key}`) : fileOf(key).exists ? fileOf(key).textSync() : null;
    return text ? JSON.parse(text) : null;
  } catch {
    return null; // buzilgan yoki o'qilmadi — keshsiz, serverdan
  }
}

export function writeCache(key, value) {
  try {
    if (web) {
      if (value == null) globalThis.localStorage?.removeItem(`yuk-cache-${key}`);
      else globalThis.localStorage?.setItem(`yuk-cache-${key}`, JSON.stringify(value));
      return;
    }
    const file = fileOf(key);
    if (value == null) {
      if (file.exists) file.delete();
      return;
    }
    file.write(JSON.stringify(value)).catch(() => {});
  } catch {
    // yozilmadi — keyingi safar serverdan
  }
}
