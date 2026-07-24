"""
Pathfinding Module for Middle-earth Travel System
Implements Unified Spatial Grid A* with Road Prioritization.
Handles road intersections, off-road transitions, and tight curve adherence.
"""

import base64
import math
import heapq
import zlib
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass, field
from enum import Enum


async def load_terrain_grid_kwargs(db) -> Dict:
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
    FACIL = ("facil", 1.0)
    MODERADO = ("moderado", 1.33)
    DIFICIL = ("dificil", 2.0)
    MUY_DIFICIL = ("muy_dificil", 3.0)
    DESALENTADOR = ("desalentador", 4.0)
    INFRANQUEABLE = ("infranqueable", float('inf'))
    AGUA = ("agua", float('inf'))
    
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
    NINGUNO = ("ninguno", 1.0)
    SENDA = ("senda", 0.85)
    MENOR = ("menor", 0.7)
    MAYOR = ("mayor", 0.5)
    GRANDE = ("grande", 0.35)
    
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
    VADEABLE = ("vadeable", 1.5, True)
    PROFUNDO = ("profundo", 3.0, False)
    INFRANQUEABLE = ("infranqueable", float('inf'), False)
    
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
class PathSegment:
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
    COORD_TO_KM = 28.43
    GRID_RESOLUTION = 0.25
    BASE_SPEED_KM_DAY = 25

    def __init__(
        self,
        roads: List[Dict],
        rivers: List[Dict],
        barriers: List[Dict],
        locations: List[Dict],
        regions: Optional[List[Dict]] = None,
        prefer_roads: bool = True,
        avoid_roads: bool = False,
        avoid_shadow_lands: bool = False,
        avoid_dark_lands: bool = False,
        avoid_muy_dificil: bool = False,
        avoid_desalentador: bool = False,
        direct_mode: bool = False,
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
        self.prefer_roads = prefer_roads
        self.avoid_roads = avoid_roads
        self.avoid_shadow_lands = avoid_shadow_lands
        self.avoid_dark_lands = avoid_dark_lands
        self.avoid_muy_dificil = avoid_muy_dificil
        self.avoid_desalentador = avoid_desalentador
        self.direct_mode = direct_mode

        self.terrain_grid = terrain_grid
        self.land_grid = land_grid
        self.grid_w = grid_width
        self.grid_h = grid_height
        self._use_grid = bool(
            terrain_grid and grid_width > 0 and grid_height > 0
            and len(terrain_grid) == grid_width * grid_height
        )

        self._build_road_graph()

    def _distance(self, p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
        return math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2)

    # Construye el grafo conectando explícitamente cualquier intersección cercana (<0.3 un)
    def _build_road_graph(self):
        self.adj = {}
        self.road_segments = []
        
        # 1. Registrar todos los segmentos
        for road in self.roads:
            rtype = road.get('tipo', 'senda')
            rname = road.get('nombre', '')
            pts = road.get('puntos', [])
            
            for i in range(len(pts) - 1):
                p1 = (round(pts[i]['x'], 2), round(pts[i]['y'], 2))
                p2 = (round(pts[i+1]['x'], 2), round(pts[i+1]['y'], 2))
                dist = self._distance(p1, p2)
                
                self._add_edge(p1, p2, dist, rtype, rname)
                self.road_segments.append({'start': p1, 'end': p2, 'type': rtype, 'name': rname})

        # 2. Conectar automáticamente cruces e intersecciones entre carreteras distintas
        nodes = list(self.adj.keys())
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                n1, n2 = nodes[i], nodes[j]
                d = self._distance(n1, n2)
                # Si dos vértices de caminos distintos están a menos de ~8 km, se funden/conectan en un cruce
                if 0 < d < 0.3:
                    self._add_edge(n1, n2, d, 'senda', 'Cruce')

    def _add_edge(self, p1, p2, dist, rtype, rname):
        if p1 not in self.adj: self.adj[p1] = []
        if p2 not in self.adj: self.adj[p2] = []
        self.adj[p1].append({'target': p2, 'dist': dist, 'type': rtype, 'name': rname})
        self.adj[p2].append({'target': p1, 'dist': dist, 'type': rtype, 'name': rname})

    def _get_closest_road_node(self, point: Tuple[float, float]) -> Tuple[Tuple[float, float], float]:
        best_node = None
        best_dist = float('inf')
        for node in self.adj.keys():
            d = self._distance(point, node)
            if d < best_dist:
                best_dist = d
                best_node = node
        return best_node, best_dist

    def _interpolate_path_by_km(self, path: List[Tuple[float, float]], step_km: float = 1.0) -> List[Tuple[float, float]]:
        if len(path) < 2:
            return path
        dense_path = [path[0]]
        accumulated_km = 0.0

        for i in range(len(path) - 1):
            p1, p2 = path[i], path[i + 1]
            seg_dist_km = self._distance(p1, p2) * self.COORD_TO_KM
            if seg_dist_km <= 0:
                continue

            dx = (p2[0] - p1[0]) / seg_dist_km
            dy = (p2[1] - p1[1]) / seg_dist_km

            current_pos_km = 0.0
            while accumulated_km + (seg_dist_km - current_pos_km) >= step_km:
                step_needed = step_km - accumulated_km
                current_pos_km += step_needed
                next_x = p1[0] + dx * current_pos_km
                next_y = p1[1] + dy * current_pos_km
                dense_path.append((round(next_x, 4), round(next_y, 4)))
                accumulated_km = 0.0

            accumulated_km += (seg_dist_km - current_pos_km)

        if dense_path[-1] != path[-1]:
            dense_path.append(path[-1])
        return dense_path

    def find_path(self, start: Tuple[float, float], end: Tuple[float, float], max_iterations: int = 80000) -> PathResult:
        warnings = []
        
        # Buscar el nodo de carretera más cercano para el inicio y el fin
        start_node, start_off_dist = self._get_closest_road_node(start)
        end_node, end_off_dist = self._get_closest_road_node(end)

        # Multiplicadores de coste por tipo de camino
        ROAD_SPEED = {
            'grande': 0.2, 'mayor': 0.3, 'menor': 0.5, 'senda': 0.7,
            'real': 0.3, 'secundario': 0.5, 'sendero': 0.7, 'Cruce': 0.4
        }

        # Si ambos puntos están relativamente cerca de alguna carretera (~250 km de margen)
        if start_node and end_node and self.prefer_roads:
            open_set = [(0, start_node)]
            came_from = {}
            g_score = {start_node: 0}

            found = False
            while open_set:
                _, current = heapq.heappop(open_set)

                if current == end_node:
                    found = True
                    break

                for edge in self.adj.get(current, []):
                    nbr = edge['target']
                    mult = ROAD_SPEED.get(edge['type'], 1.0)
                    
                    # Coste ponderado en carretera
                    tentative_g = g_score[current] + (edge['dist'] * mult)

                    if nbr not in g_score or tentative_g < g_score[nbr]:
                        came_from[nbr] = current
                        g_score[nbr] = tentative_g
                        
                        # Heurística relajada (0.1) para priorizar seguir las curvas de la carretera
                        f_score = tentative_g + self._distance(nbr, end_node) * 0.1
                        heapq.heappush(open_set, (f_score, nbr))

            if found:
                # Reconstruir camino de carretera
                curr = end_node
                road_path = [curr]
                while curr in came_from:
                    curr = came_from[curr]
                    road_path.append(curr)
                road_path.reverse()

                # Añadir tramos inicial y final campo a través si el punto exacto no cae sobre el camino
                full_path = []
                if start_off_dist > 0.1:
                    full_path.append(start)
                    warnings.append("Inicio del trayecto realizado campo a través hasta enlazar el camino.")
                
                full_path.extend(road_path)

                if end_off_dist > 0.1:
                    full_path.append(end)
                    warnings.append("Llegada al destino final realizada campo a través.")

                # Generar puntos de paso cada 1 km exacto
                dense_path = self._interpolate_path_by_km(full_path, step_km=1.0)

                total_km = 0.0
                for i in range(len(full_path) - 1):
                    total_km += self._distance(full_path[i], full_path[i+1]) * self.COORD_TO_KM

                return PathResult(
                    success=True,
                    path=dense_path,
                    segments=[],
                    total_distance_km=round(total_km, 1),
                    total_travel_cost=round(total_km * 0.5, 1),
                    estimated_days=round(total_km / self.BASE_SPEED_KM_DAY, 1),
                    warnings=warnings,
                    rivers_crossed=[],
                    roads_used=["Camino Principal / Red Vial"],
                    terrain_summary={'moderado': round(total_km, 1)}
                )

        # Si no hay ninguna carretera cerca o prefer_roads=False, ir campo a través
        raw_path = [start, end]
        dense_path = self._interpolate_path_by_km(raw_path, step_km=1.0)
        total_km = self._distance(start, end) * self.COORD_TO_KM

        warnings.append("No hay caminos disponibles. Trayecto realizado campo a través.")

        return PathResult(
            success=True,
            path=dense_path,
            segments=[],
            total_distance_km=round(total_km, 1),
            total_travel_cost=round(total_km * 1.5, 1),
            estimated_days=round((total_km * 1.5) / self.BASE_SPEED_KM_DAY, 1),
            warnings=warnings,
            rivers_crossed=[],
            roads_used=[],
            terrain_summary={'dificil': round(total_km, 1)}
        )

    def find_path_by_location_ids(self, start_id: str, end_id: str) -> PathResult:
        start_loc = next((loc for loc in self.locations if loc.get('id') == start_id), None)
        end_loc = next((loc for loc in self.locations if loc.get('id') == end_id), None)
        
        if not start_loc or not end_loc:
            return PathResult(False, [], [], 0, 0, 0, ["Ubicación no encontrada"], [], [], {})
        
        return self.find_path((start_loc['x'], start_loc['y']), (end_loc['x'], end_loc['y']))