"""
Complete Data Extractor for LOTR 5e RPG
Extracts ALL data from utumno.xlsm following the detailed plan
"""
import openpyxl
import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

def clean_value(value) -> Optional[str]:
    """Clean cell value"""
    if value is None:
        return None
    val = str(value).strip()
    return val if val else None

def get_non_empty_cells(sheet, start_row: int, end_row: int, col: int) -> List[str]:
    """Get non-empty cell values from a column range"""
    values = []
    for row in range(start_row, end_row + 1):
        val = clean_value(sheet.cell(row=row, column=col).value)
        if val:
            values.append(val)
    return values

def get_cells_with_x(sheet, start_row: int, end_row: int, col: int) -> List[int]:
    """Get row numbers where there's an X in the column"""
    rows = []
    for row in range(start_row, end_row + 1):
        val = clean_value(sheet.cell(row=row, column=col).value)
        if val and val.upper() == 'X':
            rows.append(row)
    return rows

# ===========================================
# CULTURE COLUMN MAPPING
# ===========================================
CULTURE_COLUMNS = {
    2: "Elfos de Lindon",
    3: "Elfos Noldor", 
    4: "Elfos Silvanos",
    5: "Elfos Oscuros",
    6: "Elfos del Bosque negro",
    7: "Enanos de Erebor",
    8: "Enanos de las montañas azules",
    9: "Enanos de las colinas de hierro",
    10: "Enanos errantes",
    11: "Hobbits Albos",
    12: "Hobbits Fuertes",
    13: "Hobbits Pelosos",
    14: "Hombres del lago",
    15: "Hombres de Bree",
    16: "Dunedain",
    17: "Beornidas",
    18: "Hombres de los bosques",
    19: "Gondorianos",
    20: "Rohirrim",
}

# Race groupings
RACE_GROUPS = {
    "Elfos": [2, 3, 4, 5, 6],
    "Enanos": [7, 8, 9, 10],
    "Hobbits": [11, 12, 13],
    "Hombres": [14, 15, 16, 17, 18, 19, 20],
}

# IMC by race for weight calculation
IMC_BY_RACE = {
    "Elfos": {"min": 18, "max": 20},
    "Enanos": {"min": 25, "max": 28},
    "Hobbits": {"min": 22, "max": 25},
    "Hombres": {"min": 20, "max": 24},
}

# Cultures that get virtue at level 1
CULTURES_WITH_VIRTUE = [14, 15, 17]  # Hombres del lago, Hombres de Bree, Beornidas

# Occupation columns
OCCUPATION_COLUMNS = {
    2: "Buscador de tesoros",
    3: "Campeón",
    4: "Capitán",
    5: "Erudito",
    6: "Guardian",
    7: "Mensajero",
}


