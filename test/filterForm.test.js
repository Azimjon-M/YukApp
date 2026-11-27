import { test } from "node:test";
import assert from "node:assert/strict";
import { REGION_IDS, TRUCK_FILTER_IDS } from "@yuk/shared";
import {
  PICK_ONE,
  filterChanged,
  filterErrors,
  filterFromProfile,
  profileFromFilter,
  setMode,
  toggleAllRegions,
  toggleAllSources,
  toggleAllTrucks,
  toggleRegion,
  toggleSource,
  toggleTruck,
} from "../src/filterForm.js";

test("filterFromProfile: profil yo'q — hamma guruhlar, filtrsiz", () => {
  assert.deepEqual(filterFromProfile(null), { mode: "tezkor", sources: [], regions: [], trucks: [] });
});

test("filterFromProfile: saqlangan profilda bo'sh ro'yxat — hammasi belgilangan", () => {
  const form = filterFromProfile({ feed: { mode: "tezkor", sources: [] } });
  assert.deepEqual(form.trucks, TRUCK_FILTER_IDS);
  assert.deepEqual(form.regions, REGION_IDS);
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
  const old = { vehicle: null, domestic: true, international: false, fromAreas: ["x"], feed: { mode: "tezkor", sources: [], trucks: ["fura", "labo"], regions: ["andijon", "fargona"] } };
  const form = toggleRegion(toggleTruck(filterFromProfile(old), "fura"), "andijon");
  const { profile, note } = profileFromFilter(form, old);
  assert.equal(note, null);
  assert.deepEqual(profile.feed, { mode: "tezkor", sources: [], regions: ["fargona"], trucks: ["labo"] });
  assert.deepEqual(profile.fromAreas, ["x"]);
});

test("validatsiya: mashina va qayerdan — kamida 1 ta", () => {
  const empty = filterFromProfile(null);
  assert.deepEqual(filterErrors(empty), { trucks: PICK_ONE, regions: PICK_ONE });
  const result = profileFromFilter(toggleTruck(empty, "fura"), null);
  assert.equal(result.error, PICK_ONE);
  assert.deepEqual(result.errors, { regions: PICK_ONE });
  assert.equal(result.profile, undefined);
});

test("«Hammasi»: hammasi belgilanadi/olinadi, serverga bo'sh ro'yxat (= hammasi) boradi", () => {
  let form = toggleAllRegions(toggleAllTrucks(filterFromProfile(null)));
  assert.deepEqual(form.trucks, TRUCK_FILTER_IDS);
  const { profile } = profileFromFilter(form, null);
  assert.equal(profile.feed.trucks, undefined);
  assert.equal(profile.feed.regions, undefined);
  form = toggleAllTrucks(form);
  assert.deepEqual(form.trucks, []);
});

test("profileFromFilter: tanlangan guruhlarsiz — hamma guruhlar (bot qoidasi)", () => {
  const form = setMode(toggleAllRegions(toggleAllTrucks(filterFromProfile(null))), "guruhlarim");
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

test("guruh limiti obunaga qarab (2026-11-27): Free 30, Pro 100; «hammasini tanlash» ham shu chegarada", async () => {
  const { toggleSource, toggleAllSources, sourcesMax } = await import("../src/filterForm.js");
  const names = Array.from({ length: 120 }, (_, i) => `@guruh_${i}_yuk`);
  let form = { mode: "guruhlarim", sources: names.slice(0, 30), regions: [], trucks: [] };
  assert.match(toggleSource(form, "@yana_guruh", "free").error, /Free obunada ko'pi bilan 30 ta/);
  assert.ok(toggleSource(form, "@yana_guruh", "pro").form);
  assert.equal(toggleAllSources({ ...form, sources: [] }, names, "pro").sources.length, 100);
  assert.deepEqual([sourcesMax("free"), sourcesMax("max"), sourcesMax(undefined)], [30, 300, 300]);
});
