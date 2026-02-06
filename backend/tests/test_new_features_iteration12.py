"""
Test file for iteration 12 features:
1. CultureEditor 'Competencia Adicional' selector with categories (Herramientas/Juegos/Instrumentos/Pipa)
2. Step5Virtue using tiene_virtud_inicial from draft and /api/data/cultures/{id}/virtues endpoint
3. Backend step5 endpoint accepting all virtue data fields
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCultureCompetenciaAdicionalCategories:
    """Test CultureEditor competencia adicional category selector"""
    
    def test_create_culture_with_herramientas_category(self):
        """Test creating culture with herramientas category competencia adicional"""
        unique_name = f"TEST_Culture_Herramientas_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/data/cultures", json={
            "nombre": unique_name,
            "raza": "Hombres",
            "competencia_adicional_categoria": "herramientas",
            "competencia_adicional": "Herramientas de carpintería"
        })
        
        assert response.status_code == 200, f"Failed to create culture: {response.text}"
        data = response.json()
        assert data["nombre"] == unique_name
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/cultures/{data['id']}")
    
    def test_create_culture_with_juegos_category(self):
        """Test creating culture with juegos category competencia adicional"""
        unique_name = f"TEST_Culture_Juegos_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/data/cultures", json={
            "nombre": unique_name,
            "raza": "Hobbits",
            "competencia_adicional_categoria": "juegos",
            "competencia_adicional": "Dados"
        })
        
        assert response.status_code == 200, f"Failed to create culture: {response.text}"
        data = response.json()
        assert data["nombre"] == unique_name
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/cultures/{data['id']}")
    
    def test_create_culture_with_instrumentos_category(self):
        """Test creating culture with instrumentos category competencia adicional"""
        unique_name = f"TEST_Culture_Instrumentos_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/data/cultures", json={
            "nombre": unique_name,
            "raza": "Elfos",
            "competencia_adicional_categoria": "instrumentos",
            "competencia_adicional": "Arpa"
        })
        
        assert response.status_code == 200, f"Failed to create culture: {response.text}"
        data = response.json()
        assert data["nombre"] == unique_name
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/cultures/{data['id']}")
    
    def test_create_culture_with_pipa_category(self):
        """Test creating culture with pipa category - no second selector needed"""
        unique_name = f"TEST_Culture_Pipa_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/data/cultures", json={
            "nombre": unique_name,
            "raza": "Hobbits",
            "competencia_adicional_categoria": "pipa",
            "competencia_adicional": "Pipa"  # Pipa is directly set
        })
        
        assert response.status_code == 200, f"Failed to create culture: {response.text}"
        data = response.json()
        assert data["nombre"] == unique_name
        # For pipa category, competencia_adicional should be "Pipa"
        assert data.get("competencia_adicional") == "Pipa"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/cultures/{data['id']}")
    
    def test_pipa_in_tools_list(self):
        """Test that Pipa is available in the tools list"""
        # This is a frontend test, but we can verify the backend accepts it
        unique_name = f"TEST_Culture_PipaTool_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/data/cultures", json={
            "nombre": unique_name,
            "raza": "Hobbits",
            "competencia_herramienta_elegir_1": ["Pipa", "Herramientas de cocinero"]
        })
        
        assert response.status_code == 200, f"Failed to create culture: {response.text}"
        data = response.json()
        assert "Pipa" in data.get("competencia_herramienta_elegir_1", [])
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/cultures/{data['id']}")


class TestStep5VirtueEndpoint:
    """Test Step5Virtue using /api/data/cultures/{id}/virtues endpoint"""
    
    # Culture with tiene_virtud_inicial=true: Hombres del lago
    CULTURE_WITH_VIRTUE_ID = "0a9f2b7b-4ff2-4843-bca8-661a9c188d2b"
    
    def test_get_culture_virtues_endpoint(self):
        """Test GET /api/data/cultures/{id}/virtues returns virtues for culture with tiene_virtud_inicial"""
        response = requests.get(f"{BASE_URL}/api/data/cultures/{self.CULTURE_WITH_VIRTUE_ID}/virtues")
        
        assert response.status_code == 200, f"Failed to get virtues: {response.text}"
        data = response.json()
        
        assert "virtues" in data
        assert "culture_name" in data
        assert data["culture_name"] == "Hombres del lago"
        assert data.get("tiene_virtud_inicial") == True
        assert len(data["virtues"]) > 0
        
        # Verify expected virtues are present
        virtue_names = [v["nombre"] for v in data["virtues"]]
        assert "Amigo de los Enanos" in virtue_names
        assert "Acérrimo" in virtue_names
    
    def test_culture_has_tiene_virtud_inicial_field(self):
        """Test that culture has tiene_virtud_inicial field"""
        response = requests.get(f"{BASE_URL}/api/data/cultures/{self.CULTURE_WITH_VIRTUE_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "tiene_virtud_inicial" in data
        assert data["tiene_virtud_inicial"] == True
    
    def test_virtues_endpoint_returns_404_for_nonexistent_culture(self):
        """Test that virtues endpoint returns 404 for non-existent culture"""
        response = requests.get(f"{BASE_URL}/api/data/cultures/nonexistent-id/virtues")
        
        assert response.status_code == 404


class TestStep5BackendAllVirtueFields:
    """Test PATCH /api/draft/{id}/step5 accepts all virtue data fields"""
    
    def test_step5_accepts_all_virtue_fields(self):
        """Test that step5 endpoint accepts all new virtue fields"""
        # Create a draft first
        draft_response = requests.post(f"{BASE_URL}/api/characters/draft")
        assert draft_response.status_code == 200
        draft = draft_response.json()
        draft_id = draft["id"]
        
        try:
            # First complete step1 with a culture that has virtud inicial
            step1_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step1", json={
                "cultura_id": "0a9f2b7b-4ff2-4843-bca8-661a9c188d2b",  # Hombres del lago
                "nombre": "TEST_Character_Virtue",
                "tiene_virtud_inicial": True
            })
            assert step1_response.status_code == 200
            
            # Complete step2 (background)
            backgrounds_response = requests.get(f"{BASE_URL}/api/data/backgrounds")
            backgrounds = backgrounds_response.json().get("backgrounds", [])
            if backgrounds:
                step2_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step2", json={
                    "trasfondo_id": backgrounds[0]["id"]
                })
                assert step2_response.status_code == 200
            
            # Complete step3 (occupation)
            occupations_response = requests.get(f"{BASE_URL}/api/data/occupations")
            occupations = occupations_response.json().get("occupations", [])
            if occupations:
                step3_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step3", json={
                    "ocupacion_id": occupations[0]["id"],
                    "habilidades_elegidas": [],
                    "herramientas_elegidas": [],
                    "pericia_elegida": [],
                    "equipo_ocupacion": []
                })
                assert step3_response.status_code == 200
            
            # Complete step4 (attributes)
            step4_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step4", json={
                "atributos": {
                    "fuerza": 14,
                    "destreza": 12,
                    "constitucion": 13,
                    "inteligencia": 10,
                    "sabiduria": 11,
                    "carisma": 8
                },
                "metodo_asignacion": "standard_array"
            })
            assert step4_response.status_code == 200
            
            # Get a virtue for testing
            virtues_response = requests.get(f"{BASE_URL}/api/data/cultures/0a9f2b7b-4ff2-4843-bca8-661a9c188d2b/virtues")
            virtues = virtues_response.json().get("virtues", [])
            assert len(virtues) > 0, "No virtues found for culture"
            
            test_virtue = virtues[0]
            
            # Now test step5 with ALL virtue fields
            step5_data = {
                "virtud_id": test_virtue["id"],
                "virtud_nombre": test_virtue.get("nombre"),
                "virtud_descripcion": test_virtue.get("descripcion"),
                "virtud_rasgos": test_virtue.get("rasgos_virtud") or test_virtue.get("competencias_texto"),
                # Characteristic bonuses
                "virtud_caracteristicas_fijas": test_virtue.get("caracteristicas_fijas", {}),
                "virtud_caracteristicas_elegir": test_virtue.get("caracteristicas_elegir", []),
                # Saving throw proficiencies
                "virtud_salvaciones_elegir": test_virtue.get("salvaciones_elegir", []),
                # Extra stats
                "virtud_pg_extra": test_virtue.get("puntos_golpe_extra", 0),
                "virtud_comunidad_extra": test_virtue.get("puntos_comunidad_extra", 0),
                "virtud_ca_extra": test_virtue.get("clase_armadura_extra", 0),
                # Skill/tool proficiencies to choose
                "virtud_habilidades_elegir": test_virtue.get("competencias_habilidades_elegir", []),
                "virtud_herramientas_elegir": test_virtue.get("competencias_herramientas_elegir", [])
            }
            
            step5_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step5", json=step5_data)
            
            assert step5_response.status_code == 200, f"Step5 failed: {step5_response.text}"
            result = step5_response.json()
            
            # Verify all fields were saved
            assert result.get("virtud_id") == test_virtue["id"]
            assert result.get("virtud_nombre") == test_virtue.get("nombre")
            assert "virtud_descripcion" in result
            assert "virtud_caracteristicas_fijas" in result
            assert "virtud_caracteristicas_elegir" in result
            assert "virtud_salvaciones_elegir" in result
            assert "virtud_pg_extra" in result
            assert "virtud_comunidad_extra" in result
            assert "virtud_ca_extra" in result
            assert "virtud_habilidades_elegir" in result
            assert "virtud_herramientas_elegir" in result
            
            print(f"Step5 saved virtue: {result.get('virtud_nombre')}")
            print(f"Virtue fields saved: virtud_id, virtud_nombre, virtud_descripcion, virtud_rasgos, virtud_caracteristicas_fijas, virtud_caracteristicas_elegir, virtud_salvaciones_elegir, virtud_pg_extra, virtud_comunidad_extra, virtud_ca_extra, virtud_habilidades_elegir, virtud_herramientas_elegir")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/characters/draft/{draft_id}")
    
    def test_draft_has_tiene_virtud_inicial_after_step1(self):
        """Test that draft has tiene_virtud_inicial field after step1"""
        # Create a draft
        draft_response = requests.post(f"{BASE_URL}/api/characters/draft")
        assert draft_response.status_code == 200
        draft = draft_response.json()
        draft_id = draft["id"]
        
        try:
            # Complete step1 with culture that has virtud inicial
            step1_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step1", json={
                "cultura_id": "0a9f2b7b-4ff2-4843-bca8-661a9c188d2b",  # Hombres del lago
                "nombre": "TEST_Draft_Virtue_Check",
                "tiene_virtud_inicial": True
            })
            assert step1_response.status_code == 200
            result = step1_response.json()
            
            # Verify tiene_virtud_inicial is in draft
            assert "tiene_virtud_inicial" in result
            assert result["tiene_virtud_inicial"] == True
            
            print(f"Draft tiene_virtud_inicial: {result.get('tiene_virtud_inicial')}")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/characters/draft/{draft_id}")


class TestFinalizeCharacterWithVirtue:
    """Test that finalize endpoint includes all virtue data"""
    
    def test_finalize_includes_all_virtue_fields(self):
        """Test that finalized character includes all virtue data"""
        # Create and complete a full character draft
        draft_response = requests.post(f"{BASE_URL}/api/characters/draft")
        assert draft_response.status_code == 200
        draft = draft_response.json()
        draft_id = draft["id"]
        character_id = None
        
        try:
            # Step 1: Culture
            step1_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step1", json={
                "cultura_id": "0a9f2b7b-4ff2-4843-bca8-661a9c188d2b",
                "nombre": f"TEST_Finalize_Virtue_{uuid.uuid4().hex[:8]}",
                "tiene_virtud_inicial": True,
                "caracteristicas": {
                    "fuerza": 14, "destreza": 12, "constitucion": 13,
                    "inteligencia": 10, "sabiduria": 11, "carisma": 8
                }
            })
            assert step1_response.status_code == 200
            
            # Step 2: Background
            backgrounds_response = requests.get(f"{BASE_URL}/api/data/backgrounds")
            backgrounds = backgrounds_response.json().get("backgrounds", [])
            step2_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step2", json={
                "trasfondo_id": backgrounds[0]["id"]
            })
            assert step2_response.status_code == 200
            
            # Step 3: Occupation
            occupations_response = requests.get(f"{BASE_URL}/api/data/occupations")
            occupations = occupations_response.json().get("occupations", [])
            step3_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step3", json={
                "ocupacion_id": occupations[0]["id"],
                "habilidades_elegidas": [],
                "herramientas_elegidas": [],
                "pericia_elegida": [],
                "equipo_ocupacion": []
            })
            assert step3_response.status_code == 200
            
            # Step 4: Attributes
            step4_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step4", json={
                "atributos": {
                    "fuerza": 14, "destreza": 12, "constitucion": 13,
                    "inteligencia": 10, "sabiduria": 11, "carisma": 8
                },
                "metodo_asignacion": "standard_array"
            })
            assert step4_response.status_code == 200
            
            # Step 5: Virtue
            virtues_response = requests.get(f"{BASE_URL}/api/data/cultures/0a9f2b7b-4ff2-4843-bca8-661a9c188d2b/virtues")
            virtues = virtues_response.json().get("virtues", [])
            test_virtue = virtues[0]
            
            step5_response = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step5", json={
                "virtud_id": test_virtue["id"],
                "virtud_nombre": test_virtue.get("nombre"),
                "virtud_descripcion": test_virtue.get("descripcion"),
                "virtud_rasgos": test_virtue.get("rasgos_virtud"),
                "virtud_caracteristicas_fijas": test_virtue.get("caracteristicas_fijas", {}),
                "virtud_caracteristicas_elegir": test_virtue.get("caracteristicas_elegir", []),
                "virtud_salvaciones_elegir": test_virtue.get("salvaciones_elegir", []),
                "virtud_pg_extra": test_virtue.get("puntos_golpe_extra", 0),
                "virtud_comunidad_extra": test_virtue.get("puntos_comunidad_extra", 0),
                "virtud_ca_extra": test_virtue.get("clase_armadura_extra", 0),
                "virtud_habilidades_elegir": test_virtue.get("competencias_habilidades_elegir", []),
                "virtud_herramientas_elegir": test_virtue.get("competencias_herramientas_elegir", [])
            })
            assert step5_response.status_code == 200
            
            # Finalize character
            finalize_response = requests.post(f"{BASE_URL}/api/characters/draft/{draft_id}/finalize")
            assert finalize_response.status_code == 200, f"Finalize failed: {finalize_response.text}"
            character = finalize_response.json()
            character_id = character["id"]
            
            # Verify all virtue fields are in finalized character
            assert character.get("virtud_id") == test_virtue["id"]
            assert character.get("virtud_nombre") == test_virtue.get("nombre")
            assert "virtud_descripcion" in character
            assert "virtud_caracteristicas_fijas" in character
            assert "virtud_caracteristicas_elegir" in character
            assert "virtud_salvaciones_elegir" in character
            assert "virtud_pg_extra" in character
            assert "virtud_comunidad_extra" in character
            assert "virtud_ca_extra" in character
            assert "virtud_habilidades_elegir" in character
            assert "virtud_herramientas_elegir" in character
            
            print(f"Finalized character has virtue: {character.get('virtud_nombre')}")
            print(f"All virtue fields present in finalized character")
            
        finally:
            # Cleanup
            if character_id:
                requests.delete(f"{BASE_URL}/api/characters/{character_id}")
            requests.delete(f"{BASE_URL}/api/characters/draft/{draft_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
