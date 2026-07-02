import sys
sys.path.insert(0, "..")

import os
import numpy as np
from fastapi.testclient import TestClient


class _FakeCapture:
    """cv2.VideoCapture stand-in used only when source_w/source_h are 0."""
    def __init__(self, w=1920, h=1080):
        # CAP_PROP_FRAME_WIDTH=3, CAP_PROP_FRAME_HEIGHT=4
        self._props = {3: w, 4: h}

    def get(self, prop):
        return self._props.get(prop, 0)

    def release(self):
        pass


def _patch(monkeypatch, single=None, split=None, cap=None):
    """Patch processing.ffmpeg_utils.composite / composite_split and optionally cv2."""
    import processing.ffmpeg_utils as fu

    if single is not None:
        monkeypatch.setattr(fu, "composite", single)
    if split is not None:
        monkeypatch.setattr(fu, "composite_split", split)
    if cap is not None:
        import cv2
        monkeypatch.setattr(cv2, "VideoCapture", lambda path: cap)


def _base_req(**over):
    base = {
        "clip_path": "clip.mp4",
        "ass_path": "subs.ass",
        "centers": [100.0, 200.0],
        "source_w": 1920,
        "source_h": 1080,
        "clip_id": "c1",
        "out_dir": "",  # filled by caller via tmp_path
    }
    base.update(over)
    return base


def test_composite_single_path(monkeypatch, tmp_path):
    calls = {}

    def _single(clip_path, centers, src_w, src_h, ass_path, output_path, **kw):
        calls["src"] = (src_w, src_h)
        calls["centers"] = list(centers)
        calls["output"] = output_path
        calls["ratio"] = kw.get("ratio")

    _patch(monkeypatch, single=_single)

    from main import app
    resp = TestClient(app).post("/composite", json=_base_req(out_dir=str(tmp_path)))
    assert resp.status_code == 200
    expected = os.path.join(str(tmp_path), "c1_final.mp4")
    assert resp.json()["output_path"] == expected
    assert calls["src"] == (1920, 1080)
    assert calls["centers"] == [100.0, 200.0]
    assert calls["ratio"] == "9:16"


def test_composite_reads_dims_from_video_when_zero(monkeypatch, tmp_path):
    calls = {}

    def _single(clip_path, centers, src_w, src_h, *a, **kw):
        calls["src"] = (src_w, src_h)

    _patch(monkeypatch, single=_single, cap=_FakeCapture(w=1280, h=720))

    from main import app
    resp = TestClient(app).post("/composite", json=_base_req(
        out_dir=str(tmp_path), source_w=0, source_h=0,
    ))
    assert resp.status_code == 200
    assert calls["src"] == (1280, 720)


def test_composite_split_path(monkeypatch, tmp_path):
    calls = {}

    def _split(clip_path, cl, cr, centers, is_split, src_w, src_h, ass_path, output_path, **kw):
        calls["left"] = list(cl)
        calls["right"] = list(cr)
        calls["is_split"] = list(is_split)

    _patch(monkeypatch, split=_split)

    from main import app
    resp = TestClient(app).post("/composite", json=_base_req(
        out_dir=str(tmp_path),
        centers_left=[1.0, 2.0],
        centers_right=[3.0, 4.0],
        is_split=[True, False],
    ))
    assert resp.status_code == 200
    assert calls["left"] == [1.0, 2.0]
    assert calls["right"] == [3.0, 4.0]
    assert calls["is_split"] == [True, False]


def test_composite_reserve_bottom_reaches_single(monkeypatch, tmp_path):
    calls = {}

    def _single(clip_path, centers, src_w, src_h, ass_path, output_path, **kw):
        calls["reserve_bottom"] = kw.get("reserve_bottom")

    _patch(monkeypatch, single=_single)

    from main import app
    resp = TestClient(app).post("/composite", json=_base_req(
        out_dir=str(tmp_path), reserve_bottom=True,
    ))
    assert resp.status_code == 200
    assert calls["reserve_bottom"] is True


def test_composite_reserve_bottom_reaches_split(monkeypatch, tmp_path):
    calls = {}

    def _split(clip_path, cl, cr, centers, is_split, src_w, src_h, ass_path, output_path, **kw):
        calls["reserve_bottom"] = kw.get("reserve_bottom")

    _patch(monkeypatch, split=_split)

    from main import app
    resp = TestClient(app).post("/composite", json=_base_req(
        out_dir=str(tmp_path),
        centers_left=[1.0, 2.0], centers_right=[3.0, 4.0], is_split=[True, False],
        reserve_bottom=True,
    ))
    assert resp.status_code == 200
    assert calls["reserve_bottom"] is True


def test_crop_fill_shape_and_aspect():
    from processing.ffmpeg_utils import _crop_fill
    frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
    # 9:16 top-60% box on 1080p source: out_w=607, top_h=648
    out = _crop_fill(frame, cx=960, box_w=607, box_h=648, src_w=1920, src_h=1080)
    assert out.shape == (648, 607, 3)


def test_composite_error_is_500(monkeypatch, tmp_path):
    def _boom(*a, **k):
        raise RuntimeError("ffmpeg exploded")

    _patch(monkeypatch, single=_boom)

    from main import app
    resp = TestClient(app).post("/composite", json=_base_req(out_dir=str(tmp_path)))
    assert resp.status_code == 500
    assert "ffmpeg exploded" in resp.json()["detail"]
