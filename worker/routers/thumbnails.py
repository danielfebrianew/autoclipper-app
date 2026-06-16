import logging
import os
import subprocess
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("worker.thumbnails")
router = APIRouter()


class ThumbnailsRequest(BaseModel):
    video_path: str
    start: int = 0
    end: int = 0
    count: int = 10
    out_dir: str


@router.post("/thumbnails")
def thumbnails(req: ThumbnailsRequest):
    logger.info(f"Generating {req.count} thumbnails for {req.video_path} [{req.start}s-{req.end}s]")
    Path(req.out_dir).mkdir(parents=True, exist_ok=True)

    duration = req.end - req.start if req.end > req.start else None
    if not duration or duration <= 0:
        raise HTTPException(status_code=400, detail="end must be greater than start")

    interval = duration / req.count
    paths = []

    try:
        for i in range(req.count):
            t = req.start + interval * i + interval / 2
            out_path = os.path.join(req.out_dir, f"thumb_{i:03d}.jpg")
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-ss", str(t),
                    "-i", req.video_path,
                    "-vframes", "1",
                    "-vf", "scale=320:-1",
                    out_path,
                ],
                check=True, capture_output=True, timeout=30,
            )
            if os.path.exists(out_path):
                paths.append(out_path)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"ffmpeg error: {e.stderr[-500:]}")

    logger.info(f"Generated {len(paths)} thumbnails")
    return {"paths": paths}
