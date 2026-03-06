from __future__ import annotations

from datetime import datetime

from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from .. import db
from ..models import (
    SessionTestCategory,
    TestCategory,
    User,
    UserTestAnswer,
    UserTestSession,
)


# ---- Pomocné funkcie ----
def _assert_user_or_404(uid: int) -> User | tuple:
    user = User.query.get(uid)
    if not user:
        return jsonify({"message": "Používateľ nebol nájdený"}), 404
    return user


# ---- Routy ----
@jwt_required()
def create_session():
    """Vytvorí novú testovaciu reláciu pre aktuálneho používateľa a priradí kategórie."""
    uid = int(get_jwt_identity())
    user = _assert_user_or_404(uid)

    if isinstance(user, tuple):
        return user

    new_session = UserTestSession(user_id=uid)
    db.session.add(new_session)
    db.session.flush()

    categories = TestCategory.query.order_by(TestCategory.id).all()
    for category in categories:
        db.session.add(
            SessionTestCategory(
                session_id=new_session.id,
                category_id=category.id,
                was_corrected=False,
            )
        )

    db.session.commit()

    return jsonify(
        {
            "message": "Relácia bola vytvorená",
            "session_id": new_session.id,
            "started_at": new_session.started_at.isoformat(),
        }
    ), 201


@jwt_required()
def list_sessions():
    """Vráti všetky testovacie relácie aktuálneho používateľa."""
    uid = int(get_jwt_identity())
    sessions = UserTestSession.query.filter_by(user_id=uid).order_by(UserTestSession.started_at.desc()).all()

    return jsonify(
        [
            {
                "id": session.id,
                "started_at": session.started_at.isoformat(),
                "completed_at": (session.completed_at.isoformat() if session.completed_at else None),
            }
            for session in sessions
        ]
    ), 200


@jwt_required()
def get_session(session_id: int):
    """Vráti jednu testovaciu reláciu vrátane základných štatistík odpovedí."""
    uid = int(get_jwt_identity())
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()

    if not session:
        return jsonify({"message": "Relácia nebola nájdená"}), 404

    answer_count = len(session.answers)

    return jsonify(
        {
            "id": session.id,
            "started_at": session.started_at.isoformat(),
            "completed_at": (session.completed_at.isoformat() if session.completed_at else None),
            "answers_count": answer_count,
        }
    ), 200


@jwt_required()
def complete_session(session_id: int):
    """Označí reláciu ako dokončenú."""
    uid = int(get_jwt_identity())
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()

    if not session:
        return jsonify({"message": "Relácia nebola nájdená"}), 404

    if session.completed_at:
        return jsonify({"message": "Relácia už bola dokončená"}), 400

    session.completed_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"message": "Relácia bola dokončená"}), 200


@jwt_required()
def list_session_categories(session_id: int):
    """
    Vráti všetky kategórie danej relácie vrátane stavov pre reláciu
    (started_at, completed_at, was_corrected).
    """
    uid = int(get_jwt_identity())
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()

    if not session:
        return jsonify({"message": "Relácia nebola nájdená"}), 404

    result = []
    for session_category in session.session_categories:
        category = session_category.category
        result.append(
            {
                "id": category.id,
                "name": category.name,
                "question_count": category.question_count,
                "started_at": (session_category.started_at.isoformat() if session_category.started_at else None),
                "completed_at": (session_category.completed_at.isoformat() if session_category.completed_at else None),
                "was_corrected": bool(session_category.was_corrected),
            }
        )

    return jsonify(result), 200


