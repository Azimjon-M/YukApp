// Bildirishnoma bosilib ochilgan e'lon (notify.js yozadi, LoadsFeed o'qiydi): lenta darhol yangilanadi, e'lonni topib
// ekran tepasiga olib keladi va yashil hoshiya bilan belgilaydi (Azimjon, 2026-11-25: «bosilgan e'lon … yashil rangli va
// unga scroll qilingan, viewportda tepada bo'lishi kerak»). Ilova yopiq turganda bosilgan bo'lsa ham — lenta ochilguncha saqlanadi.
import { useSyncExternalStore } from "react";

let current = null; // { id, at }
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

export function setOpenPost(id) {
  if (id == null || id === "") return;
  current = { id: String(id), at: Date.now() };
  emit();
}
export function clearOpenPost() {
  if (!current) return;
  current = null;
  emit();
}
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const useOpenPost = () => useSyncExternalStore(subscribe, () => current, () => null);
