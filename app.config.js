// app.json ustiga: Firebase fayli (google-services.json) bor bo'lsagina ulanadi — u git'ga kirmaydi (.gitignore),
// Azimjonning kompyuterida YukApp ildizida turadi. Fayl yo'q bo'lsa ilova baribir yig'iladi, faqat bildirishnoma tokeni bo'lmaydi.
const fs = require("node:fs");
const path = require("node:path");

module.exports = ({ config }) => {
  const file = path.resolve("google-services.json"); // expo loyiha ildizidan ishga tushadi
  if (!fs.existsSync(file)) return config;
  return { ...config, android: { ...config.android, googleServicesFile: "./google-services.json" } };
};
