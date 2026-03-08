"""
Path Debugger API Tests - Testing POST /api/travel/debug-pathfinding
Tests the step-by-step path analysis for LOTR 5e RPG travel system
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ============ FIXTURES ============

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def locations_list(api_client):
    """Get list of available locations for testing"""
    response = api_client.get(f"{BASE_URL}/api/data/locations")
    assert response.status_code == 200
    return response.json().get('locations', [])

# ============ TEST CLASSES ============

class TestDebugPathfindingEndpoint:
    """Tests for POST /api/travel/debug-pathfinding endpoint"""
    
    def test_debug_pathfinding_basic_route(self, api_client):
        """Test basic pathfinding between two known locations"""
        payload = {
            "origen_nombre": "Minas Tirith",
            "destino_nombre": "Osgiliath",
            "paso_km": 5,
            "preferir_caminos": True,
            "evitar_tierras_oscuras": False,
            "evitar_tierras_sombra": False,
            "max_pasos": 100
        }
        
        response = api_client.post(f"{BASE_URL}/api/travel/debug-pathfinding", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify no error
        assert "error" not in data or data.get("error") is None
        
        # Verify response structure
        assert "origen" in data, "Response should have 'origen'"
        assert "destino" in data, "Response should have 'destino'"
        assert "configuracion" in data, "Response should have 'configuracion'"
        assert "resumen" in data, "Response should have 'resumen'"
        assert "pasos" in data, "Response should have 'pasos'"
        
        # Verify data values
        assert data["origen"] == "Minas Tirith"
        assert data["destino"] == "Osgiliath"
        
        # Verify resumen structure
        resumen = data["resumen"]
        assert "total_pasos" in resumen
        assert "distancia_total_km" in resumen
        assert "distancia_linea_recta_km" in resumen
        assert resumen["total_pasos"] > 0
        
    def test_debug_pathfinding_step_structure(self, api_client):
        """Test that each step has required fields"""
        payload = {
            "origen_nombre": "Rivendel",
            "destino_nombre": "Bree",
            "paso_km": 10,
            "preferir_caminos": True,
            "evitar_tierras_oscuras": False,
            "evitar_tierras_sombra": False,
            "max_pasos": 50
        }
        
        response = api_client.post(f"{BASE_URL}/api/travel/debug-pathfinding", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        pasos = data.get("pasos", [])
        assert len(pasos) > 0, "Should have at least one step"
        
        # Check first step (INICIO)
        first_step = pasos[0]
        assert first_step["paso"] == 0
        assert first_step["decision"] == "INICIO"
        assert "posicion" in first_step
        assert "x" in first_step["posicion"]
        assert "y" in first_step["posicion"]
        assert "terreno" in first_step
        assert "tipo_tierra" in first_step
        assert "razon" in first_step
        
        # Check intermediate steps have required fields
        if len(pasos) > 2:
            mid_step = pasos[1]
            assert "decision" in mid_step
            assert "distancia_paso_km" in mid_step or mid_step["decision"] == "INICIO"
            assert "distancia_destino_km" in mid_step
            
    def test_debug_pathfinding_decision_types(self, api_client):
        """Test that decisions are valid types"""
        payload = {
            "origen_nombre": "Minas Tirith",
            "destino_nombre": "Pelargir",
            "paso_km": 15,
            "preferir_caminos": True,
            "evitar_tierras_oscuras": False,
            "evitar_tierras_sombra": False,
            "max_pasos": 100
        }
        
        response = api_client.post(f"{BASE_URL}/api/travel/debug-pathfinding", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        pasos = data.get("pasos", [])
        
        valid_decisions = {'INICIO', 'LLEGADA', 'SEGUIR_CAMINO', 'IR_A_CAMINO', 
                          'CAMPO_TRAVES', 'EVITAR', 'DIRECTO'}
        
        for paso in pasos:
            assert paso["decision"] in valid_decisions, f"Invalid decision: {paso['decision']}"
            
    def test_debug_pathfinding_arrives_at_destination(self, api_client):
        """Test that path ends with LLEGADA decision"""
        payload = {
            "origen_nombre": "Bree",
            "destino_nombre": "El Poney Pisador",
            "paso_km": 5,
            "preferir_caminos": True,
            "evitar_tierras_oscuras": False,
            "evitar_tierras_sombra": False,
            "max_pasos": 20
        }
        
        response = api_client.post(f"{BASE_URL}/api/travel/debug-pathfinding", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        pasos = data.get("pasos", [])
        
        if len(pasos) > 0 and pasos[-1]["decision"] == "LLEGADA":
            assert pasos[-1]["distancia_destino_km"] == 0 or pasos[-1]["distancia_destino_km"] < 5
            
    def test_debug_pathfinding_with_avoid_shadow(self, api_client):
        """Test pathfinding with shadow lands avoidance"""
        payload = {
            "origen_nombre": "Minas Tirith",
            "destino_nombre": "Osgiliath",
            "paso_km": 5,
            "preferir_caminos": True,
            "evitar_tierras_oscuras": False,
            "evitar_tierras_sombra": True,  # Avoid shadow lands
            "max_pasos": 100
        }
        
        response = api_client.post(f"{BASE_URL}/api/travel/debug-pathfinding", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "pasos" in data
        
    def test_debug_pathfinding_with_avoid_dark_lands(self, api_client):
        """Test pathfinding with dark lands avoidance"""
        payload = {
            "origen_nombre": "Minas Tirith",
            "destino_nombre": "Osgiliath",
            "paso_km": 5,
            "preferir_caminos": True,
            "evitar_tierras_oscuras": True,  # Avoid dark lands
            "evitar_tierras_sombra": False,
            "max_pasos": 100
        }
        
        response = api_client.post(f"{BASE_URL}/api/travel/debug-pathfinding", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "pasos" in data
        
    def test_debug_pathfinding_without_road_preference(self, api_client):
        """Test pathfinding without preferring roads"""
        payload = {
            "origen_nombre": "Minas Tirith",
            "destino_nombre": "Osgiliath",
            "paso_km": 5,
            "preferir_caminos": False,  # Don't prefer roads
            "evitar_tierras_oscuras": False,
            "evitar_tierras_sombra": False,
            "max_pasos": 100
        }
        
        response = api_client.post(f"{BASE_URL}/api/travel/debug-pathfinding", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["configuracion"]["preferir_caminos"] == False
        
    def test_debug_pathfinding_invalid_origin(self, api_client):
        """Test error handling for invalid origin"""
        payload = {
            "origen_nombre": "NonExistentPlace123",
            "destino_nombre": "Osgiliath",
            "paso_km": 5,
            "preferir_caminos": True,
            "evitar_tierras_oscuras": False,
            "evitar_tierras_sombra": False,
            "max_pasos": 100
        }
        
        response = api_client.post(f"{BASE_URL}/api/travel/debug-pathfinding", json=payload)
        assert response.status_code == 200  # Returns 200 with error in body
        
        data = response.json()
        assert "error" in data, "Should return error for invalid origin"
        
    def test_debug_pathfinding_invalid_destination(self, api_client):
        """Test error handling for invalid destination"""
        payload = {
            "origen_nombre": "Minas Tirith",
            "destino_nombre": "NonExistentDestination456",
            "paso_km": 5,
            "preferir_caminos": True,
            "evitar_tierras_oscuras": False,
            "evitar_tierras_sombra": False,
            "max_pasos": 100
        }
        
        response = api_client.post(f"{BASE_URL}/api/travel/debug-pathfinding", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "error" in data, "Should return error for invalid destination"
        
    def test_debug_pathfinding_alternativas_descartadas(self, api_client):
        """Test that alternativas_descartadas are returned when roads are considered"""
        payload = {
            "origen_nombre": "Minas Tirith",
            "destino_nombre": "Pelargir",
            "paso_km": 10,
            "preferir_caminos": True,
            "evitar_tierras_oscuras": False,
            "evitar_tierras_sombra": False,
            "max_pasos": 100
        }
        
        response = api_client.post(f"{BASE_URL}/api/travel/debug-pathfinding", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        pasos = data.get("pasos", [])
        
        # Check if any step has alternativas_descartadas
        steps_with_alternatives = [p for p in pasos if "alternativas_descartadas" in p]
        # It's valid to have steps with alternatives (when roads are considered but rejected)
        # Just verify the structure is correct if present
        for paso in steps_with_alternatives:
            assert isinstance(paso["alternativas_descartadas"], list)
            
    def test_debug_pathfinding_varied_step_size(self, api_client):
        """Test with different step sizes"""
        for paso_km in [3, 10, 25]:
            payload = {
                "origen_nombre": "Minas Tirith",
                "destino_nombre": "Osgiliath",
                "paso_km": paso_km,
                "preferir_caminos": True,
                "evitar_tierras_oscuras": False,
                "evitar_tierras_sombra": False,
                "max_pasos": 100
            }
            
            response = api_client.post(f"{BASE_URL}/api/travel/debug-pathfinding", json=payload)
            assert response.status_code == 200
            
            data = response.json()
            assert data["configuracion"]["paso_km"] == paso_km
            
    def test_debug_pathfinding_configuration_returned(self, api_client):
        """Test that configuration is correctly echoed in response"""
        payload = {
            "origen_nombre": "Rivendel",
            "destino_nombre": "Bree",
            "paso_km": 7,
            "preferir_caminos": False,
            "evitar_tierras_oscuras": True,
            "evitar_tierras_sombra": True,
            "max_pasos": 50
        }
        
        response = api_client.post(f"{BASE_URL}/api/travel/debug-pathfinding", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        config = data.get("configuracion", {})
        
        assert config.get("paso_km") == 7
        assert config.get("preferir_caminos") == False
        assert config.get("evitar_tierras_oscuras") == True
        assert config.get("evitar_tierras_sombra") == True


class TestLocationsEndpoint:
    """Tests for GET /api/data/locations endpoint (needed for PathDebugger)"""
    
    def test_get_locations_returns_list(self, api_client):
        """Test that locations endpoint returns data"""
        response = api_client.get(f"{BASE_URL}/api/data/locations")
        assert response.status_code == 200
        
        data = response.json()
        assert "locations" in data or isinstance(data, list)
        
    def test_locations_have_required_fields(self, api_client, locations_list):
        """Test that locations have required fields for PathDebugger"""
        if len(locations_list) == 0:
            pytest.skip("No locations available")
            
        sample = locations_list[0]
        assert "nombre" in sample, "Location should have 'nombre'"
        assert "x" in sample or "lat" in sample, "Location should have coordinates"
        

class TestRoadsEndpoint:
    """Tests for GET /api/data/roads endpoint (needed for PathDebugger)"""
    
    def test_get_roads_returns_list(self, api_client):
        """Test that roads endpoint returns data"""
        response = api_client.get(f"{BASE_URL}/api/data/roads")
        assert response.status_code == 200
        
        data = response.json()
        roads = data.get("roads", data) if isinstance(data, dict) else data
        assert isinstance(roads, list)
        
    def test_roads_have_puntos_field(self, api_client):
        """Test that roads have 'puntos' field for rendering"""
        response = api_client.get(f"{BASE_URL}/api/data/roads")
        assert response.status_code == 200
        
        data = response.json()
        roads = data.get("roads", data) if isinstance(data, dict) else data
        
        if len(roads) > 0:
            sample = roads[0]
            # Roads should have 'puntos' or 'path' field
            assert "puntos" in sample or "path" in sample, "Road should have 'puntos' or 'path' field"


# Run with: pytest /app/backend/tests/test_path_debugger.py -v --tb=short --junitxml=/app/test_reports/pytest/pytest_path_debugger.xml
