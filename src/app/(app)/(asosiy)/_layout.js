// Asosiy bo'lim. Pastda: «📋 Yuklar» (yangi yuklar bo'lsa — qizil doirada son) · «🎛 Filtr» (faqat haydovchi) ·
// «⏸ Pauza» / «▶️ Davom etish» (sahifa emas — bosilsa ILOVA lentasi va bildirishnomalarini to'xtatadi yoki yoqadi;
// botdagi pauza alohida — Sozlamalarda yoki botning o'zida).
// Yuk beruvchida birinchi tab — «🚚 Mashinalar».
import { useState } from "react";
import { Pressable } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appOn, setAppActive } from "../../../api.js";
import { sectionTabOptions, tabIcon } from "../../../components/sectionTabs.js";
import { showError } from "../../../components/settingsUi.js";
import { badgeText, useNewLoads } from "../../../newLoads.js";
import { useSession } from "../../../session.js";
import { colors } from "../../../theme.js";
import { toast } from "../../../toast.js";

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const { me, setMe } = useSession();
  const { count } = useNewLoads();
  const [busy, setBusy] = useState(false);
  const shipper = me?.role === "yuk_beruvchi";
  const active = appOn(me);

  async function togglePause() {
    if (busy) return;
    setBusy(true);
    try {
      const next = await setAppActive(!active);
      setMe(next);
      toast(appOn(next) ? "▶️ Yoqildi — ilovaga yuklar yana keladi" : "⏸ Ilovada to'xtatildi — bot alohida ishlayveradi");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tabs screenOptions={() => sectionTabOptions(insets)}>
      <Tabs.Screen
        name="index"
        options={{
          title: shipper ? "Bo'sh mashinalar" : "Yuklar",
          // Ilova asosan shu sahifada ishlaydi — tepada sahifa nomi emas, ilova nomi (Azimjon, 2026-11-25)
          headerTitle: "Yuk Ekspert",
          tabBarLabel: shipper ? "Mashinalar" : "Yuklar",
          tabBarIcon: tabIcon(shipper ? "🚚" : "📋"),
          tabBarBadge: badgeText(count),
          tabBarBadgeStyle: { backgroundColor: colors.error, color: "#fff", fontWeight: "700" },
        }}
      />
      <Tabs.Screen name="filtr" options={{ title: "Filtr", tabBarIcon: tabIcon("🎛"), href: shipper ? null : undefined }} />
      <Tabs.Screen
        name="pauza"
        options={{
          title: active ? "Pauza" : "Davom etish",
          tabBarIcon: tabIcon(active ? "⏸" : "▶️"),
          // Pauzada — yashil «Davom etish», ko'zga tashlansin
          tabBarInactiveTintColor: active ? colors.text : colors.ok,
          tabBarButton: (props) => (
            <Pressable
              {...props}
              role="button"
              aria-busy={busy}
              onPress={togglePause}
              style={[props.style, busy && { opacity: 0.5 }]}
            />
          ),
        }}
      />
    </Tabs>
  );
}
