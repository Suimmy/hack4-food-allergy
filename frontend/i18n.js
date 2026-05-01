const I18N = {
  th: {
    app_title: "Allergy Alert",
    tagline: "ถ่ายรูปเมนู เช็ควัตถุดิบ หลีกเลี่ยงสิ่งที่แพ้",
    step1_title: "1. เลือกสารก่อภูมิแพ้ของคุณ",
    step1_hint: "ติ๊กรายการที่คุณแพ้ ระบบจะแจ้งเตือนเมื่อเจอในเมนู",
    custom_label: "เพิ่มสิ่งที่แพ้อื่นๆ (พิมพ์เองได้)",
    custom_placeholder: "เช่น มะม่วง, เห็ด, ผักชี",
    add: "เพิ่ม",
    step2_title: "2. ถ่ายรูป / อัปโหลดเมนู",
    step2_hint: "ใช้กล้องถ่ายชื่อเมนูในร้าน หรืออัปโหลดรูปจากเครื่อง",
    take_photo: "📷 ถ่ายรูป",
    upload_photo: "🖼️ อัปโหลดรูป",
    or_type: "หรือพิมพ์ชื่อเมนูเอง",
    type_placeholder: "เช่น ผัดไทยกุ้งสด",
    analyze_btn: "🔍 วิเคราะห์เมนู",
    loading: "กำลังวิเคราะห์เมนู...",
    footer: "ทำโดย Typhoon OCR + Typhoon LLM · ฐานข้อมูลอาหารไทย",

    alert_title_multi_some: "พบเมนูที่คุณแพ้ {alerted} จาก {total} เมนู",
    alert_desc_multi_some: "เลื่อนลงดูรายละเอียดและหลีกเลี่ยงเมนูที่มีเครื่องหมาย ⚠️",
    alert_title_multi_safe: "ปลอดภัย — ทุกเมนูไม่มีสิ่งที่คุณแพ้",
    alert_desc_multi_safe: "วิเคราะห์ {total} เมนู ไม่พบสารก่อภูมิแพ้ที่คุณติ๊กไว้",
    alert_title_multi_info: "วิเคราะห์ {total} เมนู",
    alert_desc_multi_info: "ติ๊กสารก่อภูมิแพ้ของคุณด้านบนเพื่อให้ระบบแจ้งเตือน",
    alert_title_single_warn: "คำเตือน! เมนูนี้มีสิ่งที่คุณแพ้",
    alert_desc_single_warn: "เจอสารก่อภูมิแพ้ {n} รายการ — ควรหลีกเลี่ยง",
    alert_title_single_safe: "ปลอดภัย",
    alert_desc_single_safe: "ไม่พบสารก่อภูมิแพ้ที่คุณติ๊กไว้",

    section_alerted: "⚠️ เมนูที่คุณแพ้ ({n})",
    section_safe: "✅ เมนูปลอดภัย ({n})",
    see_details: "ดูรายละเอียด",
    ingredients_label: "วัตถุดิบหลัก",
    no_ingredients: "ไม่มีข้อมูลวัตถุดิบ",
    allergens_label: "สารก่อภูมิแพ้ที่อาจมี",
    no_allergens: "ไม่พบสารก่อภูมิแพ้",
    source_db: "📚 DB",
    source_db_fuzzy: "📚 DB (คล้าย)",
    source_ai: "🤖 AI",
    source_web: "🌐 Web+AI",
    conf_high: "แม่นยำสูง",
    conf_medium: "แม่นยำปานกลาง",
    conf_low: "แม่นยำต่ำ",

    debug_summary: "🔍 ดูสิ่งที่ตรวจจับได้",
    debug_db_match: "DB match: {db} เมนู · LLM extract: {llm} ชื่อ",
    debug_llm_names: "ชื่อจาก LLM:",
    debug_no_llm: "LLM ไม่ได้ส่งชื่อเมนูกลับมา",
    debug_ocr: "OCR text:",
    error_prefix: "❌ ",
  },
  en: {
    app_title: "Allergy Alert",
    tagline: "Snap a menu, check ingredients, avoid your allergens",
    step1_title: "1. Select your allergens",
    step1_hint: "Check the items you're allergic to — we'll alert you when they appear in dishes",
    custom_label: "Add other items (type your own)",
    custom_placeholder: "e.g. mango, mushroom, cilantro",
    add: "Add",
    step2_title: "2. Take a photo / upload menu",
    step2_hint: "Use camera to capture a menu, or upload from device",
    take_photo: "📷 Take photo",
    upload_photo: "🖼️ Upload",
    or_type: "Or type a dish name",
    type_placeholder: "e.g. Pad Thai with shrimp",
    analyze_btn: "🔍 Analyze menu",
    loading: "Analyzing...",
    footer: "Powered by Typhoon OCR + Typhoon LLM · Thai food database",

    alert_title_multi_some: "Found {alerted} of {total} dishes with your allergens",
    alert_desc_multi_some: "Scroll down to see details — avoid dishes marked ⚠️",
    alert_title_multi_safe: "Safe — no allergens found in any dish",
    alert_desc_multi_safe: "Analyzed {total} dishes, none contain your selected allergens",
    alert_title_multi_info: "Analyzed {total} dishes",
    alert_desc_multi_info: "Select your allergens above to get alerts",
    alert_title_single_warn: "Warning! This dish contains your allergens",
    alert_desc_single_warn: "Found {n} allergen(s) — avoid this dish",
    alert_title_single_safe: "Safe",
    alert_desc_single_safe: "No allergens found you selected",

    section_alerted: "⚠️ Allergic dishes ({n})",
    section_safe: "✅ Safe dishes ({n})",
    see_details: "See details",
    ingredients_label: "Main ingredients",
    no_ingredients: "No ingredient info",
    allergens_label: "Potential allergens",
    no_allergens: "No allergens detected",
    source_db: "📚 DB",
    source_db_fuzzy: "📚 DB (fuzzy)",
    source_ai: "🤖 AI",
    source_web: "🌐 Web+AI",
    conf_high: "high confidence",
    conf_medium: "medium confidence",
    conf_low: "low confidence",

    debug_summary: "🔍 What was detected",
    debug_db_match: "DB match: {db} dishes · LLM extract: {llm} names",
    debug_llm_names: "Names from LLM:",
    debug_no_llm: "LLM returned no menu names",
    debug_ocr: "OCR text:",
    error_prefix: "❌ ",
  },
};

const LANG_KEY = "allergy_app_lang";
let currentLang = localStorage.getItem(LANG_KEY) || "th";

function t(key, vars = {}) {
  let str = (I18N[currentLang] && I18N[currentLang][key]) || key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }
  return str;
}

function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  // Placeholders
  const customInput = document.getElementById("customInput");
  if (customInput) customInput.placeholder = t("custom_placeholder");
  const textInput = document.getElementById("textInput");
  if (textInput) textInput.placeholder = t("type_placeholder");
  // Toggle button shows the OTHER language
  const btn = document.getElementById("langToggle");
  if (btn) btn.textContent = currentLang === "th" ? "EN" : "TH";
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  applyTranslations();
  // Notify app to re-render
  document.dispatchEvent(new CustomEvent("langChanged", { detail: lang }));
}
