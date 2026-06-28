import sys
sys.path.insert(0, "..")

from fastapi.testclient import TestClient


# --- Fakes so we never load a real faster-whisper model ---

class _FakeWord:
    def __init__(self, word, start, end):
        self.word = word
        self.start = start
        self.end = end


class _FakeSegment:
    def __init__(self, words):
        self.words = words


class _FakeModel:
    def __init__(self, segments):
        self._segments = segments
        self.captured = {}

    def transcribe(self, audio_path, language=None, word_timestamps=None):
        self.captured = {
            "audio_path": audio_path,
            "language": language,
            "word_timestamps": word_timestamps,
        }
        return iter(self._segments), {}


def _patch_model(monkeypatch, model, capture=None):
    from routers import whisper_align

    def _get_model(size="tiny"):
        if capture is not None:
            capture["size"] = size
        return model

    monkeypatch.setattr(whisper_align, "get_model", _get_model)


def test_whisper_align_returns_words(monkeypatch):
    segments = [_FakeSegment([
        _FakeWord("  halo ", 0.0, 0.512),
        _FakeWord(" dunia", 0.5123, 1.0),
    ])]
    model = _FakeModel(segments)
    _patch_model(monkeypatch, model)

    from main import app
    resp = TestClient(app).post("/whisper-align", json={"audio_path": "a.wav"})
    assert resp.status_code == 200
    words = resp.json()["words"]
    assert words == [
        {"word": "halo", "start": 0.0, "end": 0.512},
        {"word": "dunia", "start": 0.512, "end": 1.0},
    ]


def test_whisper_align_passes_language_and_word_timestamps(monkeypatch):
    model = _FakeModel([])
    _patch_model(monkeypatch, model)

    from main import app
    resp = TestClient(app).post("/whisper-align", json={
        "audio_path": "a.wav", "language": "en",
    })
    assert resp.status_code == 200
    assert model.captured["audio_path"] == "a.wav"
    assert model.captured["language"] == "en"
    assert model.captured["word_timestamps"] is True


def test_whisper_align_uses_request_model_size(monkeypatch):
    cap = {}
    _patch_model(monkeypatch, _FakeModel([]), capture=cap)

    from main import app
    resp = TestClient(app).post("/whisper-align", json={
        "audio_path": "a.wav", "model_size": "small",
    })
    assert resp.status_code == 200
    assert cap["size"] == "small"


def test_whisper_align_falls_back_to_env_model(monkeypatch):
    monkeypatch.setenv("AUTOCLIPPER_WHISPER_MODEL", "base")
    cap = {}
    _patch_model(monkeypatch, _FakeModel([]), capture=cap)

    from main import app
    resp = TestClient(app).post("/whisper-align", json={"audio_path": "a.wav"})
    assert resp.status_code == 200
    assert cap["size"] == "base"


def test_whisper_align_skips_segments_without_words(monkeypatch):
    segments = [_FakeSegment(None), _FakeSegment([_FakeWord("hi", 0.0, 0.2)])]
    _patch_model(monkeypatch, _FakeModel(segments))

    from main import app
    resp = TestClient(app).post("/whisper-align", json={"audio_path": "a.wav"})
    assert resp.status_code == 200
    assert resp.json()["words"] == [{"word": "hi", "start": 0.0, "end": 0.2}]


def test_whisper_align_error_is_500(monkeypatch):
    from routers import whisper_align

    def _boom(size="tiny"):
        raise RuntimeError("model load failed")

    monkeypatch.setattr(whisper_align, "get_model", _boom)

    from main import app
    resp = TestClient(app).post("/whisper-align", json={"audio_path": "a.wav"})
    assert resp.status_code == 500
    assert "model load failed" in resp.json()["detail"]
