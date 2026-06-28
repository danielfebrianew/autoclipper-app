import sys
sys.path.insert(0, "..")

from fastapi.testclient import TestClient


# --- Fake httpx so we never hit the real kie.ai / Gemini endpoint ---

class _FakeResponse:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


class _FakeClient:
    """Context-manager replacement for httpx.Client whose .post() returns a canned response."""
    def __init__(self, resp):
        self._resp = resp

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def post(self, url, headers=None, json=None):
        self._resp.captured_url = url
        self._resp.captured_payload = json
        return self._resp


def _patch_client(monkeypatch, resp):
    from routers import analyze
    monkeypatch.setattr(analyze.httpx, "Client", lambda *a, **k: _FakeClient(resp))
    return resp


def _llm_response(content: str):
    return _FakeResponse(200, payload={"choices": [{"message": {"content": content}}]})


def _req(**over):
    base = {
        "transcript": "[00:05] halo dunia",
        "heatmap_text": "",
        "title": "Test Video",
        "duration": 120,
        "api_key": "k",
    }
    base.update(over)
    return base


# --- Pure helper tests ---

def test_chat_url_kie_ai_embeds_model():
    from routers.analyze import _chat_url
    assert _chat_url("https://api.kie.ai", "gemini-3-flash") == \
        "https://api.kie.ai/gemini-3-flash/v1/chat/completions"


def test_chat_url_generic_provider():
    from routers.analyze import _chat_url
    assert _chat_url("https://api.openai.com/", "gpt-4") == \
        "https://api.openai.com/v1/chat/completions"


def test_parse_json_strips_markdown_fence():
    from routers.analyze import _parse_json
    raw = "```json\n{\"clips\": [], \"speakers\": []}\n```"
    assert _parse_json(raw) == {"clips": [], "speakers": []}


# --- Endpoint tests ---

def test_analyze_returns_clips_and_speakers(monkeypatch):
    parsed = {
        "speakers": [{"name": "Host", "role": "host"}],
        "clips": [{"clip_id": 1, "viral_score": 9}],
    }
    import json
    _patch_client(monkeypatch, _llm_response(json.dumps(parsed)))

    from main import app
    resp = TestClient(app).post("/analyze", json=_req())
    assert resp.status_code == 200
    data = resp.json()
    assert data["clips"] == parsed["clips"]
    assert data["speakers"] == parsed["speakers"]


def test_analyze_handles_fenced_json(monkeypatch):
    _patch_client(monkeypatch, _llm_response('```json\n{"clips": [], "speakers": []}\n```'))

    from main import app
    resp = TestClient(app).post("/analyze", json=_req())
    assert resp.status_code == 200
    assert resp.json() == {"clips": [], "speakers": []}


def test_analyze_non_200_from_llm_is_502(monkeypatch):
    _patch_client(monkeypatch, _FakeResponse(401, text="unauthorized"))

    from main import app
    resp = TestClient(app).post("/analyze", json=_req())
    assert resp.status_code == 502
    assert "401" in resp.json()["detail"]


def test_analyze_invalid_json_is_502(monkeypatch):
    _patch_client(monkeypatch, _llm_response("not json at all"))

    from main import app
    resp = TestClient(app).post("/analyze", json=_req())
    assert resp.status_code == 502
    assert "JSON" in resp.json()["detail"]


def test_analyze_request_error_is_502(monkeypatch):
    import httpx
    from routers import analyze

    class _BoomClient:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def post(self, *a, **k):
            raise httpx.ConnectError("boom")

    monkeypatch.setattr(analyze.httpx, "Client", lambda *a, **k: _BoomClient())

    from main import app
    resp = TestClient(app).post("/analyze", json=_req())
    assert resp.status_code == 502
    assert "LLM API error" in resp.json()["detail"]


def test_analyze_snaps_timestamps_when_snippets_present(monkeypatch):
    import json
    parsed = {"clips": [{"clip_id": 1}], "speakers": []}
    _patch_client(monkeypatch, _llm_response(json.dumps(parsed)))

    import processing.timestamps as ts
    calls = {}

    def _fake_snap(result, snippets):
        calls["snippets"] = snippets
        result["clips"] = [{"clip_id": 1, "snapped": True}]

    monkeypatch.setattr(ts, "validate_and_snap", _fake_snap)

    from main import app
    resp = TestClient(app).post("/analyze", json=_req(snippets=[{"text": "x", "start": 0}]))
    assert resp.status_code == 200
    assert resp.json()["clips"] == [{"clip_id": 1, "snapped": True}]
    assert calls["snippets"] == [{"text": "x", "start": 0}]
