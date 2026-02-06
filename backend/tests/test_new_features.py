"""
Test new features: Sombra, Artes, Recompensas, Virtudes, Monturas, Equipment Editor
Tests for iteration 15 - LOTR 5e RPG app
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSombraEndpoint:
    """Test /api/data/sombra endpoint - Shadow rules"""
    
    def test_sombra_returns_all_sections(self):
        """Sombra endpoint should return pavor, avaricia, fechorias, estados, sendas_sombra"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        assert response.status_code == 200
        data = response.json()
        
        # Verify all sections exist
        assert "pavor" in data, "Missing pavor section"
        assert "avaricia" in data, "Missing avaricia section"
        assert "fechorias" in data, "Missing fechorias section"
        assert "estados" in data, "Missing estados section"
        assert "sendas_sombra" in data, "Missing sendas_sombra section"
    
    def test_sombra_pavor_count(self):
        """Pavor should have 4 entries"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        data = response.json()
        assert len(data["pavor"]) == 4, f"Expected 4 pavor entries, got {len(data['pavor'])}"
    
    def test_sombra_avaricia_count(self):
        """Avaricia should have 4 entries"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        data = response.json()
        assert len(data["avaricia"]) == 4, f"Expected 4 avaricia entries, got {len(data['avaricia'])}"
    
    def test_sombra_fechorias_count(self):
        """Fechorias should have 5 entries"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        data = response.json()
        assert len(data["fechorias"]) == 5, f"Expected 5 fechorias entries, got {len(data['fechorias'])}"
    
    def test_sombra_estados_count(self):
        """Estados should have 3 entries"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        data = response.json()
        assert len(data["estados"]) == 3, f"Expected 3 estados entries, got {len(data['estados'])}"
    
    def test_sombra_sendas_count(self):
        """Sendas_sombra should have 24 entries"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        data = response.json()
        assert len(data["sendas_sombra"]) == 24, f"Expected 24 sendas_sombra entries, got {len(data['sendas_sombra'])}"
    
    def test_sombra_pavor_structure(self):
        """Pavor entries should have fuente, ejemplo, puntos_sombra"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        data = response.json()
        for entry in data["pavor"]:
            assert "fuente" in entry, "Pavor entry missing fuente"
            assert "ejemplo" in entry, "Pavor entry missing ejemplo"
            assert "puntos_sombra" in entry, "Pavor entry missing puntos_sombra"
    
    def test_sombra_estados_structure(self):
        """Estados entries should have nombre, condicion, efectos"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        data = response.json()
        for entry in data["estados"]:
            assert "nombre" in entry, "Estado entry missing nombre"
            assert "condicion" in entry, "Estado entry missing condicion"
            assert "efectos" in entry, "Estado entry missing efectos"


class TestArtesEndpoint:
    """Test /api/data/artes endpoint - Arts"""
    
    def test_artes_returns_list(self):
        """Artes endpoint should return list of arts"""
        response = requests.get(f"{BASE_URL}/api/data/artes")
        assert response.status_code == 200
        data = response.json()
        assert "artes" in data, "Missing artes key"
    
    def test_artes_count(self):
        """Should have 8 arts"""
        response = requests.get(f"{BASE_URL}/api/data/artes")
        data = response.json()
        assert len(data["artes"]) == 8, f"Expected 8 artes, got {len(data['artes'])}"
    
    def test_artes_structure(self):
        """Each arte should have nombre, descripcion_corta, descripcion"""
        response = requests.get(f"{BASE_URL}/api/data/artes")
        data = response.json()
        for arte in data["artes"]:
            assert "nombre" in arte, "Arte missing nombre"
            assert "descripcion_corta" in arte or "descripcion" in arte, "Arte missing description"


class TestRecompensasEndpoint:
    """Test /api/data/recompensas endpoint - Rewards"""
    
    def test_recompensas_returns_data(self):
        """Recompensas endpoint should return mejoras_equipo and niveles_recompensa"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        assert response.status_code == 200
        data = response.json()
        assert "mejoras_equipo" in data, "Missing mejoras_equipo"
        assert "niveles_recompensa" in data, "Missing niveles_recompensa"
    
    def test_recompensas_mejoras_count(self):
        """Should have 6 mejoras_equipo"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        data = response.json()
        assert len(data["mejoras_equipo"]) == 6, f"Expected 6 mejoras_equipo, got {len(data['mejoras_equipo'])}"
    
    def test_recompensas_mejoras_structure(self):
        """Each mejora should have tipo, nombre, efecto_mecanico"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        data = response.json()
        for mejora in data["mejoras_equipo"]:
            assert "tipo" in mejora, "Mejora missing tipo"
            assert "nombre" in mejora, "Mejora missing nombre"
            assert "efecto_mecanico" in mejora, "Mejora missing efecto_mecanico"


