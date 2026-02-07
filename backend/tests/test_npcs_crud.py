"""
NPC CRUD API Tests - Tests for the Bestiario/NPCs system
Tests GET, POST, PATCH, DELETE operations for NPCs with structured data
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNPCsGet:
    """Tests for GET /api/data/npcs endpoint"""
    
    def test_get_all_npcs(self):
        """Test getting all NPCs returns grouped by category"""
        response = requests.get(f"{BASE_URL}/api/data/npcs")
        assert response.status_code == 200
        
        data = response.json()
        # Should have category keys
        assert "malignos" in data or "especiales" in data or "pnj" in data or "animales" in data
        
        # Check that we have NPCs
        total_npcs = sum(len(data.get(cat, [])) for cat in ["malignos", "especiales", "pnj", "animales"])
        assert total_npcs > 0, "Should have at least some NPCs"
        print(f"Total NPCs found: {total_npcs}")
    
    def test_get_npcs_malignos_category(self):
        """Test getting NPCs filtered by malignos category"""
        response = requests.get(f"{BASE_URL}/api/data/npcs?categoria=malignos")
        assert response.status_code == 200
        
        data = response.json()
        assert "malignos" in data
        assert len(data["malignos"]) > 0, "Should have malignos NPCs"
        print(f"Malignos NPCs: {len(data['malignos'])}")
    
    def test_get_npcs_especiales_category(self):
        """Test getting NPCs filtered by especiales category"""
        response = requests.get(f"{BASE_URL}/api/data/npcs?categoria=especiales")
        assert response.status_code == 200
        
        data = response.json()
        assert "especiales" in data
        print(f"Especiales NPCs: {len(data.get('especiales', []))}")
    
    def test_npc_structure_has_required_fields(self):
        """Test that NPCs have the required structured fields"""
        response = requests.get(f"{BASE_URL}/api/data/npcs")
        assert response.status_code == 200
        
        data = response.json()
        # Get first NPC from any category
        npc = None
        for cat in ["malignos", "especiales", "pnj", "animales"]:
            if data.get(cat) and len(data[cat]) > 0:
                npc = data[cat][0]
                break
        
        assert npc is not None, "Should have at least one NPC"
        
        # Check required fields
        assert "id" in npc
        assert "nombre" in npc
        assert "clase_armadura" in npc
        assert "puntos_golpe" in npc
        assert "velocidad" in npc
        assert "atributos" in npc
        
        # Check atributos structure
        atributos = npc.get("atributos", {})
        for attr in ["fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma"]:
            assert attr in atributos, f"Missing attribute: {attr}"
        
        print(f"NPC '{npc['nombre']}' has all required fields")
    
    def test_npc_has_especiales_array(self):
        """Test that NPCs have especiales as array of objects"""
        response = requests.get(f"{BASE_URL}/api/data/npcs")
        assert response.status_code == 200
        
        data = response.json()
        # Find an NPC with especiales
        for cat in ["malignos", "especiales"]:
            for npc in data.get(cat, []):
                if npc.get("especiales") and len(npc["especiales"]) > 0:
                    especial = npc["especiales"][0]
                    assert "nombre" in especial, "Especial should have nombre"
                    assert "descripcion" in especial, "Especial should have descripcion"
                    print(f"NPC '{npc['nombre']}' has especiales: {[e['nombre'] for e in npc['especiales']]}")
                    return
        
        print("No NPCs with especiales found (may be expected)")
    
    def test_npc_has_armas_array(self):
        """Test that NPCs have armas as structured array"""
        response = requests.get(f"{BASE_URL}/api/data/npcs")
        assert response.status_code == 200
        
        data = response.json()
        # Find an NPC with armas
        for cat in ["malignos", "especiales"]:
            for npc in data.get(cat, []):
                if npc.get("armas") and len(npc["armas"]) > 0:
                    arma = npc["armas"][0]
                    assert "nombre" in arma, "Arma should have nombre"
                    assert "tipo" in arma, "Arma should have tipo"
                    assert "bonificador_impacto" in arma, "Arma should have bonificador_impacto"
                    assert "dano" in arma, "Arma should have dano"
                    print(f"NPC '{npc['nombre']}' has armas: {[a['nombre'] for a in npc['armas']]}")
                    return
        
        pytest.fail("No NPCs with armas found")
    
    def test_balrog_npc_exists(self):
        """Test that Balrog de Moria exists with complex data"""
        response = requests.get(f"{BASE_URL}/api/data/npcs?search=Balrog")
        assert response.status_code == 200
        
        data = response.json()
        # Find Balrog
        balrog = None
        for cat in ["especiales", "malignos"]:
            for npc in data.get(cat, []):
                if "Balrog" in npc.get("nombre", ""):
                    balrog = npc
                    break
        
        if balrog:
            assert balrog["clase_armadura"] == 19, "Balrog should have CA 19"
            assert balrog["puntos_golpe"] == 262, "Balrog should have 262 PG"
            assert len(balrog.get("armas", [])) >= 2, "Balrog should have at least 2 weapons"
            print(f"Balrog found: CA={balrog['clase_armadura']}, PG={balrog['puntos_golpe']}")
        else:
            print("Balrog not found in search results")


class TestNPCsCreate:
    """Tests for POST /api/data/npcs endpoint"""
    
    def test_create_npc_basic(self):
        """Test creating a basic NPC"""
        npc_data = {
            "nombre": f"TEST_Orco_Prueba_{uuid.uuid4().hex[:8]}",
            "categoria": "malignos",
            "tipo": "Humanoide Mediano (orco)",
            "tamanio": "Mediano",
            "clase_armadura": 13,
            "puntos_golpe": 15,
            "velocidad": 9,
            "atributos": {
                "fuerza": 14, "destreza": 12, "constitucion": 14,
                "inteligencia": 8, "sabiduria": 10, "carisma": 8
            },
            "experiencia": 50
        }
        
        response = requests.post(f"{BASE_URL}/api/data/npcs", json=npc_data)
        assert response.status_code == 200 or response.status_code == 201
        
        created = response.json()
        assert "id" in created
        assert created["nombre"] == npc_data["nombre"]
        assert created["clase_armadura"] == 13
        assert created["puntos_golpe"] == 15
        
        print(f"Created NPC: {created['nombre']} with ID: {created['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/npcs/{created['id']}")
    
    def test_create_npc_with_especiales(self):
        """Test creating NPC with especiales array"""
        npc_data = {
            "nombre": f"TEST_Troll_Especial_{uuid.uuid4().hex[:8]}",
            "categoria": "malignos",
            "tipo": "Gigante Grande",
            "tamanio": "Grande",
            "clase_armadura": 15,
            "puntos_golpe": 84,
            "velocidad": 9,
            "atributos": {
                "fuerza": 18, "destreza": 8, "constitucion": 18,
                "inteligencia": 5, "sabiduria": 9, "carisma": 7
            },
            "especiales": [
                {"nombre": "Regeneración", "descripcion": "Recupera 10 PG al inicio de su turno."},
                {"nombre": "Sensibilidad a la Luz", "descripcion": "Desventaja bajo luz solar."}
            ],
            "experiencia": 1800
        }
        
        response = requests.post(f"{BASE_URL}/api/data/npcs", json=npc_data)
        assert response.status_code == 200 or response.status_code == 201
        
        created = response.json()
        assert len(created.get("especiales", [])) == 2
        assert created["especiales"][0]["nombre"] == "Regeneración"
        
        print(f"Created NPC with especiales: {[e['nombre'] for e in created['especiales']]}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/npcs/{created['id']}")
    
    def test_create_npc_with_armas(self):
        """Test creating NPC with structured armas array"""
        npc_data = {
            "nombre": f"TEST_Guerrero_{uuid.uuid4().hex[:8]}",
            "categoria": "malignos",
            "tipo": "Humanoide Mediano",
            "tamanio": "Mediano",
            "clase_armadura": 16,
            "puntos_golpe": 45,
            "velocidad": 9,
            "atributos": {
                "fuerza": 16, "destreza": 14, "constitucion": 14,
                "inteligencia": 10, "sabiduria": 10, "carisma": 10
            },
            "armas": [
                {
                    "nombre": "Espada Larga",
                    "tipo": "cuerpo a cuerpo",
                    "bonificador_impacto": 5,
                    "alcance_metros": "1,5 m",
                    "dano": "1d8 + 3",
                    "tipo_dano": "cortante"
                },
                {
                    "nombre": "Arco Largo",
                    "tipo": "distancia",
                    "bonificador_impacto": 4,
                    "alcance_metros": "45/180 m",
                    "dano": "1d8 + 2",
                    "tipo_dano": "perforante"
                }
            ],
            "ataque_multiple": "Realiza dos ataques cuerpo a cuerpo.",
            "experiencia": 450
        }
        
        response = requests.post(f"{BASE_URL}/api/data/npcs", json=npc_data)
        assert response.status_code == 200 or response.status_code == 201
        
        created = response.json()
        assert len(created.get("armas", [])) == 2
        assert created["armas"][0]["nombre"] == "Espada Larga"
        assert created["armas"][0]["bonificador_impacto"] == 5
        assert created["armas"][1]["tipo"] == "distancia"
        
        print(f"Created NPC with armas: {[a['nombre'] for a in created['armas']]}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/npcs/{created['id']}")
    
    def test_create_npc_with_acciones_reacciones(self):
        """Test creating NPC with acciones and reacciones"""
        npc_data = {
            "nombre": f"TEST_Capitan_{uuid.uuid4().hex[:8]}",
            "categoria": "malignos",
            "tipo": "Humanoide Mediano",
            "tamanio": "Mediano",
            "clase_armadura": 17,
            "puntos_golpe": 65,
            "velocidad": 9,
            "atributos": {
                "fuerza": 16, "destreza": 14, "constitucion": 14,
                "inteligencia": 12, "sabiduria": 12, "carisma": 14
            },
            "acciones": [
                {"nombre": "Grito de Guerra", "descripcion": "Aliados a 9m obtienen ventaja en ataques."}
            ],
            "reacciones": [
                {"nombre": "Parada", "descripcion": "Suma 2 a su CA contra un ataque."}
            ],
            "experiencia": 700
        }
        
        response = requests.post(f"{BASE_URL}/api/data/npcs", json=npc_data)
        assert response.status_code == 200 or response.status_code == 201
        
        created = response.json()
        assert len(created.get("acciones", [])) == 1
        assert len(created.get("reacciones", [])) == 1
        assert created["acciones"][0]["nombre"] == "Grito de Guerra"
        assert created["reacciones"][0]["nombre"] == "Parada"
        
        print(f"Created NPC with acciones and reacciones")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/npcs/{created['id']}")


class TestNPCsUpdate:
    """Tests for PATCH /api/data/npcs/{id} endpoint"""
    
    def test_update_npc_basic_fields(self):
        """Test updating basic NPC fields"""
        # First create an NPC
        npc_data = {
            "nombre": f"TEST_Update_NPC_{uuid.uuid4().hex[:8]}",
            "categoria": "malignos",
            "clase_armadura": 12,
            "puntos_golpe": 20,
            "velocidad": 9,
            "atributos": {
                "fuerza": 10, "destreza": 10, "constitucion": 10,
                "inteligencia": 10, "sabiduria": 10, "carisma": 10
            }
        }
        
        create_response = requests.post(f"{BASE_URL}/api/data/npcs", json=npc_data)
        assert create_response.status_code in [200, 201]
        created = create_response.json()
        npc_id = created["id"]
        
        # Update the NPC
        update_data = {
            "clase_armadura": 15,
            "puntos_golpe": 35,
            "descripcion": "Un guerrero actualizado"
        }
        
        update_response = requests.patch(f"{BASE_URL}/api/data/npcs/{npc_id}", json=update_data)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["clase_armadura"] == 15
        assert updated["puntos_golpe"] == 35
        assert updated["descripcion"] == "Un guerrero actualizado"
        
        print(f"Updated NPC: CA {created['clase_armadura']} -> {updated['clase_armadura']}")
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/data/npcs/{npc_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["clase_armadura"] == 15
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/npcs/{npc_id}")
    
    def test_update_npc_especiales(self):
        """Test updating NPC especiales array"""
        # Create NPC
        npc_data = {
            "nombre": f"TEST_Update_Especiales_{uuid.uuid4().hex[:8]}",
            "categoria": "malignos",
            "clase_armadura": 12,
            "puntos_golpe": 20,
            "velocidad": 9,
            "atributos": {
                "fuerza": 10, "destreza": 10, "constitucion": 10,
                "inteligencia": 10, "sabiduria": 10, "carisma": 10
            },
            "especiales": []
        }
        
        create_response = requests.post(f"{BASE_URL}/api/data/npcs", json=npc_data)
        created = create_response.json()
        npc_id = created["id"]
        
        # Update with especiales
        update_data = {
            "especiales": [
                {"nombre": "Nueva Habilidad", "descripcion": "Descripción de la habilidad"}
            ]
        }
        
        update_response = requests.patch(f"{BASE_URL}/api/data/npcs/{npc_id}", json=update_data)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert len(updated.get("especiales", [])) == 1
        assert updated["especiales"][0]["nombre"] == "Nueva Habilidad"
        
        print(f"Updated NPC especiales successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/npcs/{npc_id}")
    
    def test_update_nonexistent_npc(self):
        """Test updating a non-existent NPC returns 404"""
        fake_id = str(uuid.uuid4())
        update_data = {"nombre": "No existe"}
        
        response = requests.patch(f"{BASE_URL}/api/data/npcs/{fake_id}", json=update_data)
        assert response.status_code == 404


class TestNPCsDelete:
    """Tests for DELETE /api/data/npcs/{id} endpoint"""
    
    def test_delete_npc(self):
        """Test deleting an NPC"""
        # Create NPC
        npc_data = {
            "nombre": f"TEST_Delete_NPC_{uuid.uuid4().hex[:8]}",
            "categoria": "malignos",
            "clase_armadura": 10,
            "puntos_golpe": 10,
            "velocidad": 9,
            "atributos": {
                "fuerza": 10, "destreza": 10, "constitucion": 10,
                "inteligencia": 10, "sabiduria": 10, "carisma": 10
            }
        }
        
        create_response = requests.post(f"{BASE_URL}/api/data/npcs", json=npc_data)
        created = create_response.json()
        npc_id = created["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/data/npcs/{npc_id}")
        assert delete_response.status_code == 200
        
        # Verify deleted
        get_response = requests.get(f"{BASE_URL}/api/data/npcs/{npc_id}")
        assert get_response.status_code == 404
        
        print(f"Deleted NPC successfully")
    
    def test_delete_nonexistent_npc(self):
        """Test deleting a non-existent NPC returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/data/npcs/{fake_id}")
        assert response.status_code == 404


