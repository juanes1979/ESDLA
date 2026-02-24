"""
Script to analyze Middle-earth map colors and assign terrain types to locations and regions.

Terrain difficulty colors (from the map):
- Fácil: #d3ba84 (light tan - plains, roads)
- Moderado: #948c4d (olive/brown - forests, hills)  
- Difícil: #c38d4f (orange-brown - dense forests, swamps)
- Muy Difícil: #a57044 (dark brown - mountains foothills, marshes)
- Desalentador: #af4b27 (red-brown - volcanic, corrupted lands)
- Infranqueable: #664540 (dark brown-red - mountain peaks, cliffs)

Region danger classes:
- Tierras Libres: Safe civilized areas
- Tierras Fronterizas: Border regions, some danger
- Tierras Salvajes: Wild lands, moderate danger
- Tierras de la Sombra: Near Mordor/evil influence
- Tierras Oscuras: Mordor, Angmar, etc.
"""

import asyncio
import httpx
from PIL import Image
from io import BytesIO
import math
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone

# Increase PIL limit for large map images
Image.MAX_IMAGE_PIXELS = 500000000

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Map URLs
MAP_URLS = {
    'general': 'https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/8bm4010y_Tierra%20Media.jpg',
    'eriador': 'https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/rc50v5ir_Mapa-03-Eriador-MMS-HR.jpg',
    'rhovanion': 'https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/hweoecgy_Mapa-04-Rhovanion-MMS-HR.jpg',
    'gondor': 'https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/vlt5od8m_Mapa-01-Gondor-MMS-HR.jpg',
    'mordor': 'https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/ikcantpd_Mapa-02-Mordor-MMS-HR.jpg',
}

# Terrain type colors (hex to RGB)
TERRAIN_COLORS = {
    'facil': (0xd3, 0xba, 0x84),        # #d3ba84
    'moderado': (0x94, 0x8c, 0x4d),     # #948c4d
    'dificil': (0xc3, 0x8d, 0x4f),      # #c38d4f
    'muy_dificil': (0xa5, 0x70, 0x44),  # #a57044
    'desalentador': (0xaf, 0x4b, 0x27), # #af4b27
    'infranqueable': (0x66, 0x45, 0x40),# #664540
}

# Map regions to their danger class based on lore
REGION_DANGER_MAP = {
    # Tierras Libres - Safe, civilized
    'La Comarca': 'tierras_libres',
    'Tierras de Bree': 'tierras_libres',
    'Rivendel': 'tierras_libres',
    'Lothlórien': 'tierras_libres',
    'Gondor': 'tierras_libres',
    'Rohan': 'tierras_libres',
    'Valle': 'tierras_libres',
    'Erebor': 'tierras_libres',
    'Lindon': 'tierras_libres',
    
    # Tierras Fronterizas - Border regions
    'Arthedain': 'tierras_fronterizas',
    'Cardolan': 'tierras_fronterizas',
    'Ithilien': 'tierras_fronterizas',
    'Eregion': 'tierras_fronterizas',
    'Fangorn': 'tierras_fronterizas',
    'Esgaroth': 'tierras_fronterizas',
    
    # Tierras Salvajes - Wild lands
    'Rhudaur': 'tierras_salvajes',
    'Eriador': 'tierras_salvajes',
    'Enedwaith': 'tierras_salvajes',
    'Minhiriath': 'tierras_salvajes',
    'Rhovanion': 'tierras_salvajes',
    'Tierras Brunas': 'tierras_salvajes',
    'Bosque Negro': 'tierras_salvajes',
    'Montañas Nubladas': 'tierras_salvajes',
    'Montañas Grises': 'tierras_salvajes',
    
    # Tierras de la Sombra - Near evil
    'Dol Guldur': 'tierras_sombra',
    'Minas Morgul': 'tierras_sombra',
    'Cirith Ungol': 'tierras_sombra',
    'Isengard': 'tierras_sombra',
    'Angmar': 'tierras_sombra',
    
    # Tierras Oscuras - Evil lands
    'Mordor': 'tierras_oscuras',
    'Gorgoroth': 'tierras_oscuras',
    'Barad-dûr': 'tierras_oscuras',
    'Udûn': 'tierras_oscuras',
    'Nurn': 'tierras_oscuras',
}

