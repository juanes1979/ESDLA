#!/usr/bin/env python3
"""
Recalibrate all locations using 13 user-positioned reference points.
Uses bilinear interpolation based on region and position.

References from EAST (Mordor/Rhûn area):
- Barad-dûr: (72, 35) -> (76.9, 38)
- Udûn: (64, 42) -> (72.5, 38.6)
- Yermo Oriental: (85, 40) -> (96.4, 37.1)
- Camino de Rhûn: (75, 42) -> (79.2, 41.8)
- Minas Morgul: (60, 32) -> (69.9, 33.3)
- Dorwinion: (88, 58) -> (89.6, 63.4)

References from WEST/CENTER:
- Isengard: (16, 54) -> (42.4, 48.5)
- Belfalas: (36, 18) -> (49.4, 22.3)
- Dol Amroth: (38, 20) -> (46.7, 27.1)
- Dol Guldur: (52, 50) -> (61.7, 61)
- Moria: (41, 46) -> (47, 63.6)
- Fornost: (22, 70) -> (27.3, 81.7)
- Rivendel: (38, 60) -> (48.7, 76.6)
"""

import os
import math
from pymongo import MongoClient

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# All 13 reference points
REFERENCES = [
    # East references
    {'name': 'Barad-dûr', 'orig': (72, 35), 'new': (76.9, 38)},
    {'name': 'Udûn', 'orig': (64, 42), 'new': (72.5, 38.6)},
    {'name': 'Yermo Oriental', 'orig': (85, 40), 'new': (96.4, 37.1)},
    {'name': 'Camino de Rhûn', 'orig': (75, 42), 'new': (79.2, 41.8)},
    {'name': 'Minas Morgul', 'orig': (60, 32), 'new': (69.9, 33.3)},
    {'name': 'Dorwinion', 'orig': (88, 58), 'new': (89.6, 63.4)},
    # West/Center references
    {'name': 'Isengard', 'orig': (16, 54), 'new': (42.4, 48.5)},
    {'name': 'Belfalas', 'orig': (36, 18), 'new': (49.4, 22.3)},
    {'name': 'Dol Amroth', 'orig': (38, 20), 'new': (46.7, 27.1)},
    {'name': 'Dol Guldur', 'orig': (52, 50), 'new': (61.7, 61)},
    {'name': 'Moria', 'orig': (41, 46), 'new': (47, 63.6)},
    {'name': 'Fornost', 'orig': (22, 70), 'new': (27.3, 81.7)},
    {'name': 'Rivendel', 'orig': (38, 60), 'new': (48.7, 76.6)},
]

# Locations to skip (user-positioned)
SKIP_LOCATIONS = [
    'Barad-dûr', 'Udûn', 'Yermo Oriental', 'Camino de Rhûn', 
    'Minas Morgul', 'Dorwinion', 'Mar de Rhûn',
    'Isengard', 'Belfalas', 'Dol Amroth', 'Dol Guldur', 
    'Moria', 'Fornost', 'Rivendel'
]

def distance(p1, p2):
    """Calculate Euclidean distance between two points."""
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def inverse_distance_weighted(orig_x, orig_y, power=2):
    """
    Calculate new position using Inverse Distance Weighting (IDW).
    Each reference point contributes based on its distance from the target point.
    """
    total_weight = 0
    weighted_x = 0
    weighted_y = 0
    
    for ref in REFERENCES:
        orig = ref['orig']
        new = ref['new']
        
        dist = distance((orig_x, orig_y), orig)
        
        # If very close to a reference point, use its transformation directly
        if dist < 0.5:
            delta_x = new[0] - orig[0]
            delta_y = new[1] - orig[1]
            return orig_x + delta_x, orig_y + delta_y
        
        # Inverse distance weight
        weight = 1.0 / (dist ** power)
        
        # Calculate the delta this reference suggests
        delta_x = new[0] - orig[0]
        delta_y = new[1] - orig[1]
        
        weighted_x += weight * delta_x
        weighted_y += weight * delta_y
        total_weight += weight
    
    # Apply weighted average delta
    if total_weight > 0:
        avg_delta_x = weighted_x / total_weight
        avg_delta_y = weighted_y / total_weight
        
        new_x = orig_x + avg_delta_x
        new_y = orig_y + avg_delta_y
    else:
        new_x = orig_x
        new_y = orig_y
    
    # Clamp to valid range
    new_x = max(3, min(97, new_x))
    new_y = max(3, min(97, new_y))
    
    return round(new_x, 1), round(new_y, 1)

def recalibrate_all():
    """Recalibrate all locations using IDW interpolation."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db['locations']
    
    locations = list(collection.find({}))
    print(f"Processing {len(locations)} locations with IDW interpolation...")
    print(f"Using {len(REFERENCES)} reference points\n")
    
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
        
        # Calculate new position using IDW
        new_x, new_y = inverse_distance_weighted(orig_x, orig_y)
        
        # Update in database
        collection.update_one(
            {'_id': loc['_id']},
            {'$set': {'x': new_x, 'y': new_y}}
        )
        updated += 1
    
    print(f"Updated: {updated}")
    print(f"Skipped: {skipped}")
    
    # Show sample results
    print("\n=== Sample Results ===")
    samples = ['Hobbiton', 'Bree', 'Edoras', 'Minas Tirith', 'Osgiliath', 
               'Erebor', 'Morannon', 'Pelargir', 'La Comarca', 'Puertos Grises',
               'Annúminas', 'Lothlórien', 'Valle']
    
    for loc in collection.find({}):
        if loc.get('nombre') in samples:
            print(f"{loc['nombre']}: ({loc.get('x')}, {loc.get('y')})")
    
    client.close()

if __name__ == '__main__':
    print("Recalibrating using 13 reference points (IDW interpolation)...\n")
    recalibrate_all()
    print("\nDone!")
