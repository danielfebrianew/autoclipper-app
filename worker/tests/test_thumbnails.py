import sys
sys.path.insert(0, "..")

import os
import subprocess
from fastapi.testclient import TestClient


def _patch_run(monkeypatch, write_files=True, error=None, capture=None):
    """Fake ffmpeg: optionally create the output jpg the router checks for."""
    from routers import thumbnails

    def _run(cmd, *a, **k):
        if capture is not None:
            capture.setdefault("cmds", []).append(cmd)
        if error is not None:
            raise error
        if write_files:
            out_path = cmd[-1]  # last arg is the output file
            with open(out_path, "wb") as f:
                f.write(b"jpg")

        class _Done:
            returncode = 0
        return _Done()

    monkeypatch.setattr(thumbnails.subprocess, "run", _run)


def test_thumbnails_generates_count_files(monkeypatch, tmp_path):
    _patch_run(monkeypatch)

    from main import app
    resp = TestClient(app).post("/thumbnails", json={
        "video_path": "v.mp4", "start": 0, "end": 100,
        "count": 5, "out_dir": str(tmp_path),
    })
    assert resp.status_code == 200
    paths = resp.json()["paths"]
    assert len(paths) == 5
    assert paths[0] == os.path.join(str(tmp_path), "thumb_000.jpg")
    assert all(os.path.exists(p) for p in paths)


def test_thumbnails_timestamps_centered_in_interval(monkeypatch, tmp_path):
    cap = {}
    _patch_run(monkeypatch, capture=cap)

    from main import app
    # duration 100, count 10 -> interval 10 -> first ts = 0 + 0 + 5 = 5
    TestClient(app).post("/thumbnails", json={
        "video_path": "v.mp4", "start": 0, "end": 100,
        "count": 10, "out_dir": str(tmp_path),
    })
    first_cmd = cap["cmds"][0]
    assert first_cmd[first_cmd.index("-ss") + 1] == "5.0"


def test_thumbnails_invalid_range_is_400(monkeypatch, tmp_path):
    _patch_run(monkeypatch)

    from main import app
    resp = TestClient(app).post("/thumbnails", json={
        "video_path": "v.mp4", "start": 50, "end": 50,
        "count": 5, "out_dir": str(tmp_path),
    })
    assert resp.status_code == 400
    assert "end must be greater than start" in resp.json()["detail"]


def test_thumbnails_ffmpeg_failure_is_500(monkeypatch, tmp_path):
    err = subprocess.CalledProcessError(1, "ffmpeg", stderr="bad frame")
    _patch_run(monkeypatch, error=err)

    from main import app
    resp = TestClient(app).post("/thumbnails", json={
        "video_path": "v.mp4", "start": 0, "end": 10,
        "count": 3, "out_dir": str(tmp_path),
    })
    assert resp.status_code == 500
    assert "bad frame" in resp.json()["detail"]


def test_thumbnails_skips_missing_outputs(monkeypatch, tmp_path):
    # ffmpeg "succeeds" but never writes files -> paths stays empty
    _patch_run(monkeypatch, write_files=False)

    from main import app
    resp = TestClient(app).post("/thumbnails", json={
        "video_path": "v.mp4", "start": 0, "end": 10,
        "count": 3, "out_dir": str(tmp_path),
    })
    assert resp.status_code == 200
    assert resp.json()["paths"] == []
