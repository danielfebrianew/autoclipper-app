import json
import logging
import re
import httpx
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("worker.analyze")
router = APIRouter()

SYSTEM_PROMPT = """Kamu adalah podcast clip analyst profesional.
Tugasmu menganalisis transcript video dan mengidentifikasi momen-momen yang paling cocok dijadikan short-form viral clip.

Kamu akan menerima:
1. TRANSCRIPT lengkap dengan timestamps [MM:SS]
2. HEATMAP DATA (jika tersedia) — data "Most Replayed" dari YouTube yang menunjukkan segment mana yang paling sering ditonton ulang penonton asli
3. METADATA video (judul, channel, durasi)

ATURAN TIMESTAMP (PENTING!):
- start_time harus mulai MINIMAL 3 detik SEBELUM momen inti dimulai
- end_time harus berakhir SETELAH kalimat penutup topik benar-benar selesai diucapkan — jangan potong di tengah argumen atau kalimat
- Pastikan potongan mulai dan berakhir di jeda natural (antar kalimat, bukan di tengah kata)
- Sertakan timestamp dalam format "MM:SS" DAN dalam total detik
- Lebih baik kelebihan 5–10 detik daripada terpotong
- end_cue: tulis KATA-KATA TERAKHIR yang benar-benar diucapkan sebelum clip berakhir (kutip verbatim dari transcript, minimal 8 kata)

JIKA HEATMAP DATA TERSEDIA:
- PRIORITASKAN momen yang ada di atau dekat peak heatmap (terbukti menarik penonton)
- Momen yang secara konten bagus DAN ada di peak heatmap harus mendapat viral_score tertinggi

KRITERIA MOMEN MENARIK:
- Punchline atau joke yang lucu
- Insight atau opini kontroversial / hot take
- Momen emosional (marah, terharu, kaget)
- Storytelling yang engaging (ada setup + payoff)
- Debat, clash, atau banter seru antar speaker
- Quote yang shareable / bisa jadi caption
- Reaksi kaget/lucu dari host atau guest

Output HANYA dalam JSON, tanpa teks tambahan, tanpa markdown codeblock."""


def _build_user_prompt(
    title: str,
    channel: str,
    duration: int,
    transcript: str,
    heatmap_text: str,
    max_clips: int,
    min_duration: int,
    max_duration: int,
    buffer: int = 5,
) -> str:
    m, s = divmod(duration, 60)
    h, m = divmod(m, 60)
    duration_fmt = f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"

    return f"""Analisis video berikut dan identifikasi {max_clips} momen terbaik untuk dijadikan short clip ({min_duration}-{max_duration} detik). Kasih buffer {buffer} detik di awal dan akhir tiap momen.

## VIDEO INFO
- Judul: {title}
- Channel: {channel}
- Durasi: {duration_fmt} ({duration} detik)

## HEATMAP DATA (Most Replayed)
{heatmap_text}

## TRANSCRIPT
{transcript}

## FORMAT OUTPUT (JSON only, no markdown):
{{
  "speakers": [
    {{
      "name": "string",
      "role": "host | co-host | guest",
      "position": "left | center | right | varies",
      "description": "string"
    }}
  ],
  "clips": [
    {{
      "clip_id": 1,
      "start_time": "MM:SS",
      "end_time": "MM:SS",
      "start_seconds": 0,
      "end_seconds": 0,
      "duration_seconds": 0,
      "speaker": "string",
      "speakers_visible": ["string"],
      "interaction_type": "monologue | dialogue | reaction | banter",
      "hook": "kalimat pembuka yang benar-benar diucapkan di video",
      "summary": "ringkasan singkat 1-2 kalimat",
      "category": "humor | hot_take | emotional | storytelling | debate | quotable | reaction",
      "energy_level": "calm | medium | heated | funny",
      "viral_score": 8,
      "thumbnail": {{
        "text": "TEKS THUMBNAIL 2-5 KATA HURUF KAPITAL",
        "emotion": "kaget | marah | tertawa | serius | bingung | sedih | takut",
        "timestamp": "MM:SS",
        "speaker_focus": "nama speaker yang wajahnya paling ekspresif"
      }},
      "suggested_caption": "caption pendek untuk TikTok/Reels #hashtag1 #hashtag2 #hashtag3",
      "transcript_excerpt": "potongan transcript di momen ini",
      "end_cue": "8-15 kata terakhir yang diucapkan verbatim sebelum clip berakhir"
    }}
  ]
}}

ATURAN:
- viral_score 1-10 (10 = paling viral). Pertimbangkan kualitas konten DAN heatmap peak jika tersedia.
- Urutkan clips dari viral_score tertinggi ke terendah
- Jangan overlap antar clip
- thumbnail.text: 2-5 kata, HURUF KAPITAL, provokatif, bisa dibaca dalam 1 detik
- thumbnail.timestamp harus berbeda dari start_time — pilih frame paling ekspresif
- end_cue WAJIB ada dan HARUS berupa kutipan verbatim dari transcript (bukan parafrase)"""


