// Sozlamalar → «👤 Hisob sozlamalari»: kim kirgan, obuna, telefon; rolni almashtirish, hisobdan chiqish, o'chirish.
import { Alert, RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import Constants from "expo-constants";
import { PLANS, formatContactPhone } from "@yuk/shared";
import { API_URL, PROD_API_URL, deleteMe, signOut } from "../../../api.js";
import { Row, Section, settingsStyles, usePullRefresh, useRunner } from "../../../components/settingsUi.js";
import { useSession } from "../../../session.js";
import { colors, themed } from "../../../theme.js";
import { Button, Hint } from "../../../ui.js";

export default function AccountSettingsScreen() {
  const { me, botUsername, refreshMe, leave } = useSession();
  const { busy, run } = useRunner();
  const { refreshing, onRefresh } = usePullRefresh(refreshMe);

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

  return (
    <ScrollView
      style={settingsStyles.page}
      contentContainerStyle={settingsStyles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
    >
      <Section title="👤 Hisob">
        <Text style={styles.name}>{me.name || "Ismsiz"}</Text>
        {me.username ? <Hint>@{me.username}</Hint> : null}
        <Row icon="⭐" label="Obuna" value={PLANS[me.plan]?.name ?? me.plan} />
        <Row icon="📱" label="Telefon" value={me.phone ? formatContactPhone(me.phone) : "ulashilmagan (botda /raqam)"} />
      </Section>

      <Section title="⚙️ Boshqa">
        <Button title="🚪 Hisobdan chiqish" kind="secondary" onPress={askSignOut} busy={busy === "signout"} disabled={busy != null} />
        <Button title="🗑 Hisobni o'chirish" kind="danger" onPress={askDelete} busy={busy === "delete"} disabled={busy != null} />
      </Section>

      <Hint style={settingsStyles.footer}>
        Yuk Ekspert {Constants.expoConfig?.version ?? ""} · @{botUsername}
        {API_URL !== PROD_API_URL ? `\n🧪 Sinov server: ${API_URL}` : ""}
      </Hint>
    </ScrollView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  name: { fontSize: 20, fontWeight: "800", color: colors.text },
  }),
);
