const API_BASE = window.location.origin;
const STORAGE_KEY = "allergy_app_selected";

const allergyList = document.getElementById("allergyList");
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

let selectedAllergies = new Set(
  JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
);
let currentImageFile = null;

async function loadAllergens() {
  try {
    const r = await fetch(`${API_BASE}/api/allergens`);
    const list = await r.json();
    renderAllergyChips(list);
  } catch (err) {
    allergyList.innerHTML = `<p class="error">โหลดรายการสารก่อภูมิแพ้ไม่ได้: ${err.message}</p>`;
  }
}

function renderAllergyChips(list) {
  allergyList.innerHTML = "";
  list.forEach((a) => {
    const chip = document.createElement("div");
    chip.className = "chip" + (selectedAllergies.has(a.key) ? " active" : "");
    chip.innerHTML = `<span class="icon">${a.icon}</span><span>${a.th}</span>`;
    chip.addEventListener("click", () => {
      if (selectedAllergies.has(a.key)) {
        selectedAllergies.delete(a.key);
        chip.classList.remove("active");
      } else {
        selectedAllergies.add(a.key);
        chip.classList.add("active");
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([...selectedAllergies])
      );
    });
    allergyList.appendChild(chip);
  });
}

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

analyzeBtn.addEventListener("click", async () => {
  resultSection.classList.remove("hidden");
  resultContent.innerHTML = "";
  loading.classList.remove("hidden");

  const fd = new FormData();
  fd.append("allergies", JSON.stringify([...selectedAllergies]));

  // Prefer text input over image if user typed something — avoids OCR + API key
  const typed = textInput.value.trim();
  if (typed) {
    fd.append("text", typed);
  } else if (currentImageFile) {
    fd.append("image", currentImageFile);
  } else {
    return;
  }

  try {
    const r = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      body: fd,
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: "เกิดข้อผิดพลาด" }));
      throw new Error(err.detail || `HTTP ${r.status}`);
    }
    const data = await r.json();
    renderResult(data);
  } catch (err) {
    resultContent.innerHTML = `<div class="error">❌ ${err.message}</div>`;
  } finally {
    loading.classList.add("hidden");
  }
});

