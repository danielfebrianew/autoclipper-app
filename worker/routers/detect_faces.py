import logging
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("worker.detect_faces")
router = APIRouter()

_yolo = None


def get_yolo(model_path: str):
    global _yolo
    if _yolo is None:
        from ultralytics import YOLO
        logger.info(f"Loading YOLO model from {model_path}")
        _yolo = YOLO(model_path)
    return _yolo


class DetectFacesRequest(BaseModel):
    clip_path: str
    model_path: str


@router.post("/detect-faces")
def detect_faces(req: DetectFacesRequest):
    logger.info(f"Detecting faces in {req.clip_path}")
    try:
        import cv2
        model = get_yolo(req.model_path)

        cap = cv2.VideoCapture(req.clip_path)
        src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        face_data = []
        frame_idx = 0

        sample_interval = max(1, int(fps * 0.5))

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_interval == 0:
                results = model(frame, verbose=False)
                timestamp = frame_idx / fps
                faces = []
                for box in results[0].boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    faces.append({
                        "x": int(x1), "y": int(y1),
                        "w": int(x2 - x1), "h": int(y2 - y1),
                        "conf": float(box.conf[0]),
                    })
                if faces:
                    face_data.append({"timestamp": round(timestamp, 3), "faces": faces})

            frame_idx += 1

        cap.release()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    logger.info(f"Detected faces in {len(face_data)} frames ({src_w}x{src_h} @ {fps:.1f}fps)")
    return {
        "face_data": face_data,
        "source_w": src_w,
        "source_h": src_h,
        "fps": fps,
    }
