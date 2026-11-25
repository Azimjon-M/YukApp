// Yon menyu (sidebar): chapdan chiqadigan panel. Ikki qism (Azimjon, 2026-11-25): tepada — 📋 Yuklar (yoki 🚚 Mashinalar)
// va «Botni ochish» (botning o'z rasmi, assets/bot.jpg); pastda — ⚙️ Sozlamalar va ℹ️ Dastur haqida.
// Har bo'limning o'z pastki paneli (tabs) bor — masalan Sozlamalar ichida «E'lon» va «Hisob».
//
// Nega tayyor Drawer emas: expo-router/drawer react-native-reanimated va gesture-handler talab qiladi — ular C++ qismli
// og'ir kutubxonalar (Windows'da APK yig'ishni qiyinlashtirgan). Bu yerda oddiy Modal + Animated yetarli: ☰ bosilsa
// panel siljib chiqadi, fonga yoki «orqaga» tugmasiga bosilsa yopiladi.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Animated, Easing, Image, Linking, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router, usePathname } from "expo-router";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROLES } from "@yuk/shared";
import { badgeText, useNewLoads } from "../newLoads.js";
import { useSession } from "../session.js";
import { colors, space, themed } from "../theme.js";

const BOT_ICON = require("../../assets/bot.jpg"); // @Yuk_Ekspert_agent profil rasmi (160×160)

const MenuContext = createContext({ open: () => {}, close: () => {} });
export const useSideMenu = () => useContext(MenuContext);

// Qaysi bo'lim ochiq — manzilga qarab (menyuda belgilanadi)
function sectionOf(pathname) {
  if (pathname.startsWith("/sozlamalar")) return "sozlamalar";
  if (pathname.startsWith("/haqida")) return "haqida";
  return "asosiy";
}

export function SideMenuProvider({ children }) {
  const [visible, setVisible] = useState(false); // Modal ko'rinadimi (yopilish animatsiyasi tugaguncha true)
  const [progress] = useState(() => new Animated.Value(0)); // 0 — yopiq, 1 — ochiq

  const animate = useCallback(
    (to, done) =>
      Animated.timing(progress, {
        toValue: to,
        duration: to ? 240 : 180,
        easing: to ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(done),
    [progress],
  );

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => animate(0, () => setVisible(false)), [animate]);

  useEffect(() => {
    if (visible) animate(1);
  }, [visible, animate]);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <MenuContext.Provider value={value}>
      {children}
      <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={close}>
        <MenuPanel progress={progress} close={close} />
      </Modal>
    </MenuContext.Provider>
  );
}

function MenuPanel({ progress, close }) {
  const { me, botUsername } = useSession();
  const pathname = usePathname();
  const { count } = useNewLoads();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, Math.round(width * 0.82));
  const current = sectionOf(pathname);
  const shipper = me?.role === "yuk_beruvchi";
  const role = ROLES[me?.role];

  const loads = { id: "asosiy", icon: shipper ? "🚚" : "📋", label: shipper ? "Bo'sh mashinalar" : "Yuklar", href: "/", badge: badgeText(count) };
  const bottom = [
    { id: "sozlamalar", icon: "⚙️", label: "Sozlamalar", href: "/sozlamalar" },
    { id: "haqida", icon: "ℹ️", label: "Dastur haqida", href: "/haqida" },
  ];

  // Avval panel yopiladi, keyin bo'lim almashadi — ikkalasi bir vaqtda bo'lsa animatsiya qotib qoladi.
  // «Yuklar» doim ro'yxatning o'ziga olib boradi (Filtr ochiq bo'lsa ham)
  const go = (href, id) => {
    close();
    if (id !== current || id === "asosiy") router.navigate(href);
  };
  const openBot = () => {
    close();
    Linking.openURL(`https://t.me/${botUsername}`).catch(() => {});
  };

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-panelWidth, 0] });
  const initial = (me?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} aria-label="Menyuni yopish" />
      </Animated.View>

      <Animated.View style={[styles.panel, { width: panelWidth, transform: [{ translateX }] }]}>
        {/* Tepa: kim kirgan */}
        <View style={[styles.head, { paddingTop: insets.top + space.xl }]}>
          <View style={styles.bubble1} />
          <View style={styles.bubble2} />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {me?.name || "Ismsiz"}
          </Text>
          {me?.username ? <Text style={styles.username}>@{me.username}</Text> : null}
          {role ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {role.icon} {role.name}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Tepa: ish joyi — Yuklar va bot */}
        <View style={styles.items}>
          <MenuItem item={loads} on={current === loads.id} onPress={() => go(loads.href, loads.id)} />
          <Pressable role="button" onPress={openBot} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <Image source={BOT_ICON} style={styles.botIcon} accessibilityIgnoresInvertColors />
            <Text style={styles.itemText}>Botni ochish</Text>
          </Pressable>
        </View>

        {/* Past: sozlamalar va dastur haqida */}
        <View style={styles.bottomItems}>
          <View style={styles.divider} />
          {bottom.map((item) => (
            <MenuItem key={item.id} item={item} on={current === item.id} onPress={() => go(item.href, item.id)} />
          ))}
        </View>

        <Text style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
          Yuk Ekspert {Constants.expoConfig?.version ?? ""}
        </Text>
      </Animated.View>
    </View>
  );
}

