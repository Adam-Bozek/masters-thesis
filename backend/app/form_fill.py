"""
# @ Author: Bc. Adam Božek
# @ Create Time: 2026-03-07 12:10:45
# @ Description: This repository contains a full-stack application suite developed within a master’s thesis.
                It is designed to support the screening of children using the Slovak
                implementation of the TEKOS II screening instrument, short version. Copyright (C) 2026  Bc. Adam Božek
# @ License: This program is free software: you can redistribute it and/or modify it under the terms of
                the GNU Affero General Public License as published by the Free Software Foundation, either
                version 3 of the License, or any later version. This program is distributed in the hope
                that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
                of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
                See the GNU Affero General Public License for more details.
                You should have received a copy of the GNU Affero General Public License along with this program.
                If not, see <https://www.gnu.org/licenses/>..
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union, cast
import json
import os

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    DictionaryObject,
    IndirectObject,
    NameObject,
    TextStringObject,
)


# ---------- helpers ----------


def _resolve(obj: Any) -> Any:
    """Safely dereference IndirectObject to its real object."""
    while isinstance(obj, IndirectObject):
        obj = obj.get_object()
    return obj


def _as_dict(obj: Any) -> Optional[DictionaryObject]:
    """Return a resolved DictionaryObject or None."""
    obj = _resolve(obj)
    if isinstance(obj, DictionaryObject):
        return obj
    return None


def _as_array(obj: Any) -> Optional[ArrayObject]:
    """Return a resolved ArrayObject or None."""
    obj = _resolve(obj)
    if isinstance(obj, ArrayObject):
        return obj
    return None


def _widgets_for_field(field_dict: Any) -> List[DictionaryObject]:
    """Return widget annotation dicts for a field (handles Kids / single widget)."""
    f = _as_dict(field_dict)
    if f is None:
        return []

    kids = _as_array(f.get("/Kids"))
    if kids:
        widgets: List[DictionaryObject] = []
        for kid in kids:
            kd = _as_dict(kid)
            if kd is not None:
                widgets.append(kd)
        if widgets:
            return widgets

    return [f]


def _button_on_states(widgets: List[DictionaryObject]) -> List[str]:
    """
    Get the possible 'on' appearance state names for checkbox/radio widgets.
    (Everything under /AP /N except 'Off'.)
    """
    states = set()
    for w in widgets:
        ap = _as_dict(w.get("/AP"))
        if ap is None:
            continue

        n = _as_dict(ap.get("/N"))
        if n is None:
            continue

        for k in n.keys():
            k_str = str(k)
            if k_str != "/Off":
                states.add(k_str.lstrip("/"))

    return sorted(states)


def _field_type(fdict: DictionaryObject) -> str:
    ft = str(fdict.get("/FT"))
    if ft == "/Tx":
        return "text"
    if ft == "/Ch":
        return "choice"
    if ft == "/Btn":
        widgets = _widgets_for_field(fdict)
        if len(widgets) > 1:
            return "radio"
        return "checkbox"
    return "unknown"


def _choice_options(fdict: DictionaryObject) -> Optional[List[str]]:
    """Return the list of available options for /Ch fields (if present)."""
    opt = _as_array(fdict.get("/Opt"))
    if opt is None:
        return None

    items: List[str] = []
    for entry in opt:
        entry = _resolve(entry)
        if isinstance(entry, ArrayObject):
            if len(entry) > 0:
                items.append(str(_resolve(entry[0])))
        else:
            items.append(str(entry))
    return items


# ---------- API 1: list fields ----------


def list_form_fields(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Returns a list of dicts describing fields and prints a neat summary.
    Each item: {'name': str, 'type': 'text'|'checkbox'|'radio'|'choice'|'unknown', 'options': [..] or None}
    """
    reader = PdfReader(pdf_path)
    root = _as_dict(reader.trailer.get("/Root"))
    if root is None:
        return []

    acro = _as_dict(root.get("/AcroForm"))
    if acro is None:
        return []

    fields = _as_array(acro.get("/Fields")) or ArrayObject()

    out: List[Dict[str, Any]] = []

    def walk(field_dict: Any) -> None:
        f = _as_dict(field_dict)
        if f is None:
            return

        raw_name = f.get("/T")
        name = str(raw_name) if raw_name else ""
        ftype = _field_type(f)
        options: Optional[List[str]] = None

        if ftype in ("checkbox", "radio"):
            widgets = _widgets_for_field(f)
            on_states = _button_on_states(widgets)
            options = on_states if ftype == "radio" else (on_states or ["Yes"])
        elif ftype == "choice":
            options = _choice_options(f)

        if name:
            out.append({"name": name, "type": ftype, "options": options})

        kids = _as_array(f.get("/Kids"))
        if kids:
            for kid in kids:
                walk(kid)

    for fld in fields:
        walk(fld)

    print(f"Found {len([x for x in out if x['name']])} fillable field(s):")
    for item in out:
        nm = item["name"] or "<unnamed>"
        typ = item["type"]
        if item["options"]:
            print(f" - {nm} [{typ}] options: {item['options']}")
        else:
            print(f" - {nm} [{typ}]")

    return out


