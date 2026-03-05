"""
Test Travel Apply-PX Endpoint
Tests the P0 feature: POST /api/travel/apply-px
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestApplyPXEndpoint:
    """Test suite for POST /api/travel/apply-px endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Create test characters for apply-px tests
        self.test_character_ids = []
        
    def test_health_check(self):
        """Test that backend is healthy"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health check passed")
    
    def test_apply_px_endpoint_exists(self):
        """Test that /api/travel/apply-px endpoint exists and accepts POST"""
        # Test with minimal data to see endpoint exists
        response = self.session.post(f"{BASE_URL}/api/travel/apply-px", json={
            "character_ids": [],
            "px_amount": 100
        })
        # Should return an error message about no characters, not 404/405
        assert response.status_code == 200
        data = response.json()
        assert "error" in data or "success" in data
        print(f"✓ Endpoint exists, returned: {data}")
    
    def test_apply_px_no_characters_error(self):
        """Test that endpoint returns error when no characters provided"""
        response = self.session.post(f"{BASE_URL}/api/travel/apply-px", json={
            "character_ids": [],
            "px_amount": 100
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("error") == True
        assert "No se proporcionaron personajes" in data.get("message", "")
        print("✓ Empty character list returns appropriate error")
    
    def test_apply_px_zero_amount_error(self):
        """Test that endpoint returns error for zero px amount"""
        response = self.session.post(f"{BASE_URL}/api/travel/apply-px", json={
            "character_ids": ["test_char_1"],
            "px_amount": 0
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("error") == True
        assert "mayor a 0" in data.get("message", "")
        print("✓ Zero PX amount returns appropriate error")
    
    def test_apply_px_negative_amount_error(self):
        """Test that endpoint returns error for negative px amount"""
        response = self.session.post(f"{BASE_URL}/api/travel/apply-px", json={
            "character_ids": ["test_char_1"],
            "px_amount": -50
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("error") == True
        assert "mayor a 0" in data.get("message", "")
        print("✓ Negative PX amount returns appropriate error")
    
    def test_apply_px_invalid_character_graceful_handling(self):
        """Test that invalid character ID is handled gracefully"""
        fake_id = f"nonexistent_char_{uuid.uuid4().hex[:8]}"
        response = self.session.post(f"{BASE_URL}/api/travel/apply-px", json={
            "character_ids": [fake_id],
            "px_amount": 100
        })
        assert response.status_code == 200
        data = response.json()
        # Should succeed overall but with 0 successful updates
        assert "results" in data
        assert len(data["results"]) == 1
        assert data["results"][0].get("success") == False
        assert "no encontrado" in data["results"][0].get("error", "").lower() or "not found" in data["results"][0].get("error", "").lower()
        print(f"✓ Invalid character ID handled gracefully: {data['results'][0]}")
    
    def test_apply_px_request_structure(self):
        """Test that endpoint accepts all expected fields"""
        response = self.session.post(f"{BASE_URL}/api/travel/apply-px", json={
            "character_ids": ["test_char"],
            "px_amount": 50,
            "journey_id": "journey_test_123",
            "journey_description": "Test journey from A to B"
        })
        assert response.status_code == 200
        data = response.json()
        # Should not fail with 422 (validation error)
        assert "error" in data or "success" in data
        print(f"✓ Endpoint accepts full request structure")


class TestTravelConfigEndpoints:
    """Test travel configuration endpoints (for TravelRulesSection)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_travel_config_events(self):
        """Test GET /api/travel/config/events"""
        response = self.session.get(f"{BASE_URL}/api/travel/config/events")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        print(f"✓ Travel config events: {len(data.get('events', []))} events")
    
    def test_travel_config_terrains(self):
        """Test GET /api/travel/config/terrains"""
        response = self.session.get(f"{BASE_URL}/api/travel/config/terrains")
        assert response.status_code == 200
        data = response.json()
        assert "terrains" in data
        print(f"✓ Travel config terrains: {len(data.get('terrains', []))} terrains")
    
    def test_travel_config_land_types(self):
        """Test GET /api/travel/config/land-types"""
        response = self.session.get(f"{BASE_URL}/api/travel/config/land-types")
        assert response.status_code == 200
        data = response.json()
        assert "land_types" in data
        print(f"✓ Travel config land-types: {len(data.get('land_types', []))} types")
    
    def test_travel_config_road_types(self):
        """Test GET /api/travel/config/road-types"""
        response = self.session.get(f"{BASE_URL}/api/travel/config/road-types")
        assert response.status_code == 200
        data = response.json()
        assert "road_types" in data
        print(f"✓ Travel config road-types: {len(data.get('road_types', []))} types")
    
    def test_travel_config_px_table(self):
        """Test GET /api/travel/config/px-table"""
        response = self.session.get(f"{BASE_URL}/api/travel/config/px-table")
        assert response.status_code == 200
        data = response.json()
        assert "px_table" in data
        print(f"✓ Travel config px-table loaded")
    
    def test_travel_config_rules(self):
        """Test GET /api/travel/config/rules"""
        response = self.session.get(f"{BASE_URL}/api/travel/config/rules")
        assert response.status_code == 200
        data = response.json()
        assert "rules" in data
        print(f"✓ Travel config rules loaded")
    
    def test_travel_config_objectives(self):
        """Test GET /api/travel/config/objectives"""
        response = self.session.get(f"{BASE_URL}/api/travel/config/objectives")
        assert response.status_code == 200
        data = response.json()
        assert "objectives" in data
        print(f"✓ Travel config objectives: {len(data.get('objectives', []))} objectives")


class TestJourneyEndpoints:
    """Test journey calculation and day-by-day endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_generate_event_endpoint(self):
        """Test POST /api/travel/generate-event"""
        response = self.session.post(f"{BASE_URL}/api/travel/generate-event", params={
            "tipo_tierra": "tierras_salvajes",
            "terreno": "campo_abierto",
            "estacion": "verano"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "evento" in data
        assert "tiradas" in data
        assert "objetivo" in data
        print(f"✓ Generate event: {data['evento'].get('nombre')}")
    
    def test_fatigue_save_endpoint(self):
        """Test POST /api/travel/fatigue-save"""
        response = self.session.post(f"{BASE_URL}/api/travel/fatigue-save", params={
            "personaje_nombre": "Test Character",
            "modificador_constitucion": 2,
            "cd_acumulada": 15,
            "dias_con_montura": 3,
            "dias_totales": 5,
            "bonus_montura_con": 1
        })
        assert response.status_code == 200
        data = response.json()
        assert "personaje" in data
        assert "tirada" in data
        assert "resultado" in data
        assert "niveles_cansancio" in data
        print(f"✓ Fatigue save: {data['resultado']}, {data['niveles_cansancio']} fatigue levels")
    
    def test_active_journeys_endpoint(self):
        """Test GET /api/travel/journeys/active"""
        response = self.session.get(f"{BASE_URL}/api/travel/journeys/active")
        assert response.status_code == 200
        data = response.json()
        assert "journeys" in data
        print(f"✓ Active journeys: {len(data.get('journeys', []))} journeys")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
