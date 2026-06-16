import logging
import os
import subprocess
import tempfile
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("worker.reframe")
router = APIRouter()

_yolo = None


def _get_yolo(model_path: str):
    global _yolo
    if _yolo is None:
        from ultralytics import YOLO
        logger.info(f"Loading YOLO model from {model_path}")
        _yolo = YOLO(model_path)
    return _yolo


def _extract_wav(clip_path: str) -> str:
    """Extract audio ke WAV mono 16kHz ke file temporer. Caller wajib hapus."""
    wav_fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(wav_fd)
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-i", clip_path,
            "-ac", "1", "-ar", "16000", "-f", "wav", wav_path,
        ],
        capture_output=True,
    )
    if result.returncode != 0:
        os.unlink(wav_path)
        raise RuntimeError(f"ffmpeg audio extract gagal: {result.stderr.decode()[-500:]}")
    return wav_path


class ReframeRequest(BaseModel):
    clip_path: str
    model_path: str
    source_w: int = 0   # 0 = baca dari video
    source_h: int = 0
    ratio: str = "9:16"
    template: str = "single"  # single|dual|static|speaker


@router.post("/reframe")
def reframe(req: ReframeRequest):
    logger.info(f"Reframing {req.clip_path} (ratio={req.ratio}, template={req.template})")
    try:
        import cv2

        cap = cv2.VideoCapture(req.clip_path)
        src_w = req.source_w or int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        src_h = req.source_h or int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        cap.release()

        if req.template == "static" or not req.model_path:
            from processing.reframe import RATIO_MAP
            ratio_val = RATIO_MAP.get(req.ratio, 9 / 16)
            default_cx = src_w / 2
            return {
                "centers": [default_cx],
                "source_w": src_w,
                "source_h": src_h,
                "fps": src_fps,
                "stats": {},
            }

        face_model = _get_yolo(req.model_path)

        if req.template in ("dual", "dual_side"):
            from processing.reframe import compute_dual_crop_centers_streaming
            centers_left, centers_right, centers_single, is_split, stats = \
                compute_dual_crop_centers_streaming(req.clip_path, face_model, src_w, src_h, src_fps)
            return {
                "centers": centers_single.tolist(),
                "centers_left": centers_left.tolist(),
                "centers_right": centers_right.tolist(),
                "is_split": is_split.tolist(),
                "source_w": src_w,
                "source_h": src_h,
                "fps": src_fps,
                "stats": stats,
            }

        # --- template single | speaker ---
        asd_scores = None
        if req.template == "speaker":
            from processing.asd import is_asd_enabled, load_asd_model, compute_asd_scores
            from processing.face import sample_face_frame

            if is_asd_enabled():
                logger.info("ASD aktif — mengekstrak audio + menghitung speaking scores…")
                wav_path = None
                try:
                    wav_path = _extract_wav(req.clip_path)
                    asd_model, asd_device = load_asd_model()

                    # Kumpulkan face tracks dari sampel frame untuk ASD
                    import cv2 as _cv2
                    cap2 = _cv2.VideoCapture(req.clip_path)
                    total_frames = int(cap2.get(_cv2.CAP_PROP_FRAME_COUNT))
                    face_interval = max(1, int(src_fps / 2))  # sample 2 fps untuk ASD
                    face_tracks = []
                    for fi in range(0, total_frames, face_interval):
                        cap2.set(_cv2.CAP_PROP_POS_FRAMES, fi)
                        ret, frame = cap2.read()
                        if not ret:
                            break
                        results = face_model(frame, verbose=False)
                        if results and results[0].boxes is not None:
                            for box in results[0].boxes.xyxy.cpu().numpy():
                                face_tracks.append({"frame": fi, "box": tuple(box[:4])})
                    cap2.release()

                    asd_scores = compute_asd_scores(
                        req.clip_path, wav_path, face_tracks,
                        asd_model, asd_device, src_fps,
                    )
                    logger.info("ASD selesai — %d frame scores", len(asd_scores))
                except Exception as e:
                    logger.warning("ASD gagal, fallback ke non-ASD: %s", e)
                    asd_scores = None
                finally:
                    if wav_path and os.path.exists(wav_path):
                        os.unlink(wav_path)
            else:
                logger.info("Template speaker tapi AUTOCLIPPER_ASD=0 — reframe biasa")

        from processing.reframe import compute_crop_centers_streaming
        centers, stats = compute_crop_centers_streaming(
            req.clip_path, face_model, src_w, src_h, src_fps,
            ratio=req.ratio,
            asd_scores=asd_scores,
        )
        logger.info(
            "Reframe done — scene_cuts=%s keyframes=%s focus_changes=%s asd=%s",
            stats.get("scene_cuts"), stats.get("target_keyframes"),
            stats.get("smooth_focus_changes"), asd_scores is not None,
        )
        return {
            "centers": centers.tolist(),
            "source_w": src_w,
            "source_h": src_h,
            "fps": src_fps,
            "stats": stats,
        }

    except Exception as e:
        logger.exception("Reframe gagal")
        raise HTTPException(status_code=500, detail=str(e))
