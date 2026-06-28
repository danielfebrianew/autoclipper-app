import sys
sys.path.insert(0, "..")

from fastapi.testclient import TestClient


class _FakeCapture:
    def __init__(self, w=1920, h=1080, fps=30.0):
        self._props = {3: w, 4: h, 5: fps}

    def get(self, prop):
        return self._props.get(prop, 0)

    def release(self):
        pass


def _patch_cv2(monkeypatch, cap):
    import cv2
    monkeypatch.setattr(cv2, "VideoCapture", lambda path: cap)


def test_reframe_static_center(monkeypatch):
    # static template: no YOLO, returns a single center at frame mid-width.
    _patch_cv2(monkeypatch, _FakeCapture(w=1920, h=1080, fps=30.0))

    from main import app
    resp = TestClient(app).post("/reframe", json={
        "clip_path": "c.mp4", "model_path": "m.pt",
        "template": "static", "ratio": "9:16",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["centers"] == [1920 / 2]
    assert data["source_w"] == 1920
    assert data["source_h"] == 1080
    assert data["fps"] == 30.0


def test_reframe_empty_model_path_falls_back_to_static(monkeypatch):
    # No model_path -> treated like static even if template != static.
    _patch_cv2(monkeypatch, _FakeCapture(w=1280, h=720))

    from main import app
    resp = TestClient(app).post("/reframe", json={
        "clip_path": "c.mp4", "model_path": "",
        "template": "single",
    })
    assert resp.status_code == 200
    assert resp.json()["centers"] == [1280 / 2]


def test_reframe_single_uses_compute_centers(monkeypatch):
    import numpy as np
    _patch_cv2(monkeypatch, _FakeCapture(w=1920, h=1080, fps=25.0))

    from routers import reframe
    import processing.reframe as proc_reframe
    # Avoid loading YOLO + running the real streaming pipeline. The router does a
    # local `from processing.reframe import compute_crop_centers_streaming`, so we
    # patch the symbol on its source module, not on the router namespace.
    monkeypatch.setattr(reframe, "_get_yolo", lambda model_path: object())
    monkeypatch.setattr(
        proc_reframe, "compute_crop_centers_streaming",
        lambda *a, **k: (np.array([100.0, 200.0, 300.0]), {"scene_cuts": 1}),
    )

    from main import app
    resp = TestClient(app).post("/reframe", json={
        "clip_path": "c.mp4", "model_path": "m.pt", "template": "single",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["centers"] == [100.0, 200.0, 300.0]
    assert data["stats"]["scene_cuts"] == 1
