import logging
import httpx
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("worker.caption")
router = APIRouter()


class CaptionRequest(BaseModel):
    transcript_excerpt: str
    lang: str = "id"
    api_key: str = ""
    model: str = "gemini-3-flash"
    base_url: str = "https://api.kie.ai"


def _chat_url(base_url: str, model: str) -> str:
    base = base_url.rstrip("/")
    if "kie.ai" in base:
        return f"{base}/{model}/v1/chat/completions"
    return f"{base}/v1/chat/completions"


@router.post("/caption")
def generate_caption(req: CaptionRequest):
    logger.info(f"Generating caption (lang={req.lang})")
    if not req.api_key:
        raise HTTPException(status_code=400, detail="api_key is required")
    if not req.transcript_excerpt:
        raise HTTPException(status_code=400, detail="transcript_excerpt is required")

    prompt = (
        f"Buat caption pendek (maks 150 karakter) untuk video pendek (TikTok/Reels/Shorts) "
        f"berdasarkan kutipan transkrip berikut. Gunakan bahasa {req.lang}. "
        f"Caption harus menarik, langsung ke intinya, pakai emoji jika relevan. "
        f"Balas HANYA dengan teks caption-nya saja, tanpa tanda kutip.\n\n"
        f"Transkrip: {req.transcript_excerpt}"
    )

    try:
        with httpx.Client(timeout=60) as client:
            resp = client.post(
                _chat_url(req.base_url, req.model),
                headers={
                    "Authorization": f"Bearer {req.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": req.model,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Caption API error: {e}")

    try:
        caption = resp.json()["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=500, detail=f"Unexpected caption response: {e}")

    logger.info("Caption generated successfully")
    return {"caption": caption}
