// Ilovaning ildizi. Expo Router: src/app ichidagi har fayl — ekran (manzil), _layout.js — ularni o'rab turuvchi navigator.
//
// Qaysi ekran ochiq bo'lishi sessiya holatiga bog'liq (Stack.Protected: guard false bo'lsa ekran yo'q, ilova birinchi
// ochiq ekranga o'tadi):
//   loading / blocked / offline → holat.js  (kutish, «Uzr...», «Aloqa yo'q»)
//   out                         → login.js  («Telegram orqali kirish»)
//   in, rol tanlanmagan         → rol.js    («Kim sifatida foydalanasiz?»)
//   in, rol bor                 → (app)     (☰ yon menyu: Yuklar · Sozlamalar · Dastur haqida), yonalish.js, rol.js
//
// Yorug'/qorong'i rejim: telefon sozlamasiga qaraydi (app.json userInterfaceStyle: "automatic"). Rejim almashsa —
// theme.js ranglari almashadi va butun ilova (key) qaytadan chiziladi. Tepadagi status bar matni va fon ham shunga mos.
// Tepadagi bildirishnoma paneli va pastdagi tizim tugmalari (back/home) ostiga ekran kirmaydi: sarlavha va pastki panel
// (react-navigation) o'zi joy qoldiradi, sarlavhasiz ekranlar SafeAreaView bilan.
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { SessionProvider, useSession } from "../session.js";
import { applyScheme, colors, schemeOf } from "../theme.js";

// Sessiya tekshirilguncha boshlang'ich rasm (splash) turadi — oq ekran miltillamasin
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = schemeOf(useColorScheme());
  applyScheme(scheme); // bolalar chizilishidan oldin — ranglar shu rejimniki
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [scheme]);
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: colors.accent, background: colors.bg, card: colors.card, text: colors.text, border: colors.line, notification: colors.error },
  };
  return (
    <ThemeProvider value={navTheme}>
      <SessionProvider>
        <SplashController />
        <RootStack key={scheme} />
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      </SessionProvider>
    </ThemeProvider>
  );
}

function SplashController() {
  const { status } = useSession();
  if (status !== "loading") SplashScreen.hide();
  return null;
}

function RootStack() {
  const { status, me } = useSession();
  const signedIn = status === "in";
  const hasRole = signedIn && Boolean(me?.role);
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={hasRole}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="yonalish" options={{ title: "Yo'nalish" }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        {/* Birinchi marta — sarlavhasiz (orqaga qaytadigan joy yo'q); Sozlamalardan almashtirishda — sarlavha bilan */}
        <Stack.Screen name="rol" options={{ title: "Rolni almashtirish", headerShown: hasRole }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "out"}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "loading" || status === "blocked" || status === "offline"}>
        <Stack.Screen name="holat" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
