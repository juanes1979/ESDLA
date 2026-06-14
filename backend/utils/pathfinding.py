"""
Pathfinding Module for Middle-earth Travel System
Implements A* algorithm with terrain costs, roads, rivers, and barriers
"""

import base64
import math
import heapq
import zlib
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass, field
from enum import Enum


# Iter 119 — helper used by every route that builds a PathFinder. Loads the
# raster terrain grid from Mongo and returns the kwargs to forward into
# `MiddleEarthPathfinder(...)`. Falls back to empty dict if no grid exists.
async def load_terrain_grid_kwargs(db) -> Dict:
    """Fetch the raster terrain grid and return it as constructor kwargs.
    Pass the result via **kwargs to MiddleEarthPathfinder so the pathfinder
    transparently uses raster lookups when a grid exists."""
    doc = await db.terrain_grids.find_one({"_id": "main"})
    if not doc:
        return {}
    w = doc.get("width", 0)
    h = doc.get("height", 0)
    if not w or not h:
        return {}
    try:
        diff_b64 = doc.get("difficulty_b64", "") or ""
        land_b64 = doc.get("land_type_b64", "") or ""
        diff_bytes = zlib.decompress(base64.b64decode(diff_b64)) if diff_b64 else b""
        land_bytes = zlib.decompress(base64.b64decode(land_b64)) if land_b64 else b""
    except Exception:
        return {}
    if len(diff_bytes) != w * h:
        return {}
    return {
        "terrain_grid": diff_bytes,
        "land_grid": land_bytes if len(land_bytes) == w * h else None,
        "grid_width": w,
        "grid_height": h,
    }