def extract_cultures_complete(wb: openpyxl.Workbook) -> List[Dict]:
    """Extract complete culture data from Culturas and Características sheets"""
    culturas_sheet = wb['Culturas']
    caract_sheet = wb['Características']
    
    cultures = []
    
    for col, nombre in CULTURE_COLUMNS.items():
        # Determine race
        raza = None
        for race, cols in RACE_GROUPS.items():
            if col in cols:
                raza = race
                break
        
        # Row in Culturas sheet (row 2 = first culture)
        row_culturas = col  # Col 2 in Características = Row 2 in Culturas
        
        culture = {
            "nombre": nombre,
            "columna_excel": col,
            "raza": raza,
            "imc": IMC_BY_RACE.get(raza, {"min": 20, "max": 24}),
            
            # From Culturas sheet (row = culture index)
            "descripcion": clean_value(culturas_sheet.cell(row=row_culturas, column=2).value),
            "edad_min": 18,
            "edad_max": 80,
            "altura_min": 150,
            "altura_max": 190,
            "mod_peso": 0,
            "velocidad": 9,
            "descanso": 8,
            "tamanio": "Mediano",
            "nivel_vida": "Común",
            "descripcion_nivel_vida": None,
            
            # Characteristics bonuses (rows 3-8)
            "bonificadores_caracteristicas": {
                "fuerza": int(caract_sheet.cell(row=3, column=col).value or 0),
                "destreza": int(caract_sheet.cell(row=4, column=col).value or 0),
                "constitucion": int(caract_sheet.cell(row=5, column=col).value or 0),
                "inteligencia": int(caract_sheet.cell(row=6, column=col).value or 0),
                "sabiduria": int(caract_sheet.cell(row=7, column=col).value or 0),
                "carisma": int(caract_sheet.cell(row=8, column=col).value or 0),
            },
            
            # Noldor improvement (row 10)
            "mejora_noldor": clean_value(caract_sheet.cell(row=10, column=col).value) == 'X',
            
            # Physical traits (rows 55-81)
            "rasgos_fisicos": {
                "ojos": get_non_empty_cells(caract_sheet, 55, 63, col),
                "piel": get_non_empty_cells(caract_sheet, 64, 72, col),
                "pelo": get_non_empty_cells(caract_sheet, 73, 81, col),
            },
            
            # Cultural traits (rows 83-89)
            "rasgos_culturales": get_non_empty_cells(caract_sheet, 83, 89, col),
            
            # Special traits
            "pg_extra_nivel": clean_value(caract_sheet.cell(row=92, column=col).value),
            "capacidad_carga_x2": clean_value(caract_sheet.cell(row=93, column=col).value),
            "tiene_virtud_inicial": col in CULTURES_WITH_VIRTUE,
            
            # Languages (rows 97-100)
            "idiomas": get_non_empty_cells(caract_sheet, 97, 100, col),
            
            # Skills to choose (rows 102-104)
            "competencia_habilidad_elegir": get_non_empty_cells(caract_sheet, 102, 104, col),
            
            # Tool competencies to choose (rows 106-108, 110-112)
            "competencia_herramienta_elegir_1": get_non_empty_cells(caract_sheet, 106, 108, col),
            "competencia_herramienta_elegir_2": get_non_empty_cells(caract_sheet, 110, 112, col),
            
            # Additional competency (row 114)
            "competencia_adicional": clean_value(caract_sheet.cell(row=114, column=col).value),
            
            # Skill scores (rows 13-52)
            "habilidades_puntuaciones": {},
            "competencias_habilidades": [],
        }
        
        # Read from Culturas sheet properly
        try:
            culture["edad_min"] = int(culturas_sheet.cell(row=row_culturas, column=3).value or 18)
        except:
            culture["edad_min"] = 18
        try:
            culture["edad_max"] = int(culturas_sheet.cell(row=row_culturas, column=4).value or 80)
        except:
            culture["edad_max"] = 80
        try:
            culture["altura_min"] = int(culturas_sheet.cell(row=row_culturas, column=5).value or 150)
        except:
            culture["altura_min"] = 150
        try:
            culture["altura_max"] = int(culturas_sheet.cell(row=row_culturas, column=6).value or 190)
        except:
            culture["altura_max"] = 190
        try:
            culture["mod_peso"] = int(culturas_sheet.cell(row=row_culturas, column=7).value or 0)
        except:
            culture["mod_peso"] = 0
        try:
            culture["velocidad"] = int(culturas_sheet.cell(row=row_culturas, column=8).value or 9)
        except:
            culture["velocidad"] = 9
        try:
            culture["descanso"] = int(culturas_sheet.cell(row=row_culturas, column=9).value or 8)
        except:
            culture["descanso"] = 8
        
        culture["tamanio"] = clean_value(culturas_sheet.cell(row=row_culturas, column=10).value) or "Mediano"
        culture["nivel_vida"] = clean_value(culturas_sheet.cell(row=row_culturas, column=11).value) or "Común"
        culture["descripcion_nivel_vida"] = clean_value(culturas_sheet.cell(row=row_culturas, column=12).value)
        
        # Extract skill scores and competencies
        habilidades_nombres = [
            (13, "Acertijos"), (14, "Acrobacias"), (15, "Atletismo"), (16, "Cazar"),
            (17, "Engaño"), (18, "Explorar"), (19, "Interpretación"), (20, "Intimidación"),
            (21, "Investigación"), (22, "Juego de manos"), (23, "Medicina"), (24, "Naturaleza"),
            (25, "Percepción"), (26, "Perspicacia"), (27, "Persuasión"), (28, "Saber antiguo"),
            (29, "Sigilo"), (30, "Trato con animales"), (31, "Viajar")
        ]
        
        for row, nombre_hab in habilidades_nombres:
            val = caract_sheet.cell(row=row, column=col).value
            if val:
                if str(val).upper() == 'X':
                    culture["competencias_habilidades"].append(nombre_hab)
                    culture["habilidades_puntuaciones"][nombre_hab] = 0
                else:
                    try:
                        culture["habilidades_puntuaciones"][nombre_hab] = int(val)
                    except:
                        culture["habilidades_puntuaciones"][nombre_hab] = 0
            else:
                culture["habilidades_puntuaciones"][nombre_hab] = 0
        
        # CORRECTION: Fix Dunedain bonuses (Excel has error - should be +1 FUE, +1 CON, +1 SAB, +1 a elección)
        if nombre == "Dunedain":
            culture["bonificadores_caracteristicas"] = {
                "fuerza": 1,
                "destreza": 0,
                "constitucion": 1,
                "inteligencia": 0,
                "sabiduria": 1,
                "carisma": 0,
            }
            culture["bonificador_a_eleccion"] = True  # +1 to any characteristic of choice
        else:
            culture["bonificador_a_eleccion"] = False
        
        cultures.append(culture)
    
    return cultures


