import { test } from "node:test";
import assert from "node:assert/strict";
import { addUnseen, dropUnseen, jumpTarget, unseenText } from "../src/unseenJump.js";

const list = (n) => Array.from({ length: n }, (_, i) => ({ id: n - i })); // 0 — eng yangisi

test("tepada turganda yangilari sanalmaydi", () => {
  const unseen = new Set();
  assert.equal(addUnseen(unseen, [5, 6], true), unseen);
  assert.deepEqual([...addUnseen(unseen, [5, 6], false)], [5, 6]);
});

test("100 ta yangi: birinchi bosish — 100-chisiga (eng eskisiga), keyingisi — tepaga", () => {
  const items = list(110); // id 110..1; yangilari 11..110 → index 0..99
  const unseen = addUnseen(new Set(), items.slice(0, 100).map((item) => item.id), false);
  assert.deepEqual(jumpTarget(items, unseen, false), { index: 99 });
  assert.deepEqual(jumpTarget(items, unseen, true), { top: true });
  assert.deepEqual(jumpTarget(items, new Set(), false), { top: true });
});

test("ko'rilgan va eskirib ketganlar chiqariladi", () => {
  const items = list(5);
  const unseen = new Set([5, 4, 3, 99]);
  assert.deepEqual([...dropUnseen(unseen, [3], items)], [5, 4]);
  const same = new Set([5]);
  assert.equal(dropUnseen(same, [], items), same);
});

test("son matni", () => {
  assert.equal(unseenText(7), "7");
  assert.equal(unseenText(150), "99+");
});
