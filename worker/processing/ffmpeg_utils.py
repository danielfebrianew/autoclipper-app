import subprocess
import cv2
import numpy as np
from . import config
import logging

log = logging.getLogger("worker.processing.ffmpeg")


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
) -> None:
    """
    Composite per-frame: crop bergerak sesuai centers[frame_idx], burn subtitle ASS,
    overlay drawtext opsional, encode ke output_path.
    """
    from processing.reframe import RATIO_MAP
    ratio_val = RATIO_MAP.get(ratio, 9 / 16)
    crop_w = int(src_h * ratio_val)

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
        "-s", f"{crop_w}x{src_h}",
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

    frame_idx = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            cx = centers[min(frame_idx, len(centers) - 1)]
            x1 = int(cx - crop_w / 2)
            x1 = max(0, min(x1, src_w - crop_w))
            cropped = frame[:, x1:x1 + crop_w]
            try:
                proc.stdin.write(cropped.tobytes())
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
) -> None:
    """
    Split-screen composite: top 60% → dua panel speaker, bottom 40% → hitam.
    """
    panel_w = int(src_h * 9 / 16) // 2
    out_w   = panel_w * 2
    top_h   = int(src_h * config.SPLIT_SCREEN_TOP_RATIO)

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
        "-s", f"{out_w}x{src_h}",
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

    bottom = np.zeros((src_h - top_h, out_w, 3), dtype=np.uint8)
    frame_idx = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            i = min(frame_idx, len(centers_left) - 1)

            if is_split[i]:
                cx_l = centers_left[i]
                cx_r = centers_right[i]
                x1_l = int(np.clip(cx_l - panel_w / 2, 0, src_w - panel_w))
                x1_r = int(np.clip(cx_r - panel_w / 2, 0, src_w - panel_w))
                left_crop  = frame[:top_h, x1_l:x1_l + panel_w]
                right_crop = frame[:top_h, x1_r:x1_r + panel_w]
                top = np.hstack([left_crop, right_crop])
            else:
                cx_s = centers_single[i]
                x1_s = int(np.clip(cx_s - out_w / 2, 0, src_w - out_w))
                top = frame[:top_h, x1_s:x1_s + out_w]

            out_frame = np.vstack([top, bottom])
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
