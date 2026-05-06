"""
Pytest config — boots the test environment so legacy "smoke against deploy"
tests can also collect & run.

Loads `REACT_APP_BACKEND_URL` from `frontend/.env` (legacy convention used
across `tests/test_*.py`) and `MONGO_URL` / `DB_NAME` / `MAESTRO_*` from
`backend/.env`. Any test that does
    BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
at module import will now collect cleanly against the local container.
"""
from __future__ import annotations

import os
from pathlib import Path


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_repo_root = Path(__file__).resolve().parents[1]
_load_env_file(_repo_root / "backend" / ".env")
_load_env_file(_repo_root / "frontend" / ".env")

# Some legacy tests use `BACKEND_URL` instead of REACT_APP_BACKEND_URL.
if not os.environ.get("BACKEND_URL"):
    backend_url = os.environ.get("REACT_APP_BACKEND_URL")
    if backend_url:
        os.environ["BACKEND_URL"] = backend_url
