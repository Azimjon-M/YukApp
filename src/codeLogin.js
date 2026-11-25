// «Kod bilan kirish» (2026-11-24, Azimjon: «telefon raqami yoki username ni kiritsin, agar bizda bo'lsagina botdan kod
// olsin va ilovaga kiritib accountga kirsin»). Qadamlar:
//   1) odam telefon raqami yoki @username yozadi → POST /pub/auth/code { login }
//   2) bizda bo'lsa bot uning Telegram'iga 6 xonali kod yuboradi → { requestId, expiresIn, resendIn, digits }
//   3) odam kodni yozadi → POST /pub/auth/code/verify { requestId, code } → { token, me }
// Bizda yo'q (404 not_found), kanal/guruhga a'zo emas (403 not_member) yoki botni to'xtatgan (409 bot_blocked) bo'lsa —
// ekran «Ro'yxatdan o'tish» yo'riqnomasini ko'rsatadi (state.problem).
//
// Bu fayl React ham, react-native ham bilmaydi — faqat holatlar mashinasi; test/codeLogin.test.js oddiy Node'da sinaydi.
// requestId va kod maxfiy: faqat shu yopiq o'zgaruvchilarda turadi — holatga ham, logga ham chiqmaydi.
//
// Holat (onChange ga keladi):
//   step: "enter" — raqam/username yozilyapti | "sending" — kod so'ralyapti | "code" — kod kutilyapti |
//         "verifying" — kod tekshirilyapti | "done" — kirdi
//   login: yuborilgan raqam yoki @username (ko'rsatish uchun) | error: foydalanuvchiga matn yoki null
//   problem: null | "not_found" | "not_member" | "bot_blocked" — ro'yxatdan o'tish / a'zo bo'lish kerak
//   missing: not_member bo'lsa — qaysi kanal/guruhlarga a'zo emas ([{ title, url }] yoki ["@kanal"])
//   digits: kod uzunligi | expiresAt, resendAt: vaqt (ms) — ekran sanab ko'rsatadi | expired: kod eskirdi
import { telegramUsername, typedPhone } from "@yuk/shared";

export const DEFAULT_DIGITS = 6;

// "90 123 45 67", "+998 90 123-45-67" → { login: "+998901234567", kind: "phone" }; istalgan davlat raqami
// (Azimjon, 2026-11-25: «ilova global bo'lishi kerak») — "+90 532 123 45 67" → "+905321234567", mahalliy "0532 …" ham
// (server oxirgi raqamlari bo'yicha topadi); "@Ali_99", "Ali_99" → { login: "@Ali_99", kind: "username" }; boshqasi — null
export function parseLogin(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  // Harf bor — username (raqamda harf bo'lmaydi); bo'lmasa — telefon
  if (/[A-Za-z]/.test(text)) {
    const name = telegramUsername(text);
    return name ? { login: `@${name}`, kind: "username" } : null;
  }
  const phone = typedPhone(text);
  if (phone) return { login: phone, kind: "phone" };
  const digits = text.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? { login: `+${digits}`, kind: "phone" } : null;
}

export const BAD_LOGIN =
  "Telefon raqamini (masalan, 90 123 45 67 yoki chet el raqami +90 532 123 45 67) yoki Telegram username'ingizni (masalan, @ism_familiya) yozing.";

const PROBLEMS = new Set(["not_found", "not_member", "bot_blocked"]);

// «3 daqiqa», «45 soniya» — 429 matni uchun
function waitText(seconds) {
  const s = Math.max(1, Math.ceil(Number(seconds) || 60));
  return s >= 120 ? `${Math.ceil(s / 60)} daqiqa` : `${s} soniya`;
}

