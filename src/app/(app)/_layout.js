// Kirgan foydalanuvchi qismi: yon menyu (☰) + bo'limlar. Har bo'lim — o'z pastki paneli (tabs) bilan:
//   (asosiy)    → 📋 Yuklar / 🚚 Bo'sh mashinalar · 🎛 Filtr · ⏸ Pauza («🔴 yangi yuklar» belgisi — newLoads.js)
//   sozlamalar  → «E'lon sozlamalari» · «Hisob sozlamalari»
//   elon        → 📝 E'lon berish (chat, yuk beruvchi)
//   haqida      → Dastur haqida (muallif, qo'llab-quvvatlash)
// Bildirishnoma: token serverga, bosilganda Yuklar / qo'ng'iroq (notify.js), ruxsat so'rash oynasi (NotifyPrompt).
// Bo'limlar orasida Stack: Android «orqaga» tugmasi oldingi bo'limga qaytaradi.
import { Stack } from "expo-router";
import { NotifyPrompt } from "../../components/NotifyPrompt.js";
import { MenuButton, SideMenuProvider } from "../../components/SideMenu.js";
import { NewLoadsProvider } from "../../newLoads.js";
import { useNotifications } from "../../notify.js";
import { colors } from "../../theme.js";

export default function AppLayout() {
  useNotifications(true);
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
        <Stack.Screen
          name="elon"
          options={{
            headerShown: true,
            title: "E'lon berish",
            headerLeft: () => <MenuButton />,
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "700" },
            headerShadowVisible: true, // sarlavha chat xabarlaridan ajralib tursin (ikkalasi bir rangda edi)
          }}
        />
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
      <NotifyPrompt />
    </SideMenuProvider>
    </NewLoadsProvider>
  );
}
