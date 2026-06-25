import sys
sys.path.insert(0, "..")

from fastapi.testclient import TestClient


# --- Fakes so we never load a real YOLO model or open a real video file ---

class _FakeBox:
    """Mimics an ultralytics box: .xyxy[0].tolist() and .conf[0]."""
    def __init__(self, x1, y1, x2, y2, conf):
        self.xyxy = [_FakeTensor([x1, y1, x2, y2])]
        self.conf = [conf]


class _FakeTensor:
    def __init__(self, vals):
        self._vals = vals

    def tolist(self):
        return self._vals


class _FakeResult:
    def __init__(self, boxes):
        self.boxes = boxes


class _FakeModel:
    """Returns one detected face for every frame it's called on."""
    def __call__(self, frame, verbose=False):
        return [_FakeResult([_FakeBox(500, 200, 600, 320, 0.9)])]


class _FakeCapture:
    """Fake cv2.VideoCapture yielding `n_frames` frames then stopping."""
    # cv2 prop constants used by the router
    PROP_W, PROP_H, PROP_FPS = 3, 4, 5

    def __init__(self, n_frames=10, w=1920, h=1080, fps=30.0):
        self._n = n_frames
        self._i = 0
        self._props = {3: w, 4: h, 5: fps}

    def get(self, prop):
        return self._props.get(prop, 0)

    def read(self):
        if self._i >= self._n:
            return False, None
        self._i += 1
        return True, object()  # frame content is irrelevant — model is faked

    def release(self):
        pass


def _patch(monkeypatch, capture):
    """Patch cv2.VideoCapture + the router's get_yolo."""
    import cv2
    from routers import detect_faces
    monkeypatch.setattr(cv2, "VideoCapture", lambda path: capture)
    monkeypatch.setattr(detect_faces, "get_yolo", lambda model_path: _FakeModel())


def test_detect_faces_shape(monkeypatch):
    # 30fps, sample_interval = 15 frames (0.5s). 30 frames -> indices 0 and 15 sampled.
    _patch(monkeypatch, _FakeCapture(n_frames=30, w=1920, h=1080, fps=30.0))
    from main import app
    client = TestClient(app)

    resp = client.post("/detect-faces", json={"clip_path": "x.mp4", "model_path": "m.pt"})
    assert resp.status_code == 200
    data = resp.json()

    assert data["source_w"] == 1920
    assert data["source_h"] == 1080
    assert data["fps"] == 30.0
    # 30 frames @ interval 15 -> frames 0 and 15 sampled -> 2 entries
    assert len(data["face_data"]) == 2


def test_detect_faces_pixel_coords(monkeypatch):
    _patch(monkeypatch, _FakeCapture(n_frames=1, fps=30.0))
    from main import app
    client = TestClient(app)

    resp = client.post("/detect-faces", json={"clip_path": "x.mp4", "model_path": "m.pt"})
    assert resp.status_code == 200
    face = resp.json()["face_data"][0]["faces"][0]
    # Coordinates are absolute pixels: w = x2-x1 = 100, h = y2-y1 = 120
    assert face["x"] == 500
    assert face["y"] == 200
    assert face["w"] == 100
    assert face["h"] == 120
    assert face["conf"] == 0.9


def test_detect_faces_no_faces(monkeypatch):
    cap = _FakeCapture(n_frames=5, fps=30.0)
    import cv2
    from routers import detect_faces

    class _EmptyModel:
        def __call__(self, frame, verbose=False):
            return [_FakeResult([])]  # no detections

    monkeypatch.setattr(cv2, "VideoCapture", lambda path: cap)
    monkeypatch.setattr(detect_faces, "get_yolo", lambda model_path: _EmptyModel())

    from main import app
    client = TestClient(app)
    resp = client.post("/detect-faces", json={"clip_path": "x.mp4", "model_path": "m.pt"})
    assert resp.status_code == 200
    # No faces detected -> empty face_data, but still returns source dims
    assert resp.json()["face_data"] == []
