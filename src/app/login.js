// «Kod bilan kirish» (2026-11-24): telefon raqami yoki @username → bot Telegram'ga kod yuboradi → kod ilovaga yoziladi.
// Qadamlar mantig'i — src/codeLogin.js. Ekran (Azimjon, 2026-11-26): tepada logo va qisqa ma'lumot; «Kirish» qutisida —
// raqam/username va «Bot orqali kirish» (src/botLogin.js). Botdan ro'yxatdan o'tmagan yoki botni o'chirgan odam kod ola
// olmaydi — shunda bildirishnoma chiqadi va «Bot orqali kirish» ga ishora qiladi. Pastda — «Ro'yxatdan o'tish» (royxat.js).
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { requestLoginCode, verifyLoginCode } from "../api.js";
import { createCodeLogin, DEFAULT_DIGITS } from "../codeLogin.js";
import { AuthLink, BotWait, Brand, useBotLogin } from "../components/AuthParts.js";
import { useSession } from "../session.js";
import { colors, radius, space, themed } from "../theme.js";
import { Button, Card, Hint } from "../ui.js";

// Kod bilan kirib bo'lmadi — nega va nima qilish kerak (pastdagi «Bot orqali kirish» ga ishora)
const PROBLEM_TEXT = {
  not_found: "Bu raqam yoki username bizda topilmadi — siz hali botdan ro'yxatdan o'tmagansiz.",
  not_member: "Botdagi ro'yxatdan o'tish tugallanmagan.",
  bot_blocked: "Siz botni to'xtatgansiz yoki o'chirgansiz — bot sizga kod yubora olmadi.",
};

// Soniyani «1:05» ko'rinishida
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function LoginScreen() {
  const { signIn, botUsername } = useSession();
  const router = useRouter();
  const bot = useBotLogin();
  const [state, setState] = useState(null);
  const [login, setLogin] = useState("");
  const [code, setCode] = useState("");
  const [now, setNow] = useState(() => Date.now()); // sanagich: kod kutilayotganda har soniyada yangilanadi
  const flow = useRef(null);

  useEffect(() => {
    const machine = createCodeLogin({
      requestCode: requestLoginCode,
      verifyCode: verifyLoginCode,
      onChange: setState,
      onDone: (answer) => signIn(answer),
    });
    flow.current = machine;
    return () => machine.dispose();
  }, [signIn]);

  const step = state?.step ?? "enter";
  const codeStep = step === "code" || step === "verifying" || step === "done";

  // Kod kutilayotganda «qayta yuborish» va «amal qiladi» sanagichi
  useEffect(() => {
    if (!codeStep) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [codeStep]);

  // Yangi kod so'ralganda yoki boshiga qaytilganda eski yozilgan kod tozalanadi
  const resend = () => {
    setCode("");
    setNow(Date.now());
    flow.current?.resend();
  };
  const back = () => {
    setCode("");
    flow.current?.back();
  };
  const submit = () => {
    setCode("");
    setNow(Date.now());
    flow.current?.submit(login);
  };
  const expiresAt = state?.expiresAt;

  const digits = state?.digits ?? DEFAULT_DIGITS;
  const resendLeft = (state?.resendAt ?? 0) - now;
  const problem = state?.problem;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Brand />

        {bot.state.step === "waiting" || bot.state.step === "done" ? (
          <BotWait bot={bot} botUsername={botUsername} />
        ) : codeStep ? (
          <Card style={styles.box}>
            <Text style={styles.boxTitle}>Kodni yozing</Text>
            <Text style={styles.text}>
              <Text style={styles.bold}>@{botUsername}</Text> boti Telegram'ingizga ({state?.login}) {digits} xonali kod yubordi.
            </Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, digits))}
              placeholder={"•".repeat(digits)}
              placeholderTextColor={colors.hint}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={digits}
              autoFocus
              editable={step === "code" && !state?.expired}
              onSubmitEditing={() => flow.current?.confirm(code)}
            />
            {state?.error ? <Text style={styles.error}>{state.error}</Text> : null}
            {!state?.expired ? <Hint>Kod {clock((expiresAt ?? 0) - now)} amal qiladi.</Hint> : null}
            <Button
              title="Kirish"
              busy={step === "verifying" || step === "done"}
              disabled={state?.expired || code.length !== digits}
              onPress={() => flow.current?.confirm(code)}
            />
            <Button
              title={state?.expired || resendLeft <= 0 ? "Kodni qayta yuborish" : `Kodni qayta yuborish (${clock(resendLeft)})`}
              kind="secondary"
              disabled={step !== "code" || (!state?.expired && resendLeft > 0)}
              onPress={resend}
            />
            <Button title="Boshqa raqam yoki username" kind="link" disabled={step === "done"} onPress={back} />
            <Hint>Kodni hech kimga aytmang — Yuk Ekspert xodimlari ham uni so'ramaydi.</Hint>
          </Card>
        ) : (
          <Card style={styles.box}>
            <Text style={styles.boxTitle}>Kirish</Text>
            <Text style={styles.text}>Telefon raqamingiz yoki Telegram username'ingiz bilan kiring.</Text>
            <TextInput
              style={styles.input}
              value={login}
              onChangeText={setLogin}
              placeholder="+998 90 123 45 67 yoki @username"
              placeholderTextColor={colors.hint}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              editable={step !== "sending"}
              onSubmitEditing={submit}
            />
            {state?.error ? <Text style={styles.error}>{state.error}</Text> : null}
            <Button title="Kod olish" kind={problem ? "secondary" : "primary"} busy={step === "sending"} disabled={!login.trim()} onPress={submit} />
            {problem ? (
              <View style={styles.notice} role="alert">
                <Text style={styles.noticeTitle}>⚠️ Kod bilan kirib bo'lmadi</Text>
                <Text style={styles.text}>{PROBLEM_TEXT[problem]}</Text>
                <Text style={styles.text}>
                  👇 Pastdagi <Text style={styles.bold}>«Bot orqali kirish»</Text> ni bosing: bot ochiladi, «Start» → «✅ Ha, kiraman» — va
                  ilovaga kirasiz.
                </Text>
              </View>
            ) : null}
            <View style={styles.or}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>yoki</Text>
              <View style={styles.orLine} />
            </View>
            <Button
              title="✈️ Bot orqali kirish"
              kind={problem ? "primary" : "secondary"}
              busy={bot.state.step === "starting"}
              onPress={bot.begin}
            />
            {bot.state.error ? <Text style={styles.error}>{bot.state.error}</Text> : null}
          </Card>
        )}

        {!codeStep && bot.state.step !== "waiting" ? (
          <AuthLink question="Hisobingiz yo'qmi?" action="Ro'yxatdan o'tish" onPress={() => router.replace("/royxat")} />
        ) : null}
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
  text: { fontSize: 15, lineHeight: 23, color: colors.text },
  bold: { fontWeight: "700" },
  error: { fontSize: 14, color: colors.error },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 17,
    color: colors.text,
    backgroundColor: colors.card,
  },
  codeInput: { fontSize: 26, letterSpacing: 10, textAlign: "center", fontWeight: "700" },
  notice: { gap: space.sm, padding: space.md, borderRadius: radius, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.bg },
  noticeTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  or: { flexDirection: "row", alignItems: "center", gap: space.sm },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  orText: { fontSize: 13, color: colors.hint },
  }),
);
