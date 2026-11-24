// Lenta: yuklar (haydovchiga) yoki bo'sh mashinalar (yuk beruvchiga), eng yangisi tepada. Mini App'dagi
// «📋 Yuklar» / «🚚 Mashinalar» bilan bir xil (apps/web/src/LoadsPage.jsx): «Menga mos» yoki «Hammasi», oxirgi 24 soat.
// Haydovchining «Menga mos» i — botdagi «🎛 Filtr» bo'yicha (guruhlar, mashina turi, qayerdan): bot yuboradigan e'lonlar.
// Filtr hali tanlanmagan bo'lsa — «🎛 Filtr» bo'limiga o'tkaziladi. Eski «🎯 Saralangan» rejimda — yo'nalish bo'yicha.
// Ro'yxat ochiq turganda har daqiqada o'zi yangilanadi; pastga tortsa — darhol; oxiriga yetsa — yana 30 tasi.
// Ko'rsatilgan yuklar «🔴 yangi» belgisidan chiqariladi (newLoads.js markSeen).
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { feedLabel, routeChosen, routeLabel, sortedReady } from "@yuk/shared";
import { getLoads, getTrucks } from "../api.js";
import { useNewLoads } from "../newLoads.js";
import { useSession } from "../session.js";
import { colors, radius, space } from "../theme.js";
import { Button, Hint, Notice, Segmented, Spinner } from "../ui.js";
import { LoadCard, TruckCard } from "./LoadCard.js";

const PAGE = 30;
const MAX = 500; // server bir so'rovda ko'pi bilan shuncha beradi
const REFRESH_MS = 60_000;
const VIEWS = [
  { id: "mine", label: "Menga mos" },
  { id: "all", label: "Hammasi" },
];
const HOURS = 24; // oxirgi 24 soat (muddat tanlash olib tashlandi — 0.5.0)

const KINDS = {
  yuk: { fetch: getLoads, Card: LoadCard, many: "yuk" },
  mashina: { fetch: getTrucks, Card: TruckCard, many: "bo'sh mashina" },
};

