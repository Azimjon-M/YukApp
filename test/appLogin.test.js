// «Telegram orqali kirish» holatlar mashinasi (src/appLogin.js) — soxta server, soxta Telegram va soxta soat bilan.
// Haqiqiy serverga hech narsa yuborilmaydi. Ishga tushirish: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../src/api.js";
import { OPEN_FAILED, createAppLogin } from "../src/appLogin.js";

const TICKET = { code: "kod123", url: "https://t.me/Bot?start=app_kod123", tgUrl: "tg://resolve?domain=Bot&start=app_kod123", expiresIn: 600, pollMs: 2000 };

// Soxta soat: setTimer vazifalarni yig'adi, tick(ms) vaqtni suradi va muddati kelganlarini bajaradi
function fakeClock() {
  let time = 0;
  let next = 1;
  const tasks = new Map();
  return {
    now: () => time,
    setTimer: (fn, ms) => {
      const id = next++;
      tasks.set(id, { fn, at: time + ms });
      return id;
    },
    clearTimer: (id) => tasks.delete(id),
    pending: () => tasks.size,
    async tick(ms) {
      time += ms;
      for (const [id, task] of [...tasks]) {
        if (task.at <= time) {
          tasks.delete(id);
          task.fn();
        }
      }
      // so'rov javoblari (Promise) yetib kelsin
      for (let i = 0; i < 10; i++) await Promise.resolve();
    },
  };
}

function setup({ answers = [], start = async () => TICKET, open = async () => {} } = {}) {
  const clock = fakeClock();
  const seen = { states: [], done: null, checks: [], opened: [] };
  const queue = [...answers];
  const login = createAppLogin({
    start,
    check: async (code) => {
      seen.checks.push(code);
      const answer = queue.shift() ?? { status: "pending" };
      if (answer instanceof Error) throw answer;
      return answer;
    },
    open: async (ticket) => {
      seen.opened.push(ticket.tgUrl);
      return open(ticket);
    },
    onChange: (state) => seen.states.push(state.step),
    onDone: (answer) => {
      seen.done = answer;
    },
    ...clock,
  });
  return { login, clock, seen };
}

test("tugma → Telegram ochiladi → kutadi → bot tasdiqlasa token beradi", async () => {
  const { login, clock, seen } = setup({
    answers: [{ status: "pending" }, { token: "TOKEN", me: { chatId: 1, role: null } }],
  });
  await login.begin();
  assert.equal(login.state.step, "waiting");
  assert.deepEqual(seen.opened, [TICKET.tgUrl]);
  assert.equal(seen.checks.length, 0); // darhol emas — pollMs dan keyin

  await clock.tick(2000);
  assert.deepEqual(seen.checks, ["kod123"]);
  assert.equal(login.state.step, "waiting");

  await clock.tick(2000);
  assert.equal(login.state.step, "done");
  assert.deepEqual(seen.done, { token: "TOKEN", me: { chatId: 1, role: null } });
  assert.equal(clock.pending(), 0); // boshqa so'ralmaydi
});

test("410 — kod eskirdi: so'rash to'xtaydi, «Qaytadan urinish» yangi kod oladi", async () => {
  let starts = 0;
  const { login, clock, seen } = setup({
    answers: [new ApiError("Kirish kodi eskirgan", { status: 410, code: "expired" })],
    start: async () => {
      starts++;
      return TICKET;
    },
  });
  await login.begin();
  await clock.tick(2000);
  assert.equal(login.state.step, "expired");
  assert.equal(clock.pending(), 0);

  await login.begin();
  assert.equal(starts, 2);
  assert.equal(login.state.step, "waiting");
  assert.equal(seen.opened.length, 2);
});

test("10 daqiqa o'tsa server so'ralmaydi — o'zi eskiradi", async () => {
  const { login, clock, seen } = setup();
  await login.begin();
  for (let i = 0; i < 300; i++) await clock.tick(2000);
  assert.equal(login.state.step, "expired");
  assert.ok(seen.checks.length <= 300);
  assert.equal(clock.pending(), 0);
});

test("internet uzilsa — kutish davom etadi, sekinroq, keyin o'zi tiklanadi", async () => {
  const offline = new ApiError("Server bilan aloqa yo'q", { code: "offline" });
  const { login, clock, seen } = setup({ answers: [offline, { status: "pending" }, { token: "T", me: null }] });
  await login.begin();
  await clock.tick(2000);
  assert.equal(login.state.step, "waiting");
  assert.equal(login.state.offline, true);

  await clock.tick(2000); // 5 s kutadi — hali so'ramaydi
  assert.equal(seen.checks.length, 1);
  await clock.tick(3000);
  assert.equal(seen.checks.length, 2);
  assert.equal(login.state.offline, false);

  await clock.tick(2000);
  assert.equal(login.state.step, "done");
});

test("ilovaga qaytganda (resume) kutmasdan darhol so'raydi", async () => {
  const { login, clock, seen } = setup({ answers: [{ token: "T", me: null }] });
  await login.begin();
  login.resume();
  await clock.tick(0);
  assert.equal(seen.checks.length, 1);
  assert.equal(login.state.step, "done");
});

test("bir vaqtda ikki so'rov ketmaydi (resume so'rov ketayotganda)", async () => {
  let release;
  const { login, clock } = setup();
  const seenChecks = [];
  // check sekin javob beradigan qilib almashtiramiz
  const slow = createAppLogin({
    start: async () => TICKET,
    check: (code) => {
      seenChecks.push(code);
      return new Promise((resolve) => {
        release = () => resolve({ status: "pending" });
      });
    },
    open: async () => {},
    ...clock,
  });
  login.dispose();
  await slow.begin();
  await clock.tick(2000);
  slow.resume();
  slow.resume();
  assert.equal(seenChecks.length, 1);
  release();
  await clock.tick(0);
  await clock.tick(2000);
  assert.equal(seenChecks.length, 2);
  slow.dispose();
});

test("Telegram ochilmasa — xabar, lekin kutish davom etadi; «qayta ochish» ishlasa xabar yo'qoladi", async () => {
  let fail = true;
  const { login } = setup({
    open: async () => {
      if (fail) throw new Error("No app");
    },
  });
  await login.begin();
  assert.equal(login.state.step, "waiting");
  assert.equal(login.state.error, OPEN_FAILED);
  fail = false;
  await login.reopen();
  assert.equal(login.state.error, null);
});

test("kod olib bo'lmasa (masalan 429) — xato, so'rash boshlanmaydi", async () => {
  const { login, clock } = setup({
    start: async () => {
      throw new ApiError("Juda ko'p urinish", { status: 429 });
    },
  });
  await login.begin();
  assert.equal(login.state.step, "error");
  assert.equal(login.state.error, "Juda ko'p urinish");
  assert.equal(clock.pending(), 0);
});

test("bekor qilish va ekran yopilishi — kechikkan javob hech narsani o'zgartirmaydi", async () => {
  const { login, clock, seen } = setup({ answers: [{ token: "T", me: null }] });
  await login.begin();
  login.cancel();
  assert.equal(login.state.step, "idle");
  await clock.tick(5000);
  assert.equal(seen.checks.length, 0);
  assert.equal(seen.done, null);

  await login.begin();
  login.dispose();
  await clock.tick(5000);
  assert.equal(seen.done, null);
});

test("kod holatga chiqmaydi (faqat step / error / offline)", async () => {
  const { login } = setup();
  await login.begin();
  assert.deepEqual(Object.keys(login.state).sort(), ["error", "offline", "step"]);
  assert.ok(!JSON.stringify(login.state).includes("kod123"));
  login.dispose();
});
