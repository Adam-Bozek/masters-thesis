from __future__ import annotations

from datetime import datetime, timezone

from . import db


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


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

    session_categories = db.relationship("SessionTestCategory", back_populates="category", cascade="all, delete-orphan")

    def __init__(self, name: str, question_count: int) -> None:
        self.name = name
        self.question_count = question_count


class UserTestSession(db.Model):
    __tablename__ = "user_test_sessions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    note = db.Column(db.Text, nullable=True)
    public_id = db.Column(db.Text, unique=True, nullable=True)
    guest_token = db.Column(db.Text, unique=True, nullable=True)
    is_guest = db.Column(db.Boolean, nullable=False, default=False)
    started_at = db.Column(db.DateTime(timezone=True), default=utc_now)
    last_activity_at = db.Column(db.DateTime(timezone=True), default=utc_now)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=True)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    user = db.relationship("User", back_populates="test_sessions")
    session_categories = db.relationship(
        "SessionTestCategory",
        back_populates="session",
        cascade="all, delete-orphan",
        overlaps="answers,session",
    )
    answers = db.relationship(
        "UserTestAnswer",
        back_populates="session",
        cascade="all, delete-orphan",
        overlaps="session_category,answers",
    )

    def __init__(
        self,
        user_id: int | None = None,
        note: str | None = None,
        public_id: str | None = None,
        guest_token: str | None = None,
        is_guest: bool = False,
        started_at: datetime | None = None,
        last_activity_at: datetime | None = None,
        expires_at: datetime | None = None,
        completed_at: datetime | None = None,
    ) -> None:
        now = utc_now()
        self.user_id = user_id
        self.note = note
        self.public_id = public_id
        self.guest_token = guest_token
        self.is_guest = is_guest
        self.started_at = started_at or now
        self.last_activity_at = last_activity_at or now
        self.expires_at = expires_at
        self.completed_at = completed_at


class SessionTestCategory(db.Model):
    __tablename__ = "session_test_categories"

    session_id = db.Column(db.Integer, db.ForeignKey("user_test_sessions.id", ondelete="CASCADE"), primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey("test_categories.id"), primary_key=True)
    started_at = db.Column(db.DateTime(timezone=True), nullable=True)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    was_corrected = db.Column(db.Boolean, nullable=False, default=False)

    session = db.relationship("UserTestSession", back_populates="session_categories", overlaps="answers,session")
    category = db.relationship("TestCategory", back_populates="session_categories")
    answers = db.relationship(
        "UserTestAnswer",
        back_populates="session_category",
        cascade="all, delete-orphan",
        overlaps="session,answers,category",
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
    session_id = db.Column(db.Integer, db.ForeignKey("user_test_sessions.id", ondelete="CASCADE"), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("test_categories.id"), nullable=False)
    question_number = db.Column(db.Integer, nullable=False)
    answer_state = db.Column(db.Text, nullable=False)
    user_answer = db.Column(db.Text, nullable=True)
    answered_at = db.Column(db.DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        db.UniqueConstraint("session_id", "category_id", "question_number", name="uq_session_category_question"),
        db.ForeignKeyConstraint(
            ["session_id", "category_id"],
            ["session_test_categories.session_id", "session_test_categories.category_id"],
            ondelete="CASCADE",
            name="fk_session_category",
        ),
    )

    session = db.relationship("UserTestSession", back_populates="answers", overlaps="session_category,answers")
    category = db.relationship("TestCategory", overlaps="answers,session_category")
    session_category = db.relationship(
        "SessionTestCategory",
        back_populates="answers",
        primaryjoin=("and_(UserTestAnswer.session_id == SessionTestCategory.session_id, UserTestAnswer.category_id == SessionTestCategory.category_id)"),
        viewonly=False,
        overlaps="session,answers,category",
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
