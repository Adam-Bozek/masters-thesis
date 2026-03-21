from __future__ import annotations

import io
import secrets
import string
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, IO, cast

from flask import jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from sqlalchemy import and_, or_
from sqlalchemy.orm import joinedload

from .. import db
from ..models import SessionTestCategory, TestCategory, User, UserTestAnswer, UserTestSession
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

GUEST_TTL = timedelta(hours=1)
STANDARD_CATEGORY_MAX_ID = 5


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _assert_user_or_404(uid: int) -> User | tuple:
    user = User.query.get(uid)
    if not user:
        return jsonify({"message": "Používateľ nebol nájdený"}), 404
    return user


def _request_json() -> dict[str, Any]:
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return {}
    return cast(dict[str, Any], data)


def _coerce_positive_int(value: Any, field_name: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise SessionPdfInputError(f"Pole '{field_name}' musí byť celé číslo.") from exc
    if parsed <= 0:
        raise SessionPdfInputError(f"Pole '{field_name}' musí byť kladné celé číslo.")
    return parsed


def _sanitize_note(value: Any) -> str | None:
    if value is None:
        return None
    note = str(value).strip()
    return note[:255] if note else None


def _parse_request_form_overrides() -> dict[str, Any]:
    if request.content_type and "multipart/form-data" in request.content_type.lower():
        raw_json = request.form.get("form_data")
        return parse_json_string(raw_json, label="form_data")

    data = _request_json()
    raw_form_data = data.get("form_data") or {}
    if not isinstance(raw_form_data, dict):
        raise SessionPdfInputError("Pole 'form_data' musí byť JSON objekt.")
    return cast(dict[str, Any], raw_form_data)


def _collect_uploaded_questionnaires() -> dict[str, list[dict[str, Any]]]:
    questionnaires: dict[str, list[dict[str, Any]]] = {}

    for field_name in request.files:
        uploaded_file = request.files.get(field_name)
        if not uploaded_file or not uploaded_file.filename:
            continue
        if not uploaded_file.filename.lower().endswith(".json"):
            continue

        normalized_candidates = [
            normalize_key(field_name),
            normalize_key(Path(uploaded_file.filename).stem),
        ]
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


def _standard_categories() -> list[TestCategory]:
    return TestCategory.query.filter(cast(Any, TestCategory.id) <= STANDARD_CATEGORY_MAX_ID).order_by(cast(Any, TestCategory.id).asc()).all()


def _generate_public_id() -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(8))
        exists = UserTestSession.query.filter_by(public_id=candidate).first()
        if not exists:
            return candidate


def _generate_guest_token() -> str:
    return secrets.token_urlsafe(32)


def _session_answers(session: UserTestSession) -> list[UserTestAnswer]:
    return list(cast(Any, session).answers or [])


def _session_categories(session: UserTestSession) -> list[SessionTestCategory]:
    return list(cast(Any, session).session_categories or [])


def _session_to_dict(session: UserTestSession) -> dict[str, Any]:
    return {
        "id": session.id,
        "session_id": session.id,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
        "note": session.note,
        "is_guest": bool(session.is_guest),
        "public_id": session.public_id,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
    }


def _cleanup_expired_guest_sessions() -> None:
    now_value = _now()
    cutoff = now_value - GUEST_TTL

    is_guest_col = cast(Any, UserTestSession.is_guest)
    expires_at_col = cast(Any, UserTestSession.expires_at)
    last_activity_at_col = cast(Any, UserTestSession.last_activity_at)

    expired_sessions = cast(
        list[UserTestSession],
        UserTestSession.query.filter(
            is_guest_col.is_(True),
            or_(
                and_(expires_at_col.is_not(None), expires_at_col < now_value),
                last_activity_at_col < cutoff,
            ),
        ).all(),
    )

    if not expired_sessions:
        return

    for session in expired_sessions:
        db.session.delete(session)
    db.session.commit()


def _touch_guest_session(session: UserTestSession) -> None:
    now_value = _now()
    session.last_activity_at = now_value
    session.expires_at = now_value + GUEST_TTL


def _get_guest_token() -> str:
    return (request.headers.get("X-Guest-Token") or "").strip()


