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

from typing import Final

from flask import Flask, current_app, jsonify
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy
from redis import Redis

from .config import Config

db: Final[SQLAlchemy] = SQLAlchemy()
bcrypt: Final[Bcrypt] = Bcrypt()
jwt: Final[JWTManager] = JWTManager()

r: Redis | None = None


def _make_redis(app: Flask) -> Redis:
    redis_url = app.config.get("REDIS_URL")
    if redis_url:
        return Redis.from_url(redis_url, decode_responses=True)

    return Redis(
        host=app.config.get("REDIS_HOST", "cache"),
        port=app.config.get("REDIS_PORT", 6379),
        password=app.config.get("REDIS_PASSWORD"),
        decode_responses=True,
    )


def _bl_key(jti: str) -> str:
    return f"bl:{jti}"


def create_app() -> Flask:
    global r

    app: Flask = Flask(__name__)
    CORS(app)
    app.config.from_object(Config)

    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    r = _make_redis(app)
    app.extensions["redis"] = r

    try:
        r.ping()
        app.logger.info("Redis connected successfully")
    except Exception as e:
        app.logger.warning("Redis initialization failed: %r", e)

    @jwt.token_in_blocklist_loader
    def token_in_blocklist(jwt_header, jwt_data) -> bool:
        jti = jwt_data.get("jti")
        if not jti:
            return False

        try:
            if r is None:
                current_app.logger.warning("Blocklist check skipped: Redis not initialized")
                return False
            return bool(r.exists(_bl_key(jti)))
        except Exception as e:
            current_app.logger.warning("Blocklist check skipped (Redis issue): %r", e)
            return False

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({"message": "Relácia vypršala. Prihláste sa znova."}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({"message": "Neplatný token."}), 401

    @jwt.unauthorized_loader
    def unauthorized_callback(error):
        return jsonify({"message": "Chýba autorizácia."}), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({"message": "Token bol zrušený."}), 401

    @jwt.needs_fresh_token_loader
    def needs_fresh_token_callback(jwt_header, jwt_payload):
        return jsonify({"message": "Táto akcia vyžaduje nové prihlásenie."}), 401

    from .routes_config import auth_bp
    from .routes_config import test_bp

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(test_bp, url_prefix="/api")

    return app
