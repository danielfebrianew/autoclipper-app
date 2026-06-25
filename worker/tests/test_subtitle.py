import sys
sys.path.insert(0, "..")

from routers.subtitle import _generate_ass, WordTimestamp


def test_ass_generation():
    words = [
        WordTimestamp(word="Kocak", start=0.0, end=0.32),
        WordTimestamp(word="bandingin", start=0.35, end=0.71),
        WordTimestamp(word="laptop", start=0.75, end=1.1),
    ]
    content = _generate_ass(words, "bold", "bot", "M")
    assert "[Script Info]" in content
    assert "Kocak" in content
    assert "PlayResX: 1080" in content
    assert "Dialogue:" in content


def test_ass_highlight():
    words = [
        WordTimestamp(word="Hello", start=0.0, end=0.5),
        WordTimestamp(word="World", start=0.5, end=1.0),
    ]
    content = _generate_ass(words, "bold", "bot", "M")
    # Yellow highlight color should appear
    assert "00FFFF" in content


# --- Endpoint-level tests for /subtitle ---

def _client():
    from fastapi.testclient import TestClient
    from main import app
    return TestClient(app)


def test_subtitle_endpoint_words(tmp_path):
    resp = _client().post("/subtitle", json={
        "words": [
            {"word": "Halo", "start": 0.0, "end": 0.4},
            {"word": "dunia", "start": 0.4, "end": 0.9},
        ],
        "style": "bold", "position": "bot", "size": "M",
        "clip_duration": 1.0,
        "out_dir": str(tmp_path),
        "clip_id": "clip123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ass_path"].endswith("clip123.ass")
    assert "Halo" in data["ass_content"]
    assert "Dialogue:" in data["ass_content"]
    # File is actually written to out_dir
    assert (tmp_path / "clip123.ass").exists()


def test_subtitle_endpoint_caption_text_overrides(tmp_path):
    # caption_text takes precedence: a single static line, no per-word timing.
    resp = _client().post("/subtitle", json={
        "words": [{"word": "ignored", "start": 0.0, "end": 0.5}],
        "caption_text": "Satu baris caption statis",
        "style": "clean", "position": "top", "size": "L",
        "clip_duration": 3.0,
        "out_dir": str(tmp_path),
        "clip_id": "clipCap",
    })
    assert resp.status_code == 200
    content = resp.json()["ass_content"]
    assert "Satu baris caption statis" in content
    assert "ignored" not in content
    # Exactly one Dialogue line spanning the whole clip
    assert content.count("Dialogue:") == 1


def test_subtitle_endpoint_requires_words_or_text(tmp_path):
    resp = _client().post("/subtitle", json={
        "words": [],
        "style": "bold", "position": "bot", "size": "M",
        "clip_duration": 1.0,
        "out_dir": str(tmp_path),
        "clip_id": "empty",
    })
    assert resp.status_code == 400
