// Kirish tokeni telefonning xavfsiz xotirasida (expo-secure-store: Android'da Keystore bilan shifrlanadi).
// Brauzerda (npx expo start --web — faqat sinash uchun) secure-store yo'q — u yerda localStorage.
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "yuk_token";
const web = Platform.OS === "web";

export async function loadToken() {
  try {
    if (web) return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null; // xotira o'qilmadi — qaytadan kiradi
  }
}

export async function saveToken(token) {
  try {
    if (web) {
      if (token) globalThis.localStorage?.setItem(TOKEN_KEY, token);
      else globalThis.localStorage?.removeItem(TOKEN_KEY);
      return;
    }
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Yozilmadi — token shu ochilishda xotirada yashaydi (session.js), keyingi ochilishda qayta kiradi
  }
}
