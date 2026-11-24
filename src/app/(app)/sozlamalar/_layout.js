// Sozlamalar bo'limi. Pastda: «E'lon sozlamalari» (bot yuborishi, transport, yo'nalish) · «Hisob sozlamalari».
import { Tabs } from "expo-router";
import { sectionTabOptions, tabIcon } from "../../../components/sectionTabs.js";

export default function SettingsTabs() {
  return (
    <Tabs screenOptions={sectionTabOptions}>
      <Tabs.Screen name="index" options={{ title: "E'lon sozlamalari", tabBarLabel: "E'lon", tabBarIcon: tabIcon("📢") }} />
      <Tabs.Screen name="hisob" options={{ title: "Hisob sozlamalari", tabBarLabel: "Hisob", tabBarIcon: tabIcon("👤") }} />
    </Tabs>
  );
}
