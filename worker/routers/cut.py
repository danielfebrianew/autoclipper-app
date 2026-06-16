import logging
import os
import subprocess
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("worker.cut")
router = APIRouter()


class CutRequest(BaseModel):
    video_path: str
    clip_id: str
    start: int
    end: int
    out_dir: str


@router.post("/cut")
def cut_clip(req: CutRequest):
    logger.info(f"Cutting clip {req.clip_id} [{req.start}-{req.end}s]")
    Path(req.out_dir).mkdir(parents=True, exist_ok=True)

    clip_path = os.path.join(req.out_dir, f"{req.clip_id}_raw.mp4")
    duration = req.end - req.start

    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-ss", str(req.start),
                "-i", req.video_path,
                "-t", str(duration),
                "-c:v", "libx264", "-c:a", "aac",
                "-avoid_negative_ts", "1",
                clip_path,
            ],
            check=True, capture_output=True, text=True
        )
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"FFmpeg cut failed: {e.stderr[-500:]}")

    return {"clip_path": clip_path}
