import { test } from "node:test";
import assert from "node:assert/strict";
import { RE_ASK_MS, afterAsk, afterNever, afterSkip, askKind, parseSaved } from "../src/notifyAsk.js";

test("birinchi marta — first, ruxsat bor — so'ralmaydi", () => {
  assert.equal(askKind(false, {}, 1000), "first");
  assert.equal(askKind(true, {}, 1000), null);
});

test("Keyinroq — 3 kundan keyin again", () => {
  const saved = afterSkip({}, 0);
  assert.equal(askKind(false, saved, RE_ASK_MS - 1), null);
  assert.equal(askKind(false, saved, RE_ASK_MS), "again");
});

test("Kerak emas — boshqa so'ralmaydi; Yoqish keyin o'chirilsa — 3 kunda yana", () => {
  assert.equal(askKind(false, afterNever(afterSkip({}, 0)), 10 * RE_ASK_MS), null);
  const asked = afterAsk({ never: true }, 5);
  assert.equal(askKind(false, asked, 5 + RE_ASK_MS), "again");
});

test("saqlangan matn buzuq bo'lsa — bo'sh", () => {
  assert.deepEqual(parseSaved("{bad"), {});
  assert.deepEqual(parseSaved(null), {});
  assert.deepEqual(parseSaved('{"asked":true}'), { asked: true });
});
