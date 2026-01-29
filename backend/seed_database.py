"""
Database Seeder for LOTR 5e RPG
Seeds MongoDB with extracted game data from Excel files
"""
import asyncio
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

DATA_DIR = ROOT_DIR.parent / 'data'

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']


def generate_id():
    return str(uuid.uuid4())


def now_utc():
    return datetime.now(timezone.utc).isoformat()


async def clear_collections(db):
    """Clear all game data collections"""
    collections = [
        'cultures', 'backgrounds', 'occupations', 'virtues',
        'arts', 'patrons', 'tools', 'equipment', 'weapons', 'armors',
        'shadow_rules', 'culture_names', 'npcs', 'regions'
    ]
    for coll in collections:
        await db[coll].delete_many({})
    print("Collections cleared")


async def seed_cultures(db, data: dict):
    """Seed cultures collection"""
    cultures = data.get('culturas', [])
    char_by_culture = data.get('caracteristicas_por_cultura', {})
    
    documents = []
    culture_id_map = {}  # Map culture name to id for references
    
    for culture in cultures:
        name = culture['nombre']
        culture_id = generate_id()
        culture_id_map[name] = culture_id
        
        # Get characteristic modifiers
        chars = char_by_culture.get(name, {})
        
        # Determine category based on name
        categoria = None
        if 'Elfo' in name:
            categoria = 'ELFOS'
        elif 'Enano' in name:
            categoria = 'ENANOS'
        elif 'Hobbit' in name or 'Mediano' in name:
            categoria = 'HOBBITS'
        else:
            categoria = 'HOMBRES'
        
        doc = {
            "_id": culture_id,
            "nombre": name,
            "descripcion": culture.get('descripcion'),
            "edad_min": int(culture['edad_min']) if culture.get('edad_min') else None,
            "edad_max": int(culture['edad_max']) if culture.get('edad_max') else None,
            "altura_min": int(culture['altura_min']) if culture.get('altura_min') else None,
            "altura_max": int(culture['altura_max']) if culture.get('altura_max') else None,
            "mod_peso_porcentaje": float(culture['mod_peso_porcentaje']) if culture.get('mod_peso_porcentaje') else None,
            "velocidad": float(culture['velocidad']) if culture.get('velocidad') else 9.0,
            "descanso_horas": float(culture['descanso_horas']) if culture.get('descanso_horas') else 8.0,
            "tamano": culture.get('tamano') or 'Mediano',
            "nivel_vida": culture.get('nivel_vida'),
            "descripcion_riqueza": culture.get('descripcion_riqueza'),
            "categoria": categoria,
            "mod_fuerza": chars.get('fuerza', 0),
            "mod_destreza": chars.get('destreza', 0),
            "mod_constitucion": chars.get('constitución', 0),
            "mod_inteligencia": chars.get('inteligencia', 0),
            "mod_sabiduria": chars.get('sabiduría', 0),
            "mod_carisma": chars.get('carisma', 0),
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        documents.append(doc)
    
    if documents:
        await db.cultures.insert_many(documents)
    print(f"Seeded {len(documents)} cultures")
    return culture_id_map


async def seed_backgrounds(db, data: dict, culture_id_map: dict):
    """Seed backgrounds collection"""
    backgrounds = data.get('trasfondos', [])
    documents = []
    
    for bg in backgrounds:
        cultura_name = bg.get('cultura')
        culture_id = culture_id_map.get(cultura_name) if cultura_name else None
        
        doc = {
            "_id": generate_id(),
            "nombre": bg['nombre'],
            "cultura": cultura_name,
            "culture_id": culture_id,
            "descripcion": bg.get('descripcion'),
            "competencias_habilidades": bg.get('competencias_habilidades', []),
            "competencias_herramientas": bg.get('competencias_herramientas', []),
            "idiomas": bg.get('idiomas', []),
            "equipo_inicial": bg.get('equipo_inicial', []),
            "rasgo_distintivo": bg.get('rasgo_distintivo'),
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        documents.append(doc)
    
    if documents:
        await db.backgrounds.insert_many(documents)
    print(f"Seeded {len(documents)} backgrounds")


async def seed_occupations(db, data: dict):
    """Seed occupations collection"""
    occupations = data.get('ocupaciones', [])
    documents = []
    
    for occ in occupations:
        doc = {
            "_id": generate_id(),
            "tipo": occ['tipo'],
            "vocacion": occ['vocacion'],
            "dado_golpe": occ.get('dado_golpe'),
            "puntos_golpe_nivel1": int(occ['puntos_golpe_nivel1']) if occ.get('puntos_golpe_nivel1') else None,
            "caracteristicas_principales": occ.get('caracteristicas_principales', []),
            "competencia_tiradas_salvacion": occ.get('competencia_tiradas_salvacion', []),
            "habilidades_disponibles": occ.get('habilidades_disponibles', []),
            "num_habilidades_elegir": 2,
            "competencia_armaduras": occ.get('competencia_armaduras', []),
            "competencia_armas": occ.get('competencia_armas', []),
            "rasgos_por_nivel": [],
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        documents.append(doc)
    
    if documents:
        await db.occupations.insert_many(documents)
    print(f"Seeded {len(documents)} occupations")


async def seed_virtues(db, data: dict, culture_id_map: dict):
    """Seed virtues collection"""
    virtues = data.get('virtudes', [])
    documents = []
    
    for virtue in virtues:
        cultura_name = virtue.get('cultura')
        culture_id = culture_id_map.get(cultura_name) if cultura_name else None
        
        doc = {
            "_id": generate_id(),
            "nombre": virtue['nombre'],
            "cultura": cultura_name,
            "culture_id": culture_id,
            "es_comun": virtue.get('es_comun', False),
            "descripcion": virtue.get('descripcion'),
            "rasgos_hoja_pj": virtue.get('rasgos_hoja_pj'),
            "aumentos_caracteristica": virtue.get('aumentos_caracteristica', {}),
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        documents.append(doc)
    
    if documents:
        await db.virtues.insert_many(documents)
    print(f"Seeded {len(documents)} virtues")


async def seed_arts(db, data: dict):
    """Seed arts collection"""
    arts = data.get('artes', [])
    documents = []
    
    for art in arts:
        doc = {
            "_id": generate_id(),
            "nombre": art['nombre'],
            "resumen_hoja_pj": art.get('resumen_hoja_pj'),
            "descripcion_completa": art.get('descripcion_completa'),
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        documents.append(doc)
    
    if documents:
        await db.arts.insert_many(documents)
    print(f"Seeded {len(documents)} arts")


async def seed_patrons(db, data: dict):
    """Seed patrons collection"""
    patrons = data.get('mecenas', [])
    documents = []
    
    for patron in patrons:
        doc = {
            "_id": generate_id(),
            "nombre": patron['nombre'],
            "ocupaciones_favorecidas": patron.get('ocupaciones_favorecidas'),
            "puntos_comunidad": int(patron['puntos_comunidad']) if patron.get('puntos_comunidad') else None,
            "ventaja_adicional": patron.get('ventaja_adicional'),
            "planes": patron.get('planes'),
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        documents.append(doc)
    
    if documents:
        await db.patrons.insert_many(documents)
    print(f"Seeded {len(documents)} patrons")


def safe_float(val):
    """Safely convert value to float"""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def safe_int(val):
    """Safely convert value to int"""
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


async def seed_equipment(db, data: dict):
    """Seed equipment collections"""
    equipo = data.get('equipo', {})
    
    # Seed tools
    tools = equipo.get('herramientas', [])
    tool_docs = []
    for tool in tools:
        if not tool.get('nombre'):
            continue
        doc = {
            "_id": generate_id(),
            "nombre": tool['nombre'],
            "tipo": "herramienta",
            "precio": safe_float(tool.get('precio')),
            "moneda": tool.get('moneda'),
            "peso_kg": safe_float(tool.get('peso_kg')),
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        tool_docs.append(doc)
    
    if tool_docs:
        await db.tools.insert_many(tool_docs)
    print(f"Seeded {len(tool_docs)} tools")
    
    # Seed general equipment
    items = equipo.get('equipo_general', [])
    item_docs = []
    for item in items:
        if not item.get('nombre'):
            continue
        doc = {
            "_id": generate_id(),
            "nombre": item['nombre'],
            "tipo": "equipo_general",
            "precio": safe_float(item.get('precio')),
            "moneda": item.get('moneda'),
            "peso_kg": safe_float(item.get('peso_kg')),
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        item_docs.append(doc)
    
    if item_docs:
        await db.equipment.insert_many(item_docs)
    print(f"Seeded {len(item_docs)} general equipment items")
    
    # Seed weapons
    weapons = equipo.get('armas', [])
    weapon_docs = []
    for weapon in weapons:
        if not weapon.get('nombre'):
            continue
        doc = {
            "_id": generate_id(),
            "nombre": weapon['nombre'],
            "tipo": "arma",
            "precio": safe_float(weapon.get('precio')),
            "moneda": weapon.get('moneda'),
            "peso_kg": safe_float(weapon.get('peso_kg')),
            "tipo_dano": weapon.get('tipo_dano'),
            "dano": weapon.get('dano'),
            "herida": safe_int(weapon.get('herida')),
            "alcance": weapon.get('alcance'),
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        weapon_docs.append(doc)
    
    if weapon_docs:
        await db.weapons.insert_many(weapon_docs)
    print(f"Seeded {len(weapon_docs)} weapons")
    
    # Seed armors
    armors = equipo.get('armaduras', [])
    armor_docs = []
    for armor in armors:
        if not armor.get('nombre'):
            continue
        doc = {
            "_id": generate_id(),
            "nombre": armor['nombre'],
            "tipo": "armadura",
            "precio": safe_float(armor.get('precio')),
            "moneda": armor.get('moneda'),
            "clase_armadura": safe_int(armor.get('clase_armadura')),
            "peso_kg": safe_float(armor.get('peso_kg')),
            "requisito_fuerza": safe_int(armor.get('requisito_fuerza')),
            "desventaja_sigilo": armor.get('desventaja_sigilo') == 'Si' or armor.get('desventaja_sigilo') == True,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        armor_docs.append(doc)
    
    if armor_docs:
        await db.armors.insert_many(armor_docs)
    print(f"Seeded {len(armor_docs)} armors")


async def seed_shadow_rules(db, data: dict):
    """Seed shadow rules collection"""
    shadow = data.get('sombra', {})
    
    def convert_sources(sources):
        return [
            {
                "fuente": s.get('fuente', ''),
                "ejemplo": s.get('ejemplo'),
                "puntos_sombra": int(s['puntos_sombra']) if s.get('puntos_sombra') else None
            }
            for s in sources if s.get('fuente')
        ]
    
    doc = {
        "_id": generate_id(),
        "fuentes_pavor": convert_sources(shadow.get('fuentes_pavor', [])),
        "fuentes_avaricia": convert_sources(shadow.get('fuentes_avaricia', [])),
        "fuentes_desesperacion": convert_sources(shadow.get('fuentes_desesperacion', [])),
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    
    await db.shadow_rules.insert_one(doc)
    print("Seeded shadow rules")


async def seed_culture_names(db, data: dict, culture_id_map: dict):
    """Seed culture names for name generation"""
    names_data = data.get('nombres_por_cultura', {})
    documents = []
    
    for culture_name, name_parts in names_data.items():
        doc = {
            "_id": generate_id(),
            "cultura": culture_name,
            "culture_id": culture_id_map.get(culture_name),
            "hombre": {
                "prefijos": name_parts.get('hombre', {}).get('prefijos', []),
                "sufijos": name_parts.get('hombre', {}).get('sufijos', []),
            },
            "mujer": {
                "prefijos": name_parts.get('mujer', {}).get('prefijos', []),
                "sufijos": name_parts.get('mujer', {}).get('sufijos', []),
            },
            "apellidos": name_parts.get('apellidos', []),
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        documents.append(doc)
    
    if documents:
        await db.culture_names.insert_many(documents)
    print(f"Seeded {len(documents)} culture name sets")


async def create_indexes(db):
    """Create indexes for better query performance"""
    # Cultures
    await db.cultures.create_index("nombre", unique=True)
    await db.cultures.create_index("categoria")
    
    # Backgrounds
    await db.backgrounds.create_index("nombre")
    await db.backgrounds.create_index("culture_id")
    await db.backgrounds.create_index("cultura")
    
    # Occupations
    await db.occupations.create_index("tipo")
    await db.occupations.create_index("vocacion")
    
    # Virtues
    await db.virtues.create_index("nombre")
    await db.virtues.create_index("culture_id")
    await db.virtues.create_index("es_comun")
    
    # Equipment
    await db.tools.create_index("nombre")
    await db.equipment.create_index("nombre")
    await db.weapons.create_index("nombre")
    
    # Characters (for future)
    await db.characters.create_index("nombre")
    await db.characters.create_index("campaign_id")
    await db.characters.create_index("jugador")
    
    print("Created database indexes")


async def main():
    """Main seeding function"""
    print("Starting database seeding...")
    
    # Load extracted data
    data_file = DATA_DIR / 'extracted_data.json'
    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Clear existing data
        await clear_collections(db)
        
        # Seed in order (cultures first for references)
        culture_id_map = await seed_cultures(db, data)
        await seed_backgrounds(db, data, culture_id_map)
        await seed_occupations(db, data)
        await seed_virtues(db, data, culture_id_map)
        await seed_arts(db, data)
        await seed_patrons(db, data)
        await seed_equipment(db, data)
        await seed_shadow_rules(db, data)
        await seed_culture_names(db, data, culture_id_map)
        
        # Create indexes
        await create_indexes(db)
        
        print("\nDatabase seeding complete!")
        
        # Print summary
        print("\nCollection counts:")
        for coll in ['cultures', 'backgrounds', 'occupations', 'virtues', 'arts', 'patrons', 'tools', 'equipment', 'weapons']:
            count = await db[coll].count_documents({})
            print(f"  - {coll}: {count}")
        
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
