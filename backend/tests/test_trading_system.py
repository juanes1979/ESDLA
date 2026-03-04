"""
Trading System Backend API Tests
Tests for: trading config, trading calculator, NPC management, LLM dialogue, relationships, and gems equipment
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTradingConfig:
    """Trading configuration endpoint tests"""
    
    def test_get_trading_config(self):
        """GET /api/trading/config - Returns full trading configuration"""
        response = requests.get(f"{BASE_URL}/api/trading/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify all expected config sections
        assert "relationship_levels" in data, "Missing relationship_levels in config"
        assert "blessing_modifiers" in data, "Missing blessing_modifiers in config"
        assert "merchant_profiles" in data, "Missing merchant_profiles in config"
        assert "historical_contexts" in data, "Missing historical_contexts in config"
        assert "trading_thresholds" in data, "Missing trading_thresholds in config"
        assert "contraoferta_factors" in data, "Missing contraoferta_factors in config"
        assert "anger_consequences" in data, "Missing anger_consequences in config"
        print(f"PASS: Trading config has all expected sections")
    
    def test_relationship_levels_structure(self):
        """Verify relationship levels have correct structure"""
        response = requests.get(f"{BASE_URL}/api/trading/config")
        data = response.json()
        
        levels = data["relationship_levels"]
        expected_levels = ["hostil", "desconocido", "neutral", "cordial", "amigo", "hermandad"]
        
        for level in expected_levels:
            assert level in levels, f"Missing relationship level: {level}"
            level_data = levels[level]
            assert "nombre" in level_data, f"Missing 'nombre' in {level}"
            assert "mod_compra" in level_data, f"Missing 'mod_compra' in {level}"
            assert "mod_venta" in level_data, f"Missing 'mod_venta' in {level}"
            assert "bono_tirada" in level_data, f"Missing 'bono_tirada' in {level}"
        
        print(f"PASS: All 6 relationship levels verified with correct structure")
    
    def test_blessing_modifiers_structure(self):
        """Verify blessing modifiers exist"""
        response = requests.get(f"{BASE_URL}/api/trading/config")
        data = response.json()
        
        blessings = data["blessing_modifiers"]
        expected_blessings = ["ninguna", "bendicion_menor", "bendicion_mayor"]
        
        for blessing in expected_blessings:
            assert blessing in blessings, f"Missing blessing: {blessing}"
            assert "modificador" in blessings[blessing], f"Missing 'modificador' in {blessing}"
        
        print(f"PASS: Blessing modifiers structure verified")
    
    def test_merchant_profiles_structure(self):
        """Verify merchant profiles have all required fields"""
        response = requests.get(f"{BASE_URL}/api/trading/config")
        data = response.json()
        
        profiles = data["merchant_profiles"]
        expected_profiles = ["normal", "codicioso", "honorable", "desesperado", "mercader_experto", "contrabandista"]
        
        for profile in expected_profiles:
            assert profile in profiles, f"Missing profile: {profile}"
            profile_data = profiles[profile]
            assert "nombre" in profile_data, f"Missing 'nombre' in {profile}"
            assert "descripcion" in profile_data, f"Missing 'descripcion' in {profile}"
            assert "umbral_enfado" in profile_data, f"Missing 'umbral_enfado' in {profile}"
        
        print(f"PASS: All 6 merchant profiles verified")
    
    def test_historical_contexts_structure(self):
        """Verify historical contexts have all modifiers"""
        response = requests.get(f"{BASE_URL}/api/trading/config")
        data = response.json()
        
        contexts = data["historical_contexts"]
        expected_contexts = ["paz_prolongada", "guerra_activa", "hambruna", "festividad"]
        
        for ctx in expected_contexts:
            assert ctx in contexts, f"Missing context: {ctx}"
            ctx_data = contexts[ctx]
            assert "mod_armas" in ctx_data or "mod_general" in ctx_data, f"Missing modifiers in {ctx}"
        
        print(f"PASS: Historical contexts structure verified")


class TestTradingCalculate:
    """Trading calculator endpoint tests"""
    
    def test_calculate_basic_trade(self):
        """POST /api/trading/calculate - Basic price calculation"""
        payload = {
            "articulo": {
                "nombre": "Espada larga",
                "precio_base": 15,
                "categoria": "armas",
                "bendicion": "ninguna"
            },
            "modificador_region": 0,
            "modificador_asentamiento": 0,
            "contexto_historico": "",
            "relacion": "neutral",
            "perfil_comerciante": "normal",
            "modo": "compra",
            "oferta": 15
        }
        
        response = requests.post(f"{BASE_URL}/api/trading/calculate", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "desglose" in data, "Missing 'desglose' in response"
        assert "precio_justo" in data["desglose"], "Missing 'precio_justo'"
        assert "resultado" in data, "Missing 'resultado'"
        assert "tirada" in data, "Missing 'tirada'"
        
        print(f"PASS: Basic trade calculation works. Fair price: {data['desglose']['precio_justo']}")
    
    def test_calculate_with_blessing(self):
        """Calculate with blessing modifier"""
        payload = {
            "articulo": {
                "nombre": "Anillo élfico",
                "precio_base": 50,
                "categoria": "lujo",
                "bendicion": "bendicion_mayor"
            },
            "modificador_region": 0,
            "modificador_asentamiento": 0,
            "relacion": "neutral",
            "perfil_comerciante": "normal",
            "modo": "compra",
            "oferta": 60
        }
        
        response = requests.post(f"{BASE_URL}/api/trading/calculate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        # Blessing mayor adds 30%
        assert data["desglose"]["precio_con_bendicion"] > payload["articulo"]["precio_base"]
        print(f"PASS: Blessing modifier applied. Base: {payload['articulo']['precio_base']}, With blessing: {data['desglose']['precio_con_bendicion']}")
    
    def test_calculate_with_region_modifier(self):
        """Calculate with region modifier"""
        payload = {
            "articulo": {
                "nombre": "Provisiones",
                "precio_base": 5,
                "categoria": "comida",
                "bendicion": "ninguna"
            },
            "modificador_region": 20,  # +20% region modifier
            "modificador_asentamiento": 0,
            "relacion": "neutral",
            "perfil_comerciante": "normal",
            "modo": "compra",
            "oferta": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/trading/calculate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["desglose"]["factor_region"] == 1.2, "Region modifier should be 1.2"
        print(f"PASS: Region modifier applied correctly")
    
    def test_calculate_resultado_types(self):
        """Verify resultado can be acepta, rechaza, contraoferta, or enfado"""
        payload = {
            "articulo": {
                "nombre": "Arco largo",
                "precio_base": 50,
                "categoria": "armas",
                "bendicion": "ninguna"
            },
            "modificador_region": 0,
            "modificador_asentamiento": 0,
            "relacion": "neutral",
            "perfil_comerciante": "normal",
            "modo": "compra",
            "oferta": 50  # Fair offer - should mostly accept
        }
        
        response = requests.post(f"{BASE_URL}/api/trading/calculate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        valid_types = ["acepta", "rechaza", "contraoferta", "enfado"]
        assert data["resultado"]["tipo"] in valid_types, f"Invalid resultado type: {data['resultado']['tipo']}"
        print(f"PASS: Resultado type is valid: {data['resultado']['tipo']}")
    
    def test_calculate_tirada_dice_roll(self):
        """Verify tirada (dice roll) structure"""
        payload = {
            "articulo": {
                "nombre": "Escudo",
                "precio_base": 10,
                "categoria": "armaduras",
                "bendicion": "ninguna"
            },
            "modificador_region": 0,
            "modificador_asentamiento": 0,
            "relacion": "cordial",  # Should add bonus
            "perfil_comerciante": "normal",
            "modo": "compra",
            "oferta": 10
        }
        
        response = requests.post(f"{BASE_URL}/api/trading/calculate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        tirada = data["tirada"]
        assert "base" in tirada, "Missing 'base' in tirada"
        assert "bono_relacion" in tirada, "Missing 'bono_relacion' in tirada"
        assert "total" in tirada, "Missing 'total' in tirada"
        assert 1 <= tirada["base"] <= 100, "Base roll should be between 1-100"
        
        print(f"PASS: Tirada structure verified. Roll: {tirada['base']}, Bonus: {tirada['bono_relacion']}, Total: {tirada['total']}")


class TestTradingCalculateWithDialogue:
    """Trading calculator with LLM dialogue generation tests"""
    
    def test_calculate_with_dialogue_returns_dialogue(self):
        """POST /api/trading/calculate-with-dialogue - Returns dialogue"""
        payload = {
            "articulo": {
                "nombre": "Daga",
                "precio_base": 2,
                "categoria": "armas",
                "bendicion": "ninguna"
            },
            "modificador_region": 0,
            "modificador_asentamiento": 0,
            "relacion": "neutral",
            "perfil_comerciante": "normal",
            "modo": "compra",
            "oferta": 2
        }
        
        response = requests.post(f"{BASE_URL}/api/trading/calculate-with-dialogue", json=payload, timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "dialogo" in data, "Missing 'dialogo' in response"
        assert "dialogo_fuente" in data, "Missing 'dialogo_fuente' in response"
        assert data["dialogo_fuente"] in ["llm", "fallback"], f"Invalid dialogue source: {data['dialogo_fuente']}"
        assert len(data["dialogo"]) > 0, "Dialogue should not be empty"
        
        print(f"PASS: Dialogue generated. Source: {data['dialogo_fuente']}")
        print(f"Dialogue: {data['dialogo'][:100]}...")
    
    def test_calculate_with_dialogue_has_all_calc_fields(self):
        """Dialogue endpoint should also have all calculator fields"""
        payload = {
            "articulo": {
                "nombre": "Cota de malla",
                "precio_base": 75,
                "categoria": "armaduras",
                "bendicion": "ninguna"
            },
            "modo": "compra",
            "oferta": 70
        }
        
        response = requests.post(f"{BASE_URL}/api/trading/calculate-with-dialogue", json=payload, timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        assert "desglose" in data
        assert "resultado" in data
        assert "tirada" in data
        assert "dialogo" in data
        
        print(f"PASS: Dialogue endpoint includes all calculation fields plus dialogue")


class TestTradingNpcs:
    """Trading NPC management tests"""
    
    def test_generate_random_npc(self):
        """POST /api/trading/npcs/generate - Generate random NPC"""
        payload = {
            "nombre": "TEST_Mercader_Generado",
            "ubicacion": "Bree",
            "region": "Eriador",
            "guardar": False  # Don't save to DB
        }
        
        response = requests.post(f"{BASE_URL}/api/trading/npcs/generate", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "npc" in data, "Missing 'npc' in response"
        npc = data["npc"]
        
        # Verify NPC structure
        assert "nombre" in npc, "NPC missing 'nombre'"
        assert "ocupacion" in npc, "NPC missing 'ocupacion'"
        assert "profesion_comerciante" in npc, "NPC missing 'profesion_comerciante'"
        assert "perfil_comerciante" in npc, "NPC missing 'perfil_comerciante'"
        assert "apariencia" in npc, "NPC missing 'apariencia'"
        
        print(f"PASS: NPC generated: {npc['nombre']}, {npc['profesion_comerciante']}, Profile: {npc['perfil_comerciante']}")
    
    def test_generate_and_save_npc(self):
        """Generate NPC and save to database"""
        payload = {
            "nombre": "TEST_Comerciante_Guardado",
            "ubicacion": "Edoras",
            "region": "Rohan",
            "guardar": True
        }
        
        response = requests.post(f"{BASE_URL}/api/trading/npcs/generate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        npc = data["npc"]
        npc_id = npc.get("_id")
        assert npc_id is not None, "Saved NPC should have _id"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/trading/npcs/{npc_id}")
        print(f"PASS: NPC generated and saved. ID: {npc_id}")
    
    def test_list_npcs(self):
        """GET /api/trading/npcs - List all NPCs"""
        response = requests.get(f"{BASE_URL}/api/trading/npcs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "npcs" in data, "Missing 'npcs' in response"
        assert "total" in data, "Missing 'total' in response"
        assert isinstance(data["npcs"], list), "NPCs should be a list"
        
        print(f"PASS: NPCs listed. Total: {data['total']}")
    
    def test_create_npc(self):
        """POST /api/trading/npcs - Create new NPC"""
        npc_data = {
            "nombre": "TEST_Barliman",
            "apodo": "Mantecona",
            "ocupacion": "Posadero",
            "profesion_comerciante": "Posadero",
            "perfil_comerciante": "honorable",
            "ubicacion": "Bree",
            "region": "Eriador",
            "apariencia": "Hombre robusto y bonachón",
            "personalidad": "Amable pero olvidadizo"
        }
        
        response = requests.post(f"{BASE_URL}/api/trading/npcs", json=npc_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "npc_id" in data, "Missing 'npc_id' in response"
        npc_id = data["npc_id"]
        
        # Cleanup
        del_response = requests.delete(f"{BASE_URL}/api/trading/npcs/{npc_id}")
        assert del_response.status_code == 200, "Cleanup delete failed"
        
        print(f"PASS: NPC created with ID: {npc_id}")
    
    def test_update_npc(self):
        """PUT /api/trading/npcs/{id} - Update NPC"""
        # First create
        create_response = requests.post(f"{BASE_URL}/api/trading/npcs", json={
            "nombre": "TEST_NPC_Update",
            "perfil_comerciante": "normal"
        })
        npc_id = create_response.json()["npc_id"]
        
        # Update
        update_data = {
            "nombre": "TEST_NPC_Updated",
            "perfil_comerciante": "codicioso"
        }
        update_response = requests.put(f"{BASE_URL}/api/trading/npcs/{npc_id}", json=update_data)
        assert update_response.status_code == 200, f"Update failed: {update_response.status_code}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/trading/npcs/{npc_id}")
        print(f"PASS: NPC updated successfully")
    
    def test_delete_npc(self):
        """DELETE /api/trading/npcs/{id} - Delete NPC"""
        # Create then delete
        create_response = requests.post(f"{BASE_URL}/api/trading/npcs", json={
            "nombre": "TEST_NPC_Delete",
            "perfil_comerciante": "normal"
        })
        npc_id = create_response.json()["npc_id"]
        
        delete_response = requests.delete(f"{BASE_URL}/api/trading/npcs/{npc_id}")
        assert delete_response.status_code == 200
        
        # Verify deleted
        get_response = requests.get(f"{BASE_URL}/api/trading/npcs")
        npcs = get_response.json()["npcs"]
        assert not any(n["_id"] == npc_id for n in npcs), "NPC should be deleted"
        
        print(f"PASS: NPC deleted successfully")


class TestTradingRelationships:
    """Trading relationships endpoint tests"""
    
    def test_get_relationships(self):
        """GET /api/trading/relationships - List relationships"""
        response = requests.get(f"{BASE_URL}/api/trading/relationships")
        assert response.status_code == 200
        
        data = response.json()
        assert "relationships" in data
        assert "total" in data
        
        print(f"PASS: Relationships listed. Total: {data['total']}")
    
    def test_create_relationship(self):
        """POST /api/trading/relationships - Create new relationship"""
        # First create an NPC
        npc_response = requests.post(f"{BASE_URL}/api/trading/npcs", json={
            "nombre": "TEST_NPC_Relationship"
        })
        npc_id = npc_response.json()["npc_id"]
        
        # Create relationship
        rel_data = {
            "character_id": "test_character_001",
            "npc_id": npc_id,
            "nivel": "cordial"
        }
        response = requests.post(f"{BASE_URL}/api/trading/relationships", json=rel_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "relationship_id" in data
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/trading/npcs/{npc_id}")
        print(f"PASS: Relationship created with ID: {data['relationship_id']}")


class TestEquipmentGems:
    """Test gem categories in equipment catalog"""
    
    def test_equipment_catalog_has_gems(self):
        """GET /api/data/equipment-catalog - Should include gem categories"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "gemas_preciosas" in data, "Missing 'gemas_preciosas' in equipment catalog"
        assert "gemas_semipreciosas" in data, "Missing 'gemas_semipreciosas' in equipment catalog"
        
        print(f"PASS: Gem categories present in equipment catalog")
    
    def test_gemas_preciosas_count(self):
        """Verify precious gems count (should be ~102)"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        gemas_preciosas = data.get("gemas_preciosas", [])
        assert len(gemas_preciosas) > 50, f"Expected >50 precious gems, got {len(gemas_preciosas)}"
        
        print(f"PASS: {len(gemas_preciosas)} precious gems in catalog")
    
    def test_gemas_semipreciosas_count(self):
        """Verify semi-precious gems count (should be ~130)"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        gemas_semipreciosas = data.get("gemas_semipreciosas", [])
        assert len(gemas_semipreciosas) > 100, f"Expected >100 semi-precious gems, got {len(gemas_semipreciosas)}"
        
        print(f"PASS: {len(gemas_semipreciosas)} semi-precious gems in catalog")
    
    def test_gem_structure(self):
        """Verify gems have correct structure"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        # Check first precious gem
        gemas_preciosas = data.get("gemas_preciosas", [])
        if len(gemas_preciosas) > 0:
            gem = gemas_preciosas[0]
            assert "nombre" in gem, "Gem missing 'nombre'"
            assert "precio" in gem, "Gem missing 'precio'"
            assert "moneda" in gem, "Gem missing 'moneda'"
            
            print(f"PASS: Gem structure verified. Sample: {gem['nombre']} ({gem['precio']} {gem['moneda']})")
    
    def test_specific_precious_gem_exists(self):
        """Verify specific precious gems exist (Rubí, Esmeralda, Diamante)"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        gemas_preciosas = data.get("gemas_preciosas", [])
        gem_names = [g["nombre"] for g in gemas_preciosas]
        
        expected_gems = ["Rubí", "Esmeralda", "Zafiro, azul"]
        for expected in expected_gems:
            assert expected in gem_names, f"Missing precious gem: {expected}"
        
        print(f"PASS: Key precious gems verified: {expected_gems}")
    
    def test_specific_semiprecious_gem_exists(self):
        """Verify specific semi-precious gems exist"""
        response = requests.get(f"{BASE_URL}/api/data/equipment-catalog")
        data = response.json()
        
        gemas_semipreciosas = data.get("gemas_semipreciosas", [])
        gem_names = [g["nombre"] for g in gemas_semipreciosas]
        
        expected_gems = ["Turquesa", "Lapislázuli", "Malaquita"]
        for expected in expected_gems:
            assert expected in gem_names, f"Missing semi-precious gem: {expected}"
        
        print(f"PASS: Key semi-precious gems verified: {expected_gems}")


class TestTradingNpcTemplates:
    """Test NPC generation templates"""
    
    def test_get_npc_templates(self):
        """GET /api/trading/npc-templates - Get NPC templates"""
        response = requests.get(f"{BASE_URL}/api/trading/npc-templates")
        assert response.status_code == 200
        
        data = response.json()
        assert "ocupaciones" in data or len(data) > 0, "Templates should have content"
        
        print(f"PASS: NPC templates retrieved")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
