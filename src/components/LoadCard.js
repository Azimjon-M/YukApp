// Bitta yuk (haydovchiga) yoki bo'sh mashina (yuk beruvchiga). Matnlar bot xabari va Mini App'dagi bilan bir xil —
// @yuk/shared loadText.js dan. Telefon tugmasi telefonning qo'ng'iroq oynasini to'g'ridan-to'g'ri ochadi (tel:).
import { memo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { agoText, cargoText, formatContactPhone, phoneText, placeText, priceText, senderLink, truckPlaceText, truckVehicleText, vehicleText } from "@yuk/shared";
import { colors, radius, space } from "../theme.js";

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

// Pastki qism: telefonlar, lichka, asl e'lon, qachon chiqqani
function Contacts({ load, post, now }) {
  const phones = (load.phones ?? []).map(phoneText);
  const lichka = senderLink(post.sender);
  const source = post.source?.startsWith("@") ? post.source : null;
  return (
    <View style={styles.contacts}>
      {phones.map((phone) => (
        <Pressable
          key={phone}
          role="button"
          aria-label={`Qo'ng'iroq qilish: ${phone}`}
          onPress={() => open(telUrl(phone))}
          style={({ pressed }) => [styles.call, pressed && styles.pressed]}
        >
          <Text style={styles.callText}>📞 {formatContactPhone(phone)}</Text>
        </Pressable>
      ))}
      {!phones.length ? <Text style={styles.muted}>Telefon yozilmagan — asl e'lonni oching.</Text> : null}
      {(lichka || post.link) && (
        <View style={styles.links}>
          {lichka ? (
            <Pressable role="link" onPress={() => open(lichka)} style={styles.linkButton}>
              <Text style={styles.link}>💬 Lichkasi</Text>
            </Pressable>
          ) : null}
          {post.link ? (
            <Pressable role="link" onPress={() => open(post.link)} style={styles.linkButton}>
              <Text style={styles.link}>📄 Asl e'lon</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <Text style={styles.meta}>
        {post.fromShipper ? <Text style={styles.owner}>✅ Yuk egasidan · </Text> : null}
        {agoText(post.postedAt, now)}
        {source ? ` · ${source}` : ""}
      </Text>
    </View>
  );
}

function Route({ from, to }) {
  return (
    <Text style={styles.route}>
      {from} <Text style={styles.arrow}>→</Text> {to}
    </Text>
  );
}

export const LoadCard = memo(function LoadCard({ item, now }) {
  const { load, post } = item;
  return (
    <View style={styles.card}>
      <Route from={placeText(load, "from")} to={placeText(load, "to")} />
      <Line icon="📦">{cargoText(load)}</Line>
      <Line icon="🚚">{vehicleText(load)}</Line>
      <Line icon="💰" style={load.price != null ? styles.price : styles.muted}>
        {priceText(load)}
      </Line>
      <Line icon="📅">{load.when}</Line>
      <Line icon="📝" style={styles.muted}>
        {load.note}
      </Line>
      <Contacts load={load} post={post} now={now} />
    </View>
  );
});

// Bo'sh mashina: "qayerga" yozilmagan bo'lsa — istalgan joyga; narx ko'pincha yo'q
export const TruckCard = memo(function TruckCard({ item, now }) {
  const { load: truck, post } = item;
  return (
    <View style={styles.card}>
      <Route from={truckPlaceText(truck, "from")} to={truckPlaceText(truck, "to")} />
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
      <Contacts load={truck} post={post} now={now} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius, padding: space.lg, gap: 6 },
  route: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 2 },
  arrow: { color: colors.accent },
  line: { fontSize: 15, lineHeight: 21, color: colors.text },
  price: { fontWeight: "700" },
  muted: { fontSize: 14, color: colors.hint },
  contacts: { marginTop: space.sm, gap: space.sm },
  call: {
    backgroundColor: colors.call,
    borderRadius: 10,
    minHeight: 46,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  callText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  pressed: { opacity: 0.75 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  linkButton: { paddingVertical: 6, paddingRight: space.md },
  link: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  meta: { fontSize: 13, color: colors.hint },
  owner: { color: colors.ok, fontWeight: "600" },
});
