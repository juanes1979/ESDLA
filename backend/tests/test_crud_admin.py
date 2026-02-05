"""
Backend API Tests for Admin CRUD Operations
Tests for Races, Cultures, Backgrounds, Occupations CRUD endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRacesCRUD:
    """Test CRUD operations for Races"""
    
    def test_get_races(self):
        """GET /api/data/races - should return list of races"""
        response = requests.get(f"{BASE_URL}/api/data/races")
        assert response.status_code == 200
        data = response.json()
        assert "races" in data
        assert isinstance(data["races"], list)
        print(f"Found {len(data['races'])} races")
    
    def test_create_race(self):
        """POST /api/data/races - should create new race"""
        test_name = f"TEST_Race_{uuid.uuid4().hex[:8]}"
        payload = {
            "nombre": test_name,
            "descripcion": "Test race description",
            "imc_min": 18.5,
            "imc_max": 24.5
        }
        response = requests.post(f"{BASE_URL}/api/data/races", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["nombre"] == test_name
        assert "id" in data
        print(f"Created race: {data['nombre']} with id: {data['id']}")
        
        # Store for cleanup
        self.__class__.created_race_id = data["id"]
        self.__class__.created_race_name = test_name
    
    def test_update_race(self):
        """PUT /api/data/races/{id} - should update race"""
        if not hasattr(self.__class__, 'created_race_id'):
            pytest.skip("No race created to update")
        
        race_id = self.__class__.created_race_id
        payload = {
            "descripcion": "Updated test description"
        }
        response = requests.put(f"{BASE_URL}/api/data/races/{race_id}", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["descripcion"] == "Updated test description"
        print(f"Updated race: {data['nombre']}")
    
    def test_delete_race(self):
        """DELETE /api/data/races/{id} - should delete race"""
        if not hasattr(self.__class__, 'created_race_id'):
            pytest.skip("No race created to delete")
        
        race_id = self.__class__.created_race_id
        response = requests.delete(f"{BASE_URL}/api/data/races/{race_id}")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Deleted race with id: {race_id}")


class TestCulturesCRUD:
    """Test CRUD operations for Cultures"""
    
    def test_get_cultures(self):
        """GET /api/data/cultures - should return list of cultures"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        assert response.status_code == 200
        data = response.json()
        assert "cultures" in data
        assert isinstance(data["cultures"], list)
        print(f"Found {len(data['cultures'])} cultures")
    
    def test_create_culture(self):
        """POST /api/data/cultures - should create new culture"""
        test_name = f"TEST_Culture_{uuid.uuid4().hex[:8]}"
        payload = {
            "nombre": test_name,
            "raza": "Hombres",
            "descripcion": "Test culture description",
            "nivel_vida": "Común",
            "edad_min": 20,
            "edad_max": 80,
            "altura_min": 160,
            "altura_max": 190,
            "velocidad": 9,
            "descanso": 8,
            "tamanio": "Mediano",
            "bonificadores_caracteristicas": {
                "fuerza": 1, "destreza": 0, "constitucion": 1,
                "inteligencia": 0, "sabiduria": 0, "carisma": 0
            },
            "idiomas": ["OESTRÓN 5"],
            "competencias_habilidades": ["Atletismo"]
        }
        response = requests.post(f"{BASE_URL}/api/data/cultures", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["nombre"] == test_name
        assert data["raza"] == "Hombres"
        assert "id" in data
        print(f"Created culture: {data['nombre']} with id: {data['id']}")
        
        # Store for cleanup
        self.__class__.created_culture_id = data["id"]
        self.__class__.created_culture_name = test_name
    
    def test_update_culture(self):
        """PUT /api/data/cultures/{id} - should update culture"""
        if not hasattr(self.__class__, 'created_culture_id'):
            pytest.skip("No culture created to update")
        
        culture_id = self.__class__.created_culture_id
        payload = {
            "descripcion": "Updated test culture description",
            "nivel_vida": "Próspero"
        }
        response = requests.put(f"{BASE_URL}/api/data/cultures/{culture_id}", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["descripcion"] == "Updated test culture description"
        assert data["nivel_vida"] == "Próspero"
        print(f"Updated culture: {data['nombre']}")
    
    def test_delete_culture(self):
        """DELETE /api/data/cultures/{id} - should delete culture"""
        if not hasattr(self.__class__, 'created_culture_id'):
            pytest.skip("No culture created to delete")
        
        culture_id = self.__class__.created_culture_id
        response = requests.delete(f"{BASE_URL}/api/data/cultures/{culture_id}")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Deleted culture with id: {culture_id}")


class TestBackgroundsCRUD:
    """Test CRUD operations for Backgrounds"""
    
    def test_get_backgrounds(self):
        """GET /api/data/backgrounds - should return list of backgrounds"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds")
        assert response.status_code == 200
        data = response.json()
        assert "backgrounds" in data
        assert isinstance(data["backgrounds"], list)
        print(f"Found {len(data['backgrounds'])} backgrounds")
    
    def test_create_background(self):
        """POST /api/data/backgrounds - should create new background"""
        test_name = f"TEST_Background_{uuid.uuid4().hex[:8]}"
        payload = {
            "nombre": test_name,
            "descripcion": "Test background description",
            "competencias_habilidades_auto": ["Atletismo", "Percepción"],
            "competencias_habilidades_elegir": ["Sigilo", "Engaño"],
            "competencias_herramientas_1": ["Herramientas de carpintería"],
            "rasgos_descripciones": ["Rasgo 1: Test trait"]
        }
        response = requests.post(f"{BASE_URL}/api/data/backgrounds", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["nombre"] == test_name
        assert "id" in data
        print(f"Created background: {data['nombre']} with id: {data['id']}")
        
        # Store for cleanup
        self.__class__.created_background_id = data["id"]
        self.__class__.created_background_name = test_name
    
    def test_update_background(self):
        """PUT /api/data/backgrounds/{id} - should update background"""
        if not hasattr(self.__class__, 'created_background_id'):
            pytest.skip("No background created to update")
        
        bg_id = self.__class__.created_background_id
        payload = {
            "descripcion": "Updated test background description"
        }
        response = requests.put(f"{BASE_URL}/api/data/backgrounds/{bg_id}", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["descripcion"] == "Updated test background description"
        print(f"Updated background: {data['nombre']}")
    
    def test_delete_background(self):
        """DELETE /api/data/backgrounds/{id} - should delete background"""
        if not hasattr(self.__class__, 'created_background_id'):
            pytest.skip("No background created to delete")
        
        bg_id = self.__class__.created_background_id
        response = requests.delete(f"{BASE_URL}/api/data/backgrounds/{bg_id}")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Deleted background with id: {bg_id}")


class TestOccupationsCRUD:
    """Test CRUD operations for Occupations"""
    
    def test_get_occupations(self):
        """GET /api/data/occupations - should return list of occupations"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        assert response.status_code == 200
        data = response.json()
        assert "occupations" in data
        assert isinstance(data["occupations"], list)
        print(f"Found {len(data['occupations'])} occupations")
    
    def test_create_occupation(self):
        """POST /api/data/occupations - should create new occupation"""
        test_name = f"TEST_Occupation_{uuid.uuid4().hex[:8]}"
        payload = {
            "vocacion": test_name,
            "descripcion_corta": "Test occupation short description",
            "descripcion_ocupacion_larga": "Test occupation long description",
            "dado_golpe": "1d10",
            "puntos_golpe_base": 10,
            "caracteristicas_principales": ["Fuerza", "Constitución"],
            "tiradas_salvacion": ["Fuerza", "Constitución"],
            "competencia_armas": ["Armas sencillas", "Armas marciales"],
            "competencia_armaduras": ["Armaduras ligeras", "Armaduras medias"],
            "habilidades_favorecidas": ["Atletismo", "Intimidación"]
        }
        response = requests.post(f"{BASE_URL}/api/data/occupations", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["vocacion"] == test_name
        assert "id" in data
        print(f"Created occupation: {data['vocacion']} with id: {data['id']}")
        
        # Store for cleanup
        self.__class__.created_occupation_id = data["id"]
        self.__class__.created_occupation_name = test_name
    
    def test_update_occupation(self):
        """PUT /api/data/occupations/{id} - should update occupation"""
        if not hasattr(self.__class__, 'created_occupation_id'):
            pytest.skip("No occupation created to update")
        
        occ_id = self.__class__.created_occupation_id
        payload = {
            "descripcion_corta": "Updated test occupation description"
        }
        response = requests.put(f"{BASE_URL}/api/data/occupations/{occ_id}", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["descripcion_corta"] == "Updated test occupation description"
        print(f"Updated occupation: {data['vocacion']}")
    
    def test_delete_occupation(self):
        """DELETE /api/data/occupations/{id} - should delete occupation"""
        if not hasattr(self.__class__, 'created_occupation_id'):
            pytest.skip("No occupation created to delete")
        
        occ_id = self.__class__.created_occupation_id
        response = requests.delete(f"{BASE_URL}/api/data/occupations/{occ_id}")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Deleted occupation with id: {occ_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
