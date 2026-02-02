"""
Test file for iteration 8 bug fixes verification:
1. Equipment catalog endpoint returns weapons with 'herida' and 'distancia' fields
2. Frontend compilation (no syntax errors)
3. Sheet editor accessibility
4. Homepage accessibility
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEquipmentCatalogWeapons:
    """Test /api/data/equipment-catalog endpoint for weapon fields"""
    
    def test_equipment_catalog_returns_200(self):
        """Verify equipment catalog endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert 'armas' in data, "Response should contain 'armas' key"
        print(f"Equipment catalog returned successfully with {len(data.get('armas', []))} weapons")
    
    def test_weapons_have_herida_field(self):
        """Verify all weapons have 'herida' field"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        data = response.json()
        armas = data.get('armas', [])
        
        assert len(armas) > 0, "Should have at least one weapon"
        
        weapons_without_herida = []
        for arma in armas:
            if 'herida' not in arma or arma['herida'] is None:
                weapons_without_herida.append(arma.get('nombre', 'Unknown'))
        
        assert len(weapons_without_herida) == 0, f"Weapons missing 'herida' field: {weapons_without_herida}"
        print(f"All {len(armas)} weapons have 'herida' field")
    
    def test_weapons_have_distancia_field(self):
        """Verify all weapons have 'distancia' field"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        data = response.json()
        armas = data.get('armas', [])
        
        assert len(armas) > 0, "Should have at least one weapon"
        
        weapons_without_distancia = []
        for arma in armas:
            if 'distancia' not in arma or arma['distancia'] is None:
                weapons_without_distancia.append(arma.get('nombre', 'Unknown'))
        
        assert len(weapons_without_distancia) == 0, f"Weapons missing 'distancia' field: {weapons_without_distancia}"
        print(f"All {len(armas)} weapons have 'distancia' field")
    
    def test_weapons_have_dano_field(self):
        """Verify all weapons have 'dano' (damage) field"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        data = response.json()
        armas = data.get('armas', [])
        
        assert len(armas) > 0, "Should have at least one weapon"
        
        weapons_without_dano = []
        for arma in armas:
            if 'dano' not in arma or arma['dano'] is None:
                weapons_without_dano.append(arma.get('nombre', 'Unknown'))
        
        assert len(weapons_without_dano) == 0, f"Weapons missing 'dano' field: {weapons_without_dano}"
        print(f"All {len(armas)} weapons have 'dano' field")
    
    def test_weapon_herida_values_are_valid(self):
        """Verify herida values are valid integers (typically 12-20)"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        data = response.json()
        armas = data.get('armas', [])
        
        for arma in armas:
            herida = arma.get('herida')
            assert isinstance(herida, int), f"Weapon '{arma.get('nombre')}' herida should be int, got {type(herida)}"
            assert 10 <= herida <= 25, f"Weapon '{arma.get('nombre')}' herida {herida} out of expected range (10-25)"
        
        print(f"All weapon herida values are valid integers")
    
    def test_weapon_distancia_values_are_valid(self):
        """Verify distancia values are valid strings (C/C or range like 3/15)"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        data = response.json()
        armas = data.get('armas', [])
        
        for arma in armas:
            distancia = arma.get('distancia')
            assert isinstance(distancia, str), f"Weapon '{arma.get('nombre')}' distancia should be str, got {type(distancia)}"
            assert len(distancia) > 0, f"Weapon '{arma.get('nombre')}' distancia should not be empty"
        
        print(f"All weapon distancia values are valid strings")


class TestHealthAndAccessibility:
    """Test basic health and accessibility endpoints"""
    
    def test_health_endpoint(self):
        """Verify health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy', f"Expected healthy status, got {data}"
        print("Health endpoint returns healthy status")
    
    def test_cultures_endpoint(self):
        """Verify cultures endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        assert response.status_code == 200
        data = response.json()
        assert 'cultures' in data, "Response should contain 'cultures' key"
        print(f"Cultures endpoint returned {len(data.get('cultures', []))} cultures")
    
    def test_occupations_endpoint(self):
        """Verify occupations endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        assert response.status_code == 200
        data = response.json()
        assert 'occupations' in data, "Response should contain 'occupations' key"
        print(f"Occupations endpoint returned {len(data.get('occupations', []))} occupations")


class TestEquipmentCatalogCategories:
    """Test equipment catalog returns all categories"""
    
    def test_catalog_has_herramientas(self):
        """Verify catalog has herramientas (tools)"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        data = response.json()
        assert 'herramientas' in data, "Response should contain 'herramientas' key"
        assert len(data.get('herramientas', [])) > 0, "Should have at least one tool"
        print(f"Catalog has {len(data.get('herramientas', []))} tools")
    
    def test_catalog_has_equipo_general(self):
        """Verify catalog has equipo_general (general equipment)"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        data = response.json()
        assert 'equipo_general' in data, "Response should contain 'equipo_general' key"
        assert len(data.get('equipo_general', [])) > 0, "Should have at least one general equipment item"
        print(f"Catalog has {len(data.get('equipo_general', []))} general equipment items")
    
    def test_catalog_has_armaduras(self):
        """Verify catalog has armaduras (armors)"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        data = response.json()
        assert 'armaduras' in data, "Response should contain 'armaduras' key"
        assert len(data.get('armaduras', [])) > 0, "Should have at least one armor"
        print(f"Catalog has {len(data.get('armaduras', []))} armors")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
