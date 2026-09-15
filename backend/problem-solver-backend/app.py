import os
from flask import Flask, jsonify, request
from flask_wtf import CSRFProtect
from flask_security import (
    Security, SQLAlchemyUserDatastore, auth_required,
    current_user,
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv
from agents.provision_all import provision_all
from agents.orchestrator import solve_problem
from agents.blueprint_agent import generate_blueprint
from agents.image import render_image
from openai import OpenAIError
from extensions import db
from models import User, Role

load_dotenv()

app = Flask(__name__)
DEV = os.environ.get("FLASK_ENV") == "development"

app.config.update(
    SECRET_KEY=os.environ["SECRET_KEY"],
    SECURITY_PASSWORD_SALT=os.environ["SECURITY_PASSWORD_SALT"],
    SQLALCHEMY_DATABASE_URI=os.environ["DATABASE_URL"],
    SQLALCHEMY_TRACK_MODIFICATIONS=False,

    SECURITY_URL_PREFIX="/api/accounts",
    SECURITY_FLASH_MESSAGES=False,
    SECURITY_REDIRECT_BEHAVIOR="spa",
    SECURITY_RETURN_GENERIC_RESPONSES=True,
    SECURITY_SEND_REGISTER_EMAIL=False,
    SECURITY_SEND_PASSWORD_CHANGE_EMAIL=False,
    SECURITY_SEND_PASSWORD_RESET_NOTICE_EMAIL=False,

    SECURITY_REGISTERABLE=True,
    SECURITY_CONFIRMABLE=False,      # turn on once mail works
    SECURITY_RECOVERABLE=True,       # registers /accounts/reset/<token>; the "forgot password" request step (which emails the token) still needs mail configured
    SECURITY_CHANGEABLE=True,
    SECURITY_TRACKABLE=True,

    SECURITY_POST_CONFIRM_VIEW="/confirmed",
    SECURITY_CONFIRM_ERROR_VIEW="/confirm-error",
    SECURITY_RESET_VIEW="/reset-password",
    SECURITY_RESET_ERROR_VIEW="/reset-password-error",
    SECURITY_LOGIN_ERROR_VIEW="/login-error",

    SECURITY_CSRF_COOKIE_NAME="XSRF-TOKEN",
    SECURITY_CSRF_PROTECT_MECHANISMS=["session", "basic"],
    SECURITY_CSRF_IGNORE_UNAUTH_ENDPOINTS=True,
    WTF_CSRF_CHECK_DEFAULT=False,
    WTF_CSRF_TIME_LIMIT=None,

    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=not DEV, 
    SESSION_COOKIE_HTTPONLY=True,
    REMEMBER_COOKIE_SAMESITE="Lax",

    # 413s an oversized body when a view reads it (Flask 3.1 enforces on read,
    # not eagerly against Content-Length -- a view that never touches the body
    # is not capped). Blueprint posts the whole brief+idea, so keep headroom
    # above the per-field caps below.
    MAX_CONTENT_LENGTH=64 * 1024,
)

if DEV:
    app.config["SECURITY_EMAIL_VALIDATOR_ARGS"] = {"check_deliverability": False}

db.init_app(app)

app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

csrf = CSRFProtect(app)
limiter = Limiter(get_remote_address, app=app)
ai_limit = limiter.limit("20 per hour")  # the unauthenticated, model-billing endpoints
MAX_PROBLEM = 2000
user_datastore = SQLAlchemyUserDatastore(db, User, Role)
security = Security(app, user_datastore)


@app.get("/api/me")
@auth_required("session")
def me():
    return jsonify(
        id=current_user.id,
        email=current_user.email,
    )

@app.post("/api/solve")
@ai_limit
def solve():
    problem = (request.get_json(silent=True) or {}).get("problem","").strip()
    if not problem:
        return jsonify(error="Problem is required"), 400
    if len(problem) > MAX_PROBLEM:
        return jsonify(error=f"Problem must be under {MAX_PROBLEM} characters"), 400
    
    try:
        return jsonify(solve_problem(problem))
    except ValueError:
        return jsonify(error="Agent returned invalid output"), 502

@app.post("/api/blueprint")
@ai_limit
def blueprint():
    body = request.get_json(silent=True) or {}
    brief = body.get("brief")
    idea = body.get("idea")
    
    if not brief or not idea:
        return jsonify(error="Missing brief or idea"), 400
    try:
        return jsonify(blueprint=generate_blueprint(brief, idea))
    except ValueError:
        return jsonify(error="Agent returned invalid output"), 502

@app.post("/api/image")
@ai_limit
def image():
    image_prompt = ((request.get_json(silent=True) or {}).get("image_prompt") or "").strip()
    if not image_prompt:
        return jsonify(error="Missing image prompt"), 400
    if len(image_prompt) > MAX_PROBLEM:
        return jsonify(error=f"Prompt must be under {MAX_PROBLEM} characters"), 400
    try:
        return jsonify(image=render_image(image_prompt))
    except OpenAIError:
        return jsonify(error="Image generation failed"), 502

@app.errorhandler(429)
def ratelimited(e):
    return jsonify(error="Too many requests, try again later"), 429

@app.errorhandler(413)
def too_large(e):
    return jsonify(error="Request too large"), 413

with app.app_context():
    db.create_all()
    
provision_all()