def _get_authenticated_user_id() -> int | None:
    verify_jwt_in_request(optional=True)
    identity = get_jwt_identity()
    if identity is None:
        return None
    try:
        return int(identity)
    except (TypeError, ValueError):
        return None


def _is_authenticated_request() -> bool:
    return _get_authenticated_user_id() is not None


def _get_guest_session(session_id: int) -> UserTestSession | None:
    token = _get_guest_token()
    if not token:
        return None

    _cleanup_expired_guest_sessions()

    session = cast(
        UserTestSession | None,
        UserTestSession.query.filter_by(
            id=session_id,
            guest_token=token,
            is_guest=True,
        ).first(),
    )
    if not session:
        return None

    now_value = _now()
    if (session.expires_at and session.expires_at < now_value) or (session.last_activity_at and session.last_activity_at < now_value - GUEST_TTL):
        db.session.delete(session)
        db.session.commit()
        return None

    return session


def _load_accessible_session(session_id: int) -> tuple[UserTestSession | None, tuple | None, User | None]:
    guest_session = _get_guest_session(session_id)
    if guest_session is not None:
        return guest_session, None, None

    if _get_guest_token():
        return None, (jsonify({"message": "Hosťovská relácia nebola nájdená alebo vypršala."}), 404), None

    uid = _get_authenticated_user_id()
    if uid is None:
        return None, (jsonify({"message": "Chýba autorizácia."}), 401), None

    asserted_user = _assert_user_or_404(uid)
    if isinstance(asserted_user, tuple):
        return None, asserted_user, None

    session = cast(
        UserTestSession | None,
        UserTestSession.query.filter_by(id=session_id, user_id=uid, is_guest=False).first(),
    )
    if not session:
        return None, (jsonify({"message": "Relácia nebola nájdená"}), 404), None

    return session, None, asserted_user


def _ensure_session_category(session: UserTestSession, category_id: int) -> SessionTestCategory | None:
    return cast(
        SessionTestCategory | None,
        SessionTestCategory.query.filter_by(
            session_id=session.id,
            category_id=category_id,
        ).first(),
    )


@jwt_required()
def create_session():
    uid = int(get_jwt_identity())
    user = _assert_user_or_404(uid)
    if isinstance(user, tuple):
        return user

    new_session = UserTestSession(
        user_id=uid,
        is_guest=False,
        last_activity_at=_now(),
    )
    db.session.add(new_session)
    db.session.flush()

    for category in _standard_categories():
        db.session.add(
            SessionTestCategory(
                session_id=new_session.id,
                category_id=category.id,
                was_corrected=False,
            )
        )

    db.session.commit()
    return jsonify({"message": "Relácia bola vytvorená", **_session_to_dict(new_session)}), 201


def create_guest_session():
    _cleanup_expired_guest_sessions()

    payload = _request_json()
    note = _sanitize_note(payload.get("note"))
    current_time = _now()

    new_session = UserTestSession(
        user_id=None,
        note=note,
        public_id=_generate_public_id(),
        guest_token=_generate_guest_token(),
        is_guest=True,
        started_at=current_time,
        last_activity_at=current_time,
        expires_at=current_time + GUEST_TTL,
    )
    db.session.add(new_session)
    db.session.flush()

    for category in _standard_categories():
        db.session.add(
            SessionTestCategory(
                session_id=new_session.id,
                category_id=category.id,
                was_corrected=False,
            )
        )

    db.session.commit()
    return (
        jsonify(
            {
                "message": "Hosťovská relácia bola vytvorená",
                **_session_to_dict(new_session),
                "guest_token": new_session.guest_token,
            }
        ),
        201,
    )


@jwt_required()
def list_sessions():
    uid = int(get_jwt_identity())
    started_at_col = cast(Any, UserTestSession.started_at)
    sessions = cast(
        list[UserTestSession],
        UserTestSession.query.filter_by(user_id=uid, is_guest=False).order_by(started_at_col.desc()).all(),
    )
    return jsonify([_session_to_dict(session) for session in sessions]), 200


