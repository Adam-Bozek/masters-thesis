# app/routes.py
from flask import Blueprint
from .auth import register, login, test_route

auth_bp = Blueprint('auth', __name__)

auth_bp.route('/register', methods=['POST'])(register)
auth_bp.route('/login', methods=['POST'])(login)
auth_bp.route('/test', methods=['GET'])(test_route)