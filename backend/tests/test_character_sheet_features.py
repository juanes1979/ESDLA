"""
Tests for Character Sheet Page features
- Verifies weight-summary endpoint returns peso_total_montura (rider weight included)
- Verifies character has all required fields for UI sections
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test character ID from the review request
TEST_CHARACTER_ID = "c16a362d-9841-4954-8f70-0dfe02dfe303"


class TestCharacterSheetFeatures:
    """Test character sheet page features"""
    
    def test_character_exists(self):
        """Verify test character exists"""
        response = requests.get(f"{BASE_URL}/api/characters/{TEST_CHARACTER_ID}")
        assert response.status_code == 200, f"Character not found: {response.text}"
        data = response.json()
        assert data.get("nombre") == "Regred Maggot"
        print(f"SUCCESS: Character '{data['nombre']}' found")
    
    def test_physical_appearance_fields(self):
        """Verify character has physical appearance fields for Apariencia Física section"""
        response = requests.get(f"{BASE_URL}/api/characters/{TEST_CHARACTER_ID}")
        assert response.status_code == 200
        data = response.json()
        
        # Check all appearance fields
        assert data.get("ojos") is not None, "Missing 'ojos' field"
        assert data.get("piel") is not None, "Missing 'piel' field"
        assert data.get("pelo") is not None, "Missing 'pelo' field"
        assert data.get("tamano") is not None or data.get("tamanio") is not None, "Missing 'tamano/tamanio' field"
        assert data.get("nivel_vida") is not None, "Missing 'nivel_vida' field"
        
        print(f"SUCCESS: Physical appearance - Ojos: {data['ojos']}, Piel: {data['piel']}, Pelo: {data['pelo']}")
        print(f"  Tamaño: {data.get('tamano') or data.get('tamanio')}, Nivel de Vida: {data['nivel_vida']}")
    
    def test_personality_traits_fields(self):
        """Verify character has personality trait fields for Rasgos de Personalidad section"""
        response = requests.get(f"{BASE_URL}/api/characters/{TEST_CHARACTER_ID}")
        assert response.status_code == 200
        data = response.json()
        
        # Check distinctive traits (rasgos distintivos)
        rasgo1 = data.get("rasgo_distintivo")
        rasgo2 = data.get("rasgo_distintivo_2")
        
        # At least one trait should exist
        assert rasgo1 is not None or rasgo2 is not None, "Missing personality traits"
        
        if rasgo1:
            nombre1 = rasgo1.get("nombre") if isinstance(rasgo1, dict) else rasgo1
            print(f"SUCCESS: Rasgo distintivo 1: {nombre1}")
        if rasgo2:
            nombre2 = rasgo2.get("nombre") if isinstance(rasgo2, dict) else rasgo2
            print(f"SUCCESS: Rasgo distintivo 2: {nombre2}")
    
    def test_shadow_path_fields(self):
        """Verify character has shadow path fields for Senda de Sombra section"""
        response = requests.get(f"{BASE_URL}/api/characters/{TEST_CHARACTER_ID}")
        assert response.status_code == 200
        data = response.json()
        
        # Check senda de sombra fields
        senda = data.get("senda_sombra")
        senda_desc = data.get("senda_sombra_descripcion")
        
        print(f"Senda de Sombra: {senda}")
        print(f"Descripción: {senda_desc[:100] if senda_desc else 'None'}...")
        
        # These may be optional depending on character
        if senda:
            print(f"SUCCESS: Senda de Sombra found: {senda}")
    
    def test_background_history_fields(self):
        """Verify character has background/history fields for Trasfondo section"""
        response = requests.get(f"{BASE_URL}/api/characters/{TEST_CHARACTER_ID}")
        assert response.status_code == 200
        data = response.json()
        
        # Check trasfondo fields
        assert data.get("trasfondo_nombre") is not None, "Missing 'trasfondo_nombre'"
        
        # Historia can come from multiple sources
        historia = data.get("historia") or data.get("descripcion_trasfondo")
        print(f"SUCCESS: Trasfondo: {data['trasfondo_nombre']}")
        if historia:
            print(f"  Historia Personal: {historia[:100]}...")
    
    def test_virtue_fields(self):
        """Verify character has virtue fields for Virtud section"""
        response = requests.get(f"{BASE_URL}/api/characters/{TEST_CHARACTER_ID}")
        assert response.status_code == 200
        data = response.json()
        
        virtud = data.get("virtud_nombre")
        virtud_rasgos = data.get("virtud_rasgos") or data.get("virtud_descripcion")
        
        if virtud:
            print(f"SUCCESS: Virtud: {virtud}")
            if virtud_rasgos:
                print(f"  Descripción: {virtud_rasgos[:100]}...")
        else:
            print("INFO: No virtud set for this character (may be optional)")


class TestWeightSummaryEndpoint:
    """Test the weight-summary endpoint for mount weight calculations"""
    
    def test_weight_summary_returns_200(self):
        """Verify weight-summary endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/characters/{TEST_CHARACTER_ID}/weight-summary")
        assert response.status_code == 200, f"Weight summary failed: {response.text}"
        print("SUCCESS: weight-summary endpoint returns 200")
    
    def test_weight_summary_contains_peso_total_montura(self):
        """Verify weight summary includes peso_total_montura (rider + equipment)"""
        response = requests.get(f"{BASE_URL}/api/characters/{TEST_CHARACTER_ID}/weight-summary")
        assert response.status_code == 200
        data = response.json()
        
        # Check for the new field
        assert "peso_total_montura" in data, "Missing 'peso_total_montura' field in response"
        assert "peso_corporal" in data, "Missing 'peso_corporal' field in response"
        
        print(f"SUCCESS: peso_total_montura = {data['peso_total_montura']}")
        print(f"  peso_corporal (rider) = {data['peso_corporal']}")
        print(f"  peso_montura (equipment) = {data.get('peso_montura', 0)}")
    
    def test_peso_total_montura_calculation(self):
        """Verify peso_total_montura = peso_montura + peso_corporal"""
        response = requests.get(f"{BASE_URL}/api/characters/{TEST_CHARACTER_ID}/weight-summary")
        assert response.status_code == 200
        data = response.json()
        
        peso_corporal = float(data.get("peso_corporal", 0))
        peso_montura = float(data.get("peso_montura", 0))  # Equipment on mount
        peso_total_montura = float(data.get("peso_total_montura", 0))
        
        # Verify calculation: total = rider body weight + equipment on mount
        expected = round(peso_corporal + peso_montura, 2)
        actual = round(peso_total_montura, 2)
        
        assert abs(expected - actual) < 0.1, f"Calculation mismatch: expected {expected}, got {actual}"
        print(f"SUCCESS: peso_total_montura ({actual}) = peso_corporal ({peso_corporal}) + peso_montura ({peso_montura})")
    
    def test_weight_summary_all_fields(self):
        """Verify all expected fields are present in weight summary"""
        response = requests.get(f"{BASE_URL}/api/characters/{TEST_CHARACTER_ID}/weight-summary")
        assert response.status_code == 200
        data = response.json()
        
        expected_fields = [
            "peso_personaje",
            "peso_montura",
            "peso_corporal",
            "peso_total_montura",
            "capacidad_personaje",
            "limite_cargado",
            "limite_muy_cargado",
            "estado_carga",
            "tiene_montura",
            "nombre_montura",
            "capacidad_montura",
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print("SUCCESS: All expected fields present in weight-summary response")
        print(f"  Mount: {data['nombre_montura']} (capacity: {data['capacidad_montura']} kg)")
        print(f"  Estado carga: {data['estado_carga']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