# ---------- API 2: fill from JSON ----------


def fill_pdf_from_json(
    pdf_path: str,
    json_or_dict: Union[str, Dict[str, Any]],
    output_path: str,
) -> None:
    """
    Fill a PDF form from a JSON file path or a dict.
    - For text fields: set string value.
    - For checkboxes: True/'Yes'/'On' or the actual on-state name. False/'Off' unchecks.
    - For radio groups: set the exact on-state name (as reported by list_form_fields).
    - For choices: provide one of the available option values.
    """
    if isinstance(json_or_dict, str):
        with open(json_or_dict, "r", encoding="utf-8") as f:
            data = cast(Dict[str, Any], json.load(f))
    else:
        data = json_or_dict

    reader = PdfReader(pdf_path)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)

    root = _as_dict(writer._root_object)
    if root is None:
        for p in reader.pages:
            writer.add_page(p)
        with open(output_path, "wb") as outf:
            writer.write(outf)
        return

    acro = _as_dict(root.get("/AcroForm"))
    if acro is None:
        for p in reader.pages:
            writer.add_page(p)
        with open(output_path, "wb") as outf:
            writer.write(outf)
        return

    acro.update({NameObject("/NeedAppearances"): BooleanObject(True)})

    def set_checkbox_or_radio(field_dict: DictionaryObject, desired_value: Any) -> None:
        widgets = _widgets_for_field(field_dict)
        on_states = _button_on_states(widgets)

        if isinstance(desired_value, str):
            desired_norm = desired_value.strip()
            if desired_norm.lower() in ("true", "yes", "on", "1"):
                desired_norm = on_states[0] if on_states else "Yes"
        elif desired_value:
            desired_norm = on_states[0] if on_states else "Yes"
        else:
            desired_norm = "Off"

        is_radio = len(widgets) > 1

        if is_radio:
            if desired_norm not in on_states:
                return

            field_dict.update({NameObject("/V"): NameObject("/" + desired_norm)})
            for w in widgets:
                ap = _as_dict(w.get("/AP"))
                chosen = "Off"
                if ap is not None:
                    apn = _as_dict(ap.get("/N"))
                    if apn is not None and NameObject("/" + desired_norm) in apn:
                        chosen = desired_norm
                w.update({NameObject("/AS"): NameObject("/" + chosen)})
        else:
            chosen = "Off"
            if desired_norm != "Off":
                chosen = desired_norm if desired_norm in on_states else (on_states[0] if on_states else "Yes")
            field_dict.update({NameObject("/V"): NameObject("/" + chosen)})
            for w in widgets:
                w.update({NameObject("/AS"): NameObject("/" + chosen)})

    fields = _as_array(acro.get("/Fields")) or ArrayObject()

    def walk_apply(field_dict: Any) -> None:
        f = _as_dict(field_dict)
        if f is None:
            return

        raw_name = f.get("/T")
        name = str(raw_name) if raw_name else None

        if name and name in data:
            ftype = _field_type(f)
            value = data[name]
            if ftype == "text":
                f.update({NameObject("/V"): TextStringObject(str(value))})
            elif ftype == "choice":
                f.update({NameObject("/V"): TextStringObject(str(value))})
            elif ftype in ("checkbox", "radio"):
                set_checkbox_or_radio(f, value)

        kids = _as_array(f.get("/Kids"))
        if kids:
            for kid in kids:
                walk_apply(kid)

    for fld in fields:
        walk_apply(fld)

    with open(output_path, "wb") as outf:
        writer.write(outf)


# ---------- example ----------


def example() -> None:
    pdf_in = "./TEKOS_w_form.pdf"
    pdf_out = "./filled_output.pdf"

    example_data = {
        "datu_narodenia": "5.8.2023",
        "datum_vyplnenia": "3.10.2025",
        "pohlavie": "chlapec",
        "meno_priezvisko": "Ján Novák",
    }

    list_form_fields(pdf_in)
    fill_pdf_from_json(pdf_in, example_data, pdf_out)
    print(f"Done. Wrote: {os.path.abspath(pdf_out)}")


if __name__ == "__main__":
    example()
