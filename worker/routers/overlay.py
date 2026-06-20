"""Overlay editor render endpoints.

Ports the segment-based ffmpeg logic from the standalone ContextClipper
(image-appender-service/app/render.py) into the AutoClipper worker.

The Go orchestrator decides the segment plan (which spans are copy vs overlay,
and whether copy segments must be re-encoded) and calls these endpoints
per-segment, then concatenates. This file only executes ffmpeg per the
instructions it receives.
"""

import json
import logging
import platform
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("worker.overlay")
router = APIRouter()


# --- /overlay/probe ---

class ProbeRequest(BaseModel):
    video_path: str


@router.post("/overlay/probe")
def probe(req: ProbeRequest):
    logger.info(f"Probing {req.video_path}")
    if not Path(req.video_path).exists():
        raise HTTPException(status_code=404, detail="video_path does not exist")
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height,r_frame_rate",
                "-show_entries", "format=duration",
                "-of", "json", req.video_path,
            ],
            capture_output=True, text=True, check=True,
        )
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"ffprobe failed: {e.stderr[-500:]}")

    info = json.loads(result.stdout)
    stream = (info.get("streams") or [{}])[0]
    width = int(stream.get("width", 0))
    height = int(stream.get("height", 0))
    fps = _parse_fps(stream.get("r_frame_rate", "30/1"))
    duration = float(info.get("format", {}).get("duration", 0.0))
    return {"width": width, "height": height, "fps": fps, "duration": duration}


def _parse_fps(rate: str) -> float:
    try:
        num, den = rate.split("/")
        den_f = float(den)
        return float(num) / den_f if den_f else 30.0
    except Exception:
        return 30.0


# --- shared helpers (ported from render.py) ---

def _time(value: float) -> str:
    return f"{value:.3f}".rstrip("0").rstrip(".")


def detect_codec(codec_hint: str) -> str:
    if codec_hint == "h264_videotoolbox" and platform.system() != "Darwin":
        return "libx264"
    return codec_hint or "libx264"


def _run_ffmpeg(args: list[str]) -> int:
    cmd = ["ffmpeg", "-y", "-hide_banner", "-nostats"] + args
    logger.info("ffmpeg " + " ".join(args[:8]) + (" …" if len(args) > 8 else ""))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        logger.error(proc.stderr[-800:])
    return proc.returncode


# --- /overlay/render-segment ---

class OverlaySpec(BaseModel):
    kind: str             # image|video
    path: str
    fit: str = "cover"    # cover|contain
    trim_offset: float = 0.0


class ClickSpec(BaseModel):
    enabled: bool = False
    volume: float = 0.6
    asset_path: str = ""


class RenderSegmentRequest(BaseModel):
    kind: str             # copy|overlay|cover
    source_path: str
    out_path: str
    seg_start: float = 0.0
    seg_end: float = 0.0
    out_width: int = 0
    out_height: int = 0
    fps: float = 30.0
    codec_hint: str = "libx264"
    background_color: str = "#000000"
    area_ratio: float = 0.30
    force_reencode: bool = False
    overlays: list[OverlaySpec] = []
    click: ClickSpec = ClickSpec()
    cover_image: str = ""
    cover_duration: float = 0.5


@router.post("/overlay/render-segment")
def render_segment(req: RenderSegmentRequest):
    if req.kind == "cover":
        code = _render_cover(req)
    elif req.kind == "overlay":
        code = _render_overlay(req)
    else:
        code = _render_copy(req)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"ffmpeg exited with code {code}")
    return {"code": code, "out_path": req.out_path}


def _render_copy(req: RenderSegmentRequest) -> int:
    dur = req.seg_end - req.seg_start
    needs_reencode = req.force_reencode or (
        req.out_width > 0 and req.out_height > 0
    )
    if needs_reencode and req.out_width > 0 and req.out_height > 0:
        codec = detect_codec(req.codec_hint)
        vf = (
            f"scale={req.out_width}:{req.out_height}:force_original_aspect_ratio=increase,"
            f"crop={req.out_width}:{req.out_height},setsar=1"
        )
        return _run_ffmpeg([
            "-ss", _time(req.seg_start), "-t", _time(dur),
            "-i", req.source_path,
            "-vf", vf,
            "-c:v", codec, "-pix_fmt", "yuv420p", "-r", str(req.fps),
            "-c:a", "aac", "-ar", "48000", "-ac", "2",
            "-avoid_negative_ts", "make_zero",
            req.out_path,
        ])
    if req.force_reencode:
        codec = detect_codec(req.codec_hint)
        return _run_ffmpeg([
            "-ss", _time(req.seg_start), "-t", _time(dur),
            "-i", req.source_path,
            "-c:v", codec, "-pix_fmt", "yuv420p", "-r", str(req.fps),
            "-c:a", "aac", "-ar", "48000", "-ac", "2",
            "-avoid_negative_ts", "make_zero",
            req.out_path,
        ])
    return _run_ffmpeg([
        "-ss", _time(req.seg_start), "-t", _time(dur),
        "-i", req.source_path,
        "-map", "0", "-c", "copy",
        "-avoid_negative_ts", "make_zero",
        req.out_path,
    ])


