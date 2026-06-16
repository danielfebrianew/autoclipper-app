import logging
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("worker.whisper_align")
router = APIRouter()

import os

_model = None
_model_size: str | None = None


def get_model(size: str = "tiny"):
    global _model, _model_size
    # Reload jika ukuran berbeda dari yang di-cache
    if _model is None or _model_size != size:
        from faster_whisper import WhisperModel
        logger.info(f"Loading Whisper {size} model...")
        _model = WhisperModel(size, device="cpu", compute_type="int8")
        _model_size = size
        logger.info(f"Whisper {size} loaded")
    return _model


class WhisperRequest(BaseModel):
    audio_path: str
    language: str = "id"
    model_size: str = ""  # tiny|base|small|medium; kosong → pakai env AUTOCLIPPER_WHISPER_MODEL


@router.post("/whisper-align")
def whisper_align(req: WhisperRequest):
    size = req.model_size or os.environ.get("AUTOCLIPPER_WHISPER_MODEL", "tiny")
    logger.info(f"Whisper aligning {req.audio_path} (model={size})")
    try:
        model = get_model(size)
        segments, _ = model.transcribe(
            req.audio_path,
            language=req.language,
            word_timestamps=True,
        )
        words = []
        for segment in segments:
            if segment.words:
                for word in segment.words:
                    words.append({
                        "word": word.word.strip(),
                        "start": round(word.start, 3),
                        "end": round(word.end, 3),
                    })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    logger.info(f"Whisper produced {len(words)} words")
    return {"words": words}
