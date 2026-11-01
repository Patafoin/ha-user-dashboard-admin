"""Every translation file carries exactly the keys of strings.json."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[1] / "custom_components" / "user_dashboard_admin"


def _keys(data: dict, prefix: str = "") -> set[str]:
    keys = set()
    for key, value in data.items():
        path = f"{prefix}.{key}" if prefix else key
        keys |= _keys(value, path) if isinstance(value, dict) else {path}
    return keys


@pytest.mark.parametrize("lang", ["en", "fr", "de", "es"])
def test_translation_keys(lang: str) -> None:
    reference = _keys(json.loads((ROOT / "strings.json").read_text()))
    assert _keys(json.loads((ROOT / "translations" / f"{lang}.json").read_text())) == reference