def extract_backgrounds_complete(wb: openpyxl.Workbook) -> Dict:
    """Extract complete background data including trait descriptions"""
    sheet = wb['Trasfondo']
    
    backgrounds = []
    trait_descriptions = {}
    
    # Extract trait descriptions from columns A:B rows 21-64
    for row in range(21, 65):
        trait_name = clean_value(sheet.cell(row=row, column=1).value)
        trait_desc = clean_value(sheet.cell(row=row, column=2).value)
        if trait_name and trait_desc:
            trait_descriptions[trait_name.lower()] = trait_desc
    
    # Extract backgrounds from columns (each column is a background)
    col = 2
    while col <= sheet.max_column:
        cultura = clean_value(sheet.cell(row=3, column=col).value)
        nombre = clean_value(sheet.cell(row=4, column=col).value)
        
        if not nombre:
            col += 1
            continue
        
        background = {
            "nombre": nombre,
            "cultura": cultura,
            "columna_excel": col,
            "descripcion": clean_value(sheet.cell(row=5, column=col).value),
            
            # Skill competencies (rows 6-7 automatic, 8-10 to choose)
            "competencias_habilidades_auto": get_non_empty_cells(sheet, 6, 7, col),
            "competencias_habilidades_elegir": get_non_empty_cells(sheet, 8, 10, col),
            
            # Tool competencies (rows 11-15) - may contain "Instrumento musical" or "Juegos"
            "competencias_herramientas_1": get_non_empty_cells(sheet, 11, 13, col),
            "competencias_herramientas_2": get_non_empty_cells(sheet, 14, 15, col),
            
            # Traits (rows 16-17)
            "rasgos": [
                clean_value(sheet.cell(row=16, column=col).value),
                clean_value(sheet.cell(row=17, column=col).value),
            ],
        }
        
        # Filter out None from rasgos
        background["rasgos"] = [r for r in background["rasgos"] if r]
        
        # Add trait descriptions
        background["rasgos_descripciones"] = []
        for rasgo in background["rasgos"]:
            desc = trait_descriptions.get(rasgo.lower(), "")
            background["rasgos_descripciones"].append({
                "nombre": rasgo,
                "descripcion": desc
            })
        
        backgrounds.append(background)
        col += 1
    
    return {
        "backgrounds": backgrounds,
        "trait_descriptions": trait_descriptions
    }


