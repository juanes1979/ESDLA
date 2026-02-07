"""
Script to load PNJ, Animals, and Bosque Negro creatures into MongoDB
Converts The One Ring stats to D&D 5e format
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
import uuid

load_dotenv('.env')

def now_utc():
    return datetime.now(timezone.utc).isoformat()

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
        'clase_armadura': data.get('ca', 10),
        'descripcion_armadura': data.get('descripcion_armadura', ''),
        'puntos_golpe': data.get('pg', 1),
        'dados_golpe': data.get('dados_golpe', ''),
        'velocidad': data.get('velocidad', 9),
        'velocidades_especiales': data.get('velocidades_especiales'),
        'atributos': data.get('atributos', {
            'fuerza': 10, 'destreza': 10, 'constitucion': 10,
            'inteligencia': 10, 'sabiduria': 10, 'carisma': 10
        }),
        'tiradas_salvacion': data.get('tiradas_salvacion'),
        'habilidades': data.get('habilidades'),
        'percepcion_pasiva': data.get('percepcion_pasiva', 10),
        'resistencias': data.get('resistencias', []),
        'inmunidades_dano': data.get('inmunidades_dano', []),
        'inmunidades_estados': data.get('inmunidades_estados', []),
        'vulnerabilidades': data.get('vulnerabilidades', []),
        'sentidos': data.get('sentidos', []),
        'idiomas': data.get('idiomas', []),
        'desafio': data.get('desafio', ''),
        'experiencia': data.get('experiencia', 0),
        'bonificador_competencia': data.get('bonificador_competencia', 2),
        'especiales': data.get('especiales', []),
        'armas': data.get('armas', []),
        'acciones': data.get('acciones', []),
        'ataque_multiple': data.get('ataque_multiple', ''),
        'reacciones': data.get('reacciones', []),
        'acciones_legendarias': data.get('acciones_legendarias', []),
        'historia': '',
        'created_at': now_utc(),
        'updated_at': now_utc()
    }
    return npc

# ========== PNJ DATA ==========
PNJ_DATA = [
    {
        'nombre': 'Frontero',
        'categoria': 'pnj',
        'descripcion': 'Un frontero es un guardia hobbit que está preparado para enfrentarse a los peligros que puedan surgir en la Comarca o sus alrededores.',
        'tipo': 'Humanoide Pequeño (hobbit)',
        'tamanio': 'Pequeño',
        'alineamiento': 'Neutral bueno',
        'ca': 12,
        'descripcion_armadura': 'cuero',
        'pg': 16,
        'dados_golpe': '3d6 + 6',
        'velocidad': 7.5,
        'atributos': {'fuerza': 10, 'destreza': 14, 'constitucion': 14, 'inteligencia': 10, 'sabiduria': 13, 'carisma': 11},
        'habilidades': {'percepcion': 3, 'sigilo': 4},
        'percepcion_pasiva': 13,
        'especiales': [
            {'nombre': 'Buen Sentido Hobbit', 'descripcion': 'Tiene ventaja en las tiradas de salvación de Inteligencia, Sabiduría y Carisma contra efectos de la Sombra.'},
            {'nombre': 'Valiente', 'descripcion': 'Tiene ventaja en las tiradas de salvación contra ser asustado.'}
        ],
        'armas': [
            {'nombre': 'Gran Clava', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 3, 'alcance_metros': '1,5 m', 'dano': '1d8 + 1', 'tipo_dano': 'contundente'},
            {'nombre': 'Daga', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '1d4 + 2', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 50,
        'desafio': '1/4 (50 PX)'
    },
    {
        'nombre': 'Guardia de la Comarca',
        'categoria': 'pnj',
        'descripcion': 'Un hobbit voluntario que patrulla los caminos y aldeas de la Comarca, más preocupado por mantener el orden que por enfrentarse a verdaderos peligros.',
        'tipo': 'Humanoide Pequeño (hobbit)',
        'tamanio': 'Pequeño',
        'alineamiento': 'Neutral bueno',
        'ca': 10,
        'pg': 9,
        'dados_golpe': '2d6 + 2',
        'velocidad': 7.5,
        'atributos': {'fuerza': 10, 'destreza': 10, 'constitucion': 12, 'inteligencia': 10, 'sabiduria': 12, 'carisma': 11},
        'habilidades': {'percepcion': 3},
        'percepcion_pasiva': 11,
        'especiales': [
            {'nombre': 'Buen Sentido Hobbit', 'descripcion': 'Tiene ventaja en las tiradas de salvación de Inteligencia, Sabiduría y Carisma contra efectos de la Sombra.'}
        ],
        'armas': [
            {'nombre': 'Bastón Corto', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 2, 'alcance_metros': '1,5 m', 'dano': '1d6', 'tipo_dano': 'contundente'}
        ],
        'acciones': [
            {'nombre': 'Advertencia Firme', 'descripcion': 'Puede usar su acción para intimidar a un enemigo menor. El objetivo debe superar Sabiduría CD 10 o no puede atacar durante 1 turno.'}
        ],
        'experiencia': 25,
        'desafio': '1/8 (25 PX)'
    },
    {
        'nombre': 'Cazador de la Comarca',
        'categoria': 'pnj',
        'descripcion': 'Un hobbit que se aventura más allá de los límites de la Comarca para cazar animales pequeños y recolectar hierbas raras.',
        'tipo': 'Humanoide Pequeño (hobbit)',
        'tamanio': 'Pequeño',
        'alineamiento': 'Neutral',
        'ca': 13,
        'descripcion_armadura': 'cuero',
        'pg': 14,
        'dados_golpe': '4d6',
        'velocidad': 7.5,
        'atributos': {'fuerza': 10, 'destreza': 15, 'constitucion': 10, 'inteligencia': 11, 'sabiduria': 14, 'carisma': 10},
        'habilidades': {'percepcion': 4, 'supervivencia': 4, 'sigilo': 4},
        'percepcion_pasiva': 14,
        'especiales': [
            {'nombre': 'Rastreador Experto', 'descripcion': 'Tiene ventaja en tiradas de Sabiduría (Supervivencia) para rastrear criaturas pequeñas.'}
        ],
        'armas': [
            {'nombre': 'Arco Corto', 'tipo': 'distancia', 'bonificador_impacto': 4, 'alcance_metros': '24/96 m', 'dano': '1d6 + 2', 'tipo_dano': 'perforante'},
            {'nombre': 'Daga', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d4 + 2', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 50,
        'desafio': '1/4 (50 PX)'
    },
    {
        'nombre': 'Jinete de Rohan',
        'categoria': 'pnj',
        'descripcion': 'Un guerrero montado, entrenado desde joven para proteger las tierras de Rohan de incursiones de orcos y bandidos.',
        'tipo': 'Humanoide Mediano (humano)',
        'tamanio': 'Mediano',
        'alineamiento': 'Legal bueno',
        'ca': 14,
        'descripcion_armadura': 'cota de anillas',
        'pg': 26,
        'dados_golpe': '4d8 + 8',
        'velocidad': 9,
        'atributos': {'fuerza': 14, 'destreza': 12, 'constitucion': 14, 'inteligencia': 10, 'sabiduria': 11, 'carisma': 12},
        'habilidades': {'trato_con_animales': 3, 'percepcion': 2},
        'percepcion_pasiva': 12,
        'especiales': [
            {'nombre': 'Carga Montada', 'descripcion': 'Si ataca mientras está montado y se mueve al menos 6 m en línea recta, inflige 1d8 de daño adicional.'}
        ],
        'armas': [
            {'nombre': 'Lanza', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '1d8 + 2', 'tipo_dano': 'perforante'},
            {'nombre': 'Espada Corta', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d6 + 2', 'tipo_dano': 'cortante'}
        ],
        'experiencia': 100,
        'desafio': '1/2 (100 PX)'
    },
    {
        'nombre': 'Pastor de los Valles',
        'categoria': 'pnj',
        'descripcion': 'Un habitante de las tierras bajas de Rohan, dedicado al pastoreo de ovejas y caballos. Aunque no es un guerrero, sabe defenderse de lobos y bandidos.',
        'tipo': 'Humanoide Mediano (humano)',
        'tamanio': 'Mediano',
        'alineamiento': 'Neutral',
        'ca': 11,
        'pg': 11,
        'dados_golpe': '2d8 + 2',
        'velocidad': 9,
        'atributos': {'fuerza': 12, 'destreza': 10, 'constitucion': 12, 'inteligencia': 10, 'sabiduria': 13, 'carisma': 10},
        'habilidades': {'trato_con_animales': 3, 'percepcion': 3},
        'percepcion_pasiva': 13,
        'especiales': [
            {'nombre': 'Defensor del Rebaño', 'descripcion': 'Tiene ventaja en tiradas de ataque contra criaturas que amenacen a sus animales.'}
        ],
        'armas': [
            {'nombre': 'Cayado de Pastor', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 3, 'alcance_metros': '1,5 m', 'dano': '1d6 + 1', 'tipo_dano': 'contundente'},
            {'nombre': 'Honda', 'tipo': 'distancia', 'bonificador_impacto': 2, 'alcance_metros': '9/36 m', 'dano': '1d4', 'tipo_dano': 'contundente'}
        ],
        'experiencia': 25,
        'desafio': '1/8 (25 PX)'
    },
    {
        'nombre': 'Montaraz del Norte',
        'categoria': 'pnj',
        'descripcion': 'Un dúnedain que patrulla las tierras salvajes de Eriador, protegiendo a los habitantes de la región de amenazas como orcos, lobos y bandidos.',
        'tipo': 'Humanoide Mediano (humano, dúnedain)',
        'tamanio': 'Mediano',
        'alineamiento': 'Legal bueno',
        'ca': 15,
        'descripcion_armadura': 'cota de anillas, escudo',
        'pg': 39,
        'dados_golpe': '6d8 + 12',
        'velocidad': 9,
        'atributos': {'fuerza': 14, 'destreza': 14, 'constitucion': 14, 'inteligencia': 12, 'sabiduria': 15, 'carisma': 11},
        'habilidades': {'percepcion': 4, 'supervivencia': 4, 'sigilo': 4, 'naturaleza': 3},
        'percepcion_pasiva': 14,
        'especiales': [
            {'nombre': 'Cazador de la Sombra', 'descripcion': 'Tiene ventaja en tiradas de ataque contra criaturas corruptas por la Sombra (orcos, trolls, espectros).'},
            {'nombre': 'Sangre de Númenor', 'descripcion': 'Tiene ventaja en tiradas de salvación contra ser hechizado o asustado.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques cuerpo a cuerpo o dos ataques a distancia.',
        'armas': [
            {'nombre': 'Espada Larga', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d8 + 2', 'tipo_dano': 'cortante'},
            {'nombre': 'Arco Largo', 'tipo': 'distancia', 'bonificador_impacto': 4, 'alcance_metros': '45/180 m', 'dano': '1d8 + 2', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 200,
        'desafio': '1 (200 PX)'
    },
    {
        'nombre': 'Comerciante Errante',
        'categoria': 'pnj',
        'descripcion': 'Un viajero que recorre los caminos de Eriador, comerciando bienes y llevando noticias entre aldeas y ciudades.',
        'tipo': 'Humanoide Mediano (humano)',
        'tamanio': 'Mediano',
        'alineamiento': 'Neutral',
        'ca': 11,
        'pg': 9,
        'dados_golpe': '2d8',
        'velocidad': 9,
        'atributos': {'fuerza': 10, 'destreza': 12, 'constitucion': 10, 'inteligencia': 12, 'sabiduria': 11, 'carisma': 14},
        'habilidades': {'persuasion': 4, 'perspicacia': 2, 'percepcion': 2},
        'percepcion_pasiva': 12,
        'especiales': [
            {'nombre': 'Astucia Comercial', 'descripcion': 'Tiene ventaja en tiradas de Carisma (Persuasión) para negociar precios o evitar conflictos.'}
        ],
        'armas': [
            {'nombre': 'Daga', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 3, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '1d4 + 1', 'tipo_dano': 'perforante'},
            {'nombre': 'Honda', 'tipo': 'distancia', 'bonificador_impacto': 3, 'alcance_metros': '9/36 m', 'dano': '1d4 + 1', 'tipo_dano': 'contundente'}
        ],
        'experiencia': 25,
        'desafio': '1/8 (25 PX)'
    },
    {
        'nombre': 'Explorador Enano',
        'categoria': 'pnj',
        'descripcion': 'Un enano que recorre las Montañas Nubladas en busca de minerales, tesoros perdidos o rutas seguras para su pueblo.',
        'tipo': 'Humanoide Mediano (enano)',
        'tamanio': 'Mediano',
        'alineamiento': 'Neutral bueno',
        'ca': 14,
        'descripcion_armadura': 'cota de anillas',
        'pg': 30,
        'dados_golpe': '4d8 + 12',
        'velocidad': 7.5,
        'atributos': {'fuerza': 14, 'destreza': 10, 'constitucion': 16, 'inteligencia': 11, 'sabiduria': 13, 'carisma': 10},
        'habilidades': {'percepcion': 3, 'historia': 2, 'supervivencia': 3},
        'percepcion_pasiva': 13,
        'resistencias': ['veneno'],
        'especiales': [
            {'nombre': 'Resistencia Enana', 'descripcion': 'Tiene ventaja en tiradas de salvación contra venenos y resistencia al daño por veneno.'},
            {'nombre': 'Visión en la Oscuridad', 'descripcion': 'Puede ver en la oscuridad hasta 18 m como si fuera luz tenue.'}
        ],
        'sentidos': ['Visión en la oscuridad 18 m'],
        'armas': [
            {'nombre': 'Hacha de Batalla', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d8 + 2 / 1d10 + 2 a dos manos', 'tipo_dano': 'cortante'},
            {'nombre': 'Martillo de Guerra', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d8 + 2', 'tipo_dano': 'contundente'}
        ],
        'experiencia': 100,
        'desafio': '1/2 (100 PX)'
    },
    {
        'nombre': 'Centinela Élfico',
        'categoria': 'pnj',
        'descripcion': 'Un elfo que protege los límites de Lothlórien, vigilando los caminos y asegurándose de que ningún intruso amenace su hogar.',
        'tipo': 'Humanoide Mediano (elfo)',
        'tamanio': 'Mediano',
        'alineamiento': 'Legal bueno',
        'ca': 15,
        'descripcion_armadura': 'cota de mallas élfica',
        'pg': 33,
        'dados_golpe': '6d8 + 6',
        'velocidad': 10.5,
        'atributos': {'fuerza': 12, 'destreza': 17, 'constitucion': 12, 'inteligencia': 12, 'sabiduria': 14, 'carisma': 13},
        'habilidades': {'percepcion': 6, 'sigilo': 5, 'naturaleza': 3},
        'percepcion_pasiva': 16,
        'sentidos': ['Visión en la oscuridad 18 m'],
        'especiales': [
            {'nombre': 'Gracia Élfica', 'descripcion': 'Tiene ventaja en tiradas de salvación contra efectos de miedo y encantamiento.'},
            {'nombre': 'Sentidos Agudos', 'descripcion': 'Tiene competencia en Percepción.'},
            {'nombre': 'Trance', 'descripcion': 'No necesita dormir, solo meditar 4 horas.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques con arco o espada.',
        'armas': [
            {'nombre': 'Espada Élfica', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d8 + 3', 'tipo_dano': 'cortante'},
            {'nombre': 'Arco Largo Élfico', 'tipo': 'distancia', 'bonificador_impacto': 5, 'alcance_metros': '45/180 m', 'dano': '1d8 + 3', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 200,
        'desafio': '1 (200 PX)'
    }
]

# ========== ANIMALES DATA ==========
ANIMALES_DATA = [
    {
        'nombre': 'Águila',
        'categoria': 'animales',
        'descripcion': 'Ave rapaz con gran capacidad de vuelo.',
        'tipo': 'Bestia Pequeña',
        'tamanio': 'Pequeño',
        'ca': 12,
        'pg': 3,
        'dados_golpe': '1d6',
        'velocidad': 3,
        'velocidades_especiales': {'volar': 18},
        'atributos': {'fuerza': 6, 'destreza': 15, 'constitucion': 10, 'inteligencia': 2, 'sabiduria': 14, 'carisma': 7},
        'habilidades': {'percepcion': 4},
        'percepcion_pasiva': 14,
        'especiales': [
            {'nombre': 'Vista Aguda', 'descripcion': 'Tiene ventaja en las pruebas de Sabiduría (Percepción) basadas en la vista.'}
        ],
        'armas': [
            {'nombre': 'Garras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d4 + 2', 'tipo_dano': 'cortante'}
        ],
        'experiencia': 10,
        'desafio': '0 (10 PX)'
    },
    {
        'nombre': 'Lobo',
        'categoria': 'animales',
        'descripcion': 'Cazador social que vive en manadas.',
        'tipo': 'Bestia Mediana',
        'tamanio': 'Mediano',
        'ca': 13,
        'descripcion_armadura': 'armadura natural',
        'pg': 11,
        'dados_golpe': '2d8 + 2',
        'velocidad': 12,
        'atributos': {'fuerza': 12, 'destreza': 15, 'constitucion': 12, 'inteligencia': 3, 'sabiduria': 12, 'carisma': 6},
        'habilidades': {'percepcion': 3, 'sigilo': 4},
        'percepcion_pasiva': 13,
        'especiales': [
            {'nombre': 'Buen Oído y Olfato', 'descripcion': 'Tiene ventaja en las pruebas de Sabiduría (Percepción) basadas en el oído o el olfato.'},
            {'nombre': 'Tácticas de Manada', 'descripcion': 'Tiene ventaja en una tirada de ataque contra una criatura si al menos uno de sus aliados está situado a 1,5 m o menos de la criatura.'}
        ],
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '2d4 + 2', 'tipo_dano': 'perforante', 'efecto': 'El objetivo debe superar salvación de Fuerza CD 11 o queda derribado.'}
        ],
        'experiencia': 50,
        'desafio': '1/4 (50 PX)'
    },
    {
        'nombre': 'Caballo',
        'categoria': 'animales',
        'descripcion': 'Herbívoro grande, rápido y resistente.',
        'tipo': 'Bestia Grande',
        'tamanio': 'Grande',
        'ca': 10,
        'pg': 13,
        'dados_golpe': '2d10 + 2',
        'velocidad': 18,
        'atributos': {'fuerza': 16, 'destreza': 10, 'constitucion': 12, 'inteligencia': 2, 'sabiduria': 11, 'carisma': 7},
        'percepcion_pasiva': 10,
        'armas': [
            {'nombre': 'Pezuñas', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '2d4 + 3', 'tipo_dano': 'contundente'}
        ],
        'experiencia': 50,
        'desafio': '1/4 (50 PX)'
    },
    {
        'nombre': 'Caballo de Guerra',
        'categoria': 'animales',
        'descripcion': 'Equino entrenado para combate, fuerte y valiente.',
        'tipo': 'Bestia Grande',
        'tamanio': 'Grande',
        'ca': 11,
        'pg': 19,
        'dados_golpe': '3d10 + 3',
        'velocidad': 18,
        'atributos': {'fuerza': 18, 'destreza': 12, 'constitucion': 13, 'inteligencia': 2, 'sabiduria': 12, 'carisma': 7},
        'percepcion_pasiva': 11,
        'especiales': [
            {'nombre': 'Carga Arrolladora', 'descripcion': 'Si se mueve al menos 6 m en línea recta y acierta con pezuñas, el objetivo debe superar Fuerza CD 14 o queda derribado.'}
        ],
        'armas': [
            {'nombre': 'Pezuñas', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '1,5 m', 'dano': '2d6 + 4', 'tipo_dano': 'contundente'}
        ],
        'experiencia': 100,
        'desafio': '1/2 (100 PX)'
    },
    {
        'nombre': 'Huargo',
        'categoria': 'animales',
        'descripcion': 'Lobo gigante, ágil y feroz, a menudo utilizado como montura por orcos.',
        'tipo': 'Bestia Grande',
        'tamanio': 'Grande',
        'ca': 13,
        'descripcion_armadura': 'armadura natural',
        'pg': 26,
        'dados_golpe': '4d10 + 4',
        'velocidad': 15,
        'atributos': {'fuerza': 16, 'destreza': 13, 'constitucion': 13, 'inteligencia': 7, 'sabiduria': 11, 'carisma': 8},
        'habilidades': {'percepcion': 4, 'sigilo': 3},
        'percepcion_pasiva': 14,
        'especiales': [
            {'nombre': 'Buen Oído y Olfato', 'descripcion': 'Tiene ventaja en las pruebas de Sabiduría (Percepción) basadas en el oído o el olfato.'}
        ],
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '2d6 + 3', 'tipo_dano': 'perforante', 'efecto': 'Si el objetivo es una criatura, debe superar salvación de Fuerza CD 13 o queda derribado.'}
        ],
        'experiencia': 100,
        'desafio': '1/2 (100 PX)'
    },
    {
        'nombre': 'Oso',
        'categoria': 'animales',
        'descripcion': 'Gran mamífero omnívoro, fuerte y resistente.',
        'tipo': 'Bestia Grande',
        'tamanio': 'Grande',
        'ca': 11,
        'descripcion_armadura': 'armadura natural',
        'pg': 34,
        'dados_golpe': '4d10 + 12',
        'velocidad': 12,
        'velocidades_especiales': {'trepar': 9},
        'atributos': {'fuerza': 19, 'destreza': 10, 'constitucion': 16, 'inteligencia': 2, 'sabiduria': 13, 'carisma': 7},
        'habilidades': {'percepcion': 3},
        'percepcion_pasiva': 13,
        'especiales': [
            {'nombre': 'Buen Olfato', 'descripcion': 'Tiene ventaja en las pruebas de Sabiduría (Percepción) basadas en el olfato.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques: uno con mordisco y otro con garras.',
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '1,5 m', 'dano': '1d8 + 4', 'tipo_dano': 'perforante'},
            {'nombre': 'Garras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '1,5 m', 'dano': '2d6 + 4', 'tipo_dano': 'cortante'}
        ],
        'experiencia': 200,
        'desafio': '1 (200 PX)'
    },
    {
        'nombre': 'Ciervo',
        'categoria': 'animales',
        'descripcion': 'Herbívoro ágil y rápido, con cuernos defensivos.',
        'tipo': 'Bestia Mediana',
        'tamanio': 'Mediano',
        'ca': 13,
        'pg': 4,
        'dados_golpe': '1d8',
        'velocidad': 15,
        'atributos': {'fuerza': 11, 'destreza': 16, 'constitucion': 11, 'inteligencia': 2, 'sabiduria': 14, 'carisma': 5},
        'percepcion_pasiva': 14,
        'armas': [
            {'nombre': 'Cornamenta', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 2, 'alcance_metros': '1,5 m', 'dano': '1d6', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 10,
        'desafio': '0 (10 PX)'
    },
    {
        'nombre': 'Jabalí',
        'categoria': 'animales',
        'descripcion': 'Cerdo salvaje agresivo y resistente.',
        'tipo': 'Bestia Mediana',
        'tamanio': 'Mediano',
        'ca': 11,
        'descripcion_armadura': 'armadura natural',
        'pg': 11,
        'dados_golpe': '2d8 + 2',
        'velocidad': 12,
        'atributos': {'fuerza': 13, 'destreza': 11, 'constitucion': 12, 'inteligencia': 2, 'sabiduria': 9, 'carisma': 5},
        'percepcion_pasiva': 9,
        'especiales': [
            {'nombre': 'Carga', 'descripcion': 'Si se mueve al menos 6 m en línea recta y acierta con colmillos, inflige 1d6 daño adicional.'},
            {'nombre': 'Dureza Implacable', 'descripcion': 'Si sufre 7 daño o menos que lo reduciría a 0 PG, queda a 1 PG.'}
        ],
        'armas': [
            {'nombre': 'Colmillos', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 3, 'alcance_metros': '1,5 m', 'dano': '1d6 + 1', 'tipo_dano': 'cortante'}
        ],
        'experiencia': 50,
        'desafio': '1/4 (50 PX)'
    },
    {
        'nombre': 'León',
        'categoria': 'animales',
        'descripcion': 'Depredador social, conocido como el rey de la selva.',
        'tipo': 'Bestia Grande',
        'tamanio': 'Grande',
        'ca': 12,
        'pg': 26,
        'dados_golpe': '4d10 + 4',
        'velocidad': 15,
        'atributos': {'fuerza': 17, 'destreza': 15, 'constitucion': 13, 'inteligencia': 3, 'sabiduria': 12, 'carisma': 8},
        'habilidades': {'percepcion': 3, 'sigilo': 6},
        'percepcion_pasiva': 13,
        'especiales': [
            {'nombre': 'Buen Olfato', 'descripcion': 'Tiene ventaja en las pruebas de Sabiduría (Percepción) basadas en el olfato.'},
            {'nombre': 'Tácticas de Manada', 'descripcion': 'Tiene ventaja en ataques si un aliado está a 1,5 m del objetivo.'},
            {'nombre': 'Salto', 'descripcion': 'Con carrera de 3 m, puede saltar 7,5 m.'}
        ],
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d8 + 3', 'tipo_dano': 'perforante'},
            {'nombre': 'Garras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d6 + 3', 'tipo_dano': 'cortante'}
        ],
        'experiencia': 200,
        'desafio': '1 (200 PX)'
    },
    {
        'nombre': 'Araña Gigante',
        'categoria': 'animales',
        'descripcion': 'Arácnido venenoso de gran tamaño.',
        'tipo': 'Bestia Grande',
        'tamanio': 'Grande',
        'ca': 14,
        'descripcion_armadura': 'armadura natural',
        'pg': 26,
        'dados_golpe': '4d10 + 4',
        'velocidad': 9,
        'velocidades_especiales': {'trepar': 9},
        'atributos': {'fuerza': 14, 'destreza': 16, 'constitucion': 12, 'inteligencia': 2, 'sabiduria': 11, 'carisma': 4},
        'habilidades': {'sigilo': 7},
        'percepcion_pasiva': 10,
        'sentidos': ['Visión ciega 3 m', 'Visión en la oscuridad 18 m'],
        'especiales': [
            {'nombre': 'Trepar Arañas', 'descripcion': 'Puede trepar por superficies difíciles sin necesidad de prueba.'},
            {'nombre': 'Sentido de Telarañas', 'descripcion': 'Conoce la ubicación de cualquier criatura en contacto con sus telarañas.'}
        ],
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d8 + 3', 'tipo_dano': 'perforante', 'efecto': 'El objetivo debe superar Constitución CD 11 o sufre 2d8 daño por veneno. Si falla por 5 o más, queda envenenado y paralizado 1 hora.'}
        ],
        'acciones': [
            {'nombre': 'Telaraña', 'descripcion': 'Distancia 9/18 m. El objetivo queda apresado (escapar CD 12). Puede atacar la telaraña (CA 10, 5 PG, vulnerable a fuego).'}
        ],
        'experiencia': 200,
        'desafio': '1 (200 PX)'
    },
    {
        'nombre': 'Murciélago Gigante',
        'categoria': 'animales',
        'descripcion': 'Criatura voladora nocturna, depredador silencioso.',
        'tipo': 'Bestia Grande',
        'tamanio': 'Grande',
        'ca': 13,
        'pg': 22,
        'dados_golpe': '4d10',
        'velocidad': 3,
        'velocidades_especiales': {'volar': 18},
        'atributos': {'fuerza': 15, 'destreza': 16, 'constitucion': 11, 'inteligencia': 2, 'sabiduria': 12, 'carisma': 6},
        'percepcion_pasiva': 11,
        'sentidos': ['Visión ciega 18 m'],
        'especiales': [
            {'nombre': 'Ecolocación', 'descripcion': 'No puede usar su visión ciega mientras esté ensordecido.'},
            {'nombre': 'Oído Agudo', 'descripcion': 'Tiene ventaja en las pruebas de Sabiduría (Percepción) basadas en el oído.'}
        ],
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d6 + 2', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 100,
        'desafio': '1/4 (50 PX)'
    },
    {
        'nombre': 'Serpiente Venenosa',
        'categoria': 'animales',
        'descripcion': 'Reptil venenoso que caza al acecho.',
        'tipo': 'Bestia Diminuta',
        'tamanio': 'Diminuto',
        'ca': 13,
        'pg': 2,
        'dados_golpe': '1d4',
        'velocidad': 9,
        'velocidades_especiales': {'nadar': 9},
        'atributos': {'fuerza': 2, 'destreza': 16, 'constitucion': 11, 'inteligencia': 1, 'sabiduria': 10, 'carisma': 3},
        'percepcion_pasiva': 10,
        'sentidos': ['Visión ciega 3 m'],
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1', 'tipo_dano': 'perforante', 'efecto': 'El objetivo debe superar Constitución CD 10 o sufre 2d4 daño por veneno.'}
        ],
        'experiencia': 25,
        'desafio': '1/8 (25 PX)'
    },
    {
        'nombre': 'Halcón',
        'categoria': 'animales',
        'descripcion': 'Ave rapaz, caza con rapidez desde el aire.',
        'tipo': 'Bestia Diminuta',
        'tamanio': 'Diminuto',
        'ca': 13,
        'pg': 1,
        'dados_golpe': '1d4 - 1',
        'velocidad': 3,
        'velocidades_especiales': {'volar': 18},
        'atributos': {'fuerza': 5, 'destreza': 16, 'constitucion': 8, 'inteligencia': 2, 'sabiduria': 14, 'carisma': 6},
        'habilidades': {'percepcion': 4},
        'percepcion_pasiva': 14,
        'especiales': [
            {'nombre': 'Vista Aguda', 'descripcion': 'Tiene ventaja en las pruebas de Sabiduría (Percepción) basadas en la vista.'}
        ],
        'armas': [
            {'nombre': 'Garras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1', 'tipo_dano': 'cortante'}
        ],
        'experiencia': 10,
        'desafio': '0 (10 PX)'
    },
    {
        'nombre': 'Perro',
        'categoria': 'animales',
        'descripcion': 'Mamífero doméstico, leal y protector.',
        'tipo': 'Bestia Pequeña',
        'tamanio': 'Pequeño',
        'ca': 12,
        'pg': 5,
        'dados_golpe': '1d6 + 2',
        'velocidad': 12,
        'atributos': {'fuerza': 12, 'destreza': 14, 'constitucion': 14, 'inteligencia': 3, 'sabiduria': 12, 'carisma': 6},
        'habilidades': {'percepcion': 3},
        'percepcion_pasiva': 13,
        'especiales': [
            {'nombre': 'Buen Oído y Olfato', 'descripcion': 'Tiene ventaja en pruebas de Percepción basadas en oído u olfato.'}
        ],
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d4 + 2', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 25,
        'desafio': '1/8 (25 PX)'
    },
    {
        'nombre': 'Cocodrilo',
        'categoria': 'animales',
        'descripcion': 'Reptil acuático, depredador emboscador.',
        'tipo': 'Bestia Grande',
        'tamanio': 'Grande',
        'ca': 12,
        'descripcion_armadura': 'armadura natural',
        'pg': 19,
        'dados_golpe': '3d10 + 3',
        'velocidad': 6,
        'velocidades_especiales': {'nadar': 9},
        'atributos': {'fuerza': 15, 'destreza': 10, 'constitucion': 13, 'inteligencia': 2, 'sabiduria': 10, 'carisma': 5},
        'habilidades': {'sigilo': 2},
        'percepcion_pasiva': 10,
        'especiales': [
            {'nombre': 'Contener la Respiración', 'descripcion': 'Puede contener la respiración 15 minutos.'}
        ],
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1d10 + 2', 'tipo_dano': 'perforante', 'efecto': 'El objetivo queda agarrado (escapar CD 12). Mientras esté agarrado, el cocodrilo tiene ventaja en ataques contra él.'}
        ],
        'experiencia': 100,
        'desafio': '1/2 (100 PX)'
    },
    {
        'nombre': 'Lechuza',
        'categoria': 'animales',
        'descripcion': 'Ave nocturna, caza en silencio.',
        'tipo': 'Bestia Diminuta',
        'tamanio': 'Diminuto',
        'ca': 11,
        'pg': 1,
        'dados_golpe': '1d4 - 1',
        'velocidad': 1.5,
        'velocidades_especiales': {'volar': 18},
        'atributos': {'fuerza': 3, 'destreza': 13, 'constitucion': 8, 'inteligencia': 2, 'sabiduria': 12, 'carisma': 7},
        'habilidades': {'percepcion': 3, 'sigilo': 3},
        'percepcion_pasiva': 13,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'especiales': [
            {'nombre': 'Vuelo Silencioso', 'descripcion': 'Tiene ventaja en pruebas de Sigilo mientras vuela.'},
            {'nombre': 'Vista y Oído Agudos', 'descripcion': 'Tiene ventaja en pruebas de Percepción basadas en vista u oído.'}
        ],
        'armas': [
            {'nombre': 'Garras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 3, 'alcance_metros': '1,5 m', 'dano': '1', 'tipo_dano': 'cortante'}
        ],
        'experiencia': 10,
        'desafio': '0 (10 PX)'
    },
    {
        'nombre': 'Cuervo',
        'categoria': 'animales',
        'descripcion': 'Ave inteligente y astuta.',
        'tipo': 'Bestia Diminuta',
        'tamanio': 'Diminuto',
        'ca': 12,
        'pg': 1,
        'dados_golpe': '1d4 - 1',
        'velocidad': 3,
        'velocidades_especiales': {'volar': 15},
        'atributos': {'fuerza': 2, 'destreza': 14, 'constitucion': 8, 'inteligencia': 2, 'sabiduria': 12, 'carisma': 6},
        'habilidades': {'percepcion': 3},
        'percepcion_pasiva': 13,
        'especiales': [
            {'nombre': 'Imitación', 'descripcion': 'Puede imitar sonidos simples que haya escuchado. Perspicacia CD 10 para detectarlo.'}
        ],
        'armas': [
            {'nombre': 'Pico', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '1', 'tipo_dano': 'perforante'}
        ],
        'experiencia': 10,
        'desafio': '0 (10 PX)'
    },
    {
        'nombre': 'Lobos de Caradhras',
        'categoria': 'animales',
        'descripcion': 'Lobos feroces de las montañas, adaptados al frío extremo.',
        'tipo': 'Bestia Mediana',
        'tamanio': 'Mediano',
        'ca': 13,
        'descripcion_armadura': 'armadura natural',
        'pg': 16,
        'dados_golpe': '3d8 + 3',
        'velocidad': 15,
        'atributos': {'fuerza': 14, 'destreza': 14, 'constitucion': 13, 'inteligencia': 4, 'sabiduria': 12, 'carisma': 7},
        'habilidades': {'percepcion': 4, 'sigilo': 4},
        'percepcion_pasiva': 14,
        'resistencias': ['frío'],
        'especiales': [
            {'nombre': 'Buen Oído y Olfato', 'descripcion': 'Tiene ventaja en pruebas de Percepción basadas en oído u olfato.'},
            {'nombre': 'Tácticas de Manada', 'descripcion': 'Tiene ventaja en ataques si un aliado está a 1,5 m del objetivo.'},
            {'nombre': 'Adaptado al Frío', 'descripcion': 'Resistencia al daño por frío.'}
        ],
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '2d4 + 2', 'tipo_dano': 'perforante', 'efecto': 'El objetivo debe superar Fuerza CD 12 o queda derribado.'}
        ],
        'experiencia': 100,
        'desafio': '1/2 (100 PX)'
    }
]

# ========== BOSQUE NEGRO DATA (Converted to 5e) ==========
BOSQUE_NEGRO_DATA = [
    # === Nazgûl de Dol Guldur ===
    {
        'nombre': 'Lugarteniente de Dol Guldur',
        'categoria': 'especiales',
        'descripcion': 'Jefe de los tres espectros del bosque. Permanece sin ropajes e invisible en Dol Guldur. Cuando sale, viste como un alto guerrero del Este con armadura negra y máscara.',
        'tipo': 'Muerto Viviente Mediano (Nazgûl)',
        'tamanio': 'Mediano',
        'alineamiento': 'Legal maligno',
        'ca': 15,
        'descripcion_armadura': 'armadura de escamas negra',
        'pg': 95,
        'dados_golpe': '10d8 + 50',
        'velocidad': 9,
        'atributos': {'fuerza': 16, 'destreza': 12, 'constitucion': 16, 'inteligencia': 11, 'sabiduria': 14, 'carisma': 13},
        'tiradas_salvacion': {'sabiduria': 5, 'carisma': 4},
        'habilidades': {'percepcion': 5, 'supervivencia': 5, 'intimidacion': 4},
        'percepcion_pasiva': 15,
        'resistencias': ['frío', 'necrótico', 'contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_dano': ['veneno'],
        'inmunidades_estados': ['hechizado', 'cansancio', 'asustado', 'envenenado'],
        'sentidos': ['Visión en la oscuridad 36 m'],
        'idiomas': ['Lengua negra', 'oestron'],
        'desafio': '5 (1,800 PX)',
        'especiales': [
            {'nombre': 'Odio', 'descripcion': 'Tiene ventaja en el primer ataque del combate.'},
            {'nombre': 'Fuerza Horrible', 'descripcion': '+2 daño en ataques cuerpo a cuerpo (incluido en el ataque).'},
            {'nombre': 'Asalto Salvaje', 'descripcion': 'Si impacta dos veces en un turno, el objetivo debe superar Fuerza CD 14 o queda derribado.'},
            {'nombre': 'Habitante de la Oscuridad', 'descripcion': 'Al anochecer, tiene ventaja en todas las tiradas de ataque.'},
            {'nombre': 'Inmortalidad', 'descripcion': 'Si el daño lo reduce a 0 PG, salvación de Constitución CD 5 + daño sufrido. Éxito: queda a 1 PG.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques: uno con espada larga y otro con garra.',
        'armas': [
            {'nombre': 'Espada Larga', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '1,5 m', 'dano': '1d8 + 5', 'tipo_dano': 'cortante'},
            {'nombre': 'Garra', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '1,5 m', 'dano': '1d6 + 5', 'tipo_dano': 'cortante'}
        ],
        'acciones': [
            {'nombre': 'Hálito Negro', 'descripcion': 'Cualquier criatura a 3 m debe superar Constitución CD 14 o queda inconsciente durante 1 minuto. Despierta si recibe daño.'}
        ],
        'experiencia': 1800,
        'bonificador_competencia': 3
    },
    {
        'nombre': 'Fantasma del Bosque',
        'categoria': 'especiales',
        'descripcion': 'Nazgûl que merodea por el Bosque Negro sin ropajes e invisible. Solo se le percibe por el crujir de las hojas, el frío del aire y un terror irracional.',
        'tipo': 'Muerto Viviente Mediano (Nazgûl)',
        'tamanio': 'Mediano',
        'alineamiento': 'Legal maligno',
        'ca': 14,
        'pg': 78,
        'dados_golpe': '8d8 + 40',
        'velocidad': 12,
        'atributos': {'fuerza': 14, 'destreza': 14, 'constitucion': 15, 'inteligencia': 10, 'sabiduria': 13, 'carisma': 12},
        'tiradas_salvacion': {'sabiduria': 4, 'carisma': 4},
        'habilidades': {'percepcion': 4, 'supervivencia': 4, 'sigilo': 6},
        'percepcion_pasiva': 14,
        'resistencias': ['frío', 'necrótico', 'contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_dano': ['veneno'],
        'inmunidades_estados': ['hechizado', 'cansancio', 'asustado', 'envenenado'],
        'sentidos': ['Visión verdadera 36 m'],
        'idiomas': ['Lengua negra'],
        'desafio': '4 (1,100 PX)',
        'especiales': [
            {'nombre': 'Invisibilidad (Sin Ropajes)', 'descripcion': 'Es invisible excepto por el fulgor de sus ojos. Criaturas que lo vean deben tirar salvación con desventaja.'},
            {'nombre': 'Velocidad Terrible', 'descripcion': 'Mientras esté invisible, su velocidad aumenta a 12 m y puede moverse a través de criaturas como terreno difícil.'},
            {'nombre': 'Habitante de la Oscuridad', 'descripcion': 'Al anochecer, tiene ventaja en todas las tiradas de ataque.'},
            {'nombre': 'Inmortalidad', 'descripcion': 'Si el daño lo reduce a 0 PG, salvación de Constitución CD 5 + daño sufrido. Éxito: queda a 1 PG.'}
        ],
        'armas': [
            {'nombre': 'Espada Larga', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d8 + 3', 'tipo_dano': 'cortante'},
            {'nombre': 'Garra', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d6 + 3', 'tipo_dano': 'cortante', 'dano_extra': '1d6 necrótico'}
        ],
        'acciones': [
            {'nombre': 'Infundir Temor', 'descripcion': 'Criaturas a 18 m deben superar Carisma CD 14 o quedan asustadas durante 1 minuto. Pueden repetir la salvación al final de cada turno.'}
        ],
        'experiencia': 1100,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Mensajero de Mordor',
        'categoria': 'especiales',
        'descripcion': 'Mensajero jefe de Sauron. Usa un veloz caballo azabache y atavíos negros. Se presenta a la puerta de hombres, elfos y enanos.',
        'tipo': 'Muerto Viviente Mediano (Nazgûl)',
        'tamanio': 'Mediano',
        'alineamiento': 'Legal maligno',
        'ca': 14,
        'descripcion_armadura': 'cota de mallas negra',
        'pg': 78,
        'dados_golpe': '8d8 + 40',
        'velocidad': 9,
        'atributos': {'fuerza': 14, 'destreza': 13, 'constitucion': 15, 'inteligencia': 12, 'sabiduria': 14, 'carisma': 14},
        'tiradas_salvacion': {'sabiduria': 5, 'carisma': 5},
        'habilidades': {'percepcion': 5, 'persuasion': 5, 'engano': 5, 'intimidacion': 5},
        'percepcion_pasiva': 15,
        'resistencias': ['frío', 'necrótico', 'contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_dano': ['veneno'],
        'inmunidades_estados': ['hechizado', 'cansancio', 'asustado', 'envenenado'],
        'sentidos': ['Visión en la oscuridad 36 m'],
        'idiomas': ['Lengua negra', 'oestron', 'sindarin', 'khuzdul'],
        'desafio': '4 (1,100 PX)',
        'especiales': [
            {'nombre': 'Desconcertar', 'descripcion': 'Puede usar una acción adicional para obligar a una criatura a 9 m a superar Sabiduría CD 14 o tener desventaja en su próximo ataque.'},
            {'nombre': 'Asalto Salvaje', 'descripcion': 'Si impacta dos veces en un turno, el objetivo debe superar Fuerza CD 13 o queda derribado.'},
            {'nombre': 'Diplomático Oscuro', 'descripcion': 'Tiene ventaja en tiradas de Carisma (Persuasión y Engaño) contra criaturas que no sean inmunes al miedo.'},
            {'nombre': 'Inmortalidad', 'descripcion': 'Si el daño lo reduce a 0 PG, salvación de Constitución CD 5 + daño sufrido. Éxito: queda a 1 PG.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques con espada larga.',
        'armas': [
            {'nombre': 'Espada Larga', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d8 + 3', 'tipo_dano': 'cortante'},
            {'nombre': 'Garra', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d6 + 3', 'tipo_dano': 'cortante'}
        ],
        'acciones': [
            {'nombre': 'Voz Mortal', 'descripcion': 'Emite un chillido penetrante. Criaturas a 9 m que lo oigan deben superar Sabiduría CD 14 o quedan aturdidas hasta el final de su siguiente turno.'}
        ],
        'experiencia': 1100,
        'bonificador_competencia': 2
    },
    # === Criaturas del Bosque Negro ===
    {
        'nombre': 'Araña Cazadora',
        'categoria': 'malignos',
        'descripcion': 'Araña del Bosque Negro especializada en emboscadas. Salta desde los árboles para atrapar a sus presas.',
        'tipo': 'Bestia Grande',
        'tamanio': 'Grande',
        'ca': 14,
        'descripcion_armadura': 'armadura natural',
        'pg': 39,
        'dados_golpe': '6d10 + 6',
        'velocidad': 9,
        'velocidades_especiales': {'trepar': 9},
        'atributos': {'fuerza': 14, 'destreza': 15, 'constitucion': 12, 'inteligencia': 4, 'sabiduria': 12, 'carisma': 4},
        'habilidades': {'percepcion': 3, 'sigilo': 6},
        'percepcion_pasiva': 13,
        'sentidos': ['Visión ciega 3 m', 'Visión en la oscuridad 18 m'],
        'desafio': '2 (450 PX)',
        'especiales': [
            {'nombre': 'Gran Salto', 'descripcion': 'Puede saltar hasta 9 m en horizontal o 4,5 m en vertical sin carrerilla.'},
            {'nombre': 'Fuerza Horrible', 'descripcion': 'Un arma cuerpo a cuerpo inflige un dado adicional de daño (incluido en colmillos).'},
            {'nombre': 'Trepar Arañas', 'descripcion': 'Puede trepar por superficies difíciles sin necesidad de prueba.'}
        ],
        'armas': [
            {'nombre': 'Colmillos', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '2d6 + 2', 'tipo_dano': 'perforante', 'efecto': 'El objetivo debe superar Constitución CD 12 o queda paralizado durante 1d6 días y envenenado.'}
        ],
        'experiencia': 450,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Espectro del Bosque',
        'categoria': 'malignos',
        'descripcion': 'Compuestos de huesos, hojas muertas, ramas y cráneos. Espíritus malignos que habitan el Bosque Negro.',
        'tipo': 'Muerto Viviente Mediano',
        'tamanio': 'Mediano',
        'ca': 15,
        'descripcion_armadura': 'armadura natural',
        'pg': 54,
        'dados_golpe': '8d8 + 16',
        'velocidad': 9,
        'atributos': {'fuerza': 14, 'destreza': 14, 'constitucion': 14, 'inteligencia': 8, 'sabiduria': 12, 'carisma': 10},
        'habilidades': {'sigilo': 4, 'percepcion': 3},
        'percepcion_pasiva': 13,
        'resistencias': ['contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_dano': ['veneno'],
        'inmunidades_estados': ['cansancio', 'envenenado'],
        'sentidos': ['Visión en la oscuridad 36 m'],
        'desafio': '3 (700 PX)',
        'especiales': [
            {'nombre': 'Habitante de la Oscuridad', 'descripcion': 'Al anochecer, tiene ventaja en tiradas de ataque.'},
            {'nombre': 'Cobardía', 'descripcion': 'Si queda a menos de la mitad de sus PG máximos, tiene desventaja en tiradas de ataque.'},
            {'nombre': 'Temor al Fuego', 'descripcion': 'Si sufre daño por fuego, debe superar Sabiduría CD 12 o queda asustado hasta el final de su siguiente turno.'},
            {'nombre': 'Horror del Bosque', 'descripcion': 'En el Bosque Negro, el CD para salvaciones contra sus habilidades aumenta en 2.'}
        ],
        'armas': [
            {'nombre': 'Garras Estranguladoras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '2d6 + 2', 'tipo_dano': 'necrótico', 'efecto': 'El objetivo queda agarrado (escapar CD 12). Mientras esté agarrado, no puede respirar.'}
        ],
        'acciones': [
            {'nombre': 'Infundir Temor', 'descripcion': 'Criaturas a 18 m deben superar Carisma CD 14 (CD 16 en Bosque Negro) o quedan asustadas durante 1 minuto.'}
        ],
        'experiencia': 700,
        'bonificador_competencia': 2
    },
    {
        'nombre': 'Trasgo del Bosque',
        'categoria': 'malignos',
        'descripcion': 'Criaturas pálidas y enjutas de las cavernas bajo el Bosque Negro. Son escaladores y rastreadores excelentes, a menudo saltan entre árboles. Tienen un profundo terror a las arañas.',
        'tipo': 'Humanoide Pequeño (trasgo)',
        'tamanio': 'Pequeño',
        'ca': 13,
        'descripcion_armadura': 'cuero, rodela',
        'pg': 10,
        'dados_golpe': '2d6 + 3',
        'velocidad': 9,
        'velocidades_especiales': {'trepar': 9},
        'atributos': {'fuerza': 10, 'destreza': 14, 'constitucion': 12, 'inteligencia': 8, 'sabiduria': 10, 'carisma': 8},
        'habilidades': {'sigilo': 6, 'percepcion': 2},
        'percepcion_pasiva': 12,
        'sentidos': ['Visión en la oscuridad 36 m'],
        'desafio': '1/4 (50 PX)',
        'especiales': [
            {'nombre': 'Odio a la Luz del Sol', 'descripcion': 'Tiene desventaja en tiradas de ataque y pruebas de Percepción basadas en la vista bajo la luz del sol.'},
            {'nombre': 'Cobardía', 'descripcion': 'Tiene desventaja en tiradas de salvación contra ser asustado.'},
            {'nombre': 'Fuerza Horrible', 'descripcion': 'Sus armas infligen un dado adicional de daño (incluido).'},
            {'nombre': 'Habitante del Bosque Negro', 'descripcion': 'Tiene ventaja en pruebas de Sigilo en el Bosque Negro.'},
            {'nombre': 'Miedo a las Arañas', 'descripcion': 'Si ve una araña, debe superar Sabiduría CD 10 o queda asustado durante 1 minuto.'}
        ],
        'armas': [
            {'nombre': 'Lanza de Piedra', 'tipo': 'cuerpo a cuerpo o distancia', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m o 6/18 m', 'dano': '2d4 + 2', 'tipo_dano': 'perforante', 'efecto': 'Con 1 en tirada de ataque, la punta se rompe.'},
            {'nombre': 'Cuchillo Dentado', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 4, 'alcance_metros': '1,5 m', 'dano': '2d4 + 2', 'tipo_dano': 'cortante'}
        ],
        'experiencia': 50,
        'bonificador_competencia': 2
    },
    # === Vástagos de Ella-Laraña ===
    {
        'nombre': 'Sarqin, la Madre de Todas',
        'categoria': 'especiales',
        'descripcion': 'Una de las hijas más antiguas de Ella-Laraña. Inmensa y repugnante, puede invocar innumerables crías para defender su guarida.',
        'tipo': 'Monstruosidad Enorme',
        'tamanio': 'Enorme',
        'ca': 16,
        'descripcion_armadura': 'armadura natural',
        'pg': 150,
        'dados_golpe': '12d12 + 72',
        'velocidad': 9,
        'velocidades_especiales': {'trepar': 9},
        'atributos': {'fuerza': 20, 'destreza': 10, 'constitucion': 22, 'inteligencia': 10, 'sabiduria': 14, 'carisma': 8},
        'tiradas_salvacion': {'constitucion': 10, 'sabiduria': 6},
        'habilidades': {'percepcion': 6, 'sigilo': 4},
        'percepcion_pasiva': 16,
        'resistencias': ['contundente, cortante y perforante de armas no mágicas'],
        'inmunidades_estados': ['asustado'],
        'sentidos': ['Visión ciega 9 m', 'Visión en la oscuridad 36 m'],
        'desafio': '10 (5,900 PX)',
        'especiales': [
            {'nombre': 'Gran Tamaño', 'descripcion': 'Puede agarrar criaturas Grandes o menores.'},
            {'nombre': 'Piel Gruesa', 'descripcion': 'Resistencia a daño de armas no mágicas.'},
            {'nombre': 'Hedor Nauseabundo', 'descripcion': 'Criaturas a 3 m que no sean arañas deben superar Constitución CD 16 al inicio de su turno o quedan envenenadas hasta el inicio de su siguiente turno.'},
            {'nombre': 'Ser Terrorífico', 'descripcion': 'Criaturas que la vean por primera vez deben superar Carisma CD 16 o quedan asustadas durante 1 minuto.'}
        ],
        'ataque_multiple': 'Lleva a cabo tres ataques: uno con colmillos y dos con pisoteo. Puede usar Atrapar en lugar de pisoteo.',
        'armas': [
            {'nombre': 'Colmillos', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 9, 'alcance_metros': '3 m', 'dano': '2d10 + 5', 'tipo_dano': 'perforante', 'efecto': 'El objetivo debe superar Constitución CD 16 o queda paralizado 1d6 días.'},
            {'nombre': 'Pisoteo', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 9, 'alcance_metros': '1,5 m', 'dano': '2d8 + 5', 'tipo_dano': 'contundente', 'efecto': 'El objetivo debe superar Fuerza CD 17 o queda derribado.'},
            {'nombre': 'Atrapar', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 9, 'alcance_metros': '3 m', 'dano': '1d8 + 5', 'tipo_dano': 'contundente', 'efecto': 'El objetivo queda agarrado (escapar CD 17) y apresado.'}
        ],
        'acciones': [
            {'nombre': 'Innumerables Crías (Recarga 5-6)', 'descripcion': 'Invoca 1d8 arañas gigantes que aparecen al inicio de su siguiente turno en espacios desocupados a 9 m.'}
        ],
        'experiencia': 5900,
        'bonificador_competencia': 4
    },
    {
        'nombre': 'Tauler el Cazador',
        'categoria': 'especiales',
        'descripcion': 'Hijo de Ella-Laraña. Grande, ágil, paciente. Sus fauces son duras como el acero y su piel resiste espadas. Le encanta la sangre de elfos y hombres.',
        'tipo': 'Monstruosidad Grande',
        'tamanio': 'Grande',
        'ca': 17,
        'descripcion_armadura': 'armadura natural',
        'pg': 95,
        'dados_golpe': '10d10 + 40',
        'velocidad': 12,
        'velocidades_especiales': {'trepar': 12},
        'atributos': {'fuerza': 18, 'destreza': 16, 'constitucion': 18, 'inteligencia': 8, 'sabiduria': 14, 'carisma': 6},
        'tiradas_salvacion': {'fuerza': 7, 'destreza': 6},
        'habilidades': {'percepcion': 5, 'supervivencia': 5, 'sigilo': 6},
        'percepcion_pasiva': 15,
        'resistencias': ['contundente, cortante y perforante de armas no mágicas'],
        'sentidos': ['Visión ciega 9 m', 'Visión en la oscuridad 36 m'],
        'desafio': '7 (2,900 PX)',
        'especiales': [
            {'nombre': 'Gran Tamaño', 'descripcion': 'Puede agarrar criaturas Medianas o menores.'},
            {'nombre': 'Fuerza Horrible', 'descripcion': 'Sus ataques infligen un dado adicional de daño (incluido).'},
            {'nombre': 'Dureza Odiosa', 'descripcion': 'Si sufre 10 daño o menos que lo reduciría a 0 PG, queda a 1 PG.'}
        ],
        'ataque_multiple': 'Lleva a cabo tres ataques: uno con colmillos y dos con pisoteo.',
        'armas': [
            {'nombre': 'Colmillos', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 7, 'alcance_metros': '1,5 m', 'dano': '2d10 + 4', 'tipo_dano': 'perforante', 'efecto': 'El objetivo debe superar Constitución CD 15 o queda paralizado 1d6 días.'},
            {'nombre': 'Pisoteo', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 7, 'alcance_metros': '1,5 m', 'dano': '2d6 + 4', 'tipo_dano': 'contundente', 'efecto': 'El objetivo debe superar Fuerza CD 15 o queda derribado.'}
        ],
        'acciones': [
            {'nombre': 'Infundir Temor', 'descripcion': 'Criaturas a 18 m deben superar Carisma CD 14 o quedan asustadas durante 1 minuto.'}
        ],
        'experiencia': 2900,
        'bonificador_competencia': 3
    },
    {
        'nombre': 'Tyulqin la Tejedora',
        'categoria': 'especiales',
        'descripcion': 'Hija de Ella-Laraña. Maestra de la ilusión y el engaño. Teje telarañas mágicas que engañan los sentidos y posee múltiples venenos.',
        'tipo': 'Monstruosidad Grande',
        'tamanio': 'Grande',
        'ca': 16,
        'descripcion_armadura': 'armadura natural',
        'pg': 95,
        'dados_golpe': '10d10 + 40',
        'velocidad': 9,
        'velocidades_especiales': {'trepar': 9},
        'atributos': {'fuerza': 16, 'destreza': 14, 'constitucion': 18, 'inteligencia': 14, 'sabiduria': 16, 'carisma': 12},
        'tiradas_salvacion': {'inteligencia': 5, 'sabiduria': 6},
        'habilidades': {'engano': 4, 'percepcion': 6, 'sigilo': 5},
        'percepcion_pasiva': 16,
        'resistencias': ['contundente, cortante y perforante de armas no mágicas'],
        'sentidos': ['Visión ciega 9 m', 'Visión en la oscuridad 36 m'],
        'desafio': '8 (3,900 PX)',
        'especiales': [
            {'nombre': 'Gran Tamaño', 'descripcion': 'Puede agarrar criaturas Medianas o menores.'},
            {'nombre': 'Telarañas Ilusorias', 'descripcion': 'Puede tejer telarañas mágicas. Criaturas que las toquen deben superar Inteligencia CD 16 o quedan sorprendidas.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques: uno con colmillos y otro con atrapar.',
        'armas': [
            {'nombre': 'Colmillos', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '1,5 m', 'dano': '2d8 + 3', 'tipo_dano': 'perforante', 'efecto': 'El objetivo debe superar Constitución CD 15. Fallo: sufre uno de los siguientes efectos (1d4): 1-Paralizado 1d6 días, 2-Desanimado (desventaja en ataques), 3-Cansado (desventaja en salvaciones), 4-Inconsciente 1 hora.'},
            {'nombre': 'Atrapar', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 6, 'alcance_metros': '3 m', 'dano': '1d8 + 3', 'tipo_dano': 'contundente', 'efecto': 'El objetivo queda agarrado (escapar CD 14) y apresado.'}
        ],
        'acciones': [
            {'nombre': 'Conjuros Terribles', 'descripcion': 'Una criatura a 18 m debe superar Inteligencia CD 16 o queda hechizada y camina hacia la telaraña más cercana. Pierde su siguiente acción y es capturada automáticamente.'},
            {'nombre': 'Infundir Temor', 'descripcion': 'Criaturas a 18 m deben superar Carisma CD 16 o quedan asustadas durante 1 minuto.'}
        ],
        'experiencia': 3900,
        'bonificador_competencia': 3
    }
]

# ========== ESPECIALES ADICIONALES DEL EXCEL ==========
ESPECIALES_DATA = [
    {
        'nombre': 'Smaug',
        'categoria': 'especiales',
        'descripcion': 'El más grande y temible de los dragones de la Tercera Edad. Conquistó Erebor y durmió sobre su tesoro durante casi dos siglos.',
        'tipo': 'Dragón Colosal',
        'tamanio': 'Gargantuesco',
        'alineamiento': 'Caótico maligno',
        'ca': 21,
        'descripcion_armadura': 'escamas impenetrables, punto débil en el pecho',
        'pg': 546,
        'dados_golpe': '28d20 + 252',
        'velocidad': 12,
        'velocidades_especiales': {'volar': 24},
        'atributos': {'fuerza': 30, 'destreza': 10, 'constitucion': 29, 'inteligencia': 18, 'sabiduria': 15, 'carisma': 23},
        'tiradas_salvacion': {'destreza': 7, 'constitucion': 16, 'sabiduria': 9, 'carisma': 13},
        'habilidades': {'percepcion': 16, 'sigilo': 7, 'intimidacion': 13},
        'percepcion_pasiva': 26,
        'inmunidades_dano': ['fuego'],
        'sentidos': ['Visión ciega 18 m', 'Visión en la oscuridad 36 m'],
        'idiomas': ['Común', 'Draconico'],
        'desafio': '24 (62,000 PX)',
        'especiales': [
            {'nombre': 'Aliento de Dragón', 'descripcion': 'Puede exhalar fuego en un cono de 27 m. Cada criatura debe superar Destreza CD 24 o sufrir 26d6 daño por fuego (mitad en éxito). Recarga 5-6.'},
            {'nombre': 'Punto Débil', 'descripcion': 'Un atacante que conozca su punto débil y acierte con un ataque crítico ignora su inmunidad al fuego y resistencias.'},
            {'nombre': 'Olfato Codicioso', 'descripcion': 'Puede detectar el olor de oro y joyas en un radio de 1,5 km.'},
            {'nombre': 'Presencia Aterradora', 'descripcion': 'Criaturas a 36 m que lo vean deben superar Carisma CD 21 o quedan asustadas durante 1 minuto.'}
        ],
        'ataque_multiple': 'Puede usar Presencia Aterradora. Luego lleva a cabo tres ataques: uno con mordisco y dos con garras.',
        'armas': [
            {'nombre': 'Mordisco', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 17, 'alcance_metros': '4,5 m', 'dano': '2d10 + 10 + 4d6 fuego', 'tipo_dano': 'perforante'},
            {'nombre': 'Garras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 17, 'alcance_metros': '3 m', 'dano': '2d6 + 10', 'tipo_dano': 'cortante'},
            {'nombre': 'Cola', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 17, 'alcance_metros': '6 m', 'dano': '2d8 + 10', 'tipo_dano': 'contundente'}
        ],
        'acciones_legendarias': [
            {'nombre': 'Detectar', 'descripcion': 'Realiza una prueba de Sabiduría (Percepción).'},
            {'nombre': 'Ataque de Cola', 'descripcion': 'Lleva a cabo un ataque de cola.'},
            {'nombre': 'Ataque de Ala (Cuesta 2 Acciones)', 'descripcion': 'Bate sus alas. Cada criatura a 4,5 m debe superar Destreza CD 25 o sufrir 2d6 + 10 daño contundente y quedar derribada. El dragón puede volar hasta la mitad de su velocidad de vuelo.'}
        ],
        'experiencia': 62000,
        'bonificador_competencia': 7
    },
    {
        'nombre': 'Águila Gigante',
        'categoria': 'especiales',
        'descripcion': 'Las Grandes Águilas de las Montañas Nubladas, sirvientes de Manwë y aliados de los Pueblos Libres.',
        'tipo': 'Bestia Enorme',
        'tamanio': 'Enorme',
        'alineamiento': 'Neutral bueno',
        'ca': 13,
        'pg': 52,
        'dados_golpe': '8d12 + 8',
        'velocidad': 3,
        'velocidades_especiales': {'volar': 24},
        'atributos': {'fuerza': 16, 'destreza': 17, 'constitucion': 13, 'inteligencia': 8, 'sabiduria': 14, 'carisma': 10},
        'habilidades': {'percepcion': 4},
        'percepcion_pasiva': 14,
        'especiales': [
            {'nombre': 'Vista Aguda', 'descripcion': 'Tiene ventaja en pruebas de Percepción basadas en la vista.'},
            {'nombre': 'Vuelo Rápido', 'descripcion': 'Puede usar la acción de Carrera sin gastar su acción.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques: uno con pico y otro con garras.',
        'armas': [
            {'nombre': 'Pico', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '1d10 + 3', 'tipo_dano': 'perforante'},
            {'nombre': 'Garras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 5, 'alcance_metros': '1,5 m', 'dano': '2d6 + 3', 'tipo_dano': 'cortante'}
        ],
        'experiencia': 700,
        'desafio': '3 (700 PX)'
    },
    {
        'nombre': 'Ent (Pastor de Árboles)',
        'categoria': 'especiales',
        'descripcion': 'Los Ents son los pastores de los árboles, seres antiguos que protegen los bosques de la Tierra Media.',
        'tipo': 'Planta Enorme',
        'tamanio': 'Enorme',
        'alineamiento': 'Neutral bueno',
        'ca': 16,
        'descripcion_armadura': 'corteza natural',
        'pg': 138,
        'dados_golpe': '12d12 + 60',
        'velocidad': 9,
        'atributos': {'fuerza': 23, 'destreza': 8, 'constitucion': 21, 'inteligencia': 12, 'sabiduria': 16, 'carisma': 12},
        'resistencias': ['contundente', 'perforante'],
        'vulnerabilidades': ['fuego'],
        'percepcion_pasiva': 13,
        'idiomas': ['Éntico', 'Élfico', 'Oestron'],
        'desafio': '9 (5,000 PX)',
        'especiales': [
            {'nombre': 'Apariencia Falsa', 'descripcion': 'Mientras permanezca inmóvil, es indistinguible de un árbol normal.'},
            {'nombre': 'Asedio', 'descripcion': 'Inflige el doble de daño a objetos y estructuras.'}
        ],
        'ataque_multiple': 'Lleva a cabo dos ataques con golpe de ramas.',
        'armas': [
            {'nombre': 'Golpe de Ramas', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 10, 'alcance_metros': '3 m', 'dano': '3d6 + 6', 'tipo_dano': 'contundente'},
            {'nombre': 'Lanzar Roca', 'tipo': 'distancia', 'bonificador_impacto': 10, 'alcance_metros': '18/54 m', 'dano': '4d10 + 6', 'tipo_dano': 'contundente'}
        ],
        'experiencia': 5000
    },
    {
        'nombre': 'Ella-Laraña',
        'categoria': 'especiales',
        'descripcion': 'La última hija de Ungoliant, una araña monstruosa y antigua que habita en las montañas cerca de Mordor.',
        'tipo': 'Monstruosidad Gargantuesca',
        'tamanio': 'Gargantuesco',
        'alineamiento': 'Caótico maligno',
        'ca': 18,
        'descripcion_armadura': 'quitina endurecida',
        'pg': 310,
        'dados_golpe': '20d20 + 100',
        'velocidad': 9,
        'velocidades_especiales': {'trepar': 9},
        'atributos': {'fuerza': 24, 'destreza': 12, 'constitucion': 20, 'inteligencia': 8, 'sabiduria': 14, 'carisma': 6},
        'tiradas_salvacion': {'constitucion': 11, 'sabiduria': 8},
        'habilidades': {'percepcion': 8, 'sigilo': 7},
        'resistencias': ['contundente, cortante y perforante de armas no mágicas'],
        'sentidos': ['Visión ciega 18 m', 'Visión en la oscuridad 36 m'],
        'desafio': '17 (18,000 PX)',
        'especiales': [
            {'nombre': 'Trepar Arañas', 'descripcion': 'Puede trepar por superficies difíciles sin necesidad de prueba.'},
            {'nombre': 'Oscuridad de Ungoliant', 'descripcion': 'Como acción, puede crear un área de oscuridad mágica de 18 m de radio. Ninguna luz puede iluminarla excepto la luz del sol directa.'},
            {'nombre': 'Veneno Mortal', 'descripcion': 'Su veneno es casi siempre fatal. Las criaturas que fallen la salvación quedan paralizadas durante 1d4 horas y deben repetir la salvación cada hora o morir.'}
        ],
        'ataque_multiple': 'Lleva a cabo tres ataques: uno con aguijón y dos con garras.',
        'armas': [
            {'nombre': 'Aguijón', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 13, 'alcance_metros': '4,5 m', 'dano': '2d12 + 7', 'tipo_dano': 'perforante', 'efecto': 'El objetivo debe superar Constitución CD 19 o queda paralizado 1d4 horas y debe repetir salvación cada hora o morir.'},
            {'nombre': 'Garras', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 13, 'alcance_metros': '3 m', 'dano': '2d8 + 7', 'tipo_dano': 'cortante'}
        ],
        'acciones': [
            {'nombre': 'Telaraña (Recarga 5-6)', 'descripcion': 'Lanza telarañas en un cono de 18 m. Criaturas deben superar Destreza CD 17 o quedan apresadas. Escapar CD 17 o destruir telaraña (CA 10, 15 PG, vulnerable a fuego).'}
        ],
        'experiencia': 18000
    },
    {
        'nombre': 'Mûmakil (Olifante)',
        'categoria': 'especiales',
        'descripcion': 'Elefantes de guerra gigantes de Harad, utilizados como plataformas móviles de combate.',
        'tipo': 'Bestia Gargantuesca',
        'tamanio': 'Gargantuesco',
        'alineamiento': 'Sin alineamiento',
        'ca': 14,
        'descripcion_armadura': 'armadura natural',
        'pg': 126,
        'dados_golpe': '11d20 + 11',
        'velocidad': 12,
        'atributos': {'fuerza': 24, 'destreza': 9, 'constitucion': 13, 'inteligencia': 3, 'sabiduria': 11, 'carisma': 6},
        'percepcion_pasiva': 10,
        'desafio': '8 (3,900 PX)',
        'especiales': [
            {'nombre': 'Carga Arrolladora', 'descripcion': 'Si se mueve al menos 6 m en línea recta y acierta con embestida, el objetivo debe superar Fuerza CD 18 o queda derribado. Si cae derribado, el Mûmakil puede hacer un ataque de pisoteo como acción adicional.'},
            {'nombre': 'Torre de Guerra', 'descripcion': 'Puede transportar hasta 16 criaturas Medianas en una torre en su lomo.'}
        ],
        'armas': [
            {'nombre': 'Embestida', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 10, 'alcance_metros': '3 m', 'dano': '3d8 + 7', 'tipo_dano': 'contundente'},
            {'nombre': 'Pisoteo', 'tipo': 'cuerpo a cuerpo', 'bonificador_impacto': 10, 'alcance_metros': '1,5 m', 'dano': '3d10 + 7', 'tipo_dano': 'contundente'}
        ],
        'experiencia': 3900
    }
]


async def load_new_npcs():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    print("Loading new NPCs (PNJ, Animals, Bosque Negro, Specials)...")
    
    # Get existing NPC names to avoid duplicates
    existing = await db.npcs.find({}, {'nombre': 1}).to_list(500)
    existing_names = {npc['nombre'].lower() for npc in existing}
    print(f"Found {len(existing_names)} existing NPCs")
    
    all_new_npcs = []
    
    # Process each category
    for data_list, category_name in [
        (PNJ_DATA, 'PNJ'),
        (ANIMALES_DATA, 'Animales'),
        (BOSQUE_NEGRO_DATA, 'Bosque Negro'),
        (ESPECIALES_DATA, 'Especiales')
    ]:
        added = 0
        skipped = 0
        for npc_data in data_list:
            # Check if already exists
            if npc_data['nombre'].lower() in existing_names:
                skipped += 1
                continue
            
            npc = create_npc(
                nombre=npc_data['nombre'],
                categoria=npc_data.get('categoria', 'especiales'),
                data=npc_data
            )
            all_new_npcs.append(npc)
            existing_names.add(npc_data['nombre'].lower())  # Add to set to prevent duplicates within batch
            added += 1
        
        print(f"  {category_name}: {added} added, {skipped} skipped (already exist)")
    
    if all_new_npcs:
        await db.npcs.insert_many(all_new_npcs)
    
    # Count by category
    counts = {'malignos': 0, 'pnj': 0, 'animales': 0, 'especiales': 0}
    for npc in all_new_npcs:
        cat = npc.get('categoria', 'especiales')
        if cat in counts:
            counts[cat] += 1
    
    print(f"\nTotal new NPCs loaded: {len(all_new_npcs)}")
    for cat, count in counts.items():
        if count > 0:
            print(f"  - {cat}: {count}")
    
    # Print final totals
    final_counts = {}
    for cat in ['malignos', 'pnj', 'animales', 'especiales']:
        count = await db.npcs.count_documents({'categoria': cat})
        final_counts[cat] = count
    
    print(f"\nFinal database totals:")
    for cat, count in final_counts.items():
        print(f"  - {cat}: {count}")
    
    return all_new_npcs


if __name__ == "__main__":
    asyncio.run(load_new_npcs())
