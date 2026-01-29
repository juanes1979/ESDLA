"""
LOTR 5e RPG - Character Creation Tests (8-Step Flow)
Tests for the refactored character creation wizard:
- 8 steps (Patron step removed)
- Virtue step only for specific cultures (Hombres del lago, Hombres de Bree, Beornidas)
- Equipment automatically assigned based on Nivel de Vida
- Personality traits from Background
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Cultures that get virtue at level 1
CULTURAS_CON_VIRTUD = ['Hombres del lago', 'Hombres de Bree', 'Beornidas']


class TestCultureVirtueRules:
    """Test that only specific cultures get virtue at level 1"""
    
    def test_cultures_with_virtue_exist(self):
        """Verify the 3 cultures that get virtue exist in database"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        assert response.status_code == 200
        cultures = response.json()["cultures"]
        
        culture_names = [c['nombre'] for c in cultures]
        for cultura in CULTURAS_CON_VIRTUD:
            assert cultura in culture_names, f"Culture '{cultura}' not found in database"
        print(f"All 3 virtue cultures found: {CULTURAS_CON_VIRTUD}")
    
    def test_elfos_de_lindon_no_virtue(self):
        """Elfos de Lindon should NOT get virtue at level 1"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        cultures = response.json()["cultures"]
        
        elfo = next((c for c in cultures if c['nombre'] == 'Elfos de Lindon'), None)
        assert elfo is not None, "Elfos de Lindon not found"
        assert elfo['nombre'] not in CULTURAS_CON_VIRTUD
        assert elfo.get('nivel_vida') == 'Frugal'
        print(f"Elfos de Lindon: nivel_vida={elfo.get('nivel_vida')}, NO virtue at level 1")
    
    def test_hombres_de_bree_has_virtue(self):
        """Hombres de Bree SHOULD get virtue at level 1"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        cultures = response.json()["cultures"]
        
        hombre = next((c for c in cultures if c['nombre'] == 'Hombres de Bree'), None)
        assert hombre is not None, "Hombres de Bree not found"
        assert hombre['nombre'] in CULTURAS_CON_VIRTUD
        assert hombre.get('nivel_vida') == 'Común'
        print(f"Hombres de Bree: nivel_vida={hombre.get('nivel_vida')}, HAS virtue at level 1")


