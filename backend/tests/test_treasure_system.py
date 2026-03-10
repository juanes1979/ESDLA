"""
Test Suite for LOTR 5e RPG Treasure System
Tests the DM Treasure Index API and related endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTreasureIndexAPI:
    """Tests for GET/PUT /api/data/treasure-index"""
    
    def test_get_treasure_index_empty(self):
        """Test GET treasure index returns items array"""
        response = requests.get(f"{BASE_URL}/api/data/treasure-index")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        print(f"✓ GET treasure-index returns items: {len(data['items'])} items")
    
    def test_put_treasure_index_add_weapon(self):
        """Test PUT treasure index - add a famous weapon"""
        # Get current index
        get_response = requests.get(f"{BASE_URL}/api/data/treasure-index")
        current_items = get_response.json().get("items", [])
        
        # Create a test weapon
        test_weapon = {
            "id": f"test_weapon_{uuid.uuid4().hex[:8]}",
            "nombre": "TEST_Glamdring",
            "tipo": "arma",
            "manufactura": "elven_beleriand",
            "cualidades": ["afilada_elfica", "luminiscencia"],
            "perdiciones": ["orcs"],
            "historia": "La espada del Rey Turgon de Gondolin",
            "precioBase": 500,
            "precio": 2200,
            "createdAt": "2026-01-01T00:00:00Z"
        }
        
        # Add weapon to index
        new_items = current_items + [test_weapon]
        put_response = requests.put(
            f"{BASE_URL}/api/data/treasure-index",
            json={"items": new_items}
        )
        assert put_response.status_code == 200
        print(f"✓ PUT treasure-index successful: {put_response.json()}")
        
        # Verify weapon was added
        verify_response = requests.get(f"{BASE_URL}/api/data/treasure-index")
        verify_items = verify_response.json().get("items", [])
        
        # Find test weapon
        found = any(item.get("nombre") == "TEST_Glamdring" for item in verify_items)
        assert found, "Test weapon should be in index after PUT"
        print(f"✓ Verified weapon persisted in index")
        
    def test_put_treasure_index_add_armor(self):
        """Test PUT treasure index - add famous armor"""
        # Get current index
        get_response = requests.get(f"{BASE_URL}/api/data/treasure-index")
        current_items = get_response.json().get("items", [])
        
        # Create test armor
        test_armor = {
            "id": f"test_armor_{uuid.uuid4().hex[:8]}",
            "nombre": "TEST_Camisote de Mithril",
            "tipo": "armadura",
            "manufactura": "dwarven_khazad",
            "cualidades": ["armadura_mithril"],
            "perdiciones": [],
            "historia": "Forjada en Khazad-dûm antes de su caída",
            "precioBase": 1000,
            "precio": 3000,
            "createdAt": "2026-01-01T00:00:00Z"
        }
        
        new_items = current_items + [test_armor]
        put_response = requests.put(
            f"{BASE_URL}/api/data/treasure-index",
            json={"items": new_items}
        )
        assert put_response.status_code == 200
        print(f"✓ PUT treasure-index armor successful")
        
    def test_put_treasure_index_add_shield(self):
        """Test PUT treasure index - add famous shield"""
        get_response = requests.get(f"{BASE_URL}/api/data/treasure-index")
        current_items = get_response.json().get("items", [])
        
        test_shield = {
            "id": f"test_shield_{uuid.uuid4().hex[:8]}",
            "nombre": "TEST_Escudo de Oesternesse",
            "tipo": "escudo",
            "manufactura": "numenorean",
            "cualidades": ["reforzado_mayor_numenoreano"],
            "perdiciones": [],
            "historia": "Portado por un guardián de la Torre de Amon Sûl",
            "precioBase": 200,
            "precio": 1700,
            "createdAt": "2026-01-01T00:00:00Z"
        }
        
        new_items = current_items + [test_shield]
        put_response = requests.put(
            f"{BASE_URL}/api/data/treasure-index",
            json={"items": new_items}
        )
        assert put_response.status_code == 200
        print(f"✓ PUT treasure-index shield successful")
    
    def test_put_treasure_index_remove_item(self):
        """Test removing items from treasure index"""
        # Get current index
        get_response = requests.get(f"{BASE_URL}/api/data/treasure-index")
        current_items = get_response.json().get("items", [])
        
        # Filter out TEST_ items
        filtered_items = [item for item in current_items if not item.get("nombre", "").startswith("TEST_")]
        
        put_response = requests.put(
            f"{BASE_URL}/api/data/treasure-index",
            json={"items": filtered_items}
        )
        assert put_response.status_code == 200
        
        # Verify items were removed
        verify_response = requests.get(f"{BASE_URL}/api/data/treasure-index")
        verify_items = verify_response.json().get("items", [])
        
        test_items = [item for item in verify_items if item.get("nombre", "").startswith("TEST_")]
        assert len(test_items) == 0, "TEST_ items should be removed after PUT"
        print(f"✓ TEST items cleaned up from index")
        
    def test_treasure_index_data_structure(self):
        """Test that treasure index items have correct structure"""
        # Add a complete test item to verify structure
        get_response = requests.get(f"{BASE_URL}/api/data/treasure-index")
        current_items = get_response.json().get("items", [])
        
        complete_item = {
            "id": f"test_complete_{uuid.uuid4().hex[:8]}",
            "nombre": "TEST_Anduril",
            "tipo": "arma",
            "manufactura": "elven_beleriand",
            "cualidades": ["afilada_elfica", "cruel_mayor_elfica"],
            "perdiciones": ["orcs", "all_evil"],
            "historia": "La llama del oeste, reforjada de los fragmentos de Narsil",
            "precioBase": 1000,
            "precio": 5500,
            "createdAt": "2026-01-01T00:00:00Z"
        }
        
        new_items = current_items + [complete_item]
        requests.put(f"{BASE_URL}/api/data/treasure-index", json={"items": new_items})
        
        # Verify
        verify_response = requests.get(f"{BASE_URL}/api/data/treasure-index")
        verify_items = verify_response.json().get("items", [])
        
        found_item = next((item for item in verify_items if item.get("nombre") == "TEST_Anduril"), None)
        assert found_item is not None, "Test item should exist"
        
        # Check structure
        assert found_item.get("id") is not None
        assert found_item.get("tipo") == "arma"
        assert found_item.get("manufactura") == "elven_beleriand"
        assert isinstance(found_item.get("cualidades"), list)
        assert isinstance(found_item.get("perdiciones"), list)
        assert found_item.get("historia") is not None
        print(f"✓ Item structure verified correctly")
        
        # Cleanup
        filtered = [item for item in verify_items if not item.get("nombre", "").startswith("TEST_")]
        requests.put(f"{BASE_URL}/api/data/treasure-index", json={"items": filtered})


class TestRecompensasAPI:
    """Tests for rewards/mejoras API - relevant for treasure quality costs"""
    
    def test_get_recompensas(self):
        """Test GET recompensas endpoint"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        assert response.status_code == 200
        data = response.json()
        # Should have mejoras for equipment rewards
        print(f"✓ GET recompensas returns: {list(data.keys())}")
        
    def test_get_mejoras_for_weapon(self):
        """Test GET mejoras filtered for weapon type"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas/mejoras?tipo_equipo=arma")
        assert response.status_code == 200
        data = response.json()
        assert "mejoras" in data
        print(f"✓ GET mejoras for 'arma': {len(data.get('mejoras', []))} entries")
        
    def test_get_mejoras_for_armor(self):
        """Test GET mejoras filtered for armor type"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas/mejoras?tipo_equipo=armadura")
        assert response.status_code == 200
        data = response.json()
        assert "mejoras" in data
        print(f"✓ GET mejoras for 'armadura': {len(data.get('mejoras', []))} entries")
        
    def test_get_mejoras_for_shield(self):
        """Test GET mejoras filtered for shield type"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas/mejoras?tipo_equipo=escudo")
        assert response.status_code == 200
        data = response.json()
        assert "mejoras" in data
        print(f"✓ GET mejoras for 'escudo': {len(data.get('mejoras', []))} entries")


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup any TEST_ prefixed items after all tests"""
    yield
    # Post-test cleanup
    try:
        response = requests.get(f"{BASE_URL}/api/data/treasure-index")
        if response.status_code == 200:
            items = response.json().get("items", [])
            filtered = [item for item in items if not item.get("nombre", "").startswith("TEST_")]
            requests.put(f"{BASE_URL}/api/data/treasure-index", json={"items": filtered})
            print("✓ Cleaned up TEST_ items from treasure index")
    except Exception as e:
        print(f"Warning: Cleanup failed: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
