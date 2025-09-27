# app/routes.py
from __future__ import annotations

from flask import Blueprint, jsonify, current_app
from sqlalchemy import text
from redis import Redis

from . import db
from .auth import (
    register,
    login,
    refresh,
    logout,
    logout_refresh,
    logout_all,
    me,
    test_route,
)

auth_bp = Blueprint("auth", __name__)

# ---- Auth routes ----
auth_bp.route("/register", methods=["POST"])(register)
auth_bp.route("/login", methods=["POST"])(login)
auth_bp.route("/refresh", methods=["POST"])(refresh)
auth_bp.route("/logout", methods=["POST"])(logout)
auth_bp.route("/logout-refresh", methods=["POST"])(logout_refresh)
auth_bp.route("/logout-all", methods=["POST"])(logout_all)
auth_bp.route("/me", methods=["GET"])(me)
auth_bp.route("/test", methods=["GET"])(test_route)


# ---- Health route ----
@auth_bp.route("/health", methods=["GET"])
def health():
    """
    Liveness/readiness probe.
    - DB: executes a lightweight SELECT 1
    - Redis: PING
    Returns 200 when all checks pass, 503 otherwise.
    """
    checks = {}
    status_code = 200

    # DB check
    try:
        db.session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {type(e).__name__}"
        status_code = 503

    # Redis check
    try:
        r: Redis = current_app.extensions["redis"]
        ok = r.ping()
        if ok:
            checks["redis"] = "ok"
        else:
            checks["redis"] = "error: ping failed"
            status_code = 503
    except Exception as e:
        checks["redis"] = f"error: {type(e).__name__}"
        status_code = 503

    body = {"status": "ok" if status_code == 200 else "degraded", **checks}
    return jsonify(body), status_code