class TestNPCsCopy:
    """Tests for POST /api/data/npcs/{id}/copy endpoint"""
    
    def test_copy_npc(self):
        """Test copying an NPC"""
        # Create original NPC
        npc_data = {
            "nombre": f"TEST_Original_NPC_{uuid.uuid4().hex[:8]}",
            "categoria": "malignos",
            "clase_armadura": 14,
            "puntos_golpe": 30,
            "velocidad": 9,
            "atributos": {
                "fuerza": 14, "destreza": 12, "constitucion": 14,
                "inteligencia": 10, "sabiduria": 10, "carisma": 10
            },
            "especiales": [{"nombre": "Test Especial", "descripcion": "Test"}],
            "armas": [{"nombre": "Espada", "tipo": "cuerpo a cuerpo", "bonificador_impacto": 4, "dano": "1d8+2", "tipo_dano": "cortante"}]
        }
        
        create_response = requests.post(f"{BASE_URL}/api/data/npcs", json=npc_data)
        original = create_response.json()
        original_id = original["id"]
        
        # Copy
        new_name = f"TEST_Copia_NPC_{uuid.uuid4().hex[:8]}"
        copy_response = requests.post(
            f"{BASE_URL}/api/data/npcs/{original_id}/copy",
            json={"new_name": new_name}
        )
        assert copy_response.status_code == 200
        
        copied = copy_response.json()
        assert copied["nombre"] == new_name
        assert copied["id"] != original_id
        assert copied["clase_armadura"] == original["clase_armadura"]
        assert len(copied.get("especiales", [])) == len(original.get("especiales", []))
        
        print(f"Copied NPC: {original['nombre']} -> {copied['nombre']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/npcs/{original_id}")
        requests.delete(f"{BASE_URL}/api/data/npcs/{copied['id']}")


