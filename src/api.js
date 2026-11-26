// Server bilan aloqa: https://yuk.gtpro.uz/pub — Mini App va sayt ishlatadigan API (YukPlatform apps/api/src/public.js).
// Mini App'dagi apps/web/src/api.js bilan bir xil qoidalar, faqat token brauzer xotirasida emas — telefonning
// xavfsiz xotirasida (storage.js). Bu faylda react-native import qilinmaydi: testlar (test/api.test.js) oddiy Node'da ishlaydi.
//
// Qoidalar (apps/mobile/API.md):
//   • har so'rovda "Authorization: Bearer <token>";
//   • 401 code "auth" — token eskirgan → onAuthLost (ilova kirish ekraniga qaytadi);
//   • 403 code "blocked" — boshqaruv markazidan bloklangan → onBlocked («Uzr...» ekrani);
//   • bitta IP dan daqiqasiga 240 tadan ko'p so'rov yubormaslik (ro'yxat har daqiqada bir marta yangilanadi);
//   • token va kirish kodini logga yozmaslik (xato matnlarida manzil ham yo'q — kod manzilda bo'ladi).

// Sinash uchun boshqa server: EXPO_PUBLIC_API_URL=http://localhost:3011 npx expo start (Expo bu qiymatni yig'ishda
// kodga qo'yadi). Bo'lmasa — haqiqiy server
export const PROD_API_URL = "https://yuk.gtpro.uz";
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || PROD_API_URL).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { status = 0, code = null, field = null, data = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status; // HTTP holati; 0 — javob umuman kelmadi (internet yo'q)
    this.code = code; // "auth" | "blocked" | "offline" | "not_found" | "not_member" | "wrong" | "expired" | "limit" ...
    this.field = field; // forma xatosi: qaysi maydon
    this.data = data; // server javobining qolgani (masalan, not_member → missing, wrong → attemptsLeft, limit → retryIn)
  }
}

// Ilova sozlaydi (session.js): token qayerdan olinadi va 401 / 403 bo'lsa kimga aytiladi.
// fetch va sleep — testlarda soxtasi beriladi
const settings = {
  baseUrl: API_URL,
  getToken: () => null,
  onAuthLost: () => {},
  onBlocked: () => {},
  appVersion: null, // o'rnatilgan versionCode — har so'rovda X-App-Version (appUpdate.js, majburiy yangilash)
  deviceName: null, // «Galaxy A52» — X-Device-Name: server qurilmalar ro'yxatida ko'rsatadi (ko'pi bilan 2 ta qurilma)
  onUpdate: () => {}, // server 426 «update»: ilova eski
  fetch: (...args) => globalThis.fetch(...args),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
export function configureApi(options) {
  Object.assign(settings, options);
}

// Server qayta ishga tushayotgan bo'lsa (502/503 — nginx bor, API yo'q; 530 — Cloudflare ulana olmadi) so'rov
// serverga yetib bormagan — qayta yuborish xavfsiz. Internet uzilsa esa so'rov yetib borgan bo'lishi mumkin —
// faqat takrorlansa zarari yo'q (GET/PUT/DELETE) so'rovlar qayta yuboriladi. Jami ~20 s
export const RETRY_DELAYS_MS = [1500, 3000, 5000, 10000];
const NOT_REACHED = new Set([502, 503, 530]);
const IDEMPOTENT = new Set(["GET", "PUT", "DELETE"]);
// Bir so'rovni ko'pi bilan shuncha kutamiz (server qotib qolsa ilova ham qotmasin)
const TIMEOUT_MS = 20_000;

// method, path ("/pub/me"), { body, token, retry }. token: undefined — saqlangani, null — tokensiz.
// retry: false — qayta urinmaslik (kirishni so'rab turish o'zi har 2 s da so'raydi)
export async function request(method, path, options = {}) {
  const delays = options.retry === false ? [] : RETRY_DELAYS_MS;
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce(method, path, options);
    } catch (error) {
      const again =
        attempt < delays.length &&
        error.code === "offline" &&
        (NOT_REACHED.has(error.status) || (!error.status && IDEMPOTENT.has(method)));
      if (!again) throw error;
      await settings.sleep(delays[attempt]);
    }
  }
}

