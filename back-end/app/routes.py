from flask import Blueprint
from .auth import register, login, verify

auth_bp = Blueprint('auth', __name__)

auth_bp.route('/register', methods=['POST'])(register)
auth_bp.route('/login', methods=['POST'])(login)
auth_bp.route('/verify', methods=['GET'])(verify)