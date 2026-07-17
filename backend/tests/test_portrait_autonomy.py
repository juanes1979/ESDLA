"""
Backend tests for the portrait-autonomy feature (no AI credits).
Covers:
  - POST /api/portraits/prompt returns a Spanish prompt with expected content
  - POST /api/trading/npcs/portrait/upload-standalone returns retrato_file_id + image_base64
  - Login as Maestro works with the documented credentials
"""
import io
import os
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://lotr-campaign-hub-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MAESTRO_EMAIL = "elanillounico_tlotr@proton.me"
MAESTRO_PASSWORD = "123456"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": MAESTRO_EMAIL, "password": MAESTRO_PASSWORD, "remember_me": True},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token in login response: {r.json()}"
    return tok


class TestPortraitPrompt:
    """POST /api/portraits/prompt - autonomous prompt builder (no AI call)"""

    def test_prompt_returns_spanish_text(self):
        payload = {
            "nombre": "Aragorn de prueba",
            "cultura": "Dúnedain",
            "vocacion": "guerrero",
            "edad": 45,
            "genero": "hombre",
            "color_ojos": "grises",
            "color_pelo": "oscuro",
            "rasgos_faciales": "cicatriz en la ceja",
        }
        r = requests.post(f"{API}/portraits/prompt", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "prompt" in data
        prompt = data["prompt"]
        assert isinstance(prompt, str) and len(prompt) > 50
        # Spanish keywords expected
        low = prompt.lower()
        assert any(w in low for w in ["retrato", "lápiz", "tierra media", "blanco y negro"]), prompt
        # Occupation and personal traits included
        assert "cicatriz" in low
        assert "gris" in low  # ojos grises
        # Occupation-appropriate clothing (guerrero -> armadura)
        assert "armadura" in low or "guerrero" in low

    def test_prompt_hobbit_youth(self):
        payload = {
            "nombre": "Frodo test",
            "cultura": "Hobbit de la Comarca",
            "vocacion": "explorador",
            "edad": 20,
            "rasgos_faciales": "ojos grandes y curiosos",
        }
        r = requests.post(f"{API}/portraits/prompt", json=payload, timeout=30)
        assert r.status_code == 200
        p = r.json()["prompt"].lower()
        # hobbit description + explorador clothing (capa de montaraz)
        assert "hobbit" in p
        assert "montaraz" in p or "capa" in p or "viaje" in p


class TestNPCPortraitUploadStandalone:
    """POST /api/trading/npcs/portrait/upload-standalone"""

    def _tiny_png_bytes(self):
        # Minimal 1x1 PNG
        return base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        )

    def test_upload_returns_file_id_and_base64(self):
        content = self._tiny_png_bytes()
        files = {"file": ("test_portrait.png", io.BytesIO(content), "image/png")}
        r = requests.post(f"{API}/trading/npcs/portrait/upload-standalone", files=files, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "retrato_file_id" in data and isinstance(data["retrato_file_id"], str)
        assert len(data["retrato_file_id"]) > 5
        assert "image_base64" in data and len(data["image_base64"]) > 0

    def test_upload_rejects_non_image(self):
        files = {"file": ("bad.txt", io.BytesIO(b"hello"), "text/plain")}
        r = requests.post(f"{API}/trading/npcs/portrait/upload-standalone", files=files, timeout=30)
        assert r.status_code == 400

    def test_upload_rejects_empty(self):
        files = {"file": ("empty.png", io.BytesIO(b""), "image/png")}
        r = requests.post(f"{API}/trading/npcs/portrait/upload-standalone", files=files, timeout=30)
        assert r.status_code == 400


class TestMaestroLogin:
    def test_login_ok(self, token):
        assert isinstance(token, str) and len(token) > 10
