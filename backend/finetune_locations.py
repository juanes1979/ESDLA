#!/usr/bin/env python3
"""
Fine-tune specific location coordinates (v3).
Focus on key locations that need manual adjustment.
"""

import os
from pymongo import MongoClient

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Manual corrections for specific locations based on visual inspection
# Format: 'location_name_substring': (target_x, target_y)
MANUAL_CORRECTIONS = {
    # Gondor locations - need to move north
    'Minas Tirith': (42, 35),
    'Osgiliath': (44, 36),
    'Pelargir': (40, 25),
    'Dol Amroth': (32, 25),
    'Linhir': (36, 24),
    'Calembel': (35, 28),
    'Pinnath Gelin': (30, 28),
    
    # Rohan - slight adjustments
    'Edoras': (34, 45),
    'Cuernavilla': (33, 47),
    'El Sagrario': (32, 46),
    
    # Eriador - adjust westward
    'Puertos Grises': (6, 48),
    'Forlindon': (5, 45),
    'Harlindon': (4, 38),
    'Mithlond': (6, 48),
    
    # Mordor adjustments
    'Barad-dûr': (56, 38),
    'Monte del Destino': (54, 38),
    'Morannon': (50, 42),
    'Minas Morgul': (48, 35),
    'Cirith Ungol': (50, 33),
    
    # Northern locations
    'Annúminas': (14, 65),
    'Fornost': (18, 68),
    
    # Rivendell area
    'Rivendell': (26, 62),
    'Imladris': (26, 62),
}

def fine_tune_locations():
    """Apply fine-tuning corrections."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db['locations']
    
    updated = 0
    
    for loc_pattern, (target_x, target_y) in MANUAL_CORRECTIONS.items():
        # Find location by name pattern
        result = collection.update_many(
            {'nombre': {'$regex': loc_pattern, '$options': 'i'}},
            {'$set': {'x': target_x, 'y': target_y}}
        )
        if result.modified_count > 0:
            print(f"Updated {loc_pattern}: ({target_x}, {target_y}) - {result.modified_count} locations")
            updated += result.modified_count
    
    print(f"\nTotal updated: {updated}")
    
    # Verify key locations
    print("\n=== Verification ===")
    key_names = ['Minas Tirith', 'Hobbiton', 'Erebor', 'Edoras', 'Barad-dûr', 'Puertos Grises']
    for loc in collection.find({}):
        nombre = loc.get('nombre', '')
        if any(k.lower() in nombre.lower() for k in key_names):
            print(f"{nombre}: x={loc.get('x')}, y={loc.get('y')}")
    
    client.close()

if __name__ == '__main__':
    print("Fine-tuning location coordinates (v3)...")
    fine_tune_locations()
    print("\nDone!")
