"""
Test suite for iteration 21 new features:
1. Backgrounds grouped by Race/Culture
2. Recompensas (Rewards) with complete PDF information
3. Locations system for Middle-earth map
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBackgroundsGroupedByRace:
    """Tests for GET /api/data/backgrounds/grouped/by-race endpoint"""
    
    def test_backgrounds_grouped_endpoint_returns_200(self):
        """Test that the grouped backgrounds endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds/grouped/by-race")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/data/backgrounds/grouped/by-race returns 200")
    
    def test_backgrounds_grouped_has_grouped_key(self):
        """Test that response has 'grouped' key"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds/grouped/by-race")
        data = response.json()
        assert "grouped" in data, "Response should have 'grouped' key"
        print("✓ Response has 'grouped' key")
    
    def test_backgrounds_grouped_has_total_count(self):
        """Test that response has 'total' count"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds/grouped/by-race")
        data = response.json()
        assert "total" in data, "Response should have 'total' key"
        assert isinstance(data["total"], int), "Total should be an integer"
        print(f"✓ Response has 'total' count: {data['total']}")
    
    def test_backgrounds_grouped_by_race_structure(self):
        """Test that backgrounds are grouped by race (Elfos, Enanos, Hobbits, Hombres)"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds/grouped/by-race")
        data = response.json()
        grouped = data.get("grouped", {})
        
        # Check for expected races
        expected_races = ["Elfos", "Enanos", "Hobbits", "Hombres"]
        found_races = list(grouped.keys())
        
        print(f"Found races: {found_races}")
        
        # At least some races should be present
        assert len(found_races) > 0, "Should have at least one race"
        
        # Check that each race has cultures
        for race in found_races:
            cultures = grouped[race]
            assert isinstance(cultures, dict), f"Race {race} should have cultures as dict"
            print(f"✓ Race '{race}' has {len(cultures)} cultures")
    
    def test_backgrounds_have_required_fields(self):
        """Test that backgrounds have required fields"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds/grouped/by-race")
        data = response.json()
        grouped = data.get("grouped", {})
        
        # Get first background from first race/culture
        for race, cultures in grouped.items():
            for culture, backgrounds in cultures.items():
                if backgrounds:
                    bg = backgrounds[0]
                    assert "id" in bg, "Background should have 'id'"
                    assert "nombre" in bg, "Background should have 'nombre'"
                    assert "cultura" in bg, "Background should have 'cultura'"
                    print(f"✓ Background '{bg['nombre']}' has required fields (id, nombre, cultura)")
                    return
        
        pytest.skip("No backgrounds found to test")


