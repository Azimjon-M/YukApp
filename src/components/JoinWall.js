// Majburiy a'zolik (Azimjon, 2026-11-26: «majburiy guruh/kanaldan chiqib ketsa ilova ham ignore qilsin — faqat Yuk e'lonlari
// va E'lon berish; sababini ham yozdir»). Server lenta / E'lon berish javobida member: { ok: false, missing } beradi —
// shu oyna chiqadi: nima uchun, qaysi kanal/guruhga a'zo bo'lish kerak (tugmalar) va «✅ A'zo bo'ldim».
// Telegram'dan qaytganda (ilova yana oldinga chiqdi) o'zi qayta tekshiradi — tugmani bosish shart emas.
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, StyleSheet, Text, View } from "react-native";
import { checkMembership } from "../api.js";
import { colors, space, themed } from "../theme.js";
import { Button, Card } from "../ui.js";

const label = (chat) => `${chat.type === "channel" ? "📢" : "💬"} ${chat.title} — a'zo bo'lish`;

// missing — [{ ref, title, type, url }]; onJoined — a'zo bo'ldi (lenta / chat qayta yuklanadi); what — qaysi bo'lim
export function JoinWall({ missing, onJoined, what = "Yuk e'lonlari" }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const done = useRef(onJoined);
  useEffect(() => {
    done.current = onJoined;
  }, [onJoined]);

  const recheck = useCallback(async (manual = false) => {
    setBusy(manual);
    try {
      const result = await checkMembership();
      if (result.ok) done.current?.();
      else if (manual) setNote(`Hali a'zo emassiz: ${(result.missing ?? []).map((c) => c.title).join(", ")}. A'zo bo'lib, qayta bosing.`);
    } catch (error) {
      if (manual) setNote(error.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => next === "active" && recheck(false));
    return () => sub.remove();
  }, [recheck]);

  const list = missing?.length ? missing : [];
  return (
    <Card style={styles.box}>
      <Text style={styles.title}>🔒 Kanal va guruhimizga a'zo bo'ling</Text>
      <Text style={styles.text}>
        {what} faqat {list.length ? list.map((c) => c.title).join(" va ") : "kanal va guruhimiz"} a'zolariga ishlaydi. Siz a'zo emassiz yoki
        chiqib ketgansiz — shuning uchun hozir to'xtatildi.
      </Text>
      {list.map((chat) =>
        chat.url ? <Button key={chat.ref} title={label(chat)} kind="secondary" onPress={() => Linking.openURL(chat.url).catch(() => {})} /> : null,
      )}
      <Button title="✅ A'zo bo'ldim" busy={busy} onPress={() => recheck(true)} />
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </Card>
  );
}

// E'lon berish ustidan qoplama — chat orqada xira ko'rinadi, yozib bo'lmaydi; sarlavha va ☰ menyu ishlayveradi
export function JoinOverlay({ missing, onJoined }) {
  return (
    <View style={styles.backdrop}>
      <JoinWall missing={missing} onJoined={onJoined} what="E'lon berish" />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  box: { gap: space.md },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  text: { fontSize: 15, lineHeight: 22, color: colors.text },
  note: { fontSize: 14, color: colors.error },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: space.lg, zIndex: 10 },
  }),
);
