"""
Pathfinding Module for Middle-earth Travel System
Implements A* algorithm with terrain costs, roads, rivers, and barriers
"""

import math
import heapq
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass, field
from enum import Enum


class TerrainType(Enum):
    """Terrain difficulty types with travel multipliers"""
    FACIL = ("facil", 1.0)
    MODERADO = ("moderado", 1.33)
    DIFICIL = ("dificil", 2.0)
    MUY_DIFICIL = ("muy_dificil", 3.0)
    DESALENTADOR = ("desalentador", 4.0)
    INFRANQUEABLE = ("infranqueable", float('inf'))
    
    def __init__(self, key: str, multiplier: float):
        self.key = key
        self.multiplier = multiplier
    
    @classmethod
    def from_string(cls, value: str) -> 'TerrainType':
        for terrain in cls:
            if terrain.key == value:
                return terrain
        return cls.MODERADO


class RoadType(Enum):
    """Road types with travel bonuses"""
    NINGUNO = ("ninguno", 1.0)
    SENDERO = ("sendero", 0.85)
    SECUNDARIO = ("secundario", 0.7)
    REAL = ("real", 0.5)
    
    def __init__(self, key: str, multiplier: float):
        self.key = key
        self.multiplier = multiplier
    
    @classmethod
    def from_string(cls, value: str) -> 'RoadType':
        for road in cls:
            if road.key == value:
                return road
        return cls.NINGUNO


class RiverType(Enum):
    """River types with crossing penalties"""
    VADEABLE = ("vadeable", 1.5, True)  # +50% time, mount allowed
    PROFUNDO = ("profundo", 3.0, False)  # +200% time, no mount
    INFRANQUEABLE = ("infranqueable", float('inf'), False)  # Requires bridge/boat
    
    def __init__(self, key: str, multiplier: float, mount_allowed: bool):
        self.key = key
        self.multiplier = multiplier
        self.mount_allowed = mount_allowed
    
    @classmethod
    def from_string(cls, value: str) -> 'RiverType':
        for river in cls:
            if river.key == value:
                return river
        return cls.PROFUNDO


@dataclass
class PathNode:
    """Node for A* pathfinding"""
    x: float
    y: float
    g_cost: float = 0  # Cost from start
    h_cost: float = 0  # Heuristic cost to end
    parent: Optional['PathNode'] = field(default=None, repr=False)
    road_type: str = "ninguno"
    terrain_type: str = "moderado"
    river_crossing: Optional[str] = None
    
    @property
    def f_cost(self) -> float:
        return self.g_cost + self.h_cost
    
    def __lt__(self, other: 'PathNode') -> bool:
        return self.f_cost < other.f_cost
    
    def __eq__(self, other: object) -> bool:
        if not isinstance(other, PathNode):
            return False
        return abs(self.x - other.x) < 0.5 and abs(self.y - other.y) < 0.5
    
    def __hash__(self) -> int:
        return hash((round(self.x, 1), round(self.y, 1)))


@dataclass
class PathSegment:
    """Segment of the calculated path with travel info"""
    start: Tuple[float, float]
    end: Tuple[float, float]
    distance_km: float
    terrain: str
    road_type: str
    river_crossing: Optional[str] = None
    travel_cost: float = 1.0
    description: str = ""


@dataclass
class PathResult:
    """Complete pathfinding result"""
    success: bool
    path: List[Tuple[float, float]]
    segments: List[PathSegment]
    total_distance_km: float
    total_travel_cost: float
    estimated_days: float
    warnings: List[str]
    rivers_crossed: List[Dict]
    roads_used: List[str]
    terrain_summary: Dict[str, float]


