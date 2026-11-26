// «Bot orqali kirish» holatlar mashinasi (src/botLogin.js) — soxta server, soxta uyqu va soat bilan.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../src/api.js";
import { createBotLogin } from "../src/botLogin.js";

const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup({ answers = [], start = async () => ({ code: "C".repeat(32), url: "https://t.me/b?start=app_X", expiresIn: 600, pollMs: 2000 }) } = {}) {
  let time = 0;
  const seen = { states: [], opened: [], polls: 0, done: null };
  const flow = createBotLogin({
    start,
    poll: async () => {
      seen.polls++;
      const next = answers.shift() ?? { status: "pending" };
      if (next instanceof Error) throw next;
      return next;
    },
    openUrl: (url) => seen.opened.push(url),
    onChange: (s) => seen.states.push(s.step),
    onDone: (answer) => (seen.done = answer),
    now: () => time,
    sleep: async () => {
      time += 2000;
    },
  });
  return { flow, seen, setTime: (t) => (time = t) };
}

test("tasdiqlansa — kiradi, offline xatoda so'rashda davom etadi", async () => {
  const offline = new ApiError("x", { code: "offline" });
  const { flow, seen } = setup({ answers: [{ status: "pending" }, offline, { token: "T", me: { chatId: 1 } }] });
  await flow.begin();
  for (let i = 0; i < 10; i++) await tick();
  assert.deepEqual(seen.opened, ["https://t.me/b?start=app_X"]);
  assert.equal(seen.polls, 3);
  assert.deepEqual(seen.done, { token: "T", me: { chatId: 1 } });
  assert.equal(flow.state.step, "done");
});

test("kod eskirsa (410) — xato matni va boshiga", async () => {
  const { flow, seen } = setup({ answers: [new ApiError("Kirish kodi eskirgan", { status: 410, code: "expired" })] });
  await flow.begin();
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(flow.state.step, "idle");
  assert.equal(flow.state.error, "Kirish kodi eskirgan");
  assert.equal(seen.done, null);
});

test("bekor qilinsa — so'rash to'xtaydi", async () => {
  const { flow, seen } = setup();
  await flow.begin();
  flow.cancel();
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(flow.state.step, "idle");
  assert.ok(seen.polls <= 1);
  assert.equal(seen.done, null);
});

test("server xatosi boshida — xato ko'rsatiladi, bot ochilmaydi", async () => {
  const { flow, seen } = setup({ start: async () => Promise.reject(new ApiError("Juda ko'p urinish", { status: 429 })) });
  await flow.begin();
  assert.equal(flow.state.error, "Juda ko'p urinish");
  assert.deepEqual(seen.opened, []);
});