@jwt_required()
def complete_category(session_id: int, category_id: int):
    """
    Označí kategóriu ako dokončenú pre konkrétnu reláciu
    (nastaví completed_at na SessionTestCategory).
    Pri dokončení sa kategória vždy považuje za neskontrolovanú,
    kým ju manuálne nepotvrdí endpoint /correct.
    """
    uid = int(get_jwt_identity())

    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()
    if not session:
        return jsonify({"message": "Relácia nebola nájdená"}), 404

    session_category = SessionTestCategory.query.filter_by(
        session_id=session.id,
        category_id=category_id,
    ).first()
    if not session_category:
        return jsonify({"message": "Kategória nie je súčasťou tejto relácie"}), 404

    has_answer = UserTestAnswer.query.filter_by(
        session_id=session.id,
        category_id=category_id,
    ).first()
    if not has_answer:
        return jsonify({"message": "V tejto kategórii nie sú žiadne odpovede"}), 400

    if session_category.completed_at:
        return jsonify({"message": "Kategória už bola dokončená"}), 400

    session_category.completed_at = datetime.utcnow()
    session_category.was_corrected = False
    db.session.commit()

    return jsonify(
        {
            "message": "Kategória bola dokončená",
            "category_id": session_category.category_id,
            "completed_at": session_category.completed_at.isoformat(),
            "was_corrected": session_category.was_corrected,
        }
    ), 200


@jwt_required()
def add_or_update_answer(session_id: int):
    """Pridá alebo aktualizuje jednu odpoveď."""
    uid = int(get_jwt_identity())
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()

    if not session:
        return jsonify({"message": "Relácia nebola nájdená"}), 404

    if session.completed_at:
        return jsonify({"message": "Relácia už bola dokončená"}), 400

    data = request.get_json(silent=True) or {}

    try:
        category_id = int(data["category_id"])
        question_number = int(data["question_number"])
        answer_state = str(data["answer_state"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"message": "Neplatné alebo chýbajúce povinné údaje"}), 400

    user_answer = data.get("user_answer")

    session_category = SessionTestCategory.query.filter_by(
        session_id=session.id,
        category_id=category_id,
    ).first()
    if not session_category:
        return jsonify({"message": "Kategória nie je súčasťou tejto relácie"}), 400

    category = session_category.category

    if not (1 <= question_number <= category.question_count):
        return jsonify({"message": "Neplatné číslo otázky"}), 400

    if session_category.started_at is None:
        session_category.started_at = datetime.utcnow()

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

    # Každá nová alebo upravená odpoveď ruší predchádzajúci stav kontroly.
    session_category.was_corrected = False

    db.session.commit()
    return jsonify({"message": "Odpoveď bola uložená"}), 200


@jwt_required()
def list_answers(session_id: int):
    """Vráti všetky odpovede pre danú reláciu."""
    uid = int(get_jwt_identity())
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()

    if not session:
        return jsonify({"message": "Relácia nebola nájdená"}), 404

    answers = [
        {
            "id": answer.id,
            "category_id": answer.category_id,
            "question_number": answer.question_number,
            "answer_state": answer.answer_state,
            "user_answer": answer.user_answer,
            "answered_at": answer.answered_at.isoformat() if answer.answered_at else None,
        }
        for answer in session.answers
    ]

    return jsonify(answers), 200


@jwt_required()
def correct_category(session_id: int, category_id: int):
    """
    Označí kategóriu ako opravenú pre konkrétnu reláciu
    (nastaví was_corrected = True na SessionTestCategory).
    """
    uid = int(get_jwt_identity())

    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()
    if not session:
        return jsonify({"message": "Relácia nebola nájdená"}), 404

    session_category = SessionTestCategory.query.filter_by(
        session_id=session.id,
        category_id=category_id,
    ).first()
    if not session_category:
        return jsonify({"message": "Kategória nie je súčasťou tejto relácie"}), 404

    if session_category.was_corrected:
        return jsonify({"message": "Kategória už bola opravená"}), 400

    session_category.was_corrected = True
    db.session.commit()

    return jsonify(
        {
            "message": "Kategória bola opravená",
            "category_id": session_category.category_id,
            "was_corrected": session_category.was_corrected,
        }
    ), 200
