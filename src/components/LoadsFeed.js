// Lenta: yuklar (haydovchiga) yoki bo'sh mashinalar (yuk beruvchiga), eng yangisi tepada — faqat so'nggi 10 daqiqadagilar,
// eskisi o'zi yo'qoladi. Hammasi «🎛 Filtr» bo'yicha (server view=mine; «Hammasi» kerak bo'lsa — Filtrda hamma guruh/mashina/joy).
// Tepadagi filtr qatori qotib turadi (ro'yxat bilan aylanmaydi). Ekran ochiq turganda har 3 soniyada yangilanadi;
// yangi kelgan e'lon tepadan siljib, biroz yonib chiqadi. Filtr tanlanmagan bo'lsa — «🎛 Filtr» bo'limiga o'tkaziladi.
// Haydovchiga e'lonlar /pub/feed dan — bot yuboradigan asl e'lonlarning o'zi (Azimjon, 2026-11-24: «foydalanuvchilarga bu kerak»).
// Ko'rsatilgan yuklar «🔴 yangi» belgisidan chiqariladi (newLoads.js markSeen).
// Telegram'dagidek (Azimjon, 2026-11-25): tepada tursangiz yangisi tepadan kirib keladi; pastga aylantirgan bo'lsangiz
// ko'rib turgan kartangiz joyidan qimirlamaydi (maintainVisibleContentPosition), o'ng pastda «↑» tugmasi tepada hali
// ko'rilmagan e'lonlar sonini ko'rsatadi: bosilsa — ko'rilmaganlarning eng eskisiga, yana bosilsa — eng tepaga (unseenJump.js).
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, Easing, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { feedLabel } from "@yuk/shared";
import { appOn, getFeed, getTrucks } from "../api.js";
import { JoinWall } from "./JoinWall.js";
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
// Telegram'dagidek silliqlik (Azimjon, 2026-11-26: «qotib qolib ishlab ketgandek … mukammal chat bo'lsin»):
// bir yo'la ko'p e'lon kelsa (ilovaga qaytdi, bildirishnomadan kirdi) — animatsiyasiz, darhol; bittalab kelsa — animatsiya
const ANIMATE_MAX = 4; // bir yangilanishda shundan ko'p yangi e'lon — animatsiyasiz
const GAP_MS = 10_000; // oxirgi yangilanishdan shuncha o'tgan bo'lsa (ilova fonda edi) — animatsiyasiz
const NEAR = 4; // bildirishnomadagi e'lon shuncha karta ichida bo'lsa — silliq aylantiriladi, uzoqda bo'lsa — darhol sakraydi
const FOLLOW = { minIndexForVisible: 0, autoscrollToTopThreshold: AT_TOP };
const KEEP = { minIndexForVisible: 0 };

