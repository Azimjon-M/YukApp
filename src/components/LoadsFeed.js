// Lenta: yuklar (haydovchiga) yoki bo'sh mashinalar (yuk beruvchiga), eng yangisi tepada — faqat so'nggi 10 daqiqadagilar,
// eskisi o'zi yo'qoladi. Hammasi «🎛 Filtr» bo'yicha (server view=mine; «Hammasi» kerak bo'lsa — Filtrda hamma guruh/mashina/joy).
// Tepadagi filtr qatori qotib turadi (ro'yxat bilan aylanmaydi). Ekran ochiq turganda har 3 soniyada yangilanadi;
// yangi kelgan e'lon tepadan siljib, biroz yonib chiqadi. Filtr tanlanmagan bo'lsa — «🎛 Filtr» bo'limiga o'tkaziladi.
// Haydovchiga e'lonlar /pub/feed dan — bot yuboradigan asl e'lonlarning o'zi (Azimjon, 2026-11-24: «foydalanuvchilarga bu kerak»).
// Ko'rsatilgan yuklar «🔴 yangi» belgisidan chiqariladi (newLoads.js markSeen).
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, AppState, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { feedLabel } from "@yuk/shared";
import { getFeed, getTrucks } from "../api.js";
import { useNewLoads } from "../newLoads.js";
import { useSession } from "../session.js";
import { colors, radius, space, themed } from "../theme.js";
import { Button, Notice, Spinner } from "../ui.js";
import { LoadCard, TruckCard } from "./LoadCard.js";

const WINDOW_MS = 10 * 60_000; // ro'yxatda faqat so'nggi 10 daqiqa
const LIMIT = 200;
const REFRESH_MS = 3_000;

const KINDS = {
  // Haydovchiga — botdagidek asl e'lonlar (/pub/feed, AI'siz, hammasi); yuk beruvchiga — bo'sh mashinalar (server 1 soatdan kam bermaydi)
  yuk: { fetch: () => getFeed({ minutes: 10, limit: LIMIT }), Card: LoadCard, many: "e'lon" },
  mashina: { fetch: () => getTrucks({ view: "mine", hours: 1, limit: LIMIT }), Card: TruckCard, many: "bo'sh mashina" },
};

const timeOf = (item) => item.post?.postedAt ?? item.createdAt ?? 0;
// Eng tepada — eng oxirgi KELGANI (id o'sib boradi). E'lon vaqti bo'yicha tartibda kech yetib kelgan e'lon 2-3-o'ringa
// tushib qolardi va animatsiya «tepadagidan pastdagisida» ko'rinardi (Azimjon, 2026-11-25)
const fresh10 = (items, now) => items.filter((item) => now - timeOf(item) <= WINDOW_MS).sort((a, b) => Number(b.id) - Number(a.id));

// Yangi kelgan kartochka: tepadan siljib chiqadi va 1.5 soniya ko'k hoshiya bilan yonadi
function Appear({ isNew, children }) {
  const [anim] = useState(() => new Animated.Value(isNew ? 0 : 1));
  const [glow] = useState(() => new Animated.Value(isNew ? 1 : 0));
  useEffect(() => {
    if (!isNew) return;
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: false, friction: 7, tension: 60 }),
      Animated.timing(glow, { toValue: 0, duration: 1500, useNativeDriver: false }),
    ]).start();
  }, [isNew, anim, glow]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        borderRadius: radius + 2,
        borderWidth: 2,
        borderColor: glow.interpolate({ inputRange: [0, 1], outputRange: ["transparent", colors.accent] }),
      }}
    >
      {children}
    </Animated.View>
  );
}