class TestVirtudesEndpoint:
    """Test /api/data/virtudes endpoint - Virtues with complete data"""
    
    def test_virtudes_returns_list(self):
        """Virtudes endpoint should return list of virtues"""
        response = requests.get(f"{BASE_URL}/api/data/virtudes")
        assert response.status_code == 200
        data = response.json()
        assert "virtudes" in data, "Missing virtudes key"
    
    def test_virtudes_count(self):
        """Should have 100 virtues"""
        response = requests.get(f"{BASE_URL}/api/data/virtudes")
        data = response.json()
        assert len(data["virtudes"]) == 100, f"Expected 100 virtudes, got {len(data['virtudes'])}"
    
    def test_virtudes_have_description(self):
        """Each virtue should have nombre and descripcion"""
        response = requests.get(f"{BASE_URL}/api/data/virtudes")
        data = response.json()
        for v in data["virtudes"]:
            assert "nombre" in v, "Virtue missing nombre"
            # descripcion may be empty but should exist
            assert "descripcion" in v or "rasgos_virtud" in v, f"Virtue {v.get('nombre')} missing description fields"
    
    def test_virtudes_have_rasgos(self):
        """Some virtues should have rasgos_virtud (traits)"""
        response = requests.get(f"{BASE_URL}/api/data/virtudes")
        data = response.json()
        virtues_with_rasgos = [v for v in data["virtudes"] if v.get("rasgos_virtud")]
        assert len(virtues_with_rasgos) > 0, "No virtues have rasgos_virtud"


class TestMonturasData:
    """Test monturas in equipment catalog - should have capacidad_pequeno and capacidad_mediano"""
    
    def test_monturas_count(self):
        """Should have 15 mounts"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog?categoria=monturas")
        assert response.status_code == 200
        data = response.json()
        assert "monturas" in data, "Missing monturas key"
        assert len(data["monturas"]) == 15, f"Expected 15 monturas, got {len(data['monturas'])}"
    
    def test_monturas_have_capacidad_columns(self):
        """Each mount should have capacidad_pequeno and capacidad_mediano"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog?categoria=monturas")
        data = response.json()
        for mount in data["monturas"]:
            assert "capacidad_pequeno" in mount, f"Mount {mount.get('nombre')} missing capacidad_pequeno"
            assert "capacidad_mediano" in mount, f"Mount {mount.get('nombre')} missing capacidad_mediano"
    
    def test_monturas_capacidad_values(self):
        """Capacidad values should be boolean"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog?categoria=monturas")
        data = response.json()
        for mount in data["monturas"]:
            assert isinstance(mount["capacidad_pequeno"], bool), f"capacidad_pequeno should be bool for {mount['nombre']}"
            assert isinstance(mount["capacidad_mediano"], bool), f"capacidad_mediano should be bool for {mount['nombre']}"
    
    def test_monturas_have_all_fields(self):
        """Mounts should have nombre, precio, capacidad_carga, constitucion, velocidad"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog?categoria=monturas")
        data = response.json()
        required_fields = ["nombre", "precio", "capacidad_carga", "constitucion", "velocidad"]
        for mount in data["monturas"]:
            for field in required_fields:
                assert field in mount, f"Mount {mount.get('nombre')} missing {field}"


class TestEquipmentCategories:
    """Test equipment categories endpoint for equipment editor"""
    
    def test_equipment_categories_returns_list(self):
        """Should return list of 21 equipment categories"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data, "Missing categories key"
        assert len(data["categories"]) == 21, f"Expected 21 categories, got {len(data['categories'])}"
    
    def test_equipment_categories_have_fields(self):
        """Each category should have key, name, fields"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-categories")
        data = response.json()
        for cat in data["categories"]:
            assert "key" in cat, "Category missing key"
            assert "name" in cat, "Category missing name"
            assert "fields" in cat, "Category missing fields"
            assert isinstance(cat["fields"], list), "Fields should be a list"


class TestEquipmentCRUD:
    """Test equipment CRUD operations"""
    
    def test_create_equipment_item(self):
        """Should be able to create a new equipment item"""
        test_item = {
            "categoria": "equipo_general",
            "nombre": "TEST_Item_Prueba",
            "precio": 10,
            "moneda": "mp",
            "peso_kg": 1.5
        }
        response = requests.post(f"{BASE_URL}/api/data/equipment", json=test_item)
        assert response.status_code == 200, f"Failed to create equipment: {response.text}"
        
        # Verify it was created
        catalog_response = requests.get(f"{BASE_URL}/api/data/equipment-catalog?categoria=equipo_general")
        data = catalog_response.json()
        items = [i for i in data.get("equipo_general", []) if i.get("nombre") == "TEST_Item_Prueba"]
        assert len(items) > 0, "Created item not found in catalog"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/equipment/equipo_general/TEST_Item_Prueba")
    
    def test_delete_equipment_item(self):
        """Should be able to delete an equipment item"""
        # First create
        test_item = {
            "categoria": "equipo_general",
            "nombre": "TEST_Delete_Item",
            "precio": 5,
            "moneda": "mp"
        }
        requests.post(f"{BASE_URL}/api/data/equipment", json=test_item)
        
        # Then delete
        response = requests.delete(f"{BASE_URL}/api/data/equipment/equipo_general/TEST_Delete_Item")
        assert response.status_code == 200, f"Failed to delete: {response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
