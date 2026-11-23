// «Telegram orqali kirish» — qadamlar (apps/mobile/API.md):
//   1) POST /pub/auth/app → { code, url, tgUrl, expiresIn, pollMs }
//   2) Telegram ochiladi (bot chati: «Start» → «✅ Ha, kiraman»)
//   3) ilova har pollMs da GET /pub/auth/app/<code> so'raydi: 202 — kutamiz, 200 { token, me } — kirdi, 410 — eskirdi
//
// Bu fayl React ham, react-native ham bilmaydi — faqat holatlar mashinasi. Ekran (src/app/login.js) unga haqiqiy
// so'rovlarni, Telegram'ni ochishni va «ilovaga qaytdi» hodisasini (AppState) beradi. Shuning uchun uni oddiy
// Node'da sinash mumkin: test/appLogin.test.js soxta server va soxta soat bilan.
//
// Holat (onChange ga keladi): { step, error, offline }
//   step: "idle" — hali bosilmagan | "starting" — kod so'ralyapti | "waiting" — Telegram'da tasdiqlashni kutyapmiz |
//         "done" — kirdi | "expired" — 10 daqiqa o'tdi yoki kod ishlatilgan | "error" — kod olib bo'lmadi
//   error: foydalanuvchiga ko'rsatiladigan matn yoki null
//   offline: true — kutish paytida server bilan aloqa uzildi (so'rash davom etadi)
//
// Kod maxfiy: uni bilgan odam (bot tasdiqlagandan keyin) tokenni oladi. Shuning uchun u faqat shu yopiq o'zgaruvchida
// turadi — holatga ham, logga ham chiqmaydi.

const DEFAULT_POLL_MS = 2000;
// Aloqa uzilganda tez-tez urmaymiz (bitta IP dan daqiqasiga 240 so'rov chegarasi bor)
const OFFLINE_POLL_MS = 5000;
const clampPoll = (ms) => Math.min(Math.max(Number(ms) || DEFAULT_POLL_MS, 1000), 10_000);

export const OPEN_FAILED =
  "Telegram ochilmadi. Telefoningizda Telegram o'rnatilganini tekshiring va «Telegram'ni qayta ochish» ni bosing.";

// start() → server javobi; check(code) → server javobi yoki ApiError; open(ticket) → Promise (Telegram'ni ochadi);
// onChange(state); onDone({ token, me })
export function createAppLogin({
  start,
  check,
  open,
  onChange = () => {},
  onDone = () => {},
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  let state = { step: "idle", error: null, offline: false };
  let ticket = null; // { code, url, tgUrl, pollMs, deadline } — faqat shu yerda
  let timer = null;
  let checking = false;
  // Har «Kirish» bosilganda yangi avlod: eski so'rovning kechikkan javobi yangi urinishni buzmasin
  let generation = 0;
  let disposed = false;

  const set = (patch) => {
    state = { ...state, ...patch };
    if (!disposed) onChange(state);
  };
  const stopTimer = () => {
    if (timer != null) clearTimer(timer);
    timer = null;
  };
  const schedule = (ms) => {
    stopTimer();
    timer = setTimer(() => {
      timer = null;
      poll();
    }, ms);
  };
  const expire = () => {
    stopTimer();
    ticket = null;
    set({ step: "expired", error: null, offline: false });
  };

  async function openTelegram() {
    if (!ticket) return;
    try {
      await open(ticket);
      if (state.error === OPEN_FAILED) set({ error: null });
    } catch {
      set({ error: OPEN_FAILED });
    }
  }

  async function begin() {
    const gen = ++generation;
    stopTimer();
    ticket = null;
    checking = false;
    set({ step: "starting", error: null, offline: false });
    let answer;
    try {
      answer = await start();
    } catch (error) {
      if (gen === generation) set({ step: "error", error: error.message });
      return;
    }
    if (gen !== generation || disposed) return;
    if (!answer?.code || !(answer.url || answer.tgUrl)) {
      set({ step: "error", error: "Server noto'g'ri javob berdi. Birozdan keyin qayta urinib ko'ring." });
      return;
    }
    ticket = {
      code: answer.code,
      url: answer.url,
      tgUrl: answer.tgUrl,
      pollMs: clampPoll(answer.pollMs),
      deadline: now() + (Number(answer.expiresIn) || 600) * 1000,
    };
    set({ step: "waiting" });
    schedule(ticket.pollMs);
    await openTelegram();
  }

  async function poll() {
    if (!ticket || state.step !== "waiting" || checking || disposed) return;
    if (now() >= ticket.deadline) return expire();
    const gen = generation;
    const { code, pollMs } = ticket;
    checking = true;
    let answer;
    try {
      answer = await check(code);
    } catch (error) {
      if (gen !== generation) return;
      checking = false;
      if (error.status === 410) return expire();
      if (error.code === "blocked") {
        // Ilova o'zi «Uzr...» ekraniga o'tadi (api.js onBlocked) — bu yerda faqat to'xtaymiz
        stopTimer();
        ticket = null;
        return set({ step: "error", error: error.message, offline: false });
      }
      // Internet yo'q, 429, server qayta ishga tushyapti — kutishda davom etamiz, faqat sekinroq
      set({ offline: true });
      return schedule(Math.max(pollMs, OFFLINE_POLL_MS));
    }
    if (gen !== generation) return;
    checking = false;
    if (answer?.token) {
      stopTimer();
      ticket = null;
      set({ step: "done", error: null, offline: false });
      onDone({ token: answer.token, me: answer.me ?? null });
      return;
    }
    if (state.offline) set({ offline: false });
    schedule(pollMs);
  }

  return {
    begin,
    // Ilova orqa fondan qaytdi (AppState "active"): kutib o'tirmasdan darhol so'raymiz — odam botda allaqachon bosgan bo'lishi mumkin
    resume() {
      if (state.step !== "waiting") return;
      stopTimer();
      poll();
    },
    // «Telegram'ni qayta ochish»
    reopen: openTelegram,
    // «Bekor qilish»
    cancel() {
      generation++;
      stopTimer();
      ticket = null;
      checking = false;
      set({ step: "idle", error: null, offline: false });
    },
    // Ekran yopildi — hech narsa so'ralmasin va xabar berilmasin
    dispose() {
      disposed = true;
      generation++;
      stopTimer();
      ticket = null;
    },
    get state() {
      return state;
    },
  };
}
