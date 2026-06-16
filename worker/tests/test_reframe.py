import sys
sys.path.insert(0, "..")

from routers.reframe import _smooth_keyframes


def test_center_crop_no_faces():
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)
    resp = client.post("/reframe", json={"face_data": [], "source_w": 1920, "source_h": 1080})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["keyframes"]) >= 1
    # Center crop: (1920 - 607) // 2 = 656
    assert data["keyframes"][0]["crop_x"] == (1920 - data["keyframes"][0]["crop_w"]) // 2


def test_crop_with_face():
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)
    faces = [
        {"timestamp": 0.0, "faces": [{"x": 500, "y": 200, "w": 100, "h": 120, "conf": 0.9}]},
        {"timestamp": 0.5, "faces": [{"x": 800, "y": 200, "w": 100, "h": 120, "conf": 0.9}]},
    ]
    resp = client.post("/reframe", json={"face_data": faces, "source_w": 1920, "source_h": 1080})
    assert resp.status_code == 200
    kf = resp.json()["keyframes"]
    assert len(kf) == 2
    assert all(0 <= k["crop_x"] <= 1920 for k in kf)


def test_smooth_keyframes():
    kfs = [
        {"time": 0.0, "crop_x": 100, "crop_w": 607, "crop_h": 1080},
        {"time": 0.5, "crop_x": 900, "crop_w": 607, "crop_h": 1080},
        {"time": 1.0, "crop_x": 110, "crop_w": 607, "crop_h": 1080},
    ]
    smoothed = _smooth_keyframes(kfs)
    assert len(smoothed) == 3
    # Middle keyframe should be smoothed toward neighbors
    assert smoothed[1]["crop_x"] != 900
