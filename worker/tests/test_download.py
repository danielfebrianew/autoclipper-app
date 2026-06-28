import sys
sys.path.insert(0, "..")

import os
from fastapi.testclient import TestClient


class _FakePopen:
    def __init__(self, lines, returncode=0):
        # stdout must be an iterable of text lines (router iterates `for line in proc.stdout`)
        self.stdout = iter(lines)
        self._returncode = returncode
        self.returncode = returncode

    def wait(self):
        self.returncode = self._returncode
        return self._returncode


def _patch_popen(monkeypatch, lines, returncode=0):
    from routers import download
    monkeypatch.setattr(
        download.subprocess, "Popen",
        lambda *a, **k: _FakePopen(lines, returncode),
    )


def test_download_progress_and_done(monkeypatch, tmp_path):
    # The router checks os.path.exists for <video_id>.mp4; create it so DONE points there.
    (tmp_path / "abc.mp4").write_bytes(b"x")
    lines = [
        "[download] Destination: abc.mp4\n",
        "[download]   0.5% of 10MiB\n",
        "[download]  50.0% of 10MiB\n",
        "[download] 100.0% of 10MiB\n",
        "[Merger] Merging formats into abc.mp4\n",
    ]
    _patch_popen(monkeypatch, lines, returncode=0)

    from main import app
    resp = TestClient(app).post("/download", json={
        "url": "http://x", "video_id": "abc", "out_dir": str(tmp_path),
    })
    assert resp.status_code == 200
    body = resp.text
    # progress throttled to >=0.5% steps; merge -> 99.0; final DONE line
    assert "PROGRESS:50.0" in body
    assert "PROGRESS:99.0" in body
    assert f"DONE:{os.path.join(str(tmp_path), 'abc.mp4')}" in body


def test_download_error_on_nonzero_exit(monkeypatch, tmp_path):
    _patch_popen(monkeypatch, ["[download]  10.0% of 1MiB\n"], returncode=1)

    from main import app
    resp = TestClient(app).post("/download", json={
        "url": "http://x", "video_id": "fail", "out_dir": str(tmp_path),
    })
    assert resp.status_code == 200  # stream itself succeeds
    assert "ERROR:yt-dlp exited with code 1" in resp.text
    assert "DONE:" not in resp.text


def test_download_forwards_unknown_lines_as_log(monkeypatch, tmp_path):
    (tmp_path / "v.mp4").write_bytes(b"x")
    _patch_popen(monkeypatch, ["[info] some yt-dlp note\n"], returncode=0)

    from main import app
    resp = TestClient(app).post("/download", json={
        "url": "http://x", "video_id": "v", "out_dir": str(tmp_path),
    })
    assert "LOG:[info] some yt-dlp note" in resp.text
