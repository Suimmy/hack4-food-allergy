import os
import json
import base64
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
ALLERGY_FILE = ROOT / "data" / "allergy.json"
RECIPE_FILE = ROOT / "data" / "recipe.json"
FRONTEND_DIR = ROOT / "frontend"

load_dotenv(ROOT / ".env")

TYPHOON_API_KEY = os.getenv("TYPHOON_API_KEY", "")
TYPHOON_CHAT_URL = "https://api.opentyphoon.ai/v1/chat/completions"
TYPHOON_OCR_MODEL = os.getenv("TYPHOON_OCR_MODEL", "typhoon-ocr")
TYPHOON_CHAT_MODEL = os.getenv("TYPHOON_CHAT_MODEL", "typhoon-v2.1-12b-instruct")

with open(ALLERGY_FILE, "r", encoding="utf-8") as f:
    ALLERGENS = json.load(f)["allergens"]

with open(RECIPE_FILE, "r", encoding="utf-8") as f:
    DISHES = json.load(f)["dishes"]

# Backwards-compat shim so the rest of the code can keep using FOODS["allergens"] / FOODS["dishes"]
FOODS = {"allergens": ALLERGENS, "dishes": DISHES}


app = FastAPI(title="Thai Food Allergy Detector")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    text: str
    allergies: list[str] = []


def normalize(s: str) -> str:
    return re.sub(r"\s+", "", s.lower().strip())


def find_dish_local(text: str) -> Optional[dict]:
    """Match a single dish name against the local food database (best score wins)."""
    if not text:
        return None
    norm_text = normalize(text)
    best = None
    best_score = 0

    for dish in FOODS["dishes"]:
        candidates = [dish["name_th"], dish["name_en"]] + dish.get("aliases", [])
        for cand in candidates:
            nc = normalize(cand)
            if not nc:
                continue
            if nc in norm_text or norm_text in nc:
                score = len(nc)
                if score > best_score:
                    best_score = score
                    best = dish
    return best


def find_dish_fuzzy(name: str, threshold: float = 0.72) -> Optional[tuple[dict, float]]:
    """Fuzzy match a name against DB using SequenceMatcher.

    Useful for OCR errors:
      "ส้มตำปูปลา"  → matches "ส้มตำปูปลาร้า" (truncated)
      "ต้มจี๊ด"    → matches "ต้มจืด"        (vowel confusion)

    Returns (dish, ratio) or None if no candidate exceeds threshold.
    """
    if not name:
        return None
    target = normalize(name)
    if len(target) < 3:
        return None

    best: Optional[tuple[dict, float]] = None
    for dish in FOODS["dishes"]:
        candidates = [dish["name_th"], dish["name_en"]] + dish.get("aliases", [])
        for cand in candidates:
            nc = normalize(cand)
            if not nc or len(nc) < 3:
                continue
            ratio = SequenceMatcher(None, target, nc).ratio()
            # Prefix bonus: if one is a prefix of the other, boost score
            if target.startswith(nc) or nc.startswith(target):
                ratio = max(ratio, 0.85)
            if ratio >= threshold and (best is None or ratio > best[1]):
                best = (dish, ratio)
    return best


def find_all_local_matches(text: str) -> list[dict]:
    """Find ALL DB dishes that appear in the text. Uses longest-first matching
    with masking so longer dish names take priority over shorter aliases."""
    if not text:
        return []
    text = _strip_ocr_wrapper(text)
    norm_text = normalize(text)

    pairs: list[tuple[dict, str]] = []
    for dish in FOODS["dishes"]:
        names = [dish["name_th"], dish["name_en"]] + dish.get("aliases", [])
        for n in names:
            nn = normalize(n)
            if nn and len(nn) >= 3:
                pairs.append((dish, nn))
    pairs.sort(key=lambda p: -len(p[1]))

    found: dict[str, dict] = {}
    masked = list(norm_text)
    sentinel = "\0"

    for dish, alias_norm in pairs:
        if dish["name_th"] in found:
            continue
        haystack = "".join(masked)
        idx = haystack.find(alias_norm)
        if idx >= 0:
            found[dish["name_th"]] = dish
            for i in range(idx, idx + len(alias_norm)):
                masked[i] = sentinel

    return list(found.values())