class TerrainType(Enum):
    """Terrain difficulty types with travel multipliers"""
    FACIL = ("facil", 1.0)
    MODERADO = ("moderado", 1.33)
    DIFICIL = ("dificil", 2.0)
    MUY_DIFICIL = ("muy_dificil", 3.0)
    DESALENTADOR = ("desalentador", 4.0)
    INFRANQUEABLE = ("infranqueable", float('inf'))
    AGUA = ("agua", float('inf'))  # Water - requires boat
    
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
    """
    Road types with travel bonuses (lower = faster)
    Hierarchy: Grandes Caminos > Caminos Mayores > Caminos Menores > Sendas
    """
    NINGUNO = ("ninguno", 1.0)           # No road - base speed
    SENDA = ("senda", 0.85)              # Sendas - slight bonus
    MENOR = ("menor", 0.7)               # Caminos Menores - good bonus
    MAYOR = ("mayor", 0.5)               # Caminos Mayores - great bonus
    GRANDE = ("grande", 0.35)            # Grandes Caminos - best roads
    
    # Legacy types (mapped to new system)
    SENDERO = ("sendero", 0.85)          # -> Senda
    SECUNDARIO = ("secundario", 0.7)     # -> Menor
    REAL = ("real", 0.5)                 # -> Mayor
    
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
    road_name: str = ""  # Name of the road at this point
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
    Uses a COST MULTIPLIER SYSTEM where lower cost = better path.
    Cost = distance_km * road_mult * terrain_mult * land_mult * river_mult
    
    Key multipliers:
    - Roads: grande(0.1) to ninguno(1.0) - better roads = lower cost
    - Terrain: facil(0.5) to desalentador(8.0) - easier terrain = lower cost  
    - Land type: libres(0.2) to oscuras(10.0) - safer lands = lower cost
    """
    
    # Map scale: coordinates are in percentage (0-100) of map
    # Middle-earth is approximately 2000 km west-to-east
    # So 1 coordinate unit = ~20 km
    COORD_TO_KM = 20.0
    
    # Grid resolution for pathfinding (larger = faster but less precise)
    # 1.0 gives good balance between precision and performance
    GRID_RESOLUTION = 1.0
    
    # Base travel speed (km/day at normal pace on easy terrain)
    BASE_SPEED_KM_DAY = 36
    
    # ============ SCORING SYSTEM (points per km) ============
    
    # Road quality points (better roads = more points)
    ROAD_POINTS = {
        'grande': 10,      # Grandes Caminos - best
        'mayor': 7,        # Caminos Mayores
        'menor': 4,        # Caminos Menores
        'senda': 2,        # Sendas
        'sendero': 2,      # Legacy: Sendas
        'secundario': 4,   # Legacy: Menores
        'real': 7,         # Legacy: Mayores
        'ninguno': 1,      # Campo a través - worst
    }
    
    # Terrain difficulty points (easier = more points)
    TERRAIN_POINTS = {
        'facil': 5,
        'moderado': 3,
        'dificil': 2,
        'muy_dificil': 1,
        'desalentador': 0.5,
        'infranqueable': -1000,  # Blocked
        'agua': -1000,           # Blocked
    }
    
    # Land type danger points (safer = more points, dangerous = HEAVY negative)
    LAND_TYPE_POINTS = {
        'tierras_libres': 15,
        'tierras_fronterizas': 8,
        'fronterizas': 8,
        'tierras_salvajes': 3,
        'tierras_sombra': -25,    # Heavy penalty
        'tierras_oscuras': -50,   # Very heavy penalty
    }
    
    # Priority order for terrain difficulty (for display/sorting)
    TERRAIN_PRIORITY = {
        'agua': 7,
        'infranqueable': 6,
        'desalentador': 5,
        'muy_dificil': 4,
        'dificil': 3,
        'moderado': 2,
        'facil': 1,
    }
    
    # Priority order for land types (for display/sorting)
    LAND_TYPE_PRIORITY = {
        'tierras_oscuras': 5,
        'tierras_sombra': 4,
        'tierras_salvajes': 3,
        'tierras_fronterizas': 2,
        'tierras_libres': 1,
    }
    
    def __init__(
        self,
        roads: List[Dict],
        rivers: List[Dict],
        barriers: List[Dict],
        locations: List[Dict],
        regions: Optional[List[Dict]] = None,
        terrain_polygons: Optional[List[Dict]] = None,
        prefer_roads: bool = True,
        avoid_roads: bool = False,
        avoid_shadow_lands: bool = False,
        avoid_dark_lands: bool = False,
        direct_mode: bool = False,  # If True, ignores land danger penalties for shortest path
        # Iter 119: raster grid (preferred over polygons when available).
        terrain_grid: Optional[bytes] = None,
        land_grid: Optional[bytes] = None,
        grid_width: int = 0,
        grid_height: int = 0,
    ):
        self.roads = roads
        self.rivers = rivers
        self.barriers = barriers
        self.locations = locations
        self.regions = regions or []
        self.terrain_polygons = terrain_polygons or []
        self.prefer_roads = prefer_roads
        self.avoid_roads = avoid_roads  # For fleeing from pursuers
        self.avoid_shadow_lands = avoid_shadow_lands
        self.avoid_dark_lands = avoid_dark_lands
        self.direct_mode = direct_mode  # Direct route ignores land danger

        # Raster terrain (Iter 119) — O(1) per-coordinate lookup.
        # `terrain_grid` and `land_grid` are flat bytes (row-major uint8).
        # When present they replace polygon scans for terrain queries.
        self.terrain_grid = terrain_grid
        self.land_grid = land_grid
        self.grid_w = grid_width
        self.grid_h = grid_height
        self._use_grid = bool(
            terrain_grid and grid_width > 0 and grid_height > 0
            and len(terrain_grid) == grid_width * grid_height
        )

        # Pre-process data for efficient lookup
        self._build_road_network()
        self._build_river_segments()
        self._build_barrier_segments()
        self._build_location_map()

    # Iter 119: cell-id ↔ string maps mirror terrain_grid_routes.py.
    _DIFFICULTY_BY_ID = {
        1: 'facil', 2: 'moderado', 3: 'dificil', 4: 'muy_dificil',
        5: 'desalentador', 6: 'infranqueable', 7: 'agua',
    }
    _LAND_TYPE_BY_ID = {
        1: 'tierras_libres', 2: 'tierras_fronterizas', 3: 'tierras_salvajes',
        4: 'tierras_sombra', 5: 'tierras_oscuras',
    }

    def _grid_lookup_terrain(self, x: float, y: float) -> Optional[str]:
        """O(1) terrain difficulty lookup on the raster grid. Returns None
        if the grid isn't loaded or the cell is empty (0).
        NOTE: incoming (x, y) follows the legacy CARTESIAN convention
        (y=0 BOTTOM, y=100 TOP); the grid is stored canvas-style (y=0 TOP),
        so we flip Y here."""
        if not self._use_grid:
            return None
        cx = max(0, min(self.grid_w - 1, int(round(x * self.grid_w / 100.0))))
        cy = max(0, min(self.grid_h - 1, int(round((100.0 - y) * self.grid_h / 100.0))))
        cell_id = self.terrain_grid[cy * self.grid_w + cx]
        if cell_id == 0:
            return None
        return self._DIFFICULTY_BY_ID.get(cell_id)

    def _grid_lookup_land(self, x: float, y: float) -> Optional[str]:
        if not self._use_grid or not self.land_grid:
            return None
        cx = max(0, min(self.grid_w - 1, int(round(x * self.grid_w / 100.0))))
        cy = max(0, min(self.grid_h - 1, int(round((100.0 - y) * self.grid_h / 100.0))))
        cell_id = self.land_grid[cy * self.grid_w + cx]
        if cell_id == 0:
            return None
        return self._LAND_TYPE_BY_ID.get(cell_id)
    
    def _segment_crosses_blocking_polygon(self, from_pos: Tuple[float, float], to_pos: Tuple[float, float]) -> bool:
        """
        Comprueba si el segmento entre dos posiciones atraviesa algún terreno
        bloqueante (infranqueable o agua) muestreando puntos intermedios.

        Excepción (Iter 118): si AMBOS extremos del segmento están sobre un
        camino, el segmento se considera un cruce construido (paso de montaña
        o puente) y se permite atravesar el polígono bloqueante.
        """
        # Roads override impassable terrain
        if (self._get_road_at_point(from_pos[0], from_pos[1]) is not None
                and self._get_road_at_point(to_pos[0], to_pos[1]) is not None):
            return False

        n_samples = 5
        fx, fy = from_pos
        tx, ty = to_pos

        # Raster fast path (Iter 119): query the grid at each sample.
        if self._use_grid:
            for i in range(1, n_samples + 1):
                t = i / (n_samples + 1)
                x = fx + (tx - fx) * t
                y = fy + (ty - fy) * t
                tname = self._grid_lookup_terrain(x, y)
                if tname in ('infranqueable', 'agua'):
                    return True
            return False

        # Legacy polygon path
        if not self.terrain_polygons:
            return False
        BLOCKING = {'infranqueable', 'agua'}
        blocking_polys = [p for p in self.terrain_polygons if p.get('type') in BLOCKING]
        if not blocking_polys:
            return False
        for i in range(1, n_samples + 1):
            t = i / (n_samples + 1)
            x = fx + (tx - fx) * t
            y = fy + (ty - fy) * t
            for poly in blocking_polys:
                pts = poly.get('points', [])
                if pts and self._point_in_polygon(x, y, pts):
                    return True
        return False

    def _point_in_polygon(self, x: float, y: float, polygon_points: list) -> bool:
        """Check if point is inside polygon using ray casting"""
        n = len(polygon_points)
        if n < 3:
            return False
        
        inside = False
        j = n - 1
        
        for i in range(n):
            xi = polygon_points[i].get("x", 0)
            yi = polygon_points[i].get("y", 0)
            xj = polygon_points[j].get("x", 0)
            yj = polygon_points[j].get("y", 0)
            
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        
        return inside
    
    def get_terrain_from_polygons(self, x: float, y: float) -> str:
        """Get terrain type at coordinate, with priority. Uses raster grid
        when available (Iter 119), else falls back to polygon scan."""
        # Raster fast path
        grid_val = self._grid_lookup_terrain(x, y)
        if grid_val is not None:
            return grid_val
        if self._use_grid:
            # Grid loaded but this cell is empty (0) → default moderado.
            return "moderado"

        if not self.terrain_polygons:
            return "moderado"
        matching = []
        for poly in self.terrain_polygons:
            poly_type = poly.get("type", "")
            if poly_type not in self.TERRAIN_PRIORITY:
                continue
            
            points = poly.get("points", [])
            if self._point_in_polygon(x, y, points):
                matching.append({
                    "type": poly_type,
                    "priority": self.TERRAIN_PRIORITY.get(poly_type, 0)
                })
        
        if not matching:
            return "moderado"
        
        # Return highest priority (most difficult)
        matching.sort(key=lambda m: m["priority"], reverse=True)
        return matching[0]["type"]
    
    def get_land_type_from_polygons(self, x: float, y: float) -> str:
        """Get land type at coordinate. Uses raster grid when available
        (Iter 119), else falls back to polygon scan."""
        grid_val = self._grid_lookup_land(x, y)
        if grid_val is not None:
            return grid_val
        if self._use_grid:
            return "tierras_salvajes"

        if not self.terrain_polygons:
            return "tierras_salvajes"
        matching = []
        for poly in self.terrain_polygons:
            poly_type = poly.get("type", "")
            if poly_type not in self.LAND_TYPE_PRIORITY:
                continue
            
            points = poly.get("points", [])
            if self._point_in_polygon(x, y, points):
                matching.append({
                    "type": poly_type,
                    "priority": self.LAND_TYPE_PRIORITY.get(poly_type, 0)
                })
        
        if not matching:
            return "tierras_salvajes"
        
        # Return highest priority
        matching.sort(key=lambda m: m["priority"], reverse=True)
        return matching[0]["type"]
    
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
        """Get road info if point is ON a road - returns CLOSEST road within strict tolerance"""
        grid_key = (round(x), round(y))
        
        # Check direct grid match
        if grid_key in self.road_points:
            return self.road_points[grid_key]
        
        # Check nearby road segments - find the CLOSEST one within strict tolerance
        # With GRID_RESOLUTION = 1.0, we need tight tolerance to avoid false positives
        point = (x, y)
        closest_road = None
        closest_dist = float('inf')
        tolerance = 0.6 * self.GRID_RESOLUTION  # Scale tolerance with grid resolution
        
        for segment in self.road_segments:
            dist = self._point_to_segment_distance(point, segment['start'], segment['end'])
            if dist < tolerance and dist < closest_dist:
                closest_dist = dist
                closest_road = {'type': segment['type'], 'name': segment['name']}
        
        return closest_road

    def _find_best_nearby_road_point(
        self,
        point: Tuple[float, float],
        max_distance: float = 3.0
    ) -> Optional[Tuple[float, float]]:
        """
        Find the best road point near a location.
        Prefers better road types (grande > mayor > menor > senda).
        Returns the closest point on the best road found.
        """
        road_type_priority = {
            'grande': 1,
            'mayor': 2, 
            'menor': 3,
            'senda': 4,
            'sendero': 4,
            'secundario': 3,
            'real': 2
        }
        
        best_point = None
        best_priority = 999
        best_distance = max_distance
        
        for segment in self.road_segments:
            road_type = segment.get('type', 'senda')
            priority = road_type_priority.get(road_type, 5)
            
            # Find closest point on this segment
            closest = self._closest_point_on_segment(
                point, segment['start'], segment['end']
            )
            dist = self._distance(point, closest)
            
            if dist < max_distance:
                # Better road type OR same type but closer
                if priority < best_priority or (priority == best_priority and dist < best_distance):
                    best_priority = priority
                    best_distance = dist
                    best_point = closest
        
        return best_point
    
    def _closest_point_on_segment(
        self,
        point: Tuple[float, float],
        seg_start: Tuple[float, float],
        seg_end: Tuple[float, float]
    ) -> Tuple[float, float]:
        """Find the closest point on a line segment to a given point"""
        px, py = point
        x1, y1 = seg_start
        x2, y2 = seg_end
        
        dx = x2 - x1
        dy = y2 - y1
        
        if dx == 0 and dy == 0:
            return seg_start
        
        t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
        
        return (x1 + t * dx, y1 + t * dy)


    def _get_path_nodes(self, end_node: PathNode):
        """Generator to iterate through path nodes from end to start"""
        current = end_node
        while current is not None:
            yield current
            current = current.parent

    
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
        """
        Check if path segment crosses a barrier (impassable)
        EXCEPTION: If a road crosses the barrier at the same point, it's considered a "pass"
        """
        for barrier_seg in self.barrier_segments:
            if self._segments_intersect(p1, p2, barrier_seg['start'], barrier_seg['end']):
                # Check if there's a road that also crosses this barrier at this point
                # If so, it's a mountain pass and can be traversed
                if self._road_crosses_barrier_at_segment(p1, p2, barrier_seg):
                    continue  # Road creates a pass, barrier is traversable here
                return True
        return False
    
    def _road_crosses_barrier_at_segment(
        self,
        path_start: Tuple[float, float],
        path_end: Tuple[float, float],
        barrier_seg: Dict
    ) -> bool:
        """
        Check if any road crosses this barrier segment, creating a traversable pass.
        A road crossing a barrier at a point allows travel through that point.
        """
        barrier_start = barrier_seg['start']
        barrier_end = barrier_seg['end']
        
        # Check each road segment
        for road_seg in self.road_segments:
            road_start = road_seg['start']
            road_end = road_seg['end']
            
            # Check if road crosses this specific barrier segment
            if self._segments_intersect(road_start, road_end, barrier_start, barrier_end):
                # Calculate intersection point of road and barrier
                road_barrier_intersection = self._get_intersection_point(
                    road_start, road_end, barrier_start, barrier_end
                )
                
                if road_barrier_intersection:
                    # Check if our path segment passes near this intersection point
                    dist_to_intersection = self._point_to_segment_distance(
                        road_barrier_intersection, path_start, path_end
                    )
                    
                    # If path is close to the road-barrier intersection, it's a valid pass
                    if dist_to_intersection < 3.0:  # Within 3 units tolerance
                        return True
        
        return False
    
    def _get_intersection_point(
        self,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        p3: Tuple[float, float],
        p4: Tuple[float, float]
    ) -> Optional[Tuple[float, float]]:
        """Calculate the intersection point of two line segments, if they intersect"""
        x1, y1 = p1
        x2, y2 = p2
        x3, y3 = p3
        x4, y4 = p4
        
        denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
        if abs(denom) < 1e-10:  # Lines are parallel
            return None
        
        t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
        
        # Check if intersection is within segment bounds
        if 0 <= t <= 1:
            ix = x1 + t * (x2 - x1)
            iy = y1 + t * (y2 - y1)
            return (ix, iy)
        
        return None
    
    def _get_terrain_at_point(self, x: float, y: float) -> str:
        """Get terrain type at point - first from polygons, then fallback to locations"""
        # First check terrain polygons (highest priority)
        if self.terrain_polygons:
            polygon_terrain = self.get_terrain_from_polygons(x, y)
            if polygon_terrain != "moderado":  # Found specific terrain
                return polygon_terrain
        
        # Fallback to location-based terrain
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
    ) -> Tuple[float, str, str, str, Optional[str]]:
        """
        Calculate movement cost using an INVERSE SCORING SYSTEM.
        We convert our point system to a cost system where:
        - Base cost = distance in km
        - Multiplied by quality factor (better conditions = lower multiplier)
        
        Quality hierarchy:
        - Roads: grande(0.1) < mayor(0.3) < menor(0.5) < senda(0.7) < ninguno(1.0)
        - Terrain: facil(0.5) < moderado(1.0) < dificil(2.0) < muy_dificil(4.0) < desalentador(8.0)
        - Land: libres(0.2) < fronterizas(0.5) < salvajes(1.0) < sombra(5.0) < oscuras(10.0)
        
        Returns: (cost, road_type, road_name, terrain_type, river_crossing)
        """
        from_pos = (from_node.x, from_node.y)
        to_pos = (to_x, to_y)
        
        # Base distance in km
        distance_km = self._distance(from_pos, to_pos) * self.COORD_TO_KM
        
        # Check for barrier (impassable)
        if self._check_barrier_crossing(from_pos, to_pos):
            return (float('inf'), 'ninguno', '', 'infranqueable', None)

        # Check if the segment crosses an infranqueable / agua terrain polygon
        # (los polígonos pueden ser más pequeños que GRID_RESOLUTION → muestreamos
        # el segmento para no "saltar por encima" de un bloqueo).
        if self._segment_crosses_blocking_polygon(from_pos, to_pos):
            return (float('inf'), 'ninguno', '', 'infranqueable', None)
        
        # Get terrain
        terrain_str = self._get_terrain_at_point(to_x, to_y)
        
        # Get road info
        to_road_info = self._get_road_at_point(to_x, to_y)
        road_type_str = to_road_info['type'] if to_road_info else 'ninguno'
        road_name_str = to_road_info['name'] if to_road_info else ''
        
        # Check river crossing
        river_crossing = self._check_river_crossing(from_pos, to_pos)
        river_crossing_str = river_crossing['type'] if river_crossing else None
        
        # Get land type
        land_type = self.get_land_type_from_polygons(to_x, to_y)
        
        # ============ TERRAIN MULTIPLIER (higher = worse terrain) ============
        TERRAIN_MULT = {
            'facil': 0.5,
            'moderado': 1.0,
            'dificil': 2.0,
            'muy_dificil': 4.0,
            'desalentador': 8.0,
            'infranqueable': float('inf'),
            'agua': float('inf'),
        }
        terrain_mult = TERRAIN_MULT.get(terrain_str, 1.0)

        # Roads override impassable terrain (Iter 118): if we're on a road
        # and the terrain is infranqueable / agua, treat it as a
        # constructed crossing — mountain pass or bridge. The terrain
        # multiplier becomes that of muy_dificil (pass) or dificil (bridge)
        # so the traveller pays a realistic cost. We keep `terrain_str` as
        # the underlying terrain so the distance breakdown still reflects
        # that the route crosses these zones.
        if terrain_mult == float('inf') and to_road_info is not None:
            if terrain_str == 'agua':
                terrain_mult = TERRAIN_MULT['dificil']
            else:  # 'infranqueable'
                terrain_mult = TERRAIN_MULT['muy_dificil']

        # Check if terrain is impassable
        if terrain_mult == float('inf'):
            return (float('inf'), road_type_str, road_name_str, terrain_str, river_crossing_str)
        
        # ============ ROAD MULTIPLIER (lower = better road) ============
        ROAD_MULT = {
            'grande': 0.1,      # Grandes Caminos - best (huge bonus)
            'mayor': 0.25,     # Caminos Mayores
            'menor': 0.45,     # Caminos Menores
            'senda': 0.65,     # Sendas
            'sendero': 0.65,   # Legacy: Sendas
            'secundario': 0.45, # Legacy: Menores
            'real': 0.25,      # Legacy: Mayores
            'ninguno': 1.0,    # Campo a través - base cost
        }
        road_mult = ROAD_MULT.get(road_type_str, 1.0)
        
        # ============ LAND TYPE MULTIPLIER (higher = more dangerous) ============
        LAND_MULT = {
            'tierras_libres': 0.2,      # Safe lands - huge bonus
            'tierras_fronterizas': 0.5,  # Borderlands
            'fronterizas': 0.5,          # Legacy
            'tierras_salvajes': 1.0,     # Wild lands - base
            'tierras_sombra': 5.0,       # Shadow lands - HEAVY penalty
            'tierras_oscuras': 10.0,     # Dark lands - VERY HEAVY penalty
        }
        land_mult = LAND_MULT.get(land_type, 1.0)
        
        # If user explicitly wants to AVOID shadow/dark lands, make them impassable
        if self.avoid_shadow_lands and land_type == 'tierras_sombra':
            return (float('inf'), 'ninguno', '', terrain_str, river_crossing_str)
        if self.avoid_dark_lands and land_type == 'tierras_oscuras':
            return (float('inf'), 'ninguno', '', terrain_str, river_crossing_str)
        
        # In DIRECT MODE, reduce land danger penalties significantly
        if self.direct_mode:
            # Direct mode: land danger has much less impact
            land_mult = max(0.5, land_mult * 0.1)  # Reduce penalty to 10% 
        
        # ============ AVOID ROADS MODE ============
        if self.avoid_roads:
            if road_type_str != 'ninguno':
                road_mult = 5.0  # Heavy penalty for using roads when fleeing
            else:
                road_mult = 0.5  # Bonus for staying off roads
        
        # ============ RIVER CROSSING ============
        river_mult = 1.0
        if river_crossing:
            river = RiverType.from_string(river_crossing['type'])
            if river == RiverType.INFRANQUEABLE:
                return (float('inf'), road_type_str, road_name_str, terrain_str, river_crossing_str)
            else:
                river_mult = river.multiplier  # 1.5 for vadeable, 3.0 for profundo
        
        # ============ CALCULATE TOTAL COST ============
        # Cost = distance * road_factor * terrain_factor * land_factor * river_factor
        # Lower cost = better path
        total_cost = distance_km * road_mult * terrain_mult * land_mult * river_mult
        
        return (total_cost, road_type_str, road_name_str, terrain_str, river_crossing_str)
    
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
        
        # If preferring roads, find the best nearby road connection point
        actual_start = start
        if self.prefer_roads:
            best_road_point = self._find_best_nearby_road_point(start)
            if best_road_point:
                actual_start = best_road_point
                warnings.append(f"Ruta ajustada para comenzar en el camino más cercano")
        
        # Find the best nearby road at the start point
        start_road = self._get_road_at_point(actual_start[0], actual_start[1])
        
        # Initialize start node
        start_node = PathNode(x=actual_start[0], y=actual_start[1])
        # Heuristic: distance * best possible multiplier (0.1 for grande road, 0.2 for free lands, 0.5 for easy terrain)
        # This ensures h_cost is admissible (never overestimates)
        start_node.h_cost = self._distance(actual_start, end) * self.COORD_TO_KM * 0.01  # Minimum possible cost per km
        if start_road:
            start_node.road_type = start_road.get('type', 'ninguno')
        
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
                cost, road_type, road_name, terrain, river = self._calculate_move_cost(current, nx, ny)
                
                if cost == float('inf'):
                    continue  # Impassable
                
                tentative_g = current.g_cost + cost
                
                # Check if this path is better
                existing = next((n for n in open_set if n == neighbor), None)
                
                if existing is None or tentative_g < existing.g_cost:
                    neighbor.g_cost = tentative_g
                    # Heuristic: distance * minimum possible cost multiplier
                    neighbor.h_cost = self._distance((nx, ny), end) * self.COORD_TO_KM * 0.01
                    neighbor.parent = current
                    neighbor.road_type = road_type
                    neighbor.road_name = road_name
                    neighbor.terrain_type = terrain
                    neighbor.river_crossing = river
                    
                    if existing is None:
                        heapq.heappush(open_set, neighbor)
                    else:
                        # Update existing node
                        existing.g_cost = tentative_g
                        existing.parent = current
                        existing.road_type = road_type
                        existing.road_name = road_name
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
        roads_used_ordered: List[str] = []  # Ordered list of roads (maintains order of traversal)
        roads_distances: Dict[str, float] = {}  # Track distance on each road
        terrain_distances: Dict[str, float] = {}
        
        current = end_node
        prev_node = None
        total_distance = 0
        total_cost = 0
        current_road_streak: Dict[str, float] = {}  # Track consecutive distance on current road
        
        while current is not None:
            path.append((current.x, current.y))
            
            if prev_node is not None:
                dist = self._distance((current.x, current.y), (prev_node.x, prev_node.y))
                dist_km = dist * self.COORD_TO_KM
                total_distance += dist_km
                
                # Track terrain
                terrain = prev_node.terrain_type
                terrain_distances[terrain] = terrain_distances.get(terrain, 0) + dist_km
                
                # Track roads - only count roads with significant usage
                if prev_node.road_type != 'ninguno' and prev_node.road_name:
                    road_name = prev_node.road_name
                    roads_distances[road_name] = roads_distances.get(road_name, 0) + dist_km
                
                # Track rivers
                if prev_node.river_crossing:
                    rivers_crossed.append({
                        'type': prev_node.river_crossing,
                        'position': (prev_node.x, prev_node.y)
                    })
                
                # Calculate segment cost
                terrain_mult = TerrainType.from_string(terrain).multiplier
                road_mult = RoadType.from_string(prev_node.road_type).multiplier
                # Roads override impassable terrain (same rule as _calculate_move_cost).
                # If we somehow stored a segment with infranqueable/agua + a road,
                # treat it as a pass/bridge so cost stays finite.
                if terrain_mult == float('inf') and prev_node.road_type != 'ninguno':
                    if terrain == 'agua':
                        terrain_mult = TerrainType.from_string('dificil').multiplier
                    else:
                        terrain_mult = TerrainType.from_string('muy_dificil').multiplier
                river_mult = 1.0
                if prev_node.river_crossing:
                    river_mult = RiverType.from_string(prev_node.river_crossing).multiplier

                segment_cost = dist_km * terrain_mult * road_mult * river_mult
                # Final safety: never let a successful path produce an infinite
                # segment cost (would break JSON serialisation downstream).
                if not (segment_cost == segment_cost) or segment_cost == float('inf'):
                    segment_cost = dist_km  # fall back to raw distance
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
        
        # Filter roads: only include roads with at least 30km or 5% of total distance
        # This filters out roads that are just briefly crossed
        min_road_distance = max(30, total_distance * 0.05)  # At least 30km or 5%
        significant_roads = {name: dist for name, dist in roads_distances.items() if dist >= min_road_distance}
        
        # Build ordered list of significant roads based on first appearance
        for node in reversed(list(self._get_path_nodes(end_node))):
            if node.road_name and node.road_name in significant_roads:
                if node.road_name not in roads_used_ordered:
                    roads_used_ordered.append(node.road_name)
        
        # Reverse to get start-to-end order
        path.reverse()
        segments.reverse()
        
        # Calculate estimated days
        estimated_days = total_cost / self.BASE_SPEED_KM_DAY if total_cost > 0 else 0
        
        # Add warnings for difficult terrain
        # NOTE (Iter 118): the A* only allows crossing 'infranqueable' / 'agua'
        # terrain when a road exists on it, so any infranqueable distance in
        # the final route is necessarily a mountain pass / bridge segment.
        if terrain_distances.get('infranqueable', 0) > 0:
            warnings.append("🛤️ La ruta atraviesa pasos de montaña (terreno infranqueable salvable gracias al camino).")
        if terrain_distances.get('agua', 0) > 0:
            warnings.append("🌉 La ruta cruza zonas de agua mediante puentes/vados.")
        if terrain_distances.get('desalentador', 0) > 10:
            warnings.append("⚠️ Gran parte de la ruta atraviesa terreno desalentador.")
        if len(rivers_crossed) > 0:
            warnings.append(f"🌊 La ruta cruza {len(rivers_crossed)} río(s).")
        
        return PathResult(
            success=True,
            path=self._simplify_path(path),  # Simplify the path to remove zigzag
            segments=segments,
            total_distance_km=round(total_distance, 1),
            total_travel_cost=round(total_cost, 1),
            estimated_days=round(estimated_days, 1),
            warnings=warnings,
            rivers_crossed=rivers_crossed,
            roads_used=roads_used_ordered,  # Now ordered by traversal
            terrain_summary={k: round(v, 1) for k, v in terrain_distances.items()}
        )
    
    def _simplify_path(self, path: List[Tuple[float, float]], tolerance: float = 0.5) -> List[Tuple[float, float]]:
        """
        Simplify the path using the Ramer-Douglas-Peucker algorithm.
        This removes unnecessary intermediate points while preserving the shape.
        """
        if len(path) < 3:
            return path
        
        # Find the point with the maximum distance from the line between start and end
        start = path[0]
        end = path[-1]
        max_dist = 0
        max_idx = 0
        
        for i in range(1, len(path) - 1):
            dist = self._perpendicular_distance(path[i], start, end)
            if dist > max_dist:
                max_dist = dist
                max_idx = i
        
        # If max distance is greater than tolerance, recursively simplify
        if max_dist > tolerance:
            # Recursively simplify
            left_simplified = self._simplify_path(path[:max_idx + 1], tolerance)
            right_simplified = self._simplify_path(path[max_idx:], tolerance)
            
            # Combine results (avoid duplicating the middle point)
            return left_simplified[:-1] + right_simplified
        else:
            # All intermediate points are within tolerance, return just start and end
            return [start, end]
    
    def _perpendicular_distance(
        self, 
        point: Tuple[float, float], 
        line_start: Tuple[float, float], 
        line_end: Tuple[float, float]
    ) -> float:
        """Calculate perpendicular distance from a point to a line"""
        px, py = point
        x1, y1 = line_start
        x2, y2 = line_end
        
        # Line length squared
        line_len_sq = (x2 - x1) ** 2 + (y2 - y1) ** 2
        
        if line_len_sq == 0:
            # Line is a point
            return self._distance(point, line_start)
        
        # Project point onto line
        t = max(0, min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / line_len_sq))
        
        # Closest point on line
        proj_x = x1 + t * (x2 - x1)
        proj_y = y1 + t * (y2 - y1)
        
        return self._distance(point, (proj_x, proj_y))
    
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
