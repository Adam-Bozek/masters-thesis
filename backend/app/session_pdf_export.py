from __future__ import annotations

import json
import os
import tempfile
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, IO, Mapping

from .form_fill import fill_pdf_from_json

MODULE_DIR = Path(__file__).resolve().parent


def _unique_paths(paths: list[Path]) -> tuple[Path, ...]:
    unique: list[Path] = []
    seen: set[str] = set()
    for path in paths:
        try:
            resolved = path.resolve()
        except Exception:
            resolved = path
        key = str(resolved)
        if key in seen:
            continue
        seen.add(key)
        unique.append(resolved)
    return tuple(unique)


def _env_dir(name: str) -> Path | None:
    raw = os.getenv(name)
    if not raw:
        return None
    return Path(raw)


def _data_search_dirs() -> tuple[Path, ...]:
    env_data_dir = _env_dir("TEKOS_DATA_DIR")
    candidates: list[Path] = []

    if env_data_dir is not None:
        candidates.append(env_data_dir)

    candidates.extend(
        [
            MODULE_DIR,
            MODULE_DIR.parent,
            Path.cwd(),
            MODULE_DIR / "public" / "data",
            MODULE_DIR.parent / "public" / "data",
            MODULE_DIR.parent / "frontend" / "public" / "data",
            MODULE_DIR.parent.parent / "frontend" / "public" / "data",
            MODULE_DIR.parent.parent.parent / "frontend" / "public" / "data",
            Path("/app/frontend/public/data"),
            Path("/frontend/public/data"),
            Path("/app/public/data"),
            Path("/app/client/public/data"),
            Path("/usr/src/app/frontend/public/data"),
        ]
    )

    return _unique_paths(candidates)


PDF_SEARCH_DIRS: tuple[Path, ...] = _unique_paths(
    [
        candidate
        for candidate in [
            _env_dir("TEKOS_PDF_DIR"),
            MODULE_DIR,
            MODULE_DIR.parent,
            Path.cwd(),
            MODULE_DIR.parent / "frontend" / "public",
            MODULE_DIR.parent.parent / "frontend" / "public",
            Path("/app"),
            Path("/app/frontend/public"),
        ]
        if candidate is not None
    ]
)

DATA_SEARCH_DIRS: tuple[Path, ...] = _data_search_dirs()


def _resolve_file(filename: str, *, search_dirs: tuple[Path, ...]) -> Path:
    for base_dir in search_dirs:
        candidate = (base_dir / filename).resolve()
        if candidate.exists() and candidate.is_file():
            return candidate
    return (search_dirs[0] / filename).resolve() if search_dirs else Path(filename).resolve()


def _searched_paths(filename: str, *, search_dirs: tuple[Path, ...]) -> str:
    return ", ".join(str((base_dir / filename).resolve()) for base_dir in search_dirs)


DEFAULT_PDF_TEMPLATE_PATH = _resolve_file("TEKOS_w_form.pdf", search_dirs=PDF_SEARCH_DIRS)

DEFAULT_CATEGORY_JSON_FILENAMES: dict[str, str] = {
    "marketplace": "marketplace.json",
    "mountains": "mountains.json",
    "zoo": "zoo.json",
    "street": "street.json",
    "home": "home.json",
}

CATEGORY_ID_TO_KEY: dict[int, str] = {
    1: "marketplace",
    2: "mountains",
    3: "zoo",
    4: "street",
    5: "home",
}

