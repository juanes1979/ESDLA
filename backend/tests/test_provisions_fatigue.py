"""
Test Suite for LOTR 5e Travel System - Provisions, Fatigue, and Rest
Tests food/water management, fatigue endpoint, and rest system APIs
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestFatigueEndpoint:
    """Test PUT /api/characters/{id}/fatigue endpoint"""
    
    def test_get_characters_list(self):
        """Get list of characters to use for testing"""
        response = requests.get(f"{BASE_URL}/api/characters/")
        assert response.status_code == 200
        data = response.json()
        assert "characters" in data
        assert len(data["characters"]) > 0
        # Store first character ID for other tests
        TestFatigueEndpoint.test_char_id = data["characters"][0]["id"]
        TestFatigueEndpoint.test_char_name = data["characters"][0]["nombre"]
        print(f"Using character: {TestFatigueEndpoint.test_char_name} ({TestFatigueEndpoint.test_char_id})")
    
    def test_update_fatigue_valid(self):
        """Test updating fatigue to a valid level (0-6)"""
        char_id = getattr(TestFatigueEndpoint, 'test_char_id', None)
        if not char_id:
            pytest.skip("No character ID available")
        
        # Set fatigue to 2
        response = requests.put(
            f"{BASE_URL}/api/characters/{char_id}/fatigue",
            json={"fatiga": 2},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "fatiga" in data
        assert data["fatiga"] == 2
        print(f"Fatigue updated to: {data['fatiga']}")
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/characters/{char_id}")
        assert get_response.status_code == 200
        char_data = get_response.json()
        assert char_data.get("fatiga") == 2
    
    def test_update_fatigue_boundary_max(self):
        """Test fatigue clamped to max 6"""
        char_id = getattr(TestFatigueEndpoint, 'test_char_id', None)
        if not char_id:
            pytest.skip("No character ID available")
        
        # Try to set fatigue to 10, should be clamped to 6
        response = requests.put(
            f"{BASE_URL}/api/characters/{char_id}/fatigue",
            json={"fatiga": 10},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["fatiga"] <= 6
        print(f"Max fatigue clamped to: {data['fatiga']}")
    
    def test_update_fatigue_boundary_min(self):
        """Test fatigue clamped to min 0"""
        char_id = getattr(TestFatigueEndpoint, 'test_char_id', None)
        if not char_id:
            pytest.skip("No character ID available")
        
        # Try to set fatigue to -5, should be clamped to 0
        response = requests.put(
            f"{BASE_URL}/api/characters/{char_id}/fatigue",
            json={"fatiga": -5},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["fatiga"] >= 0
        print(f"Min fatigue clamped to: {data['fatiga']}")
    
    def test_update_fatigue_reset(self):
        """Reset fatigue to 0 after tests"""
        char_id = getattr(TestFatigueEndpoint, 'test_char_id', None)
        if not char_id:
            pytest.skip("No character ID available")
        
        response = requests.put(
            f"{BASE_URL}/api/characters/{char_id}/fatigue",
            json={"fatiga": 0},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["fatiga"] == 0


class TestFoodWaterEndpoints:
    """Test food and water catalog endpoints"""
    
    def test_get_food_water_items(self):
        """Test GET /api/data/equipment-catalog/food-items"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog/food-items")
        assert response.status_code == 200
        data = response.json()
        assert "food_items" in data
        assert "water_items" in data
        print(f"Food items: {len(data['food_items'])}, Water items: {len(data['water_items'])}")
    
    def test_get_equipment_catalog(self):
        """Test GET /api/data/equipment-catalog"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        data = response.json()
        # Should have various categories
        assert "consumibles" in data or len(data) > 0
        print(f"Equipment catalog categories: {list(data.keys())[:5]}")


class TestTravelConfigEndpoints:
    """Test travel configuration endpoints for rules"""
    
    def test_get_travel_rules(self):
        """Test GET /api/travel/config/rules"""
        response = requests.get(f"{BASE_URL}/api/travel/config/rules")
        assert response.status_code == 200
        data = response.json()
        assert "rules" in data
        rules = data["rules"]
        # Verify fatigue-related rules exist
        assert "fatigue_base_cd" in rules
        assert rules["fatigue_base_cd"] == 10  # Default base CD
        print(f"Fatigue base CD: {rules['fatigue_base_cd']}")
    
    def test_get_travel_events(self):
        """Test GET /api/travel/config/events"""
        response = requests.get(f"{BASE_URL}/api/travel/config/events")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        events = data["events"]
        assert len(events) > 0
        print(f"Travel events count: {len(events)}")
        # Check event structure
        first_event = events[0]
        assert "nombre" in first_event
        assert "fatigue_cd_increase" in first_event
    
    def test_get_land_types(self):
        """Test GET /api/travel/config/land-types"""
        response = requests.get(f"{BASE_URL}/api/travel/config/land-types")
        assert response.status_code == 200
        data = response.json()
        assert "land_types" in data
        land_types = data["land_types"]
        assert len(land_types) >= 5  # Should have at least 5 land types
        print(f"Land types: {[lt['nombre'] for lt in land_types]}")


class TestTravelJourneyFlow:
    """Test journey calculation and start flow"""
    
    def test_get_locations(self):
        """Test GET /api/data/locations"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        assert response.status_code == 200
        data = response.json()
        assert "locations" in data
        locations = data["locations"]
        assert len(locations) > 0
        # Store some locations for journey tests
        TestTravelJourneyFlow.locations = locations[:10]
        print(f"Total locations: {len(locations)}")
    
    def test_calculate_journey_basic(self):
        """Test POST /api/travel/calculate-journey"""
        locations = getattr(TestTravelJourneyFlow, 'locations', [])
        if len(locations) < 2:
            pytest.skip("Not enough locations for journey test")
        
        # Find two locations with coordinates
        origen = None
        destino = None
        for loc in locations:
            if loc.get('x') is not None and loc.get('y') is not None:
                loc_id = loc.get('_id') or loc.get('id')
                if origen is None:
                    origen = loc
                elif destino is None:
                    origen_id = origen.get('_id') or origen.get('id')
                    if loc_id != origen_id:
                        destino = loc
                        break
        
        if not origen or not destino:
            pytest.skip("Could not find suitable locations")
        
        payload = {
            "origen_id": origen.get('_id') or origen.get('id'),
            "origen_nombre": origen.get('nombre'),
            "destino_id": destino.get('_id') or destino.get('id'),
            "destino_nombre": destino.get('nombre'),
            "evitar_sombra": False,
            "evitar_tierras_oscuras": False,
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/travel/calculate-journey",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return route info or error
        if data.get('error'):
            print(f"Journey calculation message: {data.get('message')}")
        else:
            assert "ruta" in data or "error" in data
            if "ruta" in data:
                print(f"Journey from {origen['nombre']} to {destino['nombre']}: {data.get('estimaciones', {}).get('dias_estimados', 'N/A')} days")


class TestRestTypes:
    """Test rest type constants and validation"""
    
    def test_rest_types_exist_in_rules(self):
        """Verify rest-related rules exist"""
        response = requests.get(f"{BASE_URL}/api/travel/config/rules")
        assert response.status_code == 200
        data = response.json()
        rules = data.get("rules", {})
        
        # Fatigue rules should exist
        assert "fatigue_base_cd" in rules
        assert rules["fatigue_base_cd"] >= 0
        
        # Verify fatigue penalty levels
        assert "fatigue_fail_by_5_levels" in rules
        assert "fatigue_fail_by_10_levels" in rules
        
        print(f"Rest system rules verified - Base CD: {rules['fatigue_base_cd']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
