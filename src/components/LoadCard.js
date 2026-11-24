// Bitta yuk (haydovchiga) yoki bo'sh mashina (yuk beruvchiga). Matnlar bot xabari va Mini App'dagi bilan bir xil —
// @yuk/shared loadText.js dan. Server asl matnni bersa (post.text) — e'lon tahrirsiz ko'rsatiladi. Telefon tugmasi
// qo'ng'iroq oynasini to'g'ridan-to'g'ri ochadi (tel:), yonidagi 📋 — raqamni nusxalaydi.
import { memo } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { cargoText, formatContactPhone, phoneText, placeText, priceText, senderLink, truckPlaceText, truckVehicleText, vehicleText } from "@yuk/shared";
import { colors, radius, space, themed } from "../theme.js";
import { toast } from "../toast.js";

// "+998 90 123-45-67" → "tel:+998901234567" (qo'ng'iroq oynasiga faqat raqamlar)
export const telUrl = (phone) => `tel:${phoneText(phone).replace(/[^\d+]/g, "")}`;

const open = (url) => Linking.openURL(url).catch(() => {});

function Line({ icon, children, style }) {
  if (!children) return null;
  return (
    <Text style={[styles.line, style]}>
      {icon} {children}
    </Text>
  );
}

// Vaqt: 24/11/2026 14:05 (telefonning mahalliy vaqti)
const pad = (n) => String(n).padStart(2, "0");
export function dateTimeText(ts) {
  if (ts == null) return "";
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function copyPhone(phone) {
  await Clipboard.setStringAsync(phone);
  toast(`📋 Nusxalandi: ${phone}`);
}

// Pastki qism (tagma-tag): lichka · asl e'lon @guruh (1 qator) → vaqt → telefon tugmalari (+ nusxa)
function Contacts({ load, post }) {
  const phones = (load.phones ?? []).map(phoneText);
  // Username yo'q bo'lsa — Telegram ID orqali (yozgan odam bilan bir guruhda bo'lsa ochiladi)
  const lichka = senderLink(post.sender) ?? (post.senderId ? `tg://user?id=${post.senderId}` : null);
  const source = post.source?.startsWith("@") ? post.source : null;
  return (
    <View style={styles.contacts}>
      {lichka || post.link || source || post.fromShipper ? (
        <View style={styles.links}>
          {post.fromShipper ? <Text style={styles.owner}>✅ Yuk egasidan</Text> : null}
          {lichka ? (
            <Pressable role="link" onPress={() => open(lichka)} hitSlop={6}>
              <Text style={styles.link}>💬 Lichkasi</Text>
            </Pressable>
          ) : null}
          {post.link ? (
            <Pressable role="link" onPress={() => open(post.link)} hitSlop={6}>
              <Text style={styles.link}>
                📄 Asl e'lon{source ? <Text style={styles.source}> {source}</Text> : null}
              </Text>
            </Pressable>
          ) : source ? (
            <Text style={styles.source}>{source}</Text>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.meta}>🕒 {dateTimeText(post.postedAt)}</Text>
      {phones.map((phone) => (
        <View key={phone} style={styles.phoneRow}>
          <Pressable
            role="button"
            aria-label={`Qo'ng'iroq qilish: ${phone}`}
            onPress={() => open(telUrl(phone))}
            style={({ pressed }) => [styles.call, pressed && styles.pressed]}
          >
            <Text style={styles.callText}>📞 {formatContactPhone(phone)}</Text>
          </Pressable>
          <Pressable
            role="button"
            aria-label={`Raqamni nusxalash: ${phone}`}
            onPress={() => copyPhone(phone)}
            style={({ pressed }) => [styles.copy, pressed && styles.pressed]}
          >
            <Text style={styles.copyText}>📋</Text>
          </Pressable>
        </View>
      ))}
      {!phones.length ? <Text style={styles.muted}>Telefon yozilmagan — asl e'lonni oching.</Text> : null}
    </View>
  );
}

// Asl e'lon matni — tahrirsiz. Uzun bo'lsa kartaning o'zida aylanadi (overflow), ro'yxat cho'zilib ketmaydi
function RawText({ text }) {
  return (
    <ScrollView style={styles.rawBox} nestedScrollEnabled persistentScrollbar>
      <Text style={styles.raw} selectable>
        {text}
      </Text>
    </ScrollView>
  );
}

// Yo'nalish noma'lum bo'lsa (asl e'londan topilmadi) — sarlavha chiqmaydi, matnning o'zi yetarli
const hasPlace = (load, side) => Boolean(load[`${side}City`] || load[`${side}Region`] || load[`${side}Country`]);
function Route({ from, to, load }) {
  if (load && !hasPlace(load, "from") && !hasPlace(load, "to")) return null;
  return (
    <Text style={styles.route}>
      {from} <Text style={styles.arrow}>→</Text> {to}
    </Text>
  );
}

export const LoadCard = memo(function LoadCard({ item }) {
  const { load, post } = item;
  return (
    <View style={styles.card}>
      <Route from={placeText(load, "from")} to={placeText(load, "to")} load={load} />
      {post.media ? <Text style={styles.muted}>{post.media === "round" ? "📹 Dumaloq videodan (matnga o'girildi)" : "🎤 Ovozli xabardan (matnga o'girildi)"}</Text> : null}
      {post.text ? (
        <RawText text={post.text} />
      ) : (
        <>
          <Line icon="📦">{cargoText(load)}</Line>
          <Line icon="🚚">{vehicleText(load)}</Line>
          <Line icon="💰" style={load.price != null ? styles.price : styles.muted}>
            {priceText(load)}
          </Line>
          <Line icon="📅">{load.when}</Line>
          <Line icon="📝" style={styles.muted}>
            {load.note}
          </Line>
        </>
      )}
      <Contacts load={load} post={post} />
    </View>
  );
});

// Bo'sh mashina: "qayerga" yozilmagan bo'lsa — istalgan joyga; narx ko'pincha yo'q
export const TruckCard = memo(function TruckCard({ item }) {
  const { load: truck, post } = item;
  return (
    <View style={styles.card}>
      <Route from={truckPlaceText(truck, "from")} to={truckPlaceText(truck, "to")} />
      {post.text ? (
        <RawText text={post.text} />
      ) : (
        <>
          <Line icon="🚛">{truckVehicleText(truck)}</Line>
          {truck.price != null || truck.negotiable ? (
            <Line icon="💰" style={styles.price}>
              {priceText(truck)}
            </Line>
          ) : null}
          <Line icon="📅">{truck.when}</Line>
          <Line icon="📝" style={styles.muted}>
            {truck.note}
          </Line>
        </>
      )}
      <Contacts load={truck} post={post} />
    </View>
  );
});

const styles = themed(() =>
  StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius, padding: space.lg, gap: 6 },
  route: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 2 },
  arrow: { color: colors.accent },
  line: { fontSize: 15, lineHeight: 21, color: colors.text },
  price: { fontWeight: "700" },
  muted: { fontSize: 14, color: colors.hint },
  contacts: { marginTop: space.sm, gap: space.sm },
  rawBox: { maxHeight: 190 },
  raw: { fontSize: 15, lineHeight: 21, color: colors.text },
  phoneRow: { flexDirection: "row", gap: space.sm },
  call: {
    flex: 1,
    backgroundColor: colors.call,
    borderRadius: 10,
    minHeight: 46,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  callText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  pressed: { opacity: 0.75 },
  copy: {
    width: 46,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.call,
    alignItems: "center",
    justifyContent: "center",
  },
  copyText: { fontSize: 18 },
  links: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.lg, rowGap: 4 },
  link: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  source: { color: colors.hint, fontSize: 14, fontWeight: "400" },
  meta: { fontSize: 13, color: colors.hint },
  owner: { color: colors.ok, fontWeight: "600" },
  }),
);
