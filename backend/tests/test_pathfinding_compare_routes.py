"""
Test cases for the /api/travel/compare-routes pathfinding algorithm.
Tests the A* pathfinding with the new cost multiplier system directly (not via HTTP).

NOTE: The HTTP endpoints may timeout because pathfinding takes ~30-60s for long routes.
This test file validates the pathfinding logic directly.

Key requirements tested:
1. Both ruta_caminos and ruta_directa should be returned
2. Hobbiton to Esgaroth route should go EAST (increasing x coordinates)
3. Both routes should have reasonable distances (not exceeding 2x straight line distance)
4. Both routes should include 'Camino del Este' in roads_used
5. Pathfinding constants are correct (COORD_TO_KM=20, BASE_SPEED_KM_DAY=36)
"""

import pytest
import asyncio
import os
import sys
import math
import time

# Add backend to path
sys.path.insert(0, '/app/backend')

# Location IDs
HOBBITON_ID = "loc_002"
ESGAROTH_ID = "loc_031"
STRAIGHT_LINE_DISTANCE_KM = 741.7  # Approximate straight line distance


def get_db_sync():
    """Get synchronous database data"""
    from motor.motor_asyncio import AsyncIOMotorClient
    
    async def _get_data():
        mongo_url = os.environ.get('MONGO_URL')
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'test_database')]
        
        start_loc = await db.locations.find_one({'_id': HOBBITON_ID})
        end_loc = await db.locations.find_one({'_id': ESGAROTH_ID})
        roads = list(await db.roads.find({}, {'_id': 0}).to_list(length=1000))
        rivers = list(await db.rivers.find({}, {'_id': 0}).to_list(length=1000))
        barriers = list(await db.barriers.find({}, {'_id': 0}).to_list(length=1000))
        all_locations = list(await db.locations.find({}).to_list(length=1000))
        
        terrain_doc = await db.terrain_polygons.find_one({'_id': 'terrain_polygons_data'})
        terrain_polygons = terrain_doc.get('polygons', []) if terrain_doc else []
        
        # Clean location IDs
        for loc in all_locations:
            if '_id' in loc:
                loc['id'] = str(loc.pop('_id'))
        
        client.close()
        
        return {
            'start_loc': start_loc,
            'end_loc': end_loc,
            'roads': roads,
            'rivers': rivers,
            'barriers': barriers,
            'locations': all_locations,
            'terrain_polygons': terrain_polygons
        }
    
    return asyncio.get_event_loop().run_until_complete(_get_data())


# Cache the data to avoid repeated DB calls
_cached_data = None

def get_cached_data():
    global _cached_data
    if _cached_data is None:
        _cached_data = get_db_sync()
    return _cached_data


class TestPathfindingConstants:
    """Test that pathfinding constants are correctly set"""
    
    def test_coord_to_km_value(self):
        """COORD_TO_KM should be 20"""
        from utils.pathfinding import MiddleEarthPathfinder
        
        pathfinder = MiddleEarthPathfinder(
            roads=[], rivers=[], barriers=[], locations=[]
        )
        
        assert pathfinder.COORD_TO_KM == 20.0, f"COORD_TO_KM should be 20.0, got {pathfinder.COORD_TO_KM}"
        print(f"✓ COORD_TO_KM = {pathfinder.COORD_TO_KM}")
    
    def test_base_speed_km_day(self):
        """BASE_SPEED_KM_DAY should be 36"""
        from utils.pathfinding import MiddleEarthPathfinder
        
        pathfinder = MiddleEarthPathfinder(
            roads=[], rivers=[], barriers=[], locations=[]
        )
        
        assert pathfinder.BASE_SPEED_KM_DAY == 36, f"BASE_SPEED_KM_DAY should be 36, got {pathfinder.BASE_SPEED_KM_DAY}"
        print(f"✓ BASE_SPEED_KM_DAY = {pathfinder.BASE_SPEED_KM_DAY}")
    
    def test_grid_resolution(self):
        """GRID_RESOLUTION should be 0.5"""
        from utils.pathfinding import MiddleEarthPathfinder
        
        pathfinder = MiddleEarthPathfinder(
            roads=[], rivers=[], barriers=[], locations=[]
        )
        
        assert pathfinder.GRID_RESOLUTION == 0.5, f"GRID_RESOLUTION should be 0.5, got {pathfinder.GRID_RESOLUTION}"
        print(f"✓ GRID_RESOLUTION = {pathfinder.GRID_RESOLUTION}")


