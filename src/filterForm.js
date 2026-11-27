// «🎛 Filtr» formasining toza qismi (React'siz — node --test bilan tekshiriladi). Botdagi «🎛 Filtr» oynasi bilan bir xil:
//   manba — 🌐 Hamma guruhlar (tezkor) yoki 📌 Faqat tanlangan guruhlar (guruhlarim);
//   🚚 Mashina turi (fura / isuzu / bongo / labo) va 📍 Qayerdan (viloyatlar) — kamida bittasi SHART (Azimjon, 2026-11-26:
//   «tanlamasam ham ishlamoqda… validatsiya kerak»), «✓ Hammasi» bilan hammasini birdan. Serverga hammasi tanlangani
//   bo'sh ro'yxat bo'lib boradi (bo'sh = hammasi, joyi yozilmagan e'lonlar ham) — bot va eski profillar shu ma'noda.
// Qoidalar @yuk/shared feed.js da (bot va server ham shu bilan tekshiradi).
import { FEED_SOURCES_MAX, PLANS, sourcesLimitText, REGION_IDS, TRUCK_FILTER_IDS, choiceMode, emptyProfile, feedOf, sanitizeFeed } from "@yuk/shared";

export const PICK_ONE = "Iltimos, kamida 1 ta tanlang";

// Profil → forma. Eski «🎯 Saralangan» rejim tanlovda yo'q — «Hamma guruhlar» deb ko'rsatiladi (bot ham shunday).
// Saqlangan profilda bo'sh ro'yxat = hammasi (hammasi belgilangan ko'rinadi); profil hali yo'q — hech narsa belgilanmagan,
// odam o'zi tanlaydi
export function filterFromProfile(profile) {
  const feed = feedOf(profile);
  const all = (list, ids) => (list.length || !profile ? [...list] : [...ids]);
  return {
    mode: choiceMode(feed.mode),
    sources: [...feed.sources],
    regions: all(feed.regions, REGION_IDS),
    trucks: all(feed.trucks, TRUCK_FILTER_IDS),
  };
}

export const allTrucks = (form) => TRUCK_FILTER_IDS.every((id) => form.trucks.includes(id));
export const allRegions = (form) => REGION_IDS.every((id) => form.regions.includes(id));
// «✓ Hammasi»: hammasi belgilangan bo'lsa — hammasi olinadi, bo'lmasa — hammasi belgilanadi
export const toggleAllTrucks = (form) => ({ ...form, trucks: allTrucks(form) ? [] : [...TRUCK_FILTER_IDS] });
export const toggleAllRegions = (form) => ({ ...form, regions: allRegions(form) ? [] : [...REGION_IDS] });

// Qaysi bo'limda hech narsa tanlanmagan: { trucks?: PICK_ONE, regions?: PICK_ONE } (bo'sh — hammasi joyida)
export function filterErrors(form) {
  const errors = {};
  if (!form.trucks.length) errors.trucks = PICK_ONE;
  if (!form.regions.length) errors.regions = PICK_ONE;
  return errors;
}

const toggled = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
const sameKey = (a, b) => a.toLowerCase() === b.toLowerCase();

export const toggleTruck = (form, id) => ({ ...form, trucks: toggled(form.trucks, id) });
export const toggleRegion = (form, id) => ({ ...form, regions: toggled(form.regions, id) });
export const setMode = (form, mode) => ({ ...form, mode });

export const hasSource = (form, name) => form.sources.some((n) => sameKey(n, name));

// Obuna bo'yicha nechta guruh tanlash mumkin (2026-11-27: Free 30, Pro 100, Max 300 — @yuk/shared roles.js); noma'lum — eng kattasi
export const sourcesMax = (plan) => PLANS[plan]?.maxSources ?? FEED_SOURCES_MAX;

// Guruhni belgilash / olib tashlash → { form } yoki { error }. plan — me.plan (free | pro | max)
export function toggleSource(form, name, plan = null) {
  if (hasSource(form, name)) return { form: { ...form, sources: form.sources.filter((n) => !sameKey(n, name)) } };
  const max = sourcesMax(plan);
  if (form.sources.length >= max) return { error: PLANS[plan] ? sourcesLimitText(plan) : `Ko'pi bilan ${max} ta guruh tanlash mumkin` };
  return { form: { ...form, sources: [...form.sources, name] } };
}

// «☑️ Hammasini tanlash» / «▫️ Hammasini olib tashlash»: names — ro'yxatdagi tanlasa bo'ladigan guruhlar
export function toggleAllSources(form, names, plan = null) {
  const all = names.length > 0 && names.every((name) => hasSource(form, name));
  if (all) return { ...form, sources: form.sources.filter((n) => !names.some((name) => sameKey(n, name))) };
  const extra = names.filter((name) => !hasSource(form, name));
  return { ...form, sources: [...form.sources, ...extra].slice(0, sourcesMax(plan)) };
}

// Forma → serverga yuboriladigan profil: { profile, note? } yoki { error, errors } (errors — filterErrors).
// Mashina va hudud eskisicha qoladi (server tekshiradi: mashinasiz rejimda mashina bo'lmasa ham bo'ladi), faqat feed o'zgaradi.
// Bot qoidasi: «📌 Tanlangan guruhlar» da birorta guruh belgilanmasa — «🌐 Hamma guruhlar» deb saqlanadi
export function profileFromFilter(form, profile) {
  const errors = filterErrors(form);
  if (Object.keys(errors).length) return { error: PICK_ONE, errors };
  let mode = form.mode;
  let note = null;
  if (mode === "guruhlarim" && form.sources.length === 0) {
    mode = "tezkor";
    note = "Guruh tanlanmadi — 🌐 hamma guruhlardan keladi";
  }
  const result = sanitizeFeed({
    mode,
    sources: form.sources,
    regions: allRegions(form) ? [] : form.regions,
    trucks: allTrucks(form) ? [] : form.trucks,
  });
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
