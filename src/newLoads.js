// «🔴 Yangi yuklar» belgisi: pastdagi «📋 Yuklar» tugmasida va yon menyudagi «Yuklar» qatorida qizil doirada son.
// Ilova ochiq turganda har 30 soniyada «Menga mos» ro'yxatining boshi so'raladi; oxirgi ko'rilgan yukdan (id) keyingilari —
// yangi. «📋 Yuklar» ochilsa — hammasi ko'rilgan bo'ladi (markSeen). Pauzada belgi yo'q (yuk kelmaydi).
// Oxirgi ko'rilgan id telefonda saqlanadi (storage.js), ilova qayta ochilganda ham hisob joyidan davom etadi.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { getLoads, getTrucks } from "./api.js";
import { useSession } from "./session.js";
import { loadValue, saveValue } from "./storage.js";

const POLL_MS = 30_000;
const PEEK = 50; // bir so'rovda ko'pi bilan shuncha — undan ko'p bo'lsa «50+»

const NewLoadsContext = createContext({ count: 0, markSeen: () => {} });
export const useNewLoads = () => useContext(NewLoadsContext);

// Belgidagi matn: 0 — yo'q, 50 — «50+»
export const badgeText = (count) => (count > 0 ? (count >= PEEK ? `${PEEK}+` : String(count)) : undefined);

const topId = (items) => items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);

export function NewLoadsProvider({ children }) {
  const { me } = useSession();
  const kind = me?.role === "yuk_beruvchi" ? "mashina" : "yuk";
  // Haydovchiga «Menga mos» faqat filtr (profil) bo'lsa hisoblanadi; yuk beruvchiga — har doim
  const enabled = Boolean(me?.active) && (kind === "mashina" || Boolean(me?.profile));
  const profileKey = JSON.stringify(me?.profile ?? null);
  const key = `yuk_seen_${kind}`;
  const [count, setCount] = useState(0);
  const seen = useRef(undefined); // undefined — xotiradan hali o'qilmagan, null — hech qachon ko'rilmagan

  const remember = useCallback(
    (id) => {
      seen.current = id;
      saveValue(key, id);
    },
    [key],
  );

  const poll = useCallback(async () => {
    try {
      if (seen.current === undefined) {
        const stored = Number(await loadValue(key));
        seen.current = stored > 0 ? stored : null;
      }
      const data = await (kind === "yuk" ? getLoads : getTrucks)({ view: "mine", hours: 24, limit: PEEK });
      const top = topId(data.items);
      // Birinchi marta — eski yuklar «yangi» deb sanalmaydi
      if (seen.current == null) {
        remember(top);
        setCount(0);
        return;
      }
      setCount(data.items.filter((item) => Number(item.id) > seen.current).length);
    } catch {
      // aloqa yo'q / server javob bermadi — belgi o'zgarmaydi, keyingi safar yana so'raladi
    }
  }, [kind, key, remember]);

  useEffect(() => {
    if (!enabled) return undefined; // value'da count baribir 0 ko'rsatiladi
    const first = setTimeout(poll, 0); // birinchi so'rov — darhol (effektdan keyin)
    const timer = setInterval(() => {
      if (AppState.currentState === "active") poll();
    }, POLL_MS);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") poll();
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      sub.remove();
    };
    // profileKey: filtr o'zgarsa — darhol qayta hisoblanadi
  }, [enabled, poll, profileKey]);

  // «📋 Yuklar» ro'yxati ko'rsatildi — undagi eng yangi yukgacha hammasi ko'rilgan
  const markSeen = useCallback(
    (items) => {
      const top = topId(items ?? []);
      if (top > (seen.current ?? 0)) remember(top);
      setCount(0);
    },
    [remember],
  );

  const value = useMemo(() => ({ count: enabled ? count : 0, markSeen }), [enabled, count, markSeen]);
  return <NewLoadsContext.Provider value={value}>{children}</NewLoadsContext.Provider>;
}
