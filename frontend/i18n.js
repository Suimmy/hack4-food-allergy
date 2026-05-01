// Allergen key → name in each language. Used so we don't need to modify allergy.json.
const ALLERGEN_LABELS_ZH = {
  peanut: "花生",
  tree_nut: "坚果",
  shellfish: "贝类（虾/蟹/贝）",
  fish: "鱼/鱼露",
  egg: "鸡蛋",
  dairy: "乳制品",
  gluten: "麸质/小麦",
  soy: "大豆/酱油",
  sesame: "芝麻",
  msg: "味精 (MSG)",
  coconut: "椰子/椰浆",
  spicy: "辣椒/辣",
};

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
  zh: {
    app_title: "过敏警报",
    tagline: "拍菜单照片，查看食材，避开过敏原",
    step1_title: "1. 选择您的过敏原",
    step1_hint: "勾选您过敏的项目，发现菜品含有时系统会提醒",
    custom_label: "添加其他过敏原（可自行输入）",
    custom_placeholder: "例如：芒果、蘑菇、香菜",
    add: "添加",
    step2_title: "2. 拍照 / 上传菜单",
    step2_hint: "用相机拍下店里的菜单，或从设备上传图片",
    take_photo: "📷 拍照",
    upload_photo: "🖼️ 上传",
    or_type: "或自己输入菜名",
    type_placeholder: "例如：泰式炒河粉配虾",
    analyze_btn: "🔍 分析菜单",
    loading: "正在分析...",
    footer: "由 Typhoon OCR + Typhoon LLM 提供 · 泰国食物数据库",

    alert_title_multi_some: "在 {total} 道菜中发现 {alerted} 道含您过敏原",
    alert_desc_multi_some: "向下滚动查看详情 — 请避开标有 ⚠️ 的菜品",
    alert_title_multi_safe: "安全 — 没有菜品含您选择的过敏原",
    alert_desc_multi_safe: "已分析 {total} 道菜，均不含您勾选的过敏原",
    alert_title_multi_info: "已分析 {total} 道菜",
    alert_desc_multi_info: "请在上方选择您的过敏原以获取提醒",
    alert_title_single_warn: "警告！这道菜含有您的过敏原",
    alert_desc_single_warn: "发现 {n} 种过敏原 — 建议避开",
    alert_title_single_safe: "安全",
    alert_desc_single_safe: "未发现您勾选的过敏原",

    section_alerted: "⚠️ 含过敏原的菜品 ({n})",
    section_safe: "✅ 安全菜品 ({n})",
    see_details: "查看详情",
    ingredients_label: "主要食材",
    no_ingredients: "暂无食材信息",
    allergens_label: "可能含有的过敏原",
    no_allergens: "未检测到过敏原",
    source_db: "📚 数据库",
    source_db_fuzzy: "📚 数据库 (相似)",
    source_ai: "🤖 AI",
    source_web: "🌐 网络+AI",
    conf_high: "高准确度",
    conf_medium: "中等准确度",
    conf_low: "低准确度",

    debug_summary: "🔍 检测到的内容",
    debug_db_match: "数据库匹配：{db} 道菜 · LLM 提取：{llm} 个名称",
    debug_llm_names: "LLM 提取的名称：",
    debug_no_llm: "LLM 未返回菜单名称",
    debug_ocr: "OCR 文本：",
    error_prefix: "❌ ",
  },
};

const LANG_KEY = "allergy_app_lang";
const LANG_CYCLE = ["th", "en", "zh"];
const LANG_BUTTON_LABEL = { th: "ไทย", en: "EN", zh: "中文" };

let currentLang = localStorage.getItem(LANG_KEY) || "th";
if (!LANG_CYCLE.includes(currentLang)) currentLang = "th";

function t(key, vars = {}) {
  let str = (I18N[currentLang] && I18N[currentLang][key]) || key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }
  return str;
}

// Returns the localized name for an allergen, falling back gracefully.
function allergenLabel(a) {
  if (!a) return "";
  if (currentLang === "zh") {
    const key = a.key && a.key.startsWith("custom:") ? null : a.key;
    return (key && ALLERGEN_LABELS_ZH[key]) || a.en || a.th || "";
  }
  if (currentLang === "en") return a.en || a.th || "";
  return a.th || a.en || "";
}

function nextLang() {
  const idx = LANG_CYCLE.indexOf(currentLang);
  return LANG_CYCLE[(idx + 1) % LANG_CYCLE.length];
}

function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  const customInput = document.getElementById("customInput");
  if (customInput) customInput.placeholder = t("custom_placeholder");
  const textInput = document.getElementById("textInput");
  if (textInput) textInput.placeholder = t("type_placeholder");
  // Toggle "active" class on the 3 lang buttons
  document.querySelectorAll(".lang-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === currentLang);
  });
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  applyTranslations();
  document.dispatchEvent(new CustomEvent("langChanged", { detail: lang }));
}
