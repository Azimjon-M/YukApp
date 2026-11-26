// Kirish (login.js) va Ro'yxatdan o'tish (royxat.js) sahifalarining umumiy qismlari (Azimjon, 2026-11-26):
// tepadagi logo + qisqa ma'lumot, «Bot orqali» kirish oqimi (src/botLogin.js) va uni kutish qutisi, pastdagi havola.
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError, pollBotLogin, replaceDevice, startBotLogin } from "../api.js";
import { createBotLogin } from "../botLogin.js";
import { useSession } from "../session.js";
import { colors, space, themed } from "../theme.js";
import { Button, Card } from "../ui.js";

const LOGO = require("../../assets/icon.png");

export const openUrl = (url) => url && Linking.openURL(url).catch(() => {});

export function Brand() {
  return (
    <View style={styles.brand}>
      <Image source={LOGO} style={styles.logo} accessibilityLabel="Yuk Ekspert" />
      <Text style={styles.title}>Yuk Ekspert</Text>
      <Text style={styles.lead}>
        Guruhlardagi yuk e'lonlarini shu yerga, darhol yuboradi. Yuk egasi esa yukini to'g'ridan-to'g'ri haydovchiga beradi.
      </Text>
    </View>
  );
}

// Ko'pi bilan 2 ta qurilma (Azimjon, 2026-11-26). Kirish (kod yoki bot) 409 devices bersa — oyna chiqadi: qaysi qurilma
// chiqarilsin. gate(fn) — kirish so'rovini o'raydi: tanlansa o'sha qurilma chiqariladi va { token, me } qaytadi (kirish
// mashinalari buni oddiy javobdek ko'radi), «Bekor qilish» — xato. Kirish allaqachon isbotlangan, qayta kod so'ralmaydi
export function useDeviceGate() {
  const [pick, setPick] = useState(null); // { devices, ticket, max, resolve, reject, busy, error }
  const gate = useCallback(
    (fn) =>
      async (...args) => {
        try {
          return await fn(...args);
        } catch (error) {
          if (error.code !== "devices" || !error.data?.ticket) throw error;
          return new Promise((resolve, reject) =>
            setPick({ devices: error.data.devices ?? [], ticket: error.data.ticket, max: error.data.max ?? 2, resolve, reject, busy: null, error: null }),
          );
        }
      },
    [],
  );
  const choose = async (id) => {
    if (!pick || pick.busy) return;
    setPick({ ...pick, busy: id, error: null });
    try {
      const answer = await replaceDevice(pick.ticket, id);
      setPick(null);
      pick.resolve(answer);
    } catch (error) {
      if (error.code === "expired" || error.code === "blocked") {
        setPick(null);
        pick.reject(error);
      } else setPick({ ...pick, busy: null, error: error.message });
    }
  };
  const cancel = () => {
    if (!pick) return;
    setPick(null);
    pick.reject(new ApiError("Kirish bekor qilindi — qurilma chiqarilmadi.", { code: "cancelled" }));
  };
  const picker = <DevicePicker pick={pick} onChoose={choose} onCancel={cancel} />;
  return { gate, picker };
}

// «bugun 14:05», «kecha 09:30», «12.11.2026»
function when(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 86_400_000);
  if (diff === 0) return `bugun ${hm}`;
  if (diff === 1) return `kecha ${hm}`;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
export const deviceWhen = when;

function DevicePicker({ pick, onChoose, onCancel }) {
  return (
    <Modal visible={Boolean(pick)} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Card style={styles.sheet}>
          <Text style={styles.boxTitle}>📱 Qurilmalar soni to'ldi</Text>
          <Text style={styles.text}>
            Hisobingiz allaqachon {pick?.max ?? 2} ta qurilmada ochiq. Shu qurilmada kirish uchun bittasini chiqaring:
          </Text>
          {(pick?.devices ?? []).map((device) => (
            <View key={device.id} style={styles.device}>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceSub}>Oxirgi marta: {when(device.seenAt)}</Text>
              </View>
              <Button
                title="Chiqarish"
                kind="danger"
                style={styles.deviceButton}
                busy={pick?.busy === device.id}
                disabled={Boolean(pick?.busy)}
                onPress={() => onChoose(device.id)}
              />
            </View>
          ))}
          {pick?.error ? <Text style={styles.error}>{pick.error}</Text> : null}
          <Button title="Bekor qilish" kind="link" disabled={Boolean(pick?.busy)} onPress={onCancel} />
        </Card>
      </View>
    </Modal>
  );
}

// Bot orqali kirish: { state, begin, reopen, cancel }. Odam Telegram'dan qaytganda darhol tekshiramiz.
// gate — useDeviceGate (2 tadan ortiq qurilma bo'lsa — tanlash oynasi)
export function useBotLogin(gate = (fn) => fn) {
  const { signIn } = useSession();
  const [state, setState] = useState({ step: "idle", error: null });
  const flow = useRef(null);
  useEffect(() => {
    const machine = createBotLogin({ start: startBotLogin, poll: gate(pollBotLogin), openUrl, onChange: setState, onDone: (answer) => signIn(answer) });
    flow.current = machine;
    const sub = AppState.addEventListener("change", (next) => next === "active" && machine.nudge());
    return () => {
      sub.remove();
      machine.dispose();
    };
  }, [signIn, gate]);
  return {
    state,
    begin: () => flow.current?.begin(),
    reopen: () => flow.current?.reopen(),
    cancel: () => flow.current?.cancel(),
  };
}

// Botda tasdiqlash kutilmoqda
export function BotWait({ bot, botUsername }) {
  return (
    <Card style={styles.box}>
      <Text style={styles.boxTitle}>Botda tasdiqlang</Text>
      <Text style={styles.text}>
        <Text style={styles.bold}>@{botUsername}</Text> boti ochildi. U yerda «Start» ni, keyin «✅ Ha, bog'layman» ni bosing va shu
        yerga qayting — ilova o'zi kiradi.
      </Text>
      <Button title="Tasdiqlash kutilmoqda…" busy onPress={() => {}} />
      <Button title="✈️ Botni qayta ochish" kind="secondary" onPress={bot.reopen} />
      <Button title="Bekor qilish" kind="link" onPress={bot.cancel} />
    </Card>
  );
}

// Forma ostidagi havola: «Hisobingiz yo'qmi? Ro'yxatdan o'tish»
export function AuthLink({ question, action, onPress }) {
  return (
    <Pressable role="link" onPress={onPress} style={styles.link} hitSlop={8}>
      <Text style={styles.linkText}>
        {question} <Text style={styles.linkAction}>{action}</Text>
      </Text>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  brand: { alignItems: "center", gap: space.sm },
  logo: { width: 88, height: 88, borderRadius: 22 },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  lead: { fontSize: 15, lineHeight: 21, color: colors.hint, textAlign: "center" },
  box: { gap: space.md },
  boxTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  text: { fontSize: 15, lineHeight: 23, color: colors.text },
  bold: { fontWeight: "700" },
  link: { alignSelf: "center", paddingVertical: space.sm },
  linkText: { fontSize: 15, color: colors.hint, textAlign: "center" },
  linkAction: { color: colors.accent, fontWeight: "700" },
  error: { fontSize: 14, color: colors.error },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: space.lg },
  sheet: { gap: space.md },
  device: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.xs },
  deviceInfo: { flex: 1, gap: 2 },
  deviceName: { fontSize: 16, fontWeight: "700", color: colors.text },
  deviceSub: { fontSize: 13, color: colors.hint },
  deviceButton: { paddingHorizontal: space.md },
  }),
);
