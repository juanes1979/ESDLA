"""
Auth routes — register / login / me / logout / list users / approve user.

Account flow:
  - register → status='pendiente', role='jugador'.
  - login allowed only when status='aprobado'.
  - maestro lists pending users and approves/rejects, optionally
    promoting role to director_de_juego or maestro.

Brute-force protection: 5 failed attempts on the same email within
10 minutes triggers a 15-minute lockout.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_role,
    ROLES,
    STATUSES,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ===== Models =====
class RegisterIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=4, max_length=128)
    # Solicitud de rol (sólo informativa). El Maestro decide al aprobar.
    requested_role: Optional[str] = None  # 'jugador' | 'director_de_juego'


class LoginIn(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class UserUpdateIn(BaseModel):
    role: Optional[str] = None      # 'director_de_juego' | 'jugador' (NUNCA 'maestro' por API)
    status: Optional[str] = None    # 'pendiente' | 'aprobado' | 'rechazado'


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    status: str
    created_at: str
    last_access: Optional[str] = None
    requested_role: Optional[str] = None
    is_protected: bool = False


def _maestro_email() -> str:
    return (os.environ.get("MAESTRO_EMAIL", "") or "").lower().strip()


def _serialize_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "jugador"),
        "status": u.get("status", "pendiente"),
        "created_at": u.get("created_at", ""),
        "last_access": u.get("last_access"),
        "requested_role": u.get("requested_role"),
        # Marca al Maestro semilla (Morthwen) como intocable.
        "is_protected": (u.get("email", "").lower().strip() == _maestro_email()),
    }


# ===== Brute-force =====
LOCKOUT_LIMIT = 5
LOCKOUT_WINDOW = timedelta(minutes=10)
LOCKOUT_DURATION = timedelta(minutes=15)


async def _check_lockout(db, email: str):
    rec = await db.login_attempts.find_one({"email": email})
    if not rec:
        return
    locked_until = rec.get("locked_until")
    if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
        raise HTTPException(status_code=429, detail="Cuenta bloqueada temporalmente. Intenta más tarde.")


async def _record_failed_attempt(db, email: str):
    now = datetime.now(timezone.utc)
    rec = await db.login_attempts.find_one({"email": email})
    if rec is None:
        await db.login_attempts.insert_one({
            "email": email,
            "attempts": 1,
            "first_attempt": now.isoformat(),
            "locked_until": None,
        })
        return
    first_attempt = datetime.fromisoformat(rec.get("first_attempt", now.isoformat()))
    if now - first_attempt > LOCKOUT_WINDOW:
        # Window expired — reset counter.
        await db.login_attempts.update_one(
            {"email": email},
            {"$set": {"attempts": 1, "first_attempt": now.isoformat(), "locked_until": None}},
        )
        return
    new_attempts = int(rec.get("attempts", 0)) + 1
    update = {"attempts": new_attempts}
    if new_attempts >= LOCKOUT_LIMIT:
        update["locked_until"] = (now + LOCKOUT_DURATION).isoformat()
    await db.login_attempts.update_one({"email": email}, {"$set": update})


async def _clear_attempts(db, email: str):
    await db.login_attempts.delete_one({"email": email})


# ===== Endpoints =====
@router.post("/register", response_model=UserOut)
async def register(data: RegisterIn):
    from server import db
    email = data.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo")
    # Sanitizar requested_role — sólo se admite jugador o DJ.
    req_role = data.requested_role if data.requested_role in ("jugador", "director_de_juego") else "jugador"
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": data.name.strip(),
        "password_hash": hash_password(data.password),
        "role": "jugador",
        "requested_role": req_role,
        "status": "pendiente",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    return _serialize_user(user_doc)


@router.post("/login")
async def login(data: LoginIn):
    from server import db
    email = data.email.lower().strip()
    await _check_lockout(db, email)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        await _record_failed_attempt(db, email)
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if user.get("status") == "pendiente":
        raise HTTPException(status_code=403, detail="Cuenta pendiente de aprobación por el Maestro")
    if user.get("status") == "rechazado":
        raise HTTPException(status_code=403, detail="Cuenta rechazada")
    await _clear_attempts(db, email)
    # Track last access — used by the Maestro UI to detect inactive accounts.
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_access": now_iso}},
    )
    user["last_access"] = now_iso
    token = create_access_token(user["id"], user["email"], user.get("role", "jugador"), remember_me=data.remember_me)
    return {"token": token, "user": _serialize_user(user), "remember_me": data.remember_me}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return _serialize_user(user)


@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    # JWT is stateless; the frontend just discards the token. Endpoint
    # exists for symmetry / future blacklist support.
    return {"ok": True}


@router.get("/users", response_model=List[UserOut])
async def list_users(user: dict = Depends(get_current_user)):
    require_role(user, "maestro")
    from server import db
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(length=None)
    users.sort(key=lambda u: (u.get("status") != "pendiente", u.get("created_at", "")))
    return [_serialize_user(u) for u in users]


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: str, data: UserUpdateIn, user: dict = Depends(get_current_user)):
    require_role(user, "maestro")
    from server import db
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # Maestro semilla protegido: nadie puede cambiar su rol/estado.
    if target.get("email", "").lower().strip() == _maestro_email():
        raise HTTPException(status_code=403, detail="El Maestro Supremo no puede modificarse")
    update = {}
    if data.role is not None:
        # Por API NUNCA se puede asignar rol 'maestro'. Sólo jugador o DJ.
        if data.role not in ("jugador", "director_de_juego"):
            raise HTTPException(status_code=400, detail="Sólo se puede asignar 'jugador' o 'director_de_juego'")
        update["role"] = data.role
    if data.status is not None:
        if data.status not in STATUSES:
            raise HTTPException(status_code=400, detail=f"Estado inválido. Usa uno de {STATUSES}")
        update["status"] = data.status
    if not update:
        raise HTTPException(status_code=400, detail="Nada que actualizar")
    res = await db.users.find_one_and_update(
        {"id": user_id},
        {"$set": update},
        return_document=True,
        projection={"_id": 0, "password_hash": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return _serialize_user(res)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_current_user)):
    require_role(user, "maestro")
    if user.get("id") == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    from server import db
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1})
    if target and target.get("email", "").lower().strip() == _maestro_email():
        raise HTTPException(status_code=403, detail="El Maestro Supremo no puede eliminarse")
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"ok": True}


# ===== Seed maestro on startup =====
async def seed_maestro(db):
    """
    Idempotent seeding. Reads MAESTRO_EMAIL / MAESTRO_NAME /
    MAESTRO_PASSWORD from env. If a user with that email exists,
    it is promoted to maestro/aprobado but the password is NOT
    overwritten (so an existing maestro can rotate their password
    via the UI without env changes resetting it).
    """
    email = (os.environ.get("MAESTRO_EMAIL", "") or "").lower().strip()
    if not email:
        return
    name = (os.environ.get("MAESTRO_NAME", "") or "Maestro").strip()
    password = os.environ.get("MAESTRO_PASSWORD", "")
    existing = await db.users.find_one({"email": email})
    if existing is None:
        if not password:
            return
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "name": name,
            "password_hash": hash_password(password),
            "role": "maestro",
            "status": "aprobado",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        await db.users.update_one(
            {"email": email},
            {"$set": {"role": "maestro", "status": "aprobado"}},
        )
    # Index for unique email
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("email", unique=True)
