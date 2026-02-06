"""
Test new rules features: Artes, Recompensas, Salarios, Varios, Combate, and Sombra DELETE
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestArtesEndpoint:
    """Test GET /api/data/artes - Returns 8 artes with nombre, descripcion_corta, descripcion"""
    
    def test_artes_returns_list(self):
        """Test that artes endpoint returns a list"""
        response = requests.get(f"{BASE_URL}/api/data/artes")
        assert response.status_code == 200
        data = response.json()
        assert "artes" in data
        assert isinstance(data["artes"], list)
    
    def test_artes_count(self):
        """Test that artes returns 8 artes"""
        response = requests.get(f"{BASE_URL}/api/data/artes")
        assert response.status_code == 200
        data = response.json()
        assert len(data["artes"]) == 8, f"Expected 8 artes, got {len(data['artes'])}"
    
    def test_artes_has_required_fields(self):
        """Test that each arte has nombre, descripcion_corta, descripcion"""
        response = requests.get(f"{BASE_URL}/api/data/artes")
        assert response.status_code == 200
        data = response.json()
        
        for arte in data["artes"]:
            assert "nombre" in arte, f"Arte missing 'nombre': {arte}"
            assert "descripcion_corta" in arte, f"Arte missing 'descripcion_corta': {arte}"
            assert "descripcion" in arte, f"Arte missing 'descripcion': {arte}"
            assert arte["nombre"], "Arte nombre should not be empty"
    
    def test_artes_specific_names(self):
        """Test that specific artes exist"""
        response = requests.get(f"{BASE_URL}/api/data/artes")
        assert response.status_code == 200
        data = response.json()
        
        arte_names = [a["nombre"] for a in data["artes"]]
        expected_artes = [
            "Arte de la fabricación",
            "Arte de la medicina",
            "Arte de la oratoria",
            "Arte de las runas",
            "Arte de los bosques",
            "Arte de las armas",
            "Arte de las bestias",
            "Arte de las canciones"
        ]
        
        for expected in expected_artes:
            assert expected in arte_names, f"Missing arte: {expected}"


class TestRecompensasEndpoint:
    """Test GET /api/data/recompensas - Returns mejoras, niveles_recompensa, bendiciones"""
    
    def test_recompensas_returns_data(self):
        """Test that recompensas endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        assert response.status_code == 200
        data = response.json()
        assert "mejoras" in data
        assert "niveles_recompensa" in data
        assert "bendiciones" in data
    
    def test_mejoras_count_and_fields(self):
        """Test mejoras has 6 items with efecto/restriccion"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        assert response.status_code == 200
        data = response.json()
        
        mejoras = data["mejoras"]
        assert len(mejoras) == 6, f"Expected 6 mejoras, got {len(mejoras)}"
        
        for mejora in mejoras:
            assert "tipo" in mejora
            assert "nombre" in mejora
            assert "efecto" in mejora
            assert "restriccion" in mejora
    
    def test_niveles_recompensa_count(self):
        """Test niveles_recompensa has 4 levels"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        assert response.status_code == 200
        data = response.json()
        
        niveles = data["niveles_recompensa"]
        assert len(niveles) == 4, f"Expected 4 niveles, got {len(niveles)}"
        
        for nivel in niveles:
            assert "nivel" in nivel
            assert "recompensas" in nivel
    
    def test_bendiciones_has_bonificador_table(self):
        """Test bendiciones has bonificador_competencia with tabla"""
        response = requests.get(f"{BASE_URL}/api/data/recompensas")
        assert response.status_code == 200
        data = response.json()
        
        bendiciones = data["bendiciones"]
        assert bendiciones is not None
        assert "descripcion" in bendiciones
        assert "bonificador_competencia" in bendiciones
        
        bonificador = bendiciones["bonificador_competencia"]
        assert "tabla" in bonificador
        assert len(bonificador["tabla"]) == 5, "Expected 5 dice levels in tabla"


