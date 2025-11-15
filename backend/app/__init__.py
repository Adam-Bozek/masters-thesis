from __future__ import annotations

import os
from typing import Final

from flask import Flask, current_app
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from redis import Redis

from .config import Config

"""
Application factory and extension singletons for the Flask API.

This module wires up:
- SQLAlchemy (db)              : ORM / DB session management
- Bcrypt (bcrypt)              : password hashing
- JWTManager (jwt)             : access/refresh token handling
- CORS                         : cross-origin requests for your frontend
- Redis (r)                    : shared connection for JWT blocklist (and future needs)

ENVIRONMENT / CONFIG EXPECTATIONS
---------------------------------
- Flask app config is provided by `.config.Config` (see your config.py).
- REDIS_URL (optional): URL for Redis connection.
    Examples:
      redis://:password@redis:6379/0          # default user with password only
      redis://username:password@redis:6379/0  # ACL user and password
    If unset, defaults to redis://localhost:6379/0

DESIGN NOTES
------------
- Extensions are created as module-level singletons and initialized in `create_app()`.
  This aligns with the Flask "app factory" pattern and avoids circular imports.
- Redis client is also a singleton so connection pools are reused efficiently.
- JWT blocklist check is deliberately "fail-open":
  If Redis is down/misconfigured, we log a warning and treat tokens as NOT revoked.
  This prevents hard outages of your API due to a cache issue.
  If you need stricter security, flip that behavior to "fail-closed" (see comment below).

SECURITY CONSIDERATIONS
-----------------------
- Ensure `SECRET_KEY`, `JWT_SECRET_KEY`, database credentials, and `REDIS_URL`
  are set via environment variables and not hard-coded.
- `bcrypt` is suitable for password hashing. Never store raw passwords.
- Consider TLS for Redis in production (rediss://...) or a private network/VPC.
"""

# --- Extensions (shared singletons) ---s
db: Final[SQLAlchemy] = SQLAlchemy()
bcrypt: Final[Bcrypt] = Bcrypt()
jwt: Final[JWTManager] = JWTManager()


# --- Redis (shared singleton) ---
def _make_redis() -> Redis:
    """
    Build a Redis client from REDIS_URL.

    Accepts both password-only and ACL-user URLs.
    decode_responses=True returns str values instead of bytes,
    making simple 'exists/get/set' usage more ergonomic.

    Returns:
        Redis: A client backed by a connection pool.
    """
    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    return Redis.from_url(url, decode_responses=True)


# Global Redis client reused by callbacks/helpers.
r: Final[Redis] = _make_redis()


def _bl_key(jti: str) -> str:
    """
    Compute the Redis key for a blocklisted token JTI (JWT ID).

    Args:
        jti (str): The unique identifier embedded in a JWT.

    Returns:
        str: Namespaced Redis key (e.g., "bl:<jti>").
    """
    return f"bl:{jti}"


def create_app() -> Flask:
    """
    Application factory.

    Creates a Flask app, attaches config, initializes extensions,
    registers blueprints, and wires up JWT blocklist behavior.

    Returns:
        Flask: Configured application instance.
    """
    app: Flask = Flask(__name__)
    CORS(app)  # Allow cross-origin requests (configure origins in production)
    app.config.from_object(Config)

    # Initialize extensions with the created app
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    # ---- JWT Blocklist ----
    @jwt.token_in_blocklist_loader
    def token_in_blocklist(jwt_header, jwt_data) -> bool:
        """
        Determines whether a token is revoked (blocklisted).

        This callback is invoked by flask-jwt-extended on protected endpoints.
        We store revoked JTIs in Redis under keys like "bl:<jti>".

        Fail-OPEN rationale:
            If Redis is unreachable or misconfigured, this function logs a warning
            and returns False (i.e., treat token as NOT blocklisted). This avoids
            turning a cache outage into a full API outage.

        To FAIL-CLOSED instead (stricter security), change the exception branch to:
            current_app.logger.error("Blocklist check failed; denying token: %r", e)
            return True

        Args:
            jwt_header (dict): The token header (unused here).
            jwt_data   (dict): The decoded JWT claims payload.

        Returns:
            bool: True if the token is in the blocklist; otherwise False.
        """
        jti = jwt_data.get("jti")
        if not jti:
            # If token has no JTI, we can't check—treat as not revoked.
            # (Alternatively, you could deny such tokens.)
            return False
        try:
            # Redis.exists returns 1 if key exists, 0 otherwise
            return bool(r.exists(_bl_key(jti)))
        except Exception as e:
            # See "Fail-OPEN rationale" above
            current_app.logger.warning("Blocklist check skipped (Redis issue): %r", e)
            return False

    # ---- Register blueprints ----
    from .routes_config import auth_bp
    from .routes_config import test_bp

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(test_bp, url_prefix="/api")

    return app
