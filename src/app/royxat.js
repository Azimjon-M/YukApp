// «Ro'yxatdan o'tish» (Azimjon, 2026-11-26: alohida sahifa; forma ostida «Kirish» havolasi).
// Ro'yxatdan o'tish — botda: «Bot orqali ro'yxatdan o'tish» botni ochadi (t.me/<bot>?start=app_<kod>), odam «Start» va
// «✅ Ha, bog'layman» ni bosadi — hisob ochiladi va ilova o'zi kiradi (src/botLogin.js, Kirish sahifasidagi bilan bir oqim).
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AuthLink, BotWait, Brand, useBotLogin } from "../components/AuthParts.js";
import { useSession } from "../session.js";
import { colors, space, themed } from "../theme.js";
import { Button, Card, Hint } from "../ui.js";

const STEPS = [
  "Pastdagi tugmani bosing — Telegram'da bot ochiladi.",
  "Botda «Start» ni, keyin «✅ Ha, bog'layman» ni bosing.",
  "Shu yerga qayting — hisobingiz ochilgan, ilova o'zi kiradi.",
];

export default function RegisterScreen() {
  const { botUsername } = useSession();
  const router = useRouter();
  const bot = useBotLogin();
  const waiting = bot.state.step === "waiting" || bot.state.step === "done";

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Brand />
        {waiting ? (
          <BotWait bot={bot} botUsername={botUsername} />
        ) : (
          <Card style={styles.box}>
            <Text style={styles.boxTitle}>Ro'yxatdan o'tish</Text>
            {STEPS.map((text, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.num}>{i + 1}</Text>
                <Text style={styles.text}>{text}</Text>
              </View>
            ))}
            <Button title="✈️ Bot orqali ro'yxatdan o'tish" busy={bot.state.step === "starting"} onPress={bot.begin} />
            {bot.state.error ? <Text style={styles.error}>{bot.state.error}</Text> : null}
            <Hint>Telegram kerak. Raqamingizni keyin botda /raqam orqali ulashsangiz — raqam bilan ham kira olasiz.</Hint>
          </Card>
        )}
        {!waiting ? <AuthLink question="Hisobingiz bormi?" action="Kirish" onPress={() => router.replace("/login")} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: space.lg, paddingTop: space.xl, gap: space.lg },
  box: { gap: space.md },
  boxTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  step: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  num: { width: 26, height: 26, borderRadius: 13, textAlign: "center", lineHeight: 26, fontWeight: "700", color: colors.accentText, backgroundColor: colors.accent, overflow: "hidden" },
  text: { flex: 1, fontSize: 15, lineHeight: 23, color: colors.text },
  error: { fontSize: 14, color: colors.error },
  }),
);