def get_session(session_id: int):
    session, error_response, _user = _load_accessible_session(session_id)
    if error_response:
        return error_response

    session = cast(UserTestSession, session)
    if bool(session.is_guest):
        _touch_guest_session(session)
        db.session.commit()

    return jsonify(
        {
            **_session_to_dict(session),
            "answers_count": len(_session_answers(session)),
        }
    ), 200


def update_session(session_id: int):
    session, error_response, _user = _load_accessible_session(session_id)
    if error_response:
        return error_response

    payload = _request_json()
    session = cast(UserTestSession, session)

    if "note" in payload:
        session.note = _sanitize_note(payload.get("note"))

    if bool(session.is_guest):
        _touch_guest_session(session)

    db.session.commit()
    return jsonify({"message": "Relácia bola aktualizovaná", **_session_to_dict(session)}), 200


def update_session_note(session_id: int):
    return update_session(session_id)


def complete_session(session_id: int):
    session, error_response, _user = _load_accessible_session(session_id)
    if error_response:
        return error_response

    session = cast(UserTestSession, session)
    if session.completed_at:
        return jsonify({"message": "Relácia už bola dokončená"}), 400

    session.completed_at = _now()
    if bool(session.is_guest):
        _touch_guest_session(session)

    db.session.commit()
    return jsonify({"message": "Relácia bola dokončená", **_session_to_dict(session)}), 200


def list_session_categories(session_id: int):
    session, error_response, _user = _load_accessible_session(session_id)
    if error_response:
        return error_response

    session = cast(UserTestSession, session)
    result: list[dict[str, Any]] = []

    for session_category in sorted(_session_categories(session), key=lambda item: item.category_id):
        category = cast(TestCategory, session_category.category)
        if int(category.id) > STANDARD_CATEGORY_MAX_ID:
            continue

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

    if bool(session.is_guest):
        _touch_guest_session(session)
        db.session.commit()

    return jsonify(result), 200


def complete_category(session_id: int, category_id: int):
    session, error_response, _user = _load_accessible_session(session_id)
    if error_response:
        return error_response

    session = cast(UserTestSession, session)
    session_category = _ensure_session_category(session, category_id)
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

    session_category.completed_at = _now()
    session_category.was_corrected = False
    if bool(session.is_guest):
        _touch_guest_session(session)

    db.session.commit()
    return (
        jsonify(
            {
                "message": "Kategória bola dokončená",
                "category_id": session_category.category_id,
                "completed_at": session_category.completed_at.isoformat() if session_category.completed_at else None,
                "was_corrected": bool(session_category.was_corrected),
            }
        ),
        200,
    )


def add_or_update_answer(session_id: int):
    session, error_response, _user = _load_accessible_session(session_id)
    if error_response:
        return error_response

    session = cast(UserTestSession, session)
    if session.completed_at:
        return jsonify({"message": "Relácia už bola dokončená"}), 400

    data = _request_json()
    try:
        category_id = int(data["category_id"])
        question_number = int(data["question_number"])
        answer_state = str(data["answer_state"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"message": "Neplatné alebo chýbajúce povinné údaje"}), 400

    if answer_state not in {"1", "2", "3", "true", "false"}:
        return jsonify({"message": "Neplatný stav odpovede"}), 400

    user_answer = data.get("user_answer")
    session_category = _ensure_session_category(session, category_id)
    if not session_category:
        return jsonify({"message": "Kategória nie je súčasťou tejto relácie"}), 400

    category = cast(TestCategory, session_category.category)
    if not (1 <= question_number <= category.question_count):
        return jsonify({"message": "Neplatné číslo otázky"}), 400

    if session_category.started_at is None:
        session_category.started_at = _now()

    existing = cast(
        UserTestAnswer | None,
        UserTestAnswer.query.filter_by(
            session_id=session.id,
            category_id=category_id,
            question_number=question_number,
        ).first(),
    )

    if existing:
        existing.answer_state = answer_state
        existing.user_answer = None if user_answer is None else str(user_answer)
        existing.answered_at = _now()
    else:
        db.session.add(
            UserTestAnswer(
                session_id=session.id,
                category_id=category_id,
                question_number=question_number,
                answer_state=answer_state,
                user_answer=None if user_answer is None else str(user_answer),
            )
        )

    session_category.was_corrected = False
    if bool(session.is_guest):
        _touch_guest_session(session)

    db.session.commit()
    return jsonify({"message": "Odpoveď bola uložená"}), 200


