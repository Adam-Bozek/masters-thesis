from __future__ import annotations

from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from redis import Redis

from .config import Config

db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()


def _init_redis(app: Flask) -> Redis:
    """Initialize Redis from config and store in app.extensions['redis']."""
    if app.config.get("REDIS_URL"):
        client = Redis.from_url(app.config["REDIS_URL"], decode_responses=True)
    else:
        client = Redis(
            host=app.config["REDIS_HOST"],
            port=app.config["REDIS_PORT"],
            password=app.config["REDIS_PASSWORD"],
            decode_responses=True,
        )
    app.extensions["redis"] = client
    return client


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app)

    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    _init_redis(app)

    # --- JWT blocklist check using Redis ---
    def _bl_key(jti: str) -> str:
        return f"jwt:blocklist:{jti}"

    @jwt.token_in_blocklist_loader
    def token_in_blocklist(jwt_header, jwt_payload) -> bool:
        jti = jwt_payload.get("jti")
        r: Redis = app.extensions["redis"]
        return bool(r.exists(_bl_key(jti)))

    # Friendly handlers
    @jwt.revoked_token_loader
    def revoked_token_loader(jwt_header, jwt_payload):
        return jsonify({"message": "Token has been revoked"}), 401

    @jwt.expired_token_loader
    def expired_token_loader(jwt_header, jwt_payload):
        return jsonify({"message": "Token has expired"}), 401

    @jwt.invalid_token_loader
    def invalid_token_loader(err_msg):
        return jsonify({"message": "Invalid token", "detail": err_msg}), 422

    @jwt.unauthorized_loader
    def missing_token_loader(err_msg):
        return jsonify(
            {"message": "Missing or invalid Authorization header", "detail": err_msg}
        ), 401

    from .routes import auth_bp

    app.register_blueprint(auth_bp, url_prefix="/api")
    return app
