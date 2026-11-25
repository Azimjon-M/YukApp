// «📝 E'lon berish» — chat (Azimjon, 2026-11-25: «E'lon berish chat bo'lsin … bot qanday ishlayotgan bo'lsa qarab ko'r»).
// Botdagi «📦 Yuk berish» bilan bir xil yo'l (server loadChat.js):
//   yukingizni oddiy yozasiz → server tushunadi → raqam yo'q bo'lsa so'raydi (oldingi raqamlaringiz tugma) →
//   «haydovchilarga shunday boradi» kartasi + [✅ Yuborish] [❌ Bekor qilish] → navbat → natija («N ta haydovchiga yuborildi»).
// Faqat yuk beruvchi uchun (haydovchiga — rolni almashtirish taklifi). Qoralama serverda: botda boshlangani shu yerda ham
// davom etadi. Suhbat xotirada (modul darajasida) — boshqa bo'limga o'tib qaytsa ham turadi, ilova yopilsa — tozalanadi.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cancelLoad, confirmLoad, getLoadChat, getLoadResult, pickLoadPhone, sendLoadText } from "../api.js";
import { useSession } from "../session.js";
import { colors, radius, space, themed } from "../theme.js";
import { Button, Notice } from "../ui.js";

const POLL_MS = 3_000; // yuborilgan yuk natijasini so'rash oralig'i
const POLL_MAX = 40; // ~2 daqiqa

// Suhbat xabarlari: { id, from: "bot" | "me", text, cards?, stage?, phones?, done? (tugmalari ishlatildi) }
let saved = { chatId: null, items: [] };
let nextId = 1;
const msg = (from, text, extra = {}) => ({ id: nextId++, from, text, ...extra });

export function LoadChat() {
  const { me } = useSession();
  const insets = useSafeAreaInsets();
  const shipper = me?.role === "yuk_beruvchi";
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
    if (!shipper || items.length) return;
    getLoadChat()
      .then((data) => {
        if (!alive.current) return;
        setQuota({ used: data.used, limit: data.limit });
        add(msg("bot", data.intro), ...(data.view ? [botView(data.view)] : []));
      })
      .catch((error) => add(msg("bot", `⚠️ ${error.message}`)));
    // faqat bir marta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipper]);

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

  if (!shipper) {
    return (
      <View style={[styles.page, styles.pad]}>
        <Notice title="📝 E'lon berish — yuk beruvchilar uchun" action={<Button title="🔄 Rolni almashtirish" onPress={() => router.push("/rol")} />}>
          Yukingiz bo'lsa va unga mashina kerak bo'lsa — rolni «📦 Yuk beruvchi» ga almashtiring. Keyin yukingizni shu yerga oddiy
          yozasiz, mos haydovchilar o'zlari qo'ng'iroq qiladi.
        </Notice>
      </View>
    );
  }

  const data = busy ? [...items, { id: "typing", from: "bot", typing: true }] : items;

  return (
    <KeyboardAvoidingView style={styles.page} behavior="padding" keyboardVerticalOffset={insets.top + 56}>
      <FlatList
        ref={listRef}
        style={styles.page}
        contentContainerStyle={styles.list}
        data={data}
        keyExtractor={(item) => String(item.id)}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => <Bubble item={item} onPhone={choosePhone} onConfirm={confirm} onCancel={cancel} busy={busy} />}
        keyboardShouldPersistTaps="handled"
      />
      {quota ? <Text style={styles.quota}>24 soatda {quota.used} / {quota.limit} ta yuk</Text> : null}
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Yukingizni yozing…"
          placeholderTextColor={colors.hint}
          multiline
          maxLength={3000}
        />
        <Pressable
          role="button"
          aria-label="Yuborish"
          onPress={send}
          disabled={busy || !text.trim()}
          style={({ pressed }) => [styles.sendBtn, (busy || !text.trim()) && styles.sendOff, pressed && styles.pressed]}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
    pad: { padding: space.md },
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
    sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    sendOff: { opacity: 0.4 },
    sendIcon: { color: colors.accentText, fontSize: 20, fontWeight: "700" },
    pressed: { opacity: 0.6 },
  }),
);