function MenuItem({ item, on, onPress }) {
  return (
    <Pressable role="button" aria-selected={on} onPress={onPress} style={({ pressed }) => [styles.item, on && styles.itemOn, pressed && styles.pressed]}>
      <Text style={styles.itemIcon}>{item.icon}</Text>
      <Text style={[styles.itemText, on && styles.itemTextOn]}>{item.label}</Text>
      {item.badge ? (
        <View style={styles.badge2}>
          <Text style={styles.badge2Text}>{item.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// Sarlavhadagi ☰ tugmasi — har bo'limning chap tepasida
export function MenuButton() {
  const { open } = useSideMenu();
  return (
    <Pressable
      role="button"
      aria-label="Menyu"
      onPress={open}
      hitSlop={12}
      style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
    >
      <View style={styles.burgerLine} />
      <View style={[styles.burgerLine, styles.burgerShort]} />
      <View style={styles.burgerLine} />
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  backdrop: { backgroundColor: colors.backdrop },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.card,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
    elevation: 16,
  },
  head: {
    backgroundColor: colors.accent,
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
    gap: 4,
    overflow: "hidden",
  },
  // Fondagi bezak doiralar
  bubble1: { position: "absolute", width: 180, height: 180, borderRadius: 90, right: -60, top: -50, backgroundColor: "rgba(255,255,255,0.10)" },
  bubble2: { position: "absolute", width: 120, height: 120, borderRadius: 60, right: 40, bottom: -70, backgroundColor: "rgba(255,255,255,0.08)" },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  avatarText: { fontSize: 28, fontWeight: "800", color: "#fff" },
  name: { fontSize: 19, fontWeight: "800", color: "#fff" },
  username: { fontSize: 14, color: "rgba(255,255,255,0.85)" },
  badge: {
    alignSelf: "flex-start",
    marginTop: space.sm,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  items: { flex: 1, paddingVertical: space.md, paddingHorizontal: space.sm, gap: 2 },
  item: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 13, paddingHorizontal: space.lg, borderRadius: 12 },
  itemOn: { backgroundColor: colors.soft },
  bottomItems: { paddingHorizontal: space.sm, paddingBottom: space.sm, gap: 2 },
  itemIcon: { fontSize: 20, width: 28, textAlign: "center" },
  botIcon: { width: 28, height: 28, borderRadius: 14 },
  itemText: { fontSize: 16, fontWeight: "500", color: colors.text },
  itemTextOn: { fontWeight: "700", color: colors.accent },
  // Yangi yuklar soni — qizil doira (pastki paneldagi belgi bilan bir xil)
  badge2: { marginLeft: "auto", minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  badge2Text: { color: "#fff", fontSize: 13, fontWeight: "800" },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: space.sm, marginHorizontal: space.lg },
  pressed: { opacity: 0.6 },
  footer: { fontSize: 13, color: colors.hint, textAlign: "center" },
  menuButton: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: 4, justifyContent: "center" },
  burgerLine: { width: 22, height: 2.5, borderRadius: 2, backgroundColor: colors.text },
  burgerShort: { width: 15 },
  }),
);
