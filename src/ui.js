// Kichik umumiy qismlar: tugma, xabar oynasi, tanlov (segment), karta. Web'dagi ui.jsx ning ilova ko'rinishi.
// React Native'da <div>/<button> yo'q: View — quti, Text — matn (matn faqat <Text> ichida bo'ladi), Pressable — bosiladigan.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, space, themed } from "./theme.js";

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

// Belgilanadigan tugmacha (bir nechtasini tanlash): ✓ bilan ko'k ramka
export function Chip({ label, on, onPress, disabled = false }) {
  return (
    <Pressable
      role="checkbox"
      aria-checked={on}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
        {on ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
}

// Ro'yxat qatori: chapda belgi (☑ / ○), matn va ostida izoh. radio — bittasini tanlash (doira)
export function CheckRow({ title, sub, on, onPress, radio = false, disabled = false, right }) {
  return (
    <Pressable
      role={radio ? "radio" : "checkbox"}
      aria-checked={on}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.checkRow, on && styles.checkRowOn, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={[radio ? styles.radio : styles.box, on && styles.boxOn]}>
        {on ? radio ? <View style={styles.radioDot} /> : <Text style={styles.tick}>✓</Text> : null}
      </View>
      <View style={styles.checkText}>
        <Text style={[styles.checkTitle, on && styles.checkTitleOn]} numberOfLines={2}>
          {title}
        </Text>
        {sub ? <Text style={styles.checkSub} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {right ?? null}
    </Pressable>
  );
}

export const Hint = ({ children, style }) => <Text style={[styles.hint, style]}>{children}</Text>;

export const styles = themed(() =>
  StyleSheet.create({
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
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.soft },
  chipText: { fontSize: 15, color: colors.text },
  chipTextOn: { color: colors.accent, fontWeight: "700" },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  checkRowOn: { backgroundColor: colors.soft, borderColor: colors.accent },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.hint, alignItems: "center", justifyContent: "center" },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.hint, alignItems: "center", justifyContent: "center" },
  boxOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentText },
  tick: { color: colors.accentText, fontSize: 15, fontWeight: "800", marginTop: -1 },
  checkText: { flex: 1, gap: 2 },
  checkTitle: { fontSize: 16, color: colors.text, fontWeight: "500" },
  checkTitleOn: { fontWeight: "700" },
  checkSub: { fontSize: 13, color: colors.hint },
  }),
);
