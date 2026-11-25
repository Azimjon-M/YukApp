// Bildirishnomaga ruxsat qachon so'raladi (Azimjon, 2026-11-25: «ilovamiz boshida so'rattirsang … skip qilsa bo'ladigan …
// o'chiq bo'lsa qanchadur muddatda yana so'ratish kerak muloyimlik bilan va unga ham skip qo'sh»):
//   birinchi kirishda — «first» (Yoqish / Keyinroq);
//   o'chiq qolsa — har 3 kunda bir — «again» (Yoqish / Keyinroq / Kerak emas);
//   «Kerak emas» — boshqa so'ralmaydi (Sozlamalardan o'zi yoqishi mumkin).
// Sof funksiyalar — test/notifyAsk.test.js
export const RE_ASK_MS = 3 * 24 * 3600_000;

// saved — telefonda saqlangan holat: { asked: true, skippedAt: ms, never: true }
export function askKind(granted, saved, now) {
  if (granted || saved?.never) return null;
  if (!saved?.asked) return "first";
  return now - (saved.skippedAt ?? 0) >= RE_ASK_MS ? "again" : null;
}

export const afterSkip = (saved, now) => ({ ...saved, asked: true, skippedAt: now });
export const afterNever = (saved) => ({ ...saved, asked: true, never: true });
// «Yoqish» bosildi (ruxsat berdimi yo'qmi — baribir): keyin o'chirsa, 3 kundan keyin yana muloyim so'raladi
export const afterAsk = (saved, now) => ({ ...saved, asked: true, skippedAt: now, never: false });

export function parseSaved(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
