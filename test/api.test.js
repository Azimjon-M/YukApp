// src/api.js — soxta fetch bilan: sarlavhalar, 401 / 403, qayta urinish. Tarmoqqa chiqmaydi.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, configureApi, getLoads, getMe, request, requestLoginCode, verifyLoginCode } from "../src/api.js";

const reply = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json });

function setup(responses, { token = "TOK" } = {}) {
  const calls = [];
  const events = { authLost: 0, blocked: [] };
  const queue = [...responses];
  configureApi({
    baseUrl: "https://example.test",
    getToken: () => token,
    onAuthLost: () => events.authLost++,
    onBlocked: (message) => events.blocked.push(message),
    sleep: async () => {},
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  });
  return { calls, events };
}

test("token Bearer sarlavhada, JSON javob qaytadi", async () => {
  const { calls } = setup([reply(200, { chatId: 5 })]);
  assert.deepEqual(await getMe(), { chatId: 5 });
  assert.equal(calls[0].url, "https://example.test/pub/me");
  assert.equal(calls[0].headers.authorization, "Bearer TOK");
});

test("kod bilan kirish so'rovlari tokensiz, POST, tanasi JSON", async () => {
  const { calls } = setup([reply(200, { requestId: "r" }), reply(200, { token: "T" })]);
  await requestLoginCode("@ali_99");
  assert.equal(calls[0].url, "https://example.test/pub/auth/code");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].body), { login: "@ali_99" });
  await verifyLoginCode("r", "123456");
  assert.equal(calls[1].url, "https://example.test/pub/auth/code/verify");
  assert.deepEqual(JSON.parse(calls[1].body), { requestId: "r", code: "123456" });
});

test("xato javobning qo'shimcha maydonlari ApiError.data da; kirish so'rovi qayta yuborilmaydi", async () => {
  const { calls } = setup([reply(400, { error: "Kod noto'g'ri", code: "wrong", attemptsLeft: 2 }), reply(502, null)]);
  await assert.rejects(verifyLoginCode("r", "1"), (e) => e instanceof ApiError && e.code === "wrong" && e.data.attemptsLeft === 2);
  await assert.rejects(requestLoginCode("@a"), (e) => e.code === "offline");
  assert.equal(calls.length, 2);
});

test("401 token bilan — onAuthLost; tokensiz — yo'q", async () => {
  const { events } = setup([reply(401, { error: "Kirish kerak", code: "auth" })]);
  await assert.rejects(getMe(), (e) => e.code === "auth");
  assert.equal(events.authLost, 1);

  const second = setup([reply(401, { error: "x", code: "auth" })], { token: null });
  await assert.rejects(getMe());
  assert.equal(second.events.authLost, 0);
});

test("403 blocked — onBlocked matn bilan", async () => {
  const { events } = setup([reply(403, { error: "Uzr, sizga xizmat ko'rsata olmaymiz!", code: "blocked" })]);
  await assert.rejects(getMe(), (e) => e.code === "blocked");
  assert.deepEqual(events.blocked, ["Uzr, sizga xizmat ko'rsata olmaymiz!"]);
});

test("502 — qayta uradi (so'rov serverga yetmagan), keyin javob", async () => {
  const { calls } = setup([reply(502, null), reply(503, null), reply(200, { items: [], total: 0 })]);
  assert.deepEqual(await getLoads({ view: "all", hours: 24, from: "" }), { items: [], total: 0 });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].url, "https://example.test/pub/loads?view=all&hours=24"); // bo'sh from tashlandi
});

test("internet uzilishi: GET qayta uriladi, POST — yo'q (ikki marta bajarilmasin)", async () => {
  const net = new TypeError("Network request failed");
  const get = setup([net, reply(200, { ok: true })]);
  assert.deepEqual(await request("GET", "/pub/me"), { ok: true });
  assert.equal(get.calls.length, 2);

  const post = setup([net, reply(200, { ok: true })]);
  await assert.rejects(request("POST", "/pub/me/logout"), (e) => e.code === "offline");
  assert.equal(post.calls.length, 1);
});

test("JSON emas (nginx sahifasi) — «Server hozir ishlamayapti»", async () => {
  setup([{ ok: false, status: 404, json: async () => { throw new SyntaxError("html"); } }]);
  await assert.rejects(request("GET", "/pub/me", { retry: false }), (e) => e.code === "offline" && e.status === 404);
});