async def typhoon_ocr(image_bytes: bytes, mime: str = "image/jpeg") -> str:
    """Call typhoon-ocr via chat completions vision API."""
    if not TYPHOON_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="ยังไม่ได้ตั้งค่า TYPHOON_API_KEY ใน .env — ใส่ API key หรือใช้พิมพ์ชื่อเมนูแทนได้",
        )

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    headers = {
        "Authorization": f"Bearer {TYPHOON_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": TYPHOON_OCR_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "อ่านข้อความเมนูอาหารทั้งหมดจากรูปนี้อย่างละเอียด "
                            "ลิสต์ชื่อเมนูทุกรายการที่เห็น คั่นด้วยขึ้นบรรทัดใหม่ "
                            "ถ้ามีหลายคอลัมน์ให้อ่านครบทุกคอลัมน์ "
                            "ถ้ามีลำดับที่ (เช่น 1, 2, 3...) ให้คงไว้ "
                            "ห้ามอธิบายเพิ่ม ห้ามสรุป"
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"},
                    },
                ],
            }
        ],
        "max_tokens": 8192,
        "temperature": 0.0,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        try:
            r = await client.post(TYPHOON_CHAT_URL, headers=headers, json=payload)
            if r.status_code == 401:
                raise HTTPException(
                    status_code=401,
                    detail="Typhoon API key ไม่ถูกต้อง (401) — ตรวจสอบ TYPHOON_API_KEY ใน .env",
                )
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"]
        except HTTPException:
            raise
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Typhoon OCR error: {e.response.status_code} {e.response.text[:200]}",
            )


async def typhoon_lookup_ingredients(dish_name: str, use_web: bool = True) -> dict:
    """Ask Typhoon LLM to identify ingredients & allergens for an unknown dish.

    If `use_web` is True, fetch web snippets via DuckDuckGo and feed as context (RAG).
    """
    if not TYPHOON_API_KEY:
        return {"ingredients": [], "allergens": [], "confidence": "low"}

    web_context = ""
    if use_web:
        web_context = await web_search_ingredients(dish_name)

    allergen_list = ", ".join(
        [f"{k} ({v['th']})" for k, v in FOODS["allergens"].items()]
    )

    system = (
        "คุณเป็นผู้เชี่ยวชาญด้านอาหาร หน้าที่คือบอกวัตถุดิบหลักของเมนูอาหารอย่างย่อ "
        "และระบุสารก่อภูมิแพ้ที่อาจมี ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น"
    )
    web_block = f"\nข้อมูลจากเว็บ:\n{web_context}\n" if web_context else ""
    user = (
        f"เมนู: {dish_name}\n"
        f"รายการสารก่อภูมิแพ้ที่ต้องเลือกจาก (ใช้ key ภาษาอังกฤษ): {allergen_list}"
        f"{web_block}\n"
        "ตอบในรูปแบบ JSON นี้เท่านั้น:\n"
        '{"ingredients": ["วัตถุดิบ1", "วัตถุดิบ2", ...], '
        '"allergens": ["key1", "key2", ...], '
        '"confidence": "high|medium|low"}'
    )

    payload = {
        "model": TYPHOON_CHAT_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": 512,
        "temperature": 0.2,
    }
    headers = {
        "Authorization": f"Bearer {TYPHOON_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(TYPHOON_CHAT_URL, headers=headers, json=payload)
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"Typhoon LLM lookup failed: {e}")
        return {
            "ingredients": [],
            "allergens": [],
            "confidence": "low",
            "error": str(e)[:200],
        }

    m = re.search(r"\{.*\}", content, re.DOTALL)
    if not m:
        return {"ingredients": [], "allergens": [], "confidence": "low", "raw": content}
    try:
        result = json.loads(m.group(0))
        known = set(FOODS["allergens"].keys())
        result["allergens"] = [a for a in result.get("allergens", []) if a in known]
        if web_context:
            result["used_web"] = True
        return result
    except json.JSONDecodeError:
        return {"ingredients": [], "allergens": [], "confidence": "low", "raw": content}


def _strip_ocr_wrapper(text: str) -> str:
    """typhoon-ocr sometimes returns {"natural_text": "..."} — unwrap it."""
    s = text.strip()
    if s.startswith("{") and "natural_text" in s:
        try:
            obj = json.loads(s)
            if isinstance(obj, dict) and "natural_text" in obj:
                return str(obj["natural_text"])
        except json.JSONDecodeError:
            m = re.search(r'"natural_text"\s*:\s*"((?:[^"\\]|\\.)*)"', s, re.DOTALL)
            if m:
                return m.group(1).encode().decode("unicode_escape")
    return text


