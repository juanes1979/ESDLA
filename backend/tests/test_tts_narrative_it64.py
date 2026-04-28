"""Iter 64 — TTS narrador clásico /api/travel/tts/narrative tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL') or open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split('\n')[0].strip()
BASE_URL = BASE_URL.rstrip('/')
TTS_URL = f"{BASE_URL}/api/travel/tts/narrative"


def test_tts_short_spanish_text():
    """TTS-1: texto corto en español devuelve audio_base64 > 50000 chars."""
    payload = {
        "text": "En las brumas del amanecer, la compañía emprendió su viaje hacia Rivendel."
    }
    r = requests.post(TTS_URL, json=payload, timeout=120)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
    data = r.json()
    assert data.get("success") is True, f"success!=true: {data}"
    assert "audio_base64" in data
    assert len(data["audio_base64"]) > 50000, f"audio too small: {len(data['audio_base64'])}"
    assert data.get("mime") == "audio/mp3"
    assert data.get("voice") == "onyx"
    assert data.get("model") == "tts-1-hd"
    assert isinstance(data.get("chars"), int) and data["chars"] > 0


def test_tts_empty_text():
    """Texto vacío → success: false."""
    r = requests.post(TTS_URL, json={"text": ""}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is False
    assert "error" in data


def test_tts_whitespace_text():
    """Texto sólo whitespace → success: false."""
    r = requests.post(TTS_URL, json={"text": "    \n\t  "}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is False


def test_tts_custom_voice():
    """Voz custom se respeta en respuesta."""
    payload = {"text": "Frodo y Sam cruzaron el río.", "voice": "echo", "model": "tts-1"}
    r = requests.post(TTS_URL, json=payload, timeout=120)
    assert r.status_code == 200
    data = r.json()
    if data.get("success"):
        assert data.get("voice") == "echo"
        assert data.get("model") == "tts-1"


def test_tts_truncation():
    """Texto > 4000 chars se trunca al último punto antes de 4000."""
    # Construir texto con varias frases que sumen >4000 chars
    sentence = "Frodo cruzó el río y siguió caminando con Sam por las colinas del Anduin sin descanso. "
    big_text = sentence * 60  # ~ 60 * 90 ≈ 5400 chars
    assert len(big_text) > 4000
    r = requests.post(TTS_URL, json={"text": big_text}, timeout=180)
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True
    assert data["chars"] <= 4001  # ≤ max_chars (con punto incluido)
