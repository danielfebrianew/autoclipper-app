import logging
import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("worker.composite")
router = APIRouter()


class CompositeRequest(BaseModel):
    clip_path: str
    ass_path: str
    # centers: array float per-frame (dari /reframe)
    centers: list[float]
    # split-screen fields (opsional, untuk template dual)
    centers_left: Optional[list[float]] = None
    centers_right: Optional[list[float]] = None
    is_split: Optional[list[bool]] = None
    source_w: int = 0   # 0 = baca dari video
    source_h: int = 0
    clip_id: str
    out_dir: str
    ratio: str = "9:16"
    channel_name: str = ""
    source_credit: str = ""


@router.post("/composite")
def composite(req: CompositeRequest):
    logger.info(f"Compositing clip {req.clip_id} (ratio={req.ratio})")
    Path(req.out_dir).mkdir(parents=True, exist_ok=True)
    output_path = os.path.join(req.out_dir, f"{req.clip_id}_final.mp4")

    try:
        import cv2
        import numpy as np

        # Baca dimensi asli dari video jika tidak dikirim
        if req.source_w == 0 or req.source_h == 0:
            cap = cv2.VideoCapture(req.clip_path)
            src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
        else:
            src_w, src_h = req.source_w, req.source_h

        centers = np.array(req.centers, dtype=float)

        is_dual = (
            req.centers_left is not None
            and req.centers_right is not None
            and req.is_split is not None
        )

        if is_dual:
            from processing.ffmpeg_utils import composite_split
            centers_left  = np.array(req.centers_left,  dtype=float)
            centers_right = np.array(req.centers_right, dtype=float)
            is_split      = np.array(req.is_split,      dtype=bool)
            composite_split(
                req.clip_path, centers_left, centers_right, centers, is_split,
                src_w, src_h, req.ass_path, output_path,
                channel_name=req.channel_name,
                source_credit=req.source_credit,
            )
        else:
            from processing.ffmpeg_utils import composite as composite_fn
            composite_fn(
                req.clip_path, centers, src_w, src_h,
                req.ass_path, output_path,
                channel_name=req.channel_name,
                source_credit=req.source_credit,
                ratio=req.ratio,
            )

    except Exception as e:
        logger.exception(f"Composite gagal untuk clip {req.clip_id}")
        raise HTTPException(status_code=500, detail=str(e))

    logger.info(f"Clip {req.clip_id} done: {output_path}")
    return {"output_path": output_path}
