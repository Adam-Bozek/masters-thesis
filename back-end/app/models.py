from __future__ import annotations
from . import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.Text, nullable=False)
    last_name = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text, unique=True, nullable=False, index=True)
    password = db.Column(db.Text, nullable=False)
    token_version = db.Column(db.Integer, nullable=False, default=1)

    def __init__(self, first_name: str, last_name: str, email: str, password: str, token_version: int = 1) -> None:
        self.first_name = first_name
        self.last_name = last_name
        self.email = email
        self.password = password
        self.token_version = token_version
