import os
import json
import base64
import re
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


def find_all_local_matches(text: str) -> list[dict]:
    """Find ALL DB dishes that appear in the text. Uses longest-first matching
    with masking so longer dish names take priority over shorter aliases."""
    if not text:
        return []
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
                            "อ่านข้อความและชื่อเมนูอาหารจากรูปนี้ "
                            "ตอบเฉพาะชื่อเมนูที่เห็นทั้งหมด คั่นด้วยขึ้นบรรทัดใหม่ "
                            "ห้ามอธิบายเพิ่ม ห้ามใส่ราคา"
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"},
                    },
                ],
            }
        ],
        "max_tokens": 1024,
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


async def typhoon_lookup_ingredients(dish_name: str) -> dict:
    """Ask Typhoon LLM to identify ingredients & allergens for an unknown dish."""
    if not TYPHOON_API_KEY:
        return {"ingredients": [], "allergens": [], "confidence": "low"}

    allergen_list = ", ".join(
        [f"{k} ({v['th']})" for k, v in FOODS["allergens"].items()]
    )

    system = (
        "คุณเป็นผู้เชี่ยวชาญด้านอาหารไทย หน้าที่คือบอกวัตถุดิบหลักของเมนูอาหารอย่างย่อ "
        "และระบุสารก่อภูมิแพ้ที่อาจมี ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น"
    )
    user = (
        f"เมนู: {dish_name}\n"
        f"รายการสารก่อภูมิแพ้ที่ต้องเลือกจาก (ใช้ key ภาษาอังกฤษ): {allergen_list}\n\n"
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
        return result
    except json.JSONDecodeError:
        return {"ingredients": [], "allergens": [], "confidence": "low", "raw": content}


async def extract_dish_names(ocr_text: str) -> list[str]:
    """Use Typhoon LLM to extract a clean list of dish names from messy OCR text.

    Handles markdown tables, prices, headers, JSON wrappers, etc.
    """
    if not TYPHOON_API_KEY or not ocr_text.strip():
        # Fallback: split by newline & filter
        lines = [l.strip(" \t-•*#|") for l in ocr_text.splitlines()]
        return [l for l in lines if l and len(l) >= 3 and not re.search(r"\d+\s*บาท|\d+\.-", l)]

    system = (
        "คุณเป็นผู้ช่วยแยกชื่อเมนูอาหารจากข้อความเมนูร้านอาหาร "
        "ตอบเป็น JSON array ของชื่อเมนูเท่านั้น ห้ามมีข้อความอื่น "
        "ห้ามใส่ราคา หมายเลขโทรศัพท์ ชื่อร้าน หรือเวลาทำการ"
    )
    user = (
        f"ข้อความจาก OCR เมนูร้านอาหาร:\n```\n{ocr_text[:4000]}\n```\n\n"
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
    except Exception as e:
        print(f"extract_dish_names failed: {e}")
        return []

    m = re.search(r"\[.*\]", content, re.DOTALL)
    if not m:
        return []
    try:
        names = json.loads(m.group(0))
        return [str(n).strip() for n in names if isinstance(n, (str, int, float)) and str(n).strip()]
    except json.JSONDecodeError:
        return []


async def analyze_dish_name(name: str) -> dict:
    """Analyze a single dish name: try local DB first, fall back to Typhoon LLM."""
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


def check_allergens(allergens_in_dish: list[str], user_allergies: list[str]) -> list[dict]:
    """Return list of allergen objects the user is allergic to."""
    matched = []
    for a in allergens_in_dish:
        if a in user_allergies and a in FOODS["allergens"]:
            info = FOODS["allergens"][a]
            matched.append({"key": a, **info})
    return matched


@app.get("/api/allergens")
async def get_allergens():
    """List all available allergens for UI selection."""
    return [
        {"key": k, "th": v["th"], "en": v["en"], "icon": v["icon"]}
        for k, v in FOODS["allergens"].items()
    ]


def enrich_dish_result(result: dict, user_allergies: list[str]) -> dict:
    """Add alerts + allergen display info to a dish result."""
    alerts = check_allergens(result["allergens_detected"], user_allergies)
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
):
    """Receive image (menu photo) or text (single dish) and return dish analyses."""
    try:
        user_allergies = json.loads(allergies)
    except json.JSONDecodeError:
        user_allergies = []

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
        dishes.append(enrich_dish_result(result, user_allergies))

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
        dishes.append(enrich_dish_result(result, user_allergies))

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
