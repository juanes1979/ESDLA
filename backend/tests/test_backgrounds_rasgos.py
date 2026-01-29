"""
Test Background Rasgos and Equipment by Nivel de Vida
Tests the new features:
1. GET /api/data/backgrounds returns rasgos array and rasgo_distintivo
2. Cultures have nivel_vida (Frugal/Común/Próspero)
3. Full character creation flow for cultures with/without virtue
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


class TestBackgroundRasgos:
    """Test that backgrounds return rasgos array and rasgo_distintivo"""
    
    def test_backgrounds_endpoint_returns_rasgos(self):
        """Verify /api/data/backgrounds returns rasgos field"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds")
        assert response.status_code == 200
        
        data = response.json()
        assert "backgrounds" in data
        assert len(data["backgrounds"]) > 0
        
        # Check first background has rasgos field
        bg = data["backgrounds"][0]
        assert "rasgos" in bg, "Background should have 'rasgos' field"
        assert isinstance(bg["rasgos"], list), "rasgos should be a list"
    
    def test_construccion_de_barcos_has_correct_rasgos(self):
        """Verify CONSTRUCCIÓN DE BARCOS has rasgos=['Animoso', 'Señorial']"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds")
        assert response.status_code == 200
        
        data = response.json()
        bg = next((b for b in data["backgrounds"] if b["nombre"] == "CONSTRUCCIÓN DE BARCOS"), None)
        
        assert bg is not None, "CONSTRUCCIÓN DE BARCOS background should exist"
        assert bg["rasgos"] == ["Animoso", "Señorial"], f"Expected ['Animoso', 'Señorial'], got {bg['rasgos']}"
        assert bg["rasgo_distintivo"] == "Animoso", f"Expected 'Animoso', got {bg['rasgo_distintivo']}"
    
    def test_all_backgrounds_have_rasgos_field(self):
        """Verify all backgrounds have rasgos field (can be empty list)"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds")
        assert response.status_code == 200
        
        data = response.json()
        for bg in data["backgrounds"]:
            assert "rasgos" in bg, f"Background {bg['nombre']} missing 'rasgos' field"
            assert "rasgo_distintivo" in bg, f"Background {bg['nombre']} missing 'rasgo_distintivo' field"
    
    def test_get_single_background_has_rasgos(self):
        """Verify GET /api/data/backgrounds/{id} returns rasgos"""
        # First get list to find an ID
        response = requests.get(f"{BASE_URL}/api/data/backgrounds")
        assert response.status_code == 200
        
        bg_id = response.json()["backgrounds"][0]["id"]
        
        # Get single background
        response = requests.get(f"{BASE_URL}/api/data/backgrounds/{bg_id}")
        assert response.status_code == 200
        
        bg = response.json()
        assert "rasgos" in bg, "Single background should have 'rasgos' field"
        assert "rasgo_distintivo" in bg, "Single background should have 'rasgo_distintivo' field"


class TestCultureNivelDeVida:
    """Test that cultures have nivel_vida field"""
    
    def test_cultures_have_nivel_vida(self):
        """Verify cultures have nivel_vida field"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        assert response.status_code == 200
        
        data = response.json()
        assert "cultures" in data
        
        for culture in data["cultures"]:
            assert "nivel_vida" in culture, f"Culture {culture['nombre']} missing 'nivel_vida'"
    
    def test_elfos_de_lindon_is_frugal(self):
        """Verify Elfos de Lindon has nivel_vida='Frugal'"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        assert response.status_code == 200
        
        data = response.json()
        culture = next((c for c in data["cultures"] if c["nombre"] == "Elfos de Lindon"), None)
        
        assert culture is not None, "Elfos de Lindon should exist"
        assert culture["nivel_vida"] == "Frugal", f"Expected 'Frugal', got {culture['nivel_vida']}"
    
    def test_elfos_noldor_is_prospero(self):
        """Verify Elfos Noldor has nivel_vida='Próspero'"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        assert response.status_code == 200
        
        data = response.json()
        culture = next((c for c in data["cultures"] if c["nombre"] == "Elfos Noldor"), None)
        
        assert culture is not None, "Elfos Noldor should exist"
        assert culture["nivel_vida"] == "Próspero", f"Expected 'Próspero', got {culture['nivel_vida']}"
    
    def test_hobbits_albos_is_comun(self):
        """Verify Hobbits Albos has nivel_vida='Común'"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        assert response.status_code == 200
        
        data = response.json()
        culture = next((c for c in data["cultures"] if c["nombre"] == "Hobbits Albos"), None)
        
        assert culture is not None, "Hobbits Albos should exist"
        assert culture["nivel_vida"] == "Común", f"Expected 'Común', got {culture['nivel_vida']}"


