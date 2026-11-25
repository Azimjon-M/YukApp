// Bildirishnoma bosilib ochilgan e'lon (notify.js yozadi, LoadsFeed o'qiydi): lenta darhol yangilanadi, e'lonni topib
// ekran tepasiga olib keladi va yashil hoshiya bilan belgilaydi (Azimjon, 2026-11-25: «bosilgan e'lon … yashil rangli va
// unga scroll qilingan, viewportda tepada bo'lishi kerak»). Ilova yopiq turganda bosilgan bo'lsa ham — lenta ochilguncha saqlanadi.
import { useSyncExternalStore } from "react";

let current = null; // { id, item, at } — item: bildirishnoma ichida kelgan e'lonning o'zi (server push.js), bo'lmasa null
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

export function setOpenPost(id, item = null) {
  if (id == null || id === "") return;
  const ok = item && typeof item === "object" && String(item.id) === String(id) && item.post && item.load;
  current = { id: String(id), item: ok ? item : null, at: Date.now() };
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