export function LoadsFeed() {
  const { me, refreshMe } = useSession();
  const paused = me.active === false;
  const { count: freshCount, markSeen } = useNewLoads();
  const kind = me.role === "yuk_beruvchi" ? "mashina" : "yuk";
  const k = KINDS[kind];
  const driver = kind === "yuk";
  const profile = me.profile;

  // Haydovchi filtrni hali tanlamagan — ro'yxat hisoblanmaydi, «🎛 Filtr» ga o'tkaziladi
  const noFilter = driver && !profile;
  const idle = noFilter; // ro'yxat so'ralmaydi
  // Filtr yoki yo'nalish o'zgarsa (shu ilovada yoki botda) — ro'yxat qaytadan so'raladi
  const profileKey = JSON.stringify(profile ?? null);

  const [state, setState] = useState({ items: [], fresh: new Set(), loading: true, refreshing: false, error: null });
  const request = useRef(0); // eng oxirgi so'rov raqami: eski javob yangisini bosib ketmasin
  const focused = useRef(false);
  const known = useRef(null); // ko'rilgan id'lar: null = birinchi yuklash (animatsiyasiz)

  // mode: "full" (spinner) | "silent" (jimgina yangilash) | "refresh" (pastga tortdi)
  const load = useCallback(
    async (mode = "full") => {
      const id = ++request.current;
      setState((s) => ({ ...s, loading: mode === "full", refreshing: mode === "refresh", error: mode === "full" ? null : s.error }));
      try {
        const data = await k.fetch();
        if (id !== request.current) return;
        // Pauza botda yoki boshqa joyda o'zgargan bo'lsa — ilovadagi holat yangilanadi (server active ni aytadi)
        if (typeof data.active === "boolean" && data.active === paused) refreshMe().catch(() => {});
        const items = fresh10(data.items, Date.now());
        // Oldin ko'rilmagan id'lar — yangi (animatsiya); birinchi yuklashda hech biri yangi emas
        const seen = known.current;
        const fresh = new Set(seen ? items.filter((item) => !seen.has(item.id)).map((item) => item.id) : []);
        known.current = new Set(items.map((item) => item.id));
        setState({ items, fresh, loading: false, refreshing: false, error: null });
        if (focused.current) markSeen(data.items);
      } catch (error) {
        if (id !== request.current) return;
        // Jim yangilashda xato bo'lsa — eski ro'yxat qoladi (10 daqiqadan eskisi baribir yo'qoladi), tepada qator
        setState((s) => ({ ...s, items: fresh10(s.items, Date.now()), loading: false, refreshing: false, error }));
      }
    },
    // profileKey so'rovda ishlatilmaydi, lekin o'zgarsa load yangilanadi → pastdagi useEffect ro'yxatni qayta so'raydi
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [k, profileKey, markSeen, paused, refreshMe],
  );

  // Filtr o'zgardi — boshidan (eski ro'yxat animatsiyasiz almashadi)
  useEffect(() => {
    if (idle) return;
    known.current = null;
    load();
  }, [load, idle]);

  // Ekran ko'rinib turganda: darhol, keyin har 3 soniyada jimgina; ilovaga qaytganda — darhol.
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      const blur = () => {
        focused.current = false;
      };
      if (noFilter) {
        router.navigate("/filtr");
        return blur;
      }
      if (idle) return blur;
      load("silent");
      const timer = setInterval(() => {
        if (AppState.currentState === "active") load("silent");
      }, REFRESH_MS);
      const sub = AppState.addEventListener("change", (next) => {
        if (next === "active") load("silent");
      });
      return () => {
        blur();
        clearInterval(timer);
        sub.remove();
      };
    }, [load, idle, noFilter]),
  );

  // Yangi yuk keldi (newLoads.js sezdi) — darhol jimgina yangilanadi va belgi o'chadi
  useEffect(() => {
    if (!freshCount || idle || !focused.current) return undefined;
    const timer = setTimeout(() => load("silent"), 0);
    return () => clearTimeout(timer);
  }, [freshCount, idle, load]);

  const { items, fresh, loading, refreshing, error } = state;

  // Qotib turadigan tepa qism: pauza, filtr (yoki yo'nalish) qatori, xato
  const top = (
    <View style={styles.top}>
      {paused ? (
        <View style={styles.paused}>
          <Text style={styles.pausedText}>⏸ Pauzada — sizga yangi e'lonlar kelmaydi (ilovada ham, botda ham). Qayta yoqish uchun pastdagi «▶️ Davom etish» ni bosing.</Text>
        </View>
      ) : null}
      {driver && profile ? (
        <View style={styles.bar}>
          <Text style={styles.barText} numberOfLines={2}>
            {feedLabel(profile)}
          </Text>
          <Button title="O'zgartirish" kind="link" onPress={() => router.navigate("/filtr")} />
        </View>
      ) : null}
      {error && items.length ? <Text style={styles.error}>⚠️ {error.message}</Text> : null}
    </View>
  );

  if (noFilter) {
    return (
      <View style={[styles.page, styles.pad]}>
        <Notice title="🎛 Avval filtrni tanlang" action={<Button title="🎛 Filtrga o'tish" onPress={() => router.navigate("/filtr")} />}>
          Qaysi mashina va qayerdan ketadigan yuklar kerakligini belgilang — shunga mos e'lonlar shu yerda va botda chiqadi.
        </Notice>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {top}
      <FlatList
        style={styles.page}
        contentContainerStyle={styles.list}
        data={loading || paused ? [] : items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Appear isNew={fresh.has(item.id)}>
            <k.Card item={item} />
          </Appear>
        )}
        ListEmptyComponent={
          paused ? null : loading ? (
            <Spinner />
          ) : error ? (
            <Notice title="Ro'yxat ochilmadi" action={<Button title="Qayta urinish" onPress={() => load()} />}>
              {error.message}
            </Notice>
          ) : (
            <Notice title="Hozircha yangi e'lon yo'q">
              So'nggi 10 daqiqada filtringizga mos {k.many} chiqmadi. Yangilari shu yerda o'zi paydo bo'ladi.
            </Notice>
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} colors={[colors.accent]} />}
        ItemSeparatorComponent={Gap}
      />
    </View>
  );
}

const Gap = () => <View style={{ height: space.md }} />;

const styles = themed(() =>
  StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.md, paddingBottom: space.xl },
  pad: { padding: space.md, gap: space.md },
  // Qotib turadigan tepa qism: pastida soya — aylantirilgan e'lonlar ostidan o'tayotgani ko'rinadi, qorishib ketmaydi
  top: {
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.bg,
    zIndex: 2,
    elevation: 6, // Android soyasi
    shadowColor: colors.shadow, // iOS / web soyasi
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  paused: { backgroundColor: colors.warnBg, borderRadius: radius, padding: space.md, borderWidth: 1, borderColor: colors.warnBorder },
  pausedText: { fontSize: 14, lineHeight: 19, color: colors.warnText, fontWeight: "600" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.barBg, // kartalardan to'qroq ko'k — filtr qatori e'lon bilan adashmaydi
    borderWidth: 1,
    borderColor: colors.barBorder,
    borderRadius: radius,
    paddingLeft: space.lg,
  },
  barText: { flex: 1, fontSize: 14, color: colors.barText, fontWeight: "600" },
  bold: { fontWeight: "700" },
  error: { fontSize: 14, color: colors.error },
  }),
);
