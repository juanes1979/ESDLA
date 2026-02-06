"""
Test Equipment Catalog API - Tests for all 21 equipment categories
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# All 21 expected categories
EXPECTED_CATEGORIES = [
    "herramientas", "juegos", "instrumentos_musicales", "equipo_general",
    "consumibles", "comida_posadas", "hierbas", "venenos",
    "armas_sencillas_cc", "armas_sencillas_distancia", "armas_marciales_cc", "armas_marciales_distancia",
    "armaduras_ligeras", "armaduras_medias", "armaduras_pesadas", "escudos",
    "monturas", "accesorios_monturas", "transporte_terrestre", "transporte_maritimo",
    "construccion"
]


class TestEquipmentCatalog:
    """Test equipment catalog endpoint returns all 21 categories"""
    
    def test_equipment_catalog_returns_all_categories(self):
        """Verify all 21 categories are present in the response"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check all expected categories exist
        for category in EXPECTED_CATEGORIES:
            assert category in data, f"Missing category: {category}"
            assert isinstance(data[category], list), f"Category {category} should be a list"
    
    def test_equipment_catalog_has_items(self):
        """Verify categories have items"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check key categories have items
        assert len(data["herramientas"]) > 0, "herramientas should have items"
        assert len(data["juegos"]) > 0, "juegos should have items"
        assert len(data["instrumentos_musicales"]) > 0, "instrumentos_musicales should have items"
        assert len(data["armas_sencillas_cc"]) > 0, "armas_sencillas_cc should have items"
        assert len(data["armaduras_ligeras"]) > 0, "armaduras_ligeras should have items"
        assert len(data["monturas"]) > 0, "monturas should have items"
        assert len(data["construccion"]) > 0, "construccion should have items"
    
    def test_equipment_catalog_item_structure(self):
        """Verify items have required fields"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check herramientas item structure
        if data["herramientas"]:
            item = data["herramientas"][0]
            assert "nombre" in item, "Item should have nombre"
            assert "precio" in item, "Item should have precio"
    
    def test_equipment_catalog_search(self):
        """Test search functionality filters across categories"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog?search=espada")
        assert response.status_code == 200
        
        data = response.json()
        
        # Should find espadas in armas_marciales_cc
        found_items = []
        for category, items in data.items():
            for item in items:
                if "espada" in item.get("nombre", "").lower():
                    found_items.append(item["nombre"])
        
        assert len(found_items) > 0, "Search for 'espada' should return results"
    
    def test_equipment_catalog_filter_by_category(self):
        """Test filtering by specific category"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog?categoria=herramientas")
        assert response.status_code == 200
        
        data = response.json()
        
        # Should only return herramientas
        assert "herramientas" in data
        assert len(data["herramientas"]) > 0


class TestEquipmentLists:
    """Test equipment lists endpoint for instruments and games"""
    
    def test_equipment_lists_returns_juegos(self):
        """Verify juegos list is returned"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-lists")
        assert response.status_code == 200
        
        data = response.json()
        assert "juegos" in data
        assert isinstance(data["juegos"], list)
        assert len(data["juegos"]) > 0, "Should have games"
    
    def test_equipment_lists_returns_instrumentos(self):
        """Verify instrumentos_musicales list is returned"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-lists")
        assert response.status_code == 200
        
        data = response.json()
        assert "instrumentos_musicales" in data
        assert isinstance(data["instrumentos_musicales"], list)
        assert len(data["instrumentos_musicales"]) > 0, "Should have instruments"
    
    def test_equipment_lists_item_names(self):
        """Verify items are strings (names only)"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-lists")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check juegos are strings
        for item in data["juegos"]:
            assert isinstance(item, str), f"Juego should be string, got {type(item)}"
        
        # Check instrumentos are strings
        for item in data["instrumentos_musicales"]:
            assert isinstance(item, str), f"Instrumento should be string, got {type(item)}"


class TestBackgrounds:
    """Test backgrounds endpoint for Step2Background component"""
    
    def test_backgrounds_returns_list(self):
        """Verify backgrounds endpoint returns list"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds")
        assert response.status_code == 200
        
        data = response.json()
        assert "backgrounds" in data
        assert isinstance(data["backgrounds"], list)
        assert len(data["backgrounds"]) > 0, "Should have backgrounds"
    
    def test_backgrounds_filter_by_cultura(self):
        """Test filtering backgrounds by culture name"""
        # Test with a known culture
        response = requests.get(f"{BASE_URL}/api/data/backgrounds?cultura=Hobbits%20Pelosos")
        assert response.status_code == 200
        
        data = response.json()
        assert "backgrounds" in data
        
        # All returned backgrounds should be for this culture
        for bg in data["backgrounds"]:
            assert bg.get("cultura") == "Hobbits Pelosos", f"Background {bg.get('nombre')} has wrong culture"
    
    def test_background_has_required_fields(self):
        """Verify background has fields needed for Step2Background"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds")
        assert response.status_code == 200
        
        data = response.json()
        
        if data["backgrounds"]:
            bg = data["backgrounds"][0]
            assert "id" in bg, "Background should have id"
            assert "nombre" in bg, "Background should have nombre"
            # These are optional but used in Step2Background
            # competencias_habilidades_auto, competencias_habilidades_elegir
            # competencias_herramientas_1, competencias_herramientas_2
    
    def test_backgrounds_with_instrument_proficiency(self):
        """Find backgrounds that grant instrument proficiency for sub-selection test"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find backgrounds with instrument or game proficiency
        instrument_backgrounds = []
        game_backgrounds = []
        
        for bg in data["backgrounds"]:
            tools1 = bg.get("competencias_herramientas_1", [])
            tools2 = bg.get("competencias_herramientas_2", [])
            all_tools = tools1 + tools2
            
            for tool in all_tools:
                if tool and "instrumento" in tool.lower():
                    instrument_backgrounds.append(bg["nombre"])
                    break
            
            for tool in all_tools:
                if tool and "juego" in tool.lower():
                    game_backgrounds.append(bg["nombre"])
                    break
        
        print(f"Backgrounds with instrument proficiency: {instrument_backgrounds[:5]}")
        print(f"Backgrounds with game proficiency: {game_backgrounds[:5]}")
        
        # At least some backgrounds should have these
        # This is informational - not a hard requirement


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
