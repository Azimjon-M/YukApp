// «Kod bilan kirish» holatlar mashinasi (src/codeLogin.js) — soxta server va soxta soat bilan. Tarmoqqa chiqmaydi.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../src/api.js";
import { BAD_LOGIN, createCodeLogin, parseLogin } from "../src/codeLogin.js";

const fail = (status, code, data = {}) => new ApiError(data.error ?? code, { status, code, data });

function setup({ request = async () => ({ requestId: "r1", expiresIn: 300, resendIn: 60, digits: 6 }), verify = async () => ({ token: "T", me: { chatId: 1 } }) } = {}) {
  let time = 1_000_000;
  const seen = { states: [], done: null, requests: [], verifies: [] };
  const flow = createCodeLogin({
    requestCode: async (login) => {
      seen.requests.push(login);
      return request(login);
    },
    verifyCode: async (id, code) => {
      seen.verifies.push([id, code]);
      return verify(id, code);
    },
    onChange: (s) => seen.states.push(s),
    onDone: (answer) => (seen.done = answer),
    now: () => time,
  });
  return { flow, seen, advance: (ms) => (time += ms) };
}

test("parseLogin: telefon raqami va username", () => {
  assert.deepEqual(parseLogin("90 123 45 67"), { login: "+998901234567", kind: "phone" });
  assert.deepEqual(parseLogin("+998 (90) 123-45-67"), { login: "+998901234567", kind: "phone" });
  assert.deepEqual(parseLogin("@Ali_99"), { login: "@Ali_99", kind: "username" });
  assert.deepEqual(parseLogin("  ali_99 "), { login: "@ali_99", kind: "username" });
  assert.equal(parseLogin("12345"), null);
  assert.equal(parseLogin("@ab"), null);
  assert.equal(parseLogin(""), null);
});

test("noto'g'ri yozilgan — serverga so'rov yo'q, tushuntirish", async () => {
  const { flow, seen } = setup();
  await flow.submit("90 12 3");
  assert.equal(seen.requests.length, 0);
  assert.equal(flow.state.error, BAD_LOGIN);
});

test("to'liq yo'l: kod so'raladi, to'g'ri kod — kirdi; requestId holatga chiqmaydi", async () => {
  const { flow, seen } = setup();
  await flow.submit("90 123 45 67");
  assert.deepEqual(seen.requests, ["+998901234567"]);
  assert.equal(flow.state.step, "code");
  assert.equal(flow.state.digits, 6);
  await flow.confirm("123 456");
  assert.deepEqual(seen.verifies, [["r1", "123456"]]);
  assert.equal(flow.state.step, "done");
  assert.deepEqual(seen.done, { token: "T", me: { chatId: 1 } });
  assert.ok(seen.states.every((s) => !JSON.stringify(s).includes("r1")));
});

test("bizda yo'q / a'zo emas / botni to'xtatgan — ro'yxatdan o'tish yo'riqnomasi", async () => {
  for (const [code, data] of [["not_found", {}], ["not_member", { missing: [{ title: "Yuk Ekspert", url: "https://t.me/Yuk_Ekspert" }] }], ["bot_blocked", {}]]) {
    const { flow } = setup({ request: async () => Promise.reject(fail(code === "bot_blocked" ? 409 : code === "not_found" ? 404 : 403, code, data)) });
    await flow.submit("@ali_99");
    assert.equal(flow.state.step, "enter");
    assert.equal(flow.state.problem, code);
    assert.deepEqual(flow.state.missing, data.missing ?? []);
  }
});

test("429 — kutish vaqti bilan matn", async () => {
  const { flow } = setup({ request: async () => Promise.reject(fail(429, "limit", { retryIn: 300 })) });
  await flow.submit("@ali_99");
  assert.match(flow.state.error, /5 daqiqa/);
});

test("noto'g'ri kod — qolgan urinishlar; kod uzunligi tekshiriladi", async () => {
  const { flow, seen } = setup({ verify: async () => Promise.reject(fail(400, "wrong", { attemptsLeft: 3 })) });
  await flow.submit("@ali_99");
  await flow.confirm("12");
  assert.equal(seen.verifies.length, 0);
  assert.match(flow.state.error, /6 xonali/);
  await flow.confirm("111111");
  assert.equal(flow.state.step, "code");
  assert.match(flow.state.error, /3 ta urinish/);
});

test("kod eskirdi (vaqt yoki 410) — qayta yuborish ishlaydi; muddatidan oldin qayta yuborilmaydi", async () => {
  const { flow, seen, advance } = setup();
  await flow.submit("@ali_99");
  flow.resend(); // 60 s o'tmagan
  assert.equal(seen.requests.length, 1);
  advance(301_000);
  await flow.confirm("123456");
  assert.equal(seen.verifies.length, 0);
  assert.equal(flow.state.expired, true);
  await flow.resend();
  assert.equal(seen.requests.length, 2);
  assert.equal(flow.state.step, "code");
  assert.equal(flow.state.expired, false);

  const second = setup({ verify: async () => Promise.reject(fail(410, "expired")) });
  await second.flow.submit("@ali_99");
  await second.flow.confirm("123456");
  assert.equal(second.flow.state.expired, true);
});

test("«Boshqa raqam» dan keyin eski so'rov javobi holatni buzmaydi", async () => {
  let release;
  const { flow } = setup({ request: () => new Promise((resolve) => (release = () => resolve({ requestId: "old" }))) });
  const pending = flow.submit("@ali_99");
  flow.back();
  release();
  await pending;
  assert.equal(flow.state.step, "enter");
});