class MiddleEarthPathfinder:
    """
    A* Pathfinding for Middle-earth map
    Considers terrain, roads, rivers, and barriers
    """
    
    # Map scale: 1 coordinate unit ≈ 6.4 km (1 hex = 4 miles)
    COORD_TO_KM = 6.4
    
    # Grid resolution for pathfinding (smaller = more precise but slower)
    GRID_RESOLUTION = 1.0
    
    # Base travel speed (km/day at normal pace on easy terrain)
    BASE_SPEED_KM_DAY = 36
    
    def __init__(
        self,
        roads: List[Dict],
        rivers: List[Dict],
        barriers: List[Dict],
        locations: List[Dict],
        regions: Optional[List[Dict]] = None
    ):
        self.roads = roads
        self.rivers = rivers
        self.barriers = barriers
        self.locations = locations
        self.regions = regions or []
        
        # Pre-process data for efficient lookup
        self._build_road_network()
        self._build_river_segments()
        self._build_barrier_segments()
        self._build_location_map()
    
    def _build_road_network(self):
        """Build efficient road lookup structure"""
        self.road_points: Dict[Tuple[int, int], Dict] = {}
        self.road_segments: List[Dict] = []
        
        for road in self.roads:
            road_type = road.get('tipo', 'sendero')
            road_name = road.get('nombre', 'Unknown')
            points = road.get('puntos', [])
            
            for i, point in enumerate(points):
                grid_key = (round(point['x']), round(point['y']))
                if grid_key not in self.road_points:
                    self.road_points[grid_key] = {'type': road_type, 'name': road_name}
                
                # Store road segment for interpolation
                if i < len(points) - 1:
                    self.road_segments.append({
                        'start': (point['x'], point['y']),
                        'end': (points[i + 1]['x'], points[i + 1]['y']),
                        'type': road_type,
                        'name': road_name
                    })
    
    def _build_river_segments(self):
        """Build river segments for crossing detection"""
        self.river_segments: List[Dict] = []
        
        for river in self.rivers:
            river_type = river.get('tipo', 'profundo')
            river_name = river.get('nombre', 'Unknown')
            points = river.get('puntos', [])
            
            for i in range(len(points) - 1):
                self.river_segments.append({
                    'start': (points[i]['x'], points[i]['y']),
                    'end': (points[i + 1]['x'], points[i + 1]['y']),
                    'type': river_type,
                    'name': river_name
                })
    
    def _build_barrier_segments(self):
        """Build barrier segments for collision detection"""
        self.barrier_segments: List[Dict] = []
        
        for barrier in self.barriers:
            barrier_type = barrier.get('tipo', 'montana')
            barrier_name = barrier.get('nombre', 'Unknown')
            points = barrier.get('puntos', [])
            
            for i in range(len(points) - 1):
                self.barrier_segments.append({
                    'start': (points[i]['x'], points[i]['y']),
                    'end': (points[i + 1]['x'], points[i + 1]['y']),
                    'type': barrier_type,
                    'name': barrier_name
                })
    
    def _build_location_map(self):
        """Build location lookup by coordinates"""
        self.location_map: Dict[Tuple[int, int], Dict] = {}
        
        for loc in self.locations:
            grid_key = (round(loc.get('x', 0)), round(loc.get('y', 0)))
            self.location_map[grid_key] = {
                'name': loc.get('nombre', 'Unknown'),
                'terrain': loc.get('tipo_terreno', 'moderado'),
                'region_class': loc.get('clase_region', 'tierras_salvajes'),
                'is_mountain_pass': loc.get('es_paso_montana', False)
            }
    
    def _distance(self, p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
        """Euclidean distance between two points"""
        return math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2)
    
    def _point_to_segment_distance(
        self,
        point: Tuple[float, float],
        seg_start: Tuple[float, float],
        seg_end: Tuple[float, float]
    ) -> float:
        """Calculate distance from point to line segment"""
        px, py = point
        x1, y1 = seg_start
        x2, y2 = seg_end
        
        dx = x2 - x1
        dy = y2 - y1
        
        if dx == 0 and dy == 0:
            return self._distance(point, seg_start)
        
        t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
        
        proj_x = x1 + t * dx
        proj_y = y1 + t * dy
        
        return self._distance(point, (proj_x, proj_y))
    
    def _segments_intersect(
        self,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        p3: Tuple[float, float],
        p4: Tuple[float, float]
    ) -> bool:
        """Check if two line segments intersect"""
        def ccw(A, B, C):
            return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0])
        
        return ccw(p1, p3, p4) != ccw(p2, p3, p4) and ccw(p1, p2, p3) != ccw(p1, p2, p4)
    
    def _get_road_at_point(self, x: float, y: float) -> Optional[Dict]:
        """Get road info if point is near a road"""
        grid_key = (round(x), round(y))
        
        # Check direct grid match
        if grid_key in self.road_points:
            return self.road_points[grid_key]
        
        # Check nearby road segments
        point = (x, y)
        for segment in self.road_segments:
            dist = self._point_to_segment_distance(point, segment['start'], segment['end'])
            if dist < 1.5:  # Within 1.5 units of road
                return {'type': segment['type'], 'name': segment['name']}
        
        return None
    
    def _check_river_crossing(
        self,
        p1: Tuple[float, float],
        p2: Tuple[float, float]
    ) -> Optional[Dict]:
        """Check if path segment crosses a river"""
        for river_seg in self.river_segments:
            if self._segments_intersect(p1, p2, river_seg['start'], river_seg['end']):
                return {
                    'type': river_seg['type'],
                    'name': river_seg['name']
                }
        return None
    
    def _check_barrier_crossing(
        self,
        p1: Tuple[float, float],
        p2: Tuple[float, float]
    ) -> bool:
        """Check if path segment crosses a barrier (impassable)"""
        for barrier_seg in self.barrier_segments:
            if self._segments_intersect(p1, p2, barrier_seg['start'], barrier_seg['end']):
                return True
        return False
    
    def _get_terrain_at_point(self, x: float, y: float) -> str:
        """Get terrain type at point (from nearest location or default)"""
        grid_key = (round(x), round(y))
        
        if grid_key in self.location_map:
            return self.location_map[grid_key]['terrain']
        
        # Find nearest location
        min_dist = float('inf')
        nearest_terrain = 'moderado'
        
        for loc in self.locations:
            dist = self._distance((x, y), (loc.get('x', 0), loc.get('y', 0)))
            if dist < min_dist:
                min_dist = dist
                nearest_terrain = loc.get('tipo_terreno', 'moderado')
        
        return nearest_terrain
    
    def _calculate_move_cost(
        self,
        from_node: PathNode,
        to_x: float,
        to_y: float
    ) -> Tuple[float, str, str, Optional[str]]:
        """
        Calculate movement cost considering terrain, roads, and rivers
        Returns: (cost, road_type, terrain_type, river_crossing)
        """
        from_pos = (from_node.x, from_node.y)
        to_pos = (to_x, to_y)
        
        # Base distance
        distance = self._distance(from_pos, to_pos)
        
        # Check for barrier (impassable)
        if self._check_barrier_crossing(from_pos, to_pos):
            return (float('inf'), 'ninguno', 'infranqueable', None)
        
        # Get terrain
        terrain_str = self._get_terrain_at_point(to_x, to_y)
        terrain = TerrainType.from_string(terrain_str)
        
        # Get road bonus
        road_info = self._get_road_at_point(to_x, to_y)
        road_type_str = road_info['type'] if road_info else 'ninguno'
        road = RoadType.from_string(road_type_str)
        
        # Check river crossing
        river_crossing = self._check_river_crossing(from_pos, to_pos)
        river_crossing_str = river_crossing['type'] if river_crossing else None
        
        # Calculate cost
        cost = distance * terrain.multiplier
        
        # Apply road bonus (reduces terrain penalty)
        if road != RoadType.NINGUNO:
            cost *= road.multiplier
        
        # Apply river crossing penalty
        if river_crossing:
            river = RiverType.from_string(river_crossing['type'])
            if river == RiverType.INFRANQUEABLE:
                # Check if there's a bridge/ford nearby
                cost = float('inf')
            else:
                cost *= river.multiplier
        
        return (cost, road_type_str, terrain_str, river_crossing_str)
    
    def _get_neighbors(self, node: PathNode) -> List[Tuple[float, float]]:
        """Get valid neighbor positions for A* expansion"""
        neighbors = []
        
        # 8-directional movement
        directions = [
            (0, self.GRID_RESOLUTION),
            (0, -self.GRID_RESOLUTION),
            (self.GRID_RESOLUTION, 0),
            (-self.GRID_RESOLUTION, 0),
            (self.GRID_RESOLUTION, self.GRID_RESOLUTION),
            (self.GRID_RESOLUTION, -self.GRID_RESOLUTION),
            (-self.GRID_RESOLUTION, self.GRID_RESOLUTION),
            (-self.GRID_RESOLUTION, -self.GRID_RESOLUTION),
        ]
        
        for dx, dy in directions:
            new_x = node.x + dx
            new_y = node.y + dy
            
            # Bounds check (map is roughly 0-100 on both axes)
            if 0 <= new_x <= 110 and 0 <= new_y <= 100:
                neighbors.append((new_x, new_y))
        
        return neighbors
    
    def find_path(
        self,
        start: Tuple[float, float],
        end: Tuple[float, float],
        max_iterations: int = 10000
    ) -> PathResult:
        """
        Find optimal path from start to end using A* algorithm
        """
        warnings: List[str] = []
        
        # Initialize start node
        start_node = PathNode(x=start[0], y=start[1])
        start_node.h_cost = self._distance(start, end)
        
        # Priority queue and visited set
        open_set: List[PathNode] = [start_node]
        closed_set: Set[PathNode] = set()
        
        # A* main loop
        iterations = 0
        while open_set and iterations < max_iterations:
            iterations += 1
            
            # Get node with lowest f_cost
            current = heapq.heappop(open_set)
            
            # Check if we reached the goal
            if self._distance((current.x, current.y), end) < self.GRID_RESOLUTION * 1.5:
                return self._build_result(current, end, warnings)
            
            closed_set.add(current)
            
            # Expand neighbors
            for nx, ny in self._get_neighbors(current):
                neighbor = PathNode(x=nx, y=ny)
                
                if neighbor in closed_set:
                    continue
                
                # Calculate movement cost
                cost, road_type, terrain, river = self._calculate_move_cost(current, nx, ny)
                
                if cost == float('inf'):
                    continue  # Impassable
                
                tentative_g = current.g_cost + cost
                
                # Check if this path is better
                existing = next((n for n in open_set if n == neighbor), None)
                
                if existing is None or tentative_g < existing.g_cost:
                    neighbor.g_cost = tentative_g
                    neighbor.h_cost = self._distance((nx, ny), end)
                    neighbor.parent = current
                    neighbor.road_type = road_type
                    neighbor.terrain_type = terrain
                    neighbor.river_crossing = river
                    
                    if existing is None:
                        heapq.heappush(open_set, neighbor)
                    else:
                        # Update existing node
                        existing.g_cost = tentative_g
                        existing.parent = current
                        existing.road_type = road_type
                        existing.terrain_type = terrain
                        existing.river_crossing = river
                        heapq.heapify(open_set)
        
        # No path found
        warnings.append("No se encontró ruta válida. Puede haber barreras infranqueables.")
        return PathResult(
            success=False,
            path=[],
            segments=[],
            total_distance_km=0,
            total_travel_cost=0,
            estimated_days=0,
            warnings=warnings,
            rivers_crossed=[],
            roads_used=[],
            terrain_summary={}
        )
    
    def _build_result(
        self,
        end_node: PathNode,
        target: Tuple[float, float],
        warnings: List[str]
    ) -> PathResult:
        """Build the path result from the A* search"""
        # Reconstruct path
        path: List[Tuple[float, float]] = []
        segments: List[PathSegment] = []
        rivers_crossed: List[Dict] = []
        roads_used: Set[str] = set()
        terrain_distances: Dict[str, float] = {}
        
        current = end_node
        prev_node = None
        total_distance = 0
        total_cost = 0
        
        while current is not None:
            path.append((current.x, current.y))
            
            if prev_node is not None:
                dist = self._distance((current.x, current.y), (prev_node.x, prev_node.y))
                dist_km = dist * self.COORD_TO_KM
                total_distance += dist_km
                
                # Track terrain
                terrain = prev_node.terrain_type
                terrain_distances[terrain] = terrain_distances.get(terrain, 0) + dist_km
                
                # Track roads
                if prev_node.road_type != 'ninguno':
                    road_info = self._get_road_at_point(prev_node.x, prev_node.y)
                    if road_info:
                        roads_used.add(road_info.get('name', prev_node.road_type))
                
                # Track rivers
                if prev_node.river_crossing:
                    rivers_crossed.append({
                        'type': prev_node.river_crossing,
                        'position': (prev_node.x, prev_node.y)
                    })
                
                # Calculate segment cost
                terrain_mult = TerrainType.from_string(terrain).multiplier
                road_mult = RoadType.from_string(prev_node.road_type).multiplier
                river_mult = 1.0
                if prev_node.river_crossing:
                    river_mult = RiverType.from_string(prev_node.river_crossing).multiplier
                
                segment_cost = dist_km * terrain_mult * road_mult * river_mult
                total_cost += segment_cost
                
                segments.append(PathSegment(
                    start=(current.x, current.y),
                    end=(prev_node.x, prev_node.y),
                    distance_km=dist_km,
                    terrain=terrain,
                    road_type=prev_node.road_type,
                    river_crossing=prev_node.river_crossing,
                    travel_cost=segment_cost
                ))
            
            prev_node = current
            current = current.parent
        
        # Reverse to get start-to-end order
        path.reverse()
        segments.reverse()
        
        # Calculate estimated days
        estimated_days = total_cost / self.BASE_SPEED_KM_DAY if total_cost > 0 else 0
        
        # Add warnings for difficult terrain
        if terrain_distances.get('infranqueable', 0) > 0:
            warnings.append("⚠️ La ruta incluye terreno infranqueable. Se recomienda buscar pasos de montaña.")
        if terrain_distances.get('desalentador', 0) > 10:
            warnings.append("⚠️ Gran parte de la ruta atraviesa terreno desalentador.")
        if len(rivers_crossed) > 0:
            warnings.append(f"🌊 La ruta cruza {len(rivers_crossed)} río(s).")
        
        return PathResult(
            success=True,
            path=path,
            segments=segments,
            total_distance_km=round(total_distance, 1),
            total_travel_cost=round(total_cost, 1),
            estimated_days=round(estimated_days, 1),
            warnings=warnings,
            rivers_crossed=rivers_crossed,
            roads_used=list(roads_used),
            terrain_summary={k: round(v, 1) for k, v in terrain_distances.items()}
        )
    
    def find_path_by_location_ids(
        self,
        start_id: str,
        end_id: str
    ) -> PathResult:
        """Find path between two location IDs"""
        start_loc = next((loc for loc in self.locations if loc.get('id') == start_id), None)
        end_loc = next((loc for loc in self.locations if loc.get('id') == end_id), None)
        
        if not start_loc:
            return PathResult(
                success=False,
                path=[],
                segments=[],
                total_distance_km=0,
                total_travel_cost=0,
                estimated_days=0,
                warnings=[f"Ubicación de origen '{start_id}' no encontrada"],
                rivers_crossed=[],
                roads_used=[],
                terrain_summary={}
            )
        
        if not end_loc:
            return PathResult(
                success=False,
                path=[],
                segments=[],
                total_distance_km=0,
                total_travel_cost=0,
                estimated_days=0,
                warnings=[f"Ubicación de destino '{end_id}' no encontrada"],
                rivers_crossed=[],
                roads_used=[],
                terrain_summary={}
            )
        
        start = (start_loc.get('x', 0), start_loc.get('y', 0))
        end = (end_loc.get('x', 0), end_loc.get('y', 0))
        
        result = self.find_path(start, end)
        
        # Add location names to result
        if result.success:
            result.warnings.insert(0, f"📍 {start_loc.get('nombre')} → {end_loc.get('nombre')}")
        
        return result