class TestSalariosEndpoint:
    """Test GET /api/data/salarios - Returns categorias (4 worker categories), modificadores"""
    
    def test_salarios_returns_data(self):
        """Test that salarios endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/data/salarios")
        assert response.status_code == 200
        data = response.json()
        assert "categorias" in data
        assert "modificadores" in data
    
    def test_salarios_has_4_categories(self):
        """Test salarios has 4 worker categories"""
        response = requests.get(f"{BASE_URL}/api/data/salarios")
        assert response.status_code == 200
        data = response.json()
        
        categorias = data["categorias"]
        expected_categories = [
            "trabajadores_no_cualificados",
            "trabajadores_cualificados",
            "nobles_y_guerreros",
            "razas_especiales"
        ]
        
        for cat in expected_categories:
            assert cat in categorias, f"Missing category: {cat}"
            assert len(categorias[cat]) > 0, f"Category {cat} is empty"
    
    def test_salarios_worker_fields(self):
        """Test that workers have required salary fields"""
        response = requests.get(f"{BASE_URL}/api/data/salarios")
        assert response.status_code == 200
        data = response.json()
        
        # Check first worker in first category
        worker = data["categorias"]["trabajadores_no_cualificados"][0]
        assert "ocupacion" in worker
        assert "modificador" in worker
        assert "salario_bajo" in worker
        assert "salario_medio" in worker
        assert "salario_alto" in worker
        assert "diario" in worker
    
    def test_salarios_modificadores(self):
        """Test salarios has all modifier types"""
        response = requests.get(f"{BASE_URL}/api/data/salarios")
        assert response.status_code == 200
        data = response.json()
        
        modificadores = data["modificadores"]
        expected_mods = ["por_region", "por_asentamiento", "por_relacion", "por_contexto"]
        
        for mod in expected_mods:
            assert mod in modificadores, f"Missing modifier: {mod}"
            assert len(modificadores[mod]) > 0, f"Modifier {mod} is empty"


class TestVariosEndpoint:
    """Test GET /api/data/varios - Returns pruebas_habilidad, cansancio, inspiracion, ojo_de_mordor, ventaja"""
    
    def test_varios_returns_data(self):
        """Test that varios endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/data/varios")
        assert response.status_code == 200
        data = response.json()
        
        expected_keys = ["pruebas_habilidad", "cansancio", "inspiracion", "ojo_de_mordor", "ventaja"]
        for key in expected_keys:
            assert key in data, f"Missing key: {key}"
    
    def test_cansancio_has_6_levels(self):
        """Test cansancio has 6 levels"""
        response = requests.get(f"{BASE_URL}/api/data/varios")
        assert response.status_code == 200
        data = response.json()
        
        cansancio = data["cansancio"]
        assert cansancio is not None
        assert "niveles" in cansancio
        assert len(cansancio["niveles"]) == 6, f"Expected 6 cansancio levels, got {len(cansancio['niveles'])}"
        
        # Verify level 6 is death
        level_6 = next((n for n in cansancio["niveles"] if n["nivel"] == 6), None)
        assert level_6 is not None
        assert "Muerte" in level_6["consecuencia"]
    
    def test_ventaja_has_plus_minus_5(self):
        """Test ventaja shows +5/-5 rules"""
        response = requests.get(f"{BASE_URL}/api/data/varios")
        assert response.status_code == 200
        data = response.json()
        
        ventaja = data["ventaja"]
        assert ventaja is not None
        assert "reglas" in ventaja
        
        reglas = ventaja["reglas"]
        assert len(reglas) == 2
        
        # Check for +5 and -5
        efectos = [r["efecto"] for r in reglas]
        assert any("+5" in e for e in efectos), "Missing +5 in ventaja"
        assert any("-5" in e for e in efectos), "Missing -5 in ventaja"
    
    def test_pruebas_habilidad_has_dificultad(self):
        """Test pruebas_habilidad has difficulty table"""
        response = requests.get(f"{BASE_URL}/api/data/varios")
        assert response.status_code == 200
        data = response.json()
        
        pruebas = data["pruebas_habilidad"]
        assert pruebas is not None
        assert "dificultad" in pruebas
        assert len(pruebas["dificultad"]) >= 5, "Expected at least 5 difficulty levels"
    
    def test_ojo_de_mordor_exists(self):
        """Test ojo_de_mordor data exists"""
        response = requests.get(f"{BASE_URL}/api/data/varios")
        assert response.status_code == 200
        data = response.json()
        
        ojo = data["ojo_de_mordor"]
        assert ojo is not None
        assert "descripcion" in ojo
        assert "puntuacion_inicial" in ojo
        assert "durante_juego" in ojo


