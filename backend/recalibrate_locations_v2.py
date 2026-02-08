#!/usr/bin/env python3
"""
Script to recalibrate location coordinates for the unified Middle-earth map (v2).

This version uses more precise calibration based on visual analysis of the unified map.
The map shows Middle-earth with approximate pixel positions for key locations.

Map characteristics:
- Dimensions: approximately 2400x1600 pixels in the image
- SVG viewBox: 1000x900 in the application
- Coordinate system: 0-100 scale that maps to viewBox

Key visual reference points (identified from map analysis):
In unified map (approximate pixel %):
- Western sea starts at ~10% from left
- The Shire: ~18-22% X, ~35-40% Y
- Rivendell: ~28% X, ~30% Y
- Rohan/Edoras: ~35% X, ~45% Y
- Minas Tirith: ~42% X, ~50% Y
- Mordor center: ~55% X, ~35% Y
- Erebor: ~60% X, ~20% Y

The original coordinates were based on 4 separate maps covering:
- Eriador (northwest)
- Rhovanion (northeast)
- Gondor/Rohan (southwest)
- Mordor (southeast)
"""

import os
from pymongo import MongoClient

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

def transform_coordinates_v2(x, y, region, nombre):
    """
    Transform coordinates using a more precise method.
    
    The unified map has different proportions than the original 4-map system.
    We need to:
    1. Scale coordinates to match the unified map proportions
    2. Apply region-specific corrections
    3. Handle edge cases for locations near borders
    """
    
    # First, restore original coordinates if they exist
    # The original system had:
    # - X: 6-92 range, with west around 6-30, center 30-60, east 60-92
    # - Y: 6-82 range, with south around 6-30, center 30-60, north 60-82
    
    # For the unified map, we need to:
    # 1. Expand the X range to account for more eastern territory (Rhûn)
    # 2. Adjust Y to account for different north-south proportions
    
    # Scale factors based on visual analysis
    # The unified map is wider proportionally
    x_scale = 0.85
    y_scale = 0.95
    
    # Base transformation
    new_x = x * x_scale
    new_y = y * y_scale
    
    # Apply regional corrections based on careful visual analysis
    corrections = {
        # Eriador regions - need to shift west (left)
        'Eriador': {'dx': -8, 'dy': 5},
        'La Comarca': {'dx': -10, 'dy': 5},
        'Nan Curunír': {'dx': -6, 'dy': 3},
        
        # Central-west regions
        'Rohan': {'dx': -4, 'dy': 0},
        'Rohan/Gondor': {'dx': -3, 'dy': -2},
        
        # Gondor - need slight south adjustment
        'Gondor': {'dx': -2, 'dy': -5},
        'Gondor/Rohan': {'dx': -2, 'dy': -3},
        'Gondor/Mordor': {'dx': 0, 'dy': -5},
        'Gondor/Harad': {'dx': -2, 'dy': -10},
        
        # Mordor - in the center-east of unified map
        'Mordor': {'dx': 2, 'dy': -3},
        'Mordor/Harad': {'dx': 2, 'dy': -8},
        
        # Rhovanion - northeast
        'Rhovanion': {'dx': 0, 'dy': 3},
        'Bosque Negro': {'dx': -2, 'dy': 2},
        
        # Mountain ranges
        'Montañas Nubladas': {'dx': -3, 'dy': 2},
        'Este de las Montañas': {'dx': -2, 'dy': 0},
        
        # Far regions
        'Rhûn': {'dx': 5, 'dy': -5},
        'Harad': {'dx': 0, 'dy': -15},
        'Sur': {'dx': 0, 'dy': -18},
        'Norte': {'dx': -3, 'dy': 8},
        'Angmar': {'dx': -5, 'dy': 8},
        
        'Fangorn': {'dx': -5, 'dy': 2},
    }
    
    corr = corrections.get(region, {'dx': 0, 'dy': 0})
    new_x += corr['dx']
    new_y += corr['dy']
    
    # Special handling for specific important locations
    # These are manually calibrated to known map positions
    special_corrections = {
        'Hobbiton': (18, 58),
        'Bree': (20, 60),
        'Minas Tirith': (42, 28),
        'Osgiliath': (44, 29),
        'Edoras': (32, 42),
        'Isengard': (26, 50),
        'Erebor': (58, 68),
        'Valle': (57, 67),
        'Esgaroth': (56, 65),
        'Barad-dûr': (58, 35),
        'Morannon': (52, 40),
        'Minas Morgul': (50, 30),
        'Puertos Grises': (8, 52),
        'Annúminas': (16, 68),
        'Pelargir': (40, 18),
        'Dol Amroth': (32, 18),
        'Tharbad': (24, 42),
        'Rivendell': (28, 65),
        'Dol Guldur': (48, 52),
    }
    
    # Check if this is a special location
    for key, (spec_x, spec_y) in special_corrections.items():
        if key.lower() in nombre.lower():
            return spec_x, spec_y
    
    # Clamp to valid range
    new_x = max(5, min(95, new_x))
    new_y = max(5, min(95, new_y))
    
    return round(new_x, 1), round(new_y, 1)

def recalibrate_locations_v2():
    """
    Recalibrate all locations using v2 algorithm.
    """
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db['locations']
    
    # Get all locations
    locations = list(collection.find({}))
    print(f"Found {len(locations)} locations to recalibrate (v2)")
    
    updated = 0
    
    for loc in locations:
        # Get original coordinates (stored from previous calibration) or current
        orig_x = loc.get('original_x', loc.get('x', 50))
        orig_y = loc.get('original_y', loc.get('y', 50))
        region = loc.get('region', '')
        nombre = loc.get('nombre', '')
        
        new_x, new_y = transform_coordinates_v2(orig_x, orig_y, region, nombre)
        
        # Update
        collection.update_one(
            {'_id': loc['_id']},
            {
                '$set': {
                    'x': new_x,
                    'y': new_y,
                }
            }
        )
        updated += 1
    
    print(f"Updated {updated} locations")
    
    # Verify key locations
    print("\n=== Key locations verification ===")
    key_names = ['Hobbiton', 'Minas Tirith', 'Erebor', 'Edoras', 'Barad-dûr', 'Bree', 'Puertos Grises', 'Morannon']
    for loc in collection.find({}):
        nombre = loc.get('nombre', '')
        if any(k.lower() in nombre.lower() for k in key_names):
            print(f"{nombre}: x={loc.get('x')}, y={loc.get('y')}, region={loc.get('region')}")
    
    client.close()

if __name__ == '__main__':
    print("Recalibrating locations for unified map (v2)...")
    recalibrate_locations_v2()
    print("\nDone!")
