import logging
import os
import re
import subprocess
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

logger = logging.getLogger("worker.download")
router = APIRouter()

_PCT_RE = re.compile(r'\[download\]\s+([\d.]+)%')
_DEST_RE = re.compile(r'\[download\] Destination:\s+(.+)')
_MERGE_RE = re.compile(r'\[Merger\].*Merging')


class DownloadRequest(BaseModel):
    url: str
    video_id: str
    out_dir: str


@router.post("/download")
def download_video(req: DownloadRequest):
    logger.info(f"Downloading {req.video_id} to {req.out_dir}")
    Path(req.out_dir).mkdir(parents=True, exist_ok=True)

    output_template = os.path.join(req.out_dir, f"{req.video_id}.%(ext)s")

    def stream():
        proc = subprocess.Popen(
            [
                "yt-dlp",
                "--no-playlist",
                "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
                "--remux-video", "mp4",
                "--newline",           # one progress line per stdout line
                "--progress",
                "--extractor-retries", "3",
                "--fragment-retries", "3",
                "-o", output_template,
                req.url,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        last_pct = -1.0
        for line in proc.stdout:
            line = line.rstrip()
            if not line:
                continue

            # Parse percentage
            m = _PCT_RE.search(line)
            if m:
                pct = float(m.group(1))
                if pct - last_pct >= 0.5:   # throttle: only send on ≥0.5% change
                    last_pct = pct
                    yield f"PROGRESS:{pct:.1f}\n"
                continue

            # Merging step
            if _MERGE_RE.search(line):
                yield "PROGRESS:99.0\n"
                continue

            # Forward other lines as log
            yield f"LOG:{line}\n"

        proc.wait()
        if proc.returncode != 0:
            yield f"ERROR:yt-dlp exited with code {proc.returncode}\n"
            return

        # Locate output file
        video_path = os.path.join(req.out_dir, f"{req.video_id}.mp4")
        if not os.path.exists(video_path):
            for f in Path(req.out_dir).glob(f"{req.video_id}.*"):
                video_path = str(f)
                break

        yield f"DONE:{video_path}\n"

    return StreamingResponse(stream(), media_type="text/plain")
