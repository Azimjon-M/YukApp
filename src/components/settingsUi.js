// Sozlamalar ekranlari («E'lon» va «Hisob») uchun umumiy qismlar: bo'lim, qator, xato oynasi, amal bajaruvchi.
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { colors, space, themed } from "../theme.js";
import { Card } from "../ui.js";

export function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card style={styles.sectionBody}>{children}</Card>
    </View>
  );
}

export function Row({ icon, label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowText}>
        {label ? <Text style={styles.rowLabel}>{label}: </Text> : null}
        {value}
      </Text>
    </View>
  );
}

// Server xatosi (401/403 ni api.js o'zi hal qiladi — ilova kirish yoki «Uzr» ekraniga o'tadi)
export const showError = (error) => {
  if (error.code !== "auth" && error.code !== "blocked") Alert.alert("Bajarilmadi", error.message);
};

// Bir vaqtda bitta amal: busy — qaysi amal bajarilyapti (tugmada spinner), run(name, action)
export function useRunner() {
  const [busy, setBusy] = useState(null);
  const run = useCallback(async (name, action) => {
    setBusy(name);
    try {
      await action();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  }, []);
  return { busy, run };
}

// Pastga tortib yangilash (sessiyadagi «me» qayta so'raladi — botda o'zgartirilgani ham ko'rinadi)
export function usePullRefresh(refreshMe) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshMe();
    } catch (error) {
      showError(error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshMe]);
  return { refreshing, onRefresh };
}

export const settingsStyles = themed(() =>
  StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingBottom: space.xl, gap: space.lg },
  rowText: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.text },
  footer: { textAlign: "center" },
  }),
);

const styles = themed(() =>
  StyleSheet.create({
  section: { gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.accent, marginLeft: space.sm, textTransform: "uppercase" },
  sectionBody: { gap: space.md },
  row: { flexDirection: "row", gap: space.sm },
  rowIcon: { fontSize: 16, width: 24 },
  rowText: settingsStyles.rowText,
  rowLabel: { color: colors.hint },
  }),
);
