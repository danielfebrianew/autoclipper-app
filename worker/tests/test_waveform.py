import sys
sys.path.insert(0, "..")

import struct
from fastapi.testclient import TestClient


class _FakeProc:
    def __init__(self, stdout=b""):
        self.stdout = stdout
        self.returncode = 0


def _patch_run(monkeypatch, stdout=b""):
    from routers import waveform
    monkeypatch.setattr(
        waveform.subprocess, "run",
        lambda *a, **k: _FakeProc(stdout=stdout),
    )


def test_waveform_buckets_peaks(monkeypatch):
    # 800 float samples, all 1.0 -> every bucket peak clamps to 1.0
    raw = struct.pack("800f", *([1.0] * 800))
    _patch_run(monkeypatch, stdout=raw)

    from main import app
    resp = TestClient(app).post("/waveform", json={
        "audio_path": "a.mp4", "samples": 100,
    })
    assert resp.status_code == 200
    peaks = resp.json()["peaks"]
    assert len(peaks) == 100
    assert all(0.0 <= p <= 1.0 for p in peaks)
    assert max(peaks) == 1.0


def test_waveform_clamps_above_one(monkeypatch):
    # Out-of-range amplitude must be clamped to 1.0
    raw = struct.pack("400f", *([5.0] * 400))
    _patch_run(monkeypatch, stdout=raw)

    from main import app
    resp = TestClient(app).post("/waveform", json={"audio_path": "a.mp4", "samples": 50})
    assert resp.status_code == 200
    assert all(p == 1.0 for p in resp.json()["peaks"])


def test_waveform_empty_audio_returns_zeros(monkeypatch):
    _patch_run(monkeypatch, stdout=b"")

    from main import app
    resp = TestClient(app).post("/waveform", json={"audio_path": "a.mp4", "samples": 30})
    assert resp.status_code == 200
    peaks = resp.json()["peaks"]
    assert peaks == [0.0] * 30
