// «Bot orqali kirish» (2026-11-26; botda «Akkauntingizni ilovaga bog'laysizmi?» → «✅ Ha, bog'layman», Azimjon: botdan ro'yxatdan o'tmagan yoki botni o'chirgan odam raqam/username bilan
// kira olmaydi — «Bot orqali» ga ishora qil). Server oqimi — YukPlatform public.js /pub/auth/app:
//   1) start()  → POST /pub/auth/app → { code, url, expiresIn, pollMs }
//   2) ilova url ni (t.me/<bot>?start=app_<kod>) ochadi; botda «Start» → «✅ Ha, bog'layman» (yangi odam ham shu yerda
//      bot bilan tanishadi — ro'yxatdan o'tish ham shu)
//   3) poll(code) har pollMs da: 202 { status: "pending" } | 200 { token, me } | 410 expired
// Bu fayl React bilmaydi — test/botLogin.test.js oddiy Node'da sinaydi. Kod maxfiy: holatga ham, logga ham chiqmaydi.
//
// Holat: step "idle" | "starting" | "waiting" | "done"; error: matn yoki null
export function createBotLogin({ start, poll, openUrl, onChange = () => {}, onDone = () => {}, now = () => Date.now(), sleep }) {
  let state = { step: "idle", error: null };
  let code = null;
  let url = null;
  let generation = 0;
  let disposed = false;
  let wake = null; // nudge() — kutishni darhol tugatadi (odam Telegram'dan qaytdi)

  const set = (patch) => {
    state = { ...state, ...patch };
    if (!disposed) onChange(state);
  };
  const nap = (ms) =>
    new Promise((resolve) => {
      let timer = null;
      let over = false;
      const done = () => {
        if (over) return;
        over = true;
        clearTimeout(timer);
        if (wake === done) wake = null;
        resolve();
      };
      wake = done;
      timer = sleep ? (sleep(ms).then(done), null) : setTimeout(done, ms);
    });

  async function loop(gen, pollMs, until) {
    while (gen === generation && !disposed) {
      await nap(pollMs);
      if (gen !== generation || disposed) return;
      if (now() >= until) return set({ step: "idle", error: "Vaqt tugadi — «Bot orqali kirish» ni qaytadan bosing." });
      let answer;
      try {
        answer = await poll(code);
      } catch (error) {
        if (gen !== generation || disposed) return;
        if (error.code === "offline") continue; // internet bir zum uzildi — so'rashda davom etamiz
        code = null;
        return set({ step: "idle", error: error.message });
      }
      if (gen !== generation || disposed) return;
      if (answer?.token) {
        code = null;
        set({ step: "done", error: null });
        return onDone(answer);
      }
    }
  }

  return {
    get state() {
      return state;
    },
    async begin() {
      if (state.step === "starting" || state.step === "waiting") return;
      const gen = ++generation;
      set({ step: "starting", error: null });
      let answer;
      try {
        answer = await start();
      } catch (error) {
        if (gen !== generation || disposed) return;
        return set({ step: "idle", error: error.message });
      }
      if (gen !== generation || disposed) return;
      if (!answer?.code || !answer?.url) return set({ step: "idle", error: "Server noto'g'ri javob berdi. Birozdan keyin qayta urinib ko'ring." });
      code = answer.code;
      url = answer.url;
      set({ step: "waiting" });
      openUrl(url);
      loop(gen, Number(answer.pollMs) || 2000, now() + (Number(answer.expiresIn) || 600) * 1000);
    },
    // «Botni qayta ochish»
    reopen() {
      if (state.step === "waiting" && url) openUrl(url);
    },
    // Ilova yana oldinga chiqdi — kutmasdan so'raymiz
    nudge() {
      wake?.();
    },
    cancel() {
      generation++;
      code = null;
      url = null;
      wake?.();
      set({ step: "idle", error: null });
    },
    dispose() {
      disposed = true;
      generation++;
      wake?.();
    },
  };
}
