// «🎛 Filtr» formasining toza qismi (React'siz — node --test bilan tekshiriladi). Botdagi «🎛 Filtr» oynasi bilan bir xil:
//   manba — 🌐 Hamma guruhlar (tezkor) yoki 📌 Faqat tanlangan guruhlar (guruhlarim);
//   🚚 Mashina turi (fura / isuzu / bongo / labo) va 📍 Qayerdan (viloyatlar) — ixtiyoriy, tanlanmasa hammasi.
// Qoidalar @yuk/shared feed.js da (bot va server ham shu bilan tekshiradi).
import { FEED_SOURCES_MAX, choiceMode, emptyProfile, feedOf, sanitizeFeed } from "@yuk/shared";

// Profil → forma. Eski «🎯 Saralangan» rejim tanlovda yo'q — «Hamma guruhlar» deb ko'rsatiladi (bot ham shunday)
export function filterFromProfile(profile) {
  const feed = feedOf(profile);
  return {
    mode: choiceMode(feed.mode),
    sources: [...feed.sources],
    regions: [...feed.regions],
    trucks: [...feed.trucks],
  };
}

const toggled = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
const sameKey = (a, b) => a.toLowerCase() === b.toLowerCase();

export const toggleTruck = (form, id) => ({ ...form, trucks: toggled(form.trucks, id) });
export const toggleRegion = (form, id) => ({ ...form, regions: toggled(form.regions, id) });
export const setMode = (form, mode) => ({ ...form, mode });

export const hasSource = (form, name) => form.sources.some((n) => sameKey(n, name));

// Guruhni belgilash / olib tashlash → { form } yoki { error } (ko'pi bilan FEED_SOURCES_MAX ta)
export function toggleSource(form, name) {
  if (hasSource(form, name)) return { form: { ...form, sources: form.sources.filter((n) => !sameKey(n, name)) } };
  if (form.sources.length >= FEED_SOURCES_MAX) return { error: `Ko'pi bilan ${FEED_SOURCES_MAX} ta guruh tanlash mumkin` };
  return { form: { ...form, sources: [...form.sources, name] } };
}

// «☑️ Hammasini tanlash» / «▫️ Hammasini olib tashlash»: names — ro'yxatdagi tanlasa bo'ladigan guruhlar
export function toggleAllSources(form, names) {
  const all = names.length > 0 && names.every((name) => hasSource(form, name));
  if (all) return { ...form, sources: form.sources.filter((n) => !names.some((name) => sameKey(n, name))) };
  const extra = names.filter((name) => !hasSource(form, name));
  return { ...form, sources: [...form.sources, ...extra].slice(0, FEED_SOURCES_MAX) };
}

// Forma → serverga yuboriladigan profil: { profile, note? } yoki { error }.
// Mashina va hudud eskisicha qoladi (server tekshiradi: mashinasiz rejimda mashina bo'lmasa ham bo'ladi), faqat feed o'zgaradi.
// Bot qoidasi: «📌 Tanlangan guruhlar» da birorta guruh belgilanmasa — «🌐 Hamma guruhlar» deb saqlanadi
export function profileFromFilter(form, profile) {
  let mode = form.mode;
  let note = null;
  if (mode === "guruhlarim" && form.sources.length === 0) {
    mode = "tezkor";
    note = "Guruh tanlanmadi — 🌐 hamma guruhlardan keladi";
  }
  const result = sanitizeFeed({ mode, sources: form.sources, regions: form.regions, trucks: form.trucks });
  if (result.error) return { error: result.error };
  const base = profile ?? emptyProfile();
  return { profile: { ...base, feed: result.feed }, note };
}

// Saqlanmagan o'zgarish bormi (tartib farqi hisobga olinmaydi)
export function filterChanged(form, profile) {
  const a = filterFromProfile(profile);
  const same = (x, y) => x.length === y.length && x.every((v) => y.some((w) => sameKey(v, w)));
  return a.mode !== form.mode || !same(a.trucks, form.trucks) || !same(a.regions, form.regions) || !same(a.sources, form.sources);
}