def extract_occupations_complete(wb: openpyxl.Workbook) -> List[Dict]:
    """Extract complete occupation data with all weapon/armor/skill selections"""
    sheet = wb['Ocupaciones']
    
    occupations = []
    
    for col, vocacion in OCCUPATION_COLUMNS.items():
        occupation = {
            "vocacion": vocacion,
            "columna_excel": col,
            "dado_golpe": clean_value(sheet.cell(row=3, column=col).value),
            "puntos_golpe_base": clean_value(sheet.cell(row=4, column=col).value),
            "caracteristicas_principales": get_non_empty_cells(sheet, 5, 6, col),
            "tiradas_salvacion": get_non_empty_cells(sheet, 7, 8, col),
            # CORRECTED: Weapon proficiencies are in rows 9-11, armor in 12-15
            "competencia_armas": get_non_empty_cells(sheet, 9, 11, col),
            "competencia_armaduras": get_non_empty_cells(sheet, 12, 15, col),
            # Occupation description and shadow curse (rows 16-19) - separated for display
            "descripcion_corta": clean_value(sheet.cell(row=16, column=col).value),
            "descripcion_larga": clean_value(sheet.cell(row=17, column=col).value),
            "maldicion_nombre": clean_value(sheet.cell(row=18, column=col).value),
            "maldicion_descripcion": clean_value(sheet.cell(row=19, column=col).value),
            
            # Tools selection 1 (rows 21-41)
            "herramientas_1": {
                "pregunta": clean_value(sheet.cell(row=21, column=col).value) or clean_value(sheet.cell(row=21, column=2).value),
                "cantidad": int(sheet.cell(row=22, column=col).value or 0),
                "opciones": get_non_empty_cells(sheet, 23, 41, col),
            },
            
            # Skills selection (rows 44-57)
            "habilidades": {
                "pregunta": clean_value(sheet.cell(row=44, column=col).value) or clean_value(sheet.cell(row=44, column=2).value),
                "cantidad": int(sheet.cell(row=45, column=col).value or 0),
                "opciones": get_non_empty_cells(sheet, 46, 57, col),
            },
            
            # Armor selection A/B (rows 60-69)
            "armadura": {
                "pregunta": clean_value(sheet.cell(row=60, column=col).value) or clean_value(sheet.cell(row=60, column=2).value),
                "opcion_a": get_non_empty_cells(sheet, 62, 64, col),
                "opcion_b": get_non_empty_cells(sheet, 66, 69, col),
            },
            
            # Additional tool (row 73)
            "herramienta_adicional": clean_value(sheet.cell(row=73, column=col).value),
            
            # Tools selection 2 (rows 75-93)
            "herramientas_2": {
                "pregunta": clean_value(sheet.cell(row=75, column=col).value) or clean_value(sheet.cell(row=75, column=2).value),
                "cantidad": int(sheet.cell(row=76, column=col).value or 0),
                "opciones": get_non_empty_cells(sheet, 77, 93, col),
            },
            
            # Weapons (5 blocks)
            "armas": [],
            
            # Special features
            "especial_nombre": clean_value(sheet.cell(row=193, column=col).value),
            "especial_descripcion": clean_value(sheet.cell(row=194, column=col).value),
            
            # Expertise/Special by occupation
            "especial_opciones": get_non_empty_cells(sheet, 196, 215, col),
            
            # Occupation traits (paired rows)
            "rasgos_ocupacion": [],
            
            # Future paths (for level 3)
            "caminos": {
                "opcion_1": {
                    "nombre": clean_value(sheet.cell(row=234, column=col).value),
                    "descripcion": clean_value(sheet.cell(row=235, column=col).value),
                    "efectos": get_non_empty_cells(sheet, 236, 238, col),
                },
                "opcion_2": {
                    "nombre": clean_value(sheet.cell(row=239, column=col).value),
                    "descripcion": clean_value(sheet.cell(row=240, column=col).value),
                    "efectos": get_non_empty_cells(sheet, 241, 243, col),
                },
            },
            
            # Virtues text
            "virtudes_texto": get_non_empty_cells(sheet, 245, 246, col),
            
            # Favored skills
            "habilidades_favorecidas": get_non_empty_cells(sheet, 256, 258, col),
        }
        
        # ARMA 1 (rows 95-102)
        arma1 = {
            "numero": 1,
            "pregunta": clean_value(sheet.cell(row=95, column=col).value) or clean_value(sheet.cell(row=95, column=2).value),
            "cantidad": int(sheet.cell(row=96, column=col).value or 1),
            "tipo": "simple",
            "opciones": get_non_empty_cells(sheet, 97, 102, col),
        }
        if arma1["opciones"]:
            occupation["armas"].append(arma1)
        
        # ARMA 2 (rows 104-107)
        arma2 = {
            "numero": 2,
            "pregunta": clean_value(sheet.cell(row=104, column=col).value) or clean_value(sheet.cell(row=104, column=2).value),
            "cantidad": int(sheet.cell(row=105, column=col).value or 1),
            "tipo": "simple",
            "opciones": get_non_empty_cells(sheet, 106, 107, col),
        }
        if arma2["opciones"]:
            occupation["armas"].append(arma2)
        
        # ARMA 3 (rows 109-121) - A/B type
        arma3_pregunta = clean_value(sheet.cell(row=109, column=col).value)
        if arma3_pregunta:
            arma3 = {
                "numero": 3,
                "pregunta": arma3_pregunta,
                "tipo": "ab",
                "opcion_a": get_non_empty_cells(sheet, 111, 113, col),
                "cantidad_b": int(sheet.cell(row=115, column=col).value or 1),
                "opcion_b": get_non_empty_cells(sheet, 116, 121, col),
            }
            occupation["armas"].append(arma3)
        
        # ARMA 4 (rows 123-149) - A/B type with extras
        arma4_pregunta = clean_value(sheet.cell(row=123, column=col).value)
        if arma4_pregunta:
            arma4 = {
                "numero": 4,
                "pregunta": arma4_pregunta,
                "tipo": "ab_complex",
                "opcion_a": {
                    "opciones": get_non_empty_cells(sheet, 125, 132, col),
                    "extra_siempre": clean_value(sheet.cell(row=134, column=col).value),
                },
                "opcion_b": {
                    "opciones_1": get_non_empty_cells(sheet, 136, 143, col),
                    "opciones_2": get_non_empty_cells(sheet, 144, 149, col),
                },
            }
            occupation["armas"].append(arma4)
        
        # ARMA 5 (rows 151-190) - A/B type with extras
        arma5_pregunta = clean_value(sheet.cell(row=151, column=col).value)
        if arma5_pregunta:
            arma5 = {
                "numero": 5,
                "pregunta": arma5_pregunta,
                "tipo": "ab_complex",
                "opcion_a": {
                    "opciones": get_non_empty_cells(sheet, 153, 166, col),
                    "extra_siempre": clean_value(sheet.cell(row=167, column=col).value),
                },
                "opcion_b": {
                    "opciones_1": get_non_empty_cells(sheet, 169, 182, col),
                    "opciones_2": get_non_empty_cells(sheet, 183, 190, col),
                },
            }
            occupation["armas"].append(arma5)
        
        # Occupation traits (paired rows)
        trait_pairs = [(217, 218), (220, 221), (223, 224), (226, 227), (229, 230)]
        for name_row, desc_row in trait_pairs:
            nombre = clean_value(sheet.cell(row=name_row, column=col).value)
            desc = clean_value(sheet.cell(row=desc_row, column=col).value)
            if nombre:
                occupation["rasgos_ocupacion"].append({
                    "nombre": nombre,
                    "descripcion": desc
                })
        
        occupations.append(occupation)
    
    return occupations


