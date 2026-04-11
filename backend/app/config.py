"""
# @ Author: Bc. Adam Božek
# @ Create Time: 2025-09-27 23:34:36
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

import os
from datetime import timedelta
from dotenv import load_dotenv

# Load env from project root .env (one level up from app/)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))


class Config:
    # JWT
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS512")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "15")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "30")))

    # DB
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql+psycopg2://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
        f"@{os.getenv('DB_HOST', 'database')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME')}"
    )
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
    SQLALCHEMY_ECHO = os.getenv("SQLALCHEMY_ECHO", "true").lower() == "true"
    SQLALCHEMY_BINDS = {}
    SQLALCHEMY_RECORD_QUERIES = True
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Redis
    REDIS_URL = os.getenv("REDIS_URL")
    REDIS_HOST = os.getenv("REDIS_HOST", "cache")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