function renderDishCard(dish, index) {
  const cls = dish.has_alert ? "dish-card danger" : "dish-card safe";
  const headerIcon = dish.has_alert ? "⚠️" : "✅";

  const alertList = dish.alerts?.length
    ? `<ul class="alert-list">${dish.alerts
        .map((a) => `<li class="badge">${a.icon} ${a.th}</li>`)
        .join("")}</ul>`
    : "";

  const ingredients = dish.ingredients?.length
    ? `<ul class="ingredient-list">${dish.ingredients
        .map((i) => `<li>${escapeHtml(i)}</li>`)
        .join("")}</ul>`
    : `<p class="hint inline">ไม่มีข้อมูลวัตถุดิบ</p>`;

  const allergens = dish.allergens_info?.length
    ? `<div class="allergen-summary">${dish.allergens_info
        .map((a) => `<span class="allergen-tag">${a.icon} ${a.th}</span>`)
        .join("")}</div>`
    : `<p class="hint inline">ไม่พบสารก่อภูมิแพ้ทั่วไป</p>`;

  const sourceLabel =
    dish.source === "local_db" ? "📚 DB" : "🤖 AI";
  const confidenceLabel = {
    high: "แม่นยำสูง",
    medium: "แม่นยำปานกลาง",
    low: "แม่นยำต่ำ",
  }[dish.confidence] || dish.confidence;

  return `
    <div class="${cls}">
      <div class="dish-header">
        <span class="dish-icon">${headerIcon}</span>
        <div>
          <h3 class="dish-name">${escapeHtml(dish.dish_name_th || dish.query)}</h3>
          ${dish.dish_name_en ? `<p class="dish-en">${escapeHtml(dish.dish_name_en)}</p>` : ""}
        </div>
      </div>
      ${alertList}
      <details class="dish-details">
        <summary>ดูรายละเอียด</summary>
        <p class="section-title">วัตถุดิบหลัก</p>
        ${ingredients}
        <p class="section-title">สารก่อภูมิแพ้ที่อาจมี</p>
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

  let summary = "";
  if (data.is_menu) {
    if (alerted.length > 0) {
      summary = `
        <div class="summary-banner danger">
          <span class="summary-icon">⚠️</span>
          <div>
            <h2>พบเมนูที่คุณแพ้ ${alerted.length} จาก ${dishes.length} เมนู</h2>
            <p>เลื่อนลงดูรายละเอียดและหลีกเลี่ยงเมนูที่มีเครื่องหมาย ⚠️</p>
          </div>
        </div>
      `;
    } else if (selectedAllergies.size > 0) {
      summary = `
        <div class="summary-banner safe">
          <span class="summary-icon">✅</span>
          <div>
            <h2>ปลอดภัย — ทุกเมนูไม่มีสิ่งที่คุณแพ้</h2>
            <p>วิเคราะห์ ${dishes.length} เมนู ไม่พบสารก่อภูมิแพ้ที่คุณติ๊กไว้</p>
          </div>
        </div>
      `;
    } else {
      summary = `
        <div class="summary-banner info">
          <span class="summary-icon">ℹ️</span>
          <div>
            <h2>วิเคราะห์ ${dishes.length} เมนู</h2>
            <p>ติ๊กสารก่อภูมิแพ้ของคุณด้านบนเพื่อให้ระบบแจ้งเตือน</p>
          </div>
        </div>
      `;
    }
  } else if (dishes.length === 1) {
    const d = dishes[0];
    if (d.has_alert) {
      summary = `
        <div class="summary-banner danger">
          <span class="summary-icon">⚠️</span>
          <div>
            <h2>คำเตือน! เมนูนี้มีสิ่งที่คุณแพ้</h2>
            <p>เจอสารก่อภูมิแพ้ ${d.alerts.length} รายการ — ควรหลีกเลี่ยง</p>
          </div>
        </div>
      `;
    } else if (selectedAllergies.size > 0) {
      summary = `
        <div class="summary-banner safe">
          <span class="summary-icon">✅</span>
          <div>
            <h2>ปลอดภัย</h2>
            <p>ไม่พบสารก่อภูมิแพ้ที่คุณติ๊กไว้</p>
          </div>
        </div>
      `;
    }
  }

  const alertedHtml = alerted.length
    ? `<p class="section-title danger-title">⚠️ เมนูที่คุณแพ้ (${alerted.length})</p>
       ${alerted.map(renderDishCard).join("")}`
    : "";
  const safeHtml = safe.length
    ? `<p class="section-title safe-title">✅ เมนูปลอดภัย (${safe.length})</p>
       ${safe.map(renderDishCard).join("")}`
    : "";

  const debugHtml = data.is_menu
    ? `<details class="debug">
         <summary>🔍 ดูสิ่งที่ตรวจจับได้ (debug)</summary>
         <p class="hint inline">DB match: <strong>${data.db_matched_count}</strong> เมนู · LLM extract: <strong>${data.extracted_names?.length || 0}</strong> ชื่อ</p>
         ${data.extracted_names?.length
           ? `<p class="hint inline">ชื่อจาก LLM:</p>
              <ul class="ingredient-list">${data.extracted_names.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
           : `<p class="hint inline">LLM ไม่ได้ส่งชื่อเมนูกลับมา</p>`}
         <p class="hint inline" style="margin-top:0.7rem">OCR text:</p>
         <pre class="ocr-raw">${escapeHtml(data.ocr_text || "")}</pre>
       </details>`
    : "";

  resultContent.innerHTML = `
    ${summary}
    ${alertedHtml}
    ${safeHtml}
    ${debugHtml}
  `;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

loadAllergens();
