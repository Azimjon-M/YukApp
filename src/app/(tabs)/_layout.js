// Pastki bo'limlar (tabs). Birinchisi rolga qarab: haydovchiga «📋 Yuklar», yuk beruvchiga «🚚 Mashinalar» —
// bitta ekran (index.js), u o'zi rolga qarab yuklar yoki bo'sh mashinalarni ko'rsatadi.
import { Text } from "react-native";
import { Tabs } from "expo-router";
import { useSession } from "../../session.js";
import { colors } from "../../theme.js";

const icon = (emoji) =>
  function TabIcon({ focused }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  const { me } = useSession();
  const shipper = me?.role === "yuk_beruvchi";
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.hint,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: shipper ? "Bo'sh mashinalar" : "Yuklar", tabBarLabel: shipper ? "Mashinalar" : "Yuklar", tabBarIcon: icon(shipper ? "🚚" : "📋") }}
      />
      <Tabs.Screen name="sozlamalar" options={{ title: "Sozlamalar", tabBarIcon: icon("⚙️") }} />
    </Tabs>
  );
}