# NOTE:
# A few PDF field names do not match the visible label exactly.
# - datu_narodenia  -> field typo in the template
# - lekvar          -> this field sits on the "hrach" row in the PDF
# - zubna pasta     -> field contains a space in the actual PDF name
PDF_FIELD_BY_CATEGORY_AND_QUESTION: dict[tuple[str, int], str] = {
    # Zvuky zvierat a okolia
    ("home", 1): "ach",
    ("street", 1): "bim_bam",
    ("home", 2): "chacha_hihi",
    ("zoo", 1): "kac",
    ("street", 2): "sisi_sss",
    ("home", 4): "tik_tak",
    # Predmety, zvieratá, časti tela, jedlá a nápoje
    ("marketplace", 1): "ananas",
    ("street", 3): "auto",
    ("mountains", 1): "bunda",
    ("home", 5): "celo",
    ("mountains", 2): "cizmy",
    ("marketplace", 2): "cokolada",
    ("marketplace", 3): "dzem_lekvar",
    ("marketplace", 4): "lekvar",  # visible row label is "hrach"
    ("zoo", 2): "chvost",
    ("street", 4): "jama_diera",
    ("zoo", 3): "jasterica",
    ("zoo", 4): "jezko",
    ("street", 5): "kamion",
    ("marketplace", 5): "klobasa",
    ("zoo", 5): "kost",
    ("marketplace", 10): "krupica",
    ("marketplace", 11): "lepidlo",
    ("home", 6): "lyzicka",
    ("home", 7): "macka",
    ("marketplace", 12): "masla_gumicka",
    ("marketplace", 6): "maso",
    ("zoo", 6): "medved",
    ("street", 6): "mesiac",
    ("street", 7): "miesacka",
    ("home", 8): "nocnik",
    ("home", 9): "nos",
    ("marketplace", 7): "papier",
    ("home", 10): "papucky",
    ("home", 11): "pena",
    ("marketplace", 8): "pivo",
    ("marketplace", 9): "pomaranc",
    ("home", 3): "prsiplast",
    ("mountains", 3): "rukavice",
    ("street", 8): "sanitka",
    ("home", 12): "sedacka",
    ("mountains", 4): "sneh",
    ("home", 13): "svetlo",
    ("mountains", 5): "svetrik_pulover",
    ("home", 14): "salka_pohar",
    ("zoo", 7): "tulen",
    ("home", 15): "udica",
    ("home", 16): "vaha",
    ("home", 17): "vaza",
    ("home", 18): "vedierko_kyblik",
    ("zoo", 8): "vevericka",
    ("zoo", 9): "zoo",
    ("home", 19): "zubna pasta",
    ("street", 9): "zvoncek",
    # Činnosti a stavy
    ("zoo", 10): "bat_sa",
    ("street", 10): "cuvat",
    ("marketplace", 13): "cakat",
    ("marketplace", 14): "kupit",
    ("mountains", 6): "pit",
    ("street", 11): "opravit",
    ("home", 20): "plakat",
    ("home", 21): "umyvat",
    ("mountains", 7): "vonat",
    ("home", 22): "zivat",
    # Vlastnosti a príslovky
    ("home", 23): "detsky",
    ("home", 24): "dole_dolu",
    ("marketplace", 15): "nazvy_farieb",
    # II. časť - áno / nie
    ("home", 25): "assd_na",
    ("zoo", 11): "assd_o",
    ("street", 12): "assd_s",
    ("street", 13): "assd_k",
    ("marketplace", 16): "assd_predmety",
}

STATE_TO_PDF_VALUE: dict[str, str] = {
    "1": "rozumie_a_hovori",
    "2": "rozumie",
    "3": "nerozumie",
    "true": "ano",
    "false": "nie",
}

ALLOWED_TEXT_FIELDS: set[str] = {
    "meno_priezvisko",
    "datu_narodenia",
    "datum_vyplnenia",
    "pohlavie",
    "veta1",
    "veta2",
    "veta3",
}


class SessionPdfExportError(Exception):
    pass


class SessionPdfInputError(SessionPdfExportError):
    pass


class SessionPdfNotFoundError(SessionPdfExportError):
    pass


class SessionPdfConflictError(SessionPdfExportError):
    pass


class SessionPdfGenerationError(SessionPdfExportError):
    pass


def normalize_key(value: str | None) -> str:
    if not value:
        return ""

    normalized = unicodedata.normalize("NFD", str(value).strip().lower())
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = normalized.replace("marketpace", "marketplace")
    normalized = normalized.replace("/", "_").replace("-", "_")
    normalized = " ".join(normalized.split())
    normalized = normalized.replace(" ", "_")
    return normalized


def safe_int(value: Any) -> int | None:
    if value is None:
        return None

    if isinstance(value, str):
        stripped = value.strip()
        if stripped == "":
            return None
        value = stripped

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_json_string(raw_value: str | None, *, label: str) -> dict[str, Any]:
    if not raw_value:
        return {}

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise SessionPdfInputError(f"Pole '{label}' nie je validný JSON.") from exc

    if not isinstance(parsed, dict):
        raise SessionPdfInputError(f"Pole '{label}' musí byť JSON objekt.")

    return parsed


def load_json_file_from_stream(stream: IO[bytes], *, label: str) -> list[dict[str, Any]]:
    try:
        raw_bytes = stream.read()
    except Exception as exc:
        raise SessionPdfInputError(f"Súbor '{label}' sa nepodarilo prečítať.") from exc

    try:
        parsed = json.loads(raw_bytes.decode("utf-8"))
    except Exception as exc:
        raise SessionPdfInputError(f"Súbor '{label}' nie je validný UTF-8 JSON.") from exc

    if not isinstance(parsed, list):
        raise SessionPdfInputError(f"Súbor '{label}' musí obsahovať JSON pole otázok.")

    return [item for item in parsed if isinstance(item, dict)]


def load_questionnaire_payloads(overrides: Mapping[str, list[dict[str, Any]]] | None = None) -> dict[str, list[dict[str, Any]]]:
    payloads: dict[str, list[dict[str, Any]]] = {}

    for category_key, filename in DEFAULT_CATEGORY_JSON_FILENAMES.items():
        path = _resolve_file(filename, search_dirs=DATA_SEARCH_DIRS)
        try:
            with path.open("r", encoding="utf-8") as handle:
                parsed = json.load(handle)
        except FileNotFoundError as exc:
            raise SessionPdfGenerationError(
                f"Chýba predvolený JSON súbor pre kategóriu '{category_key}'. Hľadané cesty: {_searched_paths(filename, search_dirs=DATA_SEARCH_DIRS)}"
            ) from exc
        except json.JSONDecodeError as exc:
            raise SessionPdfGenerationError(f"Predvolený JSON súbor pre kategóriu '{category_key}' nie je validný.") from exc

        if not isinstance(parsed, list):
            raise SessionPdfGenerationError(f"Predvolený JSON súbor pre kategóriu '{category_key}' musí byť pole.")

        payloads[category_key] = [item for item in parsed if isinstance(item, dict)]

    if not overrides:
        return payloads

    for raw_key, questions in overrides.items():
        category_key = normalize_key(raw_key)
        if category_key in DEFAULT_CATEGORY_JSON_FILENAMES and isinstance(questions, list):
            payloads[category_key] = [item for item in questions if isinstance(item, dict)]

    return payloads


