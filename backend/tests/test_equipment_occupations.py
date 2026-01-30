"""
Test Equipment Catalog and Occupation Proficiencies
Tests for:
- Equipment catalog API endpoint /api/data/equipment-catalog
- Occupations API returns correct competencia_armas and competencia_armaduras fields
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestEquipmentCatalog:
    """Tests for /api/data/equipment-catalog endpoint"""
    
    def test_equipment_catalog_endpoint_returns_200(self):
        """Test that equipment catalog endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200
        print("✓ Equipment catalog endpoint returns 200")
    
    def test_equipment_catalog_has_all_categories(self):
        """Test that equipment catalog has all 4 categories"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        assert "armas" in data, "Missing 'armas' category"
        assert "armaduras" in data, "Missing 'armaduras' category"
        assert "herramientas" in data, "Missing 'herramientas' category"
        assert "equipo_general" in data, "Missing 'equipo_general' category"
        print("✓ Equipment catalog has all 4 categories")
    
    def test_armas_has_items(self):
        """Test that armas category has items"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        assert len(data["armas"]) > 0, "Armas category is empty"
        print(f"✓ Armas category has {len(data['armas'])} items")
    
    def test_armas_item_structure(self):
        """Test that armas items have correct structure"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        arma = data["armas"][0]
        assert "nombre" in arma, "Missing 'nombre' field"
        assert "precio" in arma, "Missing 'precio' field"
        assert "moneda" in arma, "Missing 'moneda' field"
        assert "peso_kg" in arma, "Missing 'peso_kg' field"
        print(f"✓ Armas item structure is correct: {arma['nombre']}")
    
    def test_armaduras_has_items(self):
        """Test that armaduras category has items"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        assert len(data["armaduras"]) > 0, "Armaduras category is empty"
        print(f"✓ Armaduras category has {len(data['armaduras'])} items")
    
    def test_armaduras_item_structure(self):
        """Test that armaduras items have correct structure"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        armadura = data["armaduras"][0]
        assert "nombre" in armadura, "Missing 'nombre' field"
        assert "precio" in armadura, "Missing 'precio' field"
        assert "peso_kg" in armadura, "Missing 'peso_kg' field"
        assert "clase_armadura" in armadura, "Missing 'clase_armadura' field"
        print(f"✓ Armaduras item structure is correct: {armadura['nombre']}")
    
    def test_herramientas_has_items(self):
        """Test that herramientas category has items"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        assert len(data["herramientas"]) > 0, "Herramientas category is empty"
        print(f"✓ Herramientas category has {len(data['herramientas'])} items")
    
    def test_equipo_general_has_items(self):
        """Test that equipo_general category has items"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        assert len(data["equipo_general"]) > 0, "Equipo general category is empty"
        print(f"✓ Equipo general category has {len(data['equipo_general'])} items")


class TestOccupationProficiencies:
    """Tests for occupation weapon/armor proficiencies"""
    
    def test_occupations_endpoint_returns_200(self):
        """Test that occupations endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        assert response.status_code == 200
        print("✓ Occupations endpoint returns 200")
    
    def test_occupations_returns_6_occupations(self):
        """Test that occupations endpoint returns 6 occupations"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        data = response.json()
        
        assert "occupations" in data, "Missing 'occupations' key"
        assert len(data["occupations"]) == 6, f"Expected 6 occupations, got {len(data['occupations'])}"
        print(f"✓ Occupations endpoint returns 6 occupations")
    
    def test_campeon_weapon_proficiencies(self):
        """Test that Campeón has correct weapon proficiencies"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        data = response.json()
        
        campeon = next((o for o in data["occupations"] if o["vocacion"] == "Campeón"), None)
        assert campeon is not None, "Campeón occupation not found"
        
        expected_armas = ["Armas sencillas", "Armas marciales"]
        assert campeon["competencia_armas"] == expected_armas, \
            f"Expected {expected_armas}, got {campeon['competencia_armas']}"
        print(f"✓ Campeón weapon proficiencies: {campeon['competencia_armas']}")
    
    def test_campeon_armor_proficiencies(self):
        """Test that Campeón has correct armor proficiencies"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        data = response.json()
        
        campeon = next((o for o in data["occupations"] if o["vocacion"] == "Campeón"), None)
        assert campeon is not None, "Campeón occupation not found"
        
        expected_armaduras = ["Armaduras ligeras", "Armaduras medias", "Armaduras pesadas", "Escudos"]
        assert campeon["competencia_armaduras"] == expected_armaduras, \
            f"Expected {expected_armaduras}, got {campeon['competencia_armaduras']}"
        print(f"✓ Campeón armor proficiencies: {campeon['competencia_armaduras']}")
    
    def test_all_occupations_have_proficiency_fields(self):
        """Test that all occupations have competencia_armas and competencia_armaduras fields"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        data = response.json()
        
        for occ in data["occupations"]:
            assert "competencia_armas" in occ, f"{occ['vocacion']} missing competencia_armas"
            assert "competencia_armaduras" in occ, f"{occ['vocacion']} missing competencia_armaduras"
            assert isinstance(occ["competencia_armas"], list), f"{occ['vocacion']} competencia_armas is not a list"
            assert isinstance(occ["competencia_armaduras"], list), f"{occ['vocacion']} competencia_armaduras is not a list"
            print(f"✓ {occ['vocacion']}: armas={occ['competencia_armas']}, armaduras={occ['competencia_armaduras']}")
    
    def test_proficiencies_not_mixed_with_descriptions(self):
        """Test that proficiencies are not mixed with descriptions"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        data = response.json()
        
        for occ in data["occupations"]:
            # Weapon proficiencies should only contain weapon types, not descriptions
            for arma in occ["competencia_armas"]:
                assert len(arma) < 50, f"Weapon proficiency too long (may contain description): {arma}"
                assert "." not in arma, f"Weapon proficiency contains period (may be description): {arma}"
            
            # Armor proficiencies should only contain armor types, not descriptions
            for armadura in occ["competencia_armaduras"]:
                assert len(armadura) < 50, f"Armor proficiency too long (may contain description): {armadura}"
                assert "." not in armadura, f"Armor proficiency contains period (may be description): {armadura}"
        
        print("✓ Proficiencies are not mixed with descriptions")
    
    def test_buscador_de_tesoros_proficiencies(self):
        """Test Buscador de tesoros proficiencies"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        data = response.json()
        
        buscador = next((o for o in data["occupations"] if o["vocacion"] == "Buscador de tesoros"), None)
        assert buscador is not None, "Buscador de tesoros not found"
        
        assert "Armas sencillas" in buscador["competencia_armas"]
        assert "Armaduras ligeras" in buscador["competencia_armaduras"]
        print(f"✓ Buscador de tesoros: armas={buscador['competencia_armas']}, armaduras={buscador['competencia_armaduras']}")
    
    def test_guardian_proficiencies(self):
        """Test Guardian proficiencies"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        data = response.json()
        
        guardian = next((o for o in data["occupations"] if o["vocacion"] == "Guardian"), None)
        assert guardian is not None, "Guardian not found"
        
        assert "Armas sencillas" in guardian["competencia_armas"]
        assert "Armas marciales" in guardian["competencia_armas"]
        assert "Armaduras ligeras" in guardian["competencia_armaduras"]
        assert "Armaduras medias" in guardian["competencia_armaduras"]
        assert "Escudos" in guardian["competencia_armaduras"]
        print(f"✓ Guardian: armas={guardian['competencia_armas']}, armaduras={guardian['competencia_armaduras']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
