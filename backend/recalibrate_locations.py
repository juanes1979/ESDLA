#!/usr/bin/env python3
"""
Script to recalibrate all 182 location coordinates for the unified Middle-earth map.

The unified map has dimensions 2400x1600 pixels and includes:
- Western coast with Eriador
- Central regions: Rohan, Gondor
- Eastern regions: Mordor, Rhovanion
- Extended east: Rhûn, Khand (partially visible)
- North: Forodwaith

Reference calibration points (estimated from visual analysis):
Map Image Coordinates (pixels) -> Target SVG Coordinates (0-100 scale)

Key locations in unified map (approximate pixel positions in 2400x1600):
- The Shire (Comarca): ~(350, 550) -> target: x=15, y=66
- Bree: ~(420, 520) -> target: x=18, y=68
- Rivendell: ~(550, 450) -> target: x=23, y=72
- Isengard: ~(550, 700) -> target: x=23, y=56
- Edoras: ~(620, 720) -> target: x=26, y=55
- Minas Tirith: ~(750, 780) -> target: x=31, y=51
- Osgiliath: ~(780, 770) -> target: x=33, y=52
- Minas Morgul: ~(850, 720) -> target: x=35, y=55
- Mordor center: ~(950, 600) -> target: x=40, y=63
- Barad-dûr: ~(1000, 650) -> target: x=42, y=59
- Erebor: ~(1100, 350) -> target: x=46, y=78
- Dale/Valle: ~(1090, 360) -> target: x=45, y=78
- Dol Guldur: ~(900, 500) -> target: x=38, y=69
- Lorien: ~(800, 550) -> target: x=33, y=66
"""

import os
import sys
from pymongo import MongoClient

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'lotr_game')

def get_transformation_params():
    """
    Calculate transformation parameters based on key reference points.
    
    Original coordinates were based on 4 separate maps with different scales.
    The unified map has different proportions and extends further east.
    
    Transformation approach:
    1. Scale X coordinates to fit the wider unified map
    2. Adjust Y coordinates for the different vertical proportions
    3. Apply regional offsets for better accuracy
    """
    
    # Original coordinate ranges (from 4-map system)
    orig_x_min, orig_x_max = 6, 92
    orig_y_min, orig_y_max = 6, 82
    
    # Target coordinate ranges for unified map (SVG viewBox 0-1000 x 0-900)
    # But we use 0-100 coordinate system that maps to this
    
    # The unified map is wider, so we need to compress X slightly
    # and shift everything to account for the western ocean being more visible
    
    return {
        'x_scale': 0.75,      # Compress X (map is wider, less dense)
        'x_offset': 8,        # Shift east slightly
        'y_scale': 0.90,      # Slight Y adjustment
        'y_offset': 5,        # Shift up slightly
    }

def transform_coordinates(x, y, region):
    """
    Transform coordinates from old system to new unified map system.
    Apply region-specific adjustments for better accuracy.
    """
    params = get_transformation_params()
    
    # Base transformation
    new_x = x * params['x_scale'] + params['x_offset']
    new_y = y * params['y_scale'] + params['y_offset']
    
    # Region-specific adjustments
    region_adjustments = {
        # Western regions - shift west
        'Eriador': {'x': -3, 'y': 2},
        'La Comarca': {'x': -5, 'y': 2},
        'Nan Curunír': {'x': -2, 'y': 0},
        
        # Central regions - minor adjustments
        'Rohan': {'x': 0, 'y': -2},
        'Rohan/Gondor': {'x': 0, 'y': -2},
        'Gondor': {'x': 2, 'y': -4},
        'Gondor/Rohan': {'x': 1, 'y': -3},
        'Gondor/Mordor': {'x': 3, 'y': -3},
        'Gondor/Harad': {'x': 2, 'y': -5},
        
        # Eastern regions - shift for wider map
        'Mordor': {'x': 5, 'y': -2},
        'Mordor/Harad': {'x': 5, 'y': -5},
        
        # Northern Rhovanion - adjust for map proportions
        'Rhovanion': {'x': 3, 'y': 0},
        'Bosque Negro': {'x': 2, 'y': 0},
        'Montañas Nubladas': {'x': 0, 'y': 0},
        
        # Far regions
        'Rhûn': {'x': 8, 'y': -3},
        'Harad': {'x': 3, 'y': -8},
        'Norte': {'x': 0, 'y': 3},
        'Angmar': {'x': -2, 'y': 3},
        'Sur': {'x': 3, 'y': -10},
        'Este de las Montañas': {'x': 2, 'y': 0},
        'Fangorn': {'x': -2, 'y': 0},
    }
    
    adj = region_adjustments.get(region, {'x': 0, 'y': 0})
    new_x += adj['x']
    new_y += adj['y']
    
    # Clamp to valid range (leaving some margin)
    new_x = max(3, min(97, new_x))
    new_y = max(3, min(97, new_y))
    
    return round(new_x, 1), round(new_y, 1)

def recalibrate_all_locations():
    """
    Recalibrate all locations in the database.
    """
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db['locations']
    
    # Get all locations
    locations = list(collection.find({}))
    print(f"Found {len(locations)} locations to recalibrate")
    
    # Track changes
    updated = 0
    changes = []
    
    for loc in locations:
        old_x = loc.get('x', 50)
        old_y = loc.get('y', 50)
        region = loc.get('region', '')
        nombre = loc.get('nombre', '')
        
        new_x, new_y = transform_coordinates(old_x, old_y, region)
        
        if old_x != new_x or old_y != new_y:
            # Store original coordinates for reference
            collection.update_one(
                {'_id': loc['_id']},
                {
                    '$set': {
                        'x': new_x,
                        'y': new_y,
                        'original_x': old_x,
                        'original_y': old_y
                    }
                }
            )
            updated += 1
            changes.append({
                'nombre': nombre,
                'region': region,
                'old': (old_x, old_y),
                'new': (new_x, new_y)
            })
    
    print(f"\nUpdated {updated} locations")
    
    # Show sample changes
    print("\n=== Sample changes ===")
    key_names = ['Hobbiton', 'Minas Tirith', 'Erebor', 'Edoras', 'Barad-dûr', 'Bree', 'Dol Guldur']
    for change in changes:
        if any(k.lower() in change['nombre'].lower() for k in key_names):
            print(f"{change['nombre']}: ({change['old'][0]}, {change['old'][1]}) -> ({change['new'][0]}, {change['new'][1]})")
    
    client.close()
    return updated

if __name__ == '__main__':
    print("Recalibrating locations for unified Middle-earth map...")
    recalibrate_all_locations()
    print("\nDone!")