# Mountain passes and crossings - these are the only way through infranqueable terrain
MOUNTAIN_PASSES = [
    'Paso de Caradhras',
    'Moria',
    'Paso Alto',
    'Paso de Cirith Ungol',
    'Paso de Morgul',
    'Puerto de Rohan',
    'Paso del Cuerno Rojo',
    'Escalera de Cirith Ungol',
    'Puerta Negra',
    'Morannon',
]


def color_distance(c1, c2):
    """Calculate Euclidean distance between two RGB colors"""
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))


def get_terrain_type(rgb_color, tolerance=60):
    """
    Determine terrain type from RGB color with tolerance for variations.
    Returns the closest matching terrain type.
    """
    # Handle grayscale or very dark colors (likely water or borders)
    r, g, b = rgb_color
    if r < 50 and g < 50 and b < 50:
        return None  # Too dark, likely border or text
    if abs(r - g) < 20 and abs(g - b) < 20 and abs(r - b) < 20:
        # Grayscale - could be water or mountains
        if r > 150:
            return 'facil'  # Light gray - could be snow or light terrain
        elif r > 80:
            return 'muy_dificil'
        else:
            return 'infranqueable'
    
    # Find closest terrain color
    min_distance = float('inf')
    closest_terrain = 'moderado'  # Default
    
    for terrain, color in TERRAIN_COLORS.items():
        dist = color_distance(rgb_color, color)
        if dist < min_distance:
            min_distance = dist
            closest_terrain = terrain
    
    # If the distance is too large, use a fallback based on color properties
    if min_distance > tolerance:
        # Analyze color properties
        if r > 180 and g > 150:
            return 'facil'
        elif r > 150 and g > 100:
            return 'moderado'
        elif r > 130:
            return 'dificil'
        elif r > 100 and g < 80:
            return 'desalentador'
        else:
            return 'muy_dificil'
    
    return closest_terrain


def get_region_danger_class(region_name, location_name=None):
    """
    Determine danger class based on region and location name.
    """
    # Check location-specific overrides
    if location_name:
        location_lower = location_name.lower()
        if any(evil in location_lower for evil in ['mordor', 'barad', 'gorgoroth', 'orodruin']):
            return 'tierras_oscuras'
        if any(shadow in location_lower for shadow in ['morgul', 'cirith', 'dol guldur', 'angmar']):
            return 'tierras_sombra'
        if any(safe in location_lower for safe in ['rivendel', 'imladris', 'lothlórien', 'lorien', 'hobbiton']):
            return 'tierras_libres'
    
    # Check region map
    for key, danger in REGION_DANGER_MAP.items():
        if key.lower() in region_name.lower() or region_name.lower() in key.lower():
            return danger
    
    # Default based on general area
    return 'tierras_salvajes'


