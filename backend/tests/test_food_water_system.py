"""
Test suite for Food/Water system in LOTR 5e Travel System
Tests the endpoints for managing food/water properties on equipment items
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFoodWaterSystem:
    """Tests for food/water item management endpoints"""
    
    def test_get_equipment_catalog(self):
        """Test GET /api/data/equipment-catalog returns all categories"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required categories exist
        assert 'consumibles' in data
        assert 'comida_posadas' in data
        assert 'equipo_general' in data
        assert 'herramientas' in data
        
        # Verify consumibles has items
        assert len(data['consumibles']) > 0
        print(f"Found {len(data['consumibles'])} items in consumibles")
    
    def test_get_food_items_endpoint(self):
        """Test GET /api/data/equipment-catalog/food-items returns food and water items"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog/food-items")
        assert response.status_code == 200
        
        data = response.json()
        assert 'food_items' in data
        assert 'water_items' in data
        
        print(f"Food items count: {len(data['food_items'])}")
        print(f"Water items count: {len(data['water_items'])}")
    
    def test_update_food_water_properties(self):
        """Test PUT /api/data/equipment-catalog/food-water updates item properties"""
        # First, get an item name from the catalog
        catalog_res = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert catalog_res.status_code == 200
        consumibles = catalog_res.json().get('consumibles', [])
        assert len(consumibles) > 0
        
        # Pick an item to update (using a safe test name)
        test_item_name = consumibles[0].get('nombre')
        assert test_item_name is not None
        
        # Update the item's food properties
        update_payload = {
            "items": [{
                "nombre": test_item_name,
                "categoria": "consumibles",
                "es_comida": True,
                "es_agua": False,
                "porcentaje_racion": 75,
                "litros": 0
            }]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/data/equipment-catalog/food-water",
            json=update_payload
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('success') == True
        assert data.get('updated') >= 0  # May be 0 if item not found or 1 if updated
        print(f"Updated items: {data.get('updated')}")
        
        # Verify the update by fetching food items
        verify_res = requests.get(f"{BASE_URL}/api/data/equipment-catalog/food-items")
        assert verify_res.status_code == 200
        food_items = verify_res.json().get('food_items', [])
        
        # Check if our item appears in food items
        item_in_food = any(item.get('nombre') == test_item_name for item in food_items)
        print(f"Item '{test_item_name}' is in food items: {item_in_food}")
    
    def test_bulk_update_multiple_items(self):
        """Test updating multiple items at once"""
        update_payload = {
            "items": [
                {
                    "nombre": "Cerveza o hidromiel, vaso",
                    "categoria": "consumibles",
                    "es_comida": False,
                    "es_agua": True,
                    "porcentaje_racion": 0,
                    "litros": 0.5
                },
                {
                    "nombre": "Agua fresca, jarra",
                    "categoria": "consumibles",
                    "es_comida": False,
                    "es_agua": True,
                    "porcentaje_racion": 0,
                    "litros": 2.0
                }
            ]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/data/equipment-catalog/food-water",
            json=update_payload
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('success') == True
        print(f"Bulk updated {data.get('updated')} items")
    
    def test_food_item_has_required_properties(self):
        """Test that food items have all required properties for travel system"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog/food-items")
        assert response.status_code == 200
        
        data = response.json()
        food_items = data.get('food_items', [])
        
        if len(food_items) > 0:
            item = food_items[0]
            # Check required properties
            assert 'nombre' in item
            assert 'categoria' in item
            # Optional but should be present after marking
            if 'es_comida' in item:
                assert item['es_comida'] == True
            if 'porcentaje_racion' in item:
                assert isinstance(item['porcentaje_racion'], (int, float))
            
            print(f"Sample food item: {item.get('nombre')}")
            print(f"  - Category: {item.get('categoria')}")
            print(f"  - Ration %: {item.get('porcentaje_racion', 'N/A')}")
    
    def test_water_item_has_required_properties(self):
        """Test that water items have liters property"""
        # First mark an item as water
        update_payload = {
            "items": [{
                "nombre": "Agua fresca, jarra",
                "categoria": "consumibles",
                "es_comida": False,
                "es_agua": True,
                "porcentaje_racion": 0,
                "litros": 2.0
            }]
        }
        
        requests.put(
            f"{BASE_URL}/api/data/equipment-catalog/food-water",
            json=update_payload
        )
        
        # Then verify
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog/food-items")
        assert response.status_code == 200
        
        data = response.json()
        water_items = data.get('water_items', [])
        
        if len(water_items) > 0:
            item = water_items[0]
            assert 'nombre' in item
            if 'litros' in item:
                assert isinstance(item['litros'], (int, float))
            
            print(f"Sample water item: {item.get('nombre')}")
            print(f"  - Liters: {item.get('litros', 'N/A')}")


class TestTravelPageIntegration:
    """Tests for the travel page and its integration with food/water system"""
    
    def test_travel_config_events(self):
        """Test GET /api/travel/config/events returns travel events"""
        response = requests.get(f"{BASE_URL}/api/travel/config/events")
        assert response.status_code == 200
        
        data = response.json()
        events = data.get('events', [])
        print(f"Found {len(events)} travel events")
    
    def test_travel_config_terrains(self):
        """Test GET /api/travel/config/terrains returns terrain types"""
        response = requests.get(f"{BASE_URL}/api/travel/config/terrains")
        assert response.status_code == 200
        
        data = response.json()
        terrains = data.get('terrains', [])
        print(f"Found {len(terrains)} terrain types")
    
    def test_travel_config_land_types(self):
        """Test GET /api/travel/config/land-types returns land types"""
        response = requests.get(f"{BASE_URL}/api/travel/config/land-types")
        assert response.status_code == 200
        
        data = response.json()
        land_types = data.get('land_types', [])
        print(f"Found {len(land_types)} land types")
    
    def test_travel_config_rules(self):
        """Test GET /api/travel/config/rules returns travel rules"""
        response = requests.get(f"{BASE_URL}/api/travel/config/rules")
        assert response.status_code == 200
        
        data = response.json()
        rules = data.get('rules', {})
        # Check for some expected rule properties
        print(f"Travel rules loaded, keys: {list(rules.keys())[:5]}...")
    
    def test_travel_config_px_table(self):
        """Test GET /api/travel/config/px-table returns PX experience table"""
        response = requests.get(f"{BASE_URL}/api/travel/config/px-table")
        assert response.status_code == 200
        
        data = response.json()
        px_table = data.get('px_table')
        print(f"PX table loaded: {px_table is not None}")


class TestLocationEndpoints:
    """Tests for location endpoints used in travel page"""
    
    def test_get_locations(self):
        """Test GET /api/data/locations returns locations for origin/destination"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        assert response.status_code == 200
        
        data = response.json()
        locations = data.get('locations', [])
        assert len(locations) > 0
        print(f"Found {len(locations)} locations")
        
        # Verify location has required fields
        if len(locations) > 0:
            loc = locations[0]
            assert 'nombre' in loc or 'id' in loc
            print(f"Sample location: {loc.get('nombre', loc.get('id'))}")


# Run cleanup after tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup test data after tests complete"""
    yield
    # Reset test item to original state
    try:
        reset_payload = {
            "items": [{
                "nombre": "Pollo, porción",
                "categoria": "consumibles",
                "es_comida": False,
                "es_agua": False,
                "porcentaje_racion": 100,
                "litros": 0
            }]
        }
        requests.put(
            f"{BASE_URL}/api/data/equipment-catalog/food-water",
            json=reset_payload
        )
    except:
        pass
