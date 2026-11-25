// Lenta: yuklar (haydovchiga) yoki bo'sh mashinalar (yuk beruvchiga), eng yangisi tepada — faqat so'nggi 10 daqiqadagilar,
// eskisi o'zi yo'qoladi. Hammasi «🎛 Filtr» bo'yicha (server view=mine; «Hammasi» kerak bo'lsa — Filtrda hamma guruh/mashina/joy).
// Tepadagi filtr qatori qotib turadi (ro'yxat bilan aylanmaydi). Ekran ochiq turganda har 3 soniyada yangilanadi;
// yangi kelgan e'lon tepadan siljib, biroz yonib chiqadi. Filtr tanlanmagan bo'lsa — «🎛 Filtr» bo'limiga o'tkaziladi.
// Haydovchiga e'lonlar /pub/feed dan — bot yuboradigan asl e'lonlarning o'zi (Azimjon, 2026-11-24: «foydalanuvchilarga bu kerak»).
// Ko'rsatilgan yuklar «🔴 yangi» belgisidan chiqariladi (newLoads.js markSeen).
// Telegram'dagidek (Azimjon, 2026-11-25): tepada tursangiz yangisi tepadan kirib keladi; pastga aylantirgan bo'lsangiz
// ko'rib turgan kartangiz joyidan qimirlamaydi (maintainVisibleContentPosition), o'ng pastda «↑» tugmasi tepada hali
// ko'rilmagan e'lonlar sonini ko'rsatadi: bosilsa — ko'rilmaganlarning eng eskisiga, yana bosilsa — eng tepaga (unseenJump.js).
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, AppState, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { feedLabel } from "@yuk/shared";
import { getFeed, getTrucks } from "../api.js";
import { readCache, writeCache } from "../cache.js";
import { useNewLoads } from "../newLoads.js";
import { useSession } from "../session.js";
import { colors, radius, space, themed } from "../theme.js";
import { Button, Notice, Spinner } from "../ui.js";
import { clearOpenPost, useOpenPost } from "../openPost.js";
import { toast } from "../toast.js";
import { addUnseen, dropUnseen, jumpTarget, unseenText } from "../unseenJump.js";
import { LoadCard, TruckCard } from "./LoadCard.js";

const WINDOW_MS = 10 * 60_000; // ro'yxatda faqat so'nggi 10 daqiqa
const LIMIT = 200;
const REFRESH_MS = 3_000;
const AT_TOP = 80; // shundan yuqorida — «tepada»: yangisi o'zi ko'rinadi (ro'yxat tepaga suriladi)
const SHOW_AT = 300; // shundan pastga tushsa — «↑» tugmasi chiqadi
const NONE = new Set();

const KINDS = {
  // Haydovchiga — botdagidek asl e'lonlar (/pub/feed, AI'siz, hammasi); yuk beruvchiga — bo'sh mashinalar (server 1 soatdan kam bermaydi)
  yuk: { fetch: () => getFeed({ minutes: 10, limit: LIMIT }), Card: LoadCard, many: "e'lon" },
  mashina: { fetch: () => getTrucks({ view: "mine", hours: 1, limit: LIMIT }), Card: TruckCard, many: "bo'sh mashina" },
};

// Kesh: boshqa sahifaga o'tib qaytganda, ilovani yopib ochganda, rejim almashganda va pauzada ham oxirgi 10 daqiqalik
// e'lonlar darhol, joyidan ko'rinadi (Azimjon, 2026-11-25). Xotirada (tez) + faylda (ilova yopilsa ham)
const memory = new Map(); // kalit → { profileKey, items }
function cachedFeed(key, profileKey) {
  let hit = memory.get(key);
  if (!hit) {
    hit = readCache(key);
    if (hit) memory.set(key, hit);
  }
  return hit && hit.profileKey === profileKey && Array.isArray(hit.items) ? hit.items : null;
}
function rememberFeed(key, profileKey, items) {
  const hit = { profileKey, items };
  memory.set(key, hit);
  writeCache(key, hit);
}

