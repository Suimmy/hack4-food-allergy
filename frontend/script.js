const API_BASE = window.location.origin;
const STORAGE_KEY = "allergy_app_selected";
const CUSTOM_KEY = "allergy_app_custom";

const allergyList = document.getElementById("allergyList");
const customInput = document.getElementById("customInput");
const customChips = document.getElementById("customChips");
const addCustomBtn = document.getElementById("addCustomBtn");
const cameraInput = document.getElementById("cameraInput");
const fileInput = document.getElementById("fileInput");
const textInput = document.getElementById("textInput");
const previewWrap = document.getElementById("previewWrap");
const preview = document.getElementById("preview");
const clearBtn = document.getElementById("clearBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const resultSection = document.getElementById("resultSection");
const resultContent = document.getElementById("resultContent");
const loading = document.getElementById("loading");
const langToggle = document.getElementById("langToggle");

let selectedAllergies = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
let customAllergies = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
let allergensList = [];
let currentImageFile = null;
let lastResultData = null;

// ----- language toggle -----
applyTranslations();
langToggle.addEventListener("click", () => {
  setLang(nextLang());
});
document.addEventListener("langChanged", () => {
  renderAllergyChips(allergensList);
  renderCustomChips();
  if (lastResultData) renderResult(lastResultData);
});

// ----- allergens -----
async function loadAllergens() {
  try {
    const r = await fetch(`${API_BASE}/api/allergens`);
    allergensList = await r.json();
    renderAllergyChips(allergensList);
  } catch (err) {
    allergyList.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

function renderAllergyChips(list) {
  allergyList.innerHTML = "";
  list.forEach((a) => {
    const chip = document.createElement("div");
    const label = allergenLabel(a);
    chip.className = "chip" + (selectedAllergies.has(a.key) ? " active" : "");
    chip.innerHTML = `<span class="icon">${a.icon}</span><span>${escapeHtml(label)}</span>`;
    chip.addEventListener("click", () => {
      if (selectedAllergies.has(a.key)) {
        selectedAllergies.delete(a.key);
        chip.classList.remove("active");
      } else {
        selectedAllergies.add(a.key);
        chip.classList.add("active");
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...selectedAllergies]));
    });
    allergyList.appendChild(chip);
  });
}

function renderCustomChips() {
  customChips.innerHTML = "";
  customAllergies.forEach((term, idx) => {
    const chip = document.createElement("div");
    chip.className = "chip custom-chip active";
    chip.innerHTML = `<span class="icon">⚠️</span><span>${escapeHtml(term)}</span><span class="remove-x">×</span>`;
    chip.querySelector(".remove-x").addEventListener("click", (e) => {
      e.stopPropagation();
      customAllergies.splice(idx, 1);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(customAllergies));
      renderCustomChips();
    });
    customChips.appendChild(chip);
  });
}

function addCustomAllergy() {
  const v = customInput.value.trim();
  if (!v) return;
  if (!customAllergies.includes(v)) {
    customAllergies.push(v);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customAllergies));
    renderCustomChips();
  }
  customInput.value = "";
}

addCustomBtn.addEventListener("click", addCustomAllergy);
customInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addCustomAllergy();
  }
});

// ----- image upload -----
function setImageFile(file) {
  if (!file) return;
  currentImageFile = file;
  preview.src = URL.createObjectURL(file);
  previewWrap.classList.remove("hidden");
  textInput.value = "";
  updateButtonState();
}

function clearImage() {
  currentImageFile = null;
  cameraInput.value = "";
  fileInput.value = "";
  preview.src = "";
  previewWrap.classList.add("hidden");
  updateButtonState();
}

function updateButtonState() {
  const hasInput = currentImageFile !== null || textInput.value.trim().length > 0;
  analyzeBtn.disabled = !hasInput;
}

cameraInput.addEventListener("change", (e) => setImageFile(e.target.files[0]));
fileInput.addEventListener("change", (e) => setImageFile(e.target.files[0]));
clearBtn.addEventListener("click", clearImage);
textInput.addEventListener("input", updateButtonState);

// ----- analyze -----
analyzeBtn.addEventListener("click", async () => {
  resultSection.classList.remove("hidden");
  resultContent.innerHTML = "";
  loading.classList.remove("hidden");

  const fd = new FormData();
  fd.append("allergies", JSON.stringify([...selectedAllergies]));
  fd.append("custom_allergies", JSON.stringify(customAllergies));

  const typed = textInput.value.trim();
  if (typed) {
    fd.append("text", typed);
  } else if (currentImageFile) {
    fd.append("image", currentImageFile);
  } else {
    return;
  }

  try {
    const r = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: fd });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: "Error" }));
      throw new Error(err.detail || `HTTP ${r.status}`);
    }
    lastResultData = await r.json();
    renderResult(lastResultData);
  } catch (err) {
    resultContent.innerHTML = `<div class="error">${t("error_prefix")}${escapeHtml(err.message)}</div>`;
  } finally {
    loading.classList.add("hidden");
  }
});

