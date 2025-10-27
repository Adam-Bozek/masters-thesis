from __future__ import annotations
from datetime import datetime
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from .. import db
from ..models import User, UserTestSession, UserTestAnswer, TestCategory


# ---- Helpers ----
def _assert_user_or_404(uid: int) -> User | tuple:
    user = User.query.get(uid)
    if not user:
        return jsonify({"message": "User not found"}), 404
    return user


# ---- Routes ----
@jwt_required()
def create_session():
    """Start a new test session for the current user."""
    uid = int(get_jwt_identity())
    user = _assert_user_or_404(uid)

    if isinstance(user, tuple):
        return user

    new_session = UserTestSession(user_id=uid)
    db.session.add(new_session)
    db.session.commit()

    return jsonify(
        {
            "message": "Session created",
            "session_id": new_session.id,
            "started_at": new_session.started_at.isoformat(),
        }
    ), 201


@jwt_required()
def list_sessions():
    """List all test sessions for the current user."""
    uid = int(get_jwt_identity())
    sessions = UserTestSession.query.filter_by(user_id=uid).order_by(UserTestSession.started_at.desc()).all()
    return jsonify(
        [
            {
                "id": s.id,
                "started_at": s.started_at.isoformat(),
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            }
            for s in sessions
        ]
    ), 200


@jwt_required()
def get_session(session_id: int):
    """Return one test session (with basic answer stats)."""
    uid = int(get_jwt_identity())
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()
    if not session:
        return jsonify({"message": "Session not found"}), 404

    answer_count = len(session.answers)
    return jsonify(
        {
            "id": session.id,
            "started_at": session.started_at.isoformat(),
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "answers_count": answer_count,
        }
    ), 200


@jwt_required()
def complete_session(session_id: int):
    """Mark a session as completed."""
    uid = int(get_jwt_identity())
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()
    if not session:
        return jsonify({"message": "Session not found"}), 404
    if session.completed_at:
        return jsonify({"message": "Session already completed"}), 400

    session.completed_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"message": "Session completed"}), 200


@jwt_required()
def add_or_update_answer(session_id: int):
    """Add or update one answer (idempotent upsert)."""
    uid = int(get_jwt_identity())
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()
    if not session:
        return jsonify({"message": "Session not found"}), 404
    if session.completed_at:
        return jsonify({"message": "Session already completed"}), 400

    data = request.get_json(silent=True) or {}

    try:
        category_id = int(data["category_id"])
        question_number = int(data["question_number"])
        answer_state = str(data["answer_state"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"message": "Invalid or missing required fields"}), 400

    user_answer = data.get("user_answer")

    category = TestCategory.query.get(category_id)
    if not category:
        return jsonify({"message": "Category not found"}), 404

    if not (1 <= question_number <= category.question_count):
        return jsonify({"message": "Invalid question number"}), 400

    existing = UserTestAnswer.query.filter_by(session_id=session.id, category_id=category_id, question_number=question_number).first()

    if existing:
        existing.answer_state = answer_state
        existing.user_answer = user_answer
        existing.answered_at = datetime.now()
    else:
        db.session.add(
            UserTestAnswer(
                session_id=session.id,
                category_id=category_id,
                question_number=question_number,
                answer_state=answer_state,
                user_answer=user_answer,
            )
        )

    db.session.commit()
    return jsonify({"message": "Answer saved"}), 200


@jwt_required()
def list_answers(session_id: int):
    """List all answers for a given session."""
    uid = int(get_jwt_identity())
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()
    if not session:
        return jsonify({"message": "Session not found"}), 404

    answers = [
        {
            "id": a.id,
            "category_id": a.category_id,
            "question_number": a.question_number,
            "answer_state": a.answer_state,
            "user_answer": a.user_answer,
            "answered_at": a.answered_at.isoformat() if a.answered_at else None,
        }
        for a in session.answers
    ]
    return jsonify(answers), 200
