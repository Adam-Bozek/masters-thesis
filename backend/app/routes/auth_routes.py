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
        return jsonify({"message": "Token už nie je platný"}), 401
    return None


def register():
    data = request.get_json(silent=True) or {}
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not (first_name and last_name and email and password):
        return jsonify({"message": "Chýbajú povinné údaje"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Používateľ už existuje"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")

    new_user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password=hashed_password,
    )
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "Registrácia bola úspešná"}), 201


def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not (email and password):
        return jsonify({"message": "Chýba email alebo heslo"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({"message": "Zlý email alebo heslo"}), 401

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
            "message": "Prihlásenie bolo úspešné",
            "access_token": access_token,
            "refresh_token": refresh_token,
        }
    ), 200


@jwt_required(refresh=True)
def refresh():
    jwt_payload = get_jwt()
    uid = get_jwt_identity()
    ver = jwt_payload.get("ver")

    user = User.query.get(int(uid))
    if not user:
        return jsonify({"message": "Používateľ nebol nájdený"}), 404

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
    return jsonify({"message": "Odhlásenie bolo úspešné"}), 200


@jwt_required(refresh=True)
def logout_refresh():
    payload = get_jwt()
    revoke_jti_with_ttl(jti=payload["jti"], exp_ts=payload["exp"])
    return jsonify({"message": "Obnovovací token bol zrušený"}), 200


@jwt_required()
def logout_all():
    uid = int(get_jwt_identity())
    jwt_payload = get_jwt()
    ver = jwt_payload.get("ver")

    user = User.query.get(uid)
    if not user:
        return jsonify({"message": "Používateľ nebol nájdený"}), 404

    mismatch = _assert_token_version_or_401(user, ver)
    if mismatch:
        return mismatch

    user.token_version += 1
    db.session.commit()
    return jsonify({"message": "Všetky relácie boli odhlásené"}), 200


@jwt_required()
def me():
    uid = int(get_jwt_identity())
    token_ver = get_jwt().get("ver")

    user = User.query.get(uid)
    if not user:
        return jsonify({"message": "Používateľ nebol nájdený"}), 404

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
    return jsonify({"message": "Toto je testovacia ruta"}), 200
