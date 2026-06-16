import logging
import os
import sys

import uvicorn
from fastapi import FastAPI

from routers import (
    download, metadata, transcript, analyze,
    cut, detect_faces, reframe, subtitle, whisper_align, composite,
    waveform, thumbnails, facetrack, caption, configure,
)


class StructuredFormatter(logging.Formatter):
    """Emit one log line per record in a format Go can parse for worker:log events.

    Format: YYYY-MM-DD HH:MM:SS LEVEL <tool>: <message>
    Example: 2026-06-07 12:04:09 INFO whisper: transcribing audio
    """

    TOOL_MAP = {
        "worker.download":     "youtube",
        "worker.transcript":   "youtube",
        "worker.metadata":     "youtube",
        "worker.analyze":      "gemini",
        "worker.whisper_align": "whisper",
        "worker.detect_faces": "yolov8",
        "worker.reframe":      "ffmpeg",
        "worker.subtitle":     "ffmpeg",
        "worker.composite":    "ffmpeg",
        "worker.cut":          "ffmpeg",
        "worker.waveform":     "ffmpeg",
        "worker.thumbnails":   "ffmpeg",
        "worker.facetrack":    "yolov8",
        "worker.caption":      "gemini",
        "worker":              "worker",
    }

    def format(self, record: logging.LogRecord) -> str:
        tool = self.TOOL_MAP.get(record.name, record.name.split(".")[-1])
        ts = self.formatTime(record, "%Y-%m-%d %H:%M:%S")
        return f"{ts} {record.levelname} {tool}: {record.getMessage()}"


def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers = [handler]


setup_logging()
logger = logging.getLogger("worker")

app = FastAPI(title="AutoClipper Worker", version="1.0.0")

app.include_router(configure.router)
app.include_router(metadata.router)
app.include_router(download.router)
app.include_router(transcript.router)
app.include_router(analyze.router)
app.include_router(cut.router)
app.include_router(detect_faces.router)
app.include_router(reframe.router)
app.include_router(subtitle.router)
app.include_router(whisper_align.router)
app.include_router(composite.router)
app.include_router(waveform.router)
app.include_router(thumbnails.router)
app.include_router(facetrack.router)
app.include_router(caption.router)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    host = os.getenv("WORKER_HOST", "127.0.0.1")
    port = int(os.getenv("WORKER_PORT", "8000"))
    logger.info(f"Starting worker on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