def heuristic_extract_dishes(ocr_text: str) -> list[str]:
    """Extract dish names from OCR text using regex — works without LLM.

    Handles:
      - Markdown headers (### name, ## name)
      - Markdown table rows (| name | price |)
      - Numbered lists (1 ชื่อเมนู, 1. ชื่อเมนู, ① ชื่อเมนู)
      - Price-tagged lines (ลาบหมู 50 บาท)
      - Bullet lists (- ชื่อเมนู, • ชื่อเมนู)
    """
    text = _strip_ocr_wrapper(ocr_text)
    candidates: list[str] = []

    PRICE_RE = re.compile(r"\d+(\.\d+)?\s*(บาท|baht|thb|\.\-|\.)\s*$", re.I)
    JUNK_RE = re.compile(
        r"^(หมายเหตุ|เปิดบริการ|ร้าน|menu|sale\s*here|แจกลิสต์|"
        r"\d+\s*เมนู|เก็บไว้|tel|โทร|line\b|fb\b|ig\b|http)",
        re.I,
    )
    SECTION_HEADER_RE = re.compile(
        r"^(ข้าวจานเดียว|เมนูเส้น|เมนูส้มตำ|เมนูลาบ|เมนูต้ม|เมนูแกง|เมนูยำ|"
        r"ของทอด|ของหวาน|เครื่องดื่ม|ต้ม\s*แกง|และอื่นๆ)\s*$"
    )

    def add(cand: str):
        cand = cand.strip(" \t.-•*#|:")
        cand = PRICE_RE.sub("", cand).strip()
        if not cand or len(cand) < 2:
            return
        if JUNK_RE.search(cand) or SECTION_HEADER_RE.search(cand):
            return
        # Reject if it's just digits or punctuation
        if not re.search(r"[ก-๛a-zA-Z]", cand):
            return
        candidates.append(cand)

    # Markdown headers
    for m in re.finditer(r"^\s*#{2,4}\s+(.+?)\s*$", text, re.M):
        add(m.group(1))

    # Markdown table rows: extract first cell only
    for m in re.finditer(r"^\s*\|\s*([^|]+?)\s*\|", text, re.M):
        cell = m.group(1).strip()
        if cell in ("---", "") or set(cell) <= {"-", " "}:
            continue
        add(cell)

    # Numbered list: "1 ชื่อ", "1. ชื่อ", "1) ชื่อ", "①ชื่อ"
    NUMBERED_RE = re.compile(
        r"^\s*(?:\d{1,3}[\.\)\s]|[①-⓿❶-➓])\s*(.+?)\s*$",
        re.M,
    )
    for m in NUMBERED_RE.finditer(text):
        add(m.group(1))

    # "name <space> price <space> บาท"
    for line in text.splitlines():
        line = line.strip(" \t-•*#|")
        if not line or len(line) < 3:
            continue
        m = re.match(r"^(.+?)\s+\d+(\.\d+)?\s*(บาท|baht|thb)\b", line, re.I)
        if m:
            add(m.group(1))

    # Bullet lists: "- ชื่อ", "• ชื่อ"
    for m in re.finditer(r"^\s*[-•*]\s+(.+?)\s*$", text, re.M):
        add(m.group(1))

    return candidates


