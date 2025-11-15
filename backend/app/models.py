from __future__ import annotations
from datetime import datetime
from . import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.Text, nullable=False)
    last_name = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text, unique=True, nullable=False, index=True)
    password = db.Column(db.Text, nullable=False)
    token_version = db.Column(db.Integer, nullable=False, default=1)
    test_sessions = db.relationship("UserTestSession", back_populates="user", cascade="all, delete-orphan")

    def __init__(self, first_name: str, last_name: str, email: str, password: str, token_version: int = 1) -> None:
        self.first_name = first_name
        self.last_name = last_name
        self.email = email
        self.password = password
        self.token_version = token_version


class TestCategory(db.Model):
    __tablename__ = "test_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, nullable=False, unique=True)
    question_count = db.Column(db.Integer, nullable=False)
    # maps to completed_at TIMESTAMPTZ
    completed_at = db.Column(db.DateTime, nullable=True)

    answers = db.relationship("UserTestAnswer", back_populates="category")

    def __init__(
        self,
        name: str,
        question_count: int,
        completed_at: datetime | None = None,
    ) -> None:
        self.name = name
        self.question_count = question_count
        self.completed_at = completed_at


class UserTestSession(db.Model):
    __tablename__ = "user_test_sessions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", back_populates="test_sessions")
    answers = db.relationship("UserTestAnswer", back_populates="session", cascade="all, delete-orphan")

    def __init__(self, user_id: int, completed_at: datetime | None = None) -> None:
        self.user_id = user_id
        self.completed_at = completed_at


class UserTestAnswer(db.Model):
    __tablename__ = "user_test_answers"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("user_test_sessions.id", ondelete="CASCADE"), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("test_categories.id"), nullable=False)
    question_number = db.Column(db.Integer, nullable=False)
    answer_state = db.Column(db.Text, nullable=False)  # CHECK constraint should be applied in migration
    user_answer = db.Column(db.Text, nullable=True)
    answered_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("session_id", "category_id", "question_number", name="uq_session_category_question"),)

    session = db.relationship("UserTestSession", back_populates="answers")
    category = db.relationship("TestCategory", back_populates="answers")

    def __init__(self, session_id: int, category_id: int, question_number: int, answer_state: str, user_answer: str | None = None) -> None:
        self.session_id = session_id
        self.category_id = category_id
        self.question_number = question_number
        self.answer_state = answer_state
        self.user_answer = user_answer
