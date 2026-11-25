// «📝 E'lon berish» — chat (Azimjon, 2026-11-25: «E'lon berish chat bo'lsin … bot qanday ishlayotgan bo'lsa qarab ko'r»).
// Botdagi «📦 Yuk berish» bilan bir xil yo'l (server loadChat.js):
//   yukingizni oddiy yozasiz → server tushunadi → raqam yo'q bo'lsa so'raydi (oldingi raqamlaringiz tugma) →
//   «haydovchilarga shunday boradi» kartasi + [✅ Yuborish] [❌ Bekor qilish] → navbat → natija («N ta haydovchiga yuborildi»).
// Ilovada rol yo'q — e'lonni har kim beradi (2026-11-25). Yozib yoki 🎤 ovoz bilan (ilova yozib oladi → server Gemini bilan
// matnga o'giradi → shu yo'l). Tepada «Qanday yozish / aytish» namunasi (Azimjon: «e'lonni oson olishimiz kerak … E'lon
// beruvchiga qulaylik kerak»). Qoralama serverda: botda boshlangani shu yerda ham davom etadi. Suhbat xotirada (modul darajasida) — boshqa bo'limga o'tib qaytsa ham turadi, ilova yopilsa — tozalanadi.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { File, UploadType } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cancelLoad, confirmLoad, getLoadChat, getLoadResult, pickLoadPhone, readUpload, sendLoadText, uploadHeaders } from "../api.js";
import { useSession } from "../session.js";
import { toast } from "../toast.js";
import { colors, radius, space, themed } from "../theme.js";
import { Button } from "../ui.js";

const POLL_MS = 3_000; // yuborilgan yuk natijasini so'rash oralig'i
const POLL_MAX = 40; // ~2 daqiqa
const VOICE_MAX_MS = 120_000; // ovoz ko'pi bilan 2 daqiqa
const VOICE_MIN_MS = 1_500;
// Ovoz: AAC (ADTS) mono 16 kHz — kichik fayl (~4 KB/s), Gemini «audio/aac» ni o'qiydi
const VOICE_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: ".aac",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: { extension: ".aac", outputFormat: "aac_adts", audioEncoder: "aac", sampleRate: 16000 },
};

// Tepadagi namuna: nima yozish / nima aytish (eng muhimi — qayerdan, qayerga, nima, necha tonna, raqam)
const GUIDE = [
  ["📍", "Qayerdan → qayerga", "Andijondan Toshkentga"],
  ["📦", "Nima yuk, necha tonna", "20 tonna un"],
  ["🚚", "Qanday mashina", "tent fura"],
  ["💰", "Narxi, qachon", "3 mln, ertaga"],
  ["📞", "Telefon", "90 123 45 67"],
];
const SAY = "«Andijondan Toshkentga 20 tonna un bor, tent fura kerak, 3 million, ertaga. Telefon 90 123 45 67»";

// Suhbat xabarlari: { id, from: "bot" | "me", text, cards?, stage?, phones?, done? (tugmalari ishlatildi) }
let saved = { chatId: null, items: [] };
let nextId = 1;
const msg = (from, text, extra = {}) => ({ id: nextId++, from, text, ...extra });

