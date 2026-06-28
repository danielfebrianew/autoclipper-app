import sys
sys.path.insert(0, "..")

import json
import subprocess
from fastapi.testclient import TestClient


class _FakeProc:
    def __init__(self, stdout="", stderr="", returncode=0):
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode


def _patch_run(monkeypatch, proc=None, raise_called_process=False):
    from routers import metadata

    def fake_run(cmd, capture_output=True, text=True, check=True):
        if raise_called_process:
            raise subprocess.CalledProcessError(1, cmd, stderr="boom")
        return proc

    monkeypatch.setattr(metadata.subprocess, "run", fake_run)


def test_metadata_maps_fields(monkeypatch):
    info = {
        "title": "Video Keren",
        "channel": "Channel A",
        "duration": 612,
        "view_count": 12345,
        "id": "vid123",
        "heatmap": [
            {"start_time": 0, "end_time": 5, "value": 0.9},
            {"start_time": 5, "end_time": 10, "value": 0.4},
        ],
    }
    _patch_run(monkeypatch, _FakeProc(stdout=json.dumps(info)))

    from main import app
    resp = TestClient(app).post("/metadata", json={"url": "http://x"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Video Keren"
    assert data["channel"] == "Channel A"
    assert data["duration"] == 612
    assert data["views"] == 12345
    assert data["video_id"] == "vid123"
    assert len(data["heatmap"]) == 2
    assert data["heatmap"][0]["value"] == 0.9


def test_metadata_uploader_fallback_and_no_heatmap(monkeypatch):
    info = {"title": "T", "uploader": "Uploader B", "id": "z"}  # no 'channel', no heatmap
    _patch_run(monkeypatch, _FakeProc(stdout=json.dumps(info)))

    from main import app
    resp = TestClient(app).post("/metadata", json={"url": "http://x"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["channel"] == "Uploader B"
    assert data["duration"] == 0  # default
    assert data["heatmap"] == []


def test_metadata_yt_dlp_failure_returns_500(monkeypatch):
    _patch_run(monkeypatch, raise_called_process=True)

    from main import app
    resp = TestClient(app).post("/metadata", json={"url": "http://x"})
    assert resp.status_code == 500
    assert "yt-dlp failed" in resp.json()["detail"]
