// Muloyim so'rash oynalari (notifyAsk.js qoidasi: birinchi marta, keyin o'chiq qolsa har 3 kunda, «Kerak emas» — boshqa yo'q):
//   1) 🔔 bildirishnomaga ruxsat;
//   2) 🔋 batareya tejash ilovani to'xtatmasin (bildirishnoma yoqilgandan keyin; ayniqsa Infinix/Tecno/Xiaomi'da kerak).
import { useCallback, useEffect, useState } from "react";
import { AppState, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { afterAsk, afterNever, afterSkip, askKind, parseSaved } from "../notifyAsk.js";
import { batteryLimited, enable, freeBattery, permission } from "../notify.js";
import { loadValue, saveValue } from "../storage.js";
import { colors, radius, space, themed } from "../theme.js";
import { Button } from "../ui.js";

const STEPS = {
  notify: {
    key: "yuk_notify_ask",
    icon: "🔔",
    title: { first: "Yangi yuklarni o'tkazib yubormang", again: "Bildirishnomalar o'chiq" },
    text: {
      first: "Ilova yopiq bo'lsa ham, filtringizga mos e'lon chiqishi bilan xabar keladi: qayerdan → qayerga va bir bosishda qo'ng'iroq.",
      again: "Hozir yangi e'lonlar haqida telefoningizga xabar kelmayapti. Yoqib qo'yasizmi? Istamasangiz — bemalol, ilova baribir ishlayveradi.",
    },
    yes: "🔔 Yoqish",
    run: enable,
  },
  battery: {
    key: "yuk_battery_ask",
    icon: "🔋",
    title: { first: "Telefon xabarlarni to'xtatmasin", again: "Batareya tejash xabarlarni to'xtatyapti" },
    text: {
      first: "Batareya tejash rejimi ilovani fonda uxlatib qo'yadi — yangi yuk haqidagi xabar kech keladi yoki umuman kelmaydi. Keyingi oynada «Ruxsat berish» ni bosing. Batareyaga deyarli ta'sir qilmaydi.",
      again: "Telefoningiz hali ham ilovani fonda to'xtatib qo'yishi mumkin — xabarlar kechikadi. Ruxsat berasizmi? Istamasangiz — kerak emas.",
    },
    yes: "🔋 Ruxsat berish",
    run: freeBattery,
  },
};

export function NotifyPrompt() {
  const [ask, setAsk] = useState(null); // { step, kind, saved }
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    if (Platform.OS !== "android") return; // faqat Android ilovada
    const now = Date.now();
    const p = await permission();
    const notifySaved = parseSaved(await loadValue(STEPS.notify.key));
    const notifyKind = askKind(p.granted, notifySaved, now);
    if (notifyKind) return setAsk({ step: "notify", kind: notifyKind, saved: notifySaved });
    if (p.granted) {
      const limited = await batteryLimited();
      const batterySaved = parseSaved(await loadValue(STEPS.battery.key));
      const batteryKind = askKind(!limited, batterySaved, now);
      if (batteryKind) return setAsk({ step: "battery", kind: batteryKind, saved: batterySaved });
    }
    setAsk(null);
  }, []);

  useEffect(() => {
    const first = setTimeout(check, 1200); // ilova ochilib, lenta ko'ringandan keyin — birdaniga emas
    const sub = AppState.addEventListener("change", (next) => next === "active" && check());
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [check]);

  if (!ask) return null;
  const step = STEPS[ask.step];
  const store = (next) => {
    saveValue(step.key, JSON.stringify(next));
    setAsk(null);
  };
  const onYes = async () => {
    setBusy(true);
    await step.run();
    setBusy(false);
    store(afterAsk(ask.saved, Date.now()));
    if (ask.step === "notify") setTimeout(check, 600); // ruxsat berdi — darhol batareya so'rovi (kerak bo'lsa)
  };
  const later = () => store(afterSkip(ask.saved, Date.now()));
  const again = ask.kind === "again";
  return (
    <Modal transparent animationType="fade" visible onRequestClose={later}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.icon}>{step.icon}</Text>
          <Text style={styles.title}>{step.title[ask.kind]}</Text>
          <Text style={styles.text}>{step.text[ask.kind]}</Text>
          <View style={styles.actions}>
            <Button title={step.yes} onPress={onYes} busy={busy} />
            <Button title="Keyinroq" kind="secondary" onPress={later} disabled={busy} />
            {again ? <Button title="Kerak emas" kind="link" onPress={() => store(afterNever(ask.saved))} disabled={busy} /> : null}
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