def safe_int(value, default=0) -> int:
    """Safely convert value to int, return default if not possible"""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def extract_virtues_complete(wb: openpyxl.Workbook) -> List[Dict]:
    """Extract complete virtue data with all bonuses and selections"""
    sheet = wb['Virtudes']
    
    virtues = []
    # Start from column 3 (C) - column B has labels
    col = 3
    
    while col <= sheet.max_column:
        tipo = clean_value(sheet.cell(row=1, column=col).value)
        nombre = clean_value(sheet.cell(row=2, column=col).value)
        
        if not nombre:
            col += 1
            continue
        
        virtue = {
            "nombre": nombre,
            "tipo": tipo,  # Culture name or "COMUNES"
            "es_comun": tipo and "COMUN" in tipo.upper(),
            "columna_excel": col,
            "descripcion": clean_value(sheet.cell(row=3, column=col).value),
            "competencias_texto": clean_value(sheet.cell(row=4, column=col).value),
            
            # Fixed characteristic bonuses (rows 5-10)
            "caracteristicas_fijas": {
                "fuerza": 1 if clean_value(sheet.cell(row=5, column=col).value) and str(sheet.cell(row=5, column=col).value).upper() == 'X' else 0,
                "destreza": 1 if clean_value(sheet.cell(row=6, column=col).value) and str(sheet.cell(row=6, column=col).value).upper() == 'X' else 0,
                "constitucion": 1 if clean_value(sheet.cell(row=7, column=col).value) and str(sheet.cell(row=7, column=col).value).upper() == 'X' else 0,
                "inteligencia": 1 if clean_value(sheet.cell(row=8, column=col).value) and str(sheet.cell(row=8, column=col).value).upper() == 'X' else 0,
                "sabiduria": 1 if clean_value(sheet.cell(row=9, column=col).value) and str(sheet.cell(row=9, column=col).value).upper() == 'X' else 0,
                "carisma": 1 if clean_value(sheet.cell(row=10, column=col).value) and str(sheet.cell(row=10, column=col).value).upper() == 'X' else 0,
            },
            
            # Selectable characteristic bonus (rows 12-17)
            "caracteristicas_elegir": [],
            
            # Selectable saving throw (rows 19-24)
            "salvaciones_elegir": [],
            
            # Fixed bonuses (rows 26-28) - safely convert to int
            "puntos_golpe_extra": safe_int(sheet.cell(row=26, column=col).value),
            "puntos_comunidad_extra": safe_int(sheet.cell(row=27, column=col).value),
            "clase_armadura_extra": safe_int(sheet.cell(row=28, column=col).value),
            
            # Skill competencies to choose (rows 30-48)
            "competencias_habilidades_elegir": [],
            
            # Tool competencies to choose (rows 50-68)
            "competencias_herramientas_elegir": [],
        }
        
        # Extract selectable characteristics (rows 12-17)
        char_names = ["fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma"]
        for i, char in enumerate(char_names):
            val = clean_value(sheet.cell(row=12+i, column=col).value)
            if val and val.upper() == 'X':
                virtue["caracteristicas_elegir"].append(char)
        
        # Extract selectable saving throws (rows 19-24)
        for i, char in enumerate(char_names):
            val = clean_value(sheet.cell(row=19+i, column=col).value)
            if val and val.upper() == 'X':
                virtue["salvaciones_elegir"].append(char)
        
        # Extract skill competencies (rows 30-48) - skill names are in column B
        for row in range(30, 49):
            val = clean_value(sheet.cell(row=row, column=col).value)
            if val and val.upper() == 'X':
                # Get skill name from column B and clean it (remove attribute in parenthesis)
                skill_name = clean_value(sheet.cell(row=row, column=2).value)
                if skill_name:
                    # Remove "(Int)", "(Des)", etc. from skill name
                    skill_clean = skill_name.split('(')[0].strip()
                    virtue["competencias_habilidades_elegir"].append(skill_clean)
        
        # Extract tool competencies (rows 50-68) - tool names are in column B
        for row in range(50, 69):
            val = clean_value(sheet.cell(row=row, column=col).value)
            if val and val.upper() == 'X':
                # Get tool name from column B
                tool_name = clean_value(sheet.cell(row=row, column=2).value)
                if tool_name:
                    virtue["competencias_herramientas_elegir"].append(tool_name)
        
        virtues.append(virtue)
        col += 1
    
    return virtues


