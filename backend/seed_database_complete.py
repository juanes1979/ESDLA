"""
Database Seeder for LOTR 5e RPG - Complete Version
Seeds MongoDB with data from extracted_data_complete.json
Following the final user-approved plan structure
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
        'culture_names', 'equipment_lists'
    ]
    for coll in collections:
        await db[coll].delete_many({})
    print("Collections cleared")


async def seed_cultures(db, data: dict):
    """Seed cultures collection with complete data"""
    cultures = data.get('cultures', [])
    documents = []
    culture_id_map = {}  # Map culture name to id for references
    
    for culture in cultures:
        name = culture['nombre']
        culture_id = generate_id()
        culture_id_map[name] = culture_id
        
        doc = {
            "_id": culture_id,
            "nombre": name,
            "columna_excel": culture.get('columna_excel'),
            "raza": culture.get('raza'),
            "imc": culture.get('imc', {"min": 20, "max": 24}),
            
            # Basic stats
            "descripcion": culture.get('descripcion'),
            "edad_min": culture.get('edad_min'),
            "edad_max": culture.get('edad_max'),
            "altura_min": culture.get('altura_min'),
            "altura_max": culture.get('altura_max'),
            "mod_peso": culture.get('mod_peso', 0),
            "velocidad": culture.get('velocidad', 9),
            "descanso": culture.get('descanso', 8),
            "tamanio": culture.get('tamanio', 'Mediano'),
            "nivel_vida": culture.get('nivel_vida', 'Común'),
            "descripcion_nivel_vida": culture.get('descripcion_nivel_vida'),
            
            # Characteristic bonuses
            "bonificadores_caracteristicas": culture.get('bonificadores_caracteristicas', {}),
            
            # Noldor special
            "mejora_noldor": culture.get('mejora_noldor', False),
            
            # Physical traits
            "rasgos_fisicos": culture.get('rasgos_fisicos', {}),
            
            # Cultural traits
            "rasgos_culturales": culture.get('rasgos_culturales', []),
            
            # Special dwarf traits
            "pg_extra_nivel": culture.get('pg_extra_nivel'),
            "capacidad_carga_x2": culture.get('capacidad_carga_x2'),
            
            # Virtue at level 1 (only 3 cultures)
            "tiene_virtud_inicial": culture.get('tiene_virtud_inicial', False),
            
            # Languages
            "idiomas": culture.get('idiomas', []),
            
            # Skill competencies to choose
            "competencia_habilidad_elegir": culture.get('competencia_habilidad_elegir', []),
            
            # Tool competencies to choose
            "competencia_herramienta_elegir_1": culture.get('competencia_herramienta_elegir_1', []),
            "competencia_herramienta_elegir_2": culture.get('competencia_herramienta_elegir_2', []),
            
            # Additional competency
            "competencia_adicional": culture.get('competencia_adicional'),
            
            # Skills with scores and competencies
            "habilidades_puntuaciones": culture.get('habilidades_puntuaciones', {}),
            "competencias_habilidades": culture.get('competencias_habilidades', []),
            
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        documents.append(doc)
    
    if documents:
        await db.cultures.insert_many(documents)
    print(f"Seeded {len(documents)} cultures")
    return culture_id_map


async def seed_backgrounds(db, data: dict, culture_id_map: dict):
    """Seed backgrounds collection with complete data"""
    backgrounds = data.get('backgrounds', [])
    trait_descriptions = data.get('trait_descriptions', {})
    documents = []
    
    for bg in backgrounds:
        cultura_name = bg.get('cultura')
        culture_id = culture_id_map.get(cultura_name) if cultura_name else None
        
        doc = {
            "_id": generate_id(),
            "nombre": bg['nombre'],
            "cultura": cultura_name,
            "culture_id": culture_id,
            "columna_excel": bg.get('columna_excel'),
            "descripcion": bg.get('descripcion'),
            
            # Automatic skill competencies (rows 6-7)
            "competencias_habilidades_auto": bg.get('competencias_habilidades_auto', []),
            
            # Skill competencies to choose (rows 8-10)
            "competencias_habilidades_elegir": bg.get('competencias_habilidades_elegir', []),
            
            # Tool competencies (may contain "Instrumento musical" or "Juegos")
            "competencias_herramientas_1": bg.get('competencias_herramientas_1', []),
            "competencias_herramientas_2": bg.get('competencias_herramientas_2', []),
            
            # Traits with descriptions
            "rasgos": bg.get('rasgos', []),
            "rasgos_descripciones": bg.get('rasgos_descripciones', []),
            
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        documents.append(doc)
    
    if documents:
        await db.backgrounds.insert_many(documents)
    print(f"Seeded {len(documents)} backgrounds")
    
    # Also store trait descriptions as reference
    if trait_descriptions:
        await db.trait_descriptions.delete_many({})
        trait_doc = {
            "_id": generate_id(),
            "descriptions": trait_descriptions,
            "created_at": now_utc(),
        }
        await db.trait_descriptions.insert_one(trait_doc)
        print(f"Seeded {len(trait_descriptions)} trait descriptions")


async def seed_occupations(db, data: dict):
    """Seed occupations collection with complete weapon/armor/skill selection data"""
    occupations = data.get('occupations', [])
    documents = []
    
    for occ in occupations:
        doc = {
            "_id": generate_id(),
            "vocacion": occ['vocacion'],
            "columna_excel": occ.get('columna_excel'),
            "dado_golpe": occ.get('dado_golpe'),
            "puntos_golpe_base": occ.get('puntos_golpe_base'),
            "caracteristicas_principales": occ.get('caracteristicas_principales', []),
            "tiradas_salvacion": occ.get('tiradas_salvacion', []),
            "competencia_armas": occ.get('competencia_armas', []),
            "competencia_armaduras": occ.get('competencia_armaduras', []),
            
            # Tools selection 1 (rows 21-41)
            "herramientas_1": occ.get('herramientas_1', {}),
            
            # Skills selection (rows 44-57)
            "habilidades": occ.get('habilidades', {}),
            
            # Armor selection A/B (rows 60-69)
            "armadura": occ.get('armadura', {}),
            
            # Additional tool (row 73)
            "herramienta_adicional": occ.get('herramienta_adicional'),
            
            # Tools selection 2 (rows 75-93)
            "herramientas_2": occ.get('herramientas_2', {}),
            
            # Weapons (multiple blocks with different types)
            "armas": occ.get('armas', []),
            
            # Special features
            "especial_nombre": occ.get('especial_nombre'),
            "especial_descripcion": occ.get('especial_descripcion'),
            "especial_opciones": occ.get('especial_opciones', []),
            
            # Occupation traits
            "rasgos_ocupacion": occ.get('rasgos_ocupacion', []),
            
            # Future paths (level 3)
            "caminos": occ.get('caminos', {}),
            
            # Virtues text
            "virtudes_texto": occ.get('virtudes_texto', []),
            
            # Favored skills
            "habilidades_favorecidas": occ.get('habilidades_favorecidas', []),
            
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        documents.append(doc)
    
    if documents:
        await db.occupations.insert_many(documents)
    print(f"Seeded {len(documents)} occupations")


async def seed_virtues(db, data: dict, culture_id_map: dict):
    """Seed virtues collection with complete selection data"""
    virtues = data.get('virtues', [])
    documents = []
    
    for virtue in virtues:
        tipo = virtue.get('tipo')
        culture_id = None
        
        # Map tipo to culture_id if it's not COMUNES
        if tipo and 'COMUN' not in tipo.upper():
            # Try to find matching culture
            for culture_name, cid in culture_id_map.items():
                if tipo.lower() in culture_name.lower() or culture_name.lower() in tipo.lower():
                    culture_id = cid
                    break
        
        doc = {
            "_id": generate_id(),
            "nombre": virtue['nombre'],
            "tipo": tipo,
            "es_comun": virtue.get('es_comun', False),
            "culture_id": culture_id,
            "columna_excel": virtue.get('columna_excel'),
            "descripcion": virtue.get('descripcion'),
            "competencias_texto": virtue.get('competencias_texto'),
            
            # Fixed characteristic bonuses
            "caracteristicas_fijas": virtue.get('caracteristicas_fijas', {}),
            
            # Selectable characteristic bonus
            "caracteristicas_elegir": virtue.get('caracteristicas_elegir', []),
            
            # Selectable saving throw
            "salvaciones_elegir": virtue.get('salvaciones_elegir', []),
            
            # Fixed bonuses
            "puntos_golpe_extra": virtue.get('puntos_golpe_extra', 0),
            "puntos_comunidad_extra": virtue.get('puntos_comunidad_extra', 0),
            "clase_armadura_extra": virtue.get('clase_armadura_extra', 0),
            
            # Skill competencies to choose
            "competencias_habilidades_elegir": virtue.get('competencias_habilidades_elegir', []),
            
            # Tool competencies to choose
            "competencias_herramientas_elegir": virtue.get('competencias_herramientas_elegir', []),
            
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        documents.append(doc)
    
    if documents:
        await db.virtues.insert_many(documents)
    print(f"Seeded {len(documents)} virtues")


async def seed_names(db, data: dict, culture_id_map: dict):
    """Seed culture names for name generation"""
    names_data = data.get('names', {})
    documents = []
    
    for culture_name, name_parts in names_data.items():
        # Find matching culture_id
        culture_id = None
        for db_name, cid in culture_id_map.items():
            if culture_name.lower() == db_name.lower() or culture_name.lower() in db_name.lower():
                culture_id = cid
                break
        
        doc = {
            "_id": generate_id(),
            "cultura": culture_name,
            "culture_id": culture_id,
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


async def seed_equipment_lists(db, data: dict):
    """Seed special equipment lists (instruments, games)"""
    equipment_lists = data.get('equipment_lists', {})
    
    doc = {
        "_id": generate_id(),
        "juegos": equipment_lists.get('juegos', []),
        "instrumentos_musicales": equipment_lists.get('instrumentos_musicales', []),
        "created_at": now_utc(),
    }
    
    await db.equipment_lists.insert_one(doc)
    print(f"Seeded equipment lists (instruments: {len(doc['instrumentos_musicales'])}, games: {len(doc['juegos'])})")


async def create_indexes(db):
    """Create indexes for better query performance"""
    # Cultures
    await db.cultures.create_index("nombre", unique=True)
    await db.cultures.create_index("raza")
    await db.cultures.create_index("tiene_virtud_inicial")
    
    # Backgrounds
    await db.backgrounds.create_index("nombre")
    await db.backgrounds.create_index("culture_id")
    await db.backgrounds.create_index("cultura")
    
    # Occupations
    await db.occupations.create_index("vocacion")
    
    # Virtues
    await db.virtues.create_index("nombre")
    await db.virtues.create_index("tipo")
    await db.virtues.create_index("es_comun")
    await db.virtues.create_index("culture_id")
    
    # Culture names
    await db.culture_names.create_index("cultura")
    await db.culture_names.create_index("culture_id")
    
    # Characters
    await db.characters.create_index("nombre")
    await db.characters.create_index("jugador")
    await db.character_drafts.create_index("estado")
    
    print("Created database indexes")


async def main():
    """Main seeding function"""
    print("Starting database seeding with complete data...")
    
    # Load extracted data
    data_file = DATA_DIR / 'extracted_data_complete.json'
    if not data_file.exists():
        print(f"Error: {data_file} not found. Run data_extractor_complete.py first.")
        return
    
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
        await seed_names(db, data, culture_id_map)
        await seed_equipment_lists(db, data)
        
        # Create indexes
        await create_indexes(db)
        
        print("\nDatabase seeding complete!")
        
        # Print summary
        print("\nCollection counts:")
        for coll in ['cultures', 'backgrounds', 'occupations', 'virtues', 'culture_names', 'equipment_lists']:
            count = await db[coll].count_documents({})
            print(f"  - {coll}: {count}")
        
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
