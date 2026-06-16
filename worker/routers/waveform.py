import logging
import subprocess
import json
import os
import tempfile
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("worker.waveform")
router = APIRouter()


class WaveformRequest(BaseModel):
    audio_path: str
    start: int = 0
    end: int = 0
    samples: int = 200


@router.post("/waveform")
def waveform(req: WaveformRequest):
    logger.info(f"Generating waveform for {req.audio_path} [{req.start}s-{req.end}s]")

    duration = req.end - req.start if req.end > req.start else None
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        cmd = [
            "ffprobe", "-f", "lavfi",
            "-i", f"amovie={req.audio_path},aresample=8000",
            "-show_entries", "frame_tags=lavfi.astats.Overall.RMS_level",
            "-of", "json",
            "-select_streams", "a",
        ]
        if req.start > 0 or duration:
            cmd = [
                "ffmpeg", "-y",
                "-ss", str(req.start),
            ]
            if duration:
                cmd += ["-t", str(duration)]
            cmd += [
                "-i", req.audio_path,
                "-ac", "1", "-ar", "8000",
                "-f", "f32le", "pipe:1",
            ]
            result = subprocess.run(cmd, capture_output=True, timeout=120)
            raw = result.stdout
            if not raw:
                return {"peaks": [0.0] * req.samples}

            import struct
            n = len(raw) // 4
            samples_raw = struct.unpack(f"{n}f", raw)

            bucket = max(1, n // req.samples)
            peaks = []
            for i in range(req.samples):
                chunk = samples_raw[i * bucket: (i + 1) * bucket]
                if chunk:
                    peaks.append(min(1.0, max(0.0, max(abs(v) for v in chunk))))
                else:
                    peaks.append(0.0)
            return {"peaks": peaks}

        # Simpler path: whole file
        cmd = [
            "ffmpeg", "-y", "-i", req.audio_path,
            "-ac", "1", "-ar", "8000",
            "-f", "f32le", "pipe:1",
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        raw = result.stdout
        if not raw:
            return {"peaks": [0.0] * req.samples}

        import struct
        n = len(raw) // 4
        samples_raw = struct.unpack(f"{n}f", raw)
        bucket = max(1, n // req.samples)
        peaks = []
        for i in range(req.samples):
            chunk = samples_raw[i * bucket: (i + 1) * bucket]
            if chunk:
                peaks.append(min(1.0, max(0.0, max(abs(v) for v in chunk))))
            else:
                peaks.append(0.0)
        return {"peaks": peaks}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
