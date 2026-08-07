import os
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import CSRFProtect
from flask_security import (
    Security, SQLAlchemyUserDatastore, auth_required,
    current_user,
)
from flask_security.models import fsqla_v3 as fsqla
from dotenv import load_dotenv
from agents.provision_all import provision_all
from agents.orchestrator import solve_problem

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
)

if DEV:
    app.config["SECURITY_EMAIL_VALIDATOR_ARGS"] = {"check_deliverability": False}

db = SQLAlchemy(app)

fsqla.FsModels.set_db_info(db)
class Role(db.Model, fsqla.FsRoleMixin): pass
class User(db.Model, fsqla.FsUserMixin): pass

csrf = CSRFProtect(app)
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
@auth_required("session")
def solve():
    problem = (request.get_json(silent=True) or {}).get("problem","").strip()
    if not problem:
        return jsonify(error="Problem is required"), 400
    
    try:
        return jsonify(solve_problem(problem))
    except ValueError:
        return jsonify(error="Agent returned invalid output"), 502
  
with app.app_context():
    db.create_all()
    
provision_all()