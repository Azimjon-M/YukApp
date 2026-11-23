// Sozlamalar: kim kirgan, bot yuborishi (faol / pauza), sozlamalar (transport yoki kerakli mashina), yo'nalish,
// telefon raqami, rolni almashtirish, hisobdan chiqish va hisobni o'chirish.
// Sozlamalarni o'zgartirish formasi hozircha botda («⚙️ Sozlamalar») — ilovaga keyingi bosqichda qo'shiladi.
import { useCallback, useState } from "react";
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { PLANS, ROLES, formatContactPhone, profileRows, routeChosen, routeLabel, sortedReady } from "@yuk/shared";
import { API_URL, PROD_API_URL, deleteMe, setActive, signOut } from "../../api.js";
import { useSession } from "../../session.js";
import { colors, space } from "../../theme.js";
import { Button, Card, Hint } from "../../ui.js";

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card style={styles.sectionBody}>{children}</Card>
    </View>
  );
}

function Row({ icon, label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowText}>
        {label ? <Text style={styles.rowLabel}>{label}: </Text> : null}
        {value}
      </Text>
    </View>
  );
}

// Server xatosi (401/403 ni api.js o'zi hal qiladi — ilova kirish yoki «Uzr» ekraniga o'tadi)
const showError = (error) => {
  if (error.code !== "auth" && error.code !== "blocked") Alert.alert("Bajarilmadi", error.message);
};

export default function SettingsScreen() {
  const { me, scope, botUsername, setMe, refreshMe, leave } = useSession();
  const [busy, setBusy] = useState(null); // qaysi amal bajarilyapti
  const [refreshing, setRefreshing] = useState(false);
  const role = me.role;
  const profile = me.profile;
  const driver = role === "haydovchi";
  const openBot = () => Linking.openURL(`https://t.me/${botUsername}`).catch(() => {});

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshMe();
    } catch (error) {
      showError(error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshMe]);

  async function run(name, action) {
    setBusy(name);
    try {
      await action();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  }

  const toggleActive = (value) => run("active", async () => setMe(await setActive(value)));

  // Ikki xil chiqish: faqat shu telefondan (bot ishlashda davom etadi) yoki butunlay (bot ham yubormaydi — Mini App'dagi
  // «🚪 Chiqish» bilan bir xil, qayta kirib rol tanlasa sozlamalari tiklanadi)
  const askSignOut = () =>
    Alert.alert("Hisobdan chiqasizmi?", "«Faqat ilovadan» — bot yuklarni yuborishda davom etadi.\n«Butunlay» — bot ham yubormaydi.", [
      { text: "Bekor qilish", style: "cancel" },
      { text: "Butunlay", style: "destructive", onPress: () => run("signout", async () => {
        await signOut();
        await leave();
      }) },
      { text: "Faqat ilovadan", onPress: () => leave() },
    ]);

  const askDelete = () =>
    Alert.alert(
      "Hisobni o'chirasizmi?",
      "Rolingiz, sozlamalaringiz va raqamingiz o'chadi, bot sizga hech narsa yubormaydi. Keyin qaytsangiz — boshidan ro'yxatdan o'tasiz.",
      [
        { text: "Bekor qilish", style: "cancel" },
        { text: "O'chirish", style: "destructive", onPress: () => run("delete", async () => {
          await deleteMe();
          await leave();
          Alert.alert("✅ Hisobingiz o'chirildi", "Endi sizga hech narsa yuborilmaydi.");
        }) },
      ],
    );

  const rows = profile ? profileRows(profile, scope, role, { web: true }) : [];
  // Yuborishni yoqish mumkinmi: haydovchiga transport kerak (server 409 «no_profile» beradi), yuk beruvchiga — shart emas
  const canToggle = !driver || Boolean(profile);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
    >
      <Section title="👤 Hisob">
        <Text style={styles.name}>{me.name || "Ismsiz"}</Text>
        {me.username ? <Hint>@{me.username}</Hint> : null}
        <Row icon={ROLES[role]?.icon ?? "❔"} label="Rol" value={ROLES[role]?.name ?? "tanlanmagan"} />
        <Row icon="⭐" label="Obuna" value={PLANS[me.plan]?.name ?? me.plan} />
        <Row icon="📱" label="Telefon" value={me.phone ? formatContactPhone(me.phone) : "ulashilmagan (botda /raqam)"} />
      </Section>

      <Section title="🔔 Botdan yuborish">
        <View style={styles.switchRow}>
          <Text style={styles.rowText}>
            {me.active ? "● Faol — mos e'lonlar botga keladi" : "⏸ Pauza — bot yubormaydi"}
          </Text>
          <Switch
            value={Boolean(me.active)}
            disabled={!canToggle || busy === "active"}
            onValueChange={toggleActive}
            trackColor={{ true: colors.accent }}
          />
        </View>
        {!canToggle ? <Hint>Yoqish uchun avval transportingizni kiriting.</Hint> : null}
      </Section>

      <Section title={driver ? "🚚 Transport" : "📦 Kerakli mashina"}>
        {rows.length ? (
          rows.map((row) => <Row key={row.id} icon={row.icon} label={row.label} value={row.value} />)
        ) : (
          <Hint>{driver ? "Transportingiz kiritilmagan." : "Kiritilmagan — bo'sh mashinalarning hammasi ko'rsatiladi."}</Hint>
        )}
        <Button title="✏️ Botda o'zgartirish" kind="secondary" onPress={openBot} />
        <Hint>O'zgartirish formasi ilovaga keyingi yangilanishda qo'shiladi. Hozircha botdagi «⚙️ Sozlamalar» tugmasi.</Hint>
      </Section>

      {driver && profile && sortedReady(profile) ? (
        <Section title="🧭 Yo'nalish">
          <Text style={styles.rowText}>{routeChosen(profile) ? routeLabel(profile) : "Tanlanmagan"}</Text>
          <Button title="O'zgartirish" kind="secondary" onPress={() => router.push("/yonalish")} />
        </Section>
      ) : null}

      <Section title="⚙️ Boshqa">
        <Button title="🔄 Rolni almashtirish" kind="secondary" onPress={() => router.push("/rol")} disabled={busy != null} />
        <Button title="🚪 Hisobdan chiqish" kind="secondary" onPress={askSignOut} busy={busy === "signout"} disabled={busy != null} />
        <Button title="🗑 Hisobni o'chirish" kind="danger" onPress={askDelete} busy={busy === "delete"} disabled={busy != null} />
      </Section>

      <Hint style={styles.footer}>
        Yuk Ekspert {Constants.expoConfig?.version ?? ""} · @{botUsername}
        {API_URL !== PROD_API_URL ? `\n🧪 Sinov server: ${API_URL}` : ""}
      </Hint>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingBottom: space.xl, gap: space.lg },
  section: { gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.accent, marginLeft: space.sm, textTransform: "uppercase" },
  sectionBody: { gap: space.md },
  name: { fontSize: 20, fontWeight: "800", color: colors.text },
  row: { flexDirection: "row", gap: space.sm },
  rowIcon: { fontSize: 16, width: 24 },
  rowText: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.text },
  rowLabel: { color: colors.hint },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  footer: { textAlign: "center" },
});
