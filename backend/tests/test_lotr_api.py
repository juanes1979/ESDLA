"""
LOTR 5e RPG API Tests
Tests for game data endpoints and character creation flow
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasics:
    """Health check and basic API tests"""
    
    def test_health_check(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"Health check passed: {data}")
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"API root: {data}")


class TestCulturesAPI:
    """Tests for /api/data/cultures endpoints"""
    
    def test_get_all_cultures(self):
        """Test GET /api/data/cultures returns 19 cultures"""
        response = requests.get(f"{BASE_URL}/api/data/cultures")
        assert response.status_code == 200
        data = response.json()
        assert "cultures" in data
        cultures = data["cultures"]
        print(f"Found {len(cultures)} cultures")
        assert len(cultures) == 19, f"Expected 19 cultures, got {len(cultures)}"
        
        # Verify culture structure
        if cultures:
            culture = cultures[0]
            assert "id" in culture
            assert "nombre" in culture
            assert "categoria" in culture
            print(f"Sample culture: {culture['nombre']} ({culture['categoria']})")
    
    def test_get_cultures_by_category_elfos(self):
        """Test filtering cultures by ELFOS category"""
        response = requests.get(f"{BASE_URL}/api/data/cultures?categoria=ELFOS")
        assert response.status_code == 200
        data = response.json()
        cultures = data["cultures"]
        assert len(cultures) > 0, "Expected at least one Elf culture"
        for culture in cultures:
            assert culture["categoria"] == "ELFOS"
        print(f"Found {len(cultures)} Elf cultures")
    
    def test_get_cultures_by_category_enanos(self):
        """Test filtering cultures by ENANOS category"""
        response = requests.get(f"{BASE_URL}/api/data/cultures?categoria=ENANOS")
        assert response.status_code == 200
        data = response.json()
        cultures = data["cultures"]
        assert len(cultures) > 0, "Expected at least one Dwarf culture"
        for culture in cultures:
            assert culture["categoria"] == "ENANOS"
        print(f"Found {len(cultures)} Dwarf cultures")
    
    def test_get_cultures_by_category_hombres(self):
        """Test filtering cultures by HOMBRES category"""
        response = requests.get(f"{BASE_URL}/api/data/cultures?categoria=HOMBRES")
        assert response.status_code == 200
        data = response.json()
        cultures = data["cultures"]
        assert len(cultures) > 0, "Expected at least one Human culture"
        for culture in cultures:
            assert culture["categoria"] == "HOMBRES"
        print(f"Found {len(cultures)} Human cultures")
    
    def test_get_cultures_by_category_hobbits(self):
        """Test filtering cultures by HOBBITS category"""
        response = requests.get(f"{BASE_URL}/api/data/cultures?categoria=HOBBITS")
        assert response.status_code == 200
        data = response.json()
        cultures = data["cultures"]
        assert len(cultures) > 0, "Expected at least one Hobbit culture"
        for culture in cultures:
            assert culture["categoria"] == "HOBBITS"
        print(f"Found {len(cultures)} Hobbit cultures")
    
    def test_get_culture_categories(self):
        """Test GET /api/data/cultures/categories/list"""
        response = requests.get(f"{BASE_URL}/api/data/cultures/categories/list")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        expected = ["ELFOS", "ENANOS", "HOMBRES", "HOBBITS"]
        for cat in expected:
            assert cat in categories, f"Missing category: {cat}"
        print(f"Categories: {categories}")


class TestOccupationsAPI:
    """Tests for /api/data/occupations endpoints"""
    
    def test_get_all_occupations(self):
        """Test GET /api/data/occupations returns 6 occupations"""
        response = requests.get(f"{BASE_URL}/api/data/occupations")
        assert response.status_code == 200
        data = response.json()
        assert "occupations" in data
        occupations = data["occupations"]
        print(f"Found {len(occupations)} occupations")
        assert len(occupations) == 6, f"Expected 6 occupations, got {len(occupations)}"
        
        # Verify occupation structure
        if occupations:
            occ = occupations[0]
            assert "id" in occ
            assert "tipo" in occ
            assert "vocacion" in occ
            assert "dado_golpe" in occ
            print(f"Sample occupation: {occ['vocacion']} ({occ['tipo']})")


class TestVirtuesAPI:
    """Tests for /api/data/virtues endpoints"""
    
    def test_get_all_virtues(self):
        """Test GET /api/data/virtues returns virtues"""
        response = requests.get(f"{BASE_URL}/api/data/virtues")
        assert response.status_code == 200
        data = response.json()
        assert "virtues" in data
        virtues = data["virtues"]
        assert len(virtues) > 0, "Expected at least one virtue"
        print(f"Found {len(virtues)} virtues")
        
        # Verify virtue structure
        if virtues:
            virtue = virtues[0]
            assert "id" in virtue
            assert "nombre" in virtue
            print(f"Sample virtue: {virtue['nombre']}")


class TestBackgroundsAPI:
    """Tests for /api/data/backgrounds endpoints"""
    
    def test_get_all_backgrounds(self):
        """Test GET /api/data/backgrounds returns backgrounds"""
        response = requests.get(f"{BASE_URL}/api/data/backgrounds")
        assert response.status_code == 200
        data = response.json()
        assert "backgrounds" in data
        backgrounds = data["backgrounds"]
        assert len(backgrounds) > 0, "Expected at least one background"
        print(f"Found {len(backgrounds)} backgrounds")


class TestNamesAPI:
    """Tests for /api/data/names endpoints"""
    
    def test_get_culture_names(self):
        """Test GET /api/data/names/{cultura} returns name data"""
        # First get a culture name
        cultures_response = requests.get(f"{BASE_URL}/api/data/cultures")
        cultures = cultures_response.json()["cultures"]
        if cultures:
            culture_name = cultures[0]["nombre"]
            response = requests.get(f"{BASE_URL}/api/data/names/{culture_name}")
            # May return 404 if no name data for this culture
            if response.status_code == 200:
                data = response.json()
                assert "id" in data
                print(f"Name data found for {culture_name}")
            else:
                print(f"No name data for {culture_name} (status: {response.status_code})")


class TestCharacterDraftAPI:
    """Tests for character draft creation and step updates"""
    
    def test_create_character_draft(self):
        """Test POST /api/characters/draft creates a new draft"""
        response = requests.post(f"{BASE_URL}/api/characters/draft")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["paso_actual"] == 1
        assert data["estado"] == "borrador"
        print(f"Created draft: {data['id']}")
        return data["id"]
    
    def test_get_character_draft(self):
        """Test GET /api/characters/draft/{id} returns draft"""
        # Create a draft first
        create_response = requests.post(f"{BASE_URL}/api/characters/draft")
        draft_id = create_response.json()["id"]
        
        # Get the draft
        response = requests.get(f"{BASE_URL}/api/characters/draft/{draft_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == draft_id
        print(f"Retrieved draft: {data['id']}")
    
    def test_update_draft_step1(self):
        """Test PATCH /api/characters/draft/{id}/step1 saves culture selection"""
        # Create a draft
        create_response = requests.post(f"{BASE_URL}/api/characters/draft")
        draft_id = create_response.json()["id"]
        
        # Get a culture ID
        cultures_response = requests.get(f"{BASE_URL}/api/data/cultures")
        cultures = cultures_response.json()["cultures"]
        culture_id = cultures[0]["id"]
        culture_name = cultures[0]["nombre"]
        
        # Update step 1
        step1_data = {
            "nombre": "TEST_Legolas",
            "jugador": "Test Player",
            "cultura_id": culture_id
        }
        response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step1",
            json=step1_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["nombre"] == "TEST_Legolas"
        assert data["cultura_id"] == culture_id
        assert data["cultura_nombre"] == culture_name
        assert data["paso_actual"] == 2  # Should advance to step 2
        print(f"Step 1 saved: {data['nombre']} - {data['cultura_nombre']}")
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/characters/draft/{draft_id}")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["nombre"] == "TEST_Legolas"
        assert get_data["cultura_id"] == culture_id
    
    def test_draft_not_found(self):
        """Test 404 for non-existent draft"""
        response = requests.get(f"{BASE_URL}/api/characters/draft/non-existent-id")
        assert response.status_code == 404


class TestCharacterFullFlow:
    """Test complete character creation flow"""
    
    def test_full_character_creation_flow(self):
        """Test creating a character through all steps"""
        # Step 0: Create draft
        draft_response = requests.post(f"{BASE_URL}/api/characters/draft")
        assert draft_response.status_code == 200
        draft_id = draft_response.json()["id"]
        print(f"Created draft: {draft_id}")
        
        # Get game data
        cultures = requests.get(f"{BASE_URL}/api/data/cultures").json()["cultures"]
        backgrounds = requests.get(f"{BASE_URL}/api/data/backgrounds").json()["backgrounds"]
        occupations = requests.get(f"{BASE_URL}/api/data/occupations").json()["occupations"]
        virtues = requests.get(f"{BASE_URL}/api/data/virtues").json()["virtues"]
        
        # Step 1: Culture
        step1_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step1",
            json={
                "nombre": "TEST_Aragorn",
                "jugador": "Test Player",
                "cultura_id": cultures[0]["id"]
            }
        )
        assert step1_response.status_code == 200
        assert step1_response.json()["paso_actual"] == 2
        print("Step 1 (Culture) completed")
        
        # Step 2: Background
        step2_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step2",
            json={"trasfondo_id": backgrounds[0]["id"]}
        )
        assert step2_response.status_code == 200
        assert step2_response.json()["paso_actual"] == 3
        print("Step 2 (Background) completed")
        
        # Step 3: Occupation
        step3_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step3",
            json={"ocupacion_id": occupations[0]["id"]}
        )
        assert step3_response.status_code == 200
        assert step3_response.json()["paso_actual"] == 4
        print("Step 3 (Occupation) completed")
        
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
        print("Step 4 (Attributes) completed")
        
        # Step 5: Virtue
        step5_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step5",
            json={"virtud_id": virtues[0]["id"]}
        )
        assert step5_response.status_code == 200
        assert step5_response.json()["paso_actual"] == 6
        print("Step 5 (Virtue) completed")
        
        # Step 6: Skills
        step6_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step6",
            json={"habilidades": ["Atletismo", "Percepción"]}
        )
        assert step6_response.status_code == 200
        assert step6_response.json()["paso_actual"] == 7
        print("Step 6 (Skills) completed")
        
        # Step 7: Equipment
        step7_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step7",
            json={
                "inventario": [],
                "dinero": {"mp": 0, "mo": 10, "mc": 0}
            }
        )
        assert step7_response.status_code == 200
        assert step7_response.json()["paso_actual"] == 8
        print("Step 7 (Equipment) completed")
        
        # Step 8: Patron
        step8_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step8",
            json={"patron_id": None}
        )
        assert step8_response.status_code == 200
        assert step8_response.json()["paso_actual"] == 9
        print("Step 8 (Patron) completed")
        
        # Step 9: Details
        step9_response = requests.patch(
            f"{BASE_URL}/api/characters/draft/{draft_id}/step9",
            json={
                "rasgo_distintivo": "Valiente",
                "defecto": "Terco",
                "motivacion": "Proteger a los inocentes",
                "historia": "Un ranger del norte..."
            }
        )
        assert step9_response.status_code == 200
        assert step9_response.json()["paso_actual"] == 10
        print("Step 9 (Details) completed")
        
        # Finalize character
        finalize_response = requests.post(
            f"{BASE_URL}/api/characters/draft/{draft_id}/finalize"
        )
        assert finalize_response.status_code == 200
        character = finalize_response.json()
        assert character["nombre"] == "TEST_Aragorn"
        assert character["nivel"] == 1
        assert "atributos" in character
        print(f"Character finalized: {character['id']}")
        
        # Verify character exists
        get_response = requests.get(f"{BASE_URL}/api/characters/{character['id']}")
        assert get_response.status_code == 200
        assert get_response.json()["nombre"] == "TEST_Aragorn"
        
        # Cleanup - delete the test character
        delete_response = requests.delete(f"{BASE_URL}/api/characters/{character['id']}")
        assert delete_response.status_code == 200
        print("Test character deleted")


class TestCharacterManagement:
    """Tests for character management endpoints"""
    
    def test_list_characters(self):
        """Test GET /api/characters/ returns character list"""
        response = requests.get(f"{BASE_URL}/api/characters/")
        assert response.status_code == 200
        data = response.json()
        assert "characters" in data
        print(f"Found {len(data['characters'])} characters")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
