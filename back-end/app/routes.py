# app/routes.py
from flask import Blueprint
from .auth import register

auth_bp = Blueprint('auth', __name__)

auth_bp.route('/register', methods=['POST'])(register)
