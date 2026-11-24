// Qisqa xabar ekran pastida («✅ Saqlandi»). Android'da — ToastAndroid; boshqa joyda (web sinov) — hech narsa.
import { Platform, ToastAndroid } from "react-native";

export function toast(text) {
  if (Platform.OS === "android") ToastAndroid.show(text, ToastAndroid.SHORT);
}
