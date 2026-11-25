// Bo'limlardagi pastki panel (tabs) uchun umumiy ko'rinish: chapda ☰, belgi emoji'da, faol tab — shaffof ko'k box ichida.
import { Text } from "react-native";
import { MenuButton } from "./SideMenu.js";
import { colors } from "../theme.js";

export const tabIcon = (emoji) =>
  function TabIcon({ focused }) {
    // Faol va nofaol belgi bir xil tiniq — faollikni orqadagi shaffof box ko'rsatadi (tabBarActiveBackgroundColor)
    return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
  };

// Funksiya — har chizilishda joriy rejim (yorug'/qorong'i) ranglari olinadi (screenOptions funksiyani ham qabul qiladi)
export const sectionTabOptions = () => ({
  headerLeft: () => <MenuButton />,
  headerTintColor: colors.text,
  tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
  // iOS'dagidek: faol tab — orqasida yumshoq shaffof, qirrasiz box; nofaollar ham tiniq turadi
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: colors.text,
  tabBarActiveBackgroundColor: colors.tabActive,
  tabBarItemStyle: { borderRadius: 16, marginHorizontal: 6, marginVertical: 4, overflow: "hidden" },
  tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
  headerStyle: { backgroundColor: colors.card },
  headerTitleStyle: { fontWeight: "700" },
  sceneStyle: { backgroundColor: colors.bg },
});
