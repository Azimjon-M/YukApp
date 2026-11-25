// Majburiy yangilash oynasi (appUpdate.js): serverda yangiroq versiya bo'lsa — butun ilova ustidan, yopib bo'lmaydi
// («orqaga» ham yopmaydi). «Yangilash» → APK ilovaning kesh papkasiga yuklanadi → Android o'rnatish oynasi (foydalanuvchi
// «O'rnatish» ni bosadi — Play Store'siz buni o'zi qilib bo'lmaydi). Birinchi marta Android «noma'lum manbadan o'rnatish»
// ruxsatini so'raydi (app.json REQUEST_INSTALL_PACKAGES). Ilova ichida yuklab bo'lmasa — brauzerda ochiladi.
// Tekshiruv: ilova ochilganda, ilovaga qaytganda va server 426 «update» qaytarganda.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, Linking, Modal, Platform, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { Directory, File, Paths } from "expo-file-system";
import { getContentUriAsync } from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { API_URL, getAppRelease } from "../api.js";
import { isOutdated, setLatest, sizeText, useAppUpdate } from "../appUpdate.js";
import { colors, radius, space, themed } from "../theme.js";
import { Button } from "../ui.js";

const OWN = Platform.OS === "android" ? Number(Constants.expoConfig?.android?.versionCode) || null : null;
const APK_TYPE = "application/vnd.android.package-archive";
const GRANT_READ = 1; // Intent.FLAG_GRANT_READ_URI_PERMISSION — o'rnatuvchi faylni o'qiy olsin

async function install(latest) {
  const dir = new Directory(Paths.cache, "apk");
  dir.create({ idempotent: true, intermediates: true });
  const file = new File(dir, `yuk-ekspert-${latest.version}.apk`);
  const downloaded = await File.downloadFileAsync(`${API_URL}${latest.url}`, file, { idempotent: true });
  const uri = await getContentUriAsync(downloaded.uri);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", { data: uri, type: APK_TYPE, flags: GRANT_READ });
}

export function UpdateGate() {
  const { latest, stale } = useAppUpdate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const check = useCallback(() => {
    if (!OWN) return;
    getAppRelease()
      .then((data) => setLatest(data?.android ?? null))
      .catch(() => {}); // internet yo'q — keyingi safar
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (next) => next === "active" && check());
    return () => sub.remove();
  }, [check]);
  // Server «eski versiya» dedi — eng so'nggisini so'raymiz (oyna o'shanda chiqadi)
  useEffect(() => {
    if (stale) check();
  }, [stale, check]);

  if (!isOutdated(OWN, latest)) return null;

  const update = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await install(latest);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const browser = () => Linking.openURL(`${API_URL}${latest.url}`).catch(() => {});

  return (
    <Modal transparent={false} animationType="fade" visible onRequestClose={() => {}}>
      <View style={styles.page}>
        <View style={styles.box}>
          <Text style={styles.icon}>📲</Text>
          <Text style={styles.title}>Yangi versiya chiqdi</Text>
          <Text style={styles.text}>
            Davom etish uchun ilovani yangilang — eski versiya endi ishlamaydi. Yangi versiya eskisining ustidan o'rnatiladi,
            hisobingiz va sozlamalaringiz saqlanadi.
          </Text>
          <Text style={styles.version}>
            Versiya {latest.version}
            {latest.size ? ` · ${sizeText(latest.size)}` : ""}
          </Text>
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.text}>Yuklanmoqda…</Text>
            </View>
          ) : (
            <Button title="⬇️ Yangilash" onPress={update} />
          )}
          {failed ? (
            <>
              <Text style={styles.error}>Ilova ichida yuklab bo'lmadi. Brauzer orqali yuklab, faylni oching.</Text>
              <Button title="🌐 Brauzerda yuklab olish" kind="secondary" onPress={browser} />
            </>
          ) : null}
          <Text style={styles.hint}>Telefon «noma'lum manbadan o'rnatish» ga ruxsat so'rasa — ruxsat bering, keyin «O'rnatish» ni bosing.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: space.lg },
    box: { backgroundColor: colors.card, borderRadius: radius + 4, padding: space.xl, gap: space.md, alignItems: "stretch" },
    icon: { fontSize: 44, textAlign: "center" },
    title: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center" },
    text: { fontSize: 15, lineHeight: 21, color: colors.text, textAlign: "center" },
    version: { fontSize: 14, color: colors.hint, textAlign: "center", fontWeight: "600" },
    busy: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, paddingVertical: space.md },
    error: { fontSize: 14, color: colors.error, textAlign: "center" },
    hint: { fontSize: 13, lineHeight: 18, color: colors.hint, textAlign: "center" },
  }),
);
