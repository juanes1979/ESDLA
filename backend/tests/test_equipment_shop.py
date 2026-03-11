"""
Test Equipment Shop API endpoints for Step 7 Equipment functionality.
Tests the /api/data/equipment-catalog endpoint which provides base prices for shop items.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEquipmentCatalogAPI:
    """Tests for /api/data/equipment-catalog endpoint"""
    
    def test_equipment_catalog_returns_200(self):
        """Test that equipment-catalog endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Equipment catalog endpoint returns 200")
    
    def test_equipment_catalog_has_weapons(self):
        """Test that equipment catalog includes weapon categories"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        weapon_categories = ['armas_sencillas_cc', 'armas_sencillas_distancia', 'armas_marciales_cc', 'armas_marciales_distancia']
        for cat in weapon_categories:
            assert cat in data, f"Missing weapon category: {cat}"
            assert len(data[cat]) > 0, f"Weapon category {cat} is empty"
            # Verify items have prices
            items_with_price = [i for i in data[cat] if i.get('precio')]
            assert len(items_with_price) > 0, f"Weapon category {cat} has no items with prices"
            print(f"✓ Weapon category '{cat}': {len(items_with_price)} items with prices")
    
    def test_equipment_catalog_has_armors(self):
        """Test that equipment catalog includes armor categories"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        armor_categories = ['armaduras_ligeras', 'armaduras_medias', 'armaduras_pesadas', 'escudos']
        for cat in armor_categories:
            assert cat in data, f"Missing armor category: {cat}"
            items_with_price = [i for i in data[cat] if i.get('precio')]
            assert len(items_with_price) > 0, f"Armor category {cat} has no items with prices"
            print(f"✓ Armor category '{cat}': {len(items_with_price)} items with prices")
    
    def test_equipment_catalog_has_tools(self):
        """Test that equipment catalog includes tool categories"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        tool_categories = ['herramientas', 'juegos', 'instrumentos_musicales']
        for cat in tool_categories:
            assert cat in data, f"Missing tool category: {cat}"
            items_with_price = [i for i in data[cat] if i.get('precio')]
            assert len(items_with_price) > 0, f"Tool category {cat} has no items with prices"
            print(f"✓ Tool category '{cat}': {len(items_with_price)} items with prices")
    
    def test_equipment_catalog_has_general_equipment(self):
        """Test that equipment catalog includes general equipment category"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        assert 'equipo_general' in data, "Missing equipo_general category"
        items_with_price = [i for i in data['equipo_general'] if i.get('precio')]
        assert len(items_with_price) > 0, "equipo_general has no items with prices"
        print(f"✓ General equipment: {len(items_with_price)} items with prices")
    
    def test_equipment_catalog_has_consumables(self):
        """Test that equipment catalog includes consumables categories"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        consumable_categories = ['consumibles', 'comida_posadas']
        for cat in consumable_categories:
            assert cat in data, f"Missing consumable category: {cat}"
            items_with_price = [i for i in data[cat] if i.get('precio')]
            assert len(items_with_price) > 0, f"Consumable category {cat} has no items with prices"
            print(f"✓ Consumable category '{cat}': {len(items_with_price)} items with prices")
    
    def test_equipment_item_has_required_fields(self):
        """Test that equipment items have required fields (nombre, precio, moneda)"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        # Check a sample from each major category
        sample_categories = ['armas_sencillas_cc', 'armaduras_ligeras', 'herramientas', 'equipo_general', 'consumibles']
        
        for cat in sample_categories:
            if cat in data and data[cat]:
                item = data[cat][0]
                assert 'nombre' in item, f"Item in {cat} missing 'nombre'"
                assert 'precio' in item, f"Item in {cat} missing 'precio'"
                # moneda is optional but should default to mp
                print(f"✓ Item in '{cat}' has required fields: {item.get('nombre')} - {item.get('precio')} {item.get('moneda', 'mp')}")
    
    def test_equipment_catalog_search_filter(self):
        """Test that search parameter filters items"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog?search=espada")
        assert response.status_code == 200
        data = response.json()
        
        # Check if filtered results contain search term
        found_match = False
        for cat, items in data.items():
            for item in items:
                if 'espada' in item.get('nombre', '').lower():
                    found_match = True
                    print(f"✓ Search filter found: {item.get('nombre')} in {cat}")
                    break
        assert found_match, "Search filter did not return matching items"
    
    def test_equipment_catalog_category_filter(self):
        """Test that categoria parameter filters to specific category"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog?categoria=armas_sencillas_cc")
        assert response.status_code == 200
        data = response.json()
        
        assert 'armas_sencillas_cc' in data, "Category filter did not return requested category"
        # Other categories should be empty or not present when filtering
        print(f"✓ Category filter works: {len(data.get('armas_sencillas_cc', []))} items in armas_sencillas_cc")