class TestCharacterCreationFlowElfosLindon:
    """Test full character creation for Elfos de Lindon (skips virtue step)"""
    
    def test_create_draft_elfos_lindon(self):
        """Create a draft character with Elfos de Lindon culture"""
        # Get Elfos de Lindon culture
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        assert response.status_code == 200
        cultures = response.json()["cultures"]
        elfos_lindon = next((c for c in cultures if c["nombre"] == "Elfos de Lindon"), None)
        assert elfos_lindon is not None
        
        # Create draft
        response = requests.post(f"{BASE_URL}/api/characters/drafts")
        assert response.status_code == 200
        draft = response.json()
        draft_id = draft["id"]
        
        # Step 1: Set culture
        response = requests.put(
            f"{BASE_URL}/api/characters/drafts/{draft_id}/step1",
            json={"cultura_id": elfos_lindon["id"]}
        )
        assert response.status_code == 200
        draft = response.json()
        assert draft["cultura_id"] == elfos_lindon["id"]
        assert draft["nivel_vida"] == "Frugal"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/characters/drafts/{draft_id}")
    
    def test_elfos_lindon_backgrounds_have_rasgos(self):
        """Verify Elfos de Lindon backgrounds have rasgos"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds", params={"cultura": "Elfos de Lindon"})
        assert response.status_code == 200
        
        backgrounds = response.json()["backgrounds"]
        assert len(backgrounds) > 0, "Elfos de Lindon should have backgrounds"
        
        for bg in backgrounds:
            assert "rasgos" in bg, f"Background {bg['nombre']} missing rasgos"
            # Most backgrounds should have at least one rasgo
            if bg["nombre"] == "CONSTRUCCIÓN DE BARCOS":
                assert len(bg["rasgos"]) == 2


class TestCharacterCreationFlowHombresBree:
    """Test full character creation for Hombres de Bree (includes virtue step)"""
    
    def test_hombres_de_bree_exists(self):
        """Verify Hombres de Bree culture exists"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        assert response.status_code == 200
        
        cultures = response.json()["cultures"]
        hombres_bree = next((c for c in cultures if c["nombre"] == "Hombres de Bree"), None)
        
        assert hombres_bree is not None, "Hombres de Bree should exist"
    
    def test_hombres_de_bree_has_virtues(self):
        """Verify Hombres de Bree has available virtues"""
        # Get culture ID
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        cultures = response.json()["cultures"]
        hombres_bree = next((c for c in cultures if c["nombre"] == "Hombres de Bree"), None)
        
        if hombres_bree:
            # Get virtues for this culture
            response = requests.get(
                f"{BASE_URL}/api/data/virtues",
                params={"cultura": "Hombres de Bree", "include_common": "true"}
            )
            assert response.status_code == 200
            
            virtues = response.json()["virtues"]
            # Should have at least common virtues
            assert len(virtues) > 0, "Hombres de Bree should have virtues available"