async function requestOnce(method, path, { body, token = settings.getToken(), timeout = TIMEOUT_MS } = {}) {
  const headers = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (settings.appVersion) headers["x-app-version"] = String(settings.appVersion);
  if (settings.deviceName) headers["x-device-name"] = encodeURIComponent(settings.deviceName);
  if (body !== undefined) headers["content-type"] = "application/json";

  // AbortController — javob 20 s da kelmasa so'rovni to'xtatadi
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
  let response;
  try {
    response = await settings.fetch(`${settings.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller?.signal,
    });
  } catch {
    throw new ApiError("Server bilan aloqa yo'q. Internetni tekshiring va qayta urinib ko'ring.", { code: "offline" });
  } finally {
    if (timer) clearTimeout(timer);
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  // 200 va 202 (kirish hali tasdiqlanmagan) — ikkalasi ham "ok"
  if (response.ok && json) return json;

  if (json?.code === "blocked") settings.onBlocked(json.error);
  if (response.status === 426 && json?.code === "update") settings.onUpdate();
  // Token bilan yuborilgan so'rovga 401 — token eskirgan yoki hisob o'chirilgan. Tokensiz so'rovning 401 i (masalan,
  // kirish) — oddiy xato
  if (response.status === 401 && token) settings.onAuthLost(json?.error ?? null);
  if (json?.error) throw new ApiError(json.error, { status: response.status, code: json.code ?? null, field: json.field ?? null, data: json });
  // JSON emas — server ishlamayapti (nginx xato sahifasi, Cloudflare)
  throw new ApiError("Server hozir ishlamayapti. Birozdan keyin qayta urinib ko'ring.", { status: response.status, code: "offline" });
}

// Kichik yordamchi: { a: 1, b: null } → "a=1" (bo'sh qiymatlar tashlanadi)
const query = (params) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

// --- Yo'llar (public.js boshidagi ro'yxat) ---

// Kirishsiz: bot nomi, yo'nalish doirasi (scope), a'zo bo'lish kerak bo'lgan kanal/guruhlar (required)
export const getConfig = () => request("GET", "/pub/config", { token: null });
// Ilovaning eng so'nggi versiyasi: { android: { version, versionCode, size, url } | null } (appUpdate.js)
export const getAppRelease = () => request("GET", "/pub/app", { token: null, retry: false });

// Kod bilan kirish (2026-11-24). login — "+998901234567" yoki "@username" (codeLogin.js parseLogin tekshirgan).
// → { requestId, expiresIn, resendIn, digits } — bot shu odamning Telegram'iga kod yubordi.
// Xatolar: 404 not_found (bizda yo'q) | 403 not_member { missing } | 409 bot_blocked | 429 limit { retryIn } | 403 blocked
export const requestLoginCode = (login) => request("POST", "/pub/auth/code", { body: { login }, token: null, retry: false });
// → { token, me } | 400 wrong { attemptsLeft } | 410 expired (eskirgan, ishlatilgan yoki urinishlar tugagan) | 429 limit
export const verifyLoginCode = (requestId, code) =>
  request("POST", "/pub/auth/code/verify", { body: { requestId, code }, token: null, retry: false });

// Bot orqali kirish (src/botLogin.js): → { code, url, tgUrl, expiresIn, pollMs }; so'rab turish → 202 { status: "pending" } |
// { token, me } | 410 expired
export const startBotLogin = () => request("POST", "/pub/auth/app", { token: null, retry: false });
export const pollBotLogin = (code) => request("GET", `/pub/auth/app/${encodeURIComponent(code)}`, { token: null, retry: false });

// Qurilmalar (ko'pi bilan 2 ta). Kirishda 409 devices { ticket, devices } — bittasini chiqarib, shu qurilmada kirish:
// → { token, me }
export const replaceDevice = (ticket, deviceId) =>
  request("POST", "/pub/auth/devices/replace", { body: { ticket, deviceId }, token: null, retry: false });
// → { max, devices: [{ id, name, createdAt, seenAt, current }] }
export const getDevices = () => request("GET", "/pub/me/devices");
export const removeDevice = (id) => request("DELETE", `/pub/me/devices/${encodeURIComponent(id)}`);

// Majburiy a'zolik (2026-11-26): lenta va E'lon berish javobida member: { ok, missing: [{ ref, title, type, url }] }.
// «✅ A'zo bo'ldim» — Telegram'dan hozir tekshirish → { ok, missing }
export const checkMembership = () => request("POST", "/pub/me/membership", { retry: false });

export const getMe = () => request("GET", "/pub/me");
// Pauza ikkita, bir-biridan alohida (Azimjon, 2026-11-25: «Ajrat!»): setActive — bot Telegram'ga yuboradimi;
// setAppActive — ilova lentasi va telefon bildirishnomalari (pastdagi «⏸ Pauza» tugmasi)
export const setActive = (active) => request("PATCH", "/pub/me", { body: { active } });
export const setAppActive = (appActive) => request("PATCH", "/pub/me", { body: { appActive } });
// me.appActive (yangi server) yoki eski keshdagi me — umumiy active
export const appOn = (me) => Boolean(me?.appActive ?? me?.active);
// Hisobdan chiqish serverda: rol va sozlamalar yashiriladi, bot yubormaydi (qayta kirib rol tanlasa — tiklanadi)
export const signOut = () => request("POST", "/pub/me/logout");
// Hisobni o'chirish (botdagi /ochirish → «Hammasini o'chirish» bilan bir xil)
export const deleteMe = () => request("DELETE", "/pub/me");

// «📝 E'lon berish» chati (server loadChat.js + public.js; suhbat serverda saqlanadi — boshqa telefondan ham ko'rinadi).
// Xabar: { id, from: "me" | "bot", text, audio, durationMs, transcript?, cards?, stage?, phones?, active, postId?, at }.
// O'zgartiruvchi so'rovlar → { messages: [yangilari], used, limit }
export const getLoadChat = (after = 0) => request("GET", `/pub/me/load-chat${after ? `?after=${after}` : ""}`); // + intro
// Matnni tushunish AI'ga ketishi mumkin — qayta yuborilmaydi (ikki marta xabar bo'lmasin), kutish 60 s
export const sendLoadText = (text) => request("POST", "/pub/me/load-chat", { body: { text }, retry: false, timeout: 60_000 });
// Raqam (tayyoridan yoki yozgani); send — shu zahoti yuborish (raqam oynasidagi «✅ Yuborish»)
export const pickLoadPhone = (phone, send = false) => request("POST", "/pub/me/load-chat/phone", { body: { phone, send }, retry: false });
export const confirmLoad = () => request("POST", "/pub/me/load-chat/send", { retry: false });
export const cancelLoad = () => request("DELETE", "/pub/me/load-chat", { retry: false });

// Ovoz (LoadChat.js fayl yuklaydi — fetch emas, expo-file-system upload) va tinglash: manzil va sarlavhalar shu yerda,
// api.js qoidalari (token, X-App-Version, 401/403/426) bir joyda qolsin
function authHeaders() {
  const headers = {};
  const token = settings.getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (settings.appVersion) headers["x-app-version"] = String(settings.appVersion);
  if (settings.deviceName) headers["x-device-name"] = encodeURIComponent(settings.deviceName);
  return headers;
}
export function voiceUpload(durationMs) {
  return {
    url: `${settings.baseUrl}/pub/me/load-chat/voice`,
    headers: { ...authHeaders(), accept: "application/json", "content-type": "audio/aac", "x-duration-ms": String(Math.round(durationMs)) },
  };
}
// Ovozli xabarni tinglash: expo-audio manbasi (sarlavha bilan — fayl faqat egasiga beriladi)
export const voiceSource = (id) => ({ uri: `${settings.baseUrl}/pub/me/load-chat/audio/${id}`, headers: authHeaders() });
// upload javobi { status, body } → JSON yoki ApiError
export function readUpload({ status, body }) {
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    json = null;
  }
  if (status >= 200 && status < 300 && json) return json;
  if (json?.code === "blocked") settings.onBlocked(json.error);
  if (status === 401) settings.onAuthLost();
  if (status === 426 && json?.code === "update") settings.onUpdate();
  throw new ApiError(json?.error ?? "Server hozir ishlamayapti. Birozdan keyin qayta urinib ko'ring.", { status, code: json?.code ?? (json ? null : "offline"), data: json });
}

// view: mine | all; hours: 6 | 24 | 72; limit; offset; from; to → { view, hours, total, items: [{ id, load, post, createdAt }] }
export const getLoads = (params = {}) => request("GET", `/pub/loads?${query(params)}`);
// Ilova lentasi (haydovchiga): bot yuboradigan asl e'lonlar, filtr bo'yicha — { minutes, limit } → { total, items }
// options: { retry: false } — lenta har 3 soniyada o'zi qayta so'raydi, ichkarida qayta urinish kerak emas
export const getFeed = (params = {}, options) => request("GET", `/pub/feed?${query(params)}`, options);
// Bo'sh mashinalar (yuk beruvchiga) — xuddi shunday
export const getTrucks = (params = {}, options) => request("GET", `/pub/trucks?${query(params)}`, options);

// Haydovchining yo'nalishi: { from?, hours } → { from, hours, areas: [{ id, label, count }], any }
export const getRoute = (params = {}) => request("GET", `/pub/me/route?${query(params)}`);
// "*" = istalgan joy → yangilangan me
export const saveRoute = (from, to) => request("PUT", "/pub/me/route", { body: { from, to } });

// «📌 Mening guruhlarim» uchun tanlasa bo'ladigan guruhlar → { sources: [{ name, title, perDay, closed, locked, mine }],
// chosen, max, pro } (eng faoli birinchi; oddiy foydalanuvchiga yopiq guruhlar kelmaydi)
export const getFeedSources = () => request("GET", "/pub/me/feed-sources");
// Sozlamalarni saqlash (botdagi «💾 Saqlash» bilan bir qoida) → yangilangan me. 400 { error, field }
export const saveProfile = (profile, role) => request("PUT", "/pub/me/profile", { body: { profile, role } });

// Bildirishnoma uchun telefon tokeni (FCM). Server tomoni hali yo'q bo'lsa 404 — ilova indamaydi (notify.js)
export const savePushToken = (token) => request("POST", "/pub/me/push", { body: { token, platform: "android" }, retry: false });
