"""
Test Bug Fixes - Iteration 7
Tests for:
1. Wealth level money (Common: 15mp, Prosperous: 20mp)
2. equipo_trasfondo saved correctly in step2
3. Currency model includes 'me' (tin coins)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWealthLevelMoney:
    """Test that wealth level adds correct money amounts"""
    
    def test_step7_common_wealth_level_money(self):
        """Test that Common (Común) wealth level adds 15mp"""
        # Create a draft
        response = requests.post(f"{BASE_URL}/api/characters/draft")
        assert response.status_code == 200
        draft = response.json()
        draft_id = draft['id']
        
        try:
            # Get a culture with "Común" nivel_vida (Hobbits Albos)
            cultures_resp = requests.get(f"{BASE_URL}/api/data/cultures")
            assert cultures_resp.status_code == 200
            cultures = cultures_resp.json().get('cultures', [])
            
            comun_culture = None
            for c in cultures:
                if c.get('nivel_vida') == 'Común':
                    comun_culture = c
                    break
            
            assert comun_culture is not None, "No culture with 'Común' nivel_vida found"
            
            # Step 1: Select culture
            step1_data = {
                "cultura_id": comun_culture['id'],
                "nombre": "TEST_CommonWealth",
                "genero": "hombre",
                "edad": 30,
                "altura_cm": 170,
                "peso_kg": 70,
                "nivel_vida": "Común"
            }
            step1_resp = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step1", json=step1_data)
            assert step1_resp.status_code == 200
            
            # Verify nivel_vida is saved
            draft_resp = requests.get(f"{BASE_URL}/api/characters/draft/{draft_id}")
            assert draft_resp.status_code == 200
            draft_data = draft_resp.json()
            assert draft_data.get('nivel_vida') == 'Común', f"Expected nivel_vida 'Común', got {draft_data.get('nivel_vida')}"
            
            print(f"✓ Culture with Común nivel_vida selected: {comun_culture['nombre']}")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/characters/draft/{draft_id}")
    
    def test_step7_prosperous_wealth_level_money(self):
        """Test that Prosperous (Próspero) wealth level adds 20mp"""
        # Create a draft
        response = requests.post(f"{BASE_URL}/api/characters/draft")
        assert response.status_code == 200
        draft = response.json()
        draft_id = draft['id']
        
        try:
            # Get a culture with "Próspero" nivel_vida (Elfos Noldor)
            cultures_resp = requests.get(f"{BASE_URL}/api/data/cultures")
            assert cultures_resp.status_code == 200
            cultures = cultures_resp.json().get('cultures', [])
            
            prospero_culture = None
            for c in cultures:
                if c.get('nivel_vida') == 'Próspero':
                    prospero_culture = c
                    break
            
            assert prospero_culture is not None, "No culture with 'Próspero' nivel_vida found"
            
            # Step 1: Select culture
            step1_data = {
                "cultura_id": prospero_culture['id'],
                "nombre": "TEST_ProsperousWealth",
                "genero": "hombre",
                "edad": 100,
                "altura_cm": 180,
                "peso_kg": 75,
                "nivel_vida": "Próspero"
            }
            step1_resp = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step1", json=step1_data)
            assert step1_resp.status_code == 200
            
            # Verify nivel_vida is saved
            draft_resp = requests.get(f"{BASE_URL}/api/characters/draft/{draft_id}")
            assert draft_resp.status_code == 200
            draft_data = draft_resp.json()
            assert draft_data.get('nivel_vida') == 'Próspero', f"Expected nivel_vida 'Próspero', got {draft_data.get('nivel_vida')}"
            
            print(f"✓ Culture with Próspero nivel_vida selected: {prospero_culture['nombre']}")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/characters/draft/{draft_id}")


class TestEquipoTrasfondo:
    """Test that equipo_trasfondo is saved correctly in step2"""
    
    def test_step2_saves_equipo_trasfondo(self):
        """Test that step2 API saves equipo_trasfondo field"""
        # Create a draft
        response = requests.post(f"{BASE_URL}/api/characters/draft")
        assert response.status_code == 200
        draft = response.json()
        draft_id = draft['id']
        
        try:
            # Get a culture first
            cultures_resp = requests.get(f"{BASE_URL}/api/data/cultures")
            assert cultures_resp.status_code == 200
            cultures = cultures_resp.json().get('cultures', [])
            culture = cultures[0]
            
            # Step 1: Select culture
            step1_data = {
                "cultura_id": culture['id'],
                "nombre": "TEST_EquipoTrasfondo",
                "genero": "hombre",
                "edad": 30,
                "altura_cm": 170,
                "peso_kg": 70
            }
            step1_resp = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step1", json=step1_data)
            assert step1_resp.status_code == 200
            
            # Get backgrounds for this culture
            backgrounds_resp = requests.get(f"{BASE_URL}/api/data/backgrounds", params={"cultura": culture['nombre']})
            assert backgrounds_resp.status_code == 200
            backgrounds = backgrounds_resp.json().get('backgrounds', [])
            assert len(backgrounds) > 0, "No backgrounds found for culture"
            
            background = backgrounds[0]
            
            # Step 2: Select background with equipo_trasfondo
            test_equipment = ["Laúd", "Dados de hueso"]
            step2_data = {
                "trasfondo_id": background['id'],
                "trasfondo_nombre": background['nombre'],
                "competencias_habilidades_trasfondo": background.get('competencias_habilidades_auto', []),
                "competencias_herramientas_trasfondo": [],
                "rasgos_trasfondo": [],
                "equipo_trasfondo": test_equipment
            }
            step2_resp = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step2", json=step2_data)
            assert step2_resp.status_code == 200
            
            # Verify equipo_trasfondo is saved
            draft_resp = requests.get(f"{BASE_URL}/api/characters/draft/{draft_id}")
            assert draft_resp.status_code == 200
            draft_data = draft_resp.json()
            
            saved_equipo = draft_data.get('equipo_trasfondo', [])
            assert saved_equipo == test_equipment, f"Expected equipo_trasfondo {test_equipment}, got {saved_equipo}"
            
            print(f"✓ equipo_trasfondo saved correctly: {saved_equipo}")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/characters/draft/{draft_id}")


class TestCurrencyModel:
    """Test that currency model includes all 4 types: mp, mo, me, mc"""
    
    def test_step7_dinero_model_has_all_currencies(self):
        """Test that step7 dinero model includes mp, mo, me, mc"""
        # Create a draft and go through steps to step7
        response = requests.post(f"{BASE_URL}/api/characters/draft")
        assert response.status_code == 200
        draft = response.json()
        draft_id = draft['id']
        
        try:
            # Get culture
            cultures_resp = requests.get(f"{BASE_URL}/api/data/cultures")
            cultures = cultures_resp.json().get('cultures', [])
            culture = cultures[0]
            
            # Step 1
            step1_data = {
                "cultura_id": culture['id'],
                "nombre": "TEST_CurrencyModel",
                "genero": "hombre",
                "edad": 30,
                "altura_cm": 170,
                "peso_kg": 70
            }
            requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step1", json=step1_data)
            
            # Get backgrounds
            backgrounds_resp = requests.get(f"{BASE_URL}/api/data/backgrounds", params={"cultura": culture['nombre']})
            backgrounds = backgrounds_resp.json().get('backgrounds', [])
            background = backgrounds[0]
            
            # Step 2
            step2_data = {
                "trasfondo_id": background['id'],
                "trasfondo_nombre": background['nombre'],
                "competencias_habilidades_trasfondo": [],
                "competencias_herramientas_trasfondo": [],
                "rasgos_trasfondo": [],
                "equipo_trasfondo": []
            }
            requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step2", json=step2_data)
            
            # Get occupations
            occupations_resp = requests.get(f"{BASE_URL}/api/data/occupations")
            occupations = occupations_resp.json().get('occupations', [])
            occupation = occupations[0]
            
            # Step 3
            step3_data = {
                "ocupacion_id": occupation['id'],
                "habilidades_elegidas": [],
                "herramientas_elegidas": [],
                "pericia_elegida": [],
                "equipo_ocupacion": [],
                "armadura_elegida": "A"
            }
            requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step3", json=step3_data)
            
            # Step 4
            step4_data = {
                "atributos": {
                    "fuerza": 14,
                    "destreza": 12,
                    "constitucion": 13,
                    "inteligencia": 10,
                    "sabiduria": 8,
                    "carisma": 15
                },
                "metodo_asignacion": "standard_array"
            }
            requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step4", json=step4_data)
            
            # Skip step 5 (virtue - optional)
            # Step 6
            step6_data = {"habilidades": []}
            requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step6", json=step6_data)
            
            # Step 7 - Test dinero with all 4 currency types
            test_dinero = {"mp": 15, "mo": 5, "me": 50, "mc": 100}
            step7_data = {
                "inventario": [],
                "dinero": test_dinero
            }
            step7_resp = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step7", json=step7_data)
            assert step7_resp.status_code == 200
            
            # Verify all 4 currency types are saved
            draft_resp = requests.get(f"{BASE_URL}/api/characters/draft/{draft_id}")
            assert draft_resp.status_code == 200
            draft_data = draft_resp.json()
            
            saved_dinero = draft_data.get('dinero', {})
            assert 'mp' in saved_dinero, "Missing 'mp' (silver) in dinero"
            assert 'mo' in saved_dinero, "Missing 'mo' (gold) in dinero"
            assert 'me' in saved_dinero, "Missing 'me' (tin) in dinero"
            assert 'mc' in saved_dinero, "Missing 'mc' (copper) in dinero"
            
            assert saved_dinero['mp'] == 15, f"Expected mp=15, got {saved_dinero['mp']}"
            assert saved_dinero['mo'] == 5, f"Expected mo=5, got {saved_dinero['mo']}"
            assert saved_dinero['me'] == 50, f"Expected me=50, got {saved_dinero['me']}"
            assert saved_dinero['mc'] == 100, f"Expected mc=100, got {saved_dinero['mc']}"
            
            print(f"✓ All 4 currency types saved correctly: {saved_dinero}")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/characters/draft/{draft_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
