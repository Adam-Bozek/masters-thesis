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

    # one category can appear in many sessions
    session_categories = db.relationship(
        "SessionTestCategory",
        back_populates="category",
        cascade="all, delete-orphan",
    )

    # optional: if you still want all answers for this category across all sessions
    # answers = db.relationship("UserTestAnswer", back_populates="category")

    def __init__(self, name: str, question_count: int) -> None:
        self.name = name
        self.question_count = question_count


class UserTestSession(db.Model):
    __tablename__ = "user_test_sessions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", back_populates="test_sessions")

    # all categories (Marketplace, Mountains, ...) for this particular session
    session_categories = db.relationship(
        "SessionTestCategory",
        back_populates="session",
        cascade="all, delete-orphan",
    )

    # still useful: all answers in this session
    answers = db.relationship(
        "UserTestAnswer",
        back_populates="session",
        cascade="all, delete-orphan",
    )

    def __init__(self, user_id: int, completed_at: datetime | None = None) -> None:
        self.user_id = user_id
        self.completed_at = completed_at


class SessionTestCategory(db.Model):
    __tablename__ = "session_test_categories"

    # composite PK: each category appears at most once per session
    session_id = db.Column(
        db.Integer,
        db.ForeignKey("user_test_sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    category_id = db.Column(
        db.Integer,
        db.ForeignKey("test_categories.id"),
        primary_key=True,
    )

    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    was_corrected = db.Column(db.Boolean, nullable=False, default=False)

    session = db.relationship("UserTestSession", back_populates="session_categories")
    category = db.relationship("TestCategory", back_populates="session_categories")

    # all answers for this (session, category)
    answers = db.relationship(
        "UserTestAnswer",
        back_populates="session_category",
        cascade="all, delete-orphan",
    )

    def __init__(
        self,
        session_id: int,
        category_id: int,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        was_corrected: bool = False,
    ) -> None:
        self.session_id = session_id
        self.category_id = category_id
        self.started_at = started_at
        self.completed_at = completed_at
        self.was_corrected = was_corrected


class UserTestAnswer(db.Model):
    __tablename__ = "user_test_answers"

    id = db.Column(db.Integer, primary_key=True)

    session_id = db.Column(
        db.Integer,
        db.ForeignKey("user_test_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    category_id = db.Column(
        db.Integer,
        db.ForeignKey("test_categories.id"),
        nullable=False,
    )

    question_number = db.Column(db.Integer, nullable=False)
    answer_state = db.Column(db.Text, nullable=False)  # '1', '2', '3', 'true', 'false'
    user_answer = db.Column(db.Text, nullable=True)
    answered_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        # one answer per session+category+question
        db.UniqueConstraint(
            "session_id",
            "category_id",
            "question_number",
            name="uq_session_category_question",
        ),
        # ensure (session_id, category_id) exists in session_test_categories
        db.ForeignKeyConstraint(
            ["session_id", "category_id"],
            ["session_test_categories.session_id", "session_test_categories.category_id"],
            ondelete="CASCADE",
            name="fk_session_category",
        ),
    )

    session = db.relationship("UserTestSession", back_populates="answers")
    category = db.relationship("TestCategory")  # optional convenience
    session_category = db.relationship(
        "SessionTestCategory",
        back_populates="answers",
        primaryjoin=("and_(UserTestAnswer.session_id == SessionTestCategory.session_id, UserTestAnswer.category_id == SessionTestCategory.category_id)"),
        viewonly=False,
        overlaps="category",
    )

    def __init__(
        self,
        session_id: int,
        category_id: int,
        question_number: int,
        answer_state: str,
        user_answer: str | None = None,
    ) -> None:
        self.session_id = session_id
        self.category_id = category_id
        self.question_number = question_number
        self.answer_state = answer_state
        self.user_answer = user_answer