const timeOf = (item) => item.post?.postedAt ?? item.createdAt ?? 0;
// Eng tepada — eng oxirgi KELGANI (id o'sib boradi). E'lon vaqti bo'yicha tartibda kech yetib kelgan e'lon 2-3-o'ringa
// tushib qolardi va animatsiya «tepadagidan pastdagisida» ko'rinardi (Azimjon, 2026-11-25)
const fresh10 = (items, now) => items.filter((item) => now - timeOf(item) <= WINDOW_MS).sort((a, b) => Number(b.id) - Number(a.id));

// Yangi kelgan kartochka: tepadan siljib chiqadi va 1.5 soniya ko'k hoshiya bilan yonadi.
// Bildirishnomadan ochilgan e'lon (isTarget): 2.5 soniya yashil hoshiya, keyin asta o'chadi
function Appear({ isNew, isTarget, children }) {
  const [anim] = useState(() => new Animated.Value(isNew ? 0 : 1));
  const [glow] = useState(() => new Animated.Value(isNew ? 1 : 0));
  const [mark] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!isNew) return;
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: false, friction: 7, tension: 60 }),
      Animated.timing(glow, { toValue: 0, duration: 1500, useNativeDriver: false }),
    ]).start();
  }, [isNew, anim, glow]);
  useEffect(() => {
    if (!isTarget) return;
    anim.setValue(1);
    mark.setValue(1);
    Animated.sequence([Animated.delay(2500), Animated.timing(mark, { toValue: 0, duration: 1500, useNativeDriver: false })]).start();
  }, [isTarget, anim, mark]);
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
      <Animated.View pointerEvents="none" style={[styles.target, { opacity: mark }]} />
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

  const cacheKey = `feed_${me.chatId}_${kind}`;
  const [state, setState] = useState(() => {
    const items = fresh10(cachedFeed(cacheKey, profileKey) ?? [], Date.now());
    return { items, fresh: new Set(), loading: !items.length && !cachedFeed(cacheKey, profileKey), refreshing: false, error: null, profileKey };
  });
  const request = useRef(0); // eng oxirgi so'rov raqami: eski javob yangisini bosib ketmasin
  const focused = useRef(false);
  // ko'rilgan id'lar (animatsiya faqat yangisiga): keshdagilar — ko'rilgan; null = birinchi yuklash (animatsiyasiz)
  const known = useRef(null);
  const lastIds = useRef("");

  // «↑» tugmasi: ro'yxat joyi, tepadagi ko'rilmaganlar, birinchi bosish bo'ldimi
  const listRef = useRef(null);
  const atTop = useRef(true);
  const jumped = useRef(false);
  const itemsRef = useRef(state.items);
  const [unseen, setUnseen] = useState(NONE);
  const [scrolled, setScrolled] = useState(false);
  const openPost = useOpenPost(); // bildirishnomadan bosilgan e'lon
  const [targetId, setTargetId] = useState(null); // yashil hoshiyali e'lon
  const viewPos = useRef(1); // oxirgi scrollToIndex: 0 — ekran tepasiga, 1 — pastiga
  if (known.current === null && state.items.length) known.current = new Set(state.items.map((item) => item.id));

  // mode: "full" (spinner) | "silent" (jimgina yangilash) | "refresh" (pastga tortdi)
  const load = useCallback(
    async (mode = "full") => {
      const id = ++request.current;
      setState((s) => ({ ...s, loading: mode === "full" || s.loading, refreshing: mode === "refresh", error: mode === "full" ? null : s.error }));
      try {
        const data = await k.fetch();
        if (id !== request.current) return;
        // Pauza botda yoki boshqa joyda o'zgargan bo'lsa — ilovadagi holat yangilanadi (server active ni aytadi)
        if (typeof data.active === "boolean" && data.active === paused) refreshMe().catch(() => {});
        // Pauzada server bo'sh ro'yxat beradi — oxirgi 10 daqiqalik e'lonlar ekranda qoladi (yangisi qo'shilmaydi)
        if (data.active === false) {
          setState((s) => ({ ...s, items: fresh10(s.items, Date.now()), loading: false, refreshing: false, error: null }));
          return;
        }
        const items = fresh10(data.items, Date.now());
        const ids = items.map((item) => item.id).join(",");
        if (ids !== lastIds.current) {
          lastIds.current = ids;
          rememberFeed(cacheKey, profileKey, items);
        }
        // Oldin ko'rilmagan id'lar — yangi (animatsiya); birinchi yuklashda hech biri yangi emas
        const seen = known.current;
        const fresh = new Set(seen ? items.filter((item) => !seen.has(item.id)).map((item) => item.id) : []);
        known.current = new Set(items.map((item) => item.id));
        setState({ items, fresh, loading: false, refreshing: false, error: null, profileKey });
        itemsRef.current = items;
        setUnseen((u) => dropUnseen(addUnseen(u, [...fresh], atTop.current), [], items));
        if (focused.current) markSeen(data.items);
      } catch (error) {
        if (id !== request.current) return;
        // Jim yangilashda xato bo'lsa — eski ro'yxat qoladi (10 daqiqadan eskisi baribir yo'qoladi), tepada qator
        setState((s) => ({ ...s, items: fresh10(s.items, Date.now()), loading: false, refreshing: false, error }));
      }
    },
    [k, profileKey, cacheKey, markSeen, paused, refreshMe],
  );

  // Filtr o'zgardi (shu ilovada yoki botda) — boshidan: keshdagi eski filtr ro'yxati ko'rsatilmaydi, animatsiyasiz
  useEffect(() => {
    if (idle || state.profileKey === profileKey) return;
    known.current = null;
    lastIds.current = "";
    itemsRef.current = [];
    setUnseen(NONE);
    jumped.current = false;
    setState((s) => ({ ...s, items: [], profileKey, loading: true }));
    load();
    // faqat filtr o'zgarganda (load har pauza/yangilanishda yangilanadi — har safar boshidan yuklamasin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey, idle]);

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

  const onScroll = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    atTop.current = y < AT_TOP;
    if (atTop.current) {
      jumped.current = false;
      setUnseen(NONE); // tepaga chiqdi — hammasi ko'rildi
    }
    setScrolled(y > SHOW_AT);
  }, []);
  // Ekranga (60% dan ko'prog'i) chiqqan kartalar — ko'rilgan
  const viewability = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewable = useRef(({ viewableItems }) => {
    const ids = viewableItems.map((v) => v.item.id);
    setUnseen((u) => dropUnseen(u, ids, itemsRef.current));
  }).current;

  const jump = () => {
    const list = listRef.current;
    if (!list) return;
    const target = jumpTarget(items, unseen, jumped.current);
    if (target.top) {
      jumped.current = false;
      list.scrollToOffset({ offset: 0, animated: true });
      return;
    }
    jumped.current = true;
    // eng eski ko'rilmagani ekran pastida — undan yuqoridagilarni ketma-ket o'qib chiqasiz
    viewPos.current = 1;
    list.scrollToIndex({ index: target.index, viewPosition: 1, animated: true });
  };
  // Karta hali o'lchanmagan (uzoqda) — taxminiy joyga, keyin aniq o'ziga
  const onScrollToIndexFailed = ({ index, averageItemLength }) => {
    listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: true });
    setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: viewPos.current, animated: true }), 350);
  };
  // Bildirishnoma bosildi: lenta kutmasdan darhol so'raladi (3 soniyalik navbatni kutmaydi)
  useEffect(() => {
    if (!openPost || idle) return undefined;
    const timer = setTimeout(() => load("silent"), 0);
    return () => clearTimeout(timer);
  }, [openPost, idle, load]);
  // E'lon ro'yxatga tushdi — ekran tepasiga olib kelinadi va yashil bilan belgilanadi; 15 soniyada topilmasa (eskirgan) — xabar
  useEffect(() => {
    if (!openPost || loading) return undefined;
    const index = items.findIndex((item) => String(item.id) === openPost.id);
    if (index < 0) {
      const left = 15_000 - (Date.now() - openPost.at);
      const timer = setTimeout(() => {
        clearOpenPost();
        toast("Bu e'lon endi lentada yo'q (10 daqiqadan eski)");
      }, Math.max(left, 0));
      return () => clearTimeout(timer);
    }
    // Tozalash timer ichida: clearOpenPost effektni qayta ishga tushiradi — oldinroq qilinsa, scroll bekor bo'lardi
    const id = items[index].id;
    const timer = setTimeout(() => {
      clearOpenPost();
      setTargetId(id);
      viewPos.current = 0;
      listRef.current?.scrollToIndex({ index, viewPosition: 0, animated: true });
    }, 50); // ro'yxat chizilib bo'lsin
    return () => clearTimeout(timer);
  }, [openPost, items, loading]);

  // Yashil belgi o'chgach — bo'shatiladi (xuddi shu e'lonning bildirishnomasi yana bosilsa, yana yonadi)
  useEffect(() => {
    if (targetId == null) return undefined;
    const timer = setTimeout(() => setTargetId(null), 4500);
    return () => clearTimeout(timer);
  }, [targetId]);

  const showJump = !loading && items.length > 0 && (scrolled || unseen.size > 0);

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
        ref={listRef}
        style={styles.page}
        contentContainerStyle={styles.list}
        data={loading ? [] : items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Appear isNew={fresh.has(item.id)} isTarget={item.id === targetId}>
            <k.Card item={item} />
          </Appear>
        )}
        ListEmptyComponent={
          loading ? (
            <Spinner />
          ) : error ? (
            <Notice title="Ro'yxat ochilmadi" action={<Button title="Qayta urinish" onPress={() => load()} />}>
              {error.message}
            </Notice>
          ) : paused ? null : (
            <Notice title="Hozircha yangi e'lon yo'q">
              So'nggi 10 daqiqada filtringizga mos {k.many} chiqmadi. Yangilari shu yerda o'zi paydo bo'ladi.
            </Notice>
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} colors={[colors.accent]} />}
        ItemSeparatorComponent={Gap}
        // Pastda turganda tepaga yangisi qo'shilsa — ko'rinib turgan karta joyida qoladi; tepada bo'lsa — tepaga suriladi
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: AT_TOP }}
        onScroll={onScroll}
        scrollEventThrottle={100}
        viewabilityConfig={viewability}
        onViewableItemsChanged={onViewable}
        onScrollToIndexFailed={onScrollToIndexFailed}
      />
      {showJump ? <JumpButton count={unseen.size} onPress={jump} /> : null}
    </View>
  );
}