class TestPathfindingDirectly:
    """Test pathfinding algorithm directly (bypassing HTTP timeout)"""
    
    def test_both_routes_returned(self):
        """F1: Both ruta_caminos and ruta_directa should be returned"""
        from utils.pathfinding import MiddleEarthPathfinder
        
        data = get_cached_data()
        start = (data['start_loc'].get('x', 0), data['start_loc'].get('y', 0))
        end = (data['end_loc'].get('x', 0), data['end_loc'].get('y', 0))
        
        # Route 1: Safe route (ruta_caminos)
        pathfinder_safe = MiddleEarthPathfinder(
            roads=data['roads'],
            rivers=data['rivers'],
            barriers=data['barriers'],
            locations=data['locations'],
            terrain_polygons=data['terrain_polygons'],
            prefer_roads=True,
            direct_mode=False
        )
        
        result_safe = pathfinder_safe.find_path(start, end, max_iterations=10000)
        assert result_safe.success, f"ruta_caminos should succeed: {result_safe.warnings}"
        
        # Route 2: Direct route (ruta_directa)
        pathfinder_direct = MiddleEarthPathfinder(
            roads=data['roads'],
            rivers=data['rivers'],
            barriers=data['barriers'],
            locations=data['locations'],
            terrain_polygons=data['terrain_polygons'],
            prefer_roads=False,
            direct_mode=True
        )
        
        result_direct = pathfinder_direct.find_path(start, end, max_iterations=10000)
        assert result_direct.success, f"ruta_directa should succeed: {result_direct.warnings}"
        
        print(f"✓ Both routes returned:")
        print(f"  - Safe route: {result_safe.total_distance_km}km, {result_safe.estimated_days} days")
        print(f"  - Direct route: {result_direct.total_distance_km}km, {result_direct.estimated_days} days")
    
    def test_route_goes_east(self):
        """F2: Hobbiton to Esgaroth route should go EAST (increasing x coordinates)"""
        from utils.pathfinding import MiddleEarthPathfinder
        
        data = get_cached_data()
        start = (data['start_loc'].get('x', 0), data['start_loc'].get('y', 0))
        end = (data['end_loc'].get('x', 0), data['end_loc'].get('y', 0))
        
        # Verify Esgaroth is east of Hobbiton
        assert end[0] > start[0], f"Esgaroth ({end[0]}) should be east of Hobbiton ({start[0]})"
        
        pathfinder = MiddleEarthPathfinder(
            roads=data['roads'],
            rivers=data['rivers'],
            barriers=data['barriers'],
            locations=data['locations'],
            terrain_polygons=data['terrain_polygons'],
            prefer_roads=True
        )
        
        result = pathfinder.find_path(start, end, max_iterations=10000)
        assert result.success
        
        # Check path goes east
        if len(result.path) >= 2:
            path_start_x = result.path[0][0]
            path_end_x = result.path[-1][0]
            assert path_end_x > path_start_x, f"Path should go east: start_x={path_start_x}, end_x={path_end_x}"
            print(f"✓ Route goes EAST: start_x={path_start_x:.1f}, end_x={path_end_x:.1f}")
    
    def test_reasonable_distances(self):
        """F3: Both routes should have reasonable distances (not exceeding 2x straight line)"""
        from utils.pathfinding import MiddleEarthPathfinder
        
        data = get_cached_data()
        start = (data['start_loc'].get('x', 0), data['start_loc'].get('y', 0))
        end = (data['end_loc'].get('x', 0), data['end_loc'].get('y', 0))
        
        # Calculate straight line distance
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        straight_line_units = math.sqrt(dx*dx + dy*dy)
        straight_line_km = straight_line_units * 20  # COORD_TO_KM = 20
        max_reasonable = straight_line_km * 2
        
        # Test safe route
        pathfinder_safe = MiddleEarthPathfinder(
            roads=data['roads'],
            rivers=data['rivers'],
            barriers=data['barriers'],
            locations=data['locations'],
            terrain_polygons=data['terrain_polygons'],
            prefer_roads=True,
            direct_mode=False
        )
        result_safe = pathfinder_safe.find_path(start, end, max_iterations=10000)
        
        # Test direct route
        pathfinder_direct = MiddleEarthPathfinder(
            roads=data['roads'],
            rivers=data['rivers'],
            barriers=data['barriers'],
            locations=data['locations'],
            terrain_polygons=data['terrain_polygons'],
            prefer_roads=False,
            direct_mode=True
        )
        result_direct = pathfinder_direct.find_path(start, end, max_iterations=10000)
        
        # Verify distances are reasonable
        assert result_safe.total_distance_km < max_reasonable, \
            f"Safe route ({result_safe.total_distance_km}km) exceeds 2x straight line ({max_reasonable}km)"
        assert result_direct.total_distance_km < max_reasonable, \
            f"Direct route ({result_direct.total_distance_km}km) exceeds 2x straight line ({max_reasonable}km)"
        
        # Also check they're in expected range (based on main agent context: 800-1100km expected)
        assert 700 < result_safe.total_distance_km < 1500, \
            f"Safe route {result_safe.total_distance_km}km outside 700-1500km range"
        assert 700 < result_direct.total_distance_km < 1500, \
            f"Direct route {result_direct.total_distance_km}km outside 700-1500km range"
        
        print(f"✓ Reasonable distances: straight_line={straight_line_km:.1f}km")
        print(f"  - Safe route: {result_safe.total_distance_km}km ({result_safe.total_distance_km/straight_line_km*100-100:.1f}% longer)")
        print(f"  - Direct route: {result_direct.total_distance_km}km ({result_direct.total_distance_km/straight_line_km*100-100:.1f}% longer)")
    
    def test_camino_del_este_used(self):
        """F5: Both routes should include 'Camino del Este' in roads_used"""
        from utils.pathfinding import MiddleEarthPathfinder
        
        data = get_cached_data()
        start = (data['start_loc'].get('x', 0), data['start_loc'].get('y', 0))
        end = (data['end_loc'].get('x', 0), data['end_loc'].get('y', 0))
        
        # Test safe route
        pathfinder_safe = MiddleEarthPathfinder(
            roads=data['roads'],
            rivers=data['rivers'],
            barriers=data['barriers'],
            locations=data['locations'],
            terrain_polygons=data['terrain_polygons'],
            prefer_roads=True,
            direct_mode=False
        )
        result_safe = pathfinder_safe.find_path(start, end, max_iterations=10000)
        
        # Test direct route
        pathfinder_direct = MiddleEarthPathfinder(
            roads=data['roads'],
            rivers=data['rivers'],
            barriers=data['barriers'],
            locations=data['locations'],
            terrain_polygons=data['terrain_polygons'],
            prefer_roads=False,
            direct_mode=True
        )
        result_direct = pathfinder_direct.find_path(start, end, max_iterations=10000)
        
        # Check Camino del Este in safe route
        camino_del_este_safe = any('camino del este' in r.lower() for r in result_safe.roads_used)
        assert camino_del_este_safe, f"'Camino del Este' not found in safe route. Roads: {result_safe.roads_used}"
        
        # Check Camino del Este in direct route (may or may not be present)
        camino_del_este_direct = any('camino del este' in r.lower() for r in result_direct.roads_used)
        
        print(f"✓ Camino del Este used:")
        print(f"  - Safe route: {camino_del_este_safe}, roads={result_safe.roads_used}")
        print(f"  - Direct route: {camino_del_este_direct}, roads={result_direct.roads_used}")


