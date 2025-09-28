from __future__ import annotations

import os
from typing import Final

from flask import Flask, current_app
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from redis import Redis

from .config import Config  # keep your existing Config

# --- Extensions (shared singletons) ---
db: Final[SQLAlchemy] = SQLAlchemy()
bcrypt: Final[Bcrypt] = Bcrypt()
jwt: Final[JWTManager] = JWTManager()


# --- Redis (shared singleton) ---
def _make_redis() -> Redis:
    """
    Creates a Redis client from REDIS_URL.
    Accepts both password-only (default user) and ACL user URLs.
    Example URLs:
      redis://:password@redis:6379/0          (password only)
      redis://username:password@redis:6379/0  (ACL user)
    """
    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    return Redis.from_url(url, decode_responses=True)


# Global Redis client reused by callbacks/helpers
r: Final[Redis] = _make_redis()


def _bl_key(jti: str) -> str:
    return f"bl:{jti}"


def create_app() -> Flask:
    app: Flask = Flask(__name__)
    CORS(app)
    app.config.from_object(Config)

    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    # ---- JWT Blocklist: safe + resilient ----
    @jwt.token_in_blocklist_loader
    def token_in_blocklist(jwt_header, jwt_data) -> bool:
        """
        Return True if token is blocklisted (revoked), False otherwise.
        Critically: never raise here — fail open if Redis is unreachable/misconfigured.
        """
        jti = jwt_data.get("jti")
        if not jti:
            return False
        try:
            return bool(r.exists(_bl_key(jti)))
        except Exception as e:
            current_app.logger.warning("Blocklist check skipped (Redis issue): %r", e)
            return False

    # ---- Register blueprints (unchanged) ----
    from .routes import auth_bp  # your existing blueprint

    app.register_blueprint(auth_bp, url_prefix="/api")

    return app
