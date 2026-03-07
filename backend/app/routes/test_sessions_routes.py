from __future__ import annotations

import io
from datetime import datetime
from pathlib import Path
from typing import Any, IO, cast

from flask import jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.orm import joinedload

from .. import db
from ..models import (
    SessionTestCategory,
    TestCategory,
    User,
    UserTestAnswer,
    UserTestSession,
)
from ..session_pdf_export import (
    SessionPdfConflictError,
    SessionPdfGenerationError,
    SessionPdfInputError,
    build_session_pdf_form_data,
    load_json_file_from_stream,
    normalize_key,
    parse_json_string,
    render_filled_pdf_bytes,
)


# ---- Pomocné funkcie ----
def _assert_user_or_404(uid: int) -> User | tuple:
    user = User.query.get(uid)
    if not user:
        return jsonify({"message": "Používateľ nebol nájdený"}), 404
    return user


def _coerce_positive_int(value: Any, field_name: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise SessionPdfInputError(f"Pole '{field_name}' musí byť celé číslo.") from exc

    if parsed <= 0:
        raise SessionPdfInputError(f"Pole '{field_name}' musí byť kladné celé číslo.")

    return parsed


def _parse_request_form_overrides() -> dict[str, Any]:
    if request.content_type and "multipart/form-data" in request.content_type.lower():
        raw_json = request.form.get("form_data")
        return parse_json_string(raw_json, label="form_data")

    data = request.get_json(silent=True) or {}
    raw_form_data = data.get("form_data") or {}
    if not isinstance(raw_form_data, dict):
        raise SessionPdfInputError("Pole 'form_data' musí byť JSON objekt.")

    return raw_form_data


def _collect_uploaded_questionnaires() -> dict[str, list[dict[str, Any]]]:
    questionnaires: dict[str, list[dict[str, Any]]] = {}

    for field_name in request.files:
        uploaded_file = request.files.get(field_name)
        if not uploaded_file or not uploaded_file.filename:
            continue

        if not uploaded_file.filename.lower().endswith(".json"):
            continue

        normalized_candidates = [normalize_key(field_name), normalize_key(Path(uploaded_file.filename).stem)]
        category_key = next(
            (candidate for candidate in normalized_candidates if candidate in {"marketplace", "mountains", "zoo", "street", "home"}),
            None,
        )

        if not category_key:
            continue

        file_stream: IO[bytes] = uploaded_file.stream
        questionnaires[category_key] = load_json_file_from_stream(
            file_stream,
            label=uploaded_file.filename,
        )

    return questionnaires


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
    Zoradené vždy podľa category_id: 1 -> 6.
    """
    uid = int(get_jwt_identity())
    session = UserTestSession.query.filter_by(id=session_id, user_id=uid).first()

    if not session:
        return jsonify({"message": "Relácia nebola nájdená"}), 404

    result = []
    for session_category in sorted(session.session_categories, key=lambda item: item.category_id):
        category = session_category.category
        result.append(
            {
                "id": category.id,
                "name": category.name,
                "question_count": category.question_count,
                "started_at": session_category.started_at.isoformat() if session_category.started_at else None,
                "completed_at": session_category.completed_at.isoformat() if session_category.completed_at else None,
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


@jwt_required()
def export_session_pdf():
    """
    Vygeneruje vyplnené TEKOS PDF pre daného používateľa a reláciu.
    """
    try:
        if request.content_type and "multipart/form-data" in request.content_type.lower():
            raw_user_id = request.form.get("user_id")
            raw_session_id = request.form.get("session_id")
            questionnaire_payloads = _collect_uploaded_questionnaires()
        else:
            data = request.get_json(silent=True) or {}
            raw_user_id = data.get("user_id")
            raw_session_id = data.get("session_id")
            questionnaire_payloads = data.get("questionnaires") or {}
            if questionnaire_payloads and not isinstance(questionnaire_payloads, dict):
                raise SessionPdfInputError("Pole 'questionnaires' musí byť objekt s kategóriami.")

        requested_user_id = _coerce_positive_int(raw_user_id, "user_id")
        requested_session_id = _coerce_positive_int(raw_session_id, "session_id")
        form_overrides = _parse_request_form_overrides()
    except SessionPdfInputError as exc:
        return jsonify({"message": str(exc)}), 400

    current_user_id = int(get_jwt_identity())
    if requested_user_id != current_user_id:
        return jsonify({"message": "Nemáte oprávnenie generovať PDF pre iného používateľa."}), 403

    user = _assert_user_or_404(requested_user_id)
    if isinstance(user, tuple):
        return user

    session = (
        UserTestSession.query.options(
            joinedload(cast(Any, UserTestSession.user)),
            joinedload(cast(Any, UserTestSession.answers)).joinedload(cast(Any, UserTestAnswer.category)),
        )
        .filter_by(id=requested_session_id, user_id=requested_user_id)
        .first()
    )

    if not session:
        return jsonify({"message": "Relácia nebola nájdená"}), 404

    if not session.answers:
        return jsonify({"message": "Relácia neobsahuje žiadne odpovede"}), 400

    try:
        form_data = build_session_pdf_form_data(
            user=user,
            session=session,
            form_overrides=form_overrides,
            questionnaire_payloads=questionnaire_payloads,
        )
        pdf_bytes = render_filled_pdf_bytes(form_data=form_data)
    except SessionPdfInputError as exc:
        return jsonify({"message": str(exc)}), 400
    except SessionPdfConflictError as exc:
        return jsonify({"message": str(exc)}), 409
    except SessionPdfGenerationError as exc:
        return jsonify({"message": str(exc)}), 500

    filename = f"tekos_session_{requested_session_id}.pdf"
    response = send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
        max_age=0,
    )
    response.headers["Cache-Control"] = "no-store"
    return response