class TestRecompensasEndpoint:
    """Tests for GET /api/data/recompensas endpoint"""
    
    def test_recompensas_endpoint_returns_200(self):
        """Test that recompensas endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/data/recompensas returns 200")
    
    def test_recompensas_has_mejoras(self):
        """Test that response has 'mejoras' array"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        data = response.json()
        assert "mejoras" in data, "Response should have 'mejoras' key"
        assert isinstance(data["mejoras"], list), "mejoras should be a list"
        print(f"✓ Response has 'mejoras' with {len(data['mejoras'])} items")
    
    def test_recompensas_has_niveles_recompensa(self):
        """Test that response has 'niveles_recompensa' array"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        data = response.json()
        assert "niveles_recompensa" in data, "Response should have 'niveles_recompensa' key"
        assert isinstance(data["niveles_recompensa"], list), "niveles_recompensa should be a list"
        print(f"✓ Response has 'niveles_recompensa' with {len(data['niveles_recompensa'])} items")
    
    def test_recompensas_has_bendiciones(self):
        """Test that response has 'bendiciones' field"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        data = response.json()
        assert "bendiciones" in data, "Response should have 'bendiciones' key"
        print(f"✓ Response has 'bendiciones': {data['bendiciones'] is not None}")
    
    def test_recompensas_has_info_general(self):
        """Test that response has 'info_general' field"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        data = response.json()
        assert "info_general" in data, "Response should have 'info_general' key"
        print(f"✓ Response has 'info_general': {data['info_general'] is not None}")
    
    def test_recompensas_has_armas_con_nombre(self):
        """Test that response has 'armas_con_nombre' field"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        data = response.json()
        assert "armas_con_nombre" in data, "Response should have 'armas_con_nombre' key"
        print(f"✓ Response has 'armas_con_nombre': {data['armas_con_nombre'] is not None}")
    
    def test_mejoras_have_required_fields(self):
        """Test that mejoras have required fields (nombre, tipo, descripcion, efecto_mecanico)"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        data = response.json()
        mejoras = data.get("mejoras", [])
        
        if not mejoras:
            pytest.skip("No mejoras found to test")
        
        mejora = mejoras[0]
        assert "nombre" in mejora, "Mejora should have 'nombre'"
        assert "tipo" in mejora, "Mejora should have 'tipo'"
        assert "descripcion" in mejora, "Mejora should have 'descripcion'"
        assert "efecto_mecanico" in mejora, "Mejora should have 'efecto_mecanico'"
        print(f"✓ Mejora '{mejora['nombre']}' has required fields")
    
    def test_mejoras_have_restricciones_field(self):
        """Test that mejoras have 'restricciones' field"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        data = response.json()
        mejoras = data.get("mejoras", [])
        
        if not mejoras:
            pytest.skip("No mejoras found to test")
        
        # Check that at least one mejora has restricciones field
        has_restricciones = any("restricciones" in m for m in mejoras)
        assert has_restricciones, "At least one mejora should have 'restricciones' field"
        print("✓ Mejoras have 'restricciones' field")


class TestLocationsEndpoint:
    """Tests for GET /api/data/locations endpoint"""
    
    def test_locations_endpoint_returns_200(self):
        """Test that locations endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/data/locations returns 200")
    
    def test_locations_returns_list(self):
        """Test that locations returns a list"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        data = response.json()
        assert "locations" in data, "Response should have 'locations' key"
        assert isinstance(data["locations"], list), "locations should be a list"
        print(f"✓ Response has 'locations' with {len(data['locations'])} items")
    
    def test_locations_have_required_fields(self):
        """Test that locations have required fields"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        data = response.json()
        locations = data.get("locations", [])
        
        if not locations:
            pytest.skip("No locations found to test")
        
        loc = locations[0]
        required_fields = ["id", "nombre", "region", "tipo"]
        for field in required_fields:
            assert field in loc, f"Location should have '{field}'"
        print(f"✓ Location '{loc['nombre']}' has required fields")
    
    def test_locations_have_coordinates(self):
        """Test that locations have x, y coordinates"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        data = response.json()
        locations = data.get("locations", [])
        
        if not locations:
            pytest.skip("No locations found to test")
        
        loc = locations[0]
        assert "x" in loc, "Location should have 'x' coordinate"
        assert "y" in loc, "Location should have 'y' coordinate"
        print(f"✓ Location '{loc['nombre']}' has coordinates (x={loc['x']}, y={loc['y']})")
    
    def test_locations_count_at_least_30(self):
        """Test that there are at least 30 locations (37 expected)"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        data = response.json()
        locations = data.get("locations", [])
        
        assert len(locations) >= 30, f"Expected at least 30 locations, got {len(locations)}"
        print(f"✓ Found {len(locations)} locations (expected ~37)")


class TestLocationsForTravelEndpoint:
    """Tests for GET /api/data/locations/for-travel endpoint"""
    
    def test_locations_for_travel_returns_200(self):
        """Test that locations/for-travel endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/data/locations/for-travel")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/data/locations/for-travel returns 200")
    
    def test_locations_for_travel_grouped_by_region(self):
        """Test that locations are grouped by region"""
        response = requests.get(f"{BASE_URL}/api/data/locations/for-travel")
        data = response.json()
        
        assert "by_region" in data, "Response should have 'by_region' key"
        by_region = data["by_region"]
        assert isinstance(by_region, dict), "by_region should be a dict"
        
        print(f"✓ Locations grouped by {len(by_region)} regions")
        for region, locs in by_region.items():
            print(f"  - {region}: {len(locs)} locations")
    
    def test_locations_for_travel_has_eriador(self):
        """Test that Eriador region exists with locations"""
        response = requests.get(f"{BASE_URL}/api/data/locations/for-travel")
        data = response.json()
        by_region = data.get("by_region", {})
        
        assert "Eriador" in by_region, "Should have 'Eriador' region"
        assert len(by_region["Eriador"]) > 0, "Eriador should have locations"
        print(f"✓ Eriador has {len(by_region['Eriador'])} locations")