def extract_names_complete(wb: openpyxl.Workbook) -> Dict[str, Dict]:
    """Extract name generation data organized by culture"""
    sheet = wb['Nombres']
    names_data = {}
    
    col = 1
    while col <= sheet.max_column:
        culture_name = clean_value(sheet.cell(row=1, column=col).value)
        if not culture_name or culture_name == 'Apellidos':
            col += 1
            continue
        
        names_data[culture_name] = {
            "hombre": {"prefijos": [], "sufijos": []},
            "mujer": {"prefijos": [], "sufijos": []},
            "apellidos": [],
        }
        
        # Extract from rows 4+
        for row in range(4, min(sheet.max_row + 1, 60)):
            # Hombre prefijos (col n)
            prefix_m = clean_value(sheet.cell(row=row, column=col).value)
            # Hombre sufijos (col n+1)
            suffix_m = clean_value(sheet.cell(row=row, column=col + 1).value)
            # Mujer prefijos (col n+2)
            prefix_f = clean_value(sheet.cell(row=row, column=col + 2).value)
            # Mujer sufijos (col n+3)
            suffix_f = clean_value(sheet.cell(row=row, column=col + 3).value)
            # Apellidos (col n+4)
            apellido = clean_value(sheet.cell(row=row, column=col + 4).value)
            
            if prefix_m:
                names_data[culture_name]["hombre"]["prefijos"].append(prefix_m)
            if suffix_m:
                names_data[culture_name]["hombre"]["sufijos"].append(suffix_m)
            if prefix_f:
                names_data[culture_name]["mujer"]["prefijos"].append(prefix_f)
            if suffix_f:
                names_data[culture_name]["mujer"]["sufijos"].append(suffix_f)
            if apellido:
                names_data[culture_name]["apellidos"].append(apellido)
        
        col += 5  # Move to next culture block
    
    return names_data


