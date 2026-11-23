// Kichik umumiy qismlar: tugma, xabar oynasi, tanlov (segment), karta. Web'dagi ui.jsx ning ilova ko'rinishi.
// React Native'da <div>/<button> yo'q: View — quti, Text — matn (matn faqat <Text> ichida bo'ladi), Pressable — bosiladigan.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "./theme.js";

// kind: "primary" (ko'k) | "secondary" (oq, ramkali) | "danger" (qizil matn) | "link" (faqat matn)
export function Button({ title, onPress, kind = "primary", disabled = false, busy = false, style }) {
  const off = disabled || busy;
  return (
    <Pressable
      role="button"
      aria-disabled={off}
      aria-busy={busy}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[kind], pressed && styles.pressed, off && styles.disabled, style]}
    >
      {busy ? (
        <ActivityIndicator color={kind === "primary" ? colors.accentText : colors.accent} />
      ) : (
        <Text style={[styles.buttonText, styles[`${kind}Text`]]}>{title}</Text>
      )}
    </Pressable>
  );
}

// Oq quti (bo'lim)
export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// Markazdagi xabar: sarlavha, matn, pastida tugmalar
export function Notice({ title, children, action }) {
  return (
    <Card style={styles.notice}>
      {title ? <Text style={styles.noticeTitle}>{title}</Text> : null}
      {typeof children === "string" ? <Text style={styles.noticeText}>{children}</Text> : children}
      {action ? <View style={styles.noticeAction}>{action}</View> : null}
    </Card>
  );
}

export function Spinner({ label }) {
  return (
    <View style={styles.spinner}>
      <ActivityIndicator size="large" color={colors.accent} />
      {label ? <Text style={styles.hint}>{label}</Text> : null}
    </View>
  );
}

// Bir nechtadan bittasini tanlash: [{ id, label }], value, onChange(id)
export function Segmented({ options, value, onChange, disabled = false }) {
  return (
    <View style={styles.segmented} role="tablist">
      {options.map((option) => {
        const on = option.id === value;
        return (
          <Pressable
            key={option.id}
            role="tab"
            aria-selected={on}
            aria-disabled={disabled}
            disabled={disabled}
            onPress={() => onChange(option.id)}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const Hint = ({ children, style }) => <Text style={[styles.hint, style]}>{children}</Text>;

export const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  link: { minHeight: 40, paddingHorizontal: space.sm },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  primaryText: { color: colors.accentText },
  secondaryText: { color: colors.accent },
  dangerText: { color: colors.error },
  linkText: { color: colors.accent, fontWeight: "500" },
  card: { backgroundColor: colors.card, borderRadius: radius, padding: space.lg },
  notice: { gap: space.sm },
  noticeTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  noticeText: { fontSize: 15, lineHeight: 21, color: colors.text },
  noticeAction: { marginTop: space.sm, gap: space.sm },
  spinner: { padding: space.xl, alignItems: "center", gap: space.md },
  hint: { fontSize: 14, lineHeight: 19, color: colors.hint },
  segmented: { flexDirection: "row", backgroundColor: colors.line, borderRadius: 10, padding: 2 },
  segment: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8, alignItems: "center" },
  segmentOn: { backgroundColor: colors.card },
  segmentText: { fontSize: 14, color: colors.text },
  segmentTextOn: { fontWeight: "700", color: colors.accent },
});
