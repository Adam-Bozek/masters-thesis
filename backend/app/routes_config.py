"""
# @ Author: Bc. Adam Božek
# @ Create Time: 2025-10-24 13:34:27
# @ Description: This repository contains a full-stack application suite developed within a master’s thesis.
                It is designed to support the screening of children using the Slovak
                implementation of the TEKOS II screening instrument, short version. Copyright (C) 2026  Bc. Adam Božek
# @ License: This program is free software: you can redistribute it and/or modify it under the terms of
                the GNU Affero General Public License as published by the Free Software Foundation, either
                version 3 of the License, or any later version. This program is distributed in the hope
                that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
                of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
                See the GNU Affero General Public License for more details.
                You should have received a copy of the GNU Affero General Public License along with this program.
                If not, see <https://www.gnu.org/licenses/>..
"""

from __future__ import annotations

from flask import Blueprint, jsonify, current_app
from sqlalchemy import text
from redis import Redis

from . import db

from .routes.auth_routes import (
    register,
    login,
    refresh,
    logout,
    logout_refresh,
    logout_all,
    me,
    test_route,
)

from .routes.test_sessions_routes import (
    create_session,
    create_guest_session,
    list_sessions,
    get_session,
    update_session,
    complete_session,
    add_or_update_answer,
    list_answers,
    list_session_categories,
    complete_category,
    correct_category,
    export_session_pdf,
)

auth_bp = Blueprint("auth", __name__)
test_bp = Blueprint("test_sessions", __name__)

auth_bp.route("/register", methods=["POST"])(register)
auth_bp.route("/login", methods=["POST"])(login)
auth_bp.route("/refresh", methods=["POST"])(refresh)
auth_bp.route("/logout", methods=["POST"])(logout)
auth_bp.route("/logout-refresh", methods=["POST"])(logout_refresh)
auth_bp.route("/logout-all", methods=["POST"])(logout_all)
auth_bp.route("/me", methods=["GET"])(me)
auth_bp.route("/test", methods=["GET"])(test_route)

test_bp.route("/sessions", methods=["POST"])(create_session)
test_bp.route("/sessions", methods=["GET"])(list_sessions)
test_bp.route("/sessions/guest", methods=["POST"])(create_guest_session)
test_bp.route("/sessions/<int:session_id>", methods=["GET"])(get_session)
test_bp.route("/sessions/<int:session_id>", methods=["PATCH"])(update_session)
test_bp.route("/sessions/<int:session_id>/complete", methods=["PATCH"])(complete_session)
test_bp.route("/sessions/<int:session_id>/answers", methods=["POST"])(add_or_update_answer)
test_bp.route("/sessions/<int:session_id>/answers", methods=["GET"])(list_answers)
test_bp.route("/sessions/<int:session_id>/categories", methods=["GET"])(list_session_categories)
test_bp.route("/sessions/<int:session_id>/categories/<int:category_id>/complete", methods=["PATCH"])(complete_category)
test_bp.route("/sessions/<int:session_id>/categories/<int:category_id>/correct", methods=["PATCH"])(correct_category)
test_bp.route("/sessions/export-pdf", methods=["POST"])(export_session_pdf)


@auth_bp.route("/db_cache_health", methods=["GET"])
def db_redis_health():
    checks = {}
    status_code = 200

    try:
        db.session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {type(e).__name__}"
        status_code = 503

    try:
        r: Redis = current_app.extensions["redis"]
        ok = r.ping()
        checks["redis"] = "ok" if ok else "error: ping failed"
        if not ok:
            status_code = 503
    except Exception as e:
        checks["redis"] = f"error: {type(e).__name__}"
        status_code = 503

    body = {"status": "ok" if status_code == 200 else "degraded", **checks}
    return jsonify(body), status_code


@auth_bp.route("/health", methods=["GET"])
def health():
    return "OK", 200
