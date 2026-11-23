// «Telegram orqali kirish». Ilovada Telegram imzosi yo'q, shuning uchun kirishni bot tasdiqlaydi:
// tugma → server kod beradi → Telegram'da bot ochiladi → odam «Start», keyin «✅ Ha, kiraman» ni bosadi →
// ilova har 2 soniyada «tasdiqlandimi?» deb so'raydi va token oladi. Qadamlar mantig'i — src/appLogin.js.
import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { checkAppLogin, startAppLogin } from "../api.js";
import { createAppLogin } from "../appLogin.js";
import { useSession } from "../session.js";
import { colors, space } from "../theme.js";
import { Button, Card, Hint, Spinner } from "../ui.js";

// Avval tg:// — Telegram ilovasi to'g'ridan-to'g'ri ochiladi. Telegram o'rnatilmagan bo'lsa Android xato beradi →
// https://t.me/... (brauzer, u yerdan «Telegram'da ochish»). Brauzerda sinashda — faqat https havola
async function openTelegram(ticket) {
  if (Platform.OS !== "web" && ticket.tgUrl) {
    try {
      await Linking.openURL(ticket.tgUrl);
      return;
    } catch {
      // pastda https havola bilan
    }
  }
  await Linking.openURL(ticket.url);
}

export default function LoginScreen() {
  const { signIn } = useSession();
  const [state, setState] = useState({ step: "idle", error: null, offline: false });
  const flow = useRef(null);

  // Ekran ochilganda bir marta yaratiladi, yopilganda to'xtatiladi (so'rash ham to'xtaydi)
  useEffect(() => {
    const login = createAppLogin({
      start: startAppLogin,
      check: checkAppLogin,
      open: openTelegram,
      onChange: setState,
      onDone: (answer) => signIn(answer),
    });
    flow.current = login;
    // Odam Telegram'dan qaytdi — kutib o'tirmay darhol so'raymiz
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") login.resume();
    });
    return () => {
      sub.remove();
      login.dispose();
    };
  }, [signIn]);

  const { step, error, offline } = state;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <Text style={styles.logo}>🚛</Text>
          <Text style={styles.title}>Yuk Ekspert</Text>
          <Text style={styles.lead}>
            Yuk beruvchidan yukni to'g'ridan-to'g'ri olib, haydovchilarga yetkazamiz. Katta yuk guruhlaridagi e'lonlardan
            sizga moslarini saralab beramiz.
          </Text>
        </View>

        {step === "waiting" || step === "done" ? (
          <Card style={styles.box}>
            <Text style={styles.boxTitle}>Telegram'da tasdiqlang</Text>
            <Text style={styles.text}>
              1. Telegram'da Yuk Ekspert boti ochildi — <Text style={styles.bold}>«Start»</Text> ni bosing.{"\n"}
              2. Keyin <Text style={styles.bold}>«✅ Ha, kiraman»</Text> tugmasini bosing.{"\n"}
              3. Shu ilovaga qayting — o'zi kiradi.
            </Text>
            <Spinner label={step === "done" ? "Kirilyapti..." : "Tasdiqlash kutilmoqda..."} />
            {offline ? <Text style={styles.warn}>📡 Server bilan aloqa uzildi — qayta urinilyapti...</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Telegram'ni qayta ochish" kind="secondary" onPress={() => flow.current?.reopen()} disabled={step === "done"} />
            <Button title="Bekor qilish" kind="link" onPress={() => flow.current?.cancel()} disabled={step === "done"} />
          </Card>
        ) : (
          <Card style={styles.box}>
            {step === "expired" ? (
              <>
                <Text style={styles.boxTitle}>⌛ Kirish kodi eskirdi</Text>
                <Text style={styles.text}>Kod 10 daqiqa amal qiladi. Qaytadan urinib ko'ring.</Text>
              </>
            ) : (
              <Text style={styles.text}>Kirish uchun Telegram hisobingiz kerak. Parol yoki SMS kod so'ralmaydi.</Text>
            )}
            {step === "error" && error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title={step === "expired" || step === "error" ? "🔄 Qaytadan urinish" : "✈️ Telegram orqali kirish"}
              busy={step === "starting"}
              onPress={() => flow.current?.begin()}
            />
            <Hint>
              Agar havolani sizga boshqa odam yuborgan bo'lsa, botdagi «Ha, kiraman» ni bosmang — u sizning hisobingizga
              kirib oladi.
            </Hint>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: "center", padding: space.lg, gap: space.xl },
  brand: { alignItems: "center", gap: space.sm },
  logo: { fontSize: 56 },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  lead: { fontSize: 15, lineHeight: 21, color: colors.hint, textAlign: "center" },
  box: { gap: space.md },
  boxTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  text: { fontSize: 15, lineHeight: 23, color: colors.text },
  bold: { fontWeight: "700" },
  warn: { fontSize: 14, color: colors.hint, textAlign: "center" },
  error: { fontSize: 14, color: colors.error },
});
