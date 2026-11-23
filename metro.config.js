// Metro — ilova kodini yig'uvchi (bundler). Bu yerda bitta narsa qo'shilgan: @yuk/shared.
//
// @yuk/shared — YukPlatform reposidagi umumiy qoidalar (viloyatlar, transport turlari, yuk matnlari...). Bot, sayt va
// Mini App aynan shu kodni ishlatadi, ilova ham shuni ishlatsin — matnlar va qoidalar hamma joyda bir xil bo'ladi.
// package.json da "file:../YukPlatform/packages/shared" — npm node_modules/@yuk/shared ga havola (symlink) qo'yadi.
// Metro havolaning asl joyini ham kuzatishi kerak, aks holda faylni topmaydi — shuning uchun watchFolders.
// Shart: YukPlatform papkasi shu papka yonida turadi (D:\ShaxsiyProject\YukPlatform va D:\ShaxsiyProject\YukApp).
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const shared = path.resolve(__dirname, "../YukPlatform/packages/shared");
config.watchFolders = [...(config.watchFolders ?? []), shared];

module.exports = config;
