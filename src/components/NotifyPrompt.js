// «🔔 Bildirishnomani yoqasizmi?» oynasi. Birinchi kirishda va o'chiq qolsa har 3 kunda (notifyAsk.js), muloyim, majburiy emas.
import { useCallback, useEffect, useState } from "react";
import { AppState, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { afterAsk, afterNever, afterSkip, askKind, parseSaved } from "../notifyAsk.js";
import { enable, permission } from "../notify.js";
import { loadValue, saveValue } from "../storage.js";
import { colors, radius, space, themed } from "../theme.js";
import { Button } from "../ui.js";

const KEY = "yuk_notify_ask";

export function NotifyPrompt() {
  const [kind, setKind] = useState(null); // null | "first" | "again"
  const [saved, setSaved] = useState({});
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    if (Platform.OS !== "android") return; // bildirishnoma faqat Android ilovada
    const p = await permission();
    const s = parseSaved(await loadValue(KEY));
    setSaved(s);
    setKind(askKind(p.granted, s, Date.now()));
  }, []);

  useEffect(() => {
    const first = setTimeout(check, 1200); // ilova ochilib, lenta ko'ringandan keyin — birdaniga emas
    const sub = AppState.addEventListener("change", (next) => next === "active" && check());
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [check]);

  const store = (next) => {
    setSaved(next);
    saveValue(KEY, JSON.stringify(next));
    setKind(null);
  };
  const onEnable = async () => {
    setBusy(true);
    await enable();
    setBusy(false);
    store(afterAsk(saved, Date.now()));
  };

  if (!kind) return null;
  const again = kind === "again";
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => store(afterSkip(saved, Date.now()))}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.icon}>🔔</Text>
          <Text style={styles.title}>{again ? "Bildirishnomalar o'chiq" : "Yangi yuklarni o'tkazib yubormang"}</Text>
          <Text style={styles.text}>
            {again
              ? "Hozir yangi e'lonlar haqida telefoningizga xabar kelmayapti. Yoqib qo'yasizmi? Istamasangiz — bemalol, ilova baribir ishlayveradi."
              : "Ilova yopiq bo'lsa ham, filtringizga mos e'lon chiqishi bilan xabar keladi: qayerdan → qayerga va bir bosishda qo'ng'iroq."}
          </Text>
          <View style={styles.actions}>
            <Button title="🔔 Yoqish" onPress={onEnable} busy={busy} />
            <Button title="Keyinroq" kind="secondary" onPress={() => store(afterSkip(saved, Date.now()))} disabled={busy} />
            {again ? <Button title="Kerak emas" kind="link" onPress={() => store(afterNever(saved))} disabled={busy} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: "center", padding: space.xl },
    box: { backgroundColor: colors.card, borderRadius: radius + 4, padding: space.xl, gap: space.md, alignItems: "stretch" },
    icon: { fontSize: 40, textAlign: "center" },
    title: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" },
    text: { fontSize: 15, lineHeight: 21, color: colors.hint, textAlign: "center" },
    actions: { gap: space.sm, marginTop: space.sm },
  }),
);
