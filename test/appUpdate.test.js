import { test } from "node:test";
import assert from "node:assert/strict";
import { isOutdated, sizeText } from "../src/appUpdate.js";

test("isOutdated: serverdagi versionCode kattaroq bo'lsagina", () => {
  assert.equal(isOutdated(20, { versionCode: 21 }), true);
  assert.equal(isOutdated(21, { versionCode: 21 }), false);
  assert.equal(isOutdated(22, { versionCode: 21 }), false);
  assert.equal(isOutdated(20, null), false);
  assert.equal(isOutdated(null, { versionCode: 21 }), false); // web / versiyasi noma'lum — to'silmaydi
});

test("sizeText", () => {
  assert.equal(sizeText(31074273), "29.6 MB");
  assert.equal(sizeText(0), "");
});
