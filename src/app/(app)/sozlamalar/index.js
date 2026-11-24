// Sozlamalar → «📢 E'lon sozlamalari»: bot yuborishi (faol / pauza), haydovchiga — filtr (o'zgartirish «🎛 Filtr» da),
// yuk beruvchiga — kerakli mashina (o'zgartirish hozircha botda), eski «🎯 Saralangan» rejimda — yo'nalish.
import { Linking, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { feedLabel, profileRows, routeChosen, routeLabel, sortedReady } from "@yuk/shared";
import { setActive } from "../../../api.js";
import { Row, Section, settingsStyles, usePullRefresh, useRunner } from "../../../components/settingsUi.js";
import { useSession } from "../../../session.js";
import { colors, space, themed } from "../../../theme.js";
import { Button, Hint } from "../../../ui.js";

export default function AdSettingsScreen() {
  const { me, scope, botUsername, setMe, refreshMe } = useSession();
  const { busy, run } = useRunner();
  const { refreshing, onRefresh } = usePullRefresh(refreshMe);
  const role = me.role;
  const profile = me.profile;
  const driver = role === "haydovchi";
  const openBot = () => Linking.openURL(`https://t.me/${botUsername}`).catch(() => {});

  const toggleActive = (value) => run("active", async () => setMe(await setActive(value)));

  const rows = profile ? profileRows(profile, scope, role, { web: true }) : [];
  // Yuborishni yoqish mumkinmi: haydovchiga transport kerak (server 409 «no_profile» beradi), yuk beruvchiga — shart emas
  const canToggle = !driver || Boolean(profile);

  return (
    <ScrollView
      style={settingsStyles.page}
      contentContainerStyle={settingsStyles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
    >
      <Section title="🔔 Botdan yuborish">
        <View style={styles.switchRow}>
          <Text style={settingsStyles.rowText}>
            {me.active ? "● Faol — mos e'lonlar botga keladi" : "⏸ Pauza — bot yubormaydi"}
          </Text>
          <Switch
            value={Boolean(me.active)}
            disabled={!canToggle || busy === "active"}
            onValueChange={toggleActive}
            trackColor={{ true: colors.accent }}
          />
        </View>
        {!canToggle ? <Hint>Yoqish uchun avval «🎛 Filtr» ni saqlang.</Hint> : null}
      </Section>

      {driver ? (
        <Section title="🎛 Filtr — qaysi e'lonlar kelsin">
          {profile ? (
            <Text style={settingsStyles.rowText}>{feedLabel(profile)}</Text>
          ) : (
            <Hint>Filtr hali tanlanmagan.</Hint>
          )}
          <Button title="🎛 Filtrni o'zgartirish" kind="secondary" onPress={() => router.navigate("/filtr")} />
        </Section>
      ) : (
        <Section title="📦 Kerakli mashina">
          {rows.length ? (
            rows.map((row) => <Row key={row.id} icon={row.icon} label={row.label} value={row.value} />)
          ) : (
            <Hint>Kiritilmagan — bo'sh mashinalarning hammasi ko'rsatiladi.</Hint>
          )}
          <Button title="✏️ Botda o'zgartirish" kind="secondary" onPress={openBot} />
          <Hint>O'zgartirish formasi ilovaga keyingi yangilanishda qo'shiladi. Hozircha botdagi «⚙️ Sozlamalar» tugmasi.</Hint>
        </Section>
      )}

      {driver && profile && sortedReady(profile) ? (
        <Section title="🧭 Yo'nalish">
          <Text style={settingsStyles.rowText}>{routeChosen(profile) ? routeLabel(profile) : "Tanlanmagan"}</Text>
          <Button title="O'zgartirish" kind="secondary" onPress={() => router.push("/yonalish")} />
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  }),
);
