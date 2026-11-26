// Kirish (login.js) va Ro'yxatdan o'tish (royxat.js) sahifalarining umumiy qismlari (Azimjon, 2026-11-26):
// tepadagi logo + qisqa ma'lumot, «Bot orqali» kirish oqimi (src/botLogin.js) va uni kutish qutisi, pastdagi havola.
import { useEffect, useRef, useState } from "react";
import { AppState, Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { pollBotLogin, startBotLogin } from "../api.js";
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

// Bot orqali kirish: { state, begin, reopen, cancel }. Odam Telegram'dan qaytganda darhol tekshiramiz
export function useBotLogin() {
  const { signIn } = useSession();
  const [state, setState] = useState({ step: "idle", error: null });
  const flow = useRef(null);
  useEffect(() => {
    const machine = createBotLogin({ start: startBotLogin, poll: pollBotLogin, openUrl, onChange: setState, onDone: (answer) => signIn(answer) });
    flow.current = machine;
    const sub = AppState.addEventListener("change", (next) => next === "active" && machine.nudge());
    return () => {
      sub.remove();
      machine.dispose();
    };
  }, [signIn]);
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
        <Text style={styles.bold}>@{botUsername}</Text> boti ochildi. U yerda «Start» ni, keyin «✅ Ha, kiraman» ni bosing va shu
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
  }),
);
