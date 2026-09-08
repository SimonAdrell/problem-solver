"""Rate limit / size cap tests for the now-public endpoints.

Imports the real app.py, so the routes, decorators and caps under test are the
ones that ship. The agent modules are stubbed in sys.modules first: app.py calls
provision_all() at import time, which would otherwise hit Azure.
"""
import os, sys, types, json
import pytest

os.environ.setdefault("SECRET_KEY", "test")
os.environ.setdefault("SECURITY_PASSWORD_SALT", "test")
os.environ["DATABASE_URL"] = "sqlite:///:memory:"   # never touch instance/app.db


def _stub(name, **attrs):
    mod = types.ModuleType(name)
    mod.__dict__.update(attrs)
    sys.modules[name] = mod

_stub("agents.provision_all", provision_all=lambda: None)
_stub("agents.orchestrator", solve_problem=lambda p: {"brief": {}, "ideas": []})
_stub("agents.blueprint_agent", generate_blueprint=lambda b, i: {"architecture": "x"})
_stub("agents.image", render_image=lambda p: "data:image/png;base64,AAAA")

import app as appmod  # noqa: E402

MAX = appmod.MAX_PROBLEM


@pytest.fixture
def client():
    appmod.app.config["TESTING"] = True
    return appmod.app.test_client()


_ip = iter(range(1, 10_000))

@pytest.fixture
def ip():
    """A fresh client IP per test, so rate-limit counters don't bleed across tests."""
    return {"X-Forwarded-For": f"10.0.0.{next(_ip)}"}


def post(client, path, payload, ip):
    return client.post(path, json=payload, headers=ip)


# --- the endpoints are public -------------------------------------------------

def test_solve_needs_no_session(client, ip):
    assert post(client, "/api/solve", {"problem": "images are a mess"}, ip).status_code == 200

def test_me_still_requires_a_session(client, ip):
    # 401 only when the caller asks for JSON -- which lib/api.ts always does.
    # Without that header Flask-Security 302s to the login view instead.
    json_hdr = {**ip, "Accept": "application/json"}
    assert client.get("/api/me", headers=json_hdr).status_code == 401
    assert client.get("/api/me", headers=ip).status_code == 302


# --- length caps --------------------------------------------------------------

def test_solve_rejects_empty_problem(client, ip):
    assert post(client, "/api/solve", {"problem": "   "}, ip).status_code == 400

def test_solve_accepts_problem_at_the_cap(client, ip):
    assert post(client, "/api/solve", {"problem": "x" * MAX}, ip).status_code == 200

def test_solve_rejects_problem_over_the_cap(client, ip):
    r = post(client, "/api/solve", {"problem": "x" * (MAX + 1)}, ip)
    assert r.status_code == 400
    assert str(MAX) in r.get_json()["error"]

def test_image_rejects_prompt_over_the_cap(client, ip):
    assert post(client, "/api/image", {"image_prompt": "x" * (MAX + 1)}, ip).status_code == 400

def test_blueprint_rejects_missing_idea(client, ip):
    assert post(client, "/api/blueprint", {"brief": {"a": 1}}, ip).status_code == 400


def test_oversized_body_is_413_not_400(client, ip):
    """MAX_CONTENT_LENGTH must fire during get_json(silent=True) rather than
    being swallowed into the generic 'Problem is required' 400."""
    body = json.dumps({"problem": "x" * (65 * 1024)}).encode()
    r = client.post("/api/solve", data=body,
                    headers={**ip, "Content-Type": "application/json"})
    assert r.status_code == 413


# --- rate limiting ------------------------------------------------------------

def test_solve_allows_20_per_hour_then_429(client, ip):
    codes = [post(client, "/api/solve", {"problem": "p"}, ip).status_code for _ in range(21)]
    assert codes[:20] == [200] * 20
    assert codes[20] == 429

def test_limit_is_per_endpoint_not_shared(client, ip):
    """ai_limit is limiter.limit(), so each route gets its own counter -- the real
    ceiling across solve+blueprint+image is 60/hour, not 20. Swap to
    limiter.shared_limit(scope=...) if one bucket per journey is wanted."""
    for _ in range(21):
        post(client, "/api/solve", {"problem": "p"}, ip)
    assert post(client, "/api/solve", {"problem": "p"}, ip).status_code == 429
    ok = {"brief": {"core_problem": "p"}, "idea": {"app_concept": "c"}}
    assert post(client, "/api/blueprint", ok, ip).status_code == 200

def test_limit_is_keyed_per_client_ip(client, ip):
    for _ in range(21):
        post(client, "/api/solve", {"problem": "p"}, ip)
    assert post(client, "/api/solve", {"problem": "p"}, ip).status_code == 429
    other = {"X-Forwarded-For": "10.9.9.9"}
    assert post(client, "/api/solve", {"problem": "p"}, other).status_code == 200
