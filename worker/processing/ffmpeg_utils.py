import subprocess
import cv2
import numpy as np
from . import config
import logging

log = logging.getLogger("worker.processing.ffmpeg")


def _crop_fill(frame, cx, box_w, box_h, src_w, src_h):
    """Crop a region of source aspect box_w:box_h centered horizontally on cx
    (and vertically centered), clamped to the frame, then resize to exactly
    (box_w, box_h). Guarantees crop-to-FILL (no letterbox, correct aspect)."""
    box_aspect = box_w / box_h
    # Largest region of the target aspect that fits inside the source frame.
    crop_w = min(src_w, int(round(src_h * box_aspect)))
    crop_h = int(round(crop_w / box_aspect))
    if crop_h > src_h:
        crop_h = src_h
        crop_w = int(round(crop_h * box_aspect))

    x1 = int(round(cx - crop_w / 2))
    x1 = max(0, min(x1, src_w - crop_w))
    y1 = max(0, (src_h - crop_h) // 2)  # vertical center

    region = frame[y1:y1 + crop_h, x1:x1 + crop_w]
    return cv2.resize(region, (box_w, box_h), interpolation=cv2.INTER_AREA)


def _pick_encoder() -> str:
    setting = config.VIDEO_ENCODER
    if setting not in ("auto", ""):
        return setting
    # Cek videotoolbox tersedia (macOS)
    result = subprocess.run(
        ["ffmpeg", "-encoders", "-v", "quiet"],
        capture_output=True, text=True,
    )
    if "h264_videotoolbox" in result.stdout:
        return "h264_videotoolbox"
    return "libx264"


_ENCODER: str | None = None


def _get_encoder() -> str:
    global _ENCODER
    if _ENCODER is None:
        _ENCODER = _pick_encoder()
        log.info("Video encoder: %s", _ENCODER)
    return _ENCODER


def _encoder_args() -> list[str]:
    enc = _get_encoder()
    if enc == "h264_videotoolbox":
        return ["-c:v", "h264_videotoolbox", "-b:v", config.VIDEO_BITRATE]
    return ["-c:v", "libx264", "-preset", "fast", "-crf", "23"]


def cut_clip(start, duration, src_video: str, dest: str) -> None:
    result = subprocess.run([
        "ffmpeg", "-ss", str(start), "-i", src_video,
        "-t", str(duration), "-c", "copy", "-y", dest,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if result.returncode != 0:
        err = result.stderr.decode("utf-8", errors="replace")[-1000:]
        log.error("ffmpeg cut_clip gagal (rc=%d):\n%s", result.returncode, err)
        raise subprocess.CalledProcessError(result.returncode, "ffmpeg", stderr=err)


def extract_audio(src_video: str, dest_wav: str) -> None:
    subprocess.run([
        "ffmpeg", "-i", src_video,
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", "-y", dest_wav,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)


def _escape_ass_path(path: str) -> str:
    return path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def _escape_drawtext(text: str) -> str:
    return text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def composite(
    clip_path: str,
    centers: np.ndarray,
    src_w: int,
    src_h: int,
    ass_path: str,
    output_path: str,
    channel_name: str = "",
    source_credit: str = "",
    ratio: str = "9:16",
    reserve_bottom: bool = False,
) -> None:
    """
    Composite per-frame: crop bergerak sesuai centers[frame_idx], burn subtitle ASS,
    overlay drawtext opsional, encode ke output_path.

    reserve_bottom: bila True, konten di-crop-to-fill ke 60% atas frame dan 40%
    bawah dibiarkan hitam (untuk overlay edit clip). Bila False, crop mengisi
    frame penuh (perilaku lama).
    """
    from processing.reframe import RATIO_MAP
    ratio_val = RATIO_MAP.get(ratio, 9 / 16)
    out_w = int(src_h * ratio_val)
    out_h = src_h
    top_h = int(out_h * config.SPLIT_SCREEN_TOP_RATIO) if reserve_bottom else out_h

    cap = cv2.VideoCapture(clip_path)
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    safe_ass = _escape_ass_path(ass_path)
    filters: list[str] = [f"ass=filename='{safe_ass}'"]

    if source_credit.strip():
        txt = _escape_drawtext(source_credit.strip())
        filters.append(
            f"drawtext=text='{txt}':font=Impact:fontsize=28"
            f":fontcolor=white@0.55:x=(w-text_w)/2:y=40"
            f":shadowcolor=black@0.6:shadowx=2:shadowy=2"
        )

    if channel_name.strip():
        txt = _escape_drawtext(channel_name.strip())
        filters.insert(1,
            f"drawtext=text='{txt}':font=Impact:fontsize=28"
            f":fontcolor=white@0.20:x=(w-text_w)/2:y=(h-text_h)/2"
            f":shadowcolor=black@0.20:shadowx=2:shadowy=2"
        )

    vf = ",".join(filters)

    proc = subprocess.Popen([
        "ffmpeg",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{out_w}x{out_h}",
        "-pix_fmt", "bgr24",
        "-r", f"{src_fps}",
        "-i", "-",
        "-i", clip_path,
        "-map", "0:v", "-map", "1:a",
        "-vf", vf,
        *_encoder_args(),
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-shortest",
        "-y", output_path,
    ], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    assert proc.stdin is not None

    black = np.zeros((out_h - top_h, out_w, 3), dtype=np.uint8)
    frame_idx = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            cx = centers[min(frame_idx, len(centers) - 1)]
            if reserve_bottom:
                top = _crop_fill(frame, cx, out_w, top_h, src_w, src_h)
                out_frame = np.vstack([top, black])
            else:
                x1 = int(cx - out_w / 2)
                x1 = max(0, min(x1, src_w - out_w))
                out_frame = frame[:, x1:x1 + out_w]
            try:
                proc.stdin.write(out_frame.tobytes())
            except BrokenPipeError:
                break
            frame_idx += 1
    finally:
        cap.release()
        try:
            proc.stdin.close()
        except BrokenPipeError:
            pass

    _, stderr = proc.communicate()
    if proc.returncode != 0:
        err_tail = (stderr or b"").decode("utf-8", errors="replace")[-1500:]
        log.error("ffmpeg composite gagal (rc=%d):\n%s", proc.returncode, err_tail)
        raise subprocess.CalledProcessError(proc.returncode, proc.args, stderr=err_tail)


def composite_split(
    clip_path: str,
    centers_left: np.ndarray,
    centers_right: np.ndarray,
    centers_single: np.ndarray,
    is_split: np.ndarray,
    src_w: int,
    src_h: int,
    ass_path: str,
    output_path: str,
    channel_name: str = "",
    source_credit: str = "",
    reserve_bottom: bool = False,
) -> None:
    """
    Dua panel speaker side-by-side, di-crop-to-fill.

    reserve_bottom: bila True, panel mengisi 60% atas dan 40% bawah hitam
    (untuk overlay edit clip). Bila False, panel mengisi tinggi frame penuh.
    """
    out_w   = int(src_h * 9 / 16)
    panel_w = out_w // 2
    out_h   = src_h
    top_h   = int(out_h * config.SPLIT_SCREEN_TOP_RATIO) if reserve_bottom else out_h

    cap     = cv2.VideoCapture(clip_path)
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    safe_ass = _escape_ass_path(ass_path)
    filters: list[str] = [f"ass=filename='{safe_ass}'"]

    if source_credit.strip():
        txt = _escape_drawtext(source_credit.strip())
        filters.append(
            f"drawtext=text='{txt}':font=Impact:fontsize=24"
            f":fontcolor=white@0.55:x=(w-text_w)/2:y=30"
            f":shadowcolor=black@0.6:shadowx=2:shadowy=2"
        )

    if channel_name.strip():
        txt = _escape_drawtext(channel_name.strip())
        filters.insert(1,
            f"drawtext=text='{txt}':font=Impact:fontsize=24"
            f":fontcolor=white@0.20:x=(w-text_w)/2:y=(h-text_h)/2"
            f":shadowcolor=black@0.20:shadowx=2:shadowy=2"
        )

    vf = ",".join(filters)

    proc = subprocess.Popen([
        "ffmpeg",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{out_w}x{out_h}",
        "-pix_fmt", "bgr24",
        "-r", f"{src_fps}",
        "-i", "-",
        "-i", clip_path,
        "-map", "0:v", "-map", "1:a",
        "-vf", vf,
        *_encoder_args(),
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-shortest",
        "-y", output_path,
    ], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    assert proc.stdin is not None

    black = np.zeros((out_h - top_h, out_w, 3), dtype=np.uint8)
    frame_idx = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            i = min(frame_idx, len(centers_left) - 1)

            if is_split[i]:
                left  = _crop_fill(frame, centers_left[i],  panel_w, top_h, src_w, src_h)
                right = _crop_fill(frame, centers_right[i], panel_w, top_h, src_w, src_h)
                top = np.hstack([left, right])
            else:
                top = _crop_fill(frame, centers_single[i], out_w, top_h, src_w, src_h)

            out_frame = np.vstack([top, black]) if reserve_bottom else top
            try:
                proc.stdin.write(out_frame.tobytes())
            except BrokenPipeError:
                break
            frame_idx += 1
    finally:
        cap.release()
        try:
            proc.stdin.close()
        except BrokenPipeError:
            pass

    _, stderr = proc.communicate()
    if proc.returncode != 0:
        err_tail = (stderr or b"").decode("utf-8", errors="replace")[-1500:]
        log.error("ffmpeg composite_split gagal (rc=%d):\n%s", proc.returncode, err_tail)
        raise subprocess.CalledProcessError(proc.returncode, proc.args, stderr=err_tail)
