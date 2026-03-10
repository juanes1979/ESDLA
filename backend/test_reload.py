# Quick test to verify module loading
import sys
sys.path.insert(0, '/app/backend')

# Force fresh import
if 'routes.travel_routes' in sys.modules:
    del sys.modules['routes.travel_routes']

from routes.travel_routes import DEFAULT_ROAD_TYPES

print("DEFAULT_ROAD_TYPES from travel_routes.py:")
for r in DEFAULT_ROAD_TYPES:
    print(f"  - {r['nombre']} (id={r['id']})")