def _chat_url(base_url: str, model: str) -> str:
    base = base_url.rstrip("/")
    if "kie.ai" in base:
        return f"{base}/{model}/v1/chat/completions"
    return f"{base}/v1/chat/completions"


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw.strip())


class AnalyzeRequest(BaseModel):
    transcript: str
    heatmap_text: str
    title: str
    channel: str = ""
    duration: int
    api_key: str
    model: str = "gemini-3-flash"
    base_url: str = "https://api.kie.ai"
    max_clips: int = 10
    min_duration: int = 20
    max_duration: int = 90
    buffer_seconds: int = 5
    # Snippets mentah untuk timestamp snapping (dikirim oleh orchestrator)
    snippets: list[dict] = []
    video_duration_seconds: int = 0


@router.post("/analyze")
def analyze_video(req: AnalyzeRequest):
    logger.info(f"Analyzing: {req.title} ({req.duration}s)")

    user_prompt = _build_user_prompt(
        title=req.title,
        channel=req.channel,
        duration=req.duration,
        transcript=req.transcript,
        heatmap_text=req.heatmap_text,
        max_clips=req.max_clips,
        min_duration=req.min_duration,
        max_duration=req.max_duration,
        buffer=req.buffer_seconds,
    )

    # Format content sebagai array block — kie.ai/gemini-3 mengharapkan bentuk
    # multimodal ini (sama seperti autoclipper-py yang sudah terbukti jalan).
    # Kirim string biasa membuat respons berstruktur beda → parsing crash.
    payload = {
        "model": req.model,
        "messages": [
            {"role": "system", "content": [{"type": "text", "text": SYSTEM_PROMPT}]},
            {"role": "user", "content": [{"type": "text", "text": user_prompt}]},
        ],
        "stream": False,
    }

    try:
        with httpx.Client(timeout=180) as client:
            resp = client.post(
                _chat_url(req.base_url, req.model),
                headers={"Authorization": f"Bearer {req.api_key}", "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.HTTPError as e:
        logger.exception("LLM request gagal")
        raise HTTPException(status_code=502, detail=f"LLM API error: {e}")

    if resp.status_code != 200:
        logger.error("kie.ai status %d: %s", resp.status_code, resp.text[:400])
        raise HTTPException(status_code=502, detail=f"kie.ai error {resp.status_code}: {resp.text[:300]}")

    # Ekstrak content dengan aman — struktur respons bisa tak terduga.
    try:
        data = resp.json()
        raw = data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError, ValueError) as e:
        body = resp.text[:400]
        logger.error("Respons kie.ai tidak terduga: %s — body: %s", e, body)
        raise HTTPException(status_code=502, detail=f"Respons LLM tidak terduga: {e}. Body: {body}")

    try:
        parsed = _parse_json(raw)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("LLM JSON tidak valid: %s — raw: %s", e, raw[:400])
        raise HTTPException(status_code=502, detail=f"LLM tidak menghasilkan JSON valid: {e}. Raw: {raw[:300]}")

    clips = parsed.get("clips") or []
    speakers = parsed.get("speakers") or []
    logger.info(f"LLM mengembalikan {len(clips)} clips")

    # Timestamp snapping jika snippets dikirim
    if req.snippets and clips:
        from processing.timestamps import validate_and_snap
        result = {
            "clips": clips,
            "video_duration_seconds": req.video_duration_seconds or req.duration,
        }
        validate_and_snap(result, req.snippets)
        clips = result["clips"]
        logger.info("Timestamp snapping selesai")

    return {"clips": clips, "speakers": speakers}
