// Sozlamalar → «👤 Hisob sozlamalari»: kim kirgan, obuna, telefon; qurilmalar (ko'pi bilan 2 ta), hisobdan chiqish, o'chirish.
import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { PLANS, formatContactPhone } from "@yuk/shared";
import { API_URL, PROD_API_URL, deleteMe, getDevices, removeDevice, signOut } from "../../../api.js";
import { deviceWhen } from "../../../components/AuthParts.js";
import { Row, Section, settingsStyles, usePullRefresh, useRunner } from "../../../components/settingsUi.js";
import { useSession } from "../../../session.js";
import { colors, space, themed } from "../../../theme.js";
import { Button, Hint } from "../../../ui.js";

export default function AccountSettingsScreen() {
  const { me, botUsername, refreshMe, leave } = useSession();
  const { busy, run } = useRunner();
  const [devices, setDevices] = useState(null); // { max, devices } | null
  const loadDevices = useCallback(() => getDevices().then(setDevices, () => {}), []);
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);
  const { refreshing, onRefresh } = usePullRefresh(async () => {
    await Promise.all([refreshMe(), loadDevices()]);
  });

  // Ilovadan chiqish — faqat shu qurilma (server uni ro'yxatdan chiqaradi, joy bo'shaydi). Botga tegmaydi
  // (Azimjon, 2026-11-26: «bot masalalari ilovaga aralashmasin»)
  const askSignOut = () =>
    Alert.alert("Hisobdan chiqasizmi?", "Faqat shu qurilmadan chiqasiz. Bot ishlashda davom etadi.", [
      { text: "Bekor qilish", style: "cancel" },
      { text: "Chiqish", style: "destructive", onPress: () => run("signout", async () => {
        await signOut().catch(() => {});
        await leave();
      }) },
    ]);

  const askRemove = (device) =>
    Alert.alert("Qurilmani chiqarasizmi?", `«${device.name}» dagi ilova hisobdan chiqadi.`, [
      { text: "Bekor qilish", style: "cancel" },
      { text: "Chiqarish", style: "destructive", onPress: () => run(`device:${device.id}`, async () => setDevices(await removeDevice(device.id))) },
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

      <Section title={`📱 Qurilmalar (ko'pi bilan ${devices?.max ?? 2} ta)`}>
        {devices?.devices?.length ? (
          devices.devices.map((device) => (
            <View key={device.id} style={styles.device}>
              <View style={styles.deviceInfo}>
                <Text style={settingsStyles.rowText}>
                  {device.name}
                  {device.current ? " · shu qurilma" : ""}
                </Text>
                <Hint>Oxirgi marta: {deviceWhen(device.seenAt)}</Hint>
              </View>
              {!device.current ? (
                <Button
                  title="Chiqarish"
                  kind="secondary"
                  style={styles.deviceButton}
                  busy={busy === `device:${device.id}`}
                  disabled={busy != null}
                  onPress={() => askRemove(device)}
                />
              ) : null}
            </View>
          ))
        ) : (
          <Hint>{devices ? "Ro'yxat bo'sh." : "Yuklanmoqda…"}</Hint>
        )}
        <Hint>Bir hisob ko'pi bilan {devices?.max ?? 2} ta qurilmada ochiladi. Yana kirilsa — bittasini chiqarish so'raladi.</Hint>
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
  device: { flexDirection: "row", alignItems: "center", gap: space.md },
  deviceInfo: { flex: 1, gap: 2 },
  deviceButton: { paddingHorizontal: space.md },
  }),
);
