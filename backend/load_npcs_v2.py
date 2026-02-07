"""
Script to load NPCs, enemies, and animals from extracted PDF data into MongoDB
Version 2: New structured data model with separated weapons, actions, and specials
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
import uuid
import re

load_dotenv('.env')

def now_utc():
    return datetime.now(timezone.utc).isoformat()

def parse_modifier(value):
    """Convert attribute value to modifier"""
    return (value - 10) // 2

def parse_attack_bonus(text):
    """Extract attack bonus from text like '+4 al impacto'"""
    match = re.search(r'\+(\d+)\s*al\s*impacto', text)
    return int(match.group(1)) if match else None

def parse_damage(text):
    """Extract damage string like '1d8 + 3' from text"""
    match = re.search(r'(\d+d\d+(?:\s*[+\-]\s*\d+)?)', text)
    return match.group(1) if match else None

def parse_dc(text):
    """Extract DC from text like 'CD 14'"""
    match = re.search(r'CD\s*(\d+)', text)
    return int(match.group(1)) if match else None

def create_npc(nombre, categoria, data):
    """Create structured NPC document"""
    npc = {
        '_id': str(uuid.uuid4()),
        'nombre': nombre,
        'categoria': categoria,
        'descripcion': data.get('descripcion', ''),
        'tipo': data.get('tipo', ''),
        'tamanio': data.get('tamanio', 'Mediano'),
        'alineamiento': data.get('alineamiento', ''),
        # Combat stats
        'clase_armadura': data.get('ca', 10),
        'descripcion_armadura': data.get('descripcion_armadura', ''),
        'puntos_golpe': data.get('pg', 1),
        'dados_golpe': data.get('dados_golpe', ''),
        'velocidad': data.get('velocidad', 9),
        'velocidades_especiales': data.get('velocidades_especiales'),
        # Attributes
        'atributos': data.get('atributos', {
            'fuerza': 10, 'destreza': 10, 'constitucion': 10,
            'inteligencia': 10, 'sabiduria': 10, 'carisma': 10
        }),
        # Saves & Skills
        'tiradas_salvacion': data.get('tiradas_salvacion'),
        'habilidades': data.get('habilidades'),
        'percepcion_pasiva': data.get('percepcion_pasiva', 10),
        # Resistances & Immunities
        'resistencias': data.get('resistencias', []),
        'inmunidades_dano': data.get('inmunidades_dano', []),
        'inmunidades_estados': data.get('inmunidades_estados', []),
        'vulnerabilidades': data.get('vulnerabilidades', []),
        # Senses & Languages
        'sentidos': data.get('sentidos', []),
        'idiomas': data.get('idiomas', []),
        # Challenge
        'desafio': data.get('desafio', ''),
        'experiencia': data.get('experiencia', 0),
        'bonificador_competencia': data.get('bonificador_competencia', 2),
        # Structured abilities and attacks
        'especiales': data.get('especiales', []),
        'armas': data.get('armas', []),
        'acciones': data.get('acciones', []),
        'ataque_multiple': data.get('ataque_multiple', ''),
        'reacciones': data.get('reacciones', []),
        'acciones_legendarias': data.get('acciones_legendarias', []),
        # Story (for future AI)
        'historia': '',
        # Metadata
        'created_at': now_utc(),
        'updated_at': now_utc()
    }
    return npc

# ========== PARSED NPC DATA FROM PDFs ==========

NPCS_DATA = [
    # === ADVERSARIOS.PDF - Malignos ===
    {
        'nombre': 'Atracador',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (hombre maligno)',
        'tamanio': 'Mediano',
        'ca': 11,
        'descripcion_armadura': 'coleto de cuero',
        'pg': 11,
        'dados_golpe': '2d8 + 2',
        'velocidad': 9,
        'atributos': {'fuerza': 10, 'destreza': 13, 'constitucion': 11, 'inteligencia': 12, 'sabiduria': 10, 'carisma': 10},
        'percepcion_pasiva': 10,
        'especiales': [
            {'nombre': 'Tácticas de Banda', 'descripcion': 'Tiene ventaja en una tirada de ataque contra una criatura si al menos uno de sus aliados se encuentra a menos de 1,5 m de ella y el aliado no está incapacitado.'}
        ],
        'armas': [
            {'nombre': 'Gran Clava', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 3, 'alcance_metros': '1,5 m', 'dano': '1d8 + 1', 'tipo_dano': 'contundente'},
            {'nombre': 'Daga', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 3, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '1d4 + 1', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 25,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Jefe de Rufianes',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (hombre maligno)',
        'tamanio': 'Mediano',
        'ca': 11,
        'descripcion_armadura': 'coleto de cuero',
        'pg': 32,
        'dados_golpe': '5d8 + 10',
        'velocidad': 9,
        'atributos': {'fuerza': 15, 'destreza': 11, 'constitucion': 14, 'inteligencia': 10, 'sabiduria': 10, 'carisma': 11},
        'habilidades': {'intimidacion': 2},
        'percepcion_pasiva': 10,
        'especiales': [
            {'nombre': 'Tácticas de Banda', 'descripcion': 'Tiene ventaja en una tirada de ataque contra una criatura si al menos uno de sus aliados se encuentra a menos de 1,5 m de ella y el aliado no está incapacitado.'},
            {'nombre': 'Aullido de Triunfo', 'descripcion': 'Se recarga tras un descanso corto o largo. Cualquier criatura que elija y se encuentre a 9 m o menos y pueda oírle obtiene ventaja en las tiradas de ataque y en las pruebas de Carisma (Intimidación) hasta el comienzo del siguiente turno. Puede realizar un ataque como acción adicional.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo.',
        'armas': [
            {'nombre': 'Gran Clava', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d8 + 2', 'tipo_dano': 'contundente'},
            {'nombre': 'Daga', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '1d4 + 2', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 200,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Salteador de Caminos',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (hombre maligno)',
        'tamanio': 'Mediano',
        'ca': 15,
        'descripcion_armadura': 'jubón de cuero',
        'pg': 22,
        'dados_golpe': '4d8 + 4',
        'velocidad': 9,
        'atributos': {'fuerza': 12, 'destreza': 16, 'constitucion': 12, 'inteligencia': 10, 'sabiduria': 11, 'carisma': 10},
        'habilidades': {'percepcion': 2, 'sigilo': 5},
        'percepcion_pasiva': 12,
        'especiales': [
            {'nombre': 'Emboscador', 'descripcion': 'En el primer asalto de combate, tiene ventaja en las tiradas de ataque contra cualquier criatura a la que haya sorprendido.'},
            {'nombre': 'Ataque por Sorpresa', 'descripcion': 'Si sorprende a una criatura y la golpea con un ataque durante el primer asalto de combate, el objetivo sufre 2d6 puntos de daño adicionales.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo o dos ataques a distancia.',
        'armas': [
            {'nombre': 'Espada Corta', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d6 + 3', 'tipo_dano': 'perforante'},
            {'nombre': 'Arco', 'tipo': 'distancia', 'bonificador_impacto': 5, 'alcance_metros': '24/96 m', 'dano': '1d6 + 3', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 100,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Saqueador Sureño',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (hombre maligno)',
        'tamanio': 'Mediano',
        'ca': 15,
        'descripcion_armadura': 'pieles, escudo',
        'pg': 16,
        'dados_golpe': '3d8 + 3',
        'velocidad': 9,
        'atributos': {'fuerza': 14, 'destreza': 12, 'constitucion': 12, 'inteligencia': 9, 'sabiduria': 11, 'carisma': 9},
        'habilidades': {'intimidacion': 1},
        'percepcion_pasiva': 10,
        'especiales': [
            {'nombre': 'Odio Temerario', 'descripcion': 'Al inicio de su turno, puede obtener ventaja en todas las tiradas de ataque con arma cuerpo a cuerpo durante ese turno, pero las tiradas de ataque contra él tienen ventaja hasta el inicio de su siguiente turno.'}
        ],
        'armas': [
            {'nombre': 'Hacha', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d6 + 2 / 1d8 + 2 a dos manos', 'tipo_dano': 'cortante'},
            {'nombre': 'Lanza', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '1d6 + 2 / 1d8 + 2 a dos manos', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 50,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Campeón Sureño',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (hombre maligno)',
        'tamanio': 'Mediano',
        'ca': 17,
        'descripcion_armadura': 'armadura de escamas, escudo',
        'pg': 58,
        'dados_golpe': '9d8 + 18',
        'velocidad': 9,
        'atributos': {'fuerza': 16, 'destreza': 12, 'constitucion': 14, 'inteligencia': 9, 'sabiduria': 11, 'carisma': 13},
        'habilidades': {'intimidacion': 3},
        'percepcion_pasiva': 10,
        'especiales': [
            {'nombre': 'Odio Temerario', 'descripcion': 'Al inicio de su turno, puede obtener ventaja en todas las tiradas de ataque con arma cuerpo a cuerpo durante ese turno, pero las tiradas de ataque contra él tienen ventaja hasta el inicio de su siguiente turno.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo o un ataque cuerpo a cuerpo y un ataque a distancia.',
        'armas': [
            {'nombre': 'Hacha de Guerra', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d8 + 3 / 1d10 + 3 a dos manos', 'tipo_dano': 'cortante'},
            {'nombre': 'Lanza', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '1d6 + 3 / 1d8 + 3 a dos manos', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 450,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Sabueso de Sauron',
        'categoria': 'malignos',
        'tipo': 'Bestia Grande',
        'tamanio': 'Grande',
        'ca': 15,
        'descripcion_armadura': 'armadura natural',
        'pg': 52,
        'dados_golpe': '7d10 + 14',
        'velocidad': 15,
        'atributos': {'fuerza': 18, 'destreza': 15, 'constitucion': 15, 'inteligencia': 8, 'sabiduria': 12, 'carisma': 10},
        'habilidades': {'intimidacion': 4, 'percepcion': 5, 'sigilo': 4},
        'resistencias': ['Daño contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_estados': ['hechizado'],
        'percepcion_pasiva': 15,
        'sentidos': ['Percepción pasiva 20 con oído u olfato'],
        'especiales': [
            {'nombre': 'Buen Oído y Olfato', 'descripcion': 'Tiene ventaja en las pruebas de Sabiduría (Percepción) que se basan en el oído o el olfato.'},
            {'nombre': 'Tácticas de Manada', 'descripcion': 'Tiene ventaja en una tirada de ataque contra una criatura si al menos uno de sus aliados está situado a 1,5 m o menos de la criatura y ese aliado no está incapacitado.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques: uno con el mordisco y otro con las garras.',
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '1,5 m', 'dano': '2d6 + 4', 'tipo_dano': 'perforante', 'efecto': 'El objetivo debe superar salvación de Fuerza CD 14 o queda derribado.'},
            {'nombre': 'Garras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '1,5 m', 'dano': '2d4 + 4', 'tipo_dano': 'cortante', 'efecto': 'Si el objetivo es Mediano o menor, queda agarrado (CD 14 para escapar).'}
        ],
        'experiencia': 700,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Lobo Salvaje',
        'categoria': 'malignos',
        'tipo': 'Bestia Mediana',
        'tamanio': 'Mediano',
        'ca': 13,
        'descripcion_armadura': 'armadura natural',
        'pg': 16,
        'dados_golpe': '3d8 + 3',
        'velocidad': 15,
        'atributos': {'fuerza': 14, 'destreza': 14, 'constitucion': 12, 'inteligencia': 5, 'sabiduria': 12, 'carisma': 7},
        'habilidades': {'intimidacion': 0, 'percepcion': 5, 'sigilo': 4},
        'percepcion_pasiva': 15,
        'sentidos': ['Percepción pasiva 20 con oído u olfato'],
        'especiales': [
            {'nombre': 'Temor al Fuego', 'descripcion': 'Si sufre daño por fuego o radiante, debe superar una prueba de Carisma (Intimidación) CD 10 + daño sufrido o queda asustado hasta el final de su siguiente turno.'},
            {'nombre': 'Buen Oído y Olfato', 'descripcion': 'Tiene ventaja en las pruebas de Sabiduría (Percepción) que se basan en el oído o el olfato.'},
            {'nombre': 'Tácticas de Manada', 'descripcion': 'Tiene ventaja en una tirada de ataque contra una criatura si al menos uno de sus aliados está situado a 1,5 m o menos de la criatura y ese aliado no está incapacitado.'}
        ],
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d6 + 2', 'tipo_dano': 'perforante', 'efecto': 'El objetivo debe superar salvación de Fuerza CD 12 o queda derribado.'}
        ],
        'experiencia': 50,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Lobo Jefe',
        'categoria': 'malignos',
        'tipo': 'Bestia Grande',
        'tamanio': 'Grande',
        'ca': 14,
        'descripcion_armadura': 'armadura natural',
        'pg': 37,
        'dados_golpe': '5d10 + 10',
        'velocidad': 15,
        'atributos': {'fuerza': 16, 'destreza': 14, 'constitucion': 14, 'inteligencia': 7, 'sabiduria': 12, 'carisma': 8},
        'habilidades': {'intimidacion': 3, 'percepcion': 5, 'sigilo': 4},
        'percepcion_pasiva': 15,
        'sentidos': ['Percepción pasiva 20 con oído u olfato'],
        'especiales': [
            {'nombre': 'Temor al Fuego', 'descripcion': 'Si sufre daño por fuego o radiante, debe superar una prueba de Carisma (Intimidación) CD 10 + daño sufrido o queda asustado hasta el final de su siguiente turno.'},
            {'nombre': 'Buen Oído y Olfato', 'descripcion': 'Tiene ventaja en las pruebas de Sabiduría (Percepción) que se basan en el oído o el olfato.'},
            {'nombre': 'Tácticas de Manada', 'descripcion': 'Tiene ventaja en una tirada de ataque contra una criatura si al menos uno de sus aliados está situado a 1,5 m o menos de la criatura y ese aliado no está incapacitado.'}
        ],
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '2d6 + 3', 'tipo_dano': 'perforante', 'efecto': 'El objetivo debe superar salvación de Fuerza CD 13 o queda derribado.'}
        ],
        'experiencia': 200,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Espectro Cruel',
        'categoria': 'malignos',
        'tipo': 'Muerto Viviente Mediano',
        'tamanio': 'Mediano',
        'ca': 13,
        'pg': 26,
        'dados_golpe': '4d8 + 8',
        'velocidad': 9,
        'velocidades_especiales': {'volar': 9},
        'atributos': {'fuerza': 1, 'destreza': 16, 'constitucion': 14, 'inteligencia': 10, 'sabiduria': 12, 'carisma': 14},
        'habilidades': {'sigilo': 7},
        'vulnerabilidades': ['radiante'],
        'resistencias': ['Daño contundente, cortante y perforante de armas no encantadas para muertos vivientes'],
        'inmunidades_dano': ['frío', 'necrótico', 'veneno'],
        'inmunidades_estados': ['hechizado', 'cansancio', 'agarrado', 'paralizado', 'petrificado', 'envenenado', 'derribado', 'apresado'],
        'percepcion_pasiva': 11,
        'sentidos': ['Visión verdadera 36 m'],
        'especiales': [
            {'nombre': 'Inmortalidad', 'descripcion': 'Si el daño lo reduce a 0 PG, debe realizar salvación de Constitución CD 5 + daño sufrido, a menos que sea radiante, crítico o de arma encantada. Éxito: queda a 1 PG.'},
            {'nombre': 'Debilidad ante la Luz del Sol', 'descripcion': 'Bajo la luz del sol, sufre desventaja en tiradas de ataque, pruebas de característica y tiradas de salvación.'}
        ],
        'ataque_multiple': 'Puede usar Infundir temor. Luego lleva a cabo un ataque cuerpo a cuerpo.',
        'armas': [
            {'nombre': 'Espada', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d6 + 3 / 1d8 + 3 a dos manos', 'tipo_dano': 'cortante'}
        ],
        'acciones': [
            {'nombre': 'Infundir Temor', 'descripcion': 'Todas las criaturas no muertas vivientes elegidas a 18 m o menos se anotan 1 punto de Sombra por Pavor. Salvación de Carisma CD 12: fallo = asustado 1 minuto; fallo por 5+ = también aturdido.'}
        ],
        'experiencia': 200,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Habitante del Pantano',
        'categoria': 'malignos',
        'tipo': 'Muerto Viviente Mediano',
        'tamanio': 'Mediano',
        'ca': 12,
        'pg': 22,
        'dados_golpe': '4d8 + 4',
        'velocidad': 9,
        'atributos': {'fuerza': 13, 'destreza': 15, 'constitucion': 12, 'inteligencia': 7, 'sabiduria': 10, 'carisma': 6},
        'habilidades': {'intimidacion': 0, 'sigilo': 4},
        'resistencias': ['necrótico'],
        'inmunidades_dano': ['veneno'],
        'inmunidades_estados': ['hechizado', 'cansancio', 'envenenado'],
        'percepcion_pasiva': 10,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'especiales': [
            {'nombre': 'Inmortalidad', 'descripcion': 'Si el daño lo reduce a 0 PG, debe realizar salvación de Constitución CD 5 + daño sufrido, a menos que sea radiante, crítico o de arma encantada. Éxito: queda a 1 PG.'},
            {'nombre': 'Sensibilidad a la Luz del Sol', 'descripcion': 'Tiene desventaja en tiradas de ataque y pruebas de Sabiduría (Percepción) basadas en la vista bajo la luz del sol.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques: uno con el mordisco y otro con las garras.',
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d6 + 2', 'tipo_dano': 'perforante'},
            {'nombre': 'Garras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d4 + 2', 'tipo_dano': 'cortante', 'efecto': 'Si el objetivo es Mediano o menor, queda agarrado (CD 11 para escapar).'}
        ],
        'experiencia': 100,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Tumulario',
        'categoria': 'malignos',
        'tipo': 'Muerto Viviente Mediano',
        'tamanio': 'Mediano',
        'ca': 15,
        'descripcion_armadura': 'cota de anillas',
        'pg': 45,
        'dados_golpe': '6d8 + 18',
        'velocidad': 9,
        'atributos': {'fuerza': 15, 'destreza': 10, 'constitucion': 16, 'inteligencia': 10, 'sabiduria': 14, 'carisma': 16},
        'habilidades': {'intimidacion': 5, 'sigilo': 2},
        'resistencias': ['frío', 'necrótico', 'contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_dano': ['veneno'],
        'inmunidades_estados': ['hechizado', 'cansancio', 'envenenado'],
        'percepcion_pasiva': 12,
        'sentidos': ['Visión verdadera 36 m'],
        'especiales': [
            {'nombre': 'Inmortalidad', 'descripcion': 'Si el daño lo reduce a 0 PG, debe realizar salvación de Constitución CD 5 + daño sufrido, a menos que sea radiante, crítico o de arma encantada. Éxito: queda a 1 PG.'},
            {'nombre': 'Sensibilidad a la Luz del Sol', 'descripcion': 'Tiene desventaja en tiradas de ataque y pruebas de Sabiduría (Percepción) basadas en la vista bajo la luz del sol.'}
        ],
        'ataque_multiple': 'Puede usar Infundir temor o Canción de los tumularios. Luego lleva a cabo dos ataques con espada larga. Puede usar Toque helado en lugar de uno.',
        'armas': [
            {'nombre': 'Espada Larga', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d8 + 2 / 1d10 + 2 a dos manos', 'tipo_dano': 'cortante'},
            {'nombre': 'Toque Helado', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d6 + 2', 'tipo_dano': 'necrótico', 'efecto': 'El objetivo debe realizar salvación de Constitución CD 13 o sufre 1d10 daño necrótico adicional.'}
        ],
        'acciones': [
            {'nombre': 'Infundir Temor', 'descripcion': 'Criaturas no muertas vivientes a 18 m o menos se anotan 1 punto de Sombra. Salvación de Carisma CD 13.'},
            {'nombre': 'Canción de los Tumularios', 'descripcion': 'Entona una canción contra una criatura no elfo ni Mago a 9 m que pueda oírlo. 2 puntos de Sombra de Hechicería, salvación de Inteligencia CD 13. Fallo: inconsciente 1 minuto (o 1 hora si falla por 5+).'}
        ],
        'experiencia': 700,
        'bonificador_competencia': 2
    },
    # === ORCOS ===
    {
        'nombre': 'Jefe Gran Orco',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (orco)',
        'tamanio': 'Mediano',
        'ca': 18,
        'descripcion_armadura': 'cota de mallas pesada orca, escudo',
        'pg': 85,
        'dados_golpe': '10d8 + 40',
        'velocidad': 9,
        'atributos': {'fuerza': 18, 'destreza': 12, 'constitucion': 18, 'inteligencia': 10, 'sabiduria': 12, 'carisma': 16},
        'habilidades': {'perspicacia': 3, 'intimidacion': 5},
        'percepcion_pasiva': 11,
        'especiales': [
            {'nombre': 'Agresividad', 'descripcion': 'Como acción adicional, puede moverse hasta su velocidad hacia una criatura hostil que tiene a la vista.'},
            {'nombre': 'Fuerza Horrible', 'descripcion': 'Un arma cuerpo a cuerpo inflige un dado adicional de su daño cuando acierta (incluido en el ataque).'},
            {'nombre': 'Sensibilidad a la Luz del Sol', 'descripcion': 'Tiene desventaja en tiradas de ataque y pruebas de Sabiduría (Percepción) basadas en la vista bajo la luz del sol.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo, o un ataque cuerpo a cuerpo y un ataque a distancia.',
        'armas': [
            {'nombre': 'Cimitarra Pesada', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '1,5 m', 'dano': '2d8 + 4 / 2d10 + 4 a dos manos', 'tipo_dano': 'cortante'},
            {'nombre': 'Lanza', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 6, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '2d6 + 4 / 2d8 + 4 a dos manos', 'tipo_dano': 'perforante'},
            {'nombre': 'Golpe con Escudo', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '1,5 m', 'dano': '2d4 + 4', 'tipo_dano': 'contundente', 'efecto': 'Si Mediano o menor, salvación de Fuerza CD 15 o derribado.'}
        ],
        'acciones': [
            {'nombre': 'Aullido de Triunfo', 'descripcion': 'Se recarga tras descanso corto/largo. Criaturas elegidas a 9 m que le oigan obtienen ventaja en ataques e Intimidación hasta su siguiente turno. Puede atacar como acción adicional.'}
        ],
        'reacciones': [
            {'nombre': 'Parada', 'descripcion': 'Suma 2 a su CA contra un ataque cuerpo a cuerpo. Debe ver al atacante y empuñar arma.'},
            {'nombre': 'Redirigir Ataque', 'descripcion': 'Cuando le acierta una criatura que puede ver, elige a otro orco a 1,5 m. Intercambian posiciones y el orco elegido es el objetivo.'}
        ],
        'experiencia': 1800,
        'bonificador_competencia': 3
    },
    {
        'nombre': 'Guardaespaldas Gran Orco',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (orco)',
        'tamanio': 'Mediano',
        'ca': 18,
        'descripcion_armadura': 'cota de mallas pesada orca, escudo',
        'pg': 60,
        'dados_golpe': '8d8 + 24',
        'velocidad': 9,
        'atributos': {'fuerza': 16, 'destreza': 12, 'constitucion': 16, 'inteligencia': 8, 'sabiduria': 10, 'carisma': 10},
        'habilidades': {'intimidacion': 2, 'percepcion': 2},
        'percepcion_pasiva': 12,
        'especiales': [
            {'nombre': 'Agresividad', 'descripcion': 'Como acción adicional, puede moverse hasta su velocidad hacia una criatura hostil que tiene a la vista.'},
            {'nombre': 'Dureza Temible', 'descripcion': 'Se recarga tras descanso corto/largo. Si sufre 7 daño o menos que lo reduciría a 0 PG, queda a 1 PG.'},
            {'nombre': 'Fuerza Horrible', 'descripcion': 'Un arma cuerpo a cuerpo inflige un dado adicional de su daño cuando acierta.'},
            {'nombre': 'Sensibilidad a la Luz del Sol', 'descripcion': 'Tiene desventaja en tiradas de ataque y pruebas de Sabiduría (Percepción) basadas en la vista bajo la luz del sol.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo, o un ataque cuerpo a cuerpo y un ataque a distancia.',
        'armas': [
            {'nombre': 'Hacha de Guerra', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '2d8 + 3 / 2d10 + 3 a dos manos', 'tipo_dano': 'cortante'},
            {'nombre': 'Lanza', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '2d6 + 3 / 2d8 + 3 a dos manos', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 450,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Arquero Trasgo',
        'categoria': 'malignos',
        'tipo': 'Humanoide Pequeño (orco)',
        'tamanio': 'Pequeño',
        'ca': 13,
        'descripcion_armadura': 'cuero orco',
        'pg': 9,
        'dados_golpe': '2d6 + 2',
        'velocidad': 9,
        'atributos': {'fuerza': 11, 'destreza': 14, 'constitucion': 12, 'inteligencia': 10, 'sabiduria': 10, 'carisma': 8},
        'habilidades': {'percepcion': 2, 'sigilo': 6},
        'percepcion_pasiva': 12,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'especiales': [
            {'nombre': 'Huida Ágil', 'descripcion': 'Puede llevar a cabo Destrabarse o Esconderse como acción adicional en cada turno.'},
            {'nombre': 'Ataque Furtivo (1/turno)', 'descripcion': 'Causa 1d6 daño adicional cuando acierta con ventaja o aliado a 1,5 m del objetivo.'},
            {'nombre': 'Sensibilidad a la Luz del Sol', 'descripcion': 'Tiene desventaja en tiradas de ataque y pruebas de Sabiduría (Percepción) basadas en la vista bajo la luz del sol.'}
        ],
        'armas': [
            {'nombre': 'Cuchillo Aserrado', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d4 + 2', 'tipo_dano': 'cortante'},
            {'nombre': 'Arco de Cuerno', 'tipo': 'distancia', 'bonificador_impacto': 4, 'alcance_metros': '24/96 m', 'dano': '1d6 + 2', 'tipo_dano': 'perforante', 'efecto': 'Salvación de Constitución CD 13 o envenenado 1 hora. Fallo por 5+: no puede recuperar PG y desventaja en salvaciones de muerte.'}
        ],
        'experiencia': 100,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Cacique Orco',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (orco)',
        'tamanio': 'Mediano',
        'ca': 17,
        'descripcion_armadura': 'cota de mallas orca, escudo',
        'pg': 39,
        'dados_golpe': '6d8 + 12',
        'velocidad': 9,
        'atributos': {'fuerza': 16, 'destreza': 14, 'constitucion': 14, 'inteligencia': 10, 'sabiduria': 10, 'carisma': 12},
        'habilidades': {'intimidacion': 3},
        'percepcion_pasiva': 10,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'especiales': [
            {'nombre': 'Ataque Furtivo (1/turno)', 'descripcion': 'Causa 2d6 daño adicional cuando acierta con ventaja o aliado a 1,5 m del objetivo.'},
            {'nombre': 'Sensibilidad a la Luz del Sol', 'descripcion': 'Tiene desventaja en tiradas de ataque y pruebas de Sabiduría (Percepción) basadas en la vista bajo la luz del sol.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo, o un ataque cuerpo a cuerpo y un ataque a distancia.',
        'armas': [
            {'nombre': 'Cimitarra', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d6 + 3', 'tipo_dano': 'cortante'},
            {'nombre': 'Golpe con Escudo', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d4 + 3', 'tipo_dano': 'contundente', 'efecto': 'Si Mediano o menor, salvación de Fuerza CD 13 o derribado.'},
            {'nombre': 'Lanza', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '1d6 + 3 / 1d8 + 3 a dos manos', 'tipo_dano': 'perforante'}
        ],
        'acciones': [
            {'nombre': 'Aullido de Triunfo', 'descripcion': 'Se recarga tras descanso corto/largo. Criaturas elegidas a 9 m obtienen ventaja en ataques e Intimidación. Puede atacar como acción adicional.'}
        ],
        'reacciones': [
            {'nombre': 'Parada', 'descripcion': 'Suma 2 a su CA contra un ataque cuerpo a cuerpo que le impactaría.'}
        ],
        'experiencia': 450,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Guardia Orco',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (orco)',
        'tamanio': 'Mediano',
        'ca': 17,
        'descripcion_armadura': 'cota de mallas orca, escudo',
        'pg': 26,
        'dados_golpe': '4d8 + 8',
        'velocidad': 9,
        'atributos': {'fuerza': 15, 'destreza': 14, 'constitucion': 14, 'inteligencia': 8, 'sabiduria': 10, 'carisma': 10},
        'habilidades': {'percepcion': 2},
        'percepcion_pasiva': 12,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'especiales': [
            {'nombre': 'Ataque Furtivo (1/turno)', 'descripcion': 'Causa 1d6 daño adicional cuando acierta con ventaja o aliado a 1,5 m del objetivo.'},
            {'nombre': 'Sensibilidad a la Luz del Sol', 'descripcion': 'Tiene desventaja en tiradas de ataque y pruebas de Sabiduría (Percepción) basadas en la vista bajo la luz del sol.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo, o un ataque cuerpo a cuerpo y un ataque a distancia.',
        'armas': [
            {'nombre': 'Cimitarra', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d6 + 2', 'tipo_dano': 'cortante'},
            {'nombre': 'Lanza', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '1d6 + 2 / 1d8 + 2 a dos manos', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 100,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Soldado Orco',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (orco)',
        'tamanio': 'Mediano',
        'ca': 15,
        'descripcion_armadura': 'cuero orco, escudo',
        'pg': 11,
        'dados_golpe': '2d8 + 2',
        'velocidad': 9,
        'atributos': {'fuerza': 13, 'destreza': 14, 'constitucion': 12, 'inteligencia': 9, 'sabiduria': 10, 'carisma': 9},
        'percepcion_pasiva': 10,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'especiales': [
            {'nombre': 'Ataque Furtivo (1/turno)', 'descripcion': 'Causa 1d6 daño adicional cuando acierta con ventaja o aliado a 1,5 m del objetivo.'},
            {'nombre': 'Sensibilidad a la Luz del Sol', 'descripcion': 'Tiene desventaja en tiradas de ataque y pruebas de Sabiduría (Percepción) basadas en la vista bajo la luz del sol.'}
        ],
        'armas': [
            {'nombre': 'Cimitarra', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d6 + 2', 'tipo_dano': 'cortante'},
            {'nombre': 'Lanza', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 3, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '1d6 + 1 / 1d8 + 1 a dos manos', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 25,
        'bonificador_competencia': 2
    },
    # === TROLLS ===
    {
        'nombre': 'Gran Trol de las Cavernas',
        'categoria': 'malignos',
        'tipo': 'Gigante Grande',
        'tamanio': 'Grande',
        'ca': 14,
        'descripcion_armadura': 'armadura natural',
        'pg': 105,
        'dados_golpe': '10d10 + 50',
        'velocidad': 12,
        'atributos': {'fuerza': 21, 'destreza': 8, 'constitucion': 20, 'inteligencia': 5, 'sabiduria': 9, 'carisma': 7},
        'tiradas_salvacion': {'fuerza': 8, 'constitucion': 8},
        'habilidades': {'intimidacion': 4},
        'resistencias': ['veneno', 'contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_estados': ['envenenado'],
        'percepcion_pasiva': 9,
        'especiales': [
            {'nombre': 'Dureza Temible', 'descripcion': 'Se recarga tras descanso corto/largo. Si sufre 14 daño o menos que lo reduciría a 0 PG, queda a 1 PG.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo (solo uno puede ser mordisco). Puede usar Infundir temor en lugar del mordisco.',
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 8, 'alcance_metros': '1,5 m', 'dano': '2d6 + 5', 'tipo_dano': 'perforante'},
            {'nombre': 'Golpetazo', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 8, 'alcance_metros': '3 m', 'dano': '2d4 + 5', 'tipo_dano': 'contundente', 'efecto': 'Si Mediano o menor, queda agarrado (CD 16). Si Pequeño o menor, también apresado.'}
        ],
        'acciones': [
            {'nombre': 'Infundir Temor', 'descripcion': 'Criaturas no muertas vivientes a 18 m se anotan 2 puntos de Sombra. Salvación de Carisma CD 16. Fallo: asustado 1 minuto; fallo por 5+: también aturdido.'}
        ],
        'experiencia': 2300,
        'bonificador_competencia': 3
    },
    {
        'nombre': 'Trol de las Cavernas Furtivo',
        'categoria': 'malignos',
        'tipo': 'Gigante Grande',
        'tamanio': 'Grande',
        'ca': 15,
        'descripcion_armadura': 'armadura natural',
        'pg': 34,
        'dados_golpe': '4d10 + 12',
        'velocidad': 12,
        'atributos': {'fuerza': 17, 'destreza': 10, 'constitucion': 16, 'inteligencia': 5, 'sabiduria': 9, 'carisma': 7},
        'tiradas_salvacion': {'fuerza': 5, 'constitucion': 5},
        'habilidades': {'intimidacion': 2, 'sigilo': 2},
        'resistencias': ['veneno', 'contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_estados': ['envenenado'],
        'percepcion_pasiva': 9,
        'sentidos': ['Percepción pasiva 14 con olfato', 'Visión en la oscuridad 36 m'],
        'especiales': [
            {'nombre': 'Dureza Temible', 'descripcion': 'Se recarga tras descanso corto/largo. Si sufre 7 daño o menos que lo reduciría a 0 PG, queda a 1 PG.'},
            {'nombre': 'Buen Olfato', 'descripcion': 'Tiene ventaja en pruebas de Sabiduría (Percepción) basadas en el olfato.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo: uno con mordisco y otro con gran clava.',
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '2d4 + 3', 'tipo_dano': 'perforante'},
            {'nombre': 'Gran Clava', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '3 m', 'dano': '2d8 + 3', 'tipo_dano': 'contundente', 'efecto': 'Si Mediano o menor, salvación de Fuerza CD 15 o derribado.'}
        ],
        'experiencia': 450,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Trol de Piedra Salteador',
        'categoria': 'malignos',
        'tipo': 'Gigante Grande',
        'tamanio': 'Grande',
        'ca': 14,
        'descripcion_armadura': 'armadura natural',
        'pg': 57,
        'dados_golpe': '6d10 + 24',
        'velocidad': 12,
        'atributos': {'fuerza': 19, 'destreza': 8, 'constitucion': 18, 'inteligencia': 7, 'sabiduria': 7, 'carisma': 7},
        'tiradas_salvacion': {'fuerza': 6, 'constitucion': 6},
        'habilidades': {'intimidacion': 2},
        'resistencias': ['veneno', 'contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_estados': ['envenenado'],
        'percepcion_pasiva': 8,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'especiales': [
            {'nombre': 'Dureza Temible', 'descripcion': 'Se recarga tras descanso corto/largo. Si sufre 7 daño o menos que lo reduciría a 0 PG, queda a 1 PG.'},
            {'nombre': 'Maldición de la Luz del Sol', 'descripcion': 'Queda petrificado si termina su turno a la luz del sol.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo. No puede usar gran clava si tiene a una criatura agarrada.',
        'armas': [
            {'nombre': 'Gran Clava', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '3 m', 'dano': '2d8 + 4', 'tipo_dano': 'contundente', 'efecto': 'Si Mediano o menor, salvación de Fuerza CD 15 o derribado.'},
            {'nombre': 'Golpetazo', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '1,5 m', 'dano': '2d4 + 4', 'tipo_dano': 'contundente', 'efecto': 'Si Mediano o menor, queda agarrado (CD 14). Si Pequeño o menor, también apresado.'}
        ],
        'experiencia': 700,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Trol de Piedra Jefe',
        'categoria': 'malignos',
        'tipo': 'Gigante Grande',
        'tamanio': 'Grande',
        'ca': 14,
        'descripcion_armadura': 'armadura natural',
        'pg': 76,
        'dados_golpe': '8d10 + 32',
        'velocidad': 12,
        'atributos': {'fuerza': 20, 'destreza': 8, 'constitucion': 18, 'inteligencia': 7, 'sabiduria': 7, 'carisma': 8},
        'tiradas_salvacion': {'fuerza': 8, 'constitucion': 7},
        'habilidades': {'intimidacion': 5},
        'resistencias': ['veneno', 'contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_estados': ['envenenado'],
        'percepcion_pasiva': 8,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'especiales': [
            {'nombre': 'Dureza Temible', 'descripcion': 'Se recarga tras descanso corto/largo. Si sufre 14 daño o menos que lo reduciría a 0 PG, queda a 1 PG.'},
            {'nombre': 'Maldición de la Luz del Sol', 'descripcion': 'Queda petrificado si termina su turno a la luz del sol.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo. No puede usar gran clava si tiene a una criatura agarrada.',
        'armas': [
            {'nombre': 'Gran Clava', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 8, 'alcance_metros': '3 m', 'dano': '2d8 + 5', 'tipo_dano': 'contundente', 'efecto': 'Si Mediano o menor, salvación de Fuerza CD 16 o derribado.'},
            {'nombre': 'Golpetazo', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 8, 'alcance_metros': '1,5 m', 'dano': '2d4 + 5', 'tipo_dano': 'contundente', 'efecto': 'Si Mediano o menor, queda agarrado (CD 16). Si Pequeño o menor, también apresado.'}
        ],
        'acciones': [
            {'nombre': 'Aullido de Triunfo', 'descripcion': 'Se recarga tras descanso corto/largo. Criaturas elegidas a 9 m obtienen ventaja en ataques e Intimidación. Puede atacar como acción adicional.'}
        ],
        'experiencia': 1100,
        'bonificador_competencia': 3
    },
    # === GUSANO ESPECTRAL (from gusano.pdf) ===
    {
        'nombre': 'Gusano Espectral',
        'categoria': 'malignos',
        'tipo': 'Muerto Viviente Enorme',
        'tamanio': 'Enorme',
        'ca': 18,
        'descripcion_armadura': 'armadura natural',
        'pg': 200,
        'dados_golpe': '16d12 + 96',
        'velocidad': 12,
        'velocidades_especiales': {'excavar': 9, 'nadar': 9},
        'atributos': {'fuerza': 22, 'destreza': 10, 'constitucion': 22, 'inteligencia': 8, 'sabiduria': 12, 'carisma': 12},
        'tiradas_salvacion': {'fuerza': 10, 'constitucion': 10},
        'habilidades': {'intimidacion': 9, 'percepcion': 9, 'sigilo': 4},
        'resistencias': ['frío', 'necrótico', 'contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_dano': ['veneno'],
        'inmunidades_estados': ['cansancio', 'envenenado', 'hechizado'],
        'percepcion_pasiva': 19,
        'sentidos': ['Visión verdadera 36 m'],
        'idiomas': ['Lengua negra'],
        'desafio': '12 (8,400 PX)',
        'especiales': [
            {'nombre': 'Inmortalidad', 'descripcion': 'Si el daño lo reduce a 0 PG, salvación de Constitución CD 5 + daño sufrido, a menos que sea radiante, crítico o de arma encantada. Éxito: queda a 1 PG.'},
            {'nombre': 'Sensibilidad a la Luz del Sol', 'descripcion': 'Tiene desventaja en tiradas de ataque y pruebas de Sabiduría (Percepción) basadas en la vista bajo la luz del sol.'}
        ],
        'ataque_multiple': 'Puede usar Infundir temor. Luego lleva a cabo cuatro ataques: uno con mordisco, dos con garras y uno con cola. No puede atacar al mismo objetivo con mordisco y cola.',
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 10, 'alcance_metros': '3 m', 'dano': '3d8 + 6', 'tipo_dano': 'perforante'},
            {'nombre': 'Garras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 10, 'alcance_metros': '1,5 m', 'dano': '3d6 + 6', 'tipo_dano': 'cortante', 'efecto': 'Si Mediano o menor, queda agarrado (CD 18).'},
            {'nombre': 'Cola', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 10, 'alcance_metros': '4,5 m', 'dano': '3d4 + 6', 'tipo_dano': 'contundente', 'efecto': 'Salvación de Fuerza CD 18 o derribado.'}
        ],
        'acciones': [
            {'nombre': 'Infundir Temor', 'descripcion': 'Criaturas no muertas vivientes a 36 m se anotan 2 puntos de Sombra. Salvación de Carisma CD 18. Fallo: asustado 1 minuto; fallo por 5+: también aturdido.'}
        ],
        'experiencia': 8400,
        'bonificador_competencia': 4
    },
    # === MORIA (from moria.pdf) ===
    {
        'nombre': 'Orco de Udûn Fanático',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (orco)',
        'tamanio': 'Mediano',
        'ca': 14,
        'descripcion_armadura': 'pieles',
        'pg': 19,
        'dados_golpe': '3d8 + 6',
        'velocidad': 9,
        'atributos': {'fuerza': 14, 'destreza': 14, 'constitucion': 14, 'inteligencia': 8, 'sabiduria': 10, 'carisma': 8},
        'habilidades': {'intimidacion': 1},
        'percepcion_pasiva': 10,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'idiomas': ['Lengua negra', 'orco'],
        'desafio': '1/2 (100 PX)',
        'especiales': [
            {'nombre': 'Debilidad ante la Luz del Sol', 'descripcion': 'Desventaja en tiradas de ataque, pruebas de característica y tiradas de salvación bajo la luz del sol.'},
            {'nombre': 'Devoción Oscura', 'descripcion': 'Ventaja en pruebas y salvaciones para evitar ser hechizado o asustado.'},
            {'nombre': 'Dureza Temible', 'descripcion': 'Se recarga tras descanso corto/largo. Si sufre 7 daño o menos que lo reduciría a 0 PG, queda a 1 PG.'}
        ],
        'armas': [
            {'nombre': 'Bastón-Antorcha', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d6 + 2 / 1d8 + 2 a dos manos + 1d6 fuego', 'tipo_dano': 'contundente', 'dano_extra': '1d6 fuego'}
        ],
        'experiencia': 100,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Orco de Udûn Tocado por el Fuego',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (orco)',
        'tamanio': 'Mediano',
        'ca': 16,
        'descripcion_armadura': 'armadura de escamas',
        'pg': 67,
        'dados_golpe': '9d8 + 27',
        'velocidad': 9,
        'atributos': {'fuerza': 17, 'destreza': 14, 'constitucion': 17, 'inteligencia': 8, 'sabiduria': 10, 'carisma': 10},
        'habilidades': {'intimidacion': 4},
        'resistencias': ['fuego', 'veneno'],
        'inmunidades_estados': ['asustado', 'hechizado'],
        'percepcion_pasiva': 10,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'idiomas': ['Lengua negra', 'orco'],
        'desafio': '3 (700 PX)',
        'especiales': [
            {'nombre': 'Debilidad ante la Luz del Sol', 'descripcion': 'Desventaja en tiradas de ataque, pruebas de característica y tiradas de salvación bajo la luz del sol.'},
            {'nombre': 'Dureza Temible', 'descripcion': 'Se recarga tras descanso corto/largo. Si sufre 7 daño o menos que lo reduciría a 0 PG, queda a 1 PG.'},
            {'nombre': 'Fuerza Horrible', 'descripcion': 'Un arma cuerpo a cuerpo inflige un dado adicional de su daño cuando acierta.'},
            {'nombre': 'Odio Temerario', 'descripcion': 'Al inicio de su turno, puede obtener ventaja en todas las tiradas de ataque cuerpo a cuerpo, pero ataques contra él tienen ventaja.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo.',
        'armas': [
            {'nombre': 'Bastón-Antorcha', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '2d6 + 3 / 2d8 + 3 a dos manos + 1d6 fuego', 'tipo_dano': 'contundente', 'dano_extra': '1d6 fuego'}
        ],
        'experiencia': 700,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Uruk Negro',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (orco)',
        'tamanio': 'Mediano',
        'ca': 16,
        'descripcion_armadura': 'cota de mallas orca, escudo',
        'pg': 32,
        'dados_golpe': '5d8 + 10',
        'velocidad': 9,
        'atributos': {'fuerza': 15, 'destreza': 12, 'constitucion': 15, 'inteligencia': 9, 'sabiduria': 10, 'carisma': 10},
        'habilidades': {'atletismo': 4, 'intimidacion': 2},
        'percepcion_pasiva': 10,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'idiomas': ['Lengua negra', 'orco', 'oestron'],
        'desafio': '1 (200 PX)',
        'especiales': [
            {'nombre': 'Agresividad', 'descripcion': 'Como acción adicional, puede moverse hasta su velocidad hacia una criatura hostil.'},
            {'nombre': 'Fuerza Horrible', 'descripcion': 'Un arma cuerpo a cuerpo inflige un dado adicional de su daño cuando acierta.'}
        ],
        'armas': [
            {'nombre': 'Espada de Hoja Ancha', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '2d8 + 2 / 2d10 + 2 a dos manos', 'tipo_dano': 'cortante'},
            {'nombre': 'Lanza', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '2d6 + 2 / 2d8 + 2 a dos manos', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 200,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Capitán Uruk Negro',
        'categoria': 'malignos',
        'tipo': 'Humanoide Mediano (orco)',
        'tamanio': 'Mediano',
        'ca': 18,
        'descripcion_armadura': 'cota de mallas pesada orca, escudo',
        'pg': 52,
        'dados_golpe': '7d8 + 21',
        'velocidad': 9,
        'atributos': {'fuerza': 16, 'destreza': 12, 'constitucion': 16, 'inteligencia': 10, 'sabiduria': 10, 'carisma': 12},
        'habilidades': {'intimidacion': 3},
        'percepcion_pasiva': 10,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'idiomas': ['Lengua negra', 'orco', 'oestron'],
        'desafio': '3 (700 PX)',
        'especiales': [
            {'nombre': 'Agresividad', 'descripcion': 'Como acción adicional, puede moverse hasta su velocidad hacia una criatura hostil.'},
            {'nombre': 'Fuerza Horrible', 'descripcion': 'Un arma cuerpo a cuerpo inflige un dado adicional de su daño cuando acierta.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo.',
        'armas': [
            {'nombre': 'Espada de Hoja Ancha', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '2d8 + 3 / 2d10 + 3 a dos manos', 'tipo_dano': 'cortante'},
            {'nombre': 'Lanza', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '2d6 + 3 / 2d8 + 3 a dos manos', 'tipo_dano': 'perforante'}
        ],
        'acciones': [
            {'nombre': 'Aullido de Triunfo', 'descripcion': 'Criaturas a 9 m obtienen ventaja en ataques e Intimidación. Puede atacar como acción adicional.'}
        ],
        'experiencia': 700,
        'bonificador_competencia': 2
    },
    # === BALROG ===
    {
        'nombre': 'El Balrog de Moria',
        'categoria': 'especiales',
        'tipo': 'Infernal Grande',
        'tamanio': 'Grande',
        'descripcion': 'El Daño de Durin, un terrible demonio de fuego y sombra',
        'ca': 19,
        'descripcion_armadura': 'armadura natural',
        'pg': 262,
        'dados_golpe': '21d10 + 147',
        'velocidad': 12,
        'atributos': {'fuerza': 26, 'destreza': 15, 'constitucion': 24, 'inteligencia': 17, 'sabiduria': 16, 'carisma': 22},
        'tiradas_salvacion': {'fuerza': 14, 'constitucion': 13, 'inteligencia': 9, 'carisma': 12},
        'habilidades': {'atletismo': 20, 'intimidacion': 18},
        'resistencias': ['frío', 'necrótico'],
        'inmunidades_dano': ['fuego', 'veneno', 'contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_estados': ['asustado', 'cansancio', 'envenenado', 'hechizado'],
        'percepcion_pasiva': 13,
        'sentidos': ['Visión verdadera 36 m'],
        'idiomas': ['Lengua negra', 'telepatía 36 m'],
        'desafio': '19 (22,000 PX)',
        'especiales': [
            {'nombre': 'Llama de Udûn', 'descripcion': 'Al comienzo de cada turno, criaturas a 1,5 m o menos sufren 3d6 daño por fuego. Objetos inflamables se encienden. Tocar o atacar cuerpo a cuerpo a 1,5 m causa 3d6 daño por fuego.'},
            {'nombre': 'Ser Terrorífico', 'descripcion': 'Criaturas elegidas a 36 m sufren 3 puntos de Sombra (Carisma CD 20). Fallo: asustado 1 minuto; fallo por 5+: también aturdido. Inmune 24 horas si tiene éxito.'}
        ],
        'ataque_multiple': 'Usa Ser Terrorífico. Luego dos ataques: espada llameante y látigo. Puede usar Aura de oscuridad en lugar de atacar.',
        'armas': [
            {'nombre': 'Espada Llameante', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 14, 'alcance_metros': '3 m', 'dano': '2d8 + 8 + 4d8 fuego', 'tipo_dano': 'cortante', 'dano_extra': '4d8 fuego'},
            {'nombre': 'Látigo de Muchas Colas', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 14, 'alcance_metros': '6 m', 'dano': '2d4 + 8 + 4d6 fuego', 'tipo_dano': 'cortante', 'dano_extra': '4d6 fuego', 'efecto': 'Salvación de Fuerza CD 20 o arrastrado 4,5 m hacia el Balrog.'}
        ],
        'acciones': [
            {'nombre': 'Aura de Oscuridad', 'descripcion': 'Oscuridad mágica de 9 m de radio que se mueve con él. Dura hasta el final de su siguiente turno. Ninguna luz natural puede iluminarla.'}
        ],
        'reacciones': [
            {'nombre': 'Contraconjuro (3/Día)', 'descripcion': 'Si una criatura a 18 m lanza un conjuro u obtiene éxito mágico, sufre 3 puntos de Sombra (Inteligencia CD 20). Fallo: el conjuro fracasa. Éxito: 5d10 daño por fuerza al objeto.'}
        ],
        'experiencia': 22000,
        'bonificador_competencia': 6
    },
    # === ELFOS PDF - Criaturas especiales ===
    {
        'nombre': 'Morlhoss',
        'categoria': 'especiales',
        'tipo': 'Muerto Viviente Mediano',
        'tamanio': 'Mediano',
        'descripcion': 'Espíritu sin hogar, una presencia malévola que atormentaba a los elfos',
        'ca': 13,
        'pg': 39,
        'dados_golpe': '6d8 + 12',
        'velocidad': 9,
        'velocidades_especiales': {'volar': 9},
        'atributos': {'fuerza': 1, 'destreza': 16, 'constitucion': 14, 'inteligencia': 10, 'sabiduria': 14, 'carisma': 16},
        'habilidades': {'percepcion': 8, 'sigilo': 6},
        'resistencias': ['radiante', 'contundente, perforante y cortante de armas no encantadas para muertos vivientes'],
        'inmunidades_dano': ['frío', 'necrótico', 'veneno'],
        'inmunidades_estados': ['encantado', 'agotamiento', 'apresado', 'paralizado', 'petrificado', 'envenenado', 'tumbado', 'restringido'],
        'percepcion_pasiva': 18,
        'sentidos': ['Visión verdadera 36 m'],
        'idiomas': ['Lengua Negra', 'Sindarin', 'Oestron'],
        'desafio': '5 (1,800 PX)',
        'especiales': [
            {'nombre': 'Incorpóreo', 'descripcion': 'Puede moverse a través de criaturas y objetos como terreno difícil. Sufre 1d10 daño de fuerza si termina turno dentro de un objeto.'},
            {'nombre': 'Invisibilidad', 'descripcion': 'Es invisible. Se vuelve visible 1 minuto si alguien obtiene éxito mágico en Sabiduría (Percepción).'},
            {'nombre': 'Muerte Inevitable', 'descripcion': 'Si cae a 0 PG, salvación de Constitución CD 5 + daño. Éxito: queda a 1 PG (excepto armas encantadas).'},
            {'nombre': 'Espíritu Inmortal', 'descripcion': 'Si es destruido, reaparece en 1d10 años con todos sus PG.'}
        ],
        'acciones': [
            {'nombre': 'Conjuro de Sueño (Recarga 6)', 'descripcion': 'Hasta 3 criaturas a 18 m ganan 1 punto de Sombra (Inteligencia CD 14). Fallo: dormido e inconsciente 1 minuto. Elfos y Magos son inmunes.'},
            {'nombre': 'Visiones de Tormento', 'descripcion': 'Una criatura a 18 m gana 3 puntos de Sombra (Carisma CD 14). Fallo: 4d10 daño psíquico y asustado. Fallo por 5+: también aturdido.'}
        ],
        'experiencia': 1800,
        'bonificador_competencia': 3
    },
    {
        'nombre': 'Cauthlin',
        'categoria': 'especiales',
        'tipo': 'Fey Mediano (cambiaformas)',
        'tamanio': 'Mediano',
        'descripcion': 'El Espíritu de la Comadreja, una criatura feérica engañosa y peligrosa',
        'ca': 19,
        'descripcion_armadura': 'armadura natural',
        'pg': 97,
        'dados_golpe': '13d8 + 39',
        'velocidad': 15,
        'atributos': {'fuerza': 16, 'destreza': 21, 'constitucion': 16, 'inteligencia': 17, 'sabiduria': 14, 'carisma': 18},
        'habilidades': {'engano': 12, 'perspicacia': 6, 'percepcion': 10, 'acertijo': 7, 'sigilo': 9},
        'inmunidades_dano': ['contundente, perforante y cortante de armas no mágicas'],
        'inmunidades_estados': ['encantado', 'agotamiento'],
        'percepcion_pasiva': 20,
        'sentidos': ['Visión verdadera 36 m'],
        'idiomas': ['Lengua Negra', 'Sindarin', 'Oestron'],
        'desafio': '8 (3,900 PX)',
        'especiales': [
            {'nombre': 'Espíritu Inmortal', 'descripcion': 'Si muere, obtiene nuevo cuerpo en 1d10 días (excepto si muere por la Daga Negra Metacharn).'},
            {'nombre': 'Cambiaformas', 'descripcion': 'Puede transformarse en humanoide Pequeño/Mediano o bestia cuadrúpeda Diminuta/Pequeña/Mediana.'},
            {'nombre': 'Ataque Furtivo (1/turno)', 'descripcion': 'Inflige 3d6 daño adicional con ventaja o aliado cerca del objetivo.'}
        ],
        'ataque_multiple': 'En forma de bestia: dos ataques de desgarro. En forma humanoide: dos ataques. Puede usar Conjuros de Engaño en lugar de un ataque.',
        'armas': [
            {'nombre': 'Desgarro (forma bestia)', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 7, 'alcance_metros': '1,5 m', 'dano': '2d6 + 3', 'tipo_dano': 'cortante', 'efecto': 'Si Mediano o menor, Fuerza CD 15 o derribado.'},
            {'nombre': 'Gran Arco (forma humana)', 'tipo': 'distancia', 'bonificador_impacto': 9, 'alcance_metros': '45/180 m', 'dano': '1d8 + 5 + 1d8 veneno', 'tipo_dano': 'perforante', 'dano_extra': '1d8 veneno'},
            {'nombre': 'Gran Lanza (forma humana)', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 7, 'alcance_metros': '3 m', 'dano': '1d10 + 3 + 1d8 veneno', 'tipo_dano': 'perforante', 'dano_extra': '1d8 veneno'}
        ],
        'acciones': [
            {'nombre': 'Invisibilidad', 'descripcion': 'Se vuelve invisible hasta que ataca o usa Conjuros de Engaño.'},
            {'nombre': 'Conjuros de Engaño', 'descripcion': 'Una criatura a 9 m gana 2 puntos de Sombra de Hechicería (Inteligencia CD 16). Fallo: encantado hasta el final de su siguiente turno.'}
        ],
        'reacciones': [
            {'nombre': 'Redirigir Ataque', 'descripcion': 'Si una criatura encantada golpea a 18 m, puede redirigir el ataque a otra criatura a 1,5 m del objetivo.'}
        ],
        'experiencia': 3900,
        'bonificador_competencia': 4
    },
    {
        'nombre': 'Daegûr',
        'categoria': 'especiales',
        'tipo': 'Monstruosidad Enorme',
        'tamanio': 'Enorme',
        'descripcion': 'La Sombra de la Muerte, un terrible depredador alado',
        'ca': 15,
        'descripcion_armadura': 'armadura natural',
        'pg': 168,
        'dados_golpe': '16d12 + 64',
        'velocidad': 6,
        'velocidades_especiales': {'volar': 36},
        'atributos': {'fuerza': 21, 'destreza': 10, 'constitucion': 18, 'inteligencia': 6, 'sabiduria': 12, 'carisma': 9},
        'tiradas_salvacion': {'constitucion': 7},
        'habilidades': {'percepcion': 4},
        'percepcion_pasiva': 14,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'idiomas': ['Entiende Lengua Negra pero no puede hablar'],
        'desafio': '7 (3,900 PX)',
        'especiales': [
            {'nombre': 'Vista y Olfato Agudos', 'descripcion': 'Tiene ventaja en pruebas de Sabiduría (Percepción) basadas en la vista o el olfato.'}
        ],
        'ataque_multiple': 'Dos ataques: uno con pico y otro con garras.',
        'armas': [
            {'nombre': 'Pico', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 8, 'alcance_metros': '1,5 m', 'dano': '3d8 + 5', 'tipo_dano': 'perforante'},
            {'nombre': 'Garras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 8, 'alcance_metros': '3 m', 'dano': '3d6 + 5', 'tipo_dano': 'cortante', 'efecto': 'El objetivo queda apresado (CD 16). Mientras dure, queda restringido.'}
        ],
        'experiencia': 3900,
        'bonificador_competencia': 3
    }
]


async def load_npcs():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    print("Loading NPCs with new structured data model...")
    
    # Clear existing data
    await db.npcs.delete_many({})
    
    # Process and insert all NPCs
    all_npcs = []
    for npc_data in NPCS_DATA:
        npc = create_npc(
            nombre=npc_data['nombre'],
            categoria=npc_data.get('categoria', 'malignos'),
            data=npc_data
        )
        all_npcs.append(npc)
    
    if all_npcs:
        await db.npcs.insert_many(all_npcs)
    
    # Count by category
    counts = {'malignos': 0, 'pnj': 0, 'animales': 0, 'especiales': 0}
    for npc in all_npcs:
        cat = npc.get('categoria', 'especiales')
        if cat in counts:
            counts[cat] += 1
    
    print(f"Loaded {len(all_npcs)} NPCs:")
    for cat, count in counts.items():
        print(f"  - {cat}: {count}")
    
    return all_npcs


if __name__ == "__main__":
    asyncio.run(load_npcs())
