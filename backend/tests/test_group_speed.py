"""
Test Group Speed Calculation - LOTR 5e Travel System
Tests the velocidad_grupo feature where the group travels at the speed of the slowest member.
If a character has a mount, their effective speed is the mount's speed.
Otherwise, they use their base walking speed (velocidad_base).
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data: Hobbiton and Rivendel location IDs
HOBBITON_ID = "loc_002"
RIVENDEL_ID = "loc_142"


class TestTravelPartyMemberModel:
    """Test the TravelPartyMember model's velocidad_efectiva method"""
    
    def test_member_without_mount_uses_base_speed(self):
        """A member without a mount uses their velocidad_base"""
        # Frodo walking: velocidad_base=25, no mount -> effective speed = 25
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": RIVENDEL_ID,
            "destino_nombre": "Rivendel",
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [
                {
                    "personaje_id": "test_frodo",
                    "nombre": "Frodo",
                    "papel": "guia",
                    "tiene_montura": False,
                    "montura_nombre": None,
                    "montura_velocidad": 0,
                    "velocidad_base": 25,
                    "modificador_sabiduria": 1,
                    "competencias": [],
                    "nivel": 1
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload, timeout=120)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "velocidad_grupo" in data, f"Response missing velocidad_grupo: {data.keys()}"
        
        velocidad_grupo = data["velocidad_grupo"]
        assert velocidad_grupo["velocidad_pies"] == 25, f"Expected 25, got {velocidad_grupo['velocidad_pies']}"
        assert velocidad_grupo["miembro_mas_lento"] == "Frodo"
        
        # Verify desglose_velocidades
        assert velocidad_grupo["desglose_velocidades"] is not None
        frodo_speed = velocidad_grupo["desglose_velocidades"][0]
        assert frodo_speed["velocidad_efectiva"] == 25
        assert frodo_speed["velocidad_base"] == 25
        assert frodo_speed["tiene_montura"] == False
        
        print(f"✓ Member without mount uses base speed: {velocidad_grupo}")
    
    def test_member_with_mount_uses_mount_speed(self):
        """A member with a mount uses their montura_velocidad"""
        # Aragorn mounted: velocidad_base=30, mount speed=60 -> effective speed = 60
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": RIVENDEL_ID,
            "destino_nombre": "Rivendel",
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [
                {
                    "personaje_id": "test_aragorn",
                    "nombre": "Aragorn",
                    "papel": "guia",
                    "tiene_montura": True,
                    "montura_nombre": "Roheryn",
                    "montura_velocidad": 60,
                    "velocidad_base": 30,
                    "modificador_sabiduria": 2,
                    "competencias": [],
                    "nivel": 10
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload, timeout=120)
        assert response.status_code == 200
        
        data = response.json()
        velocidad_grupo = data["velocidad_grupo"]
        
        # With mount, should use mount speed
        assert velocidad_grupo["velocidad_pies"] == 60
        assert velocidad_grupo["miembro_mas_lento"] == "Aragorn"
        
        # Verify desglose
        aragorn_speed = velocidad_grupo["desglose_velocidades"][0]
        assert aragorn_speed["velocidad_efectiva"] == 60
        assert aragorn_speed["montura_velocidad"] == 60
        assert aragorn_speed["tiene_montura"] == True
        
        print(f"✓ Member with mount uses mount speed: {velocidad_grupo}")


class TestGroupSpeedCalculation:
    """Test group speed is the minimum of all member effective speeds"""
    
    def test_mixed_group_slowest_walker(self):
        """
        Group with mixed members: some walking, some mounted.
        Group speed should be the slowest effective speed.
        
        Frodo (walking, vel_base=25) + Aragorn (mounted, mount_speed=60)
        Group speed should be 25 (Frodo is slowest)
        """
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": RIVENDEL_ID,
            "destino_nombre": "Rivendel",
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [
                {
                    "personaje_id": "test_frodo",
                    "nombre": "Frodo",
                    "papel": "guia",
                    "tiene_montura": False,
                    "montura_nombre": None,
                    "montura_velocidad": 0,
                    "velocidad_base": 25,
                    "modificador_sabiduria": 1,
                    "competencias": [],
                    "nivel": 1
                },
                {
                    "personaje_id": "test_aragorn",
                    "nombre": "Aragorn",
                    "papel": "vigia",
                    "tiene_montura": True,
                    "montura_nombre": "Roheryn",
                    "montura_velocidad": 60,
                    "velocidad_base": 30,
                    "modificador_sabiduria": 2,
                    "competencias": [],
                    "nivel": 10
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload, timeout=120)
        assert response.status_code == 200
        
        data = response.json()
        velocidad_grupo = data["velocidad_grupo"]
        
        # Group speed should be 25 (Frodo walking)
        assert velocidad_grupo["velocidad_pies"] == 25, f"Expected 25, got {velocidad_grupo['velocidad_pies']}"
        assert velocidad_grupo["miembro_mas_lento"] == "Frodo", f"Expected Frodo, got {velocidad_grupo['miembro_mas_lento']}"
        
        # Verify km/day calculation (25 feet / 30 feet * 36 km/day = 30 km/day)
        expected_km_day = round((25 / 30) * 36, 1)
        assert velocidad_grupo["km_por_dia"] == expected_km_day, f"Expected {expected_km_day}, got {velocidad_grupo['km_por_dia']}"
        
        # Verify desglose has both members
        assert len(velocidad_grupo["desglose_velocidades"]) == 2
        
        print(f"✓ Mixed group uses slowest walker speed: {velocidad_grupo['velocidad_pies']} feet ({velocidad_grupo['km_por_dia']} km/day)")
        print(f"  Slowest member: {velocidad_grupo['miembro_mas_lento']}")
    
    def test_all_mounted_group(self):
        """
        Group where all members are mounted.
        Group speed should be the slowest mount speed.
        
        Frodo (mounted, mount_speed=40) + Aragorn (mounted, mount_speed=60)
        Group speed should be 40 (Frodo's pony is slowest)
        """
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": RIVENDEL_ID,
            "destino_nombre": "Rivendel",
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [
                {
                    "personaje_id": "test_frodo",
                    "nombre": "Frodo",
                    "papel": "guia",
                    "tiene_montura": True,
                    "montura_nombre": "Bill el Pony",
                    "montura_velocidad": 40,
                    "velocidad_base": 25,
                    "modificador_sabiduria": 1,
                    "competencias": [],
                    "nivel": 1
                },
                {
                    "personaje_id": "test_aragorn",
                    "nombre": "Aragorn",
                    "papel": "vigia",
                    "tiene_montura": True,
                    "montura_nombre": "Roheryn",
                    "montura_velocidad": 60,
                    "velocidad_base": 30,
                    "modificador_sabiduria": 2,
                    "competencias": [],
                    "nivel": 10
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload, timeout=120)
        assert response.status_code == 200
        
        data = response.json()
        velocidad_grupo = data["velocidad_grupo"]
        
        # Group speed should be 40 (Frodo's pony)
        assert velocidad_grupo["velocidad_pies"] == 40, f"Expected 40, got {velocidad_grupo['velocidad_pies']}"
        assert velocidad_grupo["miembro_mas_lento"] == "Frodo"
        
        # Verify km/day calculation (40 feet / 30 feet * 36 km/day = 48 km/day)
        expected_km_day = round((40 / 30) * 36, 1)
        assert velocidad_grupo["km_por_dia"] == expected_km_day
        
        print(f"✓ All mounted group uses slowest mount: {velocidad_grupo['velocidad_pies']} feet ({velocidad_grupo['km_por_dia']} km/day)")
    
    def test_all_walking_group(self):
        """
        Group where no one has a mount.
        Group speed should be the slowest base speed.
        
        Frodo (walking, vel_base=25) + Sam (walking, vel_base=25) + Aragorn (walking, vel_base=30)
        Group speed should be 25 (Hobbits are slowest)
        """
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": RIVENDEL_ID,
            "destino_nombre": "Rivendel",
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [
                {
                    "personaje_id": "test_frodo",
                    "nombre": "Frodo",
                    "papel": "guia",
                    "tiene_montura": False,
                    "montura_velocidad": 0,
                    "velocidad_base": 25,
                    "modificador_sabiduria": 1,
                    "competencias": [],
                    "nivel": 1
                },
                {
                    "personaje_id": "test_sam",
                    "nombre": "Sam",
                    "papel": "cazador",
                    "tiene_montura": False,
                    "montura_velocidad": 0,
                    "velocidad_base": 25,
                    "modificador_sabiduria": 0,
                    "competencias": [],
                    "nivel": 1
                },
                {
                    "personaje_id": "test_aragorn",
                    "nombre": "Aragorn",
                    "papel": "vigia",
                    "tiene_montura": False,
                    "montura_velocidad": 0,
                    "velocidad_base": 30,
                    "modificador_sabiduria": 2,
                    "competencias": [],
                    "nivel": 10
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload, timeout=120)
        assert response.status_code == 200
        
        data = response.json()
        velocidad_grupo = data["velocidad_grupo"]
        
        # Group speed should be 25 (Hobbits)
        assert velocidad_grupo["velocidad_pies"] == 25
        # Should be either Frodo or Sam as slowest (both have 25)
        assert velocidad_grupo["miembro_mas_lento"] in ["Frodo", "Sam"]
        
        print(f"✓ All walking group uses slowest base speed: {velocidad_grupo['velocidad_pies']} feet")


class TestDaysEstimationWithGroupSpeed:
    """Test that dias_estimados varies based on group speed"""
    
    def test_faster_group_fewer_days(self):
        """
        A faster group (all mounted at 60) should have fewer days than a slower group (mixed with walker at 25).
        """
        # Fast group: all mounted at 60
        fast_payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": RIVENDEL_ID,
            "destino_nombre": "Rivendel",
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [
                {
                    "personaje_id": "test_rider1",
                    "nombre": "Rider1",
                    "papel": "guia",
                    "tiene_montura": True,
                    "montura_velocidad": 60,
                    "velocidad_base": 30,
                    "modificador_sabiduria": 2,
                    "competencias": [],
                    "nivel": 5
                },
                {
                    "personaje_id": "test_rider2",
                    "nombre": "Rider2",
                    "papel": "vigia",
                    "tiene_montura": True,
                    "montura_velocidad": 60,
                    "velocidad_base": 30,
                    "modificador_sabiduria": 1,
                    "competencias": [],
                    "nivel": 5
                }
            ]
        }
        
        # Slow group: one walker at 25
        slow_payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": RIVENDEL_ID,
            "destino_nombre": "Rivendel",
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [
                {
                    "personaje_id": "test_hobbit",
                    "nombre": "Hobbit",
                    "papel": "guia",
                    "tiene_montura": False,
                    "montura_velocidad": 0,
                    "velocidad_base": 25,
                    "modificador_sabiduria": 1,
                    "competencias": [],
                    "nivel": 1
                },
                {
                    "personaje_id": "test_rider",
                    "nombre": "Rider",
                    "papel": "vigia",
                    "tiene_montura": True,
                    "montura_velocidad": 60,
                    "velocidad_base": 30,
                    "modificador_sabiduria": 2,
                    "competencias": [],
                    "nivel": 5
                }
            ]
        }
        
        fast_response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=fast_payload, timeout=120)
        slow_response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=slow_payload, timeout=120)
        
        assert fast_response.status_code == 200
        assert slow_response.status_code == 200
        
        fast_data = fast_response.json()
        slow_data = slow_response.json()
        
        # Verify velocidad_grupo is different
        fast_speed = fast_data["velocidad_grupo"]["velocidad_pies"]
        slow_speed = slow_data["velocidad_grupo"]["velocidad_pies"]
        
        assert fast_speed == 60, f"Fast group should be 60, got {fast_speed}"
        assert slow_speed == 25, f"Slow group should be 25, got {slow_speed}"
        
        # Get estimated days
        fast_days = fast_data["estimaciones"]["dias_estimados"]
        slow_days = slow_data["estimaciones"]["dias_estimados"]
        
        # Fast group should have fewer or equal days (not more)
        assert fast_days <= slow_days, f"Fast group ({fast_days} days) should not take more days than slow group ({slow_days} days)"
        
        # The ratio should approximately match the speed ratio
        # slow_speed/fast_speed = 25/60 = 0.417
        # So slow group should take about 2.4x more days
        speed_ratio = fast_speed / slow_speed  # 60/25 = 2.4
        days_ratio = slow_days / fast_days if fast_days > 0 else 0
        
        print(f"✓ Faster group takes fewer days:")
        print(f"  Fast group: {fast_speed} feet/round -> {fast_days} days")
        print(f"  Slow group: {slow_speed} feet/round -> {slow_days} days")
        print(f"  Speed ratio: {speed_ratio:.2f}x, Days ratio: {days_ratio:.2f}x")


class TestResponseStructure:
    """Test that the API response has the correct velocidad_grupo structure"""
    
    def test_velocidad_grupo_structure(self):
        """Verify velocidad_grupo object has all required fields"""
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": RIVENDEL_ID,
            "destino_nombre": "Rivendel",
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [
                {
                    "personaje_id": "test_char",
                    "nombre": "TestChar",
                    "papel": "guia",
                    "tiene_montura": False,
                    "montura_velocidad": 0,
                    "velocidad_base": 30,
                    "modificador_sabiduria": 1,
                    "competencias": [],
                    "nivel": 1
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload, timeout=120)
        assert response.status_code == 200
        
        data = response.json()
        
        # Check velocidad_grupo exists
        assert "velocidad_grupo" in data, "Response missing velocidad_grupo"
        vg = data["velocidad_grupo"]
        
        # Check required fields
        assert "velocidad_pies" in vg, "velocidad_grupo missing velocidad_pies"
        assert "km_por_dia" in vg, "velocidad_grupo missing km_por_dia"
        assert "miembro_mas_lento" in vg, "velocidad_grupo missing miembro_mas_lento"
        assert "desglose_velocidades" in vg, "velocidad_grupo missing desglose_velocidades"
        
        # Check desglose_velocidades structure
        desglose = vg["desglose_velocidades"]
        assert desglose is not None
        assert len(desglose) == 1  # One member
        
        member_speed = desglose[0]
        assert "nombre" in member_speed
        assert "velocidad_base" in member_speed
        assert "tiene_montura" in member_speed
        assert "montura_velocidad" in member_speed
        assert "velocidad_efectiva" in member_speed
        
        print(f"✓ velocidad_grupo has correct structure: {list(vg.keys())}")
        print(f"✓ desglose_velocidades has correct fields: {list(member_speed.keys())}")


class TestEdgeCases:
    """Test edge cases for group speed calculation"""
    
    def test_empty_members_default_speed(self):
        """When no members are provided, default speed should be 30"""
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": RIVENDEL_ID,
            "destino_nombre": "Rivendel",
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": []
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload, timeout=120)
        assert response.status_code == 200
        
        data = response.json()
        velocidad_grupo = data["velocidad_grupo"]
        
        # Default speed should be 30
        assert velocidad_grupo["velocidad_pies"] == 30
        assert velocidad_grupo["miembro_mas_lento"] is None
        
        print(f"✓ Empty members defaults to 30 feet speed")
    
    def test_mounted_with_zero_mount_speed(self):
        """If tiene_montura=True but montura_velocidad=0, should use base speed"""
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": RIVENDEL_ID,
            "destino_nombre": "Rivendel",
            "preferir_caminos": True,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [
                {
                    "personaje_id": "test_char",
                    "nombre": "TestChar",
                    "papel": "guia",
                    "tiene_montura": True,
                    "montura_velocidad": 0,  # Zero mount speed
                    "velocidad_base": 30,
                    "modificador_sabiduria": 1,
                    "competencias": [],
                    "nivel": 1
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload, timeout=120)
        assert response.status_code == 200
        
        data = response.json()
        velocidad_grupo = data["velocidad_grupo"]
        
        # With mount speed 0, should fall back to base speed
        assert velocidad_grupo["velocidad_pies"] == 30
        
        print(f"✓ Zero mount speed falls back to base speed: {velocidad_grupo['velocidad_pies']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