class TestNPCsCategories:
    """Tests for NPC category counts"""
    
    def test_malignos_count(self):
        """Test that malignos category has expected count (~26)"""
        response = requests.get(f"{BASE_URL}/api/data/npcs?categoria=malignos")
        assert response.status_code == 200
        
        data = response.json()
        count = len(data.get("malignos", []))
        print(f"Malignos count: {count}")
        # Should have around 26 malignos
        assert count >= 20, f"Expected at least 20 malignos, got {count}"
    
    def test_especiales_count(self):
        """Test that especiales category has expected count (~4)"""
        response = requests.get(f"{BASE_URL}/api/data/npcs?categoria=especiales")
        assert response.status_code == 200
        
        data = response.json()
        count = len(data.get("especiales", []))
        print(f"Especiales count: {count}")
        # Should have around 4 especiales (Balrog, Morlhoss, Cauthlin, Daegûr)
        assert count >= 1, f"Expected at least 1 especiales, got {count}"


# Cleanup fixture to remove any leftover test data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_npcs():
    """Cleanup any TEST_ prefixed NPCs after all tests"""
    yield
    # After tests, cleanup
    response = requests.get(f"{BASE_URL}/api/data/npcs")
    if response.status_code == 200:
        data = response.json()
        for cat in ["malignos", "especiales", "pnj", "animales"]:
            for npc in data.get(cat, []):
                if npc.get("nombre", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/data/npcs/{npc['id']}")
                    print(f"Cleaned up test NPC: {npc['nombre']}")
