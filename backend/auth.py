"""
Auth helpers — JWT, bcrypt, current_user dependency, role guards.

The app uses plain Bearer tokens (Authorization header) rather than
httpOnly cookies because the user wants a "Recordar sesión" flow
where the token persists in localStorage on the frontend (or
sessionStorage when "remember me" is OFF). Two token lifetimes are
supported:

  * regular login → 1 day
  * "remember me" → 30 days
"""
from __future__ import annotations

import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import Header, HTTPException

JWT_ALGORITHM = "HS256"
ROLES = ("maestro", "director_de_juego", "jugador")
STATUSES = ("pendiente", "aprobado", "rechazado")


def _secret() -> str:
    s = os.environ.get("JWT_SECRET")
    if not s:
        raise RuntimeError("JWT_SECRET not configured")
    return s


# ===== Password hashing =====
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ===== JWT =====
def create_access_token(user_id: str, email: str, role: str, *, remember_me: bool = False) -> str:
    delta = timedelta(days=30) if remember_me else timedelta(days=1)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + delta,
        "type": "access",
        "remember": remember_me,
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


# ===== Current user dependency =====
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Reads the bearer token from `Authorization`, verifies it, and loads
    the user from MongoDB. Imports the global `db` lazily to avoid a
    circular import with server.py at module load time.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="No autenticado")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Tipo de token inválido")

    from server import db  # lazy import
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    if user.get("status") != "aprobado":
        raise HTTPException(status_code=403, detail="Cuenta pendiente de aprobación")
    return user


def require_role(user: dict, *roles: str):
    """Raise 403 if the given user does not have one of the listed roles."""
    if user.get("role") not in roles:
        raise HTTPException(status_code=403, detail="Permiso denegado")
    return user
