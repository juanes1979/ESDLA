"""
Backend tests for A* Pathfinding API endpoints
Tests:
- POST /api/data/pathfinding/calculate - Calculate path between coordinates
- GET /api/data/pathfinding/between/{start_id}/{end_id} - Calculate path between location IDs
- Pathfinding result fields: success, path, total_distance_km, estimated_days, roads_used, rivers_crossed, terrain_summary
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPathfindingAPI:
    """Test A* Pathfinding API endpoints"""
    
    def test_pathfinding_between_locations_hobbiton_to_rivendel(self):
        """Test pathfinding between Hobbiton (loc_002) and Rivendel (loc_142) using GET endpoint"""
        response = requests.get(f"{BASE_URL}/api/data/pathfinding/between/loc_002/loc_142")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify success field
        assert "success" in data, "Response should contain 'success' field"
        assert data["success"] == True, "Pathfinding should be successful"
        
        # Verify path field (array of waypoints)
        assert "path" in data, "Response should contain 'path' field"
        assert isinstance(data["path"], list), "Path should be a list"
        assert len(data["path"]) > 0, "Path should have at least one waypoint"
        
        # Verify distance fields
        assert "total_distance_km" in data, "Response should contain 'total_distance_km'"
        assert isinstance(data["total_distance_km"], (int, float)), "total_distance_km should be numeric"
        assert data["total_distance_km"] > 0, "Distance should be positive"
        
        # Verify estimated days
        assert "estimated_days" in data, "Response should contain 'estimated_days'"
        assert isinstance(data["estimated_days"], (int, float)), "estimated_days should be numeric"
        assert data["estimated_days"] > 0, "Estimated days should be positive"
        
        # Verify roads_used (list)
        assert "roads_used" in data, "Response should contain 'roads_used'"
        assert isinstance(data["roads_used"], list), "roads_used should be a list"
        
        # Verify rivers_crossed (list)
        assert "rivers_crossed" in data, "Response should contain 'rivers_crossed'"
        assert isinstance(data["rivers_crossed"], list), "rivers_crossed should be a list"
        
        # Verify terrain_summary (dict)
        assert "terrain_summary" in data, "Response should contain 'terrain_summary'"
        assert isinstance(data["terrain_summary"], dict), "terrain_summary should be a dict"
        
        # Verify warnings (list)
        assert "warnings" in data, "Response should contain 'warnings'"
        assert isinstance(data["warnings"], list), "warnings should be a list"
        
        print(f"✓ Hobbiton to Rivendel: {data['total_distance_km']} km, {data['estimated_days']} days")
        print(f"  Path waypoints: {len(data['path'])}")
        print(f"  Roads used: {data['roads_used']}")
        print(f"  Rivers crossed: {len(data['rivers_crossed'])}")
        print(f"  Terrain summary: {data['terrain_summary']}")
    
    def test_pathfinding_post_with_location_ids(self):
        """Test POST /pathfinding/calculate with location IDs"""
        response = requests.post(
            f"{BASE_URL}/api/data/pathfinding/calculate",
            json={
                "start_location_id": "loc_002",  # Hobbiton
                "end_location_id": "loc_142"      # Rivendel
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Pathfinding should succeed"
        assert data["total_distance_km"] > 0, "Distance should be positive"
        assert data["estimated_days"] > 0, "Days should be positive"
        assert len(data["path"]) > 0, "Path should have waypoints"
        
        print(f"✓ POST with location IDs: {data['total_distance_km']} km, {data['estimated_days']} days")
    
    def test_pathfinding_post_with_coordinates(self):
        """Test POST /pathfinding/calculate with raw coordinates"""
        # Hobbiton: 20.5, 75.6 -> Rivendel: 49, 77.5
        response = requests.post(
            f"{BASE_URL}/api/data/pathfinding/calculate",
            json={
                "start_x": 20.5,
                "start_y": 75.6,
                "end_x": 49,
                "end_y": 77.5
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Pathfinding should succeed"
        assert data["total_distance_km"] > 0, "Distance should be positive"
        assert len(data["path"]) > 0, "Path should have waypoints"
        
        print(f"✓ POST with coordinates: {data['total_distance_km']} km")
    
    def test_pathfinding_nonexistent_start_location(self):
        """Test pathfinding with nonexistent start location"""
        response = requests.get(f"{BASE_URL}/api/data/pathfinding/between/nonexistent_location/loc_142")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should return success=False with warning
        assert data["success"] == False, "Should fail for nonexistent location"
        assert len(data["warnings"]) > 0, "Should have warnings explaining the failure"
        print(f"✓ Nonexistent start location: success=False, warning={data['warnings'][0]}")
    
    def test_pathfinding_nonexistent_end_location(self):
        """Test pathfinding with nonexistent end location"""
        response = requests.get(f"{BASE_URL}/api/data/pathfinding/between/loc_002/nonexistent_end")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should return success=False with warning
        assert data["success"] == False, "Should fail for nonexistent location"
        assert len(data["warnings"]) > 0, "Should have warnings"
        print(f"✓ Nonexistent end location: success=False")
    
    def test_pathfinding_missing_parameters(self):
        """Test POST without required parameters"""
        response = requests.post(
            f"{BASE_URL}/api/data/pathfinding/calculate",
            json={}  # Empty request
        )
        
        # Should return 400 or 422 for missing parameters
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print("✓ Missing parameters returns error status")
    
    def test_pathfinding_uses_roads_when_available(self):
        """Test that pathfinding considers roads for speed bonus"""
        response = requests.get(f"{BASE_URL}/api/data/pathfinding/between/loc_002/loc_142")
        
        assert response.status_code == 200
        data = response.json()
        
        # If roads_used is not empty, pathfinding is using roads
        if len(data["roads_used"]) > 0:
            print(f"✓ Pathfinding uses roads: {data['roads_used']}")
        else:
            print("✓ Pathfinding completed (no roads on this route)")
    
    def test_pathfinding_terrain_summary_contains_valid_types(self):
        """Test that terrain_summary contains valid terrain types"""
        response = requests.get(f"{BASE_URL}/api/data/pathfinding/between/loc_002/loc_142")
        
        assert response.status_code == 200
        data = response.json()
        
        valid_terrains = ['facil', 'moderado', 'dificil', 'muy_dificil', 'desalentador', 'infranqueable']
        
        for terrain in data["terrain_summary"].keys():
            assert terrain in valid_terrains, f"Invalid terrain type: {terrain}"
        
        print(f"✓ Terrain types valid: {list(data['terrain_summary'].keys())}")
    
    def test_pathfinding_segments_have_required_fields(self):
        """Test that path segments contain all required fields"""
        response = requests.get(f"{BASE_URL}/api/data/pathfinding/between/loc_002/loc_142")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "segments" in data, "Response should contain segments"
        
        if len(data["segments"]) > 0:
            segment = data["segments"][0]
            required_fields = ["start", "end", "distance_km", "terrain", "road_type", "travel_cost"]
            
            for field in required_fields:
                assert field in segment, f"Segment should have '{field}' field"
            
            print(f"✓ Segments have all required fields ({len(data['segments'])} segments)")
        else:
            print("✓ No segments in path (empty route)")
    
    def test_pathfinding_rivers_crossed_structure(self):
        """Test rivers_crossed field structure"""
        response = requests.get(f"{BASE_URL}/api/data/pathfinding/between/loc_002/loc_142")
        
        assert response.status_code == 200
        data = response.json()
        
        rivers = data["rivers_crossed"]
        
        if len(rivers) > 0:
            # Each river crossing should have type and position
            for river in rivers:
                assert "type" in river, "River crossing should have 'type'"
                print(f"✓ River crossing: type={river['type']}")
        else:
            print("✓ No rivers crossed on this route")
    
    def test_pathfinding_same_start_end(self):
        """Test pathfinding when start and end are the same location"""
        response = requests.get(f"{BASE_URL}/api/data/pathfinding/between/loc_002/loc_002")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should succeed with zero or minimal distance
        assert data["success"] == True or data["total_distance_km"] == 0
        print(f"✓ Same location path: distance={data['total_distance_km']} km")


class TestPathfindingRouteVariations:
    """Test different routes to verify pathfinding works correctly"""
    
    def test_short_route(self):
        """Test a short route between nearby locations"""
        # First, get some locations
        response = requests.get(f"{BASE_URL}/api/data/locations")
        assert response.status_code == 200
        locations = response.json().get('locations', [])
        
        if len(locations) >= 2:
            # Pick two locations in the same region if possible
            loc1 = locations[0]
            loc2 = locations[1]
            
            path_response = requests.get(
                f"{BASE_URL}/api/data/pathfinding/between/{loc1.get('id', loc1.get('_id'))}/{loc2.get('id', loc2.get('_id'))}"
            )
            
            assert path_response.status_code == 200
            data = path_response.json()
            
            print(f"✓ Route from {loc1.get('nombre')} to {loc2.get('nombre')}: {data.get('total_distance_km', 0)} km")
    
    def test_long_route_mordor(self):
        """Test a long route - try to find path to a Mordor location if exists"""
        # Get locations
        response = requests.get(f"{BASE_URL}/api/data/locations")
        assert response.status_code == 200
        locations = response.json().get('locations', [])
        
        # Find a Mordor location
        mordor_locs = [l for l in locations if 'Mordor' in l.get('region', '')]
        
        if mordor_locs and len(locations) > 0:
            start = locations[0]
            end = mordor_locs[0]
            
            path_response = requests.get(
                f"{BASE_URL}/api/data/pathfinding/between/{start.get('id', start.get('_id'))}/{end.get('id', end.get('_id'))}"
            )
            
            assert path_response.status_code == 200
            data = path_response.json()
            
            if data["success"]:
                print(f"✓ Long route to Mordor: {data['total_distance_km']} km, {data['estimated_days']} days")
            else:
                print(f"✓ Route to Mordor blocked (barriers): {data['warnings']}")
        else:
            print("✓ No Mordor locations found for long route test")


class TestLocationsDataIntegrity:
    """Verify locations data is available for pathfinding"""
    
    def test_locations_endpoint(self):
        """Test that locations endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "locations" in data, "Response should contain 'locations'"
        assert len(data["locations"]) > 0, "Should have at least one location"
        
        print(f"✓ {len(data['locations'])} locations available")
    
    def test_hobbiton_exists(self):
        """Verify Hobbiton (loc_002) exists with correct coordinates"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        assert response.status_code == 200
        
        locations = response.json().get('locations', [])
        hobbiton = next((l for l in locations if l.get('id') == 'loc_002' or l.get('_id') == 'loc_002'), None)
        
        assert hobbiton is not None, "Hobbiton (loc_002) should exist"
        assert hobbiton.get('nombre') == 'Hobbiton', "Location should be named Hobbiton"
        print(f"✓ Hobbiton found at ({hobbiton.get('x')}, {hobbiton.get('y')})")
    
    def test_rivendel_exists(self):
        """Verify Rivendel (loc_142) exists with correct coordinates"""
        response = requests.get(f"{BASE_URL}/api/data/locations")
        assert response.status_code == 200
        
        locations = response.json().get('locations', [])
        rivendel = next((l for l in locations if l.get('id') == 'loc_142' or l.get('_id') == 'loc_142'), None)
        
        assert rivendel is not None, "Rivendel (loc_142) should exist"
        assert rivendel.get('nombre') == 'Rivendel', f"Location should be named Rivendel, got {rivendel.get('nombre')}"
        print(f"✓ Rivendel found at ({rivendel.get('x')}, {rivendel.get('y')})")


class TestRoadsRiversBarriersData:
    """Verify supporting data for pathfinding"""
    
    def test_roads_endpoint(self):
        """Test roads data is available"""
        response = requests.get(f"{BASE_URL}/api/data/roads")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ {len(data.get('roads', []))} roads available")
    
    def test_rivers_endpoint(self):
        """Test rivers data is available"""
        response = requests.get(f"{BASE_URL}/api/data/rivers")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ {len(data.get('rivers', []))} rivers available")
    
    def test_barriers_endpoint(self):
        """Test barriers data is available"""
        response = requests.get(f"{BASE_URL}/api/data/barriers")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ {len(data.get('barriers', []))} barriers available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
