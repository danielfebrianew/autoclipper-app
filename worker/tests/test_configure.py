import sys
sys.path.insert(0, "..")

import os
from fastapi.testclient import TestClient


def _clear_env(monkeypatch):
    for key in (
        "AUTOCLIPPER_ENCODER", "AUTOCLIPPER_BITRATE", "AUTOCLIPPER_CROP_DEADZONE",
        "AUTOCLIPPER_CROP_MAX_SPEED", "AUTOCLIPPER_CROP_SMOOTHING_TAU",
        "AUTOCLIPPER_SCENE_CUT_SCORE", "AUTOCLIPPER_SCENE_CUT_HIST",
        "AUTOCLIPPER_SCENE_CUT_PIXEL", "AUTOCLIPPER_DATA_DIR",
    ):
        monkeypatch.delenv(key, raising=False)


def test_configure_sets_env_vars(monkeypatch):
    _clear_env(monkeypatch)

    from main import app
    resp = TestClient(app).post("/configure", json={
        "encoder": "libx264",
        "bitrate": "5000k",
        "deadzone_ratio": 0.1,
        "data_dir": "/tmp/weights",
    })
    assert resp.status_code == 200
    applied = resp.json()["applied"]
    assert "AUTOCLIPPER_ENCODER" in applied
    assert "AUTOCLIPPER_BITRATE" in applied
    assert "AUTOCLIPPER_CROP_DEADZONE" in applied
    assert "AUTOCLIPPER_DATA_DIR" in applied

    assert os.environ["AUTOCLIPPER_ENCODER"] == "libx264"
    assert os.environ["AUTOCLIPPER_BITRATE"] == "5000k"
    # floats stringified
    assert os.environ["AUTOCLIPPER_CROP_DEADZONE"] == "0.1"
    assert os.environ["AUTOCLIPPER_DATA_DIR"] == "/tmp/weights"


def test_configure_skips_none_fields(monkeypatch):
    _clear_env(monkeypatch)

    from main import app
    resp = TestClient(app).post("/configure", json={"bitrate": "3000k"})
    assert resp.status_code == 200
    applied = resp.json()["applied"]
    assert applied == ["AUTOCLIPPER_BITRATE"]
    assert "AUTOCLIPPER_ENCODER" not in os.environ


def test_configure_empty_payload_applies_nothing(monkeypatch):
    _clear_env(monkeypatch)

    from main import app
    resp = TestClient(app).post("/configure", json={})
    assert resp.status_code == 200
    assert resp.json()["applied"] == []


def test_configure_encoder_resets_cached_encoder(monkeypatch):
    _clear_env(monkeypatch)
    import processing.ffmpeg_utils as fu
    fu._ENCODER = "stale"

    from main import app
    resp = TestClient(app).post("/configure", json={"encoder": "h264_videotoolbox"})
    assert resp.status_code == 200
    # encoder change must invalidate the cached encoder so it re-detects
    assert fu._ENCODER is None


def test_configure_zero_float_is_applied(monkeypatch):
    # 0.0 is not None -> must still be applied (regression guard against falsy check)
    _clear_env(monkeypatch)

    from main import app
    resp = TestClient(app).post("/configure", json={"deadzone_ratio": 0.0})
    assert resp.status_code == 200
    assert "AUTOCLIPPER_CROP_DEADZONE" in resp.json()["applied"]
    assert os.environ["AUTOCLIPPER_CROP_DEADZONE"] == "0.0"
