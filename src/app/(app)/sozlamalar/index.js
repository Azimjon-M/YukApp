// Sozlamalar → «📢 E'lon sozlamalari»: bot yuborishi (faol / pauza), haydovchiga — filtr (o'zgartirish «🎛 Filtr» da),
// yuk beruvchiga — kerakli mashina (o'zgartirish hozircha botda), eski «🎯 Saralangan» rejimda — yo'nalish.
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { feedLabel, profileRows, routeChosen, routeLabel, sortedReady } from "@yuk/shared";
import { setActive } from "../../../api.js";
import { Row, Section, settingsStyles, usePullRefresh, useRunner } from "../../../components/settingsUi.js";
import { batteryLimited, enable, freeBattery, permission } from "../../../notify.js";
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

      {Platform.OS === "android" ? <PushSection /> : null}

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

// «📲 Telefonga bildirishnoma»: holati; o'chiq bo'lsa — «Yoqish», yoqilgan bo'lsa — o'chirish telefon sozlamalarida
function PushSection() {
  const [state, setState] = useState(null); // { granted, limited }
  const check = useCallback(async () => {
    const [p, limited] = await Promise.all([permission(), batteryLimited()]);
    setState({ granted: p.granted, limited });
  }, []);
  useEffect(() => {
    const first = setTimeout(check, 0);
    const sub = AppState.addEventListener("change", (next) => next === "active" && check());
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [check]);
  if (!state) return null;
  const { granted, limited } = state;
  return (
    <Section title="📲 Telefonga bildirishnoma">
      <Text style={settingsStyles.rowText}>
        {granted ? "● Yoqilgan — ilova yopiq bo'lsa ham yangi e'lonlar haqida xabar keladi" : "○ O'chiq — telefonga xabar kelmaydi"}
      </Text>
      {granted ? null : <Button title="🔔 Yoqish" onPress={() => enable().then(check)} />}
      {granted ? (
        <>
          <Text style={settingsStyles.rowText}>{limited ? "🔋 Batareya tejash ilovani to'xtatishi mumkin — xabar kechikadi" : "🔋 Batareya tejash to'xtatmaydi"}</Text>
          {limited ? <Button title="🔋 Ruxsat berish" onPress={() => freeBattery().then(check)} /> : null}
          <Hint>Infinix, Tecno, Xiaomi telefonlarida ilova sozlamalarida «Avtoishga tushirish» (Auto-start) ni ham yoqing.</Hint>
          <Button title="Ilova sozlamalari" kind="secondary" onPress={() => Linking.openSettings().catch(() => {})} />
        </>
      ) : null}
    </Section>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  }),
);
