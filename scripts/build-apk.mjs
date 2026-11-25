// APK yig'ish (kompyuterda, Expo serverisiz): npm run apk
//   1) expo prebuild — app.json dan android/ papkasini yaratadi (u git'da yo'q, har safar qayta yasaladi)
//   2) gradlew assembleRelease — JS kodni bitta faylga yig'adi va ilovani quradi
//   3) apksigner — APK ni bizning kalit (keys/yuk-release.jks) bilan imzolaydi
//   Natija: apk/yuk-ekspert-<versiya>.apk
// Kalit yo'qolsa, keyingi versiyani eski ilova ustidan o'rnatib bo'lmaydi — keys/ papkasining zaxira nusxasini saqlang.
// Kerak: Android Studio (JDK — uning jbr papkasi) va Android SDK. Boshqa joyda bo'lsa: JAVA_HOME, ANDROID_HOME.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";
const local = process.env.LOCALAPPDATA ?? "";

const env = { ...process.env, NODE_ENV: "production" };
delete env.EXPO_PUBLIC_API_URL; // APK doim haqiqiy serverga ulanadi
// Serverda (Linux, 2026-11-25): JDK va SDK /data/android da (setup.sh) — bor bo'lsa o'shalar
const SERVER_DIR = "/data/android";
if (!win && existsSync(join(SERVER_DIR, "sdk"))) {
  env.JAVA_HOME ??= join(SERVER_DIR, "jdk");
  env.ANDROID_HOME ??= join(SERVER_DIR, "sdk");
  env.PATH = `${join(env.JAVA_HOME, "bin")}:${env.PATH}`;
}
if (win) env.JAVA_HOME ??= "C:\\Program Files\\Android\\Android Studio\\jbr";

// C: disk to'lib qolgani uchun (2026-11-23) yig'ish D:\Android da: SDK (NDK ~3 GB), Gradle keshi va vaqtinchalik fayllar.
// Bu papka bo'lmasa — odatiy joylar (C: dagi Android SDK va ~/.gradle).
const BUILD_DIR = "D:\\Android";
if (win && existsSync(BUILD_DIR)) {
  env.ANDROID_HOME ??= join(BUILD_DIR, "Sdk");
  env.GRADLE_USER_HOME ??= join(BUILD_DIR, "gradle");
  mkdirSync(join(BUILD_DIR, "tmp"), { recursive: true });
  env.TEMP = env.TMP = join(BUILD_DIR, "tmp");
}
env.ANDROID_HOME ??= join(local, "Android", "Sdk");

// C++ qismlar uchun sozlamalar — scripts/native-build.gradle da batafsil:
//   YUK_CXX_DIR  — qisqa ish papkasi (Windows'ning 260 belgilik yo'l cheklovi)
//   YUK_CXX_JOBS — bitta modulda bir vaqtda nechta C++ fayl kompilyatsiya qilinadi (xotira yetishi uchun)
//   YUK_BUILD_WORKERS — Gradle bir vaqtda nechta vazifa bajaradi
// 2026-11-24: 16 GB RAM da 2 × 3 = 6 ta clang birdan — «out of memory» yo'q. Kuchliroq kompyuterda oshirsa bo'ladi.
const initScript = join(root, "scripts", "native-build.gradle");
if (win) env.YUK_CXX_DIR ??= join(existsSync(BUILD_DIR) ? BUILD_DIR : join(local, "yuk"), "cx");
env.YUK_CXX_JOBS ??= win ? "3" : "16";
const workers = env.YUK_BUILD_WORKERS ?? (win ? "2" : "16"); // serverda 192 yadro, 500 GB xotira

// Windows: SDK dagi CMake bilan keladigan ninja 1.10 yo'l 260 belgidan uzun bo'lsa yiqiladi
// («Filename longer than 260 characters», gesture-handler kodgeni). ninja 1.12+ uzun yo'llarni biladi
// (Windows'da LongPathsEnabled = 1 bo'lishi kerak). 2026-11-24: D:\Android\Sdk\cmake\3.22.1\bin\ninja.exe → 1.12.1
// (rasmiy github.com/ninja-build/ninja, eskisi ninja-1.10.2.exe bo'lib turibdi).
if (win) {
  const cmakeDir = join(env.ANDROID_HOME, "cmake");
  for (const ver of existsSync(cmakeDir) ? readdirSync(cmakeDir) : []) {
    const ninja = join(cmakeDir, ver, "bin", "ninja.exe");
    if (!existsSync(ninja)) continue;
    const v = spawnSync(ninja, ["--version"], { encoding: "utf8" }).stdout?.trim() ?? "";
    const [major, minor] = v.split(".").map(Number);
    if (!(major > 1 || (major === 1 && minor >= 12))) {
      console.error(`✖ ${ninja} versiyasi ${v || "?"} — kamida 1.12 kerak (uzun yo'llar).`);
      console.error("  github.com/ninja-build/ninja/releases dan ninja-win.zip ni olib, shu faylni almashtiring.");
      process.exit(1);
    }
  }
}

// Telefonlar: arm64-v8a (deyarli hammasi), armeabi-v7a (eski arzon telefonlar), x86_64 (kompyuterdagi emulyator).
// YUK_ARCHS=arm64-v8a — faqat zamonaviy telefonlar uchun: tezroq yig'iladi, fayl kichikroq (serverdagi reliz shunday)
const ARCHS = env.YUK_ARCHS?.trim() || "arm64-v8a,armeabi-v7a,x86_64";

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd, env, stdio: "inherit", shell: win });
  if (r.status !== 0) {
    console.error(`\n✖ Bajarilmadi: ${cmd} (kod ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

const keystore = join(root, "keys", "yuk-release.jks");
const passFile = join(root, "keys", "storepass.txt");
if (!existsSync(keystore) || !existsSync(passFile)) {
  console.error("✖ keys/yuk-release.jks yoki keys/storepass.txt topilmadi — zaxira nusxasidan qaytaring (yangi kalit = eski ilova ustidan o'rnatilmaydi).");
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo;

run("npx", ["expo", "prebuild", "--platform", "android", "--no-install"], root);
// Yo'l aniq yoziladi: Windows ba'zan joriy papkadagi .bat faylni o'zi qidirmaydi (NoDefaultCurrentDirectoryInExePath)
run(
  win ? ".\\gradlew.bat" : "./gradlew",
  [
    "assembleRelease",
    `-PreactNativeArchitectures=${ARCHS}`,
    "--init-script",
    initScript,
    `--max-workers=${workers}`,
    "--console=plain",
  ],
  join(root, "android"),
);

// Eng yangi build-tools ichidagi apksigner
const tools = join(env.ANDROID_HOME, "build-tools");
const newest = readdirSync(tools).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
const apksigner = join(tools, newest, win ? "apksigner.bat" : "apksigner");

const built = join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
const outDir = join(root, "apk");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `yuk-ekspert-${version}.apk`);
copyFileSync(built, out);

const pass = `file:${passFile}`;
// --key-pass bermaymiz: PKCS12 kalitda kalit paroli = ombor paroli, apksigner uni o'zi sinaydi.
// (Ikkalasiga bitta fayl berilsa, apksigner faylni qatorma-qator o'qiydi va ikkinchi qatorni qidiradi —
// «end of file reached», 2026-11-24.)
run(apksigner, ["sign", "--ks", keystore, "--ks-key-alias", "yukekspert", "--ks-pass", pass, "--v4-signing-enabled", "false", out], root);
run(apksigner, ["verify", "--print-certs", out], root);
console.log(`\n✅ Tayyor: ${out}`);
