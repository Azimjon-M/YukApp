// Kirgan foydalanuvchi qismi: yon menyu (☰) + bo'limlar. Har bo'lim — o'z pastki paneli (tabs) bilan:
//   (asosiy)    → 📋 Yuklar / 🚚 Bo'sh mashinalar · 🎛 Filtr · ⏸ Pauza («🔴 yangi yuklar» belgisi — newLoads.js)
//   sozlamalar  → «E'lon sozlamalari» · «Hisob sozlamalari»
//   haqida      → Dastur haqida (muallif, qo'llab-quvvatlash)
// Bo'limlar orasida Stack: Android «orqaga» tugmasi oldingi bo'limga qaytaradi.
import { Stack } from "expo-router";
import { MenuButton, SideMenuProvider } from "../../components/SideMenu.js";
import { NewLoadsProvider } from "../../newLoads.js";
import { colors } from "../../theme.js";

export default function AppLayout() {
  return (
    <NewLoadsProvider>
    <SideMenuProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(asosiy)" />
        <Stack.Screen name="sozlamalar" />
        <Stack.Screen
          name="haqida"
          options={{
            headerShown: true,
            title: "Dastur haqida",
            headerLeft: () => <MenuButton />,
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "700" },
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </SideMenuProvider>
    </NewLoadsProvider>
  );
}