def list_answers(session_id: int):
    session, error_response, _user = _load_accessible_session(session_id)
    if error_response:
        return error_response

    session = cast(UserTestSession, session)
    answers = [
        {
            "id": answer.id,
            "category_id": answer.category_id,
            "question_number": answer.question_number,
            "answer_state": answer.answer_state,
            "user_answer": answer.user_answer,
            "answered_at": answer.answered_at.isoformat() if answer.answered_at else None,
        }
        for answer in _session_answers(session)
    ]

    if bool(session.is_guest):
        _touch_guest_session(session)
        db.session.commit()

    return jsonify(answers), 200


def correct_category(session_id: int, category_id: int):
    session, error_response, _user = _load_accessible_session(session_id)
    if error_response:
        return error_response

    session = cast(UserTestSession, session)
    session_category = _ensure_session_category(session, category_id)
    if not session_category:
        return jsonify({"message": "Kategória nie je súčasťou tejto relácie"}), 404

    if session_category.was_corrected:
        return jsonify({"message": "Kategória už bola opravená"}), 400

    session_category.was_corrected = True
    if bool(session.is_guest):
        _touch_guest_session(session)

    db.session.commit()
    return (
        jsonify(
            {
                "message": "Kategória bola opravená",
                "category_id": session_category.category_id,
                "was_corrected": bool(session_category.was_corrected),
            }
        ),
        200,
    )


def export_session_pdf():
    try:
        if request.content_type and "multipart/form-data" in request.content_type.lower():
            raw_user_id = request.form.get("user_id")
            raw_session_id = request.form.get("session_id")
            questionnaire_payloads = _collect_uploaded_questionnaires()
        else:
            data = _request_json()
            raw_user_id = data.get("user_id")
            raw_session_id = data.get("session_id")
            questionnaire_payloads = data.get("questionnaires") or {}
            if questionnaire_payloads and not isinstance(questionnaire_payloads, dict):
                raise SessionPdfInputError("Pole 'questionnaires' musí byť objekt s kategóriami.")

        requested_session_id = _coerce_positive_int(raw_session_id, "session_id")
        form_overrides = _parse_request_form_overrides()
    except SessionPdfInputError as exc:
        return jsonify({"message": str(exc)}), 400

    session, error_response, user = _load_accessible_session(requested_session_id)
    if error_response:
        return error_response

    session = cast(UserTestSession, session)
    if _is_authenticated_request():
        requested_user_id = _coerce_positive_int(raw_user_id, "user_id")
        current_user = cast(User, user)
        if requested_user_id != current_user.id:
            return jsonify({"message": "Nemáte oprávnenie generovať PDF pre iného používateľa."}), 403

        session = cast(
            UserTestSession | None,
            UserTestSession.query.options(
                joinedload(cast(Any, UserTestSession.user)),
                joinedload(cast(Any, UserTestSession.answers)).joinedload(cast(Any, UserTestAnswer.category)),
            )
            .filter_by(id=requested_session_id, user_id=requested_user_id, is_guest=False)
            .first(),
        )
        if not session:
            return jsonify({"message": "Relácia nebola nájdená"}), 404

        pdf_user = current_user
    else:
        session = cast(
            UserTestSession | None,
            UserTestSession.query.options(
                joinedload(cast(Any, UserTestSession.answers)).joinedload(cast(Any, UserTestAnswer.category)),
            )
            .filter_by(
                id=requested_session_id,
                is_guest=True,
                guest_token=_get_guest_token(),
            )
            .first(),
        )
        if not session:
            return jsonify({"message": "Hosťovská relácia nebola nájdená alebo vypršala."}), 404

        pdf_user = User(
            first_name="Hosť",
            last_name="Používateľ",
            email="guest@example.invalid",
            password="",
        )
        _touch_guest_session(session)
        db.session.commit()

    if not _session_answers(session):
        return jsonify({"message": "Relácia neobsahuje žiadne odpovede"}), 400

    try:
        form_data = build_session_pdf_form_data(
            user=pdf_user,
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