def index_questions_by_id(questionnaire_payloads: Mapping[str, list[dict[str, Any]]]) -> dict[str, dict[int, dict[str, Any]]]:
    indexed: dict[str, dict[int, dict[str, Any]]] = {}

    for category_key, questions in questionnaire_payloads.items():
        category_questions: dict[int, dict[str, Any]] = {}
        for question in questions:
            question_id = safe_int(question.get("questionId"))
            if question_id is None:
                continue
            category_questions[question_id] = question
        indexed[category_key] = category_questions

    return indexed


def resolve_category_key(category_name: str | None, category_id: int | None) -> str:
    normalized_name = normalize_key(category_name)
    if normalized_name:
        return normalized_name

    category_id_int = safe_int(category_id)
    if category_id_int is None:
        return ""

    return CATEGORY_ID_TO_KEY.get(category_id_int, "")


def map_answer_state_to_pdf_value(answer_state: Any) -> str | None:
    if answer_state is None:
        return None

    normalized_state = str(answer_state).strip().lower()
    if normalized_state in {"", "0", "none", "null"}:
        return None

    return STATE_TO_PDF_VALUE.get(normalized_state)


def build_base_form_data(form_overrides: Mapping[str, Any] | None = None) -> dict[str, Any]:
    today = datetime.utcnow().strftime("%-d.%-m.%Y")
    base: dict[str, Any] = {
        "datum_vyplnenia": today,
    }

    for key, value in (form_overrides or {}).items():
        normalized_key = str(key).strip()
        if normalized_key not in ALLOWED_TEXT_FIELDS:
            continue
        if value is None:
            continue
        base[normalized_key] = value

    return base


def build_session_pdf_form_data(
    *,
    user: Any,
    session: Any,
    form_overrides: Mapping[str, Any] | None = None,
    questionnaire_payloads: Mapping[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    loaded_payloads = load_questionnaire_payloads(questionnaire_payloads)
    indexed_questions = index_questions_by_id(loaded_payloads)
    form_data = build_base_form_data(form_overrides)

    if form_data.get("meno_priezvisko") in {None, ""} and user is not None:
        fallback_name = " ".join(
            part.strip() for part in [getattr(user, "first_name", ""), getattr(user, "last_name", "")] if isinstance(part, str) and part.strip()
        )
        if fallback_name:
            form_data["meno_priezvisko"] = fallback_name

    mappable_answers = 0

    answers = sorted(
        list(getattr(session, "answers", []) or []),
        key=lambda item: (
            safe_int(getattr(item, "category_id", None)) or 0,
            safe_int(getattr(item, "question_number", None)) or 0,
        ),
    )

    for answer in answers:
        category_relation = getattr(answer, "category", None)
        category_key = resolve_category_key(
            getattr(category_relation, "name", None),
            getattr(answer, "category_id", None),
        )
        question_number = safe_int(getattr(answer, "question_number", None))

        if not category_key or question_number is None or question_number <= 0:
            continue

        question_payload = indexed_questions.get(category_key, {}).get(question_number)
        if question_payload is None:
            continue

        field_name = PDF_FIELD_BY_CATEGORY_AND_QUESTION.get((category_key, question_number))
        if not field_name:
            continue

        pdf_value = map_answer_state_to_pdf_value(getattr(answer, "answer_state", None))
        if pdf_value is None:
            continue

        form_data[field_name] = pdf_value
        mappable_answers += 1

    if mappable_answers == 0:
        raise SessionPdfConflictError("Pre túto reláciu sa nenašli žiadne odpovede, ktoré sa dajú preniesť do PDF.")

    return form_data


def render_filled_pdf_bytes(
    *,
    form_data: Mapping[str, Any],
    pdf_template_path: str | Path | None = None,
) -> bytes:
    template_path = Path(pdf_template_path) if pdf_template_path else DEFAULT_PDF_TEMPLATE_PATH

    if not template_path.exists():
        raise SessionPdfGenerationError(f"PDF šablóna nebola nájdená. Hľadané cesty: {_searched_paths('TEKOS_w_form.pdf', search_dirs=PDF_SEARCH_DIRS)}")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
        output_path = Path(tmp_file.name)

    try:
        fill_pdf_from_json(str(template_path), dict(form_data), str(output_path))
        return output_path.read_bytes()
    except SessionPdfExportError:
        raise
    except Exception as exc:
        raise SessionPdfGenerationError("Generovanie PDF zlyhalo.") from exc
    finally:
        try:
            output_path.unlink(missing_ok=True)
        except Exception:
            pass