// requestCode(login) → server javobi yoki ApiError; verifyCode(requestId, code) → { token, me } yoki ApiError
export function createCodeLogin({ requestCode, verifyCode, onChange = () => {}, onDone = () => {}, now = () => Date.now() }) {
  let state = { step: "enter", login: null, error: null, problem: null, missing: [], digits: DEFAULT_DIGITS, expiresAt: 0, resendAt: 0, expired: false };
  let requestId = null; // faqat shu yerda
  let generation = 0; // eski so'rovning kechikkan javobi yangi urinishni buzmasin
  let disposed = false;

  const set = (patch) => {
    state = { ...state, ...patch };
    if (!disposed) onChange(state);
  };

  // Kod so'rash: birinchi marta (submit) yoki «Qayta yuborish» (resend)
  async function ask(login) {
    const gen = ++generation;
    requestId = null;
    set({ step: "sending", login, error: null, problem: null, missing: [], expired: false });
    let answer;
    try {
      answer = await requestCode(login);
    } catch (error) {
      if (gen !== generation || disposed) return;
      if (PROBLEMS.has(error.code)) {
        return set({ step: "enter", problem: error.code, missing: Array.isArray(error.data?.missing) ? error.data.missing : [], error: null });
      }
      const message =
        error.code === "limit" ? `Juda ko'p urinish. ${waitText(error.data?.retryIn)}dan keyin qayta urinib ko'ring.` : error.message;
      return set({ step: "enter", error: message });
    }
    if (gen !== generation || disposed) return;
    if (!answer?.requestId) return set({ step: "enter", error: "Server noto'g'ri javob berdi. Birozdan keyin qayta urinib ko'ring." });
    requestId = answer.requestId;
    const at = now();
    set({
      step: "code",
      digits: Number(answer.digits) || DEFAULT_DIGITS,
      expiresAt: at + (Number(answer.expiresIn) || 300) * 1000,
      resendAt: at + (Number(answer.resendIn) || 60) * 1000,
    });
  }

  return {
    // «Kod olish»: raw — odam yozgan matn
    submit(raw) {
      const parsed = parseLogin(raw);
      if (!parsed) return set({ step: "enter", error: BAD_LOGIN, problem: null, missing: [] });
      return ask(parsed.login);
    },
    // «Kodni qayta yuborish» — resendIn o'tgach yoki kod eskirgan bo'lsa
    resend() {
      if (state.step !== "code" || !state.login) return;
      if (!state.expired && now() < state.resendAt) return;
      return ask(state.login);
    },
    // «Kirish»: raw — odam yozgan kod
    async confirm(raw) {
      if (state.step !== "code") return;
      const code = String(raw ?? "").replace(/\D/g, "");
      if (state.expired || !requestId) return set({ error: "Kod eskirdi — «Kodni qayta yuborish» ni bosing." });
      if (now() >= state.expiresAt) {
        requestId = null;
        return set({ expired: true, error: "Kod eskirdi — «Kodni qayta yuborish» ni bosing." });
      }
      if (code.length !== state.digits) return set({ error: `Botdan kelgan ${state.digits} xonali kodni yozing.` });
      const gen = generation;
      set({ step: "verifying", error: null });
      let answer;
      try {
        answer = await verifyCode(requestId, code);
      } catch (error) {
        if (gen !== generation || disposed) return;
        if (error.status === 410 || error.code === "expired") {
          requestId = null;
          return set({ step: "code", expired: true, error: "Kod eskirdi yoki urinishlar tugadi — «Kodni qayta yuborish» ni bosing." });
        }
        if (error.code === "wrong") {
          const left = Number(error.data?.attemptsLeft);
          return set({ step: "code", error: Number.isFinite(left) ? `Kod noto'g'ri. Yana ${left} ta urinish qoldi.` : "Kod noto'g'ri." });
        }
        return set({ step: "code", error: error.message });
      }
      if (gen !== generation || disposed) return;
      if (!answer?.token) return set({ step: "code", error: "Server noto'g'ri javob berdi. Qayta urinib ko'ring." });
      requestId = null;
      set({ step: "done", error: null });
      onDone({ token: answer.token, me: answer.me ?? null });
    },
    // «Boshqa raqam / username» — boshiga
    back() {
      generation++;
      requestId = null;
      set({ step: "enter", error: null, problem: null, missing: [], expired: false });
    },
    dispose() {
      disposed = true;
      generation++;
      requestId = null;
    },
    get state() {
      return state;
    },
  };
}
