import json
import logging
import subprocess
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("worker.metadata")
router = APIRouter()


class MetadataRequest(BaseModel):
    url: str


@router.post("/metadata")
def fetch_metadata(req: MetadataRequest):
    logger.info(f"Fetching metadata for {req.url}")
    try:
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--no-playlist", req.url],
            capture_output=True, text=True, check=True
        )
        info = json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"yt-dlp failed: {e.stderr}")

    heatmap = []
    if "heatmap" in info and info["heatmap"]:
        for entry in info["heatmap"]:
            heatmap.append({
                "start_time": entry.get("start_time", 0),
                "end_time": entry.get("end_time", 0),
                "value": entry.get("value", 0),
            })

    return {
        "title": info.get("title", ""),
        "channel": info.get("channel") or info.get("uploader", ""),
        "duration": int(info.get("duration", 0)),
        "views": int(info.get("view_count", 0)),
        "video_id": info.get("id", ""),
        "heatmap": heatmap,
    }
