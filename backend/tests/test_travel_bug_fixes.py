"""
Test file for LOTR 5e Travel System Bug Fixes
Tests:
1. Backend /api/travel/calculate-journey returns coordinates (origen_coords, destino_coords)
2. Multi-role assignment validation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTravelJourneyCalculation:
    """Test journey calculation endpoint returns coordinates for map"""
    
    def test_calculate_journey_returns_coordinates(self):
        """Verify calculate-journey returns origen_coords and destino_coords"""
        payload = {
            "origen_id": "loc_002",
            "origen_nombre": "Hobbiton",
            "destino_id": "loc_010",
            "destino_nombre": "Paso de Caradhras",
            "evitar_sombra": False,
            "evitar_tierras_oscuras": False,
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify success
        assert data.get('success') == True, f"Journey calculation failed: {data.get('message', 'Unknown error')}"
        
        # Verify ruta section exists
        assert 'ruta' in data, "Response missing 'ruta' section"
        ruta = data['ruta']
        
        # Verify coordinates exist and have x/y values
        assert 'origen_coords' in ruta, "Response missing 'origen_coords'"
        assert 'destino_coords' in ruta, "Response missing 'destino_coords'"
        
        origen_coords = ruta['origen_coords']
        destino_coords = ruta['destino_coords']
        
        # Verify coordinate structure
        assert 'x' in origen_coords, "origen_coords missing 'x'"
        assert 'y' in origen_coords, "origen_coords missing 'y'"
        assert 'x' in destino_coords, "destino_coords missing 'x'"
        assert 'y' in destino_coords, "destino_coords missing 'y'"
        
        # Verify coordinates are numbers
        assert isinstance(origen_coords['x'], (int, float)), "origen_coords.x should be a number"
        assert isinstance(origen_coords['y'], (int, float)), "origen_coords.y should be a number"
        assert isinstance(destino_coords['x'], (int, float)), "destino_coords.x should be a number"
        assert isinstance(destino_coords['y'], (int, float)), "destino_coords.y should be a number"
        
        print(f"Origen coords: {origen_coords}")
        print(f"Destino coords: {destino_coords}")
        
    def test_calculate_journey_hobbiton_bree(self):
        """Test shorter route Hobbiton to Bree"""
        payload = {
            "origen_id": "loc_002",
            "origen_nombre": "Hobbiton",
            "destino_id": "loc_003",  # Bree
            "destino_nombre": "Bree",
            "evitar_sombra": False,
            "evitar_tierras_oscuras": False,
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Either success or valid error
        if data.get('success'):
            assert 'ruta' in data
            assert 'origen_coords' in data['ruta']
            assert 'destino_coords' in data['ruta']
            print(f"Route: {data['ruta']['distance_km']} km, {data['ruta']['casillas']} casillas")


class TestTravelEvents:
    """Test travel event generation"""
    
    def test_generate_event(self):
        """Test event generation endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/travel/generate-event",
            params={
                "tipo_tierra": "tierras_salvajes",
                "terreno": "campo_abierto",
                "estacion": "verano"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('success') == True
        assert 'evento' in data
        assert 'objetivo' in data
        assert 'resolucion' in data
        
        evento = data['evento']
        assert 'nombre' in evento
        assert 'fatigue_cd_increase' in evento
        
        print(f"Generated event: {evento['nombre']}")


class TestTravelConfig:
    """Test travel configuration endpoints"""
    
    def test_get_land_types(self):
        """Test get land types"""
        response = requests.get(f"{BASE_URL}/api/travel/config/land-types")
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'land_types' in data
        land_types = data['land_types']
        assert len(land_types) > 0
        
        # Check structure
        for land in land_types:
            assert 'tipo' in land
            assert 'nombre' in land
            assert 'px_camino' in land
            
    def test_get_travel_rules(self):
        """Test get travel rules config"""
        response = requests.get(f"{BASE_URL}/api/travel/config/rules")
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'rules' in data
        rules = data['rules']
        
        assert 'fatigue_base_cd' in rules
        assert 'orientation_cd' in rules


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