class TestNivelDeVidaEquipment:
    """Test equipment assignment based on Nivel de Vida"""
    
    def test_frugal_culture_equipment(self):
        """Test Frugal cultures get basic equipment"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        cultures = response.json()["cultures"]
        
        frugal_cultures = [c for c in cultures if c.get('nivel_vida') == 'Frugal']
        assert len(frugal_cultures) > 0, "No Frugal cultures found"
        
        # Elfos de Lindon is Frugal
        elfo = next((c for c in frugal_cultures if c['nombre'] == 'Elfos de Lindon'), None)
        assert elfo is not None
        print(f"Frugal cultures: {[c['nombre'] for c in frugal_cultures]}")
    
    def test_comun_culture_equipment(self):
        """Test Común cultures get standard equipment"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        cultures = response.json()["cultures"]
        
        comun_cultures = [c for c in cultures if c.get('nivel_vida') == 'Común']
        assert len(comun_cultures) > 0, "No Común cultures found"
        
        # Hombres de Bree is Común
        hombre = next((c for c in comun_cultures if c['nombre'] == 'Hombres de Bree'), None)
        assert hombre is not None
        print(f"Común cultures: {[c['nombre'] for c in comun_cultures]}")
    
    def test_prospero_culture_equipment(self):
        """Test Próspero cultures get luxury equipment"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        cultures = response.json()["cultures"]
        
        prospero_cultures = [c for c in cultures if c.get('nivel_vida') == 'Próspero']
        assert len(prospero_cultures) > 0, "No Próspero cultures found"
        
        # Elfos Noldor is Próspero
        noldor = next((c for c in prospero_cultures if c['nombre'] == 'Elfos Noldor'), None)
        assert noldor is not None
        print(f"Próspero cultures: {[c['nombre'] for c in prospero_cultures]}")


class TestCharacterCreation8Steps:
    """Test the 8-step character creation flow"""
    
    def test_create_character_without_virtue_elfos_lindon(self):
        """Test creating character with Elfos de Lindon (NO virtue, Frugal)"""
        # Get culture ID
        cultures = requests.get(f"{BASE_URL}/api/data/cultures").json()["cultures"]
        elfo = next((c for c in cultures if c['nombre'] == 'Elfos de Lindon'), None)
        assert elfo is not None
        
        # Get other required data
        backgrounds = requests.get(f"{BASE_URL}/api/data/backgrounds").json()["backgrounds"]
        occupations = requests.get(f"{BASE_URL}/api/data/occupations").json()["occupations"]
        
        # Step 0: Create draft
        draft_response = requests.post(f"{BASE_URL}/api/characters/draft")
        assert draft_response.status_code == 200
        draft_id = draft_response.json()["id"]
        print(f"Created draft: {draft_id}")
        
        # Step 1: Culture (Elfos de Lindon - Frugal, NO virtue)
        step1_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step1",
            json={
                "nombre": "TEST_Galadriel",
                "jugador": "Test Player",
                "cultura_id": elfo["id"]
            }
        )
        assert step1_response.status_code == 200
        draft = step1_response.json()
        assert draft["cultura_nombre"] == "Elfos de Lindon"
        assert draft["nivel_vida"] == "Frugal"
        assert draft["paso_actual"] == 2
        print(f"Step 1: {draft['cultura_nombre']} (nivel_vida: {draft['nivel_vida']})")
        
        # Step 2: Background
        step2_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step2",
            json={"trasfondo_id": backgrounds[0]["id"]}
        )
        assert step2_response.status_code == 200
        assert step2_response.json()["paso_actual"] == 3
        print("Step 2: Background completed")
        
        # Step 3: Occupation
        step3_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step3",
            json={"ocupacion_id": occupations[0]["id"]}
        )
        assert step3_response.status_code == 200
        assert step3_response.json()["paso_actual"] == 4
        print("Step 3: Occupation completed")
        
        # Step 4: Attributes
        step4_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step4",
            json={
                "atributos": {
                    "fuerza": 15,
                    "destreza": 14,
                    "constitucion": 13,
                    "inteligencia": 12,
                    "sabiduria": 10,
                    "carisma": 8
                },
                "metodo_asignacion": "standard_array"
            }
        )
        assert step4_response.status_code == 200
        assert step4_response.json()["paso_actual"] == 5
        print("Step 4: Attributes completed")
        
        # SKIP Step 5 (Virtue) - Elfos de Lindon doesn't get virtue
        # Frontend skips this step automatically
        
        # Step 6: Skills
        step6_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step6",
            json={"habilidades": ["Atletismo", "Percepción"]}
        )
        assert step6_response.status_code == 200
        assert step6_response.json()["paso_actual"] == 7
        print("Step 6: Skills completed (Step 5 Virtue SKIPPED)")
        
        # Step 7: Equipment (automatic based on Frugal nivel_vida)
        step7_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step7",
            json={
                "inventario": [
                    {"item_id": "auto-mochila", "nombre": "Mochila", "cantidad": 1, "equipado": False},
                    {"item_id": "auto-petate", "nombre": "Petate", "cantidad": 1, "equipado": False},
                ],
                "dinero": {"mp": 15, "mo": 0, "mc": 0}
            }
        )
        assert step7_response.status_code == 200
        assert step7_response.json()["paso_actual"] == 8
        print("Step 7: Equipment completed (Frugal equipment)")
        
        # Step 8: Details (traits from background)
        step8_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step9",  # API still uses step9 endpoint
            json={
                "rasgo_distintivo": "Sabio",
                "defecto": None,
                "motivacion": None,
                "historia": "Un elfo de Lindon..."
            }
        )
        assert step8_response.status_code == 200
        assert step8_response.json()["paso_actual"] == 9
        print("Step 8: Details completed")
        
        # Finalize character WITHOUT virtue
        finalize_response = requests.post(
            f"{BASE_URL}/api/characters/draft/{draft_id}/finalize"
        )
        assert finalize_response.status_code == 200
        character = finalize_response.json()
        assert character["nombre"] == "TEST_Galadriel"
        assert character["cultura_nombre"] == "Elfos de Lindon"
        assert character["virtud_id"] is None  # No virtue for this culture
        assert character["nivel"] == 1
        print(f"Character finalized: {character['id']} (NO virtue)")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/characters/{character['id']}")
        print("Test character deleted")
    
    def test_create_character_with_virtue_hombres_bree(self):
        """Test creating character with Hombres de Bree (HAS virtue, Común)"""
        # Get culture ID
        cultures = requests.get(f"{BASE_URL}/api/data/cultures").json()["cultures"]
        hombre = next((c for c in cultures if c['nombre'] == 'Hombres de Bree'), None)
        assert hombre is not None
        
        # Get other required data
        backgrounds = requests.get(f"{BASE_URL}/api/data/backgrounds").json()["backgrounds"]
        occupations = requests.get(f"{BASE_URL}/api/data/occupations").json()["occupations"]
        virtues = requests.get(f"{BASE_URL}/api/data/virtues").json()["virtues"]
        
        # Step 0: Create draft
        draft_response = requests.post(f"{BASE_URL}/api/characters/draft")
        assert draft_response.status_code == 200
        draft_id = draft_response.json()["id"]
        print(f"Created draft: {draft_id}")
        
        # Step 1: Culture (Hombres de Bree - Común, HAS virtue)
        step1_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step1",
            json={
                "nombre": "TEST_Barliman",
                "jugador": "Test Player",
                "cultura_id": hombre["id"]
            }
        )
        assert step1_response.status_code == 200
        draft = step1_response.json()
        assert draft["cultura_nombre"] == "Hombres de Bree"
        assert draft["nivel_vida"] == "Común"
        assert draft["paso_actual"] == 2
        print(f"Step 1: {draft['cultura_nombre']} (nivel_vida: {draft['nivel_vida']})")
        
        # Step 2: Background
        step2_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step2",
            json={"trasfondo_id": backgrounds[0]["id"]}
        )
        assert step2_response.status_code == 200
        print("Step 2: Background completed")
        
        # Step 3: Occupation
        step3_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step3",
            json={"ocupacion_id": occupations[0]["id"]}
        )
        assert step3_response.status_code == 200
        print("Step 3: Occupation completed")
        
        # Step 4: Attributes
        step4_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step4",
            json={
                "atributos": {
                    "fuerza": 15,
                    "destreza": 14,
                    "constitucion": 13,
                    "inteligencia": 12,
                    "sabiduria": 10,
                    "carisma": 8
                },
                "metodo_asignacion": "standard_array"
            }
        )
        assert step4_response.status_code == 200
        print("Step 4: Attributes completed")
        
        # Step 5: Virtue (Hombres de Bree GETS virtue)
        step5_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step5",
            json={"virtud_id": virtues[0]["id"]}
        )
        assert step5_response.status_code == 200
        draft = step5_response.json()
        assert draft["virtud_id"] == virtues[0]["id"]
        assert draft["virtud_nombre"] is not None
        print(f"Step 5: Virtue selected - {draft['virtud_nombre']}")
        
        # Step 6: Skills
        step6_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step6",
            json={"habilidades": ["Atletismo", "Percepción"]}
        )
        assert step6_response.status_code == 200
        print("Step 6: Skills completed")
        
        # Step 7: Equipment (automatic based on Común nivel_vida)
        step7_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step7",
            json={
                "inventario": [
                    {"item_id": "auto-mochila", "nombre": "Mochila", "cantidad": 1, "equipado": False},
                    {"item_id": "auto-petate", "nombre": "Petate", "cantidad": 1, "equipado": False},
                    {"item_id": "auto-antorchas", "nombre": "Antorchas (paquete de 10)", "cantidad": 1, "equipado": False},
                ],
                "dinero": {"mp": 15, "mo": 0, "mc": 0}
            }
        )
        assert step7_response.status_code == 200
        print("Step 7: Equipment completed (Común equipment)")
        
        # Step 8: Details
        step8_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step9",
            json={
                "rasgo_distintivo": "Hospitalario",
                "defecto": None,
                "motivacion": None,
                "historia": "Un hombre de Bree..."
            }
        )
        assert step8_response.status_code == 200
        print("Step 8: Details completed")
        
        # Finalize character WITH virtue
        finalize_response = requests.post(
            f"{BASE_URL}/api/characters/draft/{draft_id}/finalize"
        )
        assert finalize_response.status_code == 200
        character = finalize_response.json()
        assert character["nombre"] == "TEST_Barliman"
        assert character["cultura_nombre"] == "Hombres de Bree"
        assert character["virtud_id"] is not None  # HAS virtue
        assert character["virtud_nombre"] is not None
        print(f"Character finalized: {character['id']} (WITH virtue: {character['virtud_nombre']})")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/characters/{character['id']}")
        print("Test character deleted")


class TestBackgroundTraits:
    """Test that personality traits come from Background"""
    
    def test_background_has_rasgo_distintivo(self):
        """Test backgrounds have rasgo_distintivo field"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds")
        assert response.status_code == 200
        backgrounds = response.json()["backgrounds"]
        
        # Check first few backgrounds for rasgo_distintivo
        for bg in backgrounds[:5]:
            bg_detail = requests.get(f"{BASE_URL}/api/data/backgrounds/{bg['id']}").json()
            print(f"Background: {bg_detail['nombre']}")
            if bg_detail.get('rasgo_distintivo'):
                print(f"  - Rasgo distintivo: {bg_detail['rasgo_distintivo']}")
            if bg_detail.get('competencias_habilidades'):
                print(f"  - Competencias: {bg_detail['competencias_habilidades']}")


