import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterChanged,
  filterFromProfile,
  profileFromFilter,
  setMode,
  toggleAllSources,
  toggleRegion,
  toggleSource,
  toggleTruck,
} from "../src/filterForm.js";

test("filterFromProfile: profil yo'q — hamma guruhlar, filtrsiz", () => {
  assert.deepEqual(filterFromProfile(null), { mode: "tezkor", sources: [], regions: [], trucks: [] });
});

test("filterFromProfile: guruhlarim + filtrlar", () => {
  const profile = { feed: { mode: "guruhlarim", sources: ["@Birinchi"], regions: ["fargona"], trucks: ["isuzu"] } };
  assert.deepEqual(filterFromProfile(profile), { mode: "guruhlarim", sources: ["@Birinchi"], regions: ["fargona"], trucks: ["isuzu"] });
});

test("toggle: mashina, viloyat, guruh (harf katta-kichikligi farqsiz)", () => {
  let form = filterFromProfile(null);
  form = toggleTruck(form, "fura");
  form = toggleRegion(toggleRegion(form, "andijon"), "andijon");
  assert.deepEqual(form.trucks, ["fura"]);
  assert.deepEqual(form.regions, []);
  form = toggleSource(form, "@Birinchi").form;
  form = toggleSource(form, "@birinchi").form;
  assert.deepEqual(form.sources, []);
});

test("toggleAllSources: hammasi tanlanadi, keyin olib tashlanadi", () => {
  const names = ["@A", "@B"];
  let form = { ...filterFromProfile(null), sources: ["@a"] };
  form = toggleAllSources(form, names);
  assert.deepEqual(form.sources, ["@a", "@B"]);
  form = toggleAllSources(form, names);
  assert.deepEqual(form.sources, []);
});

test("profileFromFilter: feed yoziladi, qolgan profil saqlanadi", () => {
  const old = { vehicle: null, domestic: true, international: false, fromAreas: ["x"], feed: { mode: "tezkor", sources: [] } };
  const form = toggleRegion(toggleTruck(filterFromProfile(old), "labo"), "fargona");
  const { profile, note } = profileFromFilter(form, old);
  assert.equal(note, null);
  assert.deepEqual(profile.feed, { mode: "tezkor", sources: [], regions: ["fargona"], trucks: ["labo"] });
  assert.deepEqual(profile.fromAreas, ["x"]);
});

test("profileFromFilter: tanlangan guruhlarsiz — hamma guruhlar (bot qoidasi)", () => {
  const form = setMode(filterFromProfile(null), "guruhlarim");
  const { profile, note } = profileFromFilter(form, null);
  assert.equal(profile.feed.mode, "tezkor");
  assert.ok(note);
});

test("filterChanged", () => {
  const profile = { feed: { mode: "tezkor", sources: [], trucks: ["fura", "isuzu"] } };
  const form = filterFromProfile(profile);
  assert.equal(filterChanged({ ...form, trucks: ["isuzu", "fura"] }, profile), false);
  assert.equal(filterChanged(toggleTruck(form, "labo"), profile), true);
});