export function LoadsFeed() {
  const { me } = useSession();
  const { count: fresh, markSeen } = useNewLoads();
  const kind = me.role === "yuk_beruvchi" ? "mashina" : "yuk";
  const k = KINDS[kind];
  const driver = kind === "yuk";
  const profile = me.profile;

  const [view, setView] = useState("mine");
  const hours = HOURS;
  // Haydovchi filtrni hali tanlamagan — «Menga mos» hisoblanmaydi, «🎛 Filtr» ga o'tkaziladi
  const noFilter = driver && view === "mine" && !profile;
  // Eski «🎯 Saralangan» rejim: «Menga mos» yo'nalishsiz chiqmaydi
  const sorted = driver && Boolean(profile) && sortedReady(profile);
  const needRoute = sorted && view === "mine" && !routeChosen(profile);
  const idle = noFilter || needRoute; // ro'yxat so'ralmaydi
  // Filtr yoki yo'nalish o'zgarsa (shu ilovada yoki botda) — ro'yxat qaytadan so'raladi
  const profileKey = JSON.stringify(profile ?? null);

  const [state, setState] = useState({ items: [], total: 0, loading: true, refreshing: false, more: false, error: null });
  const shown = useRef(PAGE); // nechta ko'rsatilyapti — yangilashda ham shuncha qoladi
  const request = useRef(0); // eng oxirgi so'rov raqami: eski javob yangisini bosib ketmasin
  const focused = useRef(false);

  // mode: "full" (spinner) | "silent" (jimgina yangilash) | "refresh" (pastga tortdi) | "more" (yana 30 ta)
  const load = useCallback(
    async (count, mode = "full") => {
      const id = ++request.current;
      setState((s) => ({
        ...s,
        loading: mode === "full",
        refreshing: mode === "refresh",
        more: mode === "more",
        error: mode === "full" ? null : s.error,
      }));
      try {
        const data = await k.fetch({ view, hours, limit: Math.min(count, MAX) });
        if (id !== request.current) return;
        shown.current = count;
        setState({ items: data.items, total: data.total, loading: false, refreshing: false, more: false, error: null });
        if (view === "mine" && focused.current) markSeen(data.items);
      } catch (error) {
        if (id !== request.current) return;
        // Jim yangilashda xato bo'lsa — eski ro'yxat qoladi, faqat tepada qator
        setState((s) => ({ ...s, loading: false, refreshing: false, more: false, error }));
      }
    },
    // profileKey so'rovda ishlatilmaydi, lekin o'zgarsa load yangilanadi → pastdagi useEffect ro'yxatni qayta so'raydi
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [k, view, hours, profileKey, markSeen],
  );

  // Filtr o'zgardi — boshidan
  useEffect(() => {
    if (idle) return;
    shown.current = PAGE;
    load(PAGE);
  }, [load, idle]);

  // Ekran ko'rinib turganda: darhol jimgina yangilanadi, keyin har daqiqada; ilovaga qaytganda — darhol.
  // Filtr tanlanmagan bo'lsa — «🎛 Filtr» ga o'tadi
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (noFilter) {
        router.navigate("/filtr");
        return () => {
          focused.current = false;
        };
      }
      if (idle) {
        return () => {
          focused.current = false;
        };
      }
      load(shown.current, "silent");
      const timer = setInterval(() => {
        if (AppState.currentState === "active") load(shown.current, "silent");
      }, REFRESH_MS);
      const sub = AppState.addEventListener("change", (next) => {
        if (next === "active") load(shown.current, "silent");
      });
      return () => {
        focused.current = false;
        clearInterval(timer);
        sub.remove();
      };
    }, [load, idle, noFilter]),
  );

  // Ro'yxat ochiq turganda yangi yuk keldi (newLoads.js sezdi) — darhol jimgina yangilanadi va belgi o'chadi
  useEffect(() => {
    if (!fresh || idle || view !== "mine" || !focused.current) return undefined;
    const timer = setTimeout(() => load(shown.current, "silent"), 0);
    return () => clearTimeout(timer);
  }, [fresh, idle, view, load]);

  const { items, total, loading, refreshing, more, error } = state;
  const hasMore = items.length < total && items.length < MAX;

  const header = (
    <View style={styles.toolbar}>
      {!me.active ? (
        <View style={styles.paused}>
          <Text style={styles.pausedText}>⏸ Pauzada — bot e'lon yubormayapti. Pastdagi «▶️ Davom etish» ni bosing.</Text>
        </View>
      ) : null}
      <Segmented options={VIEWS} value={view} onChange={setView} />
      {driver && view === "mine" && profile && !sorted ? (
        <View style={styles.bar}>
          <Text style={styles.barText} numberOfLines={2}>
            {feedLabel(profile)}
          </Text>
          <Button title="O'zgartirish" kind="link" onPress={() => router.navigate("/filtr")} />
        </View>
      ) : null}
      {sorted && view === "mine" && !needRoute ? (
        <View style={styles.bar}>
          <Text style={styles.barText} numberOfLines={2}>
            🧭 <Text style={styles.bold}>{routeLabel(profile)}</Text>
          </Text>
          <Button title="O'zgartirish" kind="link" onPress={() => router.push("/yonalish")} />
        </View>
      ) : null}
      {!idle && !loading && !error ? <Hint>{total ? `${total} ta ${k.many}` : null}</Hint> : null}
      {error && items.length ? <Text style={styles.error}>⚠️ {error.message}</Text> : null}
    </View>
  );

  if (noFilter) {
    return (
      <View style={[styles.page, styles.pad]}>
        {header}
        <Notice title="🎛 Avval filtrni tanlang" action={<Button title="🎛 Filtrga o'tish" onPress={() => router.navigate("/filtr")} />}>
          Qaysi mashina va qayerdan ketadigan yuklar kerakligini belgilang — shunga mos e'lonlar shu yerda va botda chiqadi.
        </Notice>
      </View>
    );
  }

  if (needRoute) {
    return (
      <View style={[styles.page, styles.pad]}>
        {header}
        <Notice title="🧭 Yo'nalishni tanlang" action={<Button title="📍 Qayerdan → 🏁 Qayerga" onPress={() => router.push("/yonalish")} />}>
          «Menga mos» yuklar siz tanlagan yo'nalish bo'yicha chiqadi. Bot ham yangi yuklarni shu bo'yicha yuboradi.
        </Notice>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.list}
      data={loading ? [] : items}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <k.Card item={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        loading ? (
          <Spinner />
        ) : error ? (
          <Notice title="Ro'yxat ochilmadi" action={<Button title="Qayta urinish" onPress={() => load(shown.current)} />}>
            {error.message}
          </Notice>
        ) : (
          <Notice title={`Hozircha ${k.many} yo'q`}>
            {view === "mine"
              ? `Oxirgi 24 soatda filtringizga mos ${k.many} chiqmadi. Filtrni kengaytirib ko'ring.`
              : "Oxirgi 24 soatda e'lon chiqmadi."}
          </Notice>
        )
      }
      ListFooterComponent={more ? <Spinner /> : null}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasMore && !more && !loading && !refreshing) load(shown.current + PAGE, "more");
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(shown.current, "refresh")} colors={[colors.accent]} />
      }
      ItemSeparatorComponent={Gap}
    />
  );
}

const Gap = () => <View style={{ height: space.md }} />;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.md, paddingBottom: space.xl },
  pad: { padding: space.md },
  toolbar: { gap: space.md, marginBottom: space.md },
  paused: { backgroundColor: "#fff4e5", borderRadius: radius, padding: space.md, borderWidth: 1, borderColor: "#f5c27a" },
  pausedText: { fontSize: 14, lineHeight: 19, color: "#8a5300", fontWeight: "600" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: radius,
    paddingLeft: space.lg,
  },
  barText: { flex: 1, fontSize: 14, color: colors.text },
  bold: { fontWeight: "700" },
  error: { fontSize: 14, color: colors.error },
});
