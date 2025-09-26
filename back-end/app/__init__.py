from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from sqlalchemy import text

from .config import Config

db = SQLAlchemy()
jwt = JWTManager()


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    app.config.from_object(Config)
    
    db.init_app(app)
    jwt.init_app(app)

    # Verify DB connection
    with app.app_context():
        try:
            db.session.execute(text("SELECT 1"))
            print("Database connection successful!")
        except Exception as e:
            print("Database connection failed:", e)
            
    from .routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api')

    return app
