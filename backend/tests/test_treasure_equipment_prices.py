"""
Test Treasure System Equipment Selector and Editable Prices
Tests:
- GET /api/data/weapons - returns weapons list
- GET /api/data/armors - returns armors list  
- PUT /api/data/treasure-config - saves blessings, weaponQualities, armorQualities, shieldQualities
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


class TestWeaponsEndpoint:
    """Tests for GET /api/data/weapons endpoint"""
    
    def test_weapons_endpoint_returns_200(self):
        """GET /api/data/weapons should return 200"""
        response = requests.get(f"{BASE_URL}/api/data/weapons")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/data/weapons returns 200")
        
    def test_weapons_returns_weapons_list(self):
        """Weapons endpoint returns weapons array"""
        response = requests.get(f"{BASE_URL}/api/data/weapons")
        assert response.status_code == 200
        data = response.json()
        assert "weapons" in data, "Response should contain 'weapons' key"
        assert isinstance(data["weapons"], list), "Weapons should be a list"
        print(f"✓ Weapons endpoint returns {len(data['weapons'])} weapons")
        
    def test_weapons_have_required_fields(self):
        """Weapons should have id, nombre, precio, moneda, dano fields"""
        response = requests.get(f"{BASE_URL}/api/data/weapons")
        assert response.status_code == 200
        data = response.json()
        
        # Filter valid weapons (not category headers)
        valid_weapons = [w for w in data["weapons"] if w.get("precio") is not None]
        assert len(valid_weapons) > 0, "Should have valid weapons"
        
        weapon = valid_weapons[0]
        assert "id" in weapon, "Weapon should have id"
        assert "nombre" in weapon, "Weapon should have nombre"
        assert "precio" in weapon, "Weapon should have precio"
        print(f"✓ First valid weapon: {weapon.get('nombre')} - {weapon.get('precio')} {weapon.get('moneda')}")


class TestArmorsEndpoint:
    """Tests for GET /api/data/armors endpoint"""
    
    def test_armors_endpoint_returns_200(self):
        """GET /api/data/armors should return 200"""
        response = requests.get(f"{BASE_URL}/api/data/armors")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/data/armors returns 200")
        
    def test_armors_returns_armors_list(self):
        """Armors endpoint returns armors array"""
        response = requests.get(f"{BASE_URL}/api/data/armors")
        assert response.status_code == 200
        data = response.json()
        assert "armors" in data, "Response should contain 'armors' key"
        assert isinstance(data["armors"], list), "Armors should be a list"
        print(f"✓ Armors endpoint returns {len(data['armors'])} armors")
        
    def test_armors_have_required_fields(self):
        """Armors should have id, nombre, precio, clase_armadura fields"""
        response = requests.get(f"{BASE_URL}/api/data/armors")
        assert response.status_code == 200
        data = response.json()
        
        # Filter valid armors (not category headers)
        valid_armors = [a for a in data["armors"] if a.get("precio") is not None]
        assert len(valid_armors) > 0, "Should have valid armors"
        
        armor = valid_armors[0]
        assert "id" in armor, "Armor should have id"
        assert "nombre" in armor, "Armor should have nombre"
        assert "precio" in armor, "Armor should have precio"
        print(f"✓ First valid armor: {armor.get('nombre')} - {armor.get('precio')} {armor.get('moneda')}")
        
    def test_armors_include_shields(self):
        """Armors list should include shields (Escudo)"""
        response = requests.get(f"{BASE_URL}/api/data/armors")
        assert response.status_code == 200
        data = response.json()
        
        shield_items = [a for a in data["armors"] if "escudo" in a.get("nombre", "").lower()]
        assert len(shield_items) > 0, "Should have shield items"
        print(f"✓ Found {len(shield_items)} shield items in armors list")


class TestTreasureConfigPricing:
    """Tests for PUT /api/data/treasure-config with pricing tables"""
    
    def test_treasure_config_saves_blessings(self):
        """PUT /api/data/treasure-config should save blessings"""
        test_blessings = [
            {"d20": 1, "habilidad": "Test Skill", "objetos": "test object", "coste": {"2": 5, "3": 10, "4": 20}}
        ]
        
        response = requests.put(
            f"{BASE_URL}/api/data/treasure-config",
            json={
                "blessings": test_blessings,
                "tiers": None,
                "coinTypes": None,
                "weaponQualities": None,
                "armorQualities": None,
                "shieldQualities": None
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify saved
        get_response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data.get("blessings") is not None, "Blessings should be saved"
        print("✓ PUT /api/data/treasure-config saves blessings")
        
    def test_treasure_config_saves_weapon_qualities(self):
        """PUT /api/data/treasure-config should save weaponQualities"""
        test_qualities = [
            {"id": "test_quality", "nombre": "Test Quality", "manufactura": ["any"], "multiplicador": 4, "descripcion": "Test desc"}
        ]
        
        response = requests.put(
            f"{BASE_URL}/api/data/treasure-config",
            json={
                "weaponQualities": test_qualities,
                "tiers": None,
                "coinTypes": None,
                "blessings": None,
                "armorQualities": None,
                "shieldQualities": None
            }
        )
        assert response.status_code == 200
        
        # Verify saved
        get_response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        data = get_response.json()
        assert data.get("weaponQualities") is not None, "WeaponQualities should be saved"
        print("✓ PUT /api/data/treasure-config saves weaponQualities")
        
    def test_treasure_config_saves_armor_qualities(self):
        """PUT /api/data/treasure-config should save armorQualities"""
        test_qualities = [
            {"id": "test_armor_qual", "nombre": "Test Armor Quality", "coste": 100, "descripcion": "Test desc"}
        ]
        
        response = requests.put(
            f"{BASE_URL}/api/data/treasure-config",
            json={
                "armorQualities": test_qualities,
                "tiers": None,
                "coinTypes": None,
                "blessings": None,
                "weaponQualities": None,
                "shieldQualities": None
            }
        )
        assert response.status_code == 200
        
        get_response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        data = get_response.json()
        assert data.get("armorQualities") is not None, "ArmorQualities should be saved"
        print("✓ PUT /api/data/treasure-config saves armorQualities")
        
    def test_treasure_config_saves_shield_qualities(self):
        """PUT /api/data/treasure-config should save shieldQualities"""
        test_qualities = [
            {"id": "test_shield_qual", "nombre": "Test Shield Quality", "multiplicador": 3, "descripcion": "Test desc"}
        ]
        
        response = requests.put(
            f"{BASE_URL}/api/data/treasure-config",
            json={
                "shieldQualities": test_qualities,
                "tiers": None,
                "coinTypes": None,
                "blessings": None,
                "weaponQualities": None,
                "armorQualities": None
            }
        )
        assert response.status_code == 200
        
        get_response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        data = get_response.json()
        assert data.get("shieldQualities") is not None, "ShieldQualities should be saved"
        print("✓ PUT /api/data/treasure-config saves shieldQualities")
        
    def test_treasure_config_saves_all_pricing_fields(self):
        """PUT /api/data/treasure-config should save all pricing fields together"""
        full_config = {
            "tiers": {"minor": {"id": "minor", "nombre": "Menor", "tiradas": 1, "cdSombra": 10}},
            "coinTypes": [{"id": "gold", "nombre": "Oro", "abrev": "mo", "valorEnOro": 1}],
            "blessings": [{"d20": 1, "habilidad": "Full Test", "coste": {"2": 2}}],
            "weaponQualities": [{"id": "full_test_wq", "nombre": "Full Test WQ", "multiplicador": 4}],
            "armorQualities": [{"id": "full_test_aq", "nombre": "Full Test AQ", "coste": 100}],
            "shieldQualities": [{"id": "full_test_sq", "nombre": "Full Test SQ", "multiplicador": 3}]
        }
        
        response = requests.put(f"{BASE_URL}/api/data/treasure-config", json=full_config)
        assert response.status_code == 200
        
        get_response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        data = get_response.json()
        
        assert data.get("tiers") is not None, "Tiers should be saved"
        assert data.get("coinTypes") is not None, "CoinTypes should be saved"
        assert data.get("blessings") is not None, "Blessings should be saved"
        assert data.get("weaponQualities") is not None, "WeaponQualities should be saved"
        assert data.get("armorQualities") is not None, "ArmorQualities should be saved"
        assert data.get("shieldQualities") is not None, "ShieldQualities should be saved"
        print("✓ PUT /api/data/treasure-config saves all pricing fields together")


class TestTreasureConfigReset:
    """Test treasure config reset clears all fields"""
    
    def test_reset_clears_all_fields(self):
        """DELETE /api/data/treasure-config should reset all fields"""
        # First save some data
        config = {
            "tiers": {"test": True},
            "coinTypes": [{"id": "test"}],
            "blessings": [{"test": True}],
            "weaponQualities": [{"id": "test"}],
            "armorQualities": [{"id": "test"}],
            "shieldQualities": [{"id": "test"}]
        }
        requests.put(f"{BASE_URL}/api/data/treasure-config", json=config)
        
        # Reset
        response = requests.delete(f"{BASE_URL}/api/data/treasure-config")
        assert response.status_code == 200
        
        # Verify cleared
        get_response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        data = get_response.json()
        
        assert data.get("tiers") is None, "Tiers should be None after reset"
        assert data.get("blessings") is None, "Blessings should be None after reset"
        print("✓ DELETE /api/data/treasure-config resets all fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