export function LoadChat() {
  const { me } = useSession();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(() => (saved.chatId === me?.chatId ? saved.items : []));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false); // server javobini kutyapmiz
  const [quota, setQuota] = useState(null); // { used, limit }
  const listRef = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    saved = { chatId: me?.chatId, items };
  }, [items, me?.chatId]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const add = useCallback((...more) => setItems((list) => [...list, ...more]), []);
  // Oxirgi bot xabarining tugmalari ishlatildi — qayta bosilmasin
  const closeButtons = useCallback(() => setItems((list) => list.map((item) => (item.stage ? { ...item, done: true } : item))), []);
  const botView = (view) => msg("bot", view.text, { cards: view.cards, stage: view.stage, phones: view.phones });

  // Birinchi ochilish: salomlashish + (bo'lsa) tugallanmagan qoralama
  useEffect(() => {
    if (items.length) return;
    getLoadChat()
      .then((data) => {
        if (!alive.current) return;
        setQuota({ used: data.used, limit: data.limit });
        add(msg("bot", data.intro), ...(data.view ? [botView(data.view)] : []));
      })
      .catch((error) => add(msg("bot", `⚠️ ${error.message}`)));
    // faqat bir marta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Yuborilgan yuk natijasini kutish (bot ishchisi bir necha soniyada yuboradi)
  const waitResult = useCallback(
    async (id) => {
      for (let i = 0; i < POLL_MAX && alive.current; i++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        const result = await getLoadResult(id).catch(() => null);
        if (result?.done) {
          if (alive.current) add(msg("bot", result.text));
          return;
        }
      }
    },
    [add],
  );

  const run = async (job) => {
    if (busy) return;
    setBusy(true);
    try {
      await job();
    } catch (error) {
      add(msg("bot", `⚠️ ${error.message}`));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const send = () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    closeButtons();
    add(msg("me", value));
    run(async () => add(botView(await sendLoadText(value))));
  };
  const choosePhone = (phone) => {
    closeButtons();
    add(msg("me", phone.label));
    run(async () => add(botView(await pickLoadPhone(phone.phone))));
  };
  const confirm = () => {
    closeButtons();
    add(msg("me", "✅ Yuborish"));
    run(async () => {
      const sent = await confirmLoad();
      add(msg("bot", sent.text));
      setQuota((q) => (q ? { ...q, used: q.used + 1 } : q));
      waitResult(sent.id);
    });
  };
  const cancel = () => {
    closeButtons();
    add(msg("me", "❌ Bekor qilish"));
    run(async () => add(msg("bot", (await cancelLoad()).text)));
  };

  // --- 🎤 Ovoz ---
  const recorder = useAudioRecorder(VOICE_OPTIONS);
  const rec = useAudioRecorderState(recorder, 200);
  const recording = rec.isRecording;
  const startVoice = async () => {
    if (busy || recording) return;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          toast("Mikrofonga ruxsat yo'q — sozlamalardan yoqing");
          Linking.openSettings().catch(() => {});
        } else toast("Ovoz yozish uchun mikrofonga ruxsat bering");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      toast("Ovoz yozib bo'lmadi — yozib yuboring");
    }
  };
  const stopRecorder = async () => {
    await recorder.stop().catch(() => {});
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    return recorder.uri;
  };
  const cancelVoice = async () => {
    await stopRecorder();
    toast("🗑 Ovoz bekor qilindi");
  };
  const sendVoice = async () => {
    const ms = rec.durationMillis;
    const uri = await stopRecorder();
    if (!uri || ms < VOICE_MIN_MS) {
      toast("Juda qisqa — tugmani bosib, yukingizni aytib bering");
      return;
    }
    closeButtons();
    const seconds = Math.round(ms / 1000);
    run(async () => {
      const { url, headers } = uploadHeaders("audio/aac");
      const result = readUpload(await new File(uri).upload(url, { httpMethod: "POST", uploadType: UploadType.BINARY_CONTENT, headers }));
      add(msg("me", `🎤 ${seconds} s\n«${result.transcript}»`), botView(result.view));
    });
  };
  // 2 daqiqadan oshsa — o'zi yuboriladi
  useEffect(() => {
    if (!recording || rec.durationMillis < VOICE_MAX_MS) return undefined;
    const timer = setTimeout(sendVoice, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, rec.durationMillis]);

  const data = busy ? [...items, { id: "typing", from: "bot", typing: true }] : items;
  const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

  return (
    <KeyboardAvoidingView style={styles.page} behavior="padding" keyboardVerticalOffset={insets.top + 56}>
      <FlatList
        ref={listRef}
        style={styles.page}
        contentContainerStyle={styles.list}
        data={data}
        keyExtractor={(item) => String(item.id)}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={<Guide />}
        renderItem={({ item }) => <Bubble item={item} onPhone={choosePhone} onConfirm={confirm} onCancel={cancel} busy={busy} />}
        keyboardShouldPersistTaps="handled"
      />
      {quota ? <Text style={styles.quota}>24 soatda {quota.used} / {quota.limit} ta yuk</Text> : null}
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        {recording ? (
          <>
            <Pressable role="button" aria-label="Bekor qilish" onPress={cancelVoice} style={({ pressed }) => [styles.roundBtn, styles.trashBtn, pressed && styles.pressed]}>
              <Text style={styles.sendIcon}>🗑</Text>
            </Pressable>
            <View style={styles.recBox}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>
                {clock(rec.durationMillis)} · Gapiring… tugatgach ➤ ni bosing
              </Text>
            </View>
            <Pressable role="button" aria-label="Ovozni yuborish" onPress={sendVoice} style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}>
              <Text style={styles.sendIcon}>➤</Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Yukingizni yozing yoki 🎤 bosib ayting…"
              placeholderTextColor={colors.hint}
              multiline
              maxLength={3000}
              editable={!busy}
            />
            {text.trim() ? (
              <Pressable role="button" aria-label="Yuborish" onPress={send} disabled={busy} style={({ pressed }) => [styles.roundBtn, busy && styles.sendOff, pressed && styles.pressed]}>
                <Text style={styles.sendIcon}>➤</Text>
              </Pressable>
            ) : (
              <Pressable role="button" aria-label="Ovoz yozish" onPress={startVoice} disabled={busy} style={({ pressed }) => [styles.roundBtn, busy && styles.sendOff, pressed && styles.pressed]}>
                <Text style={styles.sendIcon}>🎤</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// Tepadagi namuna (yopib-ochsa bo'ladi): nima yozish va nima aytish
function Guide() {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.guide}>
      <Pressable role="button" onPress={() => setOpen((v) => !v)} style={styles.guideHead}>
        <Text style={styles.guideTitle}>💡 E'lonni qanday berish kerak?</Text>
        <Text style={styles.guideToggle}>{open ? "Yopish ▲" : "Ochish ▼"}</Text>
      </Pressable>
      {open ? (
        <>
          <Text style={styles.guideSub}>✍️ Yozing — shu narsalarni bitta xabarda:</Text>
          {GUIDE.map(([icon, what, sample]) => (
            <View key={what} style={styles.guideRow}>
              <Text style={styles.guideIcon}>{icon}</Text>
              <Text style={styles.guideText}>
                <Text style={styles.bold}>{what}</Text> — {sample}
              </Text>
            </View>
          ))}
          <Text style={styles.guideSub}>🎤 Yoki mikrofonni bosib, shunday ayting:</Text>
          <Text style={styles.guideSay}>{SAY}</Text>
          <Text style={styles.guideNote}>Raqamni aytmasangiz — keyin so'raymiz. Yuborishdan oldin haydovchilarga qanday borishini ko'rasiz.</Text>
        </>
      ) : null}
    </View>
  );
}

function Bubble({ item, onPhone, onConfirm, onCancel, busy }) {
  const mine = item.from === "me";
  if (item.typing) {
    return (
      <View style={[styles.bubble, styles.bot, styles.typing]}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.hintText}>Tushunyapman…</Text>
      </View>
    );
  }
  const open = item.stage && !item.done;
  return (
    <View style={[styles.bubble, mine ? styles.me : styles.bot]}>
      <Text style={[styles.text, mine && styles.meText]} selectable>
        {item.text}
      </Text>
      {item.cards?.map((lines, i) => (
        <View key={i} style={styles.card}>
          {lines.map((line, j) => (
            <Text key={j} style={[styles.cardLine, j === 0 && styles.cardHead]} selectable>
              {j === 0 ? "📍 " : ""}
              {line}
            </Text>
          ))}
        </View>
      ))}
      {open && item.stage === "confirm" ? (
        <View style={styles.actions}>
          <Button title="✅ Yuborish" onPress={onConfirm} disabled={busy} />
          <Button title="❌ Bekor qilish" kind="secondary" onPress={onCancel} disabled={busy} />
        </View>
      ) : null}
      {open && item.stage === "phone" ? (
        <View style={styles.actions}>
          {item.phones?.map((phone) => (
            <Button key={phone.phone} title={`📞 ${phone.label}`} kind="secondary" onPress={() => onPhone(phone)} disabled={busy} />
          ))}
          <Button title="❌ Bekor qilish" kind="link" onPress={onCancel} disabled={busy} />
        </View>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    list: { padding: space.md, gap: space.sm },
    bubble: { maxWidth: "88%", borderRadius: radius + 2, paddingVertical: space.sm, paddingHorizontal: space.md, gap: space.sm },
    bot: { alignSelf: "flex-start", backgroundColor: colors.card, borderTopLeftRadius: 4 },
    me: { alignSelf: "flex-end", backgroundColor: colors.accent, borderTopRightRadius: 4 },
    typing: { flexDirection: "row", alignItems: "center", gap: space.sm },
    text: { fontSize: 15, lineHeight: 21, color: colors.text },
    meText: { color: colors.accentText },
    hintText: { fontSize: 14, color: colors.hint },
    card: { backgroundColor: colors.soft, borderRadius: radius, padding: space.md, gap: 4 },
    cardHead: { fontWeight: "700" },
    cardLine: { fontSize: 14, lineHeight: 20, color: colors.text },
    actions: { gap: space.sm },
    quota: { fontSize: 12, color: colors.hint, textAlign: "center", paddingVertical: 2 },
    bar: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: space.sm,
      paddingHorizontal: space.md,
      paddingTop: space.sm,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 140,
      borderRadius: 22,
      paddingHorizontal: space.lg,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.bg,
    },
    roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    trashBtn: { backgroundColor: colors.error },
    recBox: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, borderRadius: 22, backgroundColor: colors.bg },
    recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
    recText: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "600" },
    guide: { backgroundColor: colors.card, borderRadius: radius + 2, padding: space.md, gap: 6, marginBottom: space.sm, borderWidth: 1, borderColor: colors.barBorder },
    guideHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    guideTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    guideToggle: { fontSize: 13, color: colors.accent, fontWeight: "600" },
    guideSub: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 4 },
    guideRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
    guideIcon: { fontSize: 15, width: 22 },
    guideText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
    guideSay: { fontSize: 14, lineHeight: 20, color: colors.text, fontStyle: "italic", backgroundColor: colors.soft, borderRadius: radius, padding: space.sm },
    guideNote: { fontSize: 13, lineHeight: 18, color: colors.hint },
    bold: { fontWeight: "700" },
    sendOff: { opacity: 0.4 },
    sendIcon: { color: colors.accentText, fontSize: 20, fontWeight: "700" },
    pressed: { opacity: 0.6 },
  }),
);
