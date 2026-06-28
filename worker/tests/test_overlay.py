import sys
sys.path.insert(0, "..")

import json
from fastapi.testclient import TestClient


class _FakeProc:
    def __init__(self, stdout="", stderr="", returncode=0):
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode


# --- /overlay/probe ---

def test_probe_missing_file_returns_404():
    from main import app
    resp = TestClient(app).post("/overlay/probe", json={"video_path": "/no/such/file.mp4"})
    assert resp.status_code == 404


def test_probe_parses_ffprobe(monkeypatch, tmp_path):
    vid = tmp_path / "v.mp4"
    vid.write_bytes(b"x")
    ffprobe_out = json.dumps({
        "streams": [{"width": 1080, "height": 1920, "r_frame_rate": "30/1"}],
        "format": {"duration": "12.5"},
    })
    from routers import overlay
    monkeypatch.setattr(
        overlay.subprocess, "run",
        lambda *a, **k: _FakeProc(stdout=ffprobe_out, returncode=0),
    )

    from main import app
    resp = TestClient(app).post("/overlay/probe", json={"video_path": str(vid)})
    assert resp.status_code == 200
    data = resp.json()
    assert data["width"] == 1080
    assert data["height"] == 1920
    assert data["fps"] == 30.0
    assert data["duration"] == 12.5


# --- /overlay/render-segment ---

def test_render_segment_success(monkeypatch):
    from routers import overlay
    monkeypatch.setattr(overlay, "_run_ffmpeg", lambda args: 0)

    from main import app
    resp = TestClient(app).post("/overlay/render-segment", json={
        "kind": "copy", "source_path": "in.mp4", "out_path": "out.mp4",
        "seg_start": 0.0, "seg_end": 2.0,
    })
    assert resp.status_code == 200
    assert resp.json()["out_path"] == "out.mp4"


def test_render_segment_ffmpeg_failure_returns_500(monkeypatch):
    from routers import overlay
    monkeypatch.setattr(overlay, "_run_ffmpeg", lambda args: 1)

    from main import app
    resp = TestClient(app).post("/overlay/render-segment", json={
        "kind": "overlay", "source_path": "in.mp4", "out_path": "out.mp4",
        "out_width": 1080, "out_height": 1920, "seg_start": 0.0, "seg_end": 1.0,
    })
    assert resp.status_code == 500


# --- /overlay/concat ---

def test_concat_single_input_renames(tmp_path):
    src = tmp_path / "seg0.mp4"
    src.write_bytes(b"data")
    out = tmp_path / "final.mp4"

    from main import app
    resp = TestClient(app).post("/overlay/concat", json={
        "inputs": [str(src)], "out_path": str(out), "tmp_dir": str(tmp_path),
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["reencoded"] is False
    assert out.exists()
    assert not src.exists()  # renamed, not copied


def test_concat_stream_copy(monkeypatch, tmp_path):
    a = tmp_path / "a.mp4"; a.write_bytes(b"a")
    b = tmp_path / "b.mp4"; b.write_bytes(b"b")
    out = tmp_path / "out.mp4"

    from routers import overlay
    monkeypatch.setattr(overlay, "_run_ffmpeg", lambda args: 0)

    from main import app
    resp = TestClient(app).post("/overlay/concat", json={
        "inputs": [str(a), str(b)], "out_path": str(out), "tmp_dir": str(tmp_path),
        "try_stream_copy": True,
    })
    assert resp.status_code == 200
    assert resp.json()["reencoded"] is False


def test_concat_falls_back_to_reencode(monkeypatch, tmp_path):
    a = tmp_path / "a.mp4"; a.write_bytes(b"a")
    b = tmp_path / "b.mp4"; b.write_bytes(b"b")
    out = tmp_path / "out.mp4"

    # First call (stream copy) fails -> reencode path; make only the copy fail.
    calls = {"n": 0}

    def fake_ffmpeg(args):
        calls["n"] += 1
        # stream-copy attempt uses "-c","copy"; fail it, succeed the reencode
        return 1 if "copy" in args else 0

    from routers import overlay
    monkeypatch.setattr(overlay, "_run_ffmpeg", fake_ffmpeg)

    from main import app
    resp = TestClient(app).post("/overlay/concat", json={
        "inputs": [str(a), str(b)], "out_path": str(out), "tmp_dir": str(tmp_path),
        "try_stream_copy": True,
    })
    assert resp.status_code == 200
    assert resp.json()["reencoded"] is True
    assert calls["n"] == 2
