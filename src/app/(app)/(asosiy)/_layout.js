// Asosiy bo'lim: haydovchiga yuklar, yuk beruvchiga bo'sh mashinalar. Pastda: «Menga mos» · «Hammasi».
import { Tabs } from "expo-router";
import { sectionTabOptions, tabIcon } from "../../../components/sectionTabs.js";
import { useSession } from "../../../session.js";

export default function MainTabs() {
  const { me } = useSession();
  const title = me?.role === "yuk_beruvchi" ? "Bo'sh mashinalar" : "Yuklar";
  return (
    <Tabs screenOptions={sectionTabOptions}>
      <Tabs.Screen name="index" options={{ title, tabBarLabel: "Menga mos", tabBarIcon: tabIcon("🎯") }} />
      <Tabs.Screen name="hammasi" options={{ title, tabBarLabel: "Hammasi", tabBarIcon: tabIcon("📋") }} />
    </Tabs>
  );
}