async def extract_dish_names(ocr_text: str) -> list[str]:
    """Extract clean dish names from messy OCR text.

    Strategy: ALWAYS run regex heuristics + try LLM, then merge & dedupe.
    Heuristics catch markdown headers / table rows reliably; LLM catches free-form text.
    """
    if not ocr_text.strip():
        return []

    cleaned = _strip_ocr_wrapper(ocr_text)
    heuristic_names = heuristic_extract_dishes(ocr_text)

    llm_names: list[str] = []
    if TYPHOON_API_KEY:
        system = (
            "คุณเป็นผู้ช่วยแยกชื่อเมนูอาหารจากข้อความเมนูร้านอาหาร "
            "ตอบเป็น JSON array ของชื่อเมนูเท่านั้น ห้ามมีข้อความอื่น "
            "ห้ามใส่ราคา หมายเลขโทรศัพท์ ชื่อร้าน หรือเวลาทำการ"
        )
        user = (
            f"ข้อความจาก OCR เมนูร้านอาหาร:\n```\n{cleaned[:4000]}\n```\n\n"
            "ดึงชื่อเมนูอาหารทั้งหมด ตอบในรูปแบบ JSON array นี้เท่านั้น:\n"
            '["เมนู1", "เมนู2", ...]'
        )

        payload = {
            "model": TYPHOON_CHAT_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": 1024,
            "temperature": 0.0,
        }
        headers = {
            "Authorization": f"Bearer {TYPHOON_API_KEY}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(TYPHOON_CHAT_URL, headers=headers, json=payload)
                r.raise_for_status()
                content = r.json()["choices"][0]["message"]["content"]
            m = re.search(r"\[.*\]", content, re.DOTALL)
            if m:
                parsed = json.loads(m.group(0))
                llm_names = [
                    str(n).strip()
                    for n in parsed
                    if isinstance(n, (str, int, float)) and str(n).strip()
                ]
        except Exception as e:
            print(f"extract_dish_names LLM failed: {e}")

    # Merge heuristic + LLM, dedupe by normalized form
    seen: set[str] = set()
    merged: list[str] = []
    for name in llm_names + heuristic_names:
        key = normalize(name)
        if key and key not in seen:
            seen.add(key)
            merged.append(name)
    return merged


async def analyze_dish_name(name: str) -> dict:
    """Analyze a single dish name: exact DB → fuzzy DB → Typhoon LLM."""
    dish = find_dish_local(name)
    if dish:
        return {
            "source": "local_db",
            "dish_name_th": dish["name_th"],
            "dish_name_en": dish["name_en"],
            "query": name,
            "ingredients": dish["ingredients"],
            "allergens_detected": dish["allergens"],
            "confidence": "high",
        }
    fuzzy = find_dish_fuzzy(name)
    if fuzzy:
        d, ratio = fuzzy
        return {
            "source": "local_db_fuzzy",
            "dish_name_th": d["name_th"],
            "dish_name_en": d["name_en"],
            "query": name,
            "match_ratio": round(ratio, 2),
            "ingredients": d["ingredients"],
            "allergens_detected": d["allergens"],
            "confidence": "medium" if ratio < 0.85 else "high",
        }
    llm_result = await typhoon_lookup_ingredients(name)
    return {
        "source": "typhoon_llm",
        "dish_name_th": name,
        "dish_name_en": "",
        "query": name,
        "ingredients": llm_result.get("ingredients", []),
        "allergens_detected": llm_result.get("allergens", []),
        "confidence": llm_result.get("confidence", "low"),
    }


def check_allergens(
    allergens_in_dish: list[str],
    user_allergies: list[str],
    ingredients: list[str] | None = None,
    custom_allergies: list[str] | None = None,
) -> list[dict]:
    """Return list of allergen alerts:
    - Built-in allergen matches (key vs key)
    - Custom allergen substring matches against the dish ingredients list
    """
    matched: list[dict] = []
    for a in allergens_in_dish:
        if a in user_allergies and a in FOODS["allergens"]:
            info = FOODS["allergens"][a]
            matched.append({"key": a, "type": "builtin", **info})

    if custom_allergies and ingredients:
        ing_blob = " ".join(ingredients).lower()
        for term in custom_allergies:
            t = term.strip().lower()
            if t and t in ing_blob:
                matched.append({
                    "key": f"custom:{term}",
                    "type": "custom",
                    "th": term,
                    "en": term,
                    "icon": "⚠️",
                })
    return matched


async def web_search_ingredients(dish_name: str, max_results: int = 3) -> str:
    """Search the web for dish ingredients via DuckDuckGo. Returns concatenated snippets."""
    try:
        from ddgs import DDGS
    except ImportError:
        return ""

    query = f"{dish_name} วัตถุดิบ ส่วนประกอบ"
    snippets: list[str] = []
    try:
        with DDGS() as ddgs:
            for r in ddgs.text(query, region="th-th", max_results=max_results):
                title = r.get("title", "")
                body = r.get("body", "")
                if body:
                    snippets.append(f"- {title}: {body}")
    except Exception as e:
        print(f"Web search failed: {e}")
        return ""
    return "\n".join(snippets)


@app.get("/api/allergens")
async def get_allergens():
    """List all available allergens for UI selection."""
    return [
        {"key": k, "th": v["th"], "en": v["en"], "icon": v["icon"]}
        for k, v in FOODS["allergens"].items()
    ]


def enrich_dish_result(
    result: dict,
    user_allergies: list[str],
    custom_allergies: list[str] | None = None,
) -> dict:
    """Add alerts + allergen display info to a dish result."""
    alerts = check_allergens(
        result["allergens_detected"],
        user_allergies,
        ingredients=result.get("ingredients", []),
        custom_allergies=custom_allergies,
    )
    result["alerts"] = alerts
    result["has_alert"] = len(alerts) > 0
    result["allergens_info"] = [
        {"key": k, **FOODS["allergens"][k]}
        for k in result["allergens_detected"]
        if k in FOODS["allergens"]
    ]
    return result


@app.post("/api/analyze")
async def analyze(
    image: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    allergies: str = Form("[]"),
    custom_allergies: str = Form("[]"),
):
    """Receive image (menu photo) or text (single dish) and return dish analyses."""
    try:
        user_allergies = json.loads(allergies)
    except json.JSONDecodeError:
        user_allergies = []
    try:
        user_custom = json.loads(custom_allergies)
        if not isinstance(user_custom, list):
            user_custom = []
    except json.JSONDecodeError:
        user_custom = []

    ocr_text = ""
    is_menu = False  # True when an image was uploaded → may contain multiple dishes
    if image is not None:
        contents = await image.read()
        if not contents:
            raise HTTPException(400, "Empty image")
        mime = image.content_type or "image/jpeg"
        ocr_text = await typhoon_ocr(contents, mime)
        is_menu = True
    elif text:
        ocr_text = text
    else:
        raise HTTPException(400, "ต้องส่งรูปภาพหรือข้อความ")

    ocr_text = ocr_text.strip()

    extracted_names: list[str] = []
    db_matched_dishes: list[dict] = []

    if is_menu:
        # Fan out: LLM extraction + local DB scan in parallel-ish (sequential is fine)
        extracted_names = await extract_dish_names(ocr_text)
        db_matched_dishes = find_all_local_matches(ocr_text)
    else:
        # Single typed name: just look it up
        extracted_names = [ocr_text]

    dishes: list[dict] = []
    seen_dish_keys: set[str] = set()  # dedupe by canonical dish name_th

    # 1. Add all DB substring matches first (highest confidence)
    for d in db_matched_dishes:
        key = normalize(d["name_th"])
        if key in seen_dish_keys:
            continue
        seen_dish_keys.add(key)
        result = {
            "source": "local_db",
            "dish_name_th": d["name_th"],
            "dish_name_en": d["name_en"],
            "query": d["name_th"],
            "ingredients": d["ingredients"],
            "allergens_detected": d["allergens"],
            "confidence": "high",
        }
        dishes.append(enrich_dish_result(result, user_allergies, user_custom))

    # 2. For each LLM-extracted name not already covered, try local DB then LLM lookup
    for name in extracted_names[:30]:
        norm = normalize(name)
        if not norm or norm in seen_dish_keys:
            continue
        # Quick local lookup for this specific name
        local = find_dish_local(name)
        if local:
            local_key = normalize(local["name_th"])
            if local_key in seen_dish_keys:
                continue
            seen_dish_keys.add(local_key)
            result = {
                "source": "local_db",
                "dish_name_th": local["name_th"],
                "dish_name_en": local["name_en"],
                "query": name,
                "ingredients": local["ingredients"],
                "allergens_detected": local["allergens"],
                "confidence": "high",
            }
        else:
            # Unknown dish — ask LLM
            llm_result = await typhoon_lookup_ingredients(name)
            seen_dish_keys.add(norm)
            result = {
                "source": "typhoon_llm",
                "dish_name_th": name,
                "dish_name_en": "",
                "query": name,
                "ingredients": llm_result.get("ingredients", []),
                "allergens_detected": llm_result.get("allergens", []),
                "confidence": llm_result.get("confidence", "low"),
            }
        dishes.append(enrich_dish_result(result, user_allergies, user_custom))

    alerted = [d for d in dishes if d["has_alert"]]
    safe = [d for d in dishes if not d["has_alert"]]

    return {
        "ocr_text": ocr_text,
        "is_menu": is_menu,
        "dish_count": len(dishes),
        "alerted_count": len(alerted),
        "safe_count": len(safe),
        "dishes": dishes,
        "extracted_names": extracted_names,
        "db_matched_count": len(db_matched_dishes),
    }


# Serve frontend
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    async def index():
        return FileResponse(str(FRONTEND_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
