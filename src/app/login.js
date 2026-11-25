// «Kod bilan kirish» (2026-11-24): telefon raqami yoki @username → bot Telegram'ga kod yuboradi → kod ilovaga yoziladi.
// Qadamlar mantig'i — src/codeLogin.js. Ekran (Azimjon, 2026-11-26): tepada ilova logosi va qisqa ma'lumot, «Kirish» —
// raqam yoki username, «Ro'yxatdan o'tish» — bitta «Bot orqali» tugmasi (botga o'tadi). Kanal/guruh haqida gap yo'q.
import { useEffect, useRef, useState } from "react";
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { requestLoginCode, verifyLoginCode } from "../api.js";
import { createCodeLogin, DEFAULT_DIGITS } from "../codeLogin.js";
import { useSession } from "../session.js";
import { colors, radius, space, themed } from "../theme.js";
import { Button, Card, Hint } from "../ui.js";

const LOGO = require("../../assets/icon.png");

// Kirib bo'lmadi — nima qilish kerak (qisqa; qolganini bot o'zi aytadi)
const PROBLEM_TEXT = {
  not_found: "Bu raqam yoki username bizda yo'q. Avval bot orqali ro'yxatdan o'ting.",
  not_member: "Ro'yxatdan o'tish tugallanmagan. Botni oching — u nima qilish kerakligini aytadi.",
  bot_blocked: "Bot sizga yoza olmadi. Botni oching va «Start» ni bosing, keyin qayta urinib ko'ring.",
};

// Soniyani «1:05» ko'rinishida
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const open = (url) => url && Linking.openURL(url).catch(() => {});

export default function LoginScreen() {
  const { signIn, botUsername } = useSession();
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

  const botUrl = `https://t.me/${botUsername}`;
  const digits = state?.digits ?? DEFAULT_DIGITS;
  const resendLeft = (state?.resendAt ?? 0) - now;
  const problem = state?.problem;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Image source={LOGO} style={styles.logo} accessibilityLabel="Yuk Ekspert" />
          <Text style={styles.title}>Yuk Ekspert</Text>
          <Text style={styles.lead}>
            Guruhlardagi yuk e'lonlarini shu yerga, darhol yuboradi. Yuk egasi esa yukini to'g'ridan-to'g'ri haydovchiga beradi.
          </Text>
        </View>

        {codeStep ? (
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
            <Button title="Kod olish" busy={step === "sending"} disabled={!login.trim()} onPress={submit} />
          </Card>
        )}

        {!codeStep ? (
          <Card style={[styles.box, problem && styles.alert]}>
            <Text style={styles.boxTitle}>Ro'yxatdan o'tish</Text>
            {problem ? <Text style={styles.text}>{PROBLEM_TEXT[problem]}</Text> : null}
            <Button title="✈️ Bot orqali" onPress={() => open(botUrl)} />
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: space.lg, paddingTop: space.xl, gap: space.lg },
  brand: { alignItems: "center", gap: space.sm },
  logo: { width: 88, height: 88, borderRadius: 22 },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  lead: { fontSize: 15, lineHeight: 21, color: colors.hint, textAlign: "center" },
  box: { gap: space.md },
  alert: { borderWidth: 1, borderColor: colors.accent },
  boxTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  text: { fontSize: 15, lineHeight: 23, color: colors.text },
  bold: { fontWeight: "700" },
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
  error: { fontSize: 14, color: colors.error },
  }),
);
