// Kim kirgan — butun ilova uchun bitta joy (React Context). Har ekran useSession() bilan oladi:
//   status: "loading" — ochilyapti | "out" — kirish kerak | "in" — kirgan | "blocked" — bloklangan |
//           "offline" — server bilan aloqa yo'q (token bor, lekin tekshirib bo'lmadi)
//   me:     GET /pub/me javobi (chatId, name, role, profile, active, phone ...)
//   scope:  yo'nalish doirasi (serverdagi ROUTE_SCOPE) — sozlamalar matni shunga qarab yoziladi
// Ilova ochilganda: xotirada token bormi → bor bo'lsa GET /pub/me. Token 30 kun amal qiladi; eskirsa server 401 beradi
// va ilova kirish ekraniga qaytadi (api.js onAuthLost).
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { validRouteScope } from "@yuk/shared";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { configureApi, getConfig, getMe } from "./api.js";
import { markStale } from "./appUpdate.js";
import { readCache, writeCache } from "./cache.js";
import { loadToken, saveToken } from "./storage.js";

// api.js shu yerdan tokenni oladi va 401 / 403 haqida aytadi. Modul darajasida — har qanday ekran so'rov yuborishidan oldin
const live = { token: null, onAuthLost: () => {}, onBlocked: () => {} };
configureApi({
  getToken: () => live.token,
  onAuthLost: () => live.onAuthLost(),
  onBlocked: (message) => live.onBlocked(message),
  // o'rnatilgan ilova versiyasi (app.json android.versionCode, yig'ishda kodga yoziladi); web'da yo'q — tekshirilmaydi
  appVersion: Platform.OS === "android" ? Number(Constants.expoConfig?.android?.versionCode) || null : null,
  onUpdate: markStale,
});

const SessionContext = createContext(null);

export function useSession() {
  const value = use(SessionContext);
  if (!value) throw new Error("useSession() faqat <SessionProvider> ichida ishlaydi");
  return value;
}

export function SessionProvider({ children }) {
  const [state, setState] = useState({ status: "loading", me: null, error: null });
  const [config, setConfig] = useState(null);

  // Token o'chirib, kirish ekraniga (hisobdan chiqildi, o'chirildi yoki token eskirdi)
  const leave = useCallback(async () => {
    live.token = null;
    setState({ status: "out", me: null, error: null });
    writeCache("me", null);
    await saveToken(null);
  }, []);

  useEffect(() => {
    live.onAuthLost = () => void leave();
    // Token o'chirilmaydi: blokdan chiqarilsa, keyingi ochilishda o'zi kiradi (Mini App'dagidek)
    live.onBlocked = (message) => setState({ status: "blocked", me: null, error: message ?? null });
  }, [leave]);

  // Xotiradagi token bilan kirish (ilova ochilganda — holat allaqachon "loading")
  const restore = useCallback(async () => {
    const token = await loadToken();
    live.token = token;
    if (!token) {
      setState({ status: "out", me: null, error: null });
      return;
    }
    // Tezlik: oxirgi «me» keshda bo'lsa — ilova serverni kutmasdan darhol ochiladi, server javobi kelgach yangilanadi.
    // Server «401/blok» desa — onAuthLost/onBlocked baribir chiqaradi
    const cached = readCache("me");
    if (cached?.chatId) setState({ status: "in", me: cached, error: null });
    try {
      setState({ status: "in", me: await getMe(), error: null });
    } catch (error) {
      // 401 — onAuthLost allaqachon «out» qildi; 403 — onBlocked «blocked» qildi
      if (error.code === "auth" || error.code === "blocked") return;
      // Aloqa yo'q, lekin kesh bor — ilova keshdagi bilan ishlayveradi (keyingi so'rovlar o'zi qayta urinadi)
      if (cached?.chatId) return;
      setState({ status: "offline", me: null, error: error.message });
    }
  }, []);

  // Har yangi «me» — keshga (keyingi ochilish uchun)
  useEffect(() => {
    if (state.status === "in" && state.me) writeCache("me", state.me);
  }, [state.status, state.me]);

  // «Qayta urinish» (aloqa yo'q ekranida)
  const connect = useCallback(() => {
    setState({ status: "loading", me: null, error: null });
    return restore();
  }, [restore]);

  useEffect(() => {
    // restore() holatni faqat await dan keyin (xotira o'qilgach) o'zgartiradi — linter buni ko'ra olmaydi
    // eslint-disable-next-line react-hooks/set-state-in-effect
    restore();
    getConfig()
      .then(setConfig)
      .catch(() => setConfig({}));
  }, [restore]);

  // Kirish tasdiqlandi (login.js): { token, me }
  const signIn = useCallback(async ({ token, me }) => {
    live.token = token;
    await saveToken(token);
    try {
      setState({ status: "in", me: me ?? (await getMe()), error: null });
    } catch (error) {
      if (error.code === "auth" || error.code === "blocked") return;
      setState({ status: "offline", me: null, error: error.message });
    }
  }, []);

  // Server yangi me qaytardi (rol, pauza, yo'nalish ...)
  const setMe = useCallback((me) => setState((s) => (s.status === "in" ? { ...s, me } : s)), []);

  // Ko'rinib turgan ma'lumotni serverdan qayta olish (masalan, botda nimadir o'zgartirgan bo'lsa)
  const refreshMe = useCallback(async () => {
    const me = await getMe();
    setMe(me);
    return me;
  }, [setMe]);

  const value = useMemo(
    () => ({
      ...state,
      config,
      scope: validRouteScope(config?.scope),
      botUsername: config?.botUsername ?? "Yuk_Ekspert_agent",
      connect,
      signIn,
      setMe,
      refreshMe,
      leave,
    }),
    [state, config, connect, signIn, setMe, refreshMe, leave],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}
