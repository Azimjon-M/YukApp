// «↑» tugmasi mantig'i (Telegram'dagidek): pastga aylantirib turganda tepadan kelgan, hali ko'rilmagan e'lonlar sanaladi.
// Bosilsa — avval ko'rilmaganlarning ENG ESKISIga (siz turgan joydan darhol yuqoridagi, masalan 100 tadan 100-chisiga),
// yana bosilsa — eng tepaga. Ro'yxat tartibi: 0 — eng yangisi (LoadsFeed fresh10).
// Sof funksiyalar — test/unseenJump.test.js

// Yangi kelganlar: tepada turgan bo'lsa ular darhol ko'rinadi — sanalmaydi; pastda bo'lsa — ko'rilmagan
export function addUnseen(unseen, freshIds, atTop) {
  if (atTop || !freshIds.length) return unseen;
  const next = new Set(unseen);
  for (const id of freshIds) next.add(id);
  return next;
}

// Ekranga chiqqanlar va ro'yxatdan tushib ketganlar (10 daqiqadan eskisi) chiqariladi
export function dropUnseen(unseen, viewedIds, items) {
  if (!unseen.size) return unseen;
  const alive = new Set(items.map((item) => item.id));
  const next = new Set([...unseen].filter((id) => alive.has(id) && !viewedIds.includes(id)));
  return next.size === unseen.size ? unseen : next;
}

// Bosilganda qayerga: { index } — eng eski ko'rilmagan e'lon, yoki { top: true }
export function jumpTarget(items, unseen, jumped) {
  if (!jumped && unseen.size) {
    let index = -1;
    items.forEach((item, i) => {
      if (unseen.has(item.id)) index = i; // eng pastdagisi = eng eskisi
    });
    if (index >= 0) return { index };
  }
  return { top: true };
}

// Tugmadagi son: ko'pi bilan 99 (Azimjon: «max 99 da to'xtasin»)
export const unseenText = (count) => String(Math.min(count, 99));
