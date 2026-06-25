import sys
sys.path.insert(0, "..")

from fastapi.testclient import TestClient


# --- Fakes: no real YOLO model, no real video file ---

class _FakeTensor:
    def __init__(self, vals):
        self._vals = vals

    def tolist(self):
        return self._vals


class _FakeBox:
    def __init__(self, x1, y1, x2, y2):
        self.xyxy = [_FakeTensor([x1, y1, x2, y2])]


class _FakeResult:
    def __init__(self, boxes):
        self.boxes = boxes


class _MultiFaceModel:
    """Returns TWO faces — facetrack must keep only the first (primary)."""
    def __call__(self, frame, verbose=False):
        return [_FakeResult([
            _FakeBox(192, 108, 384, 324),   # primary
            _FakeBox(960, 540, 1100, 700),  # secondary (should be ignored)
        ])]


class _FakeCapture:
    PROP_POS_FRAMES = 1

    def __init__(self, n_frames=30, w=1920, h=1080, fps=30.0):
        self._n = n_frames
        self._i = 0
        self._props = {3: w, 4: h, 5: fps, 7: n_frames}  # 7 = FRAME_COUNT

    def get(self, prop):
        return self._props.get(prop, 0)

    def set(self, prop, value):
        # router seeks to start_frame; our reads start from 0 regardless
        return True

    def read(self):
        if self._i >= self._n:
            return False, None
        self._i += 1
        return True, object()

    def release(self):
        pass


def _patch(monkeypatch, capture):
    import cv2
    from routers import facetrack
    monkeypatch.setattr(cv2, "VideoCapture", lambda path: capture)
    monkeypatch.setattr(facetrack, "get_yolo", lambda: _MultiFaceModel())


def test_facetrack_primary_face_only(monkeypatch):
    # 30 frames @ 30fps, sample every 0.25s -> every 7 frames -> frames 0,7,14,21,28 = 5 samples
    _patch(monkeypatch, _FakeCapture(n_frames=30, w=1920, h=1080, fps=30.0))
    from main import app
    client = TestClient(app)

    resp = client.post("/facetrack", json={"video_path": "v.mp4", "start": 0, "end": 0})
    assert resp.status_code == 200
    frames = resp.json()["frames"]
    assert len(frames) == 5  # one entry per sampled frame, primary face only


def test_facetrack_normalized_coords(monkeypatch):
    _patch(monkeypatch, _FakeCapture(n_frames=1, w=1920, h=1080, fps=30.0))
    from main import app
    client = TestClient(app)

    resp = client.post("/facetrack", json={"video_path": "v.mp4"})
    assert resp.status_code == 200
    f = resp.json()["frames"][0]
    # Primary box (192,108)-(384,324) normalized by 1920x1080
    assert f["x"] == round(192 / 1920, 4)   # 0.1
    assert f["y"] == round(108 / 1080, 4)   # 0.1
    assert f["w"] == round((384 - 192) / 1920, 4)  # 0.1
    assert f["h"] == round((324 - 108) / 1080, 4)  # 0.2
    assert 0.0 <= f["x"] <= 1.0
    assert "frame" in f and "time" in f


def test_facetrack_empty_video(monkeypatch):
    _patch(monkeypatch, _FakeCapture(n_frames=0, fps=30.0))
    from main import app
    client = TestClient(app)

    resp = client.post("/facetrack", json={"video_path": "v.mp4"})
    assert resp.status_code == 200
    assert resp.json()["frames"] == []