const KINDS = {
  // Haydovchiga — botdagidek asl e'lonlar (/pub/feed, AI'siz, hammasi); yuk beruvchiga — bo'sh mashinalar (server 1 soatdan kam bermaydi)
  yuk: { fetch: (options) => getFeed({ minutes: 10, limit: LIMIT }, options), Card: LoadCard, many: "e'lon" },
  mashina: { fetch: (options) => getTrucks({ view: "mine", hours: 1, limit: LIMIT }, options), Card: TruckCard, many: "bo'sh mashina" },
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

// Har 3 soniyada server ro'yxatni yangi obyektlar bilan beradi. O'zgarmagan e'lonning eski obyekti qaytariladi — kartasi
// qayta chizilmaydi (LoadCard memo); hech narsa o'zgarmagan bo'lsa ro'yxatning o'zi qaytadi — ekran umuman qayta chizilmaydi
const signs = new WeakMap(); // e'lon obyekti → matn izi (har 3 soniyada qayta hisoblanmasin)
const sign = (item) => {
  let text = signs.get(item);
  if (text === undefined) {
    text = JSON.stringify(item);
    signs.set(item, text);
  }
  return text;
};
function reuse(prev, next) {
  if (!prev.length) return next;
  const old = new Map(prev.map((item) => [item.id, item]));
  let same = prev.length === next.length;
  const out = next.map((item, i) => {
    const was = old.get(item.id);
    const keep = was && sign(was) === sign(item) ? was : item;
    if (keep !== prev[i]) same = false;
    return keep;
  });
  return same ? prev : out;
}
const SILENT_WAIT_MS = 25_000; // jim so'rov shuncha javob bermasa — yangisi yuboriladi
const SILENT_FAILS = 3; // jim yangilash ketma-ket shuncha marta o'tmasa — tepada xato qatori (bir martalik uzilish ko'rsatilmaydi)

// Yangi kelgan kartochka: tepadan yengil siljib, xiralikdan ochilib chiqadi va 1.5 soniya ko'k hoshiya bilan yonadi.
// Bildirishnomadan ochilgan e'lon (isTarget): 2.5 soniya yashil hoshiya, keyin asta o'chadi.
// Hammasi useNativeDriver — animatsiya telefonning chizish oqimida ishlaydi, lenta yangilanayotganda ham qotmaydi.
// played — allaqachon animatsiya qilingan id'lar: karta ekrandan chiqib qaytsa (FlatList qayta yasaydi) qayta o'ynamaydi
const played = new Set();
function Appear({ id, isNew, isTarget, children }) {
  const start = isNew && !played.has(id);
  const [anim] = useState(() => new Animated.Value(start ? 0 : 1));
  const [glow] = useState(() => new Animated.Value(start ? 1 : 0));
  const [mark] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!start) return;
    played.add(id);
    if (played.size > 2000) played.clear();
    Animated.timing(anim, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(glow, { toValue: 0, duration: 1400, delay: 500, useNativeDriver: true }).start();
    // faqat birinchi chizilishda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!isTarget) return;
    anim.setValue(1);
    glow.setValue(0); // ko'k «yangi» hoshiya o'rniga — faqat yashil
    mark.setValue(1);
    Animated.sequence([Animated.delay(2500), Animated.timing(mark, { toValue: 0, duration: 1200, useNativeDriver: true })]).start();
  }, [isTarget, anim, glow, mark]);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] }}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glow }]} />
      <Animated.View pointerEvents="none" style={[styles.target, { opacity: mark }]} />
    </Animated.View>
  );
}

// Bitta qator: faqat o'zining e'loni yoki belgisi o'zgarsa qayta chiziladi (lenta har 3 soniyada yangilanadi)
const Row = memo(function Row({ item, isNew, isTarget, Card }) {
  return (
    <Appear id={item.id} isNew={isNew} isTarget={isTarget}>
      <Card item={item} />
    </Appear>
  );
});