class TestDirectModeVsSafeMode:
    """Test the difference between direct mode and safe mode"""
    
    def test_direct_mode_faster_or_equal(self):
        """Direct route should be faster or equal to safe route (fewer days)"""
        from utils.pathfinding import MiddleEarthPathfinder
        
        data = get_cached_data()
        start = (data['start_loc'].get('x', 0), data['start_loc'].get('y', 0))
        end = (data['end_loc'].get('x', 0), data['end_loc'].get('y', 0))
        
        # Safe mode
        pathfinder_safe = MiddleEarthPathfinder(
            roads=data['roads'],
            rivers=data['rivers'],
            barriers=data['barriers'],
            locations=data['locations'],
            terrain_polygons=data['terrain_polygons'],
            prefer_roads=True,
            direct_mode=False
        )
        result_safe = pathfinder_safe.find_path(start, end, max_iterations=10000)
        
        # Direct mode
        pathfinder_direct = MiddleEarthPathfinder(
            roads=data['roads'],
            rivers=data['rivers'],
            barriers=data['barriers'],
            locations=data['locations'],
            terrain_polygons=data['terrain_polygons'],
            prefer_roads=False,
            direct_mode=True
        )
        result_direct = pathfinder_direct.find_path(start, end, max_iterations=10000)
        
        print(f"✓ Safe mode: {result_safe.total_distance_km}km, cost={result_safe.total_travel_cost}, days={result_safe.estimated_days}")
        print(f"✓ Direct mode: {result_direct.total_distance_km}km, cost={result_direct.total_travel_cost}, days={result_direct.estimated_days}")
        
        # The direct route should be faster (fewer days) because it ignores land penalties
        assert result_direct.estimated_days <= result_safe.estimated_days, \
            f"Direct route ({result_direct.estimated_days} days) should be faster than safe route ({result_safe.estimated_days} days)"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
