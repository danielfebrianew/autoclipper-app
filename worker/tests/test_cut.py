import sys
sys.path.insert(0, "..")

import os
import subprocess
from fastapi.testclient import TestClient


class _FakeCompleted:
    def __init__(self):
        self.returncode = 0
        self.stdout = ""
        self.stderr = ""


def _patch_run(monkeypatch, capture=None, error=None):
    from routers import cut

    def _run(cmd, *a, **k):
        if capture is not None:
            capture["cmd"] = cmd
        if error is not None:
            raise error
        return _FakeCompleted()

    monkeypatch.setattr(cut.subprocess, "run", _run)


def test_cut_returns_clip_path(monkeypatch, tmp_path):
    cap = {}
    _patch_run(monkeypatch, capture=cap)

    from main import app
    resp = TestClient(app).post("/cut", json={
        "video_path": "src.mp4", "clip_id": "c1",
        "start": 10, "end": 40, "out_dir": str(tmp_path),
    })
    assert resp.status_code == 200
    expected = os.path.join(str(tmp_path), "c1_raw.mp4")
    assert resp.json()["clip_path"] == expected


def test_cut_builds_ffmpeg_args(monkeypatch, tmp_path):
    cap = {}
    _patch_run(monkeypatch, capture=cap)

    from main import app
    TestClient(app).post("/cut", json={
        "video_path": "src.mp4", "clip_id": "c1",
        "start": 10, "end": 40, "out_dir": str(tmp_path),
    })
    cmd = cap["cmd"]
    # -ss start, -i input, -t duration(end-start)
    assert cmd[cmd.index("-ss") + 1] == "10"
    assert cmd[cmd.index("-i") + 1] == "src.mp4"
    assert cmd[cmd.index("-t") + 1] == "30"


def test_cut_creates_out_dir(monkeypatch, tmp_path):
    _patch_run(monkeypatch)
    out = tmp_path / "nested" / "clips"

    from main import app
    resp = TestClient(app).post("/cut", json={
        "video_path": "src.mp4", "clip_id": "c1",
        "start": 0, "end": 5, "out_dir": str(out),
    })
    assert resp.status_code == 200
    assert out.is_dir()


def test_cut_ffmpeg_failure_is_500(monkeypatch, tmp_path):
    err = subprocess.CalledProcessError(1, "ffmpeg", stderr="boom stderr")
    _patch_run(monkeypatch, error=err)

    from main import app
    resp = TestClient(app).post("/cut", json={
        "video_path": "src.mp4", "clip_id": "c1",
        "start": 0, "end": 5, "out_dir": str(tmp_path),
    })
    assert resp.status_code == 500
    assert "boom stderr" in resp.json()["detail"]
