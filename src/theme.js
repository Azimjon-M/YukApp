// Ranglar — telefonning yorug'/qorong'i rejimiga qarab (app.json userInterfaceStyle: "automatic").
// Yorug'i — Mini App / saytdagi bilan bir xil (apps/web/src/styles.css :root), qorong'isi — Telegram tungi rangiga yaqin.
// `colors` — bitta obyekt, rejim almashganda ichi yangilanadi (applyScheme); ildiz (_layout.js) butun ilovani qayta
// chizadi. Uslublar (StyleSheet) ham shuning uchun `themed(() => StyleSheet.create({...}))` — har rejimga alohida, kerak
// bo'lganda yasaladi.
import { Appearance } from "react-native";

const LIGHT = {
  bg: "#efeff4",
  card: "#ffffff",
  text: "#111111",
  hint: "#8a8a8e",
  accent: "#2481cc",
  accentText: "#ffffff",
  error: "#e53935",
  line: "#dcdce0",
  soft: "#e8f1fa", // tanlangan tugma foni
  ok: "#2e7d32",
  call: "#2e9e4f", // «📞» tugmasi
  // Yuklar tepasidagi filtr qatori — kartalardan to'qroq, adashmasin
  barBg: "#d6e6f5",
  barBorder: "#a9c9e8",
  barText: "#0d3c66",
  // «⏸ Pauzada» ogohlantirishi
  warnBg: "#fff4e5",
  warnBorder: "#f5c27a",
  warnText: "#8a5300",
  shadow: "#000000",
  backdrop: "rgba(0,0,0,0.45)",
};

const DARK = {
  bg: "#0f1419",
  card: "#1c242e",
  text: "#eef1f4",
  hint: "#8d99a6",
  accent: "#4aa3e8",
  accentText: "#ffffff",
  error: "#ef5350",
  line: "#2c3846",
  soft: "#1d3550",
  ok: "#5cb860",
  call: "#2e9e4f",
  barBg: "#16324d",
  barBorder: "#28557f",
  barText: "#d3e7fa",
  warnBg: "#3a2a12",
  warnBorder: "#7a5520",
  warnText: "#f5c27a",
  shadow: "#000000",
  backdrop: "rgba(0,0,0,0.6)",
};

export const colors = { ...LIGHT };
let current = "light";

export const schemeOf = (value) => (value === "dark" ? "dark" : "light");
export const currentScheme = () => current;

// Rejimni qo'llash: colors ichi almashadi. Bir xil rejim — hech narsa qilinmaydi
export function applyScheme(value) {
  const next = schemeOf(value);
  if (next === current) return;
  current = next;
  Object.assign(colors, next === "dark" ? DARK : LIGHT);
}
applyScheme(Appearance.getColorScheme());

// Rejimga bog'liq uslublar: styles.page o'qilganda — joriy rejimniki (birinchi marta kerak bo'lganda yasaladi)
export function themed(make) {
  const built = {};
  return new Proxy(
    {},
    {
      get(_, key) {
        built[current] ??= make();
        return built[current][key];
      },
    },
  );
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = 12;
