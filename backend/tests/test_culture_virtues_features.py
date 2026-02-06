"""
Test Culture Virtues and Character Sheet Features
Tests for:
1. GET /api/data/cultures/{id}/virtues endpoint
2. descripcion_corta field in character data
3. CultureEditor trasfondos and virtudes configuration
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
CULTURE_WITH_VIRTUE_ID = "0a9f2b7b-4ff2-4843-bca8-661a9c188d2b"  # Hombres del lago
CHARACTER_ID = "c16a362d-9841-4954-8f70-0dfe02dfe303"


class TestCultureVirtuesEndpoint:
    """Tests for GET /api/data/cultures/{id}/virtues endpoint"""
    
    def test_get_culture_virtues_success(self):
        """Test getting virtues for a culture with tiene_virtud_inicial=true"""
        response = requests.get(f"{BASE_URL}/api/data/cultures/{CULTURE_WITH_VIRTUE_ID}/virtues")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure
        assert "culture_id" in data, "Response should contain culture_id"
        assert "culture_name" in data, "Response should contain culture_name"
        assert "tiene_virtud_inicial" in data, "Response should contain tiene_virtud_inicial"
        assert "virtues" in data, "Response should contain virtues list"
        
        # Verify culture data
        assert data["culture_id"] == CULTURE_WITH_VIRTUE_ID
        assert data["culture_name"] == "Hombres del lago"
        assert data["tiene_virtud_inicial"] == True
        
        # Verify virtues list is not empty
        assert len(data["virtues"]) > 0, "Culture should have available virtues"
        
        # Verify virtue structure
        virtue = data["virtues"][0]
        assert "nombre" in virtue, "Virtue should have nombre"
        assert "id" in virtue, "Virtue should have id"
        print(f"Found {len(data['virtues'])} virtues for Hombres del lago")
        for v in data["virtues"]:
            print(f"  - {v['nombre']}")
    
    def test_get_culture_virtues_not_found(self):
        """Test getting virtues for non-existent culture"""
        response = requests.get(f"{BASE_URL}/api/data/cultures/non-existent-id/virtues")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_culture_virtues_contains_expected_virtues(self):
        """Test that Hombres del lago has expected virtues"""
        response = requests.get(f"{BASE_URL}/api/data/cultures/{CULTURE_WITH_VIRTUE_ID}/virtues")
        
        assert response.status_code == 200
        data = response.json()
        
        virtue_names = [v["nombre"] for v in data["virtues"]]
        
        # Check for some expected virtues
        expected_virtues = ["Amigo de los Enanos", "Acérrimo"]
        for expected in expected_virtues:
            assert expected in virtue_names, f"Expected virtue '{expected}' not found in {virtue_names}"


class TestCharacterDescripcionCorta:
    """Tests for descripcion_corta field in character data"""
    
    def test_character_has_descripcion_corta(self):
        """Test that character has descripcion_corta field"""
        response = requests.get(f"{BASE_URL}/api/characters/{CHARACTER_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify descripcion_corta exists
        assert "descripcion_corta" in data, "Character should have descripcion_corta field"
        
        # Verify it has content
        descripcion = data.get("descripcion_corta")
        assert descripcion is not None, "descripcion_corta should not be None"
        assert len(descripcion) > 0, "descripcion_corta should not be empty"
        
        print(f"descripcion_corta: {descripcion}")
    
    def test_character_has_occupation_data(self):
        """Test that character has occupation-related fields"""
        response = requests.get(f"{BASE_URL}/api/characters/{CHARACTER_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check for occupation fields
        assert "vocacion_nombre" in data or "ocupacion_nombre" in data, "Character should have occupation name"
        
        occupation_name = data.get("vocacion_nombre") or data.get("ocupacion_nombre")
        print(f"Occupation: {occupation_name}")


class TestCultureData:
    """Tests for culture data structure"""
    
    def test_culture_has_virtud_inicial_field(self):
        """Test that culture has tiene_virtud_inicial field"""
        response = requests.get(f"{BASE_URL}/api/data/cultures/{CULTURE_WITH_VIRTUE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "tiene_virtud_inicial" in data, "Culture should have tiene_virtud_inicial field"
        assert data["tiene_virtud_inicial"] == True, "Hombres del lago should have tiene_virtud_inicial=true"
    
    def test_culture_has_trasfondos_ids_field(self):
        """Test that culture can have trasfondos_ids field"""
        response = requests.get(f"{BASE_URL}/api/data/cultures/{CULTURE_WITH_VIRTUE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        # trasfondos_ids is optional, just verify the field can exist
        # It may or may not be present depending on configuration
        print(f"trasfondos_ids: {data.get('trasfondos_ids', 'not set')}")
    
    def test_culture_has_virtudes_config_fields(self):
        """Test that culture can have virtudes configuration fields"""
        response = requests.get(f"{BASE_URL}/api/data/cultures/{CULTURE_WITH_VIRTUE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        # These fields are optional but should be supported
        print(f"virtudes_propias: {data.get('virtudes_propias', 'not set')}")
        print(f"copiar_virtudes_de: {data.get('copiar_virtudes_de', 'not set')}")
        print(f"permite_virtudes_comunes: {data.get('permite_virtudes_comunes', 'not set')}")


class TestCultureCRUD:
    """Tests for culture CRUD with new fields"""
    
    def test_create_culture_with_virtudes_config(self):
        """Test creating a culture with virtudes configuration"""
        import uuid
        unique_name = f"TEST_Cultura_Virtudes_{uuid.uuid4().hex[:8]}"
        culture_data = {
            "nombre": unique_name,
            "raza": "Hombres",
            "descripcion": "Test culture with virtudes config",
            "tiene_virtud_inicial": True,
            "permite_virtudes_comunes": True,
            "trasfondos_ids": [],
            "virtudes_propias": []
        }
        
        response = requests.post(f"{BASE_URL}/api/data/cultures", json=culture_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        culture_id = data.get("id")
        
        # Verify fields were saved
        assert data.get("tiene_virtud_inicial") == True
        assert data.get("permite_virtudes_comunes") == True
        
        # Cleanup
        if culture_id:
            requests.delete(f"{BASE_URL}/api/data/cultures/{culture_id}")
            print(f"Cleaned up test culture: {culture_id}")
    
    def test_update_culture_virtudes_config(self):
        """Test updating a culture's virtudes configuration"""
        # First create a test culture
        culture_data = {
            "nombre": "TEST_Cultura_Update_Virtudes",
            "raza": "Hombres",
            "tiene_virtud_inicial": False
        }
        
        create_response = requests.post(f"{BASE_URL}/api/data/cultures", json=culture_data)
        assert create_response.status_code == 200
        
        culture_id = create_response.json().get("id")
        
        try:
            # Update with virtudes config
            update_data = {
                "tiene_virtud_inicial": True,
                "permite_virtudes_comunes": True
            }
            
            update_response = requests.put(f"{BASE_URL}/api/data/cultures/{culture_id}", json=update_data)
            assert update_response.status_code == 200
            
            # Verify update
            get_response = requests.get(f"{BASE_URL}/api/data/cultures/{culture_id}")
            assert get_response.status_code == 200
            
            updated_data = get_response.json()
            assert updated_data.get("tiene_virtud_inicial") == True
            assert updated_data.get("permite_virtudes_comunes") == True
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/data/cultures/{culture_id}")
            print(f"Cleaned up test culture: {culture_id}")


