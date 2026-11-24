// Bo'limlardagi pastki panel (tabs) uchun umumiy ko'rinish: chapda ☰, belgi emoji'da, faol tab — ko'k.
import { Text } from "react-native";
import { MenuButton } from "./SideMenu.js";
import { colors } from "../theme.js";

export const tabIcon = (emoji) =>
  function TabIcon({ focused }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
  };

// Funksiya — har chizilishda joriy rejim (yorug'/qorong'i) ranglari olinadi (screenOptions funksiyani ham qabul qiladi)
export const sectionTabOptions = () => ({
  headerLeft: () => <MenuButton />,
  headerTintColor: colors.text,
  tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: colors.hint,
  tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
  headerStyle: { backgroundColor: colors.card },
  headerTitleStyle: { fontWeight: "700" },
  sceneStyle: { backgroundColor: colors.bg },
});
