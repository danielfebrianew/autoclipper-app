import sys
sys.path.insert(0, "..")

from fastapi.testclient import TestClient


# A transcript snippet as returned by youtube_transcript_api: has .text/.start/.duration
class _FakeSnippet:
    def __init__(self, text, start, duration):
        self.text = text
        self.start = start
        self.duration = duration


def test_transcript_success(monkeypatch):
    from routers import transcript
    snippets = [
        _FakeSnippet("Halo semua", 0.0, 1.5),
        _FakeSnippet("selamat datang", 1.5, 2.0),
    ]
    monkeypatch.setattr(transcript._api, "fetch", lambda video_id, languages: snippets)

    from main import app
    resp = TestClient(app).post("/transcript", json={"video_id": "abc123", "language": "id"})
    assert resp.status_code == 200
    segs = resp.json()["segments"]
    assert len(segs) == 2
    assert segs[0]["text"] == "Halo semua"
    assert segs[0]["start"] == 0.0
    # end = start + duration
    assert segs[0]["end"] == 1.5
    assert segs[1]["end"] == 3.5


def test_transcript_disabled_returns_404(monkeypatch):
    from routers import transcript
    from youtube_transcript_api._errors import TranscriptsDisabled

    def _raise(video_id, languages):
        raise TranscriptsDisabled(video_id)

    monkeypatch.setattr(transcript._api, "fetch", _raise)

    from main import app
    resp = TestClient(app).post("/transcript", json={"video_id": "novid", "language": "id"})
    assert resp.status_code == 404
    assert "No transcript available" in resp.json()["detail"]


def test_transcript_unexpected_error_returns_500(monkeypatch):
    from routers import transcript

    def _boom(video_id, languages):
        raise RuntimeError("network down")

    monkeypatch.setattr(transcript._api, "fetch", _boom)

    from main import app
    resp = TestClient(app).post("/transcript", json={"video_id": "x", "language": "id"})
    assert resp.status_code == 500
