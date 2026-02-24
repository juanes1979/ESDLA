"""
Test Rivers and Barriers API Endpoints
Tests CRUD operations for rivers and barriers/impassable lines feature on the Middle-earth map.
River types: vadeable (fordable), profundo (deep), infranqueable (impassable)
Barrier types: montana (mountain), acantilado (cliff), frontera (dark border)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRiversAPI:
    """Test Rivers CRUD operations"""
    
    created_river_id = None  # Store ID for cleanup
    
    def test_get_rivers_list(self):
        """GET /api/data/rivers - Should return list of rivers"""
        response = requests.get(f"{BASE_URL}/api/data/rivers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "rivers" in data, "Response should contain 'rivers' key"
        assert "total" in data, "Response should contain 'total' count"
        assert isinstance(data["rivers"], list), "rivers should be a list"
        assert data["total"] == len(data["rivers"]), "total should match rivers count"
        
        # Verify existing test data (per agent note: 2 rivers exist)
        if len(data["rivers"]) > 0:
            river = data["rivers"][0]
            assert "id" in river, "River should have 'id' field"
            assert "nombre" in river, "River should have 'nombre' field"
            assert "tipo" in river, "River should have 'tipo' field"
            assert "puntos" in river, "River should have 'puntos' array"
        
        print(f"PASS: GET /api/data/rivers - Found {data['total']} rivers")
    
    def test_get_existing_river(self):
        """GET /api/data/rivers/{id} - Should return specific river"""
        # First get the list to find an existing river
        list_response = requests.get(f"{BASE_URL}/api/data/rivers")
        assert list_response.status_code == 200
        rivers = list_response.json()["rivers"]
        
        if len(rivers) == 0:
            pytest.skip("No rivers exist to test GET by ID")
        
        river_id = rivers[0]["id"]
        response = requests.get(f"{BASE_URL}/api/data/rivers/{river_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["id"] == river_id, "Returned river ID should match requested ID"
        assert "nombre" in data, "River should have 'nombre' field"
        assert "tipo" in data, "River should have 'tipo' field"
        assert "puntos" in data, "River should have 'puntos' array"
        
        print(f"PASS: GET /api/data/rivers/{river_id} - Found '{data['nombre']}' ({data['tipo']})")
    
    def test_get_nonexistent_river(self):
        """GET /api/data/rivers/{id} - Should return 404 for nonexistent river"""
        response = requests.get(f"{BASE_URL}/api/data/rivers/nonexistent_river_id_12345")
        assert response.status_code == 404, f"Expected 404 for nonexistent river, got {response.status_code}"
        print("PASS: GET nonexistent river returns 404")
    
    def test_create_river_vadeable(self):
        """POST /api/data/rivers - Create a vadeable (fordable) river"""
        river_data = {
            "nombre": "TEST_Río de Prueba Vadeable",
            "tipo": "vadeable",
            "descripcion": "Río de prueba cruzable con montura",
            "puntos": [
                {"x": 10.5, "y": 20.3},
                {"x": 12.0, "y": 22.5},
                {"x": 14.2, "y": 24.8}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/data/rivers", json=river_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Created river should have 'id'"
        assert data["nombre"] == river_data["nombre"], "Name should match"
        assert data["tipo"] == "vadeable", "Type should be vadeable"
        assert len(data["puntos"]) == 3, "Should have 3 points"
        assert "created_at" in data, "Should have created_at timestamp"
        
        TestRiversAPI.created_river_id = data["id"]
        
        # Verify persistence with GET
        verify_response = requests.get(f"{BASE_URL}/api/data/rivers/{data['id']}")
        assert verify_response.status_code == 200, "Created river should be retrievable"
        
        print(f"PASS: POST /api/data/rivers - Created vadeable river '{data['nombre']}' with ID {data['id']}")
    
    def test_create_river_profundo(self):
        """POST /api/data/rivers - Create a profundo (deep) river"""
        river_data = {
            "nombre": "TEST_Río Profundo de Prueba",
            "tipo": "profundo",
            "descripcion": "Río profundo - solo nadando sin monturas",
            "puntos": [
                {"x": 30.0, "y": 40.0},
                {"x": 32.5, "y": 42.0}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/data/rivers", json=river_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["tipo"] == "profundo", "Type should be profundo"
        
        # Cleanup: delete the test river
        delete_response = requests.delete(f"{BASE_URL}/api/data/rivers/{data['id']}")
        assert delete_response.status_code == 200
        
        print(f"PASS: POST /api/data/rivers - Created profundo river and cleaned up")
    
    def test_create_river_infranqueable(self):
        """POST /api/data/rivers - Create an infranqueable (impassable) river"""
        river_data = {
            "nombre": "TEST_Río Infranqueable",
            "tipo": "infranqueable",
            "descripcion": "Río que solo puede cruzarse con puente o barcaza",
            "puntos": [
                {"x": 50.0, "y": 60.0},
                {"x": 55.0, "y": 65.0}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/data/rivers", json=river_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["tipo"] == "infranqueable", "Type should be infranqueable"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/rivers/{data['id']}")
        
        print(f"PASS: POST /api/data/rivers - Created infranqueable river")
    
    def test_update_river(self):
        """PUT /api/data/rivers/{id} - Update river name and type"""
        if not TestRiversAPI.created_river_id:
            pytest.skip("No river was created to update")
        
        river_id = TestRiversAPI.created_river_id
        update_data = {
            "nombre": "TEST_Río Actualizado",
            "tipo": "profundo"
        }
        
        response = requests.put(f"{BASE_URL}/api/data/rivers/{river_id}", json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["nombre"] == "TEST_Río Actualizado", "Name should be updated"
        assert data["tipo"] == "profundo", "Type should be updated"
        assert "updated_at" in data, "Should have updated_at timestamp"
        
        # Verify persistence with GET
        verify_response = requests.get(f"{BASE_URL}/api/data/rivers/{river_id}")
        verify_data = verify_response.json()
        assert verify_data["nombre"] == "TEST_Río Actualizado", "Update should persist"
        
        print(f"PASS: PUT /api/data/rivers/{river_id} - Updated river name and type")
    
    def test_update_nonexistent_river(self):
        """PUT /api/data/rivers/{id} - Should return 404 for nonexistent river"""
        response = requests.put(
            f"{BASE_URL}/api/data/rivers/nonexistent_12345",
            json={"nombre": "Should Fail"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: PUT nonexistent river returns 404")
    
    def test_delete_river(self):
        """DELETE /api/data/rivers/{id} - Delete test river"""
        if not TestRiversAPI.created_river_id:
            pytest.skip("No river was created to delete")
        
        river_id = TestRiversAPI.created_river_id
        
        response = requests.delete(f"{BASE_URL}/api/data/rivers/{river_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        
        # Verify deletion with GET
        verify_response = requests.get(f"{BASE_URL}/api/data/rivers/{river_id}")
        assert verify_response.status_code == 404, "Deleted river should return 404"
        
        TestRiversAPI.created_river_id = None
        print(f"PASS: DELETE /api/data/rivers/{river_id} - River deleted and verified")
    
    def test_delete_nonexistent_river(self):
        """DELETE /api/data/rivers/{id} - Should return 404 for nonexistent river"""
        response = requests.delete(f"{BASE_URL}/api/data/rivers/nonexistent_12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: DELETE nonexistent river returns 404")


class TestBarriersAPI:
    """Test Barriers (Impassable Lines) CRUD operations"""
    
    created_barrier_id = None
    
    def test_get_barriers_list(self):
        """GET /api/data/barriers - Should return list of barriers"""
        response = requests.get(f"{BASE_URL}/api/data/barriers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "barriers" in data, "Response should contain 'barriers' key"
        assert "total" in data, "Response should contain 'total' count"
        assert isinstance(data["barriers"], list), "barriers should be a list"
        
        # Verify existing test data (per agent note: 1 barrier exists)
        if len(data["barriers"]) > 0:
            barrier = data["barriers"][0]
            assert "id" in barrier, "Barrier should have 'id' field"
            assert "nombre" in barrier, "Barrier should have 'nombre' field"
            assert "tipo" in barrier, "Barrier should have 'tipo' field"
            assert "puntos" in barrier, "Barrier should have 'puntos' array"
        
        print(f"PASS: GET /api/data/barriers - Found {data['total']} barriers")
    
    def test_get_existing_barrier(self):
        """GET /api/data/barriers/{id} - Should return specific barrier"""
        list_response = requests.get(f"{BASE_URL}/api/data/barriers")
        barriers = list_response.json()["barriers"]
        
        if len(barriers) == 0:
            pytest.skip("No barriers exist to test GET by ID")
        
        barrier_id = barriers[0]["id"]
        response = requests.get(f"{BASE_URL}/api/data/barriers/{barrier_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["id"] == barrier_id, "Returned barrier ID should match"
        assert "nombre" in data
        assert "tipo" in data
        
        print(f"PASS: GET /api/data/barriers/{barrier_id} - Found '{data['nombre']}' ({data['tipo']})")
    
    def test_get_nonexistent_barrier(self):
        """GET /api/data/barriers/{id} - Should return 404"""
        response = requests.get(f"{BASE_URL}/api/data/barriers/nonexistent_barrier_12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: GET nonexistent barrier returns 404")
    
    def test_create_barrier_montana(self):
        """POST /api/data/barriers - Create mountain barrier"""
        barrier_data = {
            "nombre": "TEST_Montañas de Prueba",
            "tipo": "montana",
            "descripcion": "Cordillera infranqueable de prueba",
            "puntos": [
                {"x": 20.0, "y": 30.0},
                {"x": 22.0, "y": 35.0},
                {"x": 25.0, "y": 40.0}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/data/barriers", json=barrier_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["nombre"] == barrier_data["nombre"]
        assert data["tipo"] == "montana"
        assert len(data["puntos"]) == 3
        assert "created_at" in data
        
        TestBarriersAPI.created_barrier_id = data["id"]
        
        # Verify persistence
        verify_response = requests.get(f"{BASE_URL}/api/data/barriers/{data['id']}")
        assert verify_response.status_code == 200
        
        print(f"PASS: POST /api/data/barriers - Created montana barrier with ID {data['id']}")
    
    def test_create_barrier_acantilado(self):
        """POST /api/data/barriers - Create cliff barrier"""
        barrier_data = {
            "nombre": "TEST_Acantilado de Prueba",
            "tipo": "acantilado",
            "descripcion": "Pared vertical infranqueable",
            "puntos": [
                {"x": 40.0, "y": 50.0},
                {"x": 42.0, "y": 55.0}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/data/barriers", json=barrier_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["tipo"] == "acantilado"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/barriers/{data['id']}")
        
        print(f"PASS: POST /api/data/barriers - Created acantilado barrier")
    
    def test_create_barrier_frontera(self):
        """POST /api/data/barriers - Create dark border barrier"""
        barrier_data = {
            "nombre": "TEST_Frontera Oscura",
            "tipo": "frontera",
            "descripcion": "Barrera mágica peligrosa",
            "puntos": [
                {"x": 60.0, "y": 70.0},
                {"x": 65.0, "y": 75.0}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/data/barriers", json=barrier_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["tipo"] == "frontera"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/barriers/{data['id']}")
        
        print(f"PASS: POST /api/data/barriers - Created frontera barrier")
    
    def test_update_barrier(self):
        """PUT /api/data/barriers/{id} - Update barrier name and type"""
        if not TestBarriersAPI.created_barrier_id:
            pytest.skip("No barrier was created to update")
        
        barrier_id = TestBarriersAPI.created_barrier_id
        update_data = {
            "nombre": "TEST_Barrera Actualizada",
            "tipo": "acantilado"
        }
        
        response = requests.put(f"{BASE_URL}/api/data/barriers/{barrier_id}", json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["nombre"] == "TEST_Barrera Actualizada"
        assert data["tipo"] == "acantilado"
        assert "updated_at" in data
        
        # Verify persistence
        verify_response = requests.get(f"{BASE_URL}/api/data/barriers/{barrier_id}")
        verify_data = verify_response.json()
        assert verify_data["nombre"] == "TEST_Barrera Actualizada"
        
        print(f"PASS: PUT /api/data/barriers/{barrier_id} - Updated barrier")
    
    def test_update_nonexistent_barrier(self):
        """PUT /api/data/barriers/{id} - Should return 404"""
        response = requests.put(
            f"{BASE_URL}/api/data/barriers/nonexistent_12345",
            json={"nombre": "Should Fail"}
        )
        assert response.status_code == 404
        print("PASS: PUT nonexistent barrier returns 404")
    
    def test_delete_barrier(self):
        """DELETE /api/data/barriers/{id} - Delete test barrier"""
        if not TestBarriersAPI.created_barrier_id:
            pytest.skip("No barrier was created to delete")
        
        barrier_id = TestBarriersAPI.created_barrier_id
        
        response = requests.delete(f"{BASE_URL}/api/data/barriers/{barrier_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        
        # Verify deletion
        verify_response = requests.get(f"{BASE_URL}/api/data/barriers/{barrier_id}")
        assert verify_response.status_code == 404
        
        TestBarriersAPI.created_barrier_id = None
        print(f"PASS: DELETE /api/data/barriers/{barrier_id} - Barrier deleted")
    
    def test_delete_nonexistent_barrier(self):
        """DELETE /api/data/barriers/{id} - Should return 404"""
        response = requests.delete(f"{BASE_URL}/api/data/barriers/nonexistent_12345")
        assert response.status_code == 404
        print("PASS: DELETE nonexistent barrier returns 404")


class TestExistingRiversBarriers:
    """Verify existing test data matches expectations"""
    
    def test_verify_existing_rivers(self):
        """Verify the 2 existing rivers from agent notes"""
        response = requests.get(f"{BASE_URL}/api/data/rivers")
        assert response.status_code == 200
        
        rivers = response.json()["rivers"]
        river_names = [r["nombre"] for r in rivers]
        
        # According to agent notes: Río Anduin (profundo), Río Brandivino (vadeable)
        expected_rivers = {
            "Río Anduin": "profundo",
            "Río Brandivino": "vadeable"
        }
        
        for name, expected_type in expected_rivers.items():
            matching = [r for r in rivers if r["nombre"] == name]
            if matching:
                assert matching[0]["tipo"] == expected_type, f"{name} should be {expected_type}"
                print(f"PASS: Verified '{name}' exists with type '{expected_type}'")
            else:
                print(f"INFO: '{name}' not found in database (may have been deleted)")
    
    def test_verify_existing_barrier(self):
        """Verify the 1 existing barrier from agent notes"""
        response = requests.get(f"{BASE_URL}/api/data/barriers")
        assert response.status_code == 200
        
        barriers = response.json()["barriers"]
        
        # According to agent notes: Montañas Nubladas (montana)
        matching = [b for b in barriers if b["nombre"] == "Montañas Nubladas"]
        if matching:
            assert matching[0]["tipo"] == "montana", "Montañas Nubladas should be montana type"
            print(f"PASS: Verified 'Montañas Nubladas' exists with type 'montana'")
        else:
            print(f"INFO: 'Montañas Nubladas' not found (may have been deleted)")


# Cleanup fixture to run after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup any remaining TEST_ prefixed data after tests complete"""
    yield
    
    # Cleanup rivers
    try:
        rivers_response = requests.get(f"{BASE_URL}/api/data/rivers")
        if rivers_response.status_code == 200:
            for river in rivers_response.json()["rivers"]:
                if river["nombre"].startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/data/rivers/{river['id']}")
                    print(f"Cleaned up river: {river['nombre']}")
    except Exception as e:
        print(f"Cleanup error (rivers): {e}")
    
    # Cleanup barriers
    try:
        barriers_response = requests.get(f"{BASE_URL}/api/data/barriers")
        if barriers_response.status_code == 200:
            for barrier in barriers_response.json()["barriers"]:
                if barrier["nombre"].startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/data/barriers/{barrier['id']}")
                    print(f"Cleaned up barrier: {barrier['nombre']}")
    except Exception as e:
        print(f"Cleanup error (barriers): {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