def extract_equipment_lists(wb: openpyxl.Workbook) -> Dict:
    """Extract complete equipment data including prices and weights"""
    sheet = wb['Equipo']
    
    equipment_data = {
        "juegos": get_non_empty_cells(sheet, 25, 30, 2),  # B25:B30
        "instrumentos_musicales": get_non_empty_cells(sheet, 34, 43, 2),  # B34:B43
        "herramientas": [],
        "equipo_general": [],
        "armas": [],
        "armaduras": [],
    }
    
    # Extract tools (columns B-E, rows 3-19)
    for row in range(3, 20):
        nombre = clean_value(sheet.cell(row=row, column=2).value)
        if nombre and nombre not in ['JUEGOS', 'Equipo']:
            precio = sheet.cell(row=row, column=3).value
            moneda = clean_value(sheet.cell(row=row, column=4).value)
            peso = sheet.cell(row=row, column=5).value
            equipment_data["herramientas"].append({
                "nombre": nombre,
                "precio": precio,
                "moneda": moneda or "mp",
                "peso_kg": float(peso) if peso else 0
            })
    
    # Extract general equipment (columns G-J, rows 3-120)
    for row in range(3, 120):
        nombre = clean_value(sheet.cell(row=row, column=7).value)
        if nombre and nombre not in ['EQUIPO', 'Equipo', 'CONSUMIBLES Y ALIMENTACIÓN']:
            precio = sheet.cell(row=row, column=8).value
            moneda = clean_value(sheet.cell(row=row, column=9).value)
            peso = sheet.cell(row=row, column=10).value
            if precio is not None:  # Skip section headers
                equipment_data["equipo_general"].append({
                    "nombre": nombre,
                    "precio": precio,
                    "moneda": moneda or "mc",
                    "peso_kg": float(peso) if peso else 0
                })
    
    # Extract weapons (columns N-T, rows 4-35)
    for row in range(4, 36):
        arma = clean_value(sheet.cell(row=row, column=14).value)
        if arma and arma not in ['Arma', 'Armas sencillas cuerpo a cuerpo', 'Armas sencillas a distancia', 
                                  'Armas marciales cuerpo a cuerpo', 'Armas marciales a distancia']:
            precio = sheet.cell(row=row, column=15).value
            moneda = clean_value(sheet.cell(row=row, column=16).value)
            peso = sheet.cell(row=row, column=17).value
            modificador = clean_value(sheet.cell(row=row, column=18).value)
            dano = clean_value(sheet.cell(row=row, column=19).value)
            equipment_data["armas"].append({
                "nombre": arma,
                "precio": precio,
                "moneda": moneda or "mp",
                "peso_kg": float(peso) if peso else 0,
                "modificador": modificador,
                "dano": dano
            })
    
    # Extract armor (columns W-AA, rows 4-21)
    for row in range(4, 22):
        armadura = clean_value(sheet.cell(row=row, column=23).value)
        if armadura and armadura not in ['Armadura', 'Armaduras ligeras', 'Armaduras medias', 
                                          'Armaduras pesadas', 'Escudos']:
            precio = sheet.cell(row=row, column=24).value
            moneda = clean_value(sheet.cell(row=row, column=25).value)
            peso = sheet.cell(row=row, column=26).value
            ca = clean_value(sheet.cell(row=row, column=27).value)
            equipment_data["armaduras"].append({
                "nombre": armadura,
                "precio": precio,
                "moneda": moneda or "mp",
                "peso_kg": float(peso) if peso else 0,
                "clase_armadura": ca
            })
    
    return equipment_data


