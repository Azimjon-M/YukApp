// Telefonga bildirishnoma (expo-notifications). Ilova yopiq bo'lsa ham server FCM orqali yuboradi: «📍 Qayerdan → Qayerga»,
// matnida e'lon, pastida «📞 Qo'ng'iroq qilish» tugmasi (raqam bo'lsa). Bosilsa — ilova «📋 Yuklar» da ochiladi.
// Ruxsat qachon so'ralishi — notifyAsk.js, so'rash oynasi — components/NotifyPrompt.js.
// Android 13+: ruxsat oynasi kanal yaratilmaguncha chiqmaydi — shuning uchun avval setup().
import { useEffect } from "react";
import { Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { savePushToken } from "./api.js";

const native = Platform.OS === "android";
export const CHANNEL = "yuklar"; // server FCM xabarida channelId shu bo'lsin
export const CATEGORY = "yuk"; // server categoryId shu bo'lsin (tugmalar)
const CALL = "call";

// Ilova ochiq turganda tizim xabari chiqmaydi — lenta o'zi ko'rsatadi
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

let ready = null;
export function setup() {
  if (!native) return Promise.resolve();
  ready ??= Promise.all([
    Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Yangi yuklar",
      description: "Filtringizga mos yangi e'lonlar",
      // eslint-disable-next-line import/namespace -- enum .types faylidan «export *» bilan keladi, eslint ko'rmaydi
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#2481cc",
    }),
    Notifications.setNotificationCategoryAsync(CATEGORY, [
      { identifier: CALL, buttonTitle: "📞 Qo'ng'iroq qilish", options: { opensAppToForeground: true } },
    ]),
  ]).catch(() => {
    ready = null;
  });
  return ready;
}

// { granted, canAskAgain }
export async function permission() {
  if (!native) return { granted: false, canAskAgain: false };
  try {
    const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    return { granted, canAskAgain };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

// «🔔 Yoqish»: tizim oynasi; ikki marta rad etilgan bo'lsa Android oynani boshqa ko'rsatmaydi — telefon sozlamalari ochiladi
export async function enable() {
  if (!native) return false;
  await setup();
  const now = await permission();
  if (now.granted) return true;
  if (!now.canAskAgain) {
    Linking.openSettings().catch(() => {});
    return false;
  }
  try {
    const { granted } = await Notifications.requestPermissionsAsync();
    if (granted) registerToken();
    return granted;
  } catch {
    return false;
  }
}

// Token serverga (har ochilishda — token almashib qolishi mumkin). google-services.json siz yig'ilgan APK da token yo'q — indamaymiz
export async function registerToken() {
  if (!native) return;
  try {
    await setup();
    const { data } = await Notifications.getDevicePushTokenAsync();
    if (data) await savePushToken(String(data));
  } catch {
    // FCM sozlanmagan / server hali qabul qilmaydi (404) / aloqa yo'q — keyingi ochilishda yana
  }
}

// Bildirishnoma bosildi: «📞» — qo'ng'iroq oynasi, o'zi — «📋 Yuklar». Ilova yopiq turganda bosilgani ham (birinchi ochilish)
function handle(response) {
  if (!response) return;
  const data = response.notification.request.content.data ?? {};
  const phone = typeof data.phone === "string" ? data.phone.replace(/[^\d+]/g, "") : "";
  if (response.actionIdentifier === CALL && phone) {
    Linking.openURL(`tel:${phone}`).catch(() => {});
    Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
    return;
  }
  router.navigate("/");
}

export function useNotifications(signedIn) {
  useEffect(() => {
    if (!native || !signedIn) return undefined;
    setup();
    permission().then((p) => p.granted && registerToken());
    Notifications.getLastNotificationResponseAsync()
      .then((last) => {
        handle(last);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => {});
    const tap = Notifications.addNotificationResponseReceivedListener(handle);
    const rotate = Notifications.addPushTokenListener(({ data }) => data && savePushToken(String(data)).catch(() => {}));
    return () => {
      tap.remove();
      rotate.remove();
    };
  }, [signedIn]);
}