export function LoadsFeed() {
  const { me, refreshMe } = useSession();
  const paused = !appOn(me); // ilova pauzasi (botnikidan alohida)
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
    // Keshdagi hammasi eskirgan bo'lsa — «e'lon yo'q» emas, javob kelguncha aylanma belgi (yolg'on «bo'sh» miltillamasin)
    return { items, fresh: NONE, loading: !items.length, refreshing: false, error: null, profileKey };
  });
  const request = useRef(0); // eng oxirgi so'rov raqami: eski javob yangisini bosib ketmasin
  // Sekin internetda javob 3 soniyadan kech kelsa, keyingi jim so'rov uni «eskirgan» qilib tashlardi va lenta umuman
  // yangilanmay qolardi. Endi jim so'rov oldingisi tugaguncha kutadi
  const flying = useRef(0); // ketayotgan so'rov boshlangan vaqt (0 — yo'q)
  const fails = useRef(0); // ketma-ket o'tmagan jim so'rovlar
  const focused = useRef(false);
  // ko'rilgan id'lar (animatsiya faqat yangisiga): keshdagilar — ko'rilgan; null = birinchi yuklash (animatsiyasiz)
  const known = useRef(null);
  const lastIds = useRef("");
  const lastOk = useRef(0); // oxirgi muvaffaqiyatli yangilanish vaqti (fondan qaytganini shundan bilamiz)
  const opening = useRef(false); // bildirishnomadan e'lon ochilyapti — yangi kelganlar animatsiyasiz

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
  // Bildirishnomadan ochilgan e'lon «ushlab turiladi»: undan keyin kelganlar TEPASIGA qo'shiladi (yuqoriga aylantirsa
  // ko'rinadi, «↑» da soni), ekran o'zidan-o'zi eng yangisiga sakramaydi (Azimjon, 2026-11-25). Foydalanuvchi o'zi tepaga
  // chiqqanda yoki «↑» bilan eng tepaga o'tganda — odatdagi holat (tepada turganda yangisi o'zi ko'rinadi)
  const [hold, setHold] = useState(false);
  const [blocked, setBlocked] = useState(null); // a'zo emas: [{ ref, title, url }] | null
  const holdRef = useRef(false);
  const dragged = useRef(false); // foydalanuvchi barmog'i bilan aylantirdimi (scrollToIndex emas)
  const lastY = useRef(0);
  const holdOn = useCallback((on) => {
    holdRef.current = on;
    dragged.current = false;
    setHold(on);
  }, []);
  if (known.current === null && state.items.length) known.current = new Set(state.items.map((item) => item.id));

  // mode: "full" (spinner) | "silent" (jimgina yangilash) | "refresh" (pastga tortdi)
  const load = useCallback(
    async (mode = "full") => {
      if (mode === "silent" && flying.current && Date.now() - flying.current < SILENT_WAIT_MS) return;
      const id = ++request.current;
      flying.current = Date.now();
      // jim yangilashda holat o'zgarmaydi — ekran bekorga qayta chizilmasin
      if (mode !== "silent") setState((s) => ({ ...s, loading: mode === "full" || s.loading, refreshing: mode === "refresh", error: mode === "full" ? null : s.error }));
      try {
        const data = await k.fetch(mode === "silent" ? { retry: false } : undefined);
        if (id !== request.current) return;
        fails.current = 0;
        // Majburiy kanal/guruhdan chiqqan — e'lonlar to'xtaydi, sababi va «a'zo bo'ling» (JoinWall)
        if (data.member?.ok === false) {
          setBlocked(data.member.missing ?? []);
          itemsRef.current = [];
          setState((s) => ({ ...s, items: [], fresh: NONE, loading: false, refreshing: false, error: null }));
          return;
        }
        setBlocked(null);
        // Ilova pauzasi boshqa telefonda o'zgargan bo'lsa — holat yangilanadi (server lentada active = ilova pauzasi)
        if (typeof data.active === "boolean" && data.active === paused) refreshMe().catch(() => {});
        // Pauzada server bo'sh ro'yxat beradi — oxirgi 10 daqiqalik e'lonlar ekranda qoladi (yangisi qo'shilmaydi)
        if (data.active === false) {
          lastOk.current = Date.now();
          setState((s) => ({ ...s, items: fresh10(s.items, Date.now()), loading: false, refreshing: false, error: null }));
          return;
        }
        const items = reuse(itemsRef.current, fresh10(data.items, Date.now()));
        const ids = items.map((item) => item.id).join(",");
        if (ids !== lastIds.current) {
          lastIds.current = ids;
          rememberFeed(cacheKey, profileKey, items);
        }
        // Oldin ko'rilmagan id'lar — yangi (animatsiya); birinchi yuklashda hech biri yangi emas
        const seen = known.current;
        const prev = itemsRef.current;
        const added = seen ? items.filter((item) => !seen.has(item.id)).map((item) => item.id) : [];
        known.current = new Set(items.map((item) => item.id));
        // Ko'p e'lon birdan (fondan qaytdi, uzilishdan keyin, bildirishnomadan kirdi) — animatsiyasiz, darhol joyida
        const bulk = added.length > ANIMATE_MAX || Date.now() - lastOk.current > GAP_MS || opening.current;
        lastOk.current = Date.now();
        const fresh = added.length && !bulk ? new Set(added) : NONE;
        // Eski ro'yxatdan hech narsa qolmadi (uzoq vaqt fonda edi) — ushlab turadigan karta yo'q: boshidan, tepadan
        const replaced = prev.length > 0 && items.length > 0 && !items.some((item) => seen?.has(item.id));
        setState((s) =>
          s.items === items && !s.fresh.size && !fresh.size && !s.loading && !s.refreshing && !s.error && s.profileKey === profileKey
            ? s
            : { items, fresh, loading: false, refreshing: false, error: null, profileKey },
        );
        itemsRef.current = items;
        if (replaced && !opening.current) {
          if (holdRef.current) holdOn(false);
          jumped.current = false;
          atTop.current = true;
          lastY.current = 0;
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
          setUnseen(NONE);
          setScrolled(false);
        } else {
          setUnseen((u) => dropUnseen(addUnseen(u, added, atTop.current && !holdRef.current), [], items));
        }
        if (focused.current) markSeen(data.items);
      } catch (error) {
        if (id !== request.current) return;
        // Jim yangilashda xato bo'lsa — eski ro'yxat qoladi (10 daqiqadan eskisi baribir yo'qoladi), tepada qator
        const show = mode !== "silent" || ++fails.current >= SILENT_FAILS;
        setState((s) => {
          const items = fresh10(s.items, Date.now());
          itemsRef.current = items;
          // Ko'rsatadigan e'lon qolmagan bo'lsa — «e'lon yo'q» emas, xatoning o'zi («Qayta urinish» bilan)
          return { ...s, items, loading: false, refreshing: false, error: show || !items.length ? error : s.error };
        });
      } finally {
        if (id === request.current) flying.current = 0;
      }
    },
    [k, profileKey, cacheKey, markSeen, paused, refreshMe, holdOn],
  );

  // Filtr o'zgardi (shu ilovada yoki botda) — boshidan: keshdagi eski filtr ro'yxati ko'rsatilmaydi, animatsiyasiz
  useEffect(() => {
    if (idle || state.profileKey === profileKey) return;
    known.current = null;
    lastIds.current = "";
    itemsRef.current = [];
    setUnseen(NONE);
    jumped.current = false;
    holdOn(false);
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
      // Qaytganda (boshqa sahifadan yoki fondan): eskirgan (10 daqiqadan o'tgan) e'lonlar DARHOL olinadi — javobni kutib
      // eski ro'yxat ko'rinib turmaydi; hammasi eskirgan bo'lsa — aylanma belgi, keyin yangilari animatsiyasiz chiqadi
      const back = () => {
        setState((s) => {
          const items = fresh10(s.items, Date.now());
          if (items.length === s.items.length) return s;
          itemsRef.current = items;
          return { ...s, items, fresh: NONE, loading: s.loading || !items.length };
        });
        load("silent");
      };
      back();
      const timer = setInterval(() => {
        if (AppState.currentState === "active") load("silent");
      }, REFRESH_MS);
      const sub = AppState.addEventListener("change", (next) => {
        if (next === "active") back();
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
    const fromBelow = lastY.current >= AT_TOP;
    lastY.current = y;
    atTop.current = y < AT_TOP;
    // ushlab turilgan holatda: faqat foydalanuvchi o'zi pastdan tepaga chiqqanda bo'shatiladi
    if (atTop.current && holdRef.current && dragged.current && fromBelow) {
      holdRef.current = false;
      setHold(false);
    }
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

  // Kartaga borish. Uzoqdagi karta hali o'lchanmagan bo'lishi mumkin (FlatList faqat ko'rinadiganlarini chizadi) —
  // shunda taxminiy joyga o'tib, bir necha marta qayta uriniladi (goal). animated: false — darhol (Telegram'da xabarga
  // sakrash kabi), true — silliq
  const goal = useRef(null); // { index, viewPosition, animated, tries }
  const goTo = useCallback((index, viewPosition, animated) => {
    goal.current = { index, viewPosition, animated, tries: 0 };
    viewPos.current = viewPosition;
    listRef.current?.scrollToIndex({ index, viewPosition, animated, viewOffset: viewPosition === 0 ? space.sm : 0 });
  }, []);
  const onScrollToIndexFailed = useCallback(({ index, averageItemLength }) => {
    const want = goal.current;
    if (!want || want.index !== index || want.tries >= 6) return;
    want.tries++;
    listRef.current?.scrollToOffset({ offset: Math.max(0, averageItemLength * index), animated: false });
    setTimeout(() => {
      if (goal.current !== want) return; // boshqa joyga o'tildi
      listRef.current?.scrollToIndex({ index, viewPosition: want.viewPosition, animated: false, viewOffset: want.viewPosition === 0 ? space.sm : 0 });
    }, 80);
  }, []);

  const jump = () => {
    const list = listRef.current;
    if (!list) return;
    const target = jumpTarget(items, unseen, jumped.current);
    if (target.top) {
      jumped.current = false;
      goal.current = null;
      if (holdRef.current) holdOn(false);
      list.scrollToOffset({ offset: 0, animated: true });
      return;
    }
    jumped.current = true;
    // eng eski ko'rilmagani ekran pastida — undan yuqoridagilarni ketma-ket o'qib chiqasiz
    goTo(target.index, 1, true);
  };
  // Bildirishnoma ichida e'lonning o'zi keldi — serverni kutmasdan darhol lentaga (keyingi so'rov to'liq matn bilan almashtiradi)
  useEffect(() => {
    opening.current = Boolean(openPost); // shu paytda kelgan yangilari — animatsiyasiz (load)
    const item = openPost?.item;
    if (!item || idle) return undefined;
    const timer = setTimeout(() => {
      setState((s) => {
        if (s.items.some((one) => String(one.id) === openPost.id)) return s;
        const items = fresh10([item, ...s.items], Date.now());
        known.current = new Set([...(known.current ?? []), ...items.map((one) => one.id)]); // ko'k «yangi» animatsiyasiz
        itemsRef.current = items;
        return { ...s, items, fresh: NONE, loading: false };
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [openPost, idle]);
  // «E'lon ochilmoqda…»: e'lon hali lentada yo'q (bildirishnomada kelmagan, server javobini kutyapmiz). 700 ms dan oldin
  // topilsa — ko'rinmaydi. Ekranni to'smaydi (qoraytirmaydi) — tepada kichik belgi, lenta ishlayveradi
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (!openPost || idle) return undefined;
    const timer = setTimeout(() => setWaiting(true), 700);
    return () => {
      clearTimeout(timer);
      setWaiting(false);
    };
  }, [openPost, idle]);

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
      holdOn(true);
      setTargetId(id);
      // Yaqinda bo'lsa — silliq; uzoqda bo'lsa — darhol o'sha joyga (uzoq, uzuq-yuluq aylanish «qotgandek» tuyulardi)
      goTo(index, 0, index <= NEAR && lastY.current < 1500);
    }, 60); // ro'yxat chizilib bo'lsin
    return () => clearTimeout(timer);
  }, [openPost, items, loading, holdOn, goTo]);

  // Yashil belgi o'chgach — bo'shatiladi (xuddi shu e'lonning bildirishnomasi yana bosilsa, yana yonadi)
  useEffect(() => {
    if (targetId == null) return undefined;
    const timer = setTimeout(() => setTargetId(null), 4500);
    return () => clearTimeout(timer);
  }, [targetId]);

  const showJump = !loading && items.length > 0 && (scrolled || unseen.size > 0);
  const CardOf = k.Card;
  const renderItem = useCallback(
    ({ item }) => <Row item={item} isNew={fresh.has(item.id)} isTarget={item.id === targetId} Card={CardOf} />,
    [fresh, targetId, CardOf],
  );
  const onDragStart = useCallback(() => {
    dragged.current = true;
    goal.current = null; // foydalanuvchi o'zi aylantirdi — avtomatik o'tish to'xtaydi
  }, []);

  // Qotib turadigan tepa qism: pauza, filtr (yoki yo'nalish) qatori, xato
  const top = (
    <View style={styles.top}>
      {paused ? (
        <View style={styles.paused}>
          <Text style={styles.pausedText}>⏸ Ilova pauzada — bu yerga va bildirishnomaga yangi e'lon kelmaydi (bot alohida). Qayta yoqish uchun pastdagi «▶️ Davom etish» ni bosing.</Text>
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

  if (blocked) {
    return (
      <View style={[styles.page, styles.pad]}>
        <JoinWall missing={blocked} onJoined={() => load("full")} />
      </View>
    );
  }

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
        renderItem={renderItem}
        // Yengil ro'yxat: ekran atrofidagi kartalargina chiziladi, yangilari kichik bo'laklarda qo'shiladi
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={40}
        windowSize={9}
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
        // Bildirishnomadan ochilgan e'lon ushlab turilganda — tepaga avto-aylantirish yo'q (yangilari ustida yig'iladi)
        maintainVisibleContentPosition={hold ? KEEP : FOLLOW}
        onScroll={onScroll}
        onScrollBeginDrag={onDragStart}
        scrollEventThrottle={32}
        viewabilityConfig={viewability}
        onViewableItemsChanged={onViewable}
        onScrollToIndexFailed={onScrollToIndexFailed}
      />
      <JumpButton visible={showJump} count={unseen.size} onPress={jump} />
      {waiting ? (
        <View style={styles.wait} pointerEvents="none">
          <View style={styles.waitBox}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.waitText}>E'lon ochilmoqda…</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// O'ng pastdagi yumaloq «↑» tugmasi, ustida ko'rilmaganlar soni
// visible: chiqishi ham, yo'qolishi ham silliq (doim chizilgan, ko'rinmaganda bosilmaydi); son o'zgarsa — yengil «turtki»
function JumpButton({ visible, count, onPress }) {
  const [anim] = useState(() => new Animated.Value(0));
  const [bump] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.timing(anim, { toValue: visible ? 1 : 0, duration: visible ? 180 : 140, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [anim, visible]);
  useEffect(() => {
    if (!count) return;
    bump.setValue(1.25);
    Animated.spring(bump, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [bump, count]);
  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[styles.jump, { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}
    >
      <Pressable onPress={onPress} style={styles.jumpBtn} hitSlop={8} accessibilityLabel="Tepaga">
        {/* Strelka chiziqlardan chiziladi — «↑» harfi juda ingichka chiqardi (Azimjon: «sal qalinroq») */}
        <View style={styles.arrow} pointerEvents="none">
          <View style={[styles.arrowWing, styles.arrowLeft]} />
          <View style={[styles.arrowWing, styles.arrowRight]} />
          <View style={styles.arrowStem} />
        </View>
      </Pressable>
      {count > 0 ? (
        <Animated.View style={[styles.jumpBadge, { transform: [{ scale: bump }] }]} pointerEvents="none">
          <Text style={styles.jumpBadgeText}>{unseenText(count)}</Text>
        </Animated.View>
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
  wait: { position: "absolute", top: space.md, left: 0, right: 0, alignItems: "center", zIndex: 5 },
  waitBox: { flexDirection: "row", backgroundColor: colors.card, borderRadius: 20, paddingVertical: space.sm, paddingHorizontal: space.lg, alignItems: "center", gap: space.sm, elevation: 6, borderWidth: 1, borderColor: colors.line },
  waitText: { fontSize: 14, fontWeight: "600", color: colors.text },
  // yangi kelgan e'lonning ko'k hoshiyasi (Appear) — karta ustida, joyni o'zgartirmaydi
  glow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, borderWidth: 2, borderColor: colors.accent },
  // bildirishnomadan ochilgan e'lon hoshiyasi (Appear)
  target: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, borderWidth: 3, borderColor: colors.ok },
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
