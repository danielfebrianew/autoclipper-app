import logging
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

logger = logging.getLogger("worker.transcript")
router = APIRouter()

_api = YouTubeTranscriptApi()


class TranscriptRequest(BaseModel):
    video_id: str
    language: str = "id"


@router.post("/transcript")
def fetch_transcript(req: TranscriptRequest):
    logger.info(f"Fetching transcript for {req.video_id} ({req.language})")
    try:
        result = _api.fetch(req.video_id, languages=[req.language, "en"])
    except (NoTranscriptFound, TranscriptsDisabled) as e:
        raise HTTPException(status_code=404, detail=f"No transcript available: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "segments": [
            {"text": s.text, "start": s.start, "end": s.start + s.duration, "duration": s.duration}
            for s in result
        ]
    }
