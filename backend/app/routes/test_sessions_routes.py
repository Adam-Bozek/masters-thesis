from __future__ import annotations
from datetime import datetime
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from .. import db
from ..models import (
    User,
    UserTestSession,
    UserTestAnswer,
    TestCategory,
    SessionTestCategory,  # NEW
)


# ---- Helpers ----
def _assert_user_or_404(uid: int) -> User | tuple:
    user = User.query.get(uid)
    if not user:
        return jsonify({"message": "User not found"}), 404
    return user


# ---- Routes ----
@jwt_required()
def create_session():
    """Start a new test session for the current user and attach categories."""
    uid = int(get_jwt_identity())
    user = _assert_user_or_404(uid)

    if isinstance(user, tuple):
        return user

    new_session = UserTestSession(user_id=uid)
    db.session.add(new_session)
    db.session.flush()  # ensure new_session.id is available

    # Create one SessionTestCategory per static category for this session
    categories = TestCategory.query.order_by(TestCategory.id).all()
    for c in categories:
        db.session.add(SessionTestCategory(session_id=new_session.id, category_id=c.id))

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
def list_session_categories(session_id: int):
    """
    List all categories for a given session, including per-session state
    (started_at, completed_at, was_corrected).
    """
    uid = int(get_jwt_identity())
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()
    if not session:
        return jsonify({"message": "Session not found"}), 404

    # We created one SessionTestCategory per TestCategory in create_session()
    result = []
    for sc in session.session_categories:  # relationship on UserTestSession
        c = sc.category  # static TestCategory
        result.append(
            {
                "id": c.id,
                "name": c.name,
                "question_count": c.question_count,
                "started_at": sc.started_at.isoformat() if sc.started_at else None,
                "completed_at": sc.completed_at.isoformat() if sc.completed_at else None,
                "was_corrected": sc.was_corrected,
            }
        )

    return jsonify(result), 200


@jwt_required()
def complete_category(session_id: int, category_id: int):
    """
    Mark a category as completed for this specific session
    (sets completed_at on SessionTestCategory).
    """
    uid = int(get_jwt_identity())

    # Ensure the session belongs to the current user
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()
    if not session:
        return jsonify({"message": "Session not found"}), 404

    # Per-session category row
    sc = SessionTestCategory.query.filter_by(session_id=session.id, category_id=category_id).first()
    if not sc:
        return jsonify({"message": "Category not part of this session"}), 404

    # Optional: only allow completion if at least one answer exists in this category
    has_answer = UserTestAnswer.query.filter_by(session_id=session.id, category_id=category_id).first()
    if not has_answer:
        return jsonify({"message": "No answers for this category in this session"}), 400

    if sc.completed_at:
        return jsonify({"message": "Category already completed"}), 400

    sc.completed_at = datetime.utcnow()
    db.session.commit()

    return jsonify(
        {
            "message": "Category completed",
            "category_id": sc.category_id,
            "completed_at": sc.completed_at.isoformat(),
        }
    ), 200


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

    # Ensure this category is part of this session
    sc = SessionTestCategory.query.filter_by(session_id=session.id, category_id=category_id).first()
    if not sc:
        return jsonify({"message": "Category not part of this session"}), 400

    category = sc.category  # static category with question_count, name, etc.

    if not (1 <= question_number <= category.question_count):
        return jsonify({"message": "Invalid question number"}), 400

    # Optionally set started_at on first answer
    if sc.started_at is None:
        sc.started_at = datetime.utcnow()

    existing = UserTestAnswer.query.filter_by(
        session_id=session.id,
        category_id=category_id,
        question_number=question_number,
    ).first()

    if existing:
        existing.answer_state = answer_state
        existing.user_answer = user_answer
        existing.answered_at = datetime.utcnow()
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


@jwt_required()
def correct_category(session_id: int, category_id: int):
    """
    Mark a category as 'corrected' for this specific session
    (sets was_corrected = True on SessionTestCategory).
    """
    uid = int(get_jwt_identity())

    # Ensure the session belongs to the current user
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()
    if not session:
        return jsonify({"message": "Session not found"}), 404

    # Find the per-session category row
    sc = SessionTestCategory.query.filter_by(session_id=session.id, category_id=category_id).first()
    if not sc:
        return jsonify({"message": "Category not part of this session"}), 404

    # Optional: require category to be completed before correction
    # if not sc.completed_at:
    #     return jsonify({"message": "Category not completed yet"}), 400

    if sc.was_corrected:
        return jsonify({"message": "Category already corrected"}), 400

    sc.was_corrected = True
    db.session.commit()

    return jsonify(
        {
            "message": "Category corrected",
            "category_id": sc.category_id,
            "was_corrected": sc.was_corrected,
        }
    ), 200
