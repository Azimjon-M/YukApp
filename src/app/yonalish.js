// Yo'nalish: «📍 Qayerdan?» → «🏁 Qayerga?» — botdagi «📋 Mos yuklar» va Mini App'dagi RoutePicker bilan bir xil
// (GET/PUT /pub/me/route). Tanlangani profilga yoziladi: ilovadagi ro'yxat ham, botdagi yangi yuklar ham shu bo'yicha.
// Joylar «Qayerda ishlaysiz?» ga qarab serverdan keladi; tugmadagi son — oxirgi 24 soatda mashinangizga mos yuklar.
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ROUTE_ANY, routeSide } from "@yuk/shared";
import { getRoute, saveRoute } from "../api.js";
import { useSession } from "../session.js";
import { colors, radius, space } from "../theme.js";
import { Button, Hint, Notice, Spinner } from "../ui.js";

const HOURS = 24;

function AreaButton({ label, count, on, disabled, onPress, wide = false }) {
  return (
    <Pressable
      role="button"
      aria-selected={on}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.area, wide && styles.wide, on && styles.areaOn, pressed && styles.pressed]}
    >
      <Text style={[styles.areaText, on && styles.areaTextOn]} numberOfLines={2}>
        {on ? "✅ " : ""}
        {label}
      </Text>
      {count ? <Text style={styles.count}>{count} ta</Text> : null}
    </Pressable>
  );
}

export default function RouteScreen() {
  const { me, setMe } = useSession();
  const profile = me?.profile;
  const [from, setFrom] = useState(null); // null — «Qayerdan?» qadami; { id, label } — «Qayerga?»
  const [state, setState] = useState({ data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const fromId = from?.id ?? null;

  // Qadam almashsa yoki «Qayta urinish» bosilsa — eski javob va xato tozalanadi, yangisi so'raladi
  const goTo = (next) => {
    setState({ data: null, error: null });
    setFrom(next);
  };
  const retry = () => {
    setState({ data: null, error: null });
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let alive = true;
    getRoute({ from: fromId, hours: HOURS }).then(
      (data) => alive && setState({ data, error: null }),
      (error) => alive && setState({ data: null, error }),
    );
    return () => {
      alive = false;
    };
  }, [fromId, attempt]);

  async function pickTo(to) {
    setSaving(true);
    try {
      setMe(await saveRoute(fromId, to));
      router.back();
    } catch (error) {
      setSaving(false);
      if (error.code !== "auth" && error.code !== "blocked") Alert.alert("Saqlanmadi", error.message);
    }
  }

  const step = from ? "to" : "from";
  // Hozirgi tanlov belgilanadi: «Qayerga?» da — faqat o'sha «Qayerdan» qayta tanlangan bo'lsa (botdagidek)
  const current = step === "from" ? routeSide(profile, "from") : routeSide(profile, "from") === fromId ? routeSide(profile, "to") : null;
  const ready = state.data && state.data.from === fromId; // oldingi qadamning sonlari ko'rinmasin
  const areas = ready ? state.data.areas : [];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {step === "from" ? (
        <>
          <Text style={styles.title}>📍 Qayerdan yuk olasiz?</Text>
          <Hint>Hozir turgan yoki yuk olmoqchi bo'lgan joyni tanlang. Yonidagi son — oxirgi 24 soatdagi mos yuklar.</Hint>
        </>
      ) : (
        <>
          <View style={styles.fromRow}>
            <Text style={styles.fromText}>
              📍 Qayerdan: <Text style={styles.bold}>{from.label}</Text>
            </Text>
            <Button title="⬅️ Orqaga" kind="link" disabled={saving} onPress={() => goTo(null)} />
          </View>
          <Text style={styles.title}>🏁 Qayerga borasiz?</Text>
          <Hint>Uyga qaytish yuki kerak bo'lsa — o'z viloyatingizni tanlang.</Hint>
        </>
      )}

      {state.error ? (
        <Notice title="Joylar ochilmadi" action={<Button title="Qayta urinish" onPress={retry} />}>
          {state.error.message}
        </Notice>
      ) : !ready ? (
        <Spinner />
      ) : (
        <>
          <View style={styles.grid}>
            {areas.map((area) => (
              <AreaButton
                key={area.id}
                label={area.label}
                count={area.count}
                on={area.id === current}
                disabled={saving}
                onPress={() => (step === "to" ? pickTo(area.id) : goTo({ id: area.id, label: area.label }))}
              />
            ))}
          </View>
          {step === "to" ? (
            <AreaButton
              wide
              label="🌐 Istalgan joyga"
              count={state.data.any}
              on={current === ROUTE_ANY}
              disabled={saving}
              onPress={() => pickTo(ROUTE_ANY)}
            />
          ) : null}
        </>
      )}
      {saving ? <Spinner label="Saqlanyapti..." /> : null}
      <Hint>Bot ham yangi yuklarni shu yo'nalish bo'yicha yuboradi.</Hint>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  fromRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fromText: { flex: 1, fontSize: 15, color: colors.text },
  bold: { fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  area: {
    width: "48.5%",
    minHeight: 56,
    backgroundColor: colors.card,
    borderRadius: radius,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  wide: { width: "100%" },
  areaOn: { borderColor: colors.accent, backgroundColor: colors.soft },
  pressed: { opacity: 0.75 },
  areaText: { fontSize: 15, fontWeight: "600", color: colors.text },
  areaTextOn: { color: colors.accent },
  count: { fontSize: 13, color: colors.hint, marginTop: 2 },
});
