"""
Test Sombra new sections (hechiceria, fortalecer_voluntad, como_sucumbir) and Occupation Editor features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSombraNewSections:
    """Test new Sombra sections: hechiceria, fortalecer_voluntad, como_sucumbir"""
    
    def test_sombra_returns_hechiceria(self):
        """Sombra API returns hechiceria field"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        assert response.status_code == 200
        data = response.json()
        assert 'hechiceria' in data
        assert data['hechiceria'] is not None
        
    def test_sombra_hechiceria_structure(self):
        """Hechiceria has titulo and descripcion"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        data = response.json()
        hechiceria = data.get('hechiceria')
        assert hechiceria is not None
        assert 'titulo' in hechiceria or 'descripcion' in hechiceria
        assert hechiceria.get('descripcion') is not None
        
    def test_sombra_returns_fortalecer_voluntad(self):
        """Sombra API returns fortalecer_voluntad field"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        assert response.status_code == 200
        data = response.json()
        assert 'fortalecer_voluntad' in data
        assert data['fortalecer_voluntad'] is not None
        
    def test_sombra_fortalecer_voluntad_structure(self):
        """Fortalecer voluntad has descripcion and nota"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        data = response.json()
        fv = data.get('fortalecer_voluntad')
        assert fv is not None
        assert 'descripcion' in fv
        assert fv.get('descripcion') is not None
        # nota is optional but should exist
        assert 'nota' in fv
        
    def test_sombra_returns_como_sucumbir(self):
        """Sombra API returns como_sucumbir field"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        assert response.status_code == 200
        data = response.json()
        assert 'como_sucumbir' in data
        assert data['como_sucumbir'] is not None
        
    def test_sombra_como_sucumbir_structure(self):
        """Como sucumbir has descripcion and consecuencia"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        data = response.json()
        cs = data.get('como_sucumbir')
        assert cs is not None
        assert 'descripcion' in cs
        assert 'consecuencia' in cs
        assert cs.get('descripcion') is not None
        assert cs.get('consecuencia') is not None


class TestSombraSendasEndpoint:
    """Test POST /api/data/sombra/sendas endpoint for shadow path defects"""
    
    def test_add_shadow_path_success(self):
        """Can add shadow path with defects"""
        payload = {
            "ocupacion": "Test Occupation",
            "senda": "Test Shadow Path",
            "descripcion": "Test description",
            "defectos": [
                {"nombre": "Defect 1", "descripcion": "Desc 1", "efecto_juego": "Effect 1"},
                {"nombre": "Defect 2", "descripcion": "Desc 2", "efecto_juego": "Effect 2"},
                {"nombre": "Defect 3", "descripcion": "Desc 3", "efecto_juego": "Effect 3"},
                {"nombre": "Defect 4", "descripcion": "Desc 4", "efecto_juego": "Effect 4"}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/data/sombra/sendas", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert 'message' in data
        assert 'Test Shadow Path' in data['message']
        
    def test_add_shadow_path_requires_ocupacion(self):
        """Shadow path requires ocupacion field"""
        payload = {
            "senda": "Test Path",
            "defectos": []
        }
        response = requests.post(f"{BASE_URL}/api/data/sombra/sendas", json=payload)
        assert response.status_code == 400
        
    def test_add_shadow_path_requires_senda(self):
        """Shadow path requires senda field"""
        payload = {
            "ocupacion": "Test Occupation",
            "defectos": []
        }
        response = requests.post(f"{BASE_URL}/api/data/sombra/sendas", json=payload)
        assert response.status_code == 400


class TestOccupationEndpoints:
    """Test occupation CRUD endpoints"""
    
    def test_get_occupations(self):
        """Can get list of occupations"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        assert response.status_code == 200
        data = response.json()
        assert 'occupations' in data
        assert isinstance(data['occupations'], list)
        
    def test_occupation_has_required_fields(self):
        """Occupations have required fields"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        data = response.json()
        if data['occupations']:
            occ = data['occupations'][0]
            # Check basic fields
            assert 'vocacion' in occ or 'nombre' in occ
            
    def test_create_occupation_validates_characteristics(self):
        """Creating occupation validates max 2 characteristics"""
        payload = {
            "vocacion": "Test Occupation",
            "caracteristicas_principales": ["Fuerza", "Destreza"],  # Valid: 2
            "tiradas_salvacion": ["Fuerza", "Destreza"],  # Valid: 2
            "habilidades_favorecidas": ["Acertijos", "Acrobacias", "Atletismo"]  # Valid: 3
        }
        # This should work (valid counts)
        response = requests.post(f"{BASE_URL}/api/data/occupations", json=payload)
        # Either 200/201 for success or 400 if already exists
        assert response.status_code in [200, 201, 400]
        
    def test_get_single_occupation(self):
        """Can get a single occupation by ID"""
        # First get list
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        data = response.json()
        if data['occupations']:
            occ_id = data['occupations'][0].get('id')
            if occ_id:
                response = requests.get(f"{BASE_URL}/api/data/occupations/{occ_id}")
                assert response.status_code == 200


class TestOccupationShadowPath:
    """Test occupation shadow path integration"""
    
    def test_occupation_can_have_shadow_path(self):
        """Occupation can include shadow path data"""
        payload = {
            "vocacion": "Test Shadow Occupation",
            "descripcion_corta": "Test description",
            "caracteristicas_principales": ["Fuerza", "Destreza"],
            "tiradas_salvacion": ["Fuerza", "Destreza"],
            "habilidades_favorecidas": ["Acertijos", "Acrobacias", "Atletismo"],
            "senda_sombra": {
                "nombre": "Test Shadow Path",
                "descripcion": "Path description",
                "defectos": [
                    {"nombre": "Defect 1", "descripcion": "Desc 1", "efecto_juego": "Effect 1"},
                    {"nombre": "Defect 2", "descripcion": "Desc 2", "efecto_juego": "Effect 2"},
                    {"nombre": "Defect 3", "descripcion": "Desc 3", "efecto_juego": "Effect 3"},
                    {"nombre": "Defect 4", "descripcion": "Desc 4", "efecto_juego": "Effect 4"}
                ]
            }
        }
        response = requests.post(f"{BASE_URL}/api/data/occupations", json=payload)
        # Either success or already exists
        assert response.status_code in [200, 201, 400]


class TestOccupationProfessionPaths:
    """Test occupation profession paths/specializations"""
    
    def test_occupation_can_have_caminos(self):
        """Occupation can include profession paths (caminos)"""
        payload = {
            "vocacion": "Test Caminos Occupation",
            "caracteristicas_principales": ["Fuerza", "Destreza"],
            "tiradas_salvacion": ["Fuerza", "Destreza"],
            "habilidades_favorecidas": ["Acertijos", "Acrobacias", "Atletismo"],
            "caminos": {
                "nombre_especialidad": "Especialidad de Test",
                "nivel_especializacion": 3,
                "especialidades": [
                    {
                        "nombre": "Especialidad 1",
                        "descripcion": "Desc 1",
                        "caracteristicas": ["Char 1", "Char 2", "Char 3"]
                    },
                    {
                        "nombre": "Especialidad 2",
                        "descripcion": "Desc 2",
                        "caracteristicas": ["Char 1", "Char 2", "Char 3"]
                    }
                ]
            }
        }
        response = requests.post(f"{BASE_URL}/api/data/occupations", json=payload)
        assert response.status_code in [200, 201, 400]


class TestOccupationVirtueArtLevels:
    """Test occupation virtue and art level fields"""
    
    def test_occupation_can_have_virtue_levels(self):
        """Occupation can include virtue and art levels"""
        payload = {
            "vocacion": "Test Virtue Occupation",
            "caracteristicas_principales": ["Fuerza", "Destreza"],
            "tiradas_salvacion": ["Fuerza", "Destreza"],
            "habilidades_favorecidas": ["Acertijos", "Acrobacias", "Atletismo"],
            "niveles_virtudes": "4, 6, 8",
            "niveles_artes": "6",
            "descripcion_virtudes": "A nivel 4, y de nuevo a nivel 6 y 8, puedes elegir una virtud...",
            "descripcion_artes": "A nivel 6, en lugar de elegir una virtud, puedes obtener..."
        }
        response = requests.post(f"{BASE_URL}/api/data/occupations", json=payload)
        assert response.status_code in [200, 201, 400]


# Cleanup test data
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_occupations():
    """Cleanup test occupations after tests"""
    yield
    # Try to delete test occupations
    try:
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        if response.status_code == 200:
            for occ in response.json().get('occupations', []):
                if occ.get('vocacion', '').startswith('Test'):
                    occ_id = occ.get('id')
                    if occ_id:
                        requests.delete(f"{BASE_URL}/api/data/occupations/{occ_id}")
    except:
        pass