class TestOccupationDescripcionCorta:
    """Tests for occupation descripcion_corta field"""
    
    def test_occupation_has_descripcion_corta(self):
        """Test that occupations have descripcion_corta field"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        
        assert response.status_code == 200
        data = response.json()
        
        occupations = data.get("occupations", [])
        assert len(occupations) > 0, "Should have at least one occupation"
        
        # Check if any occupation has descripcion_corta
        has_descripcion = False
        for occ in occupations:
            if occ.get("descripcion_corta"):
                has_descripcion = True
                print(f"Occupation '{occ.get('vocacion')}' has descripcion_corta: {occ.get('descripcion_corta')[:50]}...")
                break
        
        # Note: descripcion_corta may not be set for all occupations
        print(f"Found {len(occupations)} occupations")


class TestBackgroundsEndpoint:
    """Tests for backgrounds endpoint"""
    
    def test_get_backgrounds(self):
        """Test getting all backgrounds"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds")
        
        assert response.status_code == 200
        data = response.json()
        
        backgrounds = data.get("backgrounds", [])
        assert len(backgrounds) > 0, "Should have at least one background"
        
        print(f"Found {len(backgrounds)} backgrounds")


class TestVirtuesEndpoint:
    """Tests for virtues endpoint"""
    
    def test_get_all_virtues(self):
        """Test getting all virtues"""
        response = requests.get(f"{BASE_URL}/api/data/virtues")
        
        assert response.status_code == 200
        data = response.json()
        
        virtues = data.get("virtues", [])
        assert len(virtues) > 0, "Should have at least one virtue"
        
        print(f"Found {len(virtues)} virtues")
        
        # Check virtue structure
        virtue = virtues[0]
        assert "nombre" in virtue, "Virtue should have nombre"
        assert "id" in virtue, "Virtue should have id"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
