"""
Test Suite for LOTR 5e RPG Treasure Configuration System
Tests the editable treasure generation parameters - coin types, dice rolls, magic roll counts
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test coin types configuration
TEST_COIN_TYPES = [
    {"id": "tin", "nombre": "Estaño", "abrev": "me", "color": "bg-gray-500", "valorEnOro": 0.001},
    {"id": "copper", "nombre": "Cobre", "abrev": "mc", "color": "bg-orange-700", "valorEnOro": 0.01},
    {"id": "silver", "nombre": "Plata", "abrev": "mp", "color": "bg-slate-400", "valorEnOro": 0.1},
    {"id": "gold", "nombre": "Oro", "abrev": "mo", "color": "bg-yellow-500", "valorEnOro": 1}
]

# Test tiers configuration
TEST_TIERS = {
    "minor": {
        "id": "minor",
        "nombre": "Menor",
        "tiradas": 1,
        "cdSombra": 10,
        "color": "bg-green-600",
        "monedas": [
            {"id": "tin", "dado": "3d6", "activo": True},
            {"id": "copper", "dado": "2d8", "activo": True},
            {"id": "silver", "dado": "1d6", "activo": True},
            {"id": "gold", "dado": "0", "activo": False}
        ]
    },
    "major": {
        "id": "major",
        "nombre": "Mayor",
        "cdSombra": 15,
        "tiradas": 2,
        "color": "bg-blue-600",
        "monedas": [
            {"id": "tin", "dado": "0", "activo": False},
            {"id": "copper", "dado": "3d10", "activo": True},
            {"id": "silver", "dado": "2d8", "activo": True},
            {"id": "gold", "dado": "1d6", "activo": True}
        ]
    },
    "wondrous": {
        "id": "wondrous",
        "nombre": "Maravilloso",
        "cdSombra": 20,
        "tiradas": 3,
        "color": "bg-purple-600",
        "monedas": [
            {"id": "tin", "dado": "0", "activo": False},
            {"id": "copper", "dado": "0", "activo": False},
            {"id": "silver", "dado": "4d10", "activo": True},
            {"id": "gold", "dado": "2d8", "activo": True}
        ]
    }
}


class TestTreasureConfigAPI:
    """Tests for GET/PUT/DELETE /api/data/treasure-config"""
    
    def test_get_treasure_config_returns_defaults(self):
        """Test GET treasure-config returns config or defaults"""
        response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        assert response.status_code == 200
        data = response.json()
        # Should have tiers and coinTypes keys (may be null for defaults)
        assert "tiers" in data
        assert "coinTypes" in data
        print(f"✓ GET treasure-config returns: tiers={data.get('tiers') is not None}, coinTypes={data.get('coinTypes') is not None}")
    
    def test_put_treasure_config_saves_configuration(self):
        """Test PUT treasure-config saves custom configuration"""
        payload = {
            "tiers": TEST_TIERS,
            "coinTypes": TEST_COIN_TYPES
        }
        
        response = requests.put(
            f"{BASE_URL}/api/data/treasure-config",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Treasure configuration saved successfully"
        print(f"✓ PUT treasure-config successful: {data}")
    
    def test_get_treasure_config_after_save(self):
        """Test GET treasure-config returns saved configuration"""
        response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        assert response.status_code == 200
        data = response.json()
        
        # Verify tiers were saved
        assert data.get("tiers") is not None, "Tiers should be saved"
        tiers = data["tiers"]
        
        # Check minor tier
        assert "minor" in tiers
        assert tiers["minor"]["tiradas"] == 1
        assert tiers["minor"]["cdSombra"] == 10
        
        # Check major tier
        assert "major" in tiers
        assert tiers["major"]["tiradas"] == 2
        assert tiers["major"]["cdSombra"] == 15
        
        # Check wondrous tier
        assert "wondrous" in tiers
        assert tiers["wondrous"]["tiradas"] == 3
        assert tiers["wondrous"]["cdSombra"] == 20
        
        print(f"✓ GET treasure-config returns saved tiers correctly")
    
    def test_treasure_config_coin_types_persistence(self):
        """Test that coin types are persisted correctly"""
        response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("coinTypes") is not None, "Coin types should be saved"
        coin_types = data["coinTypes"]
        
        # Verify all 4 default coin types
        coin_ids = [c["id"] for c in coin_types]
        assert "tin" in coin_ids
        assert "copper" in coin_ids
        assert "silver" in coin_ids
        assert "gold" in coin_ids
        
        # Check gold value conversion
        gold_coin = next(c for c in coin_types if c["id"] == "gold")
        assert gold_coin["valorEnOro"] == 1
        assert gold_coin["abrev"] == "mo"
        
        print(f"✓ Coin types persisted correctly: {len(coin_types)} types")
    
    def test_treasure_config_monedas_per_tier(self):
        """Test that coin dice rolls per tier are saved correctly"""
        response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        data = response.json()
        tiers = data.get("tiers", {})
        
        # Verify minor tier coin rolls
        minor_monedas = tiers.get("minor", {}).get("monedas", [])
        tin_coin = next((m for m in minor_monedas if m["id"] == "tin"), None)
        assert tin_coin is not None
        assert tin_coin["dado"] == "3d6"
        assert tin_coin["activo"] == True
        
        gold_coin = next((m for m in minor_monedas if m["id"] == "gold"), None)
        assert gold_coin is not None
        assert gold_coin["activo"] == False  # Gold not active in minor
        
        print(f"✓ Tier coin configurations verified")
    
    def test_put_treasure_config_modified_values(self):
        """Test updating configuration with modified values"""
        # Modify the configuration
        modified_tiers = TEST_TIERS.copy()
        modified_tiers["minor"]["tiradas"] = 2  # Change from 1 to 2
        modified_tiers["minor"]["cdSombra"] = 12  # Change from 10 to 12
        
        # Add custom coin type
        modified_coins = TEST_COIN_TYPES.copy()
        modified_coins.append({
            "id": "custom_mithril",
            "nombre": "Mithril",
            "abrev": "mm",
            "color": "bg-cyan-500",
            "valorEnOro": 100
        })
        
        payload = {
            "tiers": modified_tiers,
            "coinTypes": modified_coins
        }
        
        response = requests.put(
            f"{BASE_URL}/api/data/treasure-config",
            json=payload
        )
        assert response.status_code == 200
        
        # Verify modifications
        verify_response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        data = verify_response.json()
        
        assert data["tiers"]["minor"]["tiradas"] == 2
        assert data["tiers"]["minor"]["cdSombra"] == 12
        
        # Check custom coin was added
        mithril = next((c for c in data["coinTypes"] if c["id"] == "custom_mithril"), None)
        assert mithril is not None
        assert mithril["valorEnOro"] == 100
        
        print(f"✓ Modified configuration saved and verified")
    
    def test_delete_treasure_config_resets_to_defaults(self):
        """Test DELETE treasure-config resets to defaults"""
        response = requests.delete(f"{BASE_URL}/api/data/treasure-config")
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Treasure configuration reset to defaults"
        print(f"✓ DELETE treasure-config successful: {data}")
    
    def test_get_after_delete_returns_nulls(self):
        """Test GET after DELETE returns null/default values"""
        response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        assert response.status_code == 200
        data = response.json()
        
        # After reset, tiers and coinTypes should be null
        assert data.get("tiers") is None, "Tiers should be null after reset"
        assert data.get("coinTypes") is None, "Coin types should be null after reset"
        
        print(f"✓ Configuration reset to defaults (null values)")
    
    def test_put_partial_config(self):
        """Test PUT with only tiers (no coinTypes)"""
        payload = {
            "tiers": TEST_TIERS
            # coinTypes omitted
        }
        
        response = requests.put(
            f"{BASE_URL}/api/data/treasure-config",
            json=payload
        )
        assert response.status_code == 200
        
        # Verify
        verify_response = requests.get(f"{BASE_URL}/api/data/treasure-config")
        data = verify_response.json()
        
        assert data.get("tiers") is not None
        # coinTypes may be None since we didn't send it
        print(f"✓ Partial config (tiers only) saved successfully")


class TestTreasureConfigEdgeCases:
    """Tests for edge cases and error handling"""
    
    def test_empty_tiers_save(self):
        """Test saving empty tiers object"""
        payload = {
            "tiers": {},
            "coinTypes": []
        }
        
        response = requests.put(
            f"{BASE_URL}/api/data/treasure-config",
            json=payload
        )
        assert response.status_code == 200
        print(f"✓ Empty config saved without error")
    
    def test_invalid_dice_notation(self):
        """Test that invalid dice notation is accepted (frontend validates)"""
        modified_tiers = TEST_TIERS.copy()
        modified_tiers["minor"]["monedas"][0]["dado"] = "invalid_dice"
        
        payload = {
            "tiers": modified_tiers,
            "coinTypes": TEST_COIN_TYPES
        }
        
        response = requests.put(
            f"{BASE_URL}/api/data/treasure-config",
            json=payload
        )
        # Should save (validation is on frontend)
        assert response.status_code == 200
        print(f"✓ Invalid dice notation accepted (frontend validation)")
    
    def test_multiple_reset_operations(self):
        """Test multiple DELETE operations are idempotent"""
        # First reset
        response1 = requests.delete(f"{BASE_URL}/api/data/treasure-config")
        assert response1.status_code == 200
        
        # Second reset (should not error)
        response2 = requests.delete(f"{BASE_URL}/api/data/treasure-config")
        assert response2.status_code == 200
        
        print(f"✓ Multiple reset operations are idempotent")


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_config():
    """Reset configuration after all tests"""
    yield
    try:
        requests.delete(f"{BASE_URL}/api/data/treasure-config")
        print("✓ Cleaned up test treasure configuration")
    except Exception as e:
        print(f"Warning: Cleanup failed: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
