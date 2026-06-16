import logging
from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("worker.facetrack")
router = APIRouter()

_yolo = None


def get_yolo():
    global _yolo
    if _yolo is None:
        import os
        from ultralytics import YOLO
        model_path = os.environ.get("YOLO_MODEL_PATH", "yolov8n-face.pt")
        logger.info(f"Loading YOLO model from {model_path}")
        _yolo = YOLO(model_path)
    return _yolo


class FacetrackRequest(BaseModel):
    video_path: str
    start: int = 0
    end: int = 0


class FaceFrame(BaseModel):
    frame: int
    time: float = 0.0
    x: float
    y: float
    w: float
    h: float


@router.post("/facetrack")
def facetrack(req: FacetrackRequest):
    logger.info(f"Face-tracking {req.video_path} [{req.start}s-{req.end}s]")
    try:
        import cv2
        model = get_yolo()

        cap = cv2.VideoCapture(req.video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        frame_w = cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920
        frame_h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080

        start_frame = int(req.start * fps) if req.start > 0 else 0
        end_frame = int(req.end * fps) if req.end > req.start else total_frames

        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

        frames: List[dict] = []
        frame_idx = start_frame

        while frame_idx < end_frame:
            ret, frame = cap.read()
            if not ret:
                break

            # Sample every 0.25s for smoother tracking
            if (frame_idx - start_frame) % max(1, int(fps * 0.25)) == 0:
                results = model(frame, verbose=False)
                for box in results[0].boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    frames.append({
                        "frame": frame_idx,
                        "time": round(frame_idx / fps, 3),
                        "x": round(x1 / frame_w, 4),
                        "y": round(y1 / frame_h, 4),
                        "w": round((x2 - x1) / frame_w, 4),
                        "h": round((y2 - y1) / frame_h, 4),
                    })
                    break  # primary face only

            frame_idx += 1

        cap.release()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    logger.info(f"Facetrack: {len(frames)} frames with faces")
    return {"frames": frames}