class TestEquipmentByNivelDeVida:
    """Test equipment endpoints"""
    
    def test_weapons_endpoint(self):
        """Verify weapons endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/data/weapons")
        assert response.status_code == 200
        
        data = response.json()
        assert "weapons" in data
        assert len(data["weapons"]) > 0
    
    def test_armors_endpoint(self):
        """Verify armors endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/data/armors")
        assert response.status_code == 200
        
        data = response.json()
        assert "armors" in data
        assert len(data["armors"]) > 0
    
    def test_equipment_endpoint(self):
        """Verify general equipment endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/data/equipment")
        assert response.status_code == 200
        
        data = response.json()
        assert "equipment" in data


class TestFullCharacterCreationWithRasgos:
    """Test complete character creation flow verifying rasgos are preserved"""
    
    def test_create_and_finalize_character_with_rasgos(self):
        """Create a complete character and verify rasgos from background"""
        # Get Elfos de Lindon culture
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        cultures = response.json()["cultures"]
        elfos_lindon = next((c for c in cultures if c["nombre"] == "Elfos de Lindon"), None)
        assert elfos_lindon is not None
        
        # Get a background with rasgos
        response = requests.get(f"{BASE_URL}/api/data/backgrounds", params={"cultura": "Elfos de Lindon"})
        backgrounds = response.json()["backgrounds"]
        bg_with_rasgos = next((b for b in backgrounds if len(b.get("rasgos", [])) > 0), None)
        assert bg_with_rasgos is not None, "Should find a background with rasgos"
        
        # Get an occupation
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        occupations = response.json()["occupations"]
        occupation = occupations[0]
        
        # Create draft
        response = requests.post(f"{BASE_URL}/api/characters/drafts")
        assert response.status_code == 200
        draft_id = response.json()["id"]
        
        try:
            # Step 1: Culture
            response = requests.put(
                f"{BASE_URL}/api/characters/drafts/{draft_id}/step1",
                json={"cultura_id": elfos_lindon["id"]}
            )
            assert response.status_code == 200
            
            # Step 2: Background
            response = requests.put(
                f"{BASE_URL}/api/characters/drafts/{draft_id}/step2",
                json={"trasfondo_id": bg_with_rasgos["id"]}
            )
            assert response.status_code == 200
            draft = response.json()
            
            # Verify rasgo_trasfondo is set from background
            assert draft.get("rasgo_trasfondo") == bg_with_rasgos["rasgo_distintivo"], \
                f"Expected rasgo_trasfondo={bg_with_rasgos['rasgo_distintivo']}, got {draft.get('rasgo_trasfondo')}"
            
            # Step 3: Occupation
            response = requests.put(
                f"{BASE_URL}/api/characters/drafts/{draft_id}/step3",
                json={"ocupacion_id": occupation["id"]}
            )
            assert response.status_code == 200
            
            # Step 4: Attributes (use default point buy)
            response = requests.put(
                f"{BASE_URL}/api/characters/drafts/{draft_id}/step4",
                json={
                    "fuerza": 10,
                    "destreza": 10,
                    "constitucion": 10,
                    "inteligencia": 10,
                    "sabiduria": 10,
                    "carisma": 10
                }
            )
            assert response.status_code == 200
            
            # Step 5: Skills (skip for now, use defaults)
            response = requests.put(
                f"{BASE_URL}/api/characters/drafts/{draft_id}/step5",
                json={"habilidades_elegidas": []}
            )
            assert response.status_code == 200
            
            # Step 6: Name
            response = requests.put(
                f"{BASE_URL}/api/characters/drafts/{draft_id}/step6",
                json={
                    "nombre": "TEST_Elrohir",
                    "genero": "Hombre",
                    "edad": 500,
                    "altura": 180,
                    "peso": 70
                }
            )
            assert response.status_code == 200
            
            # Step 7: Equipment
            response = requests.put(
                f"{BASE_URL}/api/characters/drafts/{draft_id}/step7",
                json={
                    "inventario": [],
                    "dinero": {"mp": 15, "mo": 0, "mc": 0}
                }
            )
            assert response.status_code == 200
            
            # Step 8: Details (rasgo_distintivo comes from background)
            response = requests.put(
                f"{BASE_URL}/api/characters/drafts/{draft_id}/step9",
                json={
                    "rasgo_distintivo": bg_with_rasgos["rasgo_distintivo"],
                    "historia": "Test character history"
                }
            )
            assert response.status_code == 200
            
            # Finalize
            response = requests.post(f"{BASE_URL}/api/characters/drafts/{draft_id}/finalize")
            assert response.status_code == 200
            
            character = response.json()
            assert character["nombre"] == "TEST_Elrohir"
            assert character.get("rasgo_distintivo") == bg_with_rasgos["rasgo_distintivo"]
            
            # Cleanup - delete the character
            char_id = character["id"]
            requests.delete(f"{BASE_URL}/api/characters/{char_id}")
            
        finally:
            # Cleanup draft if still exists
            requests.delete(f"{BASE_URL}/api/characters/drafts/{draft_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
