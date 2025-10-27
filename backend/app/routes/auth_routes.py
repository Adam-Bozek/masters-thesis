from __future__ import annotations
from datetime import timedelta

from flask import jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    get_jwt,
    jwt_required,
)

from .. import db, bcrypt
from ..models import User
from ..redis_utils import revoke_jti_with_ttl


# ---- Helpers ----
def _assert_token_version_or_401(user: User, token_ver: int | None):
    if token_ver is None or user.token_version != token_ver:
        return jsonify({"message": "Token no longer valid"}), 401
    return None


# ---- Routes ----
def register():
    data = request.get_json(silent=True) or {}
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not (first_name and last_name and email and password):
        return jsonify({"message": "Missing required fields"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "User already exists"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")

    new_user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password=hashed_password,  # store hash
        # token_version defaults to 1
    )
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "User registered successfully"}), 201


def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not (email and password):
        return jsonify({"message": "Missing email or password"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({"message": "Invalid email or password"}), 401

    claims = {"ver": user.token_version}

    access_token = create_access_token(
        identity=str(user.id),
        fresh=True,
        expires_delta=timedelta(minutes=15),
        additional_claims=claims,
    )
    refresh_token = create_refresh_token(
        identity=str(user.id),
        expires_delta=timedelta(days=30),
        additional_claims=claims,
    )

    return jsonify(
        {
            "message": "Login successful",
            "user_id": user.id,
            "access_token": access_token,
            "refresh_token": refresh_token,
        }
    ), 200


@jwt_required(refresh=True)
def refresh():
    jwt_payload = get_jwt()
    uid = get_jwt_identity()  # stored as str
    ver = jwt_payload.get("ver")

    user = User.query.get(int(uid))
    if not user:
        return jsonify({"message": "User not found"}), 404

    mismatch = _assert_token_version_or_401(user, ver)
    if mismatch:
        return mismatch

    new_access = create_access_token(
        identity=str(user.id),
        fresh=False,
        expires_delta=timedelta(minutes=15),
        additional_claims={"ver": user.token_version},
    )
    return jsonify({"access_token": new_access}), 200


@jwt_required()
def logout():
    payload = get_jwt()
    revoke_jti_with_ttl(jti=payload["jti"], exp_ts=payload["exp"])
    return jsonify({"message": "Logged out"}), 200


@jwt_required(refresh=True)
def logout_refresh():
    payload = get_jwt()
    revoke_jti_with_ttl(jti=payload["jti"], exp_ts=payload["exp"])
    return jsonify({"message": "Refresh token revoked"}), 200


@jwt_required()
def logout_all():
    uid = int(get_jwt_identity())
    jwt_payload = get_jwt()
    ver = jwt_payload.get("ver")

    user = User.query.get(uid)
    if not user:
        return jsonify({"message": "User not found"}), 404

    mismatch = _assert_token_version_or_401(user, ver)
    if mismatch:
        return mismatch

    user.token_version += 1
    db.session.commit()
    return jsonify({"message": "All sessions revoked"}), 200


@jwt_required()
def me():
    uid = int(get_jwt_identity())
    token_ver = get_jwt().get("ver")

    user = User.query.get(uid)
    if not user:
        return jsonify({"message": "User not found"}), 404

    mismatch = _assert_token_version_or_401(user, token_ver)
    if mismatch:
        return mismatch

    return jsonify(
        {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }
    ), 200


@jwt_required()
def test_route():
    return jsonify({"message": "This is a test route"}), 200