async def download_map(url):
    """Download map image from URL"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(url)
        if response.status_code == 200:
            return Image.open(BytesIO(response.content))
    return None


async def analyze_location_terrain(db, map_images):
    """
    Analyze all locations and assign terrain types based on map colors.
    """
    locations = await db.locations.find({}).to_list(1000)
    updated = 0
    
    for loc in locations:
        x_percent = loc.get('x', 0)
        y_percent = loc.get('y', 0)
        region = loc.get('region', '')
        nombre = loc.get('nombre', '')
        
        # Determine which map to use based on region
        map_key = 'general'
        region_lower = region.lower() if region else ''
        if any(r in region_lower for r in ['comarca', 'bree', 'eriador', 'arthedain', 'lindon', 'eregion']):
            map_key = 'eriador'
        elif any(r in region_lower for r in ['rhovanion', 'bosque negro', 'erebor', 'valle', 'esgaroth']):
            map_key = 'rhovanion'
        elif any(r in region_lower for r in ['gondor', 'rohan', 'ithilien']):
            map_key = 'gondor'
        elif any(r in region_lower for r in ['mordor', 'gorgoroth', 'nurn']):
            map_key = 'mordor'
        
        map_img = map_images.get(map_key) or map_images.get('general')
        
        if map_img:
            # Convert percentage coordinates to pixel coordinates
            img_width, img_height = map_img.size
            px_x = int((x_percent / 100) * img_width)
            px_y = int((y_percent / 100) * img_height)
            
            # Sample colors from a small area around the point (5x5 grid)
            colors = []
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    try:
                        sample_x = max(0, min(img_width - 1, px_x + dx * 3))
                        sample_y = max(0, min(img_height - 1, px_y + dy * 3))
                        pixel = map_img.getpixel((sample_x, sample_y))
                        if len(pixel) >= 3:
                            colors.append(pixel[:3])
                    except:
                        pass
            
            # Get average color
            if colors:
                avg_r = sum(c[0] for c in colors) // len(colors)
                avg_g = sum(c[1] for c in colors) // len(colors)
                avg_b = sum(c[2] for c in colors) // len(colors)
                avg_color = (avg_r, avg_g, avg_b)
                
                terrain_type = get_terrain_type(avg_color)
            else:
                terrain_type = 'moderado'
        else:
            terrain_type = 'moderado'
        
        # Check if this is a mountain pass
        is_pass = any(p.lower() in nombre.lower() for p in MOUNTAIN_PASSES)
        if is_pass:
            terrain_type = 'muy_dificil'  # Passes are difficult but not infranqueable
        
        # Get danger class
        clase_region = get_region_danger_class(region, nombre)
        
        # Update location
        update_data = {
            'tipo_terreno': terrain_type,
            'clase_region': clase_region,
            'es_paso_montana': is_pass,
            'updated_at': datetime.now(timezone.utc)
        }
        
        await db.locations.update_one(
            {'_id': loc['_id']},
            {'$set': update_data}
        )
        updated += 1
        print(f"  {nombre}: {terrain_type}, {clase_region}" + (" [PASO]" if is_pass else ""))
    
    return updated


async def analyze_regions_terrain(db):
    """
    Assign terrain types to regions based on their subregions or known data.
    """
    regions = await db.regions.find({}).to_list(500)
    updated = 0
    
    for region in regions:
        nombre = region.get('nombre', '')
        parent_id = region.get('parent_id')
        
        # Determine terrain type based on region name
        nombre_lower = nombre.lower()
        
        if any(m in nombre_lower for m in ['montaña', 'mountain', 'nubladas', 'grises', 'ceniza']):
            terrain_type = 'infranqueable'
        elif any(d in nombre_lower for d in ['mordor', 'gorgoroth', 'udûn']):
            terrain_type = 'desalentador'
        elif any(s in nombre_lower for s in ['pantano', 'ciénaga', 'marsh', 'muerto']):
            terrain_type = 'muy_dificil'
        elif any(b in nombre_lower for b in ['bosque', 'forest', 'fangorn', 'negro']):
            terrain_type = 'dificil'
        elif any(c in nombre_lower for c in ['colina', 'hill', 'páramo', 'moor']):
            terrain_type = 'moderado'
        else:
            terrain_type = 'facil'
        
        # Get danger class
        clase_region = get_region_danger_class(nombre)
        
        # Update region
        update_data = {
            'tipo_terreno': terrain_type,
            'clase_region': clase_region,
            'updated_at': datetime.now(timezone.utc)
        }
        
        await db.regions.update_one(
            {'_id': region['_id']},
            {'$set': update_data}
        )
        updated += 1
        print(f"  Región: {nombre}: {terrain_type}, {clase_region}")
    
    return updated


async def main():
    """Main function to analyze maps and update terrain data"""
    print("=" * 60)
    print("Analizando mapas de la Tierra Media...")
    print("=" * 60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Download maps
    print("\n📥 Descargando mapas...")
    map_images = {}
    for name, url in MAP_URLS.items():
        print(f"  Descargando {name}...")
        img = await download_map(url)
        if img:
            map_images[name] = img
            print(f"    ✓ {img.size[0]}x{img.size[1]} pixels")
        else:
            print(f"    ✗ Error descargando")
    
    # Analyze locations
    print("\n🗺️ Analizando ubicaciones...")
    loc_count = await analyze_location_terrain(db, map_images)
    print(f"  ✓ {loc_count} ubicaciones actualizadas")
    
    # Analyze regions
    print("\n🌍 Analizando regiones...")
    reg_count = await analyze_regions_terrain(db)
    print(f"  ✓ {reg_count} regiones actualizadas")
    
    print("\n" + "=" * 60)
    print("✅ Análisis completado")
    print("=" * 60)
    
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
