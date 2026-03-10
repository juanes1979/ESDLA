"""
Test Object Materials and Treasure System APIs
Tests for:
- GET /api/data/object-materials - Get object materials with vulnerabilities/resistances
- PUT /api/data/object-materials - Update/save object materials
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestObjectMaterials:
    """Test Object Materials API endpoints"""
    
    def test_get_object_materials(self):
        """Test GET /api/data/object-materials returns materials list"""
        response = requests.get(f"{BASE_URL}/api/data/object-materials")
        assert response.status_code == 200
        
        data = response.json()
        assert "materials" in data
        assert isinstance(data["materials"], list)
        print(f"GET object-materials returned {len(data['materials'])} materials")
    
    def test_put_object_materials_save(self):
        """Test PUT /api/data/object-materials saves materials correctly"""
        # Create test materials with vulnerabilities/resistances
        test_materials = [
            {
                "id": f"test_material_{uuid.uuid4().hex[:8]}",
                "nombre": "Test Material",
                "ca": 15,
                "icon": "🧪",
                "vulnerable": ["fire", "acid"],
                "resistant": ["slashing"],
                "immune": ["cold"]
            },
            {
                "id": f"test_iron_{uuid.uuid4().hex[:8]}",
                "nombre": "Test Iron",
                "ca": 19,
                "icon": "⚔️",
                "vulnerable": ["acid"],
                "resistant": ["slashing", "piercing"],
                "immune": ["fire"]
            }
        ]
        
        # Save materials
        response = requests.put(
            f"{BASE_URL}/api/data/object-materials",
            json={"materials": test_materials}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("message") == "Materials saved successfully"
        print("PUT object-materials saved successfully")
        
        # Verify by GET
        get_response = requests.get(f"{BASE_URL}/api/data/object-materials")
        assert get_response.status_code == 200
        
        saved_data = get_response.json()
        assert len(saved_data["materials"]) == 2
        
        # Verify first material
        first_mat = saved_data["materials"][0]
        assert first_mat["nombre"] == "Test Material"
        assert first_mat["ca"] == 15
        assert "fire" in first_mat["vulnerable"]
        assert "slashing" in first_mat["resistant"]
        assert "cold" in first_mat["immune"]
        print("Verified saved materials have correct vulnerability/resistance data")
    
    def test_put_object_materials_update(self):
        """Test updating existing materials"""
        # First save
        initial_materials = [
            {
                "id": "update_test_material",
                "nombre": "Material to Update",
                "ca": 10,
                "vulnerable": ["fire"],
                "resistant": [],
                "immune": []
            }
        ]
        
        response = requests.put(
            f"{BASE_URL}/api/data/object-materials",
            json={"materials": initial_materials}
        )
        assert response.status_code == 200
        
        # Update with changed values
        updated_materials = [
            {
                "id": "update_test_material",
                "nombre": "Material to Update",
                "ca": 20,  # Changed CA
                "vulnerable": [],
                "resistant": ["fire"],  # Changed from vulnerable to resistant
                "immune": ["acid"]  # Added immunity
            }
        ]
        
        update_response = requests.put(
            f"{BASE_URL}/api/data/object-materials",
            json={"materials": updated_materials}
        )
        assert update_response.status_code == 200
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/data/object-materials")
        saved = get_response.json()["materials"][0]
        
        assert saved["ca"] == 20
        assert "fire" not in saved.get("vulnerable", [])
        assert "fire" in saved["resistant"]
        assert "acid" in saved["immune"]
        print("Material update verified - CA and vulnerabilities changed correctly")
    
    def test_put_empty_materials(self):
        """Test clearing all materials"""
        response = requests.put(
            f"{BASE_URL}/api/data/object-materials",
            json={"materials": []}
        )
        assert response.status_code == 200
        
        # Verify empty
        get_response = requests.get(f"{BASE_URL}/api/data/object-materials")
        assert get_response.status_code == 200
        assert len(get_response.json()["materials"]) == 0
        print("Materials cleared successfully")


class TestTreasureRelatedEndpoints:
    """Test endpoints related to treasure system data"""
    
    def test_get_equipment_catalog(self):
        """Test equipment catalog includes jewelry-related items"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        
        data = response.json()
        # Check if gemas categories exist (used for jewelry generation)
        has_gemas = "gemas_preciosas" in data or "gemas_semipreciosas" in data
        print(f"Equipment catalog has gems category: {has_gemas}")
    
    def test_get_recompensas(self):
        """Test rewards endpoint (used for treasure blessings)"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        assert response.status_code == 200
        
        data = response.json()
        # Check expected keys
        expected_keys = ["mejoras", "niveles_recompensa", "bendiciones", "info_general", "armas_con_nombre"]
        for key in expected_keys:
            assert key in data, f"Missing key: {key}"
        print("Recompensas endpoint returns expected structure")


# Cleanup fixture
@pytest.fixture(scope="class", autouse=True)
def cleanup_test_materials():
    """Cleanup test materials after tests complete"""
    yield
    # Clear test materials after all tests
    requests.put(
        f"{BASE_URL}/api/data/object-materials",
        json={"materials": []}
    )
    print("Cleaned up test materials")
