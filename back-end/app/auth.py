from flask import request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required
from .models import User
from . import db, bcrypt
from datetime import timedelta

from flask import request, jsonify
from flask_bcrypt import Bcrypt
from .models import User
from . import db, bcrypt

def register():
    data = request.get_json(silent=True) or {}
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    # Basic validation
    if not (first_name and last_name and email and password):
        return jsonify({"message": "Missing required fields"}), 400

    # Check if email already exists
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "User already exists"}), 400

    # Hash and salt the password using bcrypt
    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")

    # Create new user with the hashed password
    new_user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password=hashed_password,  # Store the hashed password
    )
    
    # Add user to the session and commit to the database
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "User registered successfully"}), 201


def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    # Basic validation
    if not (email and password):
        return jsonify({"message": "Missing email or password"}), 400

    # Find user by email
    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({"message": "Invalid email or password"}), 401

    # Create JWT tokens (access and refresh)
    access_token = create_access_token(identity=user.id, fresh=True, expires_delta=timedelta(hours=1))
    refresh_token = create_refresh_token(identity=user.id, expires_delta=timedelta(days=30))

    # Successful login
    return jsonify({
        "message": "Login successful",
        "user_id": user.id,
        "access_token": access_token,
        "refresh_token": refresh_token
    }), 200


@jwt_required()
def test_route():
    return jsonify({"message": "This is a test route"}), 200
