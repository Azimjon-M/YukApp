// «ℹ️ Dastur haqida»: ilova, muallif (Telegram) va qo'llab-quvvatlash kartalari (Visa / Humo, bosib nusxa olinadi).
import { useEffect, useRef, useState } from "react";
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space, themed } from "../../theme.js";

const AUTHOR = { name: "Meliboev Azimjon", telegram: "gt_rushsher" };

// Qo'llab-quvvatlash kartalari. Raqam bo'shliqsiz saqlanadi — nusxada ham shunday (bank ilovalari shuni kutadi)
const CARDS = [
  { id: "visa", brand: "VISA", number: "4231200012856273", bg: "#1a1f71", glow: "#3d4bc7", brandStyle: "visa" },
  { id: "humo", brand: "HUMO", number: "9860167824146705", bg: "#0b6e5c", glow: "#19a88a", brandStyle: "humo" },
];

const mono = Platform.select({ ios: "Menlo", default: "monospace" });
const groups = (number) => number.replace(/(\d{4})(?=\d)/g, "$1 ");

export default function AboutScreen() {
  const insets = useSafeAreaInsets(); // pastdagi tizim tugmalari (back/home) ostiga kirmasin
  const version = Constants.expoConfig?.version ?? "";
  const openTelegram = () => Linking.openURL(`https://t.me/${AUTHOR.telegram}`).catch(() => {});

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl * 1.5 }]}>
      {/* Ilova */}
      <View style={styles.hero}>
        <View style={styles.heroBubble1} />
        <View style={styles.heroBubble2} />
        <Image source={require("../../../assets/icon.png")} style={styles.logo} />
        <Text style={styles.appName}>Yuk Ekspert</Text>
        <Text style={styles.version}>Versiya {version}</Text>
        <Text style={styles.heroText}>
          Yuk va bo'sh mashinalarni bir joyda topish uchun ilova. Telegram bot bilan birga ishlaydi — mos e'lonlar
          darhol sizga yetib keladi.
        </Text>
      </View>

      {/* Muallif */}
      <Text style={styles.sectionTitle}>👨‍💻 Muallif</Text>
      <View style={styles.card}>
        <View style={styles.authorRow}>
          <View style={styles.authorAvatar}>
            <Text style={styles.authorInitials}>MA</Text>
          </View>
          <View style={styles.authorText}>
            <Text style={styles.authorName}>{AUTHOR.name}</Text>
            <Text style={styles.authorRole}>Dasturchi · Yuk Ekspert asoschisi</Text>
          </View>
        </View>
        <Pressable
          role="link"
          onPress={openTelegram}
          style={({ pressed }) => [styles.telegram, pressed && styles.pressed]}
        >
          <Text style={styles.telegramIcon}>✈️</Text>
          <View style={styles.telegramText}>
            <Text style={styles.telegramTitle}>Telegram orqali yozish</Text>
            <Text style={styles.telegramLink}>t.me/{AUTHOR.telegram}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      {/* Qo'llab-quvvatlash */}
      <Text style={styles.sectionTitle}>💙 Qo'llab-quvvatlash</Text>
      <View style={styles.card}>
        <Text style={styles.supportText}>
          Yuk Ekspert bepul va doimiy rivojlanmoqda. Loyihani qo'llab-quvvatlamoqchi bo'lsangiz — quyidagi kartalardan
          biriga istalgan miqdorda o'tkazishingiz mumkin. Har bir yordam uchun rahmat! 🙏
        </Text>
        {CARDS.map((card) => (
          <BankCard key={card.id} card={card} />
        ))}
        <Text style={styles.tapHint}>Kartani bosing — raqam nusxalanadi</Text>
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} Yuk Ekspert · O'zbekistonda yaratildi 🇺🇿</Text>
    </ScrollView>
  );
}

