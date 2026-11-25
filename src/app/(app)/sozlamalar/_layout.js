// Sozlamalar bo'limi. Pastda: «E'lon sozlamalari» (bot yuborishi, transport, yo'nalish) · «Hisob sozlamalari».
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sectionTabOptions, tabIcon } from "../../../components/sectionTabs.js";

export default function SettingsTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={() => sectionTabOptions(insets)}>
      <Tabs.Screen name="index" options={{ title: "E'lon sozlamalari", tabBarLabel: "E'lon", tabBarIcon: tabIcon("📢") }} />
      <Tabs.Screen name="hisob" options={{ title: "Hisob sozlamalari", tabBarLabel: "Hisob", tabBarIcon: tabIcon("👤") }} />
    </Tabs>
  );
}