class TestLocationsRegionsEndpoint:
    """Tests for GET /api/data/locations/regions endpoint"""
    
    def test_locations_regions_returns_200(self):
        """Test that locations/regions endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/data/locations/regions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/data/locations/regions returns 200")
    
    def test_locations_regions_returns_list(self):
        """Test that regions returns a list"""
        response = requests.get(f"{BASE_URL}/api/data/locations/regions")
        data = response.json()
        
        assert "regions" in data, "Response should have 'regions' key"
        assert isinstance(data["regions"], list), "regions should be a list"
        print(f"✓ Response has {len(data['regions'])} regions")
    
    def test_locations_regions_have_count(self):
        """Test that each region has a count"""
        response = requests.get(f"{BASE_URL}/api/data/locations/regions")
        data = response.json()
        regions = data.get("regions", [])
        
        if not regions:
            pytest.skip("No regions found to test")
        
        region = regions[0]
        assert "region" in region, "Region should have 'region' name"
        assert "count" in region, "Region should have 'count'"
        print(f"✓ Region '{region['region']}' has count: {region['count']}")
    
    def test_locations_regions_count_at_least_10(self):
        """Test that there are at least 10 regions"""
        response = requests.get(f"{BASE_URL}/api/data/locations/regions")
        data = response.json()
        regions = data.get("regions", [])
        
        assert len(regions) >= 10, f"Expected at least 10 regions, got {len(regions)}"
        print(f"✓ Found {len(regions)} regions")


class TestKnownLocations:
    """Tests for specific known Middle-earth locations"""
    
    def test_la_comarca_exists(self):
        """Test that La Comarca (The Shire) exists"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        data = response.json()
        locations = data.get("locations", [])
        
        comarca = next((l for l in locations if l["nombre"] == "La Comarca"), None)
        assert comarca is not None, "La Comarca should exist"
        assert comarca["region"] == "Eriador", "La Comarca should be in Eriador"
        print(f"✓ La Comarca exists in Eriador")
    
    def test_rivendel_exists(self):
        """Test that Rivendel (Rivendell) exists"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        data = response.json()
        locations = data.get("locations", [])
        
        rivendel = next((l for l in locations if l["nombre"] == "Rivendel"), None)
        assert rivendel is not None, "Rivendel should exist"
        assert rivendel.get("nombre_sindarin") == "Imladris", "Rivendel should have Sindarin name Imladris"
        print(f"✓ Rivendel (Imladris) exists")
    
    def test_mordor_exists(self):
        """Test that Mordor exists"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        data = response.json()
        locations = data.get("locations", [])
        
        mordor_locs = [l for l in locations if l["region"] == "Mordor"]
        assert len(mordor_locs) > 0, "Should have locations in Mordor"
        print(f"✓ Found {len(mordor_locs)} locations in Mordor")
    
    def test_minas_tirith_exists(self):
        """Test that Minas Tirith exists"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        data = response.json()
        locations = data.get("locations", [])
        
        minas = next((l for l in locations if l["nombre"] == "Minas Tirith"), None)
        assert minas is not None, "Minas Tirith should exist"
        assert minas["region"] == "Gondor", "Minas Tirith should be in Gondor"
        print(f"✓ Minas Tirith exists in Gondor")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
