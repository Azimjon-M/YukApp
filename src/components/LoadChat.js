// «📝 E'lon berish» — Telegram'dagidek chat (Azimjon, 2026-11-25: «chat mukammal telegram chatiga o'xshasin. qulaygina»).
// Botdagi «📦 Yuk berish» bilan bir xil yo'l (server loadChat.js): yukingizni yozasiz yoki 🎤 bosib turib aytasiz → server
// tushunadi (avval o'zimizning algoritm, kerak bo'lsa AI; ovozni Gemini matnga o'giradi) → raqam yo'q bo'lsa so'raydi →
// «haydovchilarga shunday boradi» kartasi + [✅ Yuborish] [❌ Bekor qilish] → navbat → natija («N ta haydovchiga yuborildi»).
// Suhbat SERVERDA saqlanadi (ovozli xabarlar ham): ilovani qayta o'rnatsa yoki boshqa telefondan kirsa — hammasi joyida,
// ovozni bosib eshitadi. Ilova ichida tezlik uchun oxirgi holat xotirada ham turadi.
// 🎤: bosib turing — yoziladi, qo'yib yuborsangiz — ketadi; chapga suring — bekor; tepaga suring — qulf (qo'lsiz yozish).
// Ilovada rol yo'q — e'lonni har kim beradi.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File, UploadType } from "expo-file-system";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cancelLoad, confirmLoad, getLoadChat, pickLoadPhone, readUpload, sendLoadText, voiceSource, voiceUpload } from "../api.js";
import { useSession } from "../session.js";
import { toast } from "../toast.js";
import { colors, radius, space, themed } from "../theme.js";
import { Button } from "../ui.js";

const POLL_MS = 3_000; // yuborilgan yuk natijasini kutish
const POLL_FOR_MS = 3 * 60_000;
const VOICE_MAX_MS = 120_000; // ovoz ko'pi bilan 2 daqiqa
const VOICE_MIN_MS = 3_000; // Azimjon: «audio jo'natishni minimum 3 sekund»
const CANCEL_DX = -90; // shuncha chapga sursa — bekor
const LOCK_DY = -80; // shuncha tepaga sursa — qulf
// Ovoz: AAC (ADTS) mono 16 kHz — kichik fayl (~4 KB/s), Gemini «audio/aac» ni o'qiydi
const VOICE_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: ".aac",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: { extension: ".aac", outputFormat: "aac_adts", audioEncoder: "aac", sampleRate: 16000 },
};

// Tepadagi namuna: nima yozish / nima aytish
const GUIDE = [
  ["📍", "Qayerdan → qayerga", "Andijondan Toshkentga"],
  ["📦", "Nima yuk, necha tonna", "20 tonna un"],
  ["🚚", "Qanday mashina", "tent fura"],
  ["💰", "Narxi, qachon", "3 mln, ertaga"],
  ["📞", "Telefon", "90 123 45 67"],
];
const SAY = "«Andijondan Toshkentga 20 tonna un bor, tent fura kerak, 3 million, ertaga. Telefon 90 123 45 67»";

const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const timeOf = (at) => (at ? new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "");

// Xotiradagi oxirgi holat (bo'limdan chiqib qaytsa darhol ko'rinadi; server baribir yangilaydi)
let memory = { chatId: null, messages: [], intro: "", quota: null };
let localId = 0;
const TYPING = { id: "typing", from: "bot", typing: true };

// Server xabarlarini ro'yxatga qo'shish: bir xil id — yangisi bilan almashadi; tugmalar faqat eng oxirgi faol savolda.
// Mening amalim (yozdim, bekor qildim, raqam berdim…) javobida — eski savollarning tugmalari darhol yo'qoladi (Azimjon,
// 2026-11-25: «bekor qilinsa formani yo'q qilib qo'y» — oldin boshqa sahifaga o'tib qaytgandagina yo'qolardi)
function merge(list, fresh) {
  const mineNow = fresh.some((m) => m.from === "me");
  const byId = new Map(list.map((m) => [m.id, mineNow && m.active ? { ...m, active: false } : m]));
  for (const m of fresh) byId.set(m.id, m);
  const all = [...byId.values()].sort((a, b) => (a.local || b.local ? (a.at ?? 0) - (b.at ?? 0) : a.id - b.id));
  const lastActive = [...all].reverse().find((m) => m.active)?.id;
  return all.map((m) => (m.active && m.id !== lastActive ? { ...m, active: false } : m));
}

