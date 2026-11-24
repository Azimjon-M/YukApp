// «⏸ Pauza / ▶️ Davom etish» — sahifa emas, tugma: bosilganda bot e'lon yuborishni to'xtatadi yoki davom ettiradi
// (_layout.js dagi PauseButton). Bu fayl faqat tab ro'yxatda turishi uchun kerak — hech qachon ochilmaydi.
import { Redirect } from "expo-router";

export default function PauseRoute() {
  return <Redirect href="/" />;
}
