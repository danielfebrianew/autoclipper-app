import sys
sys.path.insert(0, "..")

from routers.subtitle import _generate_ass, WordTimestamp


def test_ass_generation():
    words = [
        WordTimestamp(word="Kocak", start=0.0, end=0.32),
        WordTimestamp(word="bandingin", start=0.35, end=0.71),
        WordTimestamp(word="laptop", start=0.75, end=1.1),
    ]
    content = _generate_ass(words)
    assert "[Script Info]" in content
    assert "Kocak" in content
    assert "PlayResX: 1080" in content
    assert "Dialogue:" in content


def test_ass_highlight():
    words = [
        WordTimestamp(word="Hello", start=0.0, end=0.5),
        WordTimestamp(word="World", start=0.5, end=1.0),
    ]
    content = _generate_ass(words)
    # Yellow highlight color should appear
    assert "00FFFF" in content
