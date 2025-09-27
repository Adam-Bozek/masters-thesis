import os

from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")

class Config:
    JWT_ALGORITHM  = "HS512"
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    
    SQLALCHEMY_DATABASE_URI = f"postgresql+psycopg2://{os.getenv('DB_USER')}:{ os.getenv('DB_PASSWORD')}@database:5432/{os.getenv('DB_NAME')}"
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
    SQLALCHEMY_ECHO = True
    SQLALCHEMY_BINDS = {}
    SQLALCHEMY_RECORD_QUERIES = True
    SQLALCHEMY_TRACK_MODIFICATIONS = False