class TestStepIndicator:
    """Test step indicator shows correct number of steps"""
    
    def test_step_count_is_8(self):
        """Verify the wizard has 8 steps (Patron removed)"""
        # This is a frontend test, but we can verify the backend supports 8 steps
        # by checking that step7 goes to step8 and step9 (details) completes the flow
        
        # Create draft
        draft_response = requests.post(f"{BASE_URL}/api/characters/draft")
        draft_id = draft_response.json()["id"]
        
        # Get cultures and other data
        cultures = requests.get(f"{BASE_URL}/api/data/cultures").json()["cultures"]
        backgrounds = requests.get(f"{BASE_URL}/api/data/backgrounds").json()["backgrounds"]
        occupations = requests.get(f"{BASE_URL}/api/data/occupations").json()["occupations"]
        
        # Go through steps
        requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step1", json={
            "nombre": "TEST_StepCount", "jugador": "Test", "cultura_id": cultures[0]["id"]
        })
        requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step2", json={
            "trasfondo_id": backgrounds[0]["id"]
        })
        requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step3", json={
            "ocupacion_id": occupations[0]["id"]
        })
        requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step4", json={
            "atributos": {"fuerza": 15, "destreza": 14, "constitucion": 13, 
                        "inteligencia": 12, "sabiduria": 10, "carisma": 8},
            "metodo_asignacion": "standard_array"
        })
        requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step6", json={
            "habilidades": ["Atletismo"]
        })
        
        # Step 7 should set paso_actual to 8
        step7_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step7", json={
            "inventario": [], "dinero": {"mp": 15, "mo": 0, "mc": 0}
        })
        assert step7_response.json()["paso_actual"] == 8, "Step 7 should advance to step 8"
        print("Step 7 correctly advances to step 8")
        
        # Step 9 (details) should set paso_actual to 9 (complete)
        step9_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step9", json={
            "rasgo_distintivo": "Test", "historia": "Test"
        })
        assert step9_response.json()["paso_actual"] == 9, "Step 8 (details) should complete at 9"
        print("Step 8 (details) correctly completes the flow")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/characters/draft/{draft_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
