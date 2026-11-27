// «🎛 Filtr» — botdagi «🎛 Filtr» oynasining ilova ko'rinishi: qaysi e'lonlar kelsin.
//   📥 Manba: 🌐 Hamma guruhlar yoki 📌 Faqat tanlangan guruhlar (ro'yxat — GroupPicker)
//   🚚 Mashina turi va 📍 Yuk qayerdan ketsin — kamida 1 ta shart («✓ Hammasi» bor); tanlanmasa «Saqlash» da bo'lim
//   qizil chegara bilan «Iltimos, kamida 1 ta tanlang» deydi va ekran o'sha bo'limga suriladi (filterForm.js filterErrors)
// «💾 Saqlash» → PUT /pub/me/profile (bot ham darhol shu bo'yicha yuboradi) → «📋 Yuklar» ga qaytadi.
// Faqat haydovchi uchun (yuk beruvchida bu tab yashirin).
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { REGIONS, TRUCK_FILTERS } from "@yuk/shared";
import { saveProfile } from "../../../api.js";
import { GroupPicker } from "../../../components/GroupPicker.js";
import { showError } from "../../../components/settingsUi.js";
import {
  allRegions,
  allTrucks,
  filterChanged,
  filterErrors,
  filterFromProfile,
  profileFromFilter,
  setMode,
  toggleAllRegions,
  toggleAllSources,
  toggleAllTrucks,
  toggleRegion,
  toggleSource,
  toggleTruck,
} from "../../../filterForm.js";
import { useSession } from "../../../session.js";
import { colors, radius, space, themed } from "../../../theme.js";
import { toast } from "../../../toast.js";
import { Button, CheckRow, Chip, Hint } from "../../../ui.js";

// Qisqa nomlar (botdagidek): «Qoraqalpog'iston Respublikasi» → «Qoraqalpog'iston», «Xorij (…)» → «Chet el»
const regionName = (r) => (r.id === "xorij" ? "Chet el" : r.name.replace(/ (viloyati|Respublikasi)$/, ""));

// error — qizil chegara va matn (bo'limda hech narsa tanlanmagan)
function Block({ icon, title, hint, error, onLayout, children }) {
  return (
    <View style={[styles.block, error && styles.blockError]} onLayout={onLayout}>
      <Text style={styles.blockTitle}>
        {icon} {title}
      </Text>
      {hint ? <Hint>{hint}</Hint> : null}
      {children}
      {error ? (
        <Text style={styles.errorText} role="alert">
          ⚠️ {error}
        </Text>
      ) : null}
    </View>
  );
}

export default function FilterScreen() {
  const { me, setMe } = useSession();
  const profile = me.profile;
  const [form, setForm] = useState(() => filterFromProfile(profile));
  const [busy, setBusy] = useState(false);
  const changed = filterChanged(form, profile);
  const first = !profile; // hali hech qachon saqlanmagan — «Saqlash» doim yoqiq
  const [tried, setTried] = useState(false); // «Saqlash» bosildi — endi xatolar ko'rinadi (tanlangan zahoti yo'qoladi)
  const errors = tried ? filterErrors(form) : {};
  const scroll = useRef(null);
  const blockY = useRef({});

  const pickSource = (name) => {
    const result = toggleSource(form, name, me.plan);
    if (result.error) toast(result.error);
    else setForm(result.form);
  };

  async function save() {
    const result = profileFromFilter(form, profile);
    if (result.error) {
      setTried(true);
      toast(result.error);
      const key = result.errors?.trucks ? "trucks" : result.errors?.regions ? "regions" : null;
      if (key) scroll.current?.scrollTo({ y: Math.max(0, (blockY.current[key] ?? 0) - space.md), animated: true });
      return;
    }
    setBusy(true);
    try {
      const next = await saveProfile(result.profile, "haydovchi");
      setMe(next);
      setForm(filterFromProfile(next.profile));
      toast(result.note ?? "✅ Saqlandi — mos e'lonlar shu bo'yicha keladi");
      router.navigate("/");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        {first ? (
          <View style={styles.lead}>
            <Text style={styles.leadTitle}>👋 Qanday yuklar kerak?</Text>
            <Text style={styles.leadText}>Belgilang va «Saqlash» ni bosing — mos e'lonlar shu yerda va botda chiqadi.</Text>
          </View>
        ) : null}

        <Block icon="📥" title="Qaysi guruhlardan?">
          <CheckRow
            radio
            title="🌐 Hamma guruhlar"
            sub="Hamma guruhlardagi yuk e'lonlari — darhol"
            on={form.mode === "tezkor"}
            onPress={() => setForm(setMode(form, "tezkor"))}
          />
          <CheckRow
            radio
            title="📌 Faqat tanlangan guruhlar"
            sub="Faqat siz belgilagan guruh va kanallardan"
            on={form.mode === "guruhlarim"}
            onPress={() => setForm(setMode(form, "guruhlarim"))}
          />
        </Block>

        {form.mode === "guruhlarim" ? (
          <Block icon="📌" title="Guruhlar">
            <GroupPicker form={form} max={me.maxSources ?? null} onToggle={pickSource} onToggleAll={(names) => setForm(toggleAllSources(form, names, me.plan))} />
          </Block>
        ) : null}

        <Block icon="🚚" title="Mashinangiz qaysi?" hint="Kamida bittasini tanlang." error={errors.trucks} onLayout={(e) => (blockY.current.trucks = e.nativeEvent.layout.y)}>
          <View style={styles.chips}>
            <Chip label="Hammasi" on={allTrucks(form)} onPress={() => setForm(toggleAllTrucks(form))} />
            {TRUCK_FILTERS.map((t) => (
              <Chip key={t.id} label={`${t.icon} ${t.name}`} on={form.trucks.includes(t.id)} onPress={() => setForm(toggleTruck(form, t.id))} />
            ))}
          </View>
        </Block>

        <Block
          icon="📍"
          title="Yuk qayerdan ketsin?"
          hint="Kamida bittasini tanlang. «Hammasi» — joyi yozilmagan e'lonlar ham keladi."
          error={errors.regions}
          onLayout={(e) => (blockY.current.regions = e.nativeEvent.layout.y)}
        >
          <View style={styles.chips}>
            <Chip label="Hammasi" on={allRegions(form)} onPress={() => setForm(toggleAllRegions(form))} />
            {REGIONS.map((r) => (
              <Chip key={r.id} label={regionName(r)} on={form.regions.includes(r.id)} onPress={() => setForm(toggleRegion(form, r.id))} />
            ))}
          </View>
        </Block>
      </ScrollView>

      <View style={styles.footer}>
        <Button title={changed || first ? "💾 Saqlash" : "✓ Saqlangan"} onPress={save} busy={busy} disabled={!changed && !first} />
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  lead: { backgroundColor: colors.accent, borderRadius: radius + 4, padding: space.lg, gap: 4 },
  leadTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  leadText: { fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.92)" },
  block: { backgroundColor: colors.card, borderRadius: radius + 4, padding: space.lg, gap: space.sm, borderWidth: 1.5, borderColor: "transparent" },
  blockError: { borderColor: colors.error },
  blockTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  errorText: { fontSize: 14, fontWeight: "600", color: colors.error },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: 4 },
  footer: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  }),
);