function BankCard({ card }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(card.number);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // nusxa olinmasa — raqam baribir ko'rinib turibdi
    }
  };

  return (
    <Pressable
      role="button"
      aria-label={`${card.brand} karta raqamini nusxalash`}
      onPress={copy}
      style={({ pressed }) => [styles.bank, { backgroundColor: card.bg }, pressed && styles.bankPressed]}
    >
      {/* Bezak: yorug' doiralar (gradient o'rniga) */}
      <View style={[styles.glow1, { backgroundColor: card.glow }]} />
      <View style={[styles.glow2, { backgroundColor: card.glow }]} />

      <View style={styles.bankTop}>
        <View style={styles.chip}>
          <View style={styles.chipLine} />
          <View style={styles.chipLine} />
        </View>
        <View style={[styles.copyBadge, copied && styles.copyBadgeOn]}>
          <Text style={[styles.copyText, copied && styles.copyTextOn]}>{copied ? "✓ Nusxa olindi" : "⧉ Nusxa olish"}</Text>
        </View>
      </View>

      <Text style={styles.bankNumber} selectable>
        {groups(card.number)}
      </Text>

      <View style={styles.bankBottom}>
        <View>
          <Text style={styles.bankLabel}>KARTA EGASI</Text>
          <Text style={styles.bankOwner}>{AUTHOR.name.toUpperCase()}</Text>
        </View>
        <Text style={[styles.brand, styles[card.brandStyle]]}>{card.brand}</Text>
      </View>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingBottom: space.xl * 1.5, gap: space.md },
  pressed: { opacity: 0.7 },

  hero: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    padding: space.xl,
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
  },
  heroBubble1: { position: "absolute", width: 220, height: 220, borderRadius: 110, top: -90, right: -70, backgroundColor: "rgba(255,255,255,0.10)" },
  heroBubble2: { position: "absolute", width: 160, height: 160, borderRadius: 80, bottom: -80, left: -50, backgroundColor: "rgba(255,255,255,0.08)" },
  logo: { width: 84, height: 84, borderRadius: 22, borderWidth: 3, borderColor: "rgba(255,255,255,0.7)", marginBottom: space.sm },
  appName: { fontSize: 26, fontWeight: "800", color: "#fff" },
  version: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: "hidden",
  },
  heroText: { fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.92)", textAlign: "center", marginTop: space.sm },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.accent, marginLeft: space.sm, marginTop: space.sm, textTransform: "uppercase" },
  card: { backgroundColor: colors.card, borderRadius: radius + 4, padding: space.lg, gap: space.md },

  authorRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  authorAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.soft,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  authorInitials: { fontSize: 20, fontWeight: "800", color: colors.accent },
  authorText: { flex: 1, gap: 2 },
  authorName: { fontSize: 18, fontWeight: "800", color: colors.text },
  authorRole: { fontSize: 14, color: colors.hint },
  telegram: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.soft,
    borderRadius: radius,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  telegramIcon: { fontSize: 22 },
  telegramText: { flex: 1 },
  telegramTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  telegramLink: { fontSize: 14, color: colors.accent, fontWeight: "600" },
  chevron: { fontSize: 28, color: colors.accent, marginTop: -4 },

  supportText: { fontSize: 15, lineHeight: 21, color: colors.text },
  tapHint: { fontSize: 13, color: colors.hint, textAlign: "center" },

  // Bank kartasi — haqiqiy karta nisbati (85.6 × 54 mm)
  bank: {
    aspectRatio: 1.586,
    borderRadius: 18,
    padding: space.xl,
    justifyContent: "space-between",
    overflow: "hidden",
    elevation: 6,
  },
  bankPressed: { transform: [{ scale: 0.98 }] },
  glow1: { position: "absolute", width: 260, height: 260, borderRadius: 130, top: -120, right: -80, opacity: 0.55 },
  glow2: { position: "absolute", width: 200, height: 200, borderRadius: 100, bottom: -110, left: -40, opacity: 0.35 },
  bankTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chip: {
    width: 44,
    height: 32,
    borderRadius: 7,
    backgroundColor: "#e6c15a",
    borderWidth: 1,
    borderColor: "#b8922e",
    justifyContent: "space-evenly",
    paddingHorizontal: 6,
  },
  chipLine: { height: 1, backgroundColor: "#b8922e" },
  bankNumber: { fontFamily: mono, fontSize: 21, fontWeight: "700", letterSpacing: 1.5, color: "#fff" },
  bankBottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  bankLabel: { fontSize: 9, letterSpacing: 1, color: "rgba(255,255,255,0.65)" },
  bankOwner: { fontSize: 14, fontWeight: "700", letterSpacing: 1, color: "#fff" },
  brand: { color: "#fff", fontWeight: "900" },
  visa: { fontSize: 28, fontStyle: "italic", letterSpacing: 1 },
  humo: { fontSize: 22, letterSpacing: 3 },
  copyBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  copyBadgeOn: { backgroundColor: "#ffffff" },
  copyText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  copyTextOn: { color: colors.ok },

  footer: { fontSize: 13, color: colors.hint, textAlign: "center", marginTop: space.sm },
  }),
);
