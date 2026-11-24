// «📌 Qaysi guruhlardan?» — botdagi guruh tanlash ro'yxati (GET /pub/me/feed-sources): 🌐 ochiq va 🔒 yopiq guruhlar
// alohida (yopig'i faqat Pro'ga ko'rinadi), eng faoli tepada, har birida oxirgi 24 soatdagi e'lonlar soni.
// «☑️ Hammasini tanlash», qidiruv (kirill/lotin farqisiz — shared foldText), 20 tadan ko'rsatiladi («Yana ko'rsatish»).
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { foldText } from "@yuk/shared";
import { getFeedSources } from "../api.js";
import { hasSource } from "../filterForm.js";
import { colors, radius, space, themed } from "../theme.js";
import { Button, CheckRow, Hint, Segmented, Spinner } from "../ui.js";

const PAGE = 20;
const SEARCH_FROM = 12;
const perDayText = (n) => (n > 0 ? `${n} ta e'lon/kun` : "kam e'lon");

// list — serverdagi ro'yxat; chosen — tanlanganlar (ro'yxatda yo'q bo'lsa ham ko'rinsin)
function groupOptions(list, chosen) {
  const known = new Set(list.map((s) => s.name.toLowerCase()));
  const extra = chosen
    .filter((name) => !known.has(name.toLowerCase()))
    .map((name) => ({ name, title: null, perDay: null, closed: !name.startsWith("@"), locked: false }));
  return [...extra, ...list]
    .filter((s) => !s.locked)
    .map((s) => ({
      id: s.name,
      title: s.title ?? s.name,
      // Yopiq guruhning raqamli id'si odamga hech narsa demaydi — ko'rsatilmaydi
      sub: [s.title && !s.closed ? s.name : null, s.mine ? "siz qo'shgansiz" : null, s.perDay == null ? null : perDayText(s.perDay)]
        .filter(Boolean)
        .join(" · "),
      search: foldText(`${s.title ?? ""} ${s.name}`),
      closed: Boolean(s.closed),
    }));
}

// form — filtr formasi (filterForm.js); onToggle(name), onToggleAll(names)
export function GroupPicker({ form, onToggle, onToggleAll }) {
  const [state, setState] = useState({ list: [], loading: true, error: null, attempt: 0 });
  const [tab, setTab] = useState("open");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    let alive = true;
    getFeedSources().then(
      (data) => alive && setState((s) => ({ ...s, list: data.sources ?? [], loading: false, error: null })),
      (error) => alive && setState((s) => ({ ...s, loading: false, error })),
    );
    return () => {
      alive = false;
    };
  }, [state.attempt]);

  const options = useMemo(() => groupOptions(state.list, form.sources), [state.list, form.sources]);
  const closedCount = options.filter((o) => o.closed).length;
  const current = tab === "closed" && closedCount ? "closed" : "open";
  const inTab = options.filter((o) => (current === "closed") === o.closed);
  const query = foldText(q.trim());
  const shown = query ? inTab.filter((o) => o.search.includes(query)) : inTab;
  const picked = (closed) => options.filter((o) => o.closed === closed && hasSource(form, o.id)).length;
  const names = inTab.map((o) => o.id);
  const allOn = names.length > 0 && names.every((name) => hasSource(form, name));

  if (state.loading) return <Spinner label="Guruhlar ochilyapti..." />;
  if (state.error) {
    return (
      <View style={styles.gap}>
        <Hint>Ro'yxat ochilmadi: {state.error.message}</Hint>
        <Button title="Qayta urinish" kind="secondary" onPress={() => setState((s) => ({ ...s, loading: true, attempt: s.attempt + 1 }))} />
      </View>
    );
  }

  return (
    <View style={styles.gap}>
      <Text style={styles.count}>Tanlangan: {form.sources.length} ta guruh</Text>
      {closedCount > 0 ? (
        <Segmented
          options={[
            { id: "open", label: `🌐 Ochiq · ${options.length - closedCount}${picked(false) ? ` ✓${picked(false)}` : ""}` },
            { id: "closed", label: `🔒 Yopiq · ${closedCount}${picked(true) ? ` ✓${picked(true)}` : ""}` },
          ]}
          value={current}
          onChange={(id) => {
            setTab(id);
            setLimit(PAGE);
          }}
        />
      ) : null}
      {inTab.length > SEARCH_FROM ? (
        <TextInput
          style={styles.search}
          placeholder="🔍 Guruh nomi yoki @username"
          placeholderTextColor={colors.hint}
          value={q}
          onChangeText={(text) => {
            setQ(text);
            setLimit(PAGE);
          }}
          autoCorrect={false}
          autoCapitalize="none"
        />
      ) : null}
      {!query && names.length > 1 ? (
        <CheckRow
          title={allOn ? "Hammasini olib tashlash" : `Hammasini tanlash (${names.length} ta)`}
          on={allOn}
          onPress={() => onToggleAll(names)}
        />
      ) : null}
      {shown.length ? (
        shown.slice(0, limit).map((o) => (
          <CheckRow key={o.id} title={o.title} sub={o.sub} on={hasSource(form, o.id)} onPress={() => onToggle(o.id)} />
        ))
      ) : (
        <Hint>{query ? "Bunday guruh topilmadi." : "Hozircha tanlasa bo'ladigan guruh yo'q."}</Hint>
      )}
      {shown.length > limit ? (
        <Button title={`Yana ko'rsatish (${shown.length - limit} ta qoldi)`} kind="secondary" onPress={() => setLimit((n) => n + PAGE)} />
      ) : null}
      <Hint>Ro'yxatda yo'q guruhni botdagi «➕ Guruh qo'shish» bilan qo'shing.</Hint>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  gap: { gap: space.sm },
  count: { fontSize: 14, fontWeight: "700", color: colors.accent },
  search: {
    backgroundColor: colors.bg,
    borderRadius: radius,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  }),
);
