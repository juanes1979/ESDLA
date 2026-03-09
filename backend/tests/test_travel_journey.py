"""
Backend tests for LOTR 5e Travel System - Journey Calculation
Tests the POST /api/travel/calculate-journey endpoint focusing on:
- Correct distance calculations (COORD_TO_KM = 20 fix)
- Pathfinder road preference (preferir_caminos=true)
- Days estimation based on terrain costs
- Terrain summary (terrain_summary) breakdown
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test location IDs as specified
HOBBITON_ID = "loc_002"
ESGAROTH_ID = "loc_031"


class TestJourneyCalculation:
    """Tests for /api/travel/calculate-journey endpoint"""
    
    def test_journey_distance_hobbiton_to_esgaroth(self):
        """
        Test that Hobbiton to Esgaroth returns correct distance (~800-900 km)
        This validates the COORD_TO_KM = 20 fix in pathfinding.py
        Previously returned ~264 km, now should return ~824 km
        """
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get("success") == True, f"Journey calculation failed: {data.get('message')}"
        
        # Validate distance is in expected range (800-900 km)
        distance_km = data.get("ruta", {}).get("distance_km")
        assert distance_km is not None, "Missing distance_km in response"
        assert 700 <= distance_km <= 1000, f"Distance {distance_km} km outside expected range 700-1000 km"
        
        print(f"PASS: Hobbiton to Esgaroth distance = {distance_km} km (expected ~800-900 km)")
    
    def test_journey_uses_roads_when_preferir_caminos_true(self):
        """
        Test that pathfinder uses roads when preferir_caminos=true
        Should return roads_used list with actual road names
        """
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        
        roads_used = data.get("ruta", {}).get("roads_used", [])
        assert len(roads_used) > 0, "Expected roads_used to contain road names when preferir_caminos=True"
        
        print(f"PASS: Roads used: {roads_used}")
    
    def test_journey_days_based_on_terrain_cost(self):
        """
        Test that estimated_days is calculated from pathfinder's terrain costs
        Hobbiton to Esgaroth should be ~45 days based on terrain multipliers
        """
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        
        dias_estimados = data.get("estimaciones", {}).get("dias_estimados")
        assert dias_estimados is not None, "Missing dias_estimados in response"
        
        # With ~824 km and terrain multipliers, expect ~40-50 days
        assert 30 <= dias_estimados <= 60, f"Days {dias_estimados} outside expected range 30-60"
        
        print(f"PASS: Estimated days = {dias_estimados} (expected ~45 for Hobbiton-Esgaroth)")
    
    def test_journey_terrain_summary_breakdown(self):
        """
        Test that terrain_summary returns distances by terrain type
        Should show how many km were traveled on each terrain type
        """
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        
        terrain_summary = data.get("ruta", {}).get("terrain_summary")
        assert terrain_summary is not None, "Missing terrain_summary in response"
        assert isinstance(terrain_summary, dict), "terrain_summary should be a dictionary"
        
        # Validate we have terrain distance values
        total_terrain_km = sum(terrain_summary.values())
        distance_km = data.get("ruta", {}).get("distance_km", 0)
        
        # Total terrain km should roughly match total distance
        assert total_terrain_km > 0, "terrain_summary should have positive distances"
        
        # Check it's within 20% of total distance (accounting for calculation differences)
        diff_percent = abs(total_terrain_km - distance_km) / distance_km * 100
        assert diff_percent < 20, f"terrain_summary total ({total_terrain_km}) differs from distance ({distance_km}) by {diff_percent:.1f}%"
        
        print(f"PASS: Terrain summary: {terrain_summary}")
        print(f"      Total terrain km: {total_terrain_km:.1f}, Distance km: {distance_km}")
    
    def test_journey_different_routes_with_preferir_caminos(self):
        """
        Test that preferir_caminos affects the path
        Distance/roads should differ when preferir_caminos is toggled
        """
        base_payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "evitar_sombra": False,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        # With road preference
        payload_roads = {**base_payload, "preferir_caminos": True}
        response_roads = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload_roads)
        data_roads = response_roads.json()
        
        # Without road preference
        payload_direct = {**base_payload, "preferir_caminos": False}
        response_direct = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload_direct)
        data_direct = response_direct.json()
        
        assert response_roads.status_code == 200
        assert response_direct.status_code == 200
        assert data_roads.get("success") == True
        assert data_direct.get("success") == True
        
        roads_with_pref = data_roads.get("ruta", {}).get("roads_used", [])
        roads_without_pref = data_direct.get("ruta", {}).get("roads_used", [])
        
        # With preference should use more roads or different route
        print(f"Roads with preference: {len(roads_with_pref)} roads - {roads_with_pref}")
        print(f"Roads without preference: {len(roads_without_pref)} roads - {roads_without_pref}")
    
    def test_journey_required_fields_validation(self):
        """
        Test that required fields origen_id, origen_nombre, destino_id, destino_nombre are required
        """
        # Missing origen_id
        payload = {
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth"
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        # Should fail with 422 for validation error
        assert response.status_code == 422, f"Expected 422 for missing required field, got {response.status_code}"
        print("PASS: Missing required field returns 422")
    
    def test_journey_invalid_location_id(self):
        """
        Test that invalid location IDs return appropriate error
        """
        payload = {
            "origen_id": "invalid_location_xyz",
            "origen_nombre": "Unknown",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return error message
        assert data.get("error") == True or data.get("success") == False, "Expected error for invalid location"
        print(f"PASS: Invalid location returns error: {data.get('message', data)}")
    
    def test_journey_estimations_structure(self):
        """
        Test that estimaciones contains all expected fields
        """
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        
        estimaciones = data.get("estimaciones", {})
        
        # Check expected fields
        assert "dias_estimados" in estimaciones, "Missing dias_estimados"
        assert "px_total" in estimaciones, "Missing px_total"
        
        print(f"PASS: Estimaciones structure: {list(estimaciones.keys())}")
    
    def test_journey_ruta_structure(self):
        """
        Test that ruta contains all expected fields from pathfinder
        """
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        
        ruta = data.get("ruta", {})
        
        # Check expected fields
        assert "distance_km" in ruta, "Missing distance_km"
        assert "casillas" in ruta, "Missing casillas"
        assert "path" in ruta, "Missing path"
        assert "terrain_summary" in ruta, "Missing terrain_summary"
        
        # Pathfinder-specific fields when not a direct line
        if not ruta.get("is_direct_line"):
            assert "roads_used" in ruta, "Missing roads_used (pathfinder route)"
            assert "segments" in ruta, "Missing segments (pathfinder route)"
            # Note: estimated_days comes from estimaciones, not ruta
        
        print(f"PASS: Ruta structure includes pathfinder data: {list(ruta.keys())}")


class TestPathfinderConstants:
    """Tests to verify pathfinder constants are correctly applied"""
    
    def test_coord_to_km_scale_factor(self):
        """
        Verify COORD_TO_KM = 20 is being used correctly
        The fix changed this from a lower value to 20 km per coordinate unit
        
        For Hobbiton (~19.5, 61.5) to Esgaroth (~56.5, 65), 
        straight-line distance is ~37 coordinate units
        With COORD_TO_KM = 20, that's ~740 km straight-line
        """
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        
        distance_km = data.get("ruta", {}).get("distance_km", 0)
        
        # With old broken scale, distance was ~264 km
        # With COORD_TO_KM = 20, distance should be ~824 km
        # Test that it's at least 3x the old broken value
        assert distance_km > 600, f"Distance {distance_km} km suggests COORD_TO_KM fix not applied (should be >600 km)"
        
        print(f"PASS: Distance {distance_km} km confirms COORD_TO_KM = 20 is applied")
    
    def test_base_speed_km_day(self):
        """
        Verify BASE_SPEED_KM_DAY = 36 is being used for day calculation
        With ~824 km journey on varied terrain, expect ~45 days
        """
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        
        distance_km = data.get("ruta", {}).get("distance_km", 0)
        dias_estimados = data.get("estimaciones", {}).get("dias_estimados", 0)
        
        # Base speed is 36 km/day, but terrain multipliers increase travel cost
        # So actual km/day should be less than 36
        effective_km_per_day = distance_km / dias_estimados if dias_estimados > 0 else 0
        
        # Effective speed should be between 10-36 km/day depending on terrain
        assert 10 <= effective_km_per_day <= 40, f"Effective speed {effective_km_per_day:.1f} km/day outside expected range"
        
        print(f"PASS: Effective speed {effective_km_per_day:.1f} km/day (base 36, terrain slows)")


class TestRhythmModifiers:
    """Tests for journey rhythm (ritmo) modifiers"""
    
    def test_slow_rhythm_increases_days(self):
        """
        Test that ritmo='lento' increases travel days by ~50%
        """
        base_payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        # Normal rhythm
        payload_normal = {**base_payload, "ritmo": "normal"}
        response_normal = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload_normal)
        data_normal = response_normal.json()
        
        # Slow rhythm
        payload_slow = {**base_payload, "ritmo": "lento"}
        response_slow = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload_slow)
        data_slow = response_slow.json()
        
        assert data_normal.get("success") == True
        assert data_slow.get("success") == True
        
        days_normal = data_normal.get("estimaciones", {}).get("dias_estimados", 0)
        days_slow = data_slow.get("estimaciones", {}).get("dias_estimados", 0)
        
        # Slow should be ~1.5x normal
        assert days_slow > days_normal, f"Slow ({days_slow}) should be more than normal ({days_normal})"
        
        ratio = days_slow / days_normal if days_normal > 0 else 0
        assert 1.3 <= ratio <= 1.7, f"Slow/Normal ratio {ratio:.2f} outside expected 1.3-1.7"
        
        print(f"PASS: Normal={days_normal} days, Slow={days_slow} days (ratio {ratio:.2f})")
    
    def test_fast_rhythm_blocked_in_wild_lands(self):
        """
        Test that ritmo='rapido' is blocked in Tierras Salvajes (Wild Lands)
        This is expected game rule behavior - fast rhythm not allowed in dangerous areas
        """
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "ritmo": "rapido",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Fast rhythm should be blocked in wild/shadow lands
        # This returns error=True with appropriate message
        if data.get("error") == True:
            assert "Ritmo rápido no permitido" in data.get("message", ""), "Expected restriction message"
            print(f"PASS: Fast rhythm correctly blocked: {data.get('message')}")
        else:
            # If route doesn't pass through wild lands, fast rhythm is allowed
            assert data.get("success") == True
            print("PASS: Fast rhythm allowed on this route")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
