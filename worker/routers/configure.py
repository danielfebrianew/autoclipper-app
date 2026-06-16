"""
/configure — terima tuning config dari Go dan set env vars di process ini.
Dipanggil sekali oleh Go setelah worker ready (health check OK).
"""

import os
import logging
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter

logger = logging.getLogger("worker.configure")
router = APIRouter()


class TuningConfig(BaseModel):
    # Video encoder
    encoder: Optional[str] = None     # auto|h264_videotoolbox|libx264
    bitrate: Optional[str] = None     # e.g. "5000k"

    # Crop smoothing
    deadzone_ratio: Optional[float] = None
    max_speed_px_per_sec: Optional[float] = None
    smoothing_tau_sec: Optional[float] = None

    # Scene cut
    scene_cut_score: Optional[float] = None
    scene_cut_hist: Optional[float] = None
    scene_cut_pixel: Optional[float] = None

    # Data dir (untuk ASD weights)
    data_dir: Optional[str] = None


@router.post("/configure")
def configure(cfg: TuningConfig):
    mapping = {
        "AUTOCLIPPER_ENCODER":           cfg.encoder,
        "AUTOCLIPPER_BITRATE":           cfg.bitrate,
        "AUTOCLIPPER_CROP_DEADZONE":     str(cfg.deadzone_ratio)     if cfg.deadzone_ratio     is not None else None,
        "AUTOCLIPPER_CROP_MAX_SPEED":    str(cfg.max_speed_px_per_sec) if cfg.max_speed_px_per_sec is not None else None,
        "AUTOCLIPPER_CROP_SMOOTHING_TAU": str(cfg.smoothing_tau_sec) if cfg.smoothing_tau_sec  is not None else None,
        "AUTOCLIPPER_SCENE_CUT_SCORE":   str(cfg.scene_cut_score)    if cfg.scene_cut_score    is not None else None,
        "AUTOCLIPPER_SCENE_CUT_HIST":    str(cfg.scene_cut_hist)     if cfg.scene_cut_hist     is not None else None,
        "AUTOCLIPPER_SCENE_CUT_PIXEL":   str(cfg.scene_cut_pixel)    if cfg.scene_cut_pixel    is not None else None,
        "AUTOCLIPPER_DATA_DIR":          cfg.data_dir,
    }

    applied = []
    for key, val in mapping.items():
        if val is not None:
            os.environ[key] = val
            applied.append(key)

    # Reset cached encoder so it re-detects with new setting
    if "AUTOCLIPPER_ENCODER" in applied:
        try:
            from processing import ffmpeg_utils
            ffmpeg_utils._ENCODER = None
        except Exception:
            pass

    logger.info("Config applied: %s", applied)
    return {"applied": applied}