export function LoadChat() {
  const { me } = useSession();
  const insets = useSafeAreaInsets();
  const own = memory.chatId === me?.chatId ? memory : { messages: [], intro: "", quota: null };
  const [messages, setMessages] = useState(own.messages);
  const [pending, setPending] = useState([]); // yuborilayotgan (server hali javob bermagan) xabarlarim
  const [intro, setIntro] = useState(own.intro);
  const [quota, setQuota] = useState(own.quota);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [waitUntil, setWaitUntil] = useState(0); // natija kutilyapti (shu vaqtgacha so'raymiz)
  const listRef = useRef(null);
  const alive = useRef(true);
  // 📌 Qo'llanma pin (Telegram'dagi «pinned message»): chat tepasidagi «E'lonni qanday berish kerak?» ko'rinmay qolsa
  // tepada 1 qator bo'lib turadi, bossa — chat boshiga qaytadi (Azimjon, 2026-11-25)
  const [guideOpen, setGuideOpen] = useState(true);
  const [pinned, setPinned] = useState(false);
  const metrics = useRef({ offset: 0, layout: 0, content: 0, guide: 0 });
  const checkPin = useCallback(() => {
    const { offset, layout, content, guide } = metrics.current;
    // Ro'yxat teskari: qo'llanma eng oxirida (ekranda eng tepada). Uning tepagacha qolgan masofa ≥ balandligi → ko'rinmaydi
    const fromTop = content - offset - layout;
    const hidden = guide > 0 && layout > 0 && fromTop > guide - 12;
    setPinned((v) => (v === hidden ? v : hidden));
  }, []);
  const onScroll = useCallback(
    (e) => {
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      metrics.current = { ...metrics.current, offset: contentOffset.y, layout: layoutMeasurement.height, content: contentSize.height };
      checkPin();
    },
    [checkPin],
  );
  const toGuide = () => {
    setGuideOpen(true);
    listRef.current?.scrollToEnd({ animated: true });
    // uzun suhbatda tepadagi xabarlar hali o'lchanmagan bo'lishi mumkin — birinchi urinish yetib bormasa, yana bir marta
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 450);
  };
  const lastId = messages.filter((m) => !m.local).reduce((max, m) => Math.max(max, m.id), 0);

  useEffect(() => {
    memory = { chatId: me?.chatId, messages, intro, quota };
  }, [messages, intro, quota, me?.chatId]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const apply = useCallback((data) => {
    if (!alive.current || !data) return;
    if (data.intro) setIntro(data.intro);
    if (data.limit) setQuota({ used: data.used, limit: data.limit });
    if (data.messages?.length) {
      setMessages((list) => merge(list, data.messages));
      // yuk yuborildi — natijasini kutamiz
      if (data.messages.some((m) => m.postId)) setWaitUntil(Date.now() + POLL_FOR_MS);
    }
  }, []);

  // To'liq yangilash: ochilganda va ilovaga qaytganda
  const refresh = useCallback(() => {
    getLoadChat()
      .then((data) => {
        if (!alive.current) return;
        setMessages(merge([], data.messages ?? []));
        apply({ ...data, messages: [] });
      })
      .catch(() => {});
  }, [apply]);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (next) => next === "active" && refresh());
    return () => sub.remove();
  }, [refresh]);

  // Natijani kutish: faqat yangi xabarlar so'raladi
  useEffect(() => {
    if (!waitUntil) return undefined;
    const timer = setInterval(() => {
      if (Date.now() > waitUntil) {
        setWaitUntil(0);
        return;
      }
      getLoadChat(lastId)
        .then((data) => {
          apply({ ...data, intro: null });
          if (data.messages?.some((m) => m.from === "bot" && !m.postId)) setWaitUntil(0);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waitUntil, lastId, apply]);

  // Bitta amal: xabarim darhol (🕓), keyin server javobi
  // → true: o'tdi; false: o'tmadi (yoki boshqa amal ketyapti)
  const run = async (mine, job) => {
    if (busy) return false;
    const temp = mine ? { id: `p${++localId}`, from: "me", pending: true, at: Date.now(), ...mine } : null;
    if (temp) setPending((list) => [...list, temp]);
    setBusy(true);
    try {
      const data = await job();
      // O'zim yozgan ovozni darhol eshita olay: server xabariga telefondagi fayl ulanadi
      if (temp?.localUri && data?.messages?.[0]?.audio) data.messages[0] = { ...data.messages[0], localUri: temp.localUri };
      apply(data);
      return true;
    } catch (error) {
      if (alive.current) setMessages((list) => [...list, { id: `e${++localId}`, from: "bot", text: `⚠️ ${error.message}`, at: Date.now(), local: true }]);
      return false;
    } finally {
      if (temp) setPending((list) => list.filter((m) => m.id !== temp.id));
      if (alive.current) setBusy(false);
    }
  };

  const send = () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    // Yuborilmadi (internet uzildi…) — yozgani yo'qolmaydi: maydonga qaytadi, qayta yuborsa bo'ladi
    run({ text: value }, () => sendLoadText(value)).then((ok) => {
      if (!ok && alive.current) setText((now) => now || value);
    });
  };
  // Raqam oynasi: raqamni tekshirib (tahrirlab) «✅ Yuborish» — raqam yoziladi va e'lon shu zahoti ketadi
  const sendWithPhone = (phone) => {
    const value = phone.trim();
    if (!value) return toast("Telefon raqamini yozing");
    run({ text: `📞 ${value}` }, () => pickLoadPhone(value, true));
  };
  // «✏️ Tahrirlash»: yozgani pastdagi maydonga qaytadi — to'g'rilab qayta yuboradi
  const inputRef = useRef(null);
  const editText = (value) => {
    setText(value);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const confirm = () => run({ text: "✅ Yuborish" }, () => confirmLoad());
  const cancel = () => run({ text: "❌ Bekor qilish" }, () => cancelLoad());

  // --- ▶️ Tinglash (bitta umumiy pleer) ---
  const player = useAudioPlayer(null);
  const playing = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState(null);
  const togglePlay = (m) => {
    if (playingId === m.id) {
      if (playing.playing) player.pause();
      else {
        if (playing.didJustFinish || (playing.duration && playing.currentTime >= playing.duration - 0.1)) player.seekTo(0);
        player.play();
      }
      return;
    }
    setPlayingId(m.id);
    player.replace(m.localUri ? { uri: m.localUri } : voiceSource(m.id));
    player.play();
  };

  // --- 🎤 Ovoz yozish ---
  const recorder = useAudioRecorder(VOICE_OPTIONS);
  const rec = useAudioRecorderState(recorder, 150);
  const [mode, setMode] = useState("idle"); // idle | hold (bosib turibdi) | locked (qulf) | cancel (chapga surdi)
  const [drag] = useState(() => new Animated.ValueXY());
  const modeRef = useRef("idle");
  const setModeBoth = useCallback((next) => {
    modeRef.current = next;
    setMode(next);
  }, []);
  // Yozuv uzunligi o'zimiz o'lchaymiz: yozish boshlanmagan bo'lsa 0. (Oldin rekorderning oxirgi qiymati olinardi —
  // tez bosib qo'yib yuborilsa OLDINGI yozuvning vaqti va fayli bilan eski ovoz qayta ketib qolishi mumkin edi)
  const startedAt = useRef(0);
  const starting = useRef(false);

  const startRec = async () => {
    if (starting.current) return; // oldingi bosish hali tayyorlanyapti — o'sha davom etadi
    starting.current = true;
    try {
      const has = await getRecordingPermissionsAsync();
      if (!has.granted) {
        // Ruxsat oynasi chiqqanda barmoq baribir qo'yib yuboriladi — ruxsatdan keyin yana bosib turadi
        const perm = await requestRecordingPermissionsAsync();
        if (perm.granted) toast("✅ Endi 🎤 ni bosib turib gapiring");
        else if (!perm.canAskAgain) {
          toast("Mikrofonga ruxsat yo'q — sozlamalardan yoqing");
          Linking.openSettings().catch(() => {});
        }
        setModeBoth("idle");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (modeRef.current === "idle") return; // tayyorlanguncha qo'yib yubordi
      if (playing.playing) player.pause(); // eshitilayotgan ovoz yozuvga tushmasin
      recorder.record();
      startedAt.current = Date.now();
      Vibration.vibrate(30);
    } catch {
      toast("Ovoz yozib bo'lmadi — yozib yuboring");
      setModeBoth("idle");
    } finally {
      starting.current = false;
    }
  };
  const stopRec = async () => {
    await recorder.stop().catch(() => {});
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    return recorder.uri;
  };
  const finishVoice = async (keep) => {
    const ms = startedAt.current ? Date.now() - startedAt.current : 0;
    startedAt.current = 0;
    setModeBoth("idle");
    drag.setValue({ x: 0, y: 0 });
    const uri = await stopRec(); // yozish boshlanmagan bo'lsa ham — tayyorlangan rekorder bo'shatiladi
    if (!keep) return;
    if (!ms || !uri || ms < VOICE_MIN_MS) {
      toast("Kamida 3 soniya gapiring — mikrofonni bosib turing");
      return;
    }
    run({ audio: true, durationMs: ms, localUri: uri }, async () => {
      const { url, headers } = voiceUpload(ms);
      return readUpload(await new File(uri).upload(url, { httpMethod: "POST", uploadType: UploadType.BINARY_CONTENT, headers }));
    });
  };
  // PanResponder bir marta yaratiladi — eng yangi funksiyalarni ref orqali chaqiradi
  const handlers = useRef({});
  useEffect(() => {
    handlers.current = { start: startRec, finish: finishVoice };
  });

  // Bosib turish / surish (Telegram'dagidek)
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        modeRef.current = "hold";
        setMode("hold");
        handlers.current.start?.();
      },
      onPanResponderMove: (_, g) => {
        if (modeRef.current !== "hold" && modeRef.current !== "cancel") return;
        drag.setValue({ x: Math.min(0, g.dx), y: Math.min(0, g.dy) });
        let next = g.dx < CANCEL_DX ? "cancel" : "hold";
        if (g.dy < LOCK_DY) {
          next = "locked";
          drag.setValue({ x: 0, y: 0 });
          Vibration.vibrate(20);
        }
        if (next !== modeRef.current) {
          modeRef.current = next;
          setMode(next);
        }
      },
      onPanResponderRelease: () => {
        if (modeRef.current === "locked") return; // qulf — ➤ yoki 🗑 kutiladi
        handlers.current.finish?.(modeRef.current === "hold");
      },
      onPanResponderTerminate: () => {
        if (modeRef.current !== "locked") handlers.current.finish?.(false);
      },
    }),
  );

  // 2 daqiqadan oshsa — o'zi yuboriladi
  useEffect(() => {
    if (!rec.isRecording || rec.durationMillis < VOICE_MAX_MS) return undefined;
    const timer = setTimeout(() => handlers.current.finish?.(true), 0);
    return () => clearTimeout(timer);
  }, [rec.isRecording, rec.durationMillis]);

  // Boshqa bo'limga o'tilsa: ovoz to'xtaydi, yozilayotgani bekor bo'ladi (ekran orqada tirik qoladi)
  useFocusEffect(
    useCallback(
      () => () => {
        try {
          player.pause();
        } catch {
          // pleer allaqachon yopilgan
        }
        if (modeRef.current !== "idle") handlers.current.finish?.(false);
      },
      [player],
    ),
  );

  // Bubble'ga beriladigan amallar o'zgarmas — yozayotganda (har harfda) xabarlar qayta chizilmaydi
  const actions = useRef({});
  useEffect(() => {
    actions.current = { onPhone: sendWithPhone, onEdit: editText, onConfirm: confirm, onCancel: cancel, onPlay: togglePlay };
  });
  const [act] = useState(() => ({
    onPhone: (value) => actions.current.onPhone?.(value),
    onEdit: (value) => actions.current.onEdit?.(value),
    onConfirm: () => actions.current.onConfirm?.(),
    onCancel: () => actions.current.onCancel?.(),
    onPlay: (item) => actions.current.onPlay?.(item),
  }));
  const renderItem = useCallback(
    ({ item }) => <Bubble item={item} {...act} busy={busy} playback={playingId === item.id ? playing : null} />,
    [act, busy, playingId, playing],
  );

  const recording = mode !== "idle";
  // Ro'yxat teskari (inverted, Telegram'dagidek): eng yangisi pastda va ekran pastga «mahkamlangan» — klaviatura ochilganda,
  // yozish maydoni kattalashganda ham sakramaydi (oldin scrollToEnd ba'zan tepaga otib yuborardi, Azimjon 2026-11-25)
  const all = useMemo(() => [...messages, ...pending, ...(busy ? [TYPING] : [])].reverse(), [messages, pending, busy]);

  return (
    <KeyboardAvoidingView style={styles.page} behavior="padding" keyboardVerticalOffset={insets.top + 56}>
      {/* Tepadagi «E'lon berish» sarlavhasi ostida soya — chat xabarlari u bilan qorishib ketmasin (Azimjon, 2026-11-25) */}
      <View style={styles.headShadow} pointerEvents="none" />
      <FlatList
        ref={listRef}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onLayout={(e) => {
          metrics.current.layout = e.nativeEvent.layout.height;
          checkPin();
        }}
        onContentSizeChange={(w, h) => {
          metrics.current.content = h;
          checkPin();
        }}
        style={styles.page}
        contentContainerStyle={styles.list}
        data={all}
        inverted
        keyExtractor={(item) => String(item.id)}
        ListFooterComponent={
          <>
            <View
              onLayout={(e) => {
                metrics.current.guide = e.nativeEvent.layout.height;
                checkPin();
              }}
            >
              <Guide open={guideOpen} onToggle={() => setGuideOpen((v) => !v)} />
            </View>
            {intro ? <Bubble item={{ id: "intro", from: "bot", text: intro }} /> : null}
          </>
        }
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
      />
      {pinned ? (
        <Pressable role="button" onPress={toGuide} style={styles.pin} accessibilityLabel="Qo'llanmaga qaytish">
          <View style={styles.pinStripe} />
          <View style={styles.pinBody}>
            <Text style={styles.pinTitle}>📌 E'lonni qanday berish kerak?</Text>
            <Text style={styles.pinText} numberOfLines={1}>
              {GUIDE.map(([, , sample]) => sample).join(", ")}
            </Text>
          </View>
          <Text style={styles.pinArrow}>↑</Text>
        </Pressable>
      ) : null}
      {quota ? <Text style={styles.quota}>24 soatda {quota.used} / {quota.limit} ta yuk</Text> : null}

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        {recording ? (
          <View style={styles.recBox}>
            {mode === "locked" ? (
              <Pressable role="button" aria-label="Bekor qilish" onPress={() => finishVoice(false)} hitSlop={10}>
                <Text style={styles.recTrash}>🗑</Text>
              </Pressable>
            ) : null}
            <View style={styles.recDot} />
            <Text style={styles.recTime}>{clock(rec.durationMillis)}</Text>
            <Text style={[styles.recHint, mode === "cancel" && styles.recHintCancel]} numberOfLines={1}>
              {mode === "cancel" ? "Qo'yib yuboring — bekor bo'ladi" : mode === "locked" ? "Gapiring… tugatgach ➤" : "◀ Bekor qilish uchun suring"}
            </Text>
          </View>
        ) : (
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Yukingizni yozing yoki mikrofonni bosib turing…"
            placeholderTextColor={colors.hint}
            multiline
            maxLength={3000}
          />
        )}

        {mode === "locked" ? (
          <Pressable role="button" aria-label="Ovozni yuborish" onPress={() => finishVoice(true)} style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}>
            <SendIcon />
          </Pressable>
        ) : text.trim() && !recording ? (
          <Pressable role="button" aria-label="Yuborish" onPress={send} disabled={busy} style={({ pressed }) => [styles.roundBtn, busy && styles.off, pressed && styles.pressed]}>
            <SendIcon />
          </Pressable>
        ) : (
          <View>
            {mode === "hold" || mode === "cancel" ? (
              <View style={styles.lockHint} pointerEvents="none">
                <Text style={styles.lockText}>🔒</Text>
                <Text style={styles.lockArrow}>▲</Text>
              </View>
            ) : null}
            <Animated.View
              {...(busy ? {} : pan.panHandlers)}
              style={[styles.roundBtn, recording && styles.micActive, busy && styles.off, { transform: drag.getTranslateTransform() }]}
              accessibilityRole="button"
              accessibilityLabel="Ovoz yozish: bosib turing"
            >
              <MicIcon />
            </Animated.View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// Yuborish belgisi — chiziqli uchburchak (➤ harfi har telefonda boshqacha va markazdan qochib turardi)
function SendIcon() {
  return <View style={styles.sendTri} pointerEvents="none" />;
}

// Telegram'dagidek oq mikrofon belgisi (chiziqlardan chiziladi — emoji 🎤 rangli va har telefonda boshqacha):
// kapsula, uning ostida «U» ushlagich, oyoqcha va taglik
function MicIcon() {
  return (
    <View style={styles.mic} pointerEvents="none">
      <View style={styles.micHead} />
      <View style={styles.micCup} />
      <View style={styles.micStem} />
      <View style={styles.micBase} />
    </View>
  );
}

// Tepadagi namuna (yopib-ochsa bo'ladi): nima yozish va nima aytish
function Guide({ open, onToggle }) {
  return (
    <View style={styles.guide}>
      <Pressable role="button" onPress={onToggle} style={styles.guideHead}>
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
          <Text style={styles.guideSub}>🎤 Yoki mikrofonni bosib turib, shunday ayting:</Text>
          <Text style={styles.guideSay}>{SAY}</Text>
          <Text style={styles.guideNote}>Raqamni aytmasangiz — keyin so'raymiz. Yuborishdan oldin haydovchilarga qanday borishini ko'rasiz.</Text>
        </>
      ) : null}
    </View>
  );
}

// Raqam oynasi: tayyor raqam (o'zgartirsa bo'ladi) + boshqa saqlangan raqamlar + [✅ Yuborish] [❌ Bekor qilish]
function PhoneAsk({ phones, onSend, onCancel, busy }) {
  const [value, setValue] = useState(phones?.[0]?.label ?? "");
  return (
    <View style={styles.actions}>
      <TextInput
        style={styles.phoneInput}
        value={value}
        onChangeText={setValue}
        placeholder="90 123 45 67"
        placeholderTextColor={colors.hint}
        keyboardType="phone-pad"
        maxLength={40}
      />
      {phones?.length > 1 ? (
        <View style={styles.phoneChips}>
          {phones.map((p) => (
            <Pressable key={p.phone} onPress={() => setValue(p.label)} style={({ pressed }) => [styles.phoneChip, pressed && styles.pressed]}>
              <Text style={styles.phoneChipText}>📞 {p.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Button title="✅ Yuborish" onPress={() => onSend(value)} disabled={busy} />
      <Button title="❌ E'lonni bekor qilish" kind="secondary" onPress={onCancel} disabled={busy} />
    </View>
  );
}

const Bubble = memo(function Bubble({ item, onPhone, onEdit, onConfirm, onCancel, busy, onPlay, playback }) {
  const mine = item.from === "me";
  if (item.typing) {
    return (
      <View style={[styles.bubble, styles.bot, styles.typing]}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.hintText}>Tushunyapman…</Text>
      </View>
    );
  }
  return (
    <View style={[styles.bubble, mine ? styles.me : styles.bot]}>
      {item.audio ? <Voice item={item} mine={mine} onPlay={onPlay} playback={playback} /> : null}
      {item.audio && item.transcript ? <Text style={[styles.transcript, mine && styles.meSoft]}>«{item.transcript}»</Text> : null}
      {item.text ? (
        <Text style={[styles.text, mine && styles.meText]} selectable>
          {item.text}
        </Text>
      ) : null}
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
      {/* Ma'lumot yetishmadi — yozgani qaytariladi, «✏️ Tahrirlash» bilan to'g'rilab qayta yuboradi */}
      {item.failed && item.editText ? (
        <View style={styles.quote}>
          <Text style={styles.quoteText} selectable>
            {item.editText}
          </Text>
          <Button title="✏️ Tahrirlash" kind="secondary" onPress={() => onEdit?.(item.editText)} />
        </View>
      ) : null}
      {item.active && item.stage === "confirm" ? (
        <View style={styles.actions}>
          <Button title="✅ Yuborish" onPress={onConfirm} disabled={busy} />
          {item.editText ? <Button title="✏️ Tahrirlash" kind="secondary" onPress={() => onEdit?.(item.editText)} disabled={busy} /> : null}
          <Button title="❌ E'lonni bekor qilish" kind="secondary" onPress={onCancel} disabled={busy} />
        </View>
      ) : null}
      {item.active && item.stage === "phone" ? <PhoneAsk phones={item.phones} onSend={onPhone} onCancel={onCancel} busy={busy} /> : null}
      {item.id !== "intro" ? (
        <Text style={[styles.time, mine && styles.meSoft]}>{item.pending ? "🕓" : `${timeOf(item.at)}${mine ? " ✓" : ""}`}</Text>
      ) : null}
    </View>
  );
});

// Ovozli xabar: ▶️/⏸, chiziq (qancha eshitildi), vaqt
function Voice({ item, mine, onPlay, playback }) {
  const total = (playback?.duration ? playback.duration * 1000 : 0) || item.durationMs || 0;
  const at = playback ? playback.currentTime * 1000 : 0;
  const part = total ? Math.min(at / total, 1) : 0;
  const isPlaying = Boolean(playback?.playing);
  return (
    <View style={styles.voice}>
      <Pressable
        role="button"
        aria-label={isPlaying ? "To'xtatish" : "Eshitish"}
        onPress={() => !item.pending && onPlay?.(item)}
        style={[styles.playBtn, mine && styles.playBtnMine]}
        hitSlop={8}
      >
        {playback?.isBuffering && !isPlaying ? (
          <ActivityIndicator size="small" color={mine ? colors.accent : colors.accentText} />
        ) : (
          <Text style={[styles.playIcon, mine && styles.playIconMine]}>{isPlaying ? "❚❚" : "▶"}</Text>
        )}
      </Pressable>
      <View style={styles.voiceRight}>
        <View style={[styles.voiceTrack, mine && styles.voiceTrackMine]}>
          <View style={[styles.voiceFill, mine && styles.voiceFillMine, { width: `${Math.round(part * 100)}%` }]} />
        </View>
        <Text style={[styles.voiceTime, mine && styles.meSoft]}>{clock(playback && at > 0 ? at : total)}</Text>
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    headShadow: {
      height: 1,
      backgroundColor: colors.line,
      zIndex: 2,
      elevation: 6, // Android soyasi
      shadowColor: colors.shadow, // iOS / web
      shadowOpacity: 0.18,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    list: { padding: space.md, gap: space.sm },
    pin: {
      position: "absolute",
      top: 1,
      left: 0,
      right: 0,
      zIndex: 3,
      elevation: 5,
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      paddingVertical: 6,
      paddingRight: space.md,
      paddingLeft: space.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      shadowColor: colors.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    pinStripe: { width: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: colors.accent },
    pinBody: { flex: 1, gap: 1 },
    pinTitle: { fontSize: 13, fontWeight: "700", color: colors.accent },
    pinText: { fontSize: 13, color: colors.text },
    pinArrow: { fontSize: 18, color: colors.hint, fontWeight: "700" },
    bubble: { maxWidth: "86%", borderRadius: radius + 4, paddingTop: space.sm, paddingBottom: 6, paddingHorizontal: space.md, gap: 6 },
    bot: { alignSelf: "flex-start", backgroundColor: colors.card, borderBottomLeftRadius: 4 },
    me: { alignSelf: "flex-end", backgroundColor: colors.accent, borderBottomRightRadius: 4 },
    typing: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingBottom: space.sm },
    text: { fontSize: 15, lineHeight: 21, color: colors.text },
    meText: { color: colors.accentText },
    meSoft: { color: "rgba(255,255,255,0.8)" },
    transcript: { fontSize: 13, lineHeight: 18, fontStyle: "italic", color: colors.hint },
    time: { fontSize: 11, color: colors.hint, alignSelf: "flex-end" },
    hintText: { fontSize: 14, color: colors.hint },
    card: { backgroundColor: colors.soft, borderRadius: radius, padding: space.md, gap: 4 },
    cardHead: { fontWeight: "700" },
    cardLine: { fontSize: 14, lineHeight: 20, color: colors.text },
    actions: { gap: space.sm },
    quote: { gap: space.sm, borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: space.sm },
    quoteText: { fontSize: 14, lineHeight: 20, color: colors.text, fontStyle: "italic" },
    phoneInput: {
      minHeight: 46,
      borderRadius: radius,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: space.md,
      fontSize: 17,
      fontWeight: "600",
      color: colors.text,
      backgroundColor: colors.bg,
    },
    phoneChips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
    phoneChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.soft },
    phoneChipText: { fontSize: 13, color: colors.accent, fontWeight: "600" },
    voice: { flexDirection: "row", alignItems: "center", gap: space.sm, minWidth: 200 },
    playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    playBtnMine: { backgroundColor: "#fff" },
    playIcon: { color: colors.accentText, fontSize: 15, fontWeight: "800" },
    playIconMine: { color: colors.accent },
    voiceRight: { flex: 1, gap: 4 },
    voiceTrack: { height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: "hidden" },
    voiceTrackMine: { backgroundColor: "rgba(255,255,255,0.35)" },
    voiceFill: { height: "100%", backgroundColor: colors.accent },
    voiceFillMine: { backgroundColor: "#fff" },
    voiceTime: { fontSize: 12, color: colors.hint },
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
      // Tugma bilan bir xil balandlik (48) — bitta qatorda ikkalasi o'rtada tekis; matn ko'paysa maydon o'sadi, tugma pastda
      minHeight: 48,
      maxHeight: 140,
      borderRadius: 24,
      paddingHorizontal: space.lg,
      paddingTop: 13,
      paddingBottom: 13,
      textAlignVertical: "center",
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.bg,
    },
    roundBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    micActive: { backgroundColor: colors.error },
    mic: { width: 22, height: 26, alignItems: "center" },
    micHead: { width: 10, height: 15, borderRadius: 5, backgroundColor: "#fff" },
    micCup: {
      position: "absolute",
      top: 7,
      width: 18,
      height: 12,
      borderWidth: 2.2,
      borderTopWidth: 0,
      borderColor: "#fff",
      borderBottomLeftRadius: 9,
      borderBottomRightRadius: 9,
    },
    micStem: { position: "absolute", top: 19, width: 2.2, height: 4, backgroundColor: "#fff" },
    micBase: { position: "absolute", top: 22.5, width: 9, height: 2.2, borderRadius: 1.1, backgroundColor: "#fff" },
    off: { opacity: 0.4 },
    // uchburchak: o'ngga qaragan; optik markaz uchun biroz o'ngga suriladi
    sendTri: {
      width: 0,
      height: 0,
      marginLeft: 4,
      borderTopWidth: 9,
      borderBottomWidth: 9,
      borderLeftWidth: 16,
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
      borderLeftColor: "#fff",
    },
    pressed: { opacity: 0.6 },
    recBox: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, borderRadius: 24, backgroundColor: colors.bg },
    recTrash: { fontSize: 20 },
    recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
    recTime: { fontSize: 15, fontWeight: "700", color: colors.text, minWidth: 40 },
    recHint: { flex: 1, fontSize: 13, color: colors.hint },
    recHintCancel: { color: colors.error, fontWeight: "700" },
    lockHint: { position: "absolute", bottom: 58, alignSelf: "center", alignItems: "center", backgroundColor: colors.card, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 8, elevation: 4 },
    lockText: { fontSize: 16 },
    lockArrow: { fontSize: 10, color: colors.hint },
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
  }),
);
