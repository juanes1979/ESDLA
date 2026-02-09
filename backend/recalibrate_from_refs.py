#!/usr/bin/env python3
"""
Recalibrate locations based on 6 user-positioned reference points.
Uses distance-weighted interpolation for better accuracy.

Reference points (moved by user):
- Barad-dûr: (72, 35) -> (76.9, 38)
- Udûn: (64, 42) -> (72.5, 38.6)
- Yermo Oriental: (85, 40) -> (96.4, 37.1)
- Camino de Rhûn: (75, 42) -> (79.2, 41.8)
- Minas Morgul: (60, 32) -> (69.9, 33.3)
- Dorwinion: (88, 58) -> (89.6, 63.4)

These references are mostly in the eastern regions (Mordor, Rhûn).
For western regions, we'll apply a scaled transformation.
"""

import os
import math
from pymongo import MongoClient

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Reference points: original -> new position
REFERENCES = {
    'Barad-dûr': {'orig': (72, 35), 'new': (76.9, 38)},
    'Udûn': {'orig': (64, 42), 'new': (72.5, 38.6)},
    'Yermo Oriental': {'orig': (85, 40), 'new': (96.4, 37.1)},
    'Camino de Rhûn': {'orig': (75, 42), 'new': (79.2, 41.8)},
    'Minas Morgul': {'orig': (60, 32), 'new': (69.9, 33.3)},
    'Dorwinion': {'orig': (88, 58), 'new': (89.6, 63.4)},
}

# Locations to skip (already positioned by user or should not be moved)
SKIP_LOCATIONS = [
    'Barad-dûr', 'Udûn', 'Yermo Oriental', 'Camino de Rhûn', 
    'Minas Morgul', 'Dorwinion', 'Mar de Rhûn'
]

def calculate_transformation():
    """
    Calculate average transformation factors from reference points.
    The transformation is: new = orig * scale + offset
    """
    deltas_x = []
    deltas_y = []
    scales_x = []
    scales_y = []
    
    for name, ref in REFERENCES.items():
        orig_x, orig_y = ref['orig']
        new_x, new_y = ref['new']
        
        deltas_x.append(new_x - orig_x)
        deltas_y.append(new_y - orig_y)
        
        if orig_x > 0:
            scales_x.append(new_x / orig_x)
        if orig_y > 0:
            scales_y.append(new_y / orig_y)
    
    return {
        'scale_x': sum(scales_x) / len(scales_x),
        'scale_y': sum(scales_y) / len(scales_y),
        'offset_x': sum(deltas_x) / len(deltas_x),
        'offset_y': sum(deltas_y) / len(deltas_y),
    }

def transform_coordinate(orig_x, orig_y, region):
    """
    Transform a coordinate based on the reference points.
    
    Strategy:
    - For eastern regions (x > 50): Apply full transformation
    - For central regions (30 < x < 50): Apply scaled transformation
    - For western regions (x < 30): Apply minimal transformation (mostly offset)
    """
    trans = calculate_transformation()
    
    # Calculate base transformation
    # Use a blend of scale and offset based on position
    
    if orig_x >= 60:
        # Eastern regions - full transformation
        new_x = orig_x * trans['scale_x']
        new_y = orig_y * trans['scale_y']
    elif orig_x >= 40:
        # Central-eastern - blend
        blend = (orig_x - 40) / 20  # 0 at x=40, 1 at x=60
        scale_factor_x = 1 + (trans['scale_x'] - 1) * blend
        scale_factor_y = 1 + (trans['scale_y'] - 1) * blend
        offset_x = trans['offset_x'] * blend
        offset_y = trans['offset_y'] * blend
        new_x = orig_x * scale_factor_x + offset_x * 0.5
        new_y = orig_y * scale_factor_y + offset_y * 0.5
    elif orig_x >= 25:
        # Central - minimal scale, some offset
        blend = (orig_x - 25) / 15  # 0 at x=25, 1 at x=40
        new_x = orig_x + trans['offset_x'] * blend * 0.3
        new_y = orig_y + trans['offset_y'] * blend * 0.3
    else:
        # Western regions - keep mostly as is, tiny adjustment
        new_x = orig_x
        new_y = orig_y
    
    # Clamp to valid range
    new_x = max(3, min(97, new_x))
    new_y = max(3, min(97, new_y))
    
    return round(new_x, 1), round(new_y, 1)

def recalibrate_all():
    """Recalibrate all locations based on reference points."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db['locations']
    
    trans = calculate_transformation()
    print("=== Transformation Parameters ===")
    print(f"Scale X: {trans['scale_x']:.4f}")
    print(f"Scale Y: {trans['scale_y']:.4f}")
    print(f"Offset X: {trans['offset_x']:.2f}")
    print(f"Offset Y: {trans['offset_y']:.2f}")
    print()
    
    locations = list(collection.find({}))
    print(f"Processing {len(locations)} locations...")
    
    updated = 0
    skipped = 0
    
    for loc in locations:
        nombre = loc.get('nombre', '')
        
        # Skip user-positioned locations
        if nombre in SKIP_LOCATIONS:
            skipped += 1
            continue
        
        # Get original coordinates
        orig_x = loc.get('original_x', loc.get('x', 50))
        orig_y = loc.get('original_y', loc.get('y', 50))
        region = loc.get('region', '')
        
        # Calculate new position
        new_x, new_y = transform_coordinate(orig_x, orig_y, region)
        
        # Update in database
        collection.update_one(
            {'_id': loc['_id']},
            {'$set': {'x': new_x, 'y': new_y}}
        )
        updated += 1
    
    print(f"\nUpdated: {updated}")
    print(f"Skipped: {skipped}")
    
    # Show some examples
    print("\n=== Sample Results ===")
    samples = ['Hobbiton', 'Bree', 'Rivendel', 'Isengard', 'Edoras', 
               'Minas Tirith', 'Osgiliath', 'Erebor', 'Morannon', 'Pelargir']
    
    for loc in collection.find({}):
        if loc.get('nombre') in samples:
            print(f"{loc['nombre']}: ({loc.get('x')}, {loc.get('y')})")
    
    client.close()

if __name__ == '__main__':
    print("Recalibrating based on 6 user reference points...\n")
    recalibrate_all()
    print("\nDone!")
