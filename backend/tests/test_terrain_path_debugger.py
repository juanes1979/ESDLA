"""
Tests for Terrain Editor and Path Debugger API endpoints.
Features:
- Terrain zones (terrain difficulty) CRUD
- Land type zones CRUD
- Custom paths CRUD for Path Debugger
"""
import pytest
import requests
import os
import uuid

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ============================================================
# PATH DEBUGGER TESTS
# ============================================================

class TestCustomPaths:
    """Test custom paths endpoints for Path Debugger"""
    
    test_path_id = None  # Store created path ID for cleanup
    
    def test_get_custom_paths(self):
        """GET /api/data/custom-paths should return paths array"""
        response = requests.get(f"{BASE_URL}/api/data/custom-paths")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "paths" in data, "Response should contain 'paths' key"
        assert isinstance(data["paths"], list), "paths should be a list"
        print(f"✓ GET custom-paths returns {len(data['paths'])} paths")
    
    def test_save_custom_path(self):
        """POST /api/data/custom-paths should save a new path"""
        test_origin_id = "TEST_origin_" + uuid.uuid4().hex[:8]
        test_dest_id = "TEST_dest_" + uuid.uuid4().hex[:8]
        
        payload = {
            "origin_id": test_origin_id,
            "destination_id": test_dest_id,
            "origin_name": "Hobbiton Test",
            "destination_name": "Bree Test",
            "path_points": [
                {"x": 20.5, "y": 45.0},
                {"x": 21.0, "y": 45.5},
                {"x": 22.0, "y": 46.0},
                {"x": 23.5, "y": 46.5}
            ],
            "total_distance": 150.5,
            "description": "Test path from Hobbiton to Bree"
        }
        
        response = requests.post(f"{BASE_URL}/api/data/custom-paths", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain 'id' key"
        assert data["id"].startswith(test_origin_id), f"ID should start with origin_id"
        
        TestCustomPaths.test_path_id = data["id"]
        print(f"✓ POST custom-paths created path: {data['id']}")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/data/custom-paths/{data['id']}")
        assert get_response.status_code == 200
        saved_path = get_response.json()
        assert len(saved_path["path_points"]) == 4, "Path should have 4 points"
        assert saved_path["total_distance"] == 150.5
        print("✓ Verified custom path persisted correctly")
    
    def test_save_custom_path_minimum_points(self):
        """POST /api/data/custom-paths with minimum 2 points should work"""
        test_id = "TEST_min_" + uuid.uuid4().hex[:8]
        
        payload = {
            "origin_id": test_id,
            "destination_id": test_id + "_dest",
            "origin_name": "Point A",
            "destination_name": "Point B",
            "path_points": [
                {"x": 10.0, "y": 20.0},
                {"x": 11.0, "y": 21.0}
            ],
            "total_distance": 14.2,
            "description": "Minimum 2 point path"
        }
        
        response = requests.post(f"{BASE_URL}/api/data/custom-paths", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"✓ POST custom-paths with 2 points works: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/custom-paths/{data['id']}")
    
    def test_get_custom_path_by_route(self):
        """GET /api/data/custom-paths/route/{origin}/{dest} should find paths"""
        # First create a path with known IDs
        origin_id = "TEST_route_origin"
        dest_id = "TEST_route_dest"
        
        payload = {
            "origin_id": origin_id,
            "destination_id": dest_id,
            "origin_name": "Route Origin",
            "destination_name": "Route Dest",
            "path_points": [
                {"x": 40.0, "y": 50.0},
                {"x": 41.0, "y": 51.0}
            ],
            "total_distance": 20.0,
            "description": "Test route path"
        }
        
        # Create the path
        create_response = requests.post(f"{BASE_URL}/api/data/custom-paths", json=payload)
        assert create_response.status_code == 200
        created_id = create_response.json()["id"]
        
        # Get by route
        response = requests.get(f"{BASE_URL}/api/data/custom-paths/route/{origin_id}/{dest_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["found"] == True, "Should find the path"
        assert data["path"]["origin_id"] == origin_id
        print(f"✓ GET custom-paths by route finds path")
        
        # Test reverse direction
        reverse_response = requests.get(f"{BASE_URL}/api/data/custom-paths/route/{dest_id}/{origin_id}")
        assert reverse_response.status_code == 200
        reverse_data = reverse_response.json()
        assert reverse_data["found"] == True, "Should find path in reverse"
        print("✓ GET custom-paths by route works in reverse direction")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/data/custom-paths/{created_id}")
    
    def test_get_custom_path_not_found(self):
        """GET /api/data/custom-paths/route/{nonexistent} should return found=false"""
        response = requests.get(f"{BASE_URL}/api/data/custom-paths/route/nonexistent1/nonexistent2")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["found"] == False, "Should not find nonexistent path"
        assert data["path"] is None, "path should be None"
        print("✓ GET custom-paths for nonexistent route returns found=false")
    
    def test_delete_custom_path(self):
        """DELETE /api/data/custom-paths/{id} should remove path"""
        if TestCustomPaths.test_path_id:
            response = requests.delete(f"{BASE_URL}/api/data/custom-paths/{TestCustomPaths.test_path_id}")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            # Verify deleted
            get_response = requests.get(f"{BASE_URL}/api/data/custom-paths/{TestCustomPaths.test_path_id}")
            assert get_response.status_code == 404, "Path should be deleted"
            print(f"✓ DELETE custom-paths removed path")
        else:
            pytest.skip("No test path to delete")
    
    def test_delete_custom_path_not_found(self):
        """DELETE /api/data/custom-paths/{nonexistent} should return 404"""
        response = requests.delete(f"{BASE_URL}/api/data/custom-paths/nonexistent_path_id")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ DELETE custom-paths returns 404 for nonexistent path")


class TestCustomPathValidation:
    """Test validation for custom path endpoints"""
    
    def test_save_path_missing_origin(self):
        """POST /api/data/custom-paths without origin_id should fail"""
        payload = {
            # Missing origin_id
            "destination_id": "dest",
            "origin_name": "Origin",
            "destination_name": "Dest",
            "path_points": [{"x": 1.0, "y": 2.0}],
            "total_distance": 10.0
        }
        
        response = requests.post(f"{BASE_URL}/api/data/custom-paths", json=payload)
        assert response.status_code == 422, f"Expected 422 for missing origin_id, got {response.status_code}"
        print("✓ POST custom-paths validates required origin_id")
    
    def test_save_path_missing_points(self):
        """POST /api/data/custom-paths without path_points should fail"""
        payload = {
            "origin_id": "origin",
            "destination_id": "dest",
            "origin_name": "Origin",
            "destination_name": "Dest",
            # Missing path_points
            "total_distance": 10.0
        }
        
        response = requests.post(f"{BASE_URL}/api/data/custom-paths", json=payload)
        assert response.status_code == 422, f"Expected 422 for missing path_points, got {response.status_code}"
        print("✓ POST custom-paths validates required path_points")


# Cleanup function to run after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup any TEST_ prefixed data after tests"""
    yield
    # Cleanup terrain zones
    try:
        requests.delete(f"{BASE_URL}/api/data/terrain-zones")
        requests.delete(f"{BASE_URL}/api/data/land-type-zones")
    except:
        pass
    
    # Cleanup any test paths
    try:
        response = requests.get(f"{BASE_URL}/api/data/custom-paths")
        if response.status_code == 200:
            paths = response.json().get("paths", [])
            for path in paths:
                if "TEST_" in path.get("origin_id", "") or "TEST_" in path.get("id", ""):
                    requests.delete(f"{BASE_URL}/api/data/custom-paths/{path['id']}")
    except:
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