def _render_overlay(req: RenderSegmentRequest) -> int:
    width, height = req.out_width, req.out_height
    area_h = int(height * req.area_ratio)
    y = height - area_h
    dur = req.seg_end - req.seg_start
    codec = detect_codec(req.codec_hint)

    use_click = req.click.enabled and req.click.asset_path and Path(req.click.asset_path).exists()
    if req.click.enabled and req.click.asset_path and not Path(req.click.asset_path).exists():
        logger.warning(f"click asset not found at {req.click.asset_path}; rendering without click")

    args = ["-ss", _time(req.seg_start), "-t", _time(dur), "-i", req.source_path]

    for ov in req.overlays:
        if ov.kind == "video":
            args += [
                "-ss", _time(max(0.0, ov.trim_offset)), "-t", _time(dur),
                "-i", ov.path,
            ]
        else:
            args += ["-loop", "1", "-t", _time(dur), "-i", ov.path]

    if use_click:
        args += ["-i", req.click.asset_path]

    filters: list[str] = []
    base_label = "[0:v]"
    filters.append(
        f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},setsar=1[base]"
    )
    base_label = "[base]"

    for idx, ov in enumerate(req.overlays, start=1):
        if ov.fit == "contain":
            filters.append(
                f"[{idx}:v]scale={width}:{area_h}:force_original_aspect_ratio=decrease,"
                f"pad={width}:{area_h}:(ow-iw)/2:(oh-ih)/2:{req.background_color},setsar=1[i{idx}]"
            )
        else:
            filters.append(
                f"[{idx}:v]scale={width}:{area_h}:force_original_aspect_ratio=increase,"
                f"crop={width}:{area_h},setsar=1[i{idx}]"
            )

    current = base_label
    n = len(req.overlays)
    for idx in range(1, n + 1):
        out_label = "[vout]" if idx == n else f"[v{idx}]"
        filters.append(f"{current}[i{idx}]overlay=0:{y}{out_label}")
        current = out_label
    if n == 0:
        filters.append(f"{base_label}null[vout]")

    audio_output = "0:a?"
    if use_click and n > 0:
        click_idx = n + 1
        vol = req.click.volume
        split_labels = "".join(f"[c{i}]" for i in range(n))
        filters.append(
            f"[{click_idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,"
            f"asplit={n}{split_labels}"
        )
        delayed = []
        for i in range(n):
            filters.append(f"[c{i}]atrim=start=0:end=0.1,volume={vol:.3f}[d{i}]")
            delayed.append(f"[d{i}]")
        filters.append("[0:a]aformat=sample_rates=48000:channel_layouts=stereo[orig]")
        filters.append(
            f"[orig]{''.join(delayed)}"
            f"amix=inputs={n + 1}:duration=first:dropout_transition=0[aout]"
        )
        audio_output = "[aout]"

    args += [
        "-filter_complex", ";".join(filters),
        "-map", "[vout]", "-map", audio_output,
        "-c:v", codec, "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart",
        req.out_path,
    ]
    return _run_ffmpeg(args)


def _render_cover(req: RenderSegmentRequest) -> int:
    width, height = req.out_width, req.out_height
    fps = req.fps or 30.0
    dur = req.cover_duration
    codec = detect_codec(req.codec_hint)
    bg = req.background_color
    vf = (
        f"[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:{bg},setsar=1,fps={fps}[vout]"
    )
    return _run_ffmpeg([
        "-loop", "1", "-t", _time(dur), "-i", req.cover_image,
        "-f", "lavfi", "-t", _time(dur),
        "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-filter_complex", vf,
        "-map", "[vout]", "-map", "1:a",
        "-c:v", codec, "-pix_fmt", "yuv420p", "-r", str(fps),
        "-c:a", "aac", "-ar", "48000", "-ac", "2",
        "-shortest", "-movflags", "+faststart",
        req.out_path,
    ])


# --- /overlay/concat ---

class ConcatRequest(BaseModel):
    inputs: list[str]
    out_path: str
    tmp_dir: str
    try_stream_copy: bool = True


@router.post("/overlay/concat")
def concat(req: ConcatRequest):
    if len(req.inputs) == 1:
        Path(req.inputs[0]).rename(req.out_path)
        return {"code": 0, "out_path": req.out_path, "reencoded": False}

    concat_list = Path(req.tmp_dir) / "concat.txt"
    concat_list.write_text("\n".join(f"file '{Path(p).resolve()}'" for p in req.inputs))

    reencoded = False
    code = 0
    if req.try_stream_copy:
        code = _run_ffmpeg([
            "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-c", "copy", "-movflags", "+faststart", req.out_path,
        ])
    if code != 0 or not req.try_stream_copy:
        reencoded = True
        args: list[str] = []
        for src in req.inputs:
            args += ["-i", src]
        streams = "".join(f"[{i}:v:0][{i}:a:0]" for i in range(len(req.inputs)))
        fc = f"{streams}concat=n={len(req.inputs)}:v=1:a=1[vout][aout]"
        args += [
            "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", req.out_path,
        ]
        code = _run_ffmpeg(args)

    if code != 0:
        raise HTTPException(status_code=500, detail=f"concat failed with code {code}")
    return {"code": code, "out_path": req.out_path, "reencoded": reencoded}