// ----- result rendering -----
function renderDishCard(dish) {
  const cls = dish.has_alert ? "dish-card danger" : "dish-card safe";
  const headerIcon = dish.has_alert ? "⚠️" : "✅";

  const alertList = dish.alerts?.length
    ? `<ul class="alert-list">${dish.alerts
        .map((a) => `<li class="badge">${a.icon} ${escapeHtml(allergenLabel(a))}</li>`)
        .join("")}</ul>`
    : "";

  const ingredients = dish.ingredients?.length
    ? `<ul class="ingredient-list">${dish.ingredients
        .map((i) => `<li>${escapeHtml(i)}</li>`)
        .join("")}</ul>`
    : `<p class="hint inline">${t("no_ingredients")}</p>`;

  const allergens = dish.allergens_info?.length
    ? `<div class="allergen-summary">${dish.allergens_info
        .map((a) => `<span class="allergen-tag">${a.icon} ${escapeHtml(allergenLabel(a))}</span>`)
        .join("")}</div>`
    : `<p class="hint inline">${t("no_allergens")}</p>`;

  let sourceLabel = t("source_ai");
  if (dish.source === "local_db") sourceLabel = t("source_db");
  else if (dish.source === "local_db_fuzzy") {
    const ratio = dish.match_ratio ? ` (${Math.round(dish.match_ratio * 100)}%)` : "";
    sourceLabel = t("source_db_fuzzy") + ratio;
  } else if (dish.source === "typhoon_llm") sourceLabel = t("source_ai");

  const confidenceLabel = {
    high: t("conf_high"),
    medium: t("conf_medium"),
    low: t("conf_low"),
  }[dish.confidence] || dish.confidence;

  // Primary dish name by current language; secondary is whichever is different
  let dishName, dishSecondary;
  if (currentLang === "en" && dish.dish_name_en) {
    dishName = dish.dish_name_en;
    dishSecondary = dish.dish_name_th;
  } else {
    // TH and ZH both default to Thai name (DB has no Chinese names yet)
    dishName = dish.dish_name_th || dish.query;
    dishSecondary = dish.dish_name_en;
  }

  return `
    <div class="${cls}">
      <div class="dish-header">
        <span class="dish-icon">${headerIcon}</span>
        <div>
          <h3 class="dish-name">${escapeHtml(dishName)}</h3>
          ${dishSecondary ? `<p class="dish-en">${escapeHtml(dishSecondary)}</p>` : ""}
        </div>
      </div>
      ${alertList}
      <details class="dish-details">
        <summary>${t("see_details")}</summary>
        <p class="section-title">${t("ingredients_label")}</p>
        ${ingredients}
        <p class="section-title">${t("allergens_label")}</p>
        ${allergens}
        <div class="meta">
          <span>${sourceLabel}</span>
          <span>${confidenceLabel}</span>
        </div>
      </details>
    </div>
  `;
}

function renderResult(data) {
  const dishes = data.dishes || [];
  const alerted = dishes.filter((d) => d.has_alert);
  const safe = dishes.filter((d) => !d.has_alert);
  const hasUserAllergies = selectedAllergies.size > 0 || customAllergies.length > 0;

  let summary = "";
  if (data.is_menu) {
    if (alerted.length > 0) {
      summary = `
        <div class="summary-banner danger">
          <span class="summary-icon">⚠️</span>
          <div>
            <h2>${t("alert_title_multi_some", { alerted: alerted.length, total: dishes.length })}</h2>
            <p>${t("alert_desc_multi_some")}</p>
          </div>
        </div>`;
    } else if (hasUserAllergies) {
      summary = `
        <div class="summary-banner safe">
          <span class="summary-icon">✅</span>
          <div>
            <h2>${t("alert_title_multi_safe")}</h2>
            <p>${t("alert_desc_multi_safe", { total: dishes.length })}</p>
          </div>
        </div>`;
    } else {
      summary = `
        <div class="summary-banner info">
          <span class="summary-icon">ℹ️</span>
          <div>
            <h2>${t("alert_title_multi_info", { total: dishes.length })}</h2>
            <p>${t("alert_desc_multi_info")}</p>
          </div>
        </div>`;
    }
  } else if (dishes.length === 1) {
    const d = dishes[0];
    if (d.has_alert) {
      summary = `
        <div class="summary-banner danger">
          <span class="summary-icon">⚠️</span>
          <div>
            <h2>${t("alert_title_single_warn")}</h2>
            <p>${t("alert_desc_single_warn", { n: d.alerts.length })}</p>
          </div>
        </div>`;
    } else if (hasUserAllergies) {
      summary = `
        <div class="summary-banner safe">
          <span class="summary-icon">✅</span>
          <div>
            <h2>${t("alert_title_single_safe")}</h2>
            <p>${t("alert_desc_single_safe")}</p>
          </div>
        </div>`;
    }
  }

  const alertedHtml = alerted.length
    ? `<p class="section-title danger-title">${t("section_alerted", { n: alerted.length })}</p>
       ${alerted.map(renderDishCard).join("")}`
    : "";
  const safeHtml = safe.length
    ? `<p class="section-title safe-title">${t("section_safe", { n: safe.length })}</p>
       ${safe.map(renderDishCard).join("")}`
    : "";

  const debugHtml = data.is_menu
    ? `<details class="debug">
         <summary>${t("debug_summary")}</summary>
         <p class="hint inline">${t("debug_db_match", { db: data.db_matched_count || 0, llm: data.extracted_names?.length || 0 })}</p>
         ${data.extracted_names?.length
           ? `<p class="hint inline">${t("debug_llm_names")}</p>
              <ul class="ingredient-list">${data.extracted_names.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
           : `<p class="hint inline">${t("debug_no_llm")}</p>`}
         <p class="hint inline" style="margin-top:0.7rem">${t("debug_ocr")}</p>
         <pre class="ocr-raw">${escapeHtml(data.ocr_text || "")}</pre>
       </details>`
    : "";

  resultContent.innerHTML = `${summary}${alertedHtml}${safeHtml}${debugHtml}`;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

renderCustomChips();
loadAllergens();
