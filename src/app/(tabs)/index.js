// Lenta: yuklar (haydovchiga) yoki bo'sh mashinalar (yuk beruvchiga), eng yangisi tepada. Mini App'dagi
// «📋 Yuklar» / «🚚 Mashinalar» bilan bir xil (apps/web/src/LoadsPage.jsx): «Menga mos» yoki «Hammasi», 6/24/72 soat.
// Haydovchining «Menga mos» i — tanlangan yo'nalish bo'yicha (tepada «🧭 Qayerdan → Qayerga · O'zgartirish»).
// Ro'yxat ochiq turganda har daqiqada o'zi yangilanadi; pastga tortsa — darhol; oxiriga yetsa — yana 30 tasi.
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, FlatList, Linking, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { FEED_MODES, feedMode, routeChosen, routeLabel, sortedReady } from "@yuk/shared";
import { getLoads, getTrucks } from "../../api.js";
import { LoadCard, TruckCard } from "../../components/LoadCard.js";
import { useSession } from "../../session.js";
import { colors, radius, space } from "../../theme.js";
import { Button, Hint, Notice, Segmented, Spinner } from "../../ui.js";

const PAGE = 30;
const MAX = 500; // server bir so'rovda ko'pi bilan shuncha beradi
const REFRESH_MS = 60_000;
const VIEWS = [
  { id: "mine", label: "Menga mos" },
  { id: "all", label: "Hammasi" },
];
const HOURS = [
  { id: 6, label: "6 soat" },
  { id: 24, label: "24 soat" },
  { id: 72, label: "3 kun" },
];

const KINDS = {
  yuk: { fetch: getLoads, Card: LoadCard, many: "yuk" },
  mashina: { fetch: getTrucks, Card: TruckCard, many: "bo'sh mashina" },
};

// «⚡ Tezkor» / «📌 Mening guruhlarim»: yuklar saralanmaydi — bot ularni darhol yuboradi, bu yerda «Hammasi»
function rawFeedNote(profile) {
  const mode = FEED_MODES[feedMode(profile)];
  const how = mode.groups ? "tanlagan guruhlaringizdagi yuk e'lonlari" : "yuk e'lonlari";
  return `${mode.icon} ${mode.name}: ${how} botga darhol keladi. Bu yerda — hammasi.`;
}

export default function LoadsScreen() {
  const { me, botUsername } = useSession();
  const kind = me.role === "yuk_beruvchi" ? "mashina" : "yuk";
  const k = KINDS[kind];
  const driver = kind === "yuk";
  const profile = me.profile;

  // «Menga mos» faqat hisoblansa: haydovchiga transport (va saralangan rejim) kerak, yuk beruvchiga — hech narsa
  const canMine = driver ? Boolean(profile) && sortedReady(profile) : true;
  const [pickedView, setPickedView] = useState("mine");
  const view = canMine ? pickedView : "all";
  // Haydovchining «Menga mos» i yo'nalishsiz chiqmaydi — avval «Qayerdan → Qayerga»
  const needRoute = driver && view === "mine" && !routeChosen(profile);
  const [hours, setHours] = useState(24);
  // Sozlamalar yoki yo'nalish o'zgarsa (shu ilovada yoki botda) — ro'yxat qaytadan so'raladi
  const profileKey = JSON.stringify(profile ?? null);

  const [state, setState] = useState({ items: [], total: 0, loading: true, refreshing: false, more: false, error: null });
  const [now, setNow] = useState(() => Date.now());
  const shown = useRef(PAGE); // nechta ko'rsatilyapti — yangilashda ham shuncha qoladi
  const request = useRef(0); // eng oxirgi so'rov raqami: eski javob yangisini bosib ketmasin

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
        setNow(Date.now());
        setState({ items: data.items, total: data.total, loading: false, refreshing: false, more: false, error: null });
      } catch (error) {
        if (id !== request.current) return;
        // Jim yangilashda xato bo'lsa — eski ro'yxat qoladi, faqat tepada qator
        setState((s) => ({ ...s, loading: false, refreshing: false, more: false, error }));
      }
    },
    // profileKey so'rovda ishlatilmaydi, lekin o'zgarsa load yangilanadi → pastdagi useEffect ro'yxatni qayta so'raydi
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [k, view, hours, profileKey],
  );

  // Filtr o'zgardi — boshidan
  useEffect(() => {
    if (needRoute) return;
    shown.current = PAGE;
    load(PAGE);
  }, [load, needRoute]);

  // Ekran ko'rinib turganda har daqiqada yangilanadi; ilovaga qaytganda — darhol
  useFocusEffect(
    useCallback(() => {
      if (needRoute) return undefined;
      const timer = setInterval(() => {
        if (AppState.currentState === "active") load(shown.current, "silent");
      }, REFRESH_MS);
      const sub = AppState.addEventListener("change", (next) => {
        if (next === "active") load(shown.current, "silent");
      });
      return () => {
        clearInterval(timer);
        sub.remove();
      };
    }, [load, needRoute]),
  );

  const { items, total, loading, refreshing, more, error } = state;
  const hasMore = items.length < total && items.length < MAX;

  const header = (
    <View style={styles.toolbar}>
      {canMine ? (
        <Segmented options={VIEWS} value={view} onChange={setPickedView} />
      ) : driver && profile ? (
        <Hint>{rawFeedNote(profile)}</Hint>
      ) : null}
      {driver && !profile ? (
        <Notice
          title="🚚 Transportingizni kiriting"
          action={<Button title="Botda to'ldirish" kind="secondary" onPress={() => Linking.openURL(`https://t.me/${botUsername}`)} />}
        >
          Mos yuklarni saralash uchun transportingiz kerak. Hozircha uni botdagi «⚙️ Sozlamalar» da kiriting — ilovada ham
          tez orada bo'ladi. Pastda — hamma yuklar.
        </Notice>
      ) : null}
      {driver && view === "mine" && !needRoute ? (
        <View style={styles.routeBar}>
          <Text style={styles.routeText} numberOfLines={2}>
            🧭 <Text style={styles.bold}>{routeLabel(profile)}</Text>
          </Text>
          <Button title="O'zgartirish" kind="link" onPress={() => router.push("/yonalish")} />
        </View>
      ) : null}
      {!needRoute ? <Segmented options={HOURS} value={hours} onChange={setHours} /> : null}
      {!needRoute && !loading && !error ? (
        <Hint>{total ? `${total} ta ${k.many}` : null}</Hint>
      ) : null}
      {error && items.length ? <Text style={styles.error}>⚠️ {error.message}</Text> : null}
    </View>
  );

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
      renderItem={({ item }) => <k.Card item={item} now={now} />}
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
              ? `Tanlangan muddatda sizga mos ${k.many} chiqmadi. Muddatni uzaytiring yoki «Hammasi» ni oching.`
              : "Tanlangan muddatda e'lon chiqmadi."}
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
  routeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: radius,
    paddingLeft: space.lg,
  },
  routeText: { flex: 1, fontSize: 15, color: colors.text },
  bold: { fontWeight: "700" },
  error: { fontSize: 14, color: colors.error },
});