class TestCombateEndpoint:
    """Test GET /api/data/combate - Returns estructura, acciones, atacar, muerte_e_inconsciencia"""
    
    def test_combate_returns_data(self):
        """Test that combate endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/data/combate")
        assert response.status_code == 200
        data = response.json()
        
        expected_keys = ["estructura", "acciones", "atacar", "muerte_e_inconsciencia"]
        for key in expected_keys:
            assert key in data, f"Missing key: {key}"
    
    def test_estructura_has_4_fases(self):
        """Test estructura has 4 phases"""
        response = requests.get(f"{BASE_URL}/api/data/combate")
        assert response.status_code == 200
        data = response.json()
        
        estructura = data["estructura"]
        assert estructura is not None
        assert "fases" in estructura
        assert len(estructura["fases"]) == 4, f"Expected 4 fases, got {len(estructura['fases'])}"
    
    def test_acciones_has_10_actions(self):
        """Test acciones has 10 actions"""
        response = requests.get(f"{BASE_URL}/api/data/combate")
        assert response.status_code == 200
        data = response.json()
        
        acciones = data["acciones"]
        assert acciones is not None
        assert "lista" in acciones
        assert len(acciones["lista"]) == 10, f"Expected 10 acciones, got {len(acciones['lista'])}"
    
    def test_atacar_has_5_pasos(self):
        """Test atacar has 5 steps"""
        response = requests.get(f"{BASE_URL}/api/data/combate")
        assert response.status_code == 200
        data = response.json()
        
        atacar = data["atacar"]
        assert atacar is not None
        assert "pasos" in atacar
        assert len(atacar["pasos"]) == 5, f"Expected 5 pasos, got {len(atacar['pasos'])}"
    
    def test_atacar_has_criticos(self):
        """Test atacar has criticos (20 and 1)"""
        response = requests.get(f"{BASE_URL}/api/data/combate")
        assert response.status_code == 200
        data = response.json()
        
        atacar = data["atacar"]
        assert "criticos" in atacar
        
        tiradas = [c["tirada"] for c in atacar["criticos"]]
        assert 20 in tiradas, "Missing critical 20"
        assert 1 in tiradas, "Missing critical 1 (pifia)"
    
    def test_muerte_e_inconsciencia_exists(self):
        """Test muerte_e_inconsciencia data exists"""
        response = requests.get(f"{BASE_URL}/api/data/combate")
        assert response.status_code == 200
        data = response.json()
        
        muerte = data["muerte_e_inconsciencia"]
        assert muerte is not None
        assert "muerte" in muerte
        assert "inconsciencia" in muerte
        assert "tiradas_salvacion_muerte" in muerte


class TestSombraDeleteEndpoint:
    """Test DELETE /api/data/sombra/sendas/{senda_name} - Admin can delete shadow paths"""
    
    def test_sombra_has_sendas(self):
        """Test that sombra endpoint returns sendas_sombra"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        assert response.status_code == 200
        data = response.json()
        assert "sendas_sombra" in data
        assert len(data["sendas_sombra"]) > 0, "No sendas found"
    
    def test_delete_nonexistent_senda_returns_404(self):
        """Test deleting non-existent senda returns 404"""
        response = requests.delete(f"{BASE_URL}/api/data/sombra/sendas/NONEXISTENT_SENDA_12345")
        assert response.status_code == 404
    
    def test_create_and_delete_senda(self):
        """Test creating and then deleting a shadow path"""
        # First create a test senda
        test_senda_data = {
            "ocupacion": "TEST_Delete_Occupation",
            "senda": "TEST_DELETE_SENDA",
            "descripcion": "Test senda for deletion",
            "defectos": [
                {"nombre": "TestDefecto1", "descripcion": "Desc1", "efecto_juego": "Effect1"},
                {"nombre": "TestDefecto2", "descripcion": "Desc2", "efecto_juego": "Effect2"}
            ]
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/data/sombra/sendas",
            json=test_senda_data
        )
        assert create_response.status_code == 200, f"Failed to create test senda: {create_response.text}"
        
        # Verify it was created
        get_response = requests.get(f"{BASE_URL}/api/data/sombra")
        assert get_response.status_code == 200
        data = get_response.json()
        sendas = [s["senda"] for s in data["sendas_sombra"]]
        assert "TEST_DELETE_SENDA" in sendas, "Test senda was not created"
        
        # Now delete it
        delete_response = requests.delete(f"{BASE_URL}/api/data/sombra/sendas/TEST_DELETE_SENDA")
        assert delete_response.status_code == 200, f"Failed to delete senda: {delete_response.text}"
        
        # Verify it was deleted
        verify_response = requests.get(f"{BASE_URL}/api/data/sombra")
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        remaining_sendas = [s["senda"] for s in verify_data["sendas_sombra"]]
        assert "TEST_DELETE_SENDA" not in remaining_sendas, "Test senda was not deleted"


class TestSombraData:
    """Test sombra data structure"""
    
    def test_sombra_has_all_sections(self):
        """Test sombra has pavor, avaricia, fechorias, estados"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        assert response.status_code == 200
        data = response.json()
        
        assert "pavor" in data
        assert "avaricia" in data
        assert "fechorias" in data
        assert "estados" in data
        assert "hechiceria" in data
        assert "fortalecer_voluntad" in data
        assert "como_sucumbir" in data
    
    def test_sendas_have_defectos(self):
        """Test that sendas have defectos with required fields"""
        response = requests.get(f"{BASE_URL}/api/data/sombra")
        assert response.status_code == 200
        data = response.json()
        
        # Check at least one senda has proper structure
        if data["sendas_sombra"]:
            senda = data["sendas_sombra"][0]
            assert "senda" in senda
            assert "defecto" in senda