// O'ng pastdagi yumaloq «↑» tugmasi, ustida ko'rilmaganlar soni
function JumpButton({ count, onPress }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  }, [anim]);
  return (
    <Animated.View style={[styles.jump, { opacity: anim, transform: [{ scale: anim }] }]}>
      <Pressable onPress={onPress} style={styles.jumpBtn} hitSlop={8} accessibilityLabel="Tepaga">
        {/* Strelka chiziqlardan chiziladi — «↑» harfi juda ingichka chiqardi (Azimjon: «sal qalinroq») */}
        <View style={styles.arrow} pointerEvents="none">
          <View style={[styles.arrowWing, styles.arrowLeft]} />
          <View style={[styles.arrowWing, styles.arrowRight]} />
          <View style={styles.arrowStem} />
        </View>
      </Pressable>
      {count > 0 ? (
        <View style={styles.jumpBadge} pointerEvents="none">
          <Text style={styles.jumpBadgeText}>{unseenText(count)}</Text>
        </View>
      ) : null}
    </Animated.View>
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
  // bildirishnomadan ochilgan e'lon hoshiyasi (Appear)
  target: { position: "absolute", top: -2, left: -2, right: -2, bottom: -2, borderRadius: radius + 2, borderWidth: 3, borderColor: colors.ok },
  jump: { position: "absolute", right: space.lg, bottom: space.lg, alignItems: "center" },
  jumpBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    elevation: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  arrow: { width: 22, height: 22 },
  arrowStem: { position: "absolute", left: 9.5, top: 2, width: 3, height: 19, borderRadius: 1.5, backgroundColor: colors.accent },
  arrowWing: { position: "absolute", top: 5.5, width: 13, height: 3, borderRadius: 1.5, backgroundColor: colors.accent },
  arrowLeft: { left: 1.5, transform: [{ rotate: "-45deg" }] },
  arrowRight: { right: 1.5, transform: [{ rotate: "45deg" }] },
  jumpBadge: {
    position: "absolute",
    top: -10,
    minWidth: 24,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 7,
  },
  jumpBadgeText: { color: colors.accentText, fontSize: 12, fontWeight: "700" },
  }),
);