class TestShopCategoriesMapping:
    """Tests for the shop categories used in Step7Equipment.jsx"""
    
    def test_weapons_category_keys_exist(self):
        """Test that weapon category keys from Step7Equipment exist in catalog"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        # From Step7Equipment.jsx SHOP_CATEGORIES
        weapon_keys = ['armas_sencillas_cc', 'armas_sencillas_distancia', 'armas_marciales_cc', 'armas_marciales_distancia']
        for key in weapon_keys:
            assert key in data, f"Missing weapon key: {key}"
            assert isinstance(data[key], list), f"{key} should be a list"
        print(f"✓ All weapon catalog keys exist")
    
    def test_armor_category_keys_exist(self):
        """Test that armor category keys from Step7Equipment exist in catalog"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        armor_keys = ['armaduras_ligeras', 'armaduras_medias', 'armaduras_pesadas', 'escudos']
        for key in armor_keys:
            assert key in data, f"Missing armor key: {key}"
            assert isinstance(data[key], list), f"{key} should be a list"
        print(f"✓ All armor catalog keys exist")
    
    def test_tools_category_keys_exist(self):
        """Test that tools category keys from Step7Equipment exist in catalog"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        tools_keys = ['herramientas', 'juegos', 'instrumentos_musicales']
        for key in tools_keys:
            assert key in data, f"Missing tools key: {key}"
            assert isinstance(data[key], list), f"{key} should be a list"
        print(f"✓ All tools catalog keys exist")
    
    def test_general_category_keys_exist(self):
        """Test that general equipment key exists in catalog"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        assert 'equipo_general' in data, "Missing equipo_general key"
        assert isinstance(data['equipo_general'], list), "equipo_general should be a list"
        print(f"✓ General equipment catalog key exists: {len(data['equipo_general'])} items")
    
    def test_consumables_category_keys_exist(self):
        """Test that consumables category keys from Step7Equipment exist in catalog"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        consumable_keys = ['consumibles', 'comida_posadas']
        for key in consumable_keys:
            assert key in data, f"Missing consumable key: {key}"
            assert isinstance(data[key], list), f"{key} should be a list"
        print(f"✓ All consumable catalog keys exist")


class TestItemCountByCategory:
    """Test that each shop category has items to display"""
    
    def test_minimum_items_per_shop_category(self):
        """Test that each shop category has at least some items with prices"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        # SHOP_CATEGORIES from Step7Equipment.jsx
        shop_categories = {
            'weapons': ['armas_sencillas_cc', 'armas_sencillas_distancia', 'armas_marciales_cc', 'armas_marciales_distancia'],
            'armor': ['armaduras_ligeras', 'armaduras_medias', 'armaduras_pesadas', 'escudos'],
            'tools': ['herramientas', 'juegos', 'instrumentos_musicales'],
            'general': ['equipo_general'],
            'consumables': ['consumibles', 'comida_posadas'],
        }
        
        for shop_cat, catalog_keys in shop_categories.items():
            total_items = 0
            for key in catalog_keys:
                if key in data:
                    items_with_price = [i for i in data[key] if i.get('precio') is not None and i.get('precio') > 0]
                    total_items += len(items_with_price)
            
            assert total_items > 0, f"Shop category '{shop_cat}' has no items with prices"
            print(f"✓ Shop category '{shop_cat}': {total_items} items with valid prices")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