def extract_all_data_complete() -> Dict:
    """Extract all data from the Excel file"""
    utumno_path = "/app/data/utumno.xlsm"
    
    if not os.path.exists(utumno_path):
        raise FileNotFoundError(f"Excel file not found: {utumno_path}")
    
    print("Loading Excel workbook...")
    wb = openpyxl.load_workbook(utumno_path, data_only=True)
    
    print("Extracting cultures...")
    cultures = extract_cultures_complete(wb)
    
    print("Extracting backgrounds...")
    backgrounds_data = extract_backgrounds_complete(wb)
    
    print("Extracting occupations...")
    occupations = extract_occupations_complete(wb)
    
    print("Extracting virtues...")
    virtues = extract_virtues_complete(wb)
    
    print("Extracting names...")
    names = extract_names_complete(wb)
    
    print("Extracting equipment lists...")
    equipment_lists = extract_equipment_lists(wb)
    
    data = {
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "cultures": cultures,
        "backgrounds": backgrounds_data["backgrounds"],
        "trait_descriptions": backgrounds_data["trait_descriptions"],
        "occupations": occupations,
        "virtues": virtues,
        "names": names,
        "equipment_lists": equipment_lists,
    }
    
    # Save to JSON
    output_path = "/app/data/extracted_data_complete.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\nData extracted and saved to {output_path}")
    print(f"\nSummary:")
    print(f"  - Cultures: {len(cultures)}")
    print(f"  - Backgrounds: {len(backgrounds_data['backgrounds'])}")
    print(f"  - Trait descriptions: {len(backgrounds_data['trait_descriptions'])}")
    print(f"  - Occupations: {len(occupations)}")
    print(f"  - Virtues: {len(virtues)}")
    print(f"  - Name sets: {len(names)}")
    print(f"  - Instruments: {len(equipment_lists['instrumentos_musicales'])}")
    print(f"  - Games: {len(equipment_lists['juegos'])}")
    
    return data


if __name__ == "__main__":
    extract_all_data_complete()
