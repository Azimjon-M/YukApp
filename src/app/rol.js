// Rol: haydovchi yoki yuk beruvchi (botdagi /rol bilan bir xil). Har rolning sozlamalari serverda alohida saqlanadi —
// avval to'ldirilgan rolga qaytilsa, sozlamalari tiklanadi (PUT /pub/me/role).
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ROLES, ROLE_IDS } from "@yuk/shared";
import { setRole } from "../api.js";
import { useSession } from "../session.js";
import { colors, radius, space } from "../theme.js";
import { Button, Hint } from "../ui.js";

export default function RoleScreen() {
  const { me, setMe, leave } = useSession();
  const [busy, setBusy] = useState(null);
  const current = me?.role ?? null;

  async function pick(id) {
    if (id === current) {
      router.back();
      return;
    }
    setBusy(id);
    try {
      const updated = await setRole(id);
      setMe(updated);
      // Sozlamalardan ochilgan bo'lsa — orqaga; birinchi marta — bosh sahifaga
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (error) {
      if (error.code !== "auth" && error.code !== "blocked") Alert.alert("Saqlanmadi", error.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.page} edges={current ? ["bottom"] : ["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{current ? "Kim sifatida foydalanasiz?" : "Iltimos, rolingizni tanlang 👇"}</Text>
        <Hint>
          {current
            ? "Har rolning sozlamalari alohida saqlanadi — qaytib kelsangiz, qaytadan kiritish shart emas."
            : "Shunga qarab katta yuk guruhlaridagi e'lonlardan sizga keraklisini saralab beramiz."}
        </Hint>
        {ROLE_IDS.map((id) => {
          const role = ROLES[id];
          const on = current === id;
          return (
            <Pressable
              key={id}
              role="button"
              aria-selected={on}
              aria-busy={busy === id}
              disabled={busy != null}
              onPress={() => pick(id)}
              style={({ pressed }) => [styles.role, on && styles.roleOn, pressed && styles.pressed, busy != null && busy !== id && styles.dim]}
            >
              <Text style={styles.icon}>{role.icon}</Text>
              <View style={styles.roleText}>
                {/* "🚚 Men haydovchiman — yuk kerak" → belgisiz */}
                <Text style={styles.roleName}>{role.choice.replace(/^\S+\s/, "")}</Text>
                <Text style={styles.roleSub}>Sizga {role.gets} keladi</Text>
              </View>
            </Pressable>
          );
        })}
        {!current ? <Button title="Chiqish" kind="link" onPress={leave} disabled={busy != null} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: "center", padding: space.lg, gap: space.md },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  role: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: space.lg,
    borderWidth: 2,
    borderColor: "transparent",
  },
  roleOn: { borderColor: colors.accent, backgroundColor: colors.soft },
  pressed: { opacity: 0.75 },
  dim: { opacity: 0.5 },
  icon: { fontSize: 34 },
  roleText: { flex: 1, gap: 2 },
  roleName: { fontSize: 17, fontWeight: "700", color: colors.text },
  roleSub: { fontSize: 14, lineHeight: 19, color: colors.hint },
});
