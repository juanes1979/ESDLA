"""
Pathfinding Module for Middle-earth Travel System

Prioridad de diseño:
1) Seguir caminos por grafo cuando exista ruta útil.
2) Conectar inicio/fin al camino más cercano mirando también al destino.
3) Usar campo a través natural solo como fallback o en los tramos de entrada/salida.
4) Mantener compatibilidad con el resto del sistema mediante PathResult.
"""

import base64
import math
import heapq
import zlib
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass, field
from enum import Enum


async def load_terrain_grid_kwargs(db) -> Dict:
    """
    Carga el grid raster de terreno/tipo de tierra desde Mongo y devuelve
    los kwargs para MiddleEarthPathfinder.
    """
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
    INFRANQUEABLE = ("infranqueable", float("inf"))
    AGUA = ("agua", float("inf"))

    def __init__(self, key: str, multiplier: float):
        self.key = key
        self.multiplier = multiplier

    @classmethod
    def from_string(cls, value: str) -> "TerrainType":
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
    def from_string(cls, value: str) -> "RoadType":
        for road in cls:
            if road.key == value:
                return road
        return cls.NINGUNO


class RiverType(Enum):
    VADEABLE = ("vadeable", 1.5, True)
    PROFUNDO = ("profundo", 3.0, False)
    INFRANQUEABLE = ("infranqueable", float("inf"), False)

    def __init__(self, key: str, multiplier: float, mount_allowed: bool):
        self.key = key
        self.multiplier = multiplier
        self.mount_allowed = mount_allowed

    @classmethod
    def from_string(cls, value: str) -> "RiverType":
        for river in cls:
            if river.key == value:
                return river
        return cls.PROFUNDO


@dataclass
class PathNode:
    x: float
    y: float
    g_cost: float = 0
    h_cost: float = 0
    parent: Optional["PathNode"] = field(default=None, repr=False)
    road_type: str = "ninguno"
    road_name: str = ""
    terrain_type: str = "moderado"
    river_crossing: Optional[str] = None

    @property
    def f_cost(self) -> float:
        return self.g_cost + self.h_cost

    def __lt__(self, other: "PathNode") -> bool:
        return self.f_cost < other.f_cost

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, PathNode):
            return False
        return round(self.x, 3) == round(other.x, 3) and round(self.y, 3) == round(other.y, 3)

    def __hash__(self) -> int:
        return hash((round(self.x, 3), round(self.y, 3)))


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
    """
    Pathfinder basado en grafo de caminos.
    - Los caminos se resuelven por red explícita.
    - Los tramos fuera de camino se generan de forma natural.
    - El grid raster se usa para bloquear/permitir terreno, no para “romper”
      la geometría del camino.
    """

    COORD_TO_KM = 28.43
    GRID_RESOLUTION = 0.4
    BASE_SPEED_KM_DAY = 36

    ROAD_POINTS = {
        "grande": 10,
        "mayor": 7,
        "menor": 4,
        "senda": 2,
        "sendero": 2,
        "secundario": 4,
        "real": 7,
        "ninguno": 1,
    }

    TERRAIN_POINTS = {
        "facil": 5,
        "moderado": 3,
        "dificil": 2,
        "muy_dificil": 1,
        "desalentador": 0.5,
        "infranqueable": -1000,
        "agua": -1000,
    }

    LAND_TYPE_POINTS = {
        "tierras_libres": 15,
        "tierras_fronterizas": 8,
        "fronterizas": 8,
        "tierras_salvajes": 3,
        "tierras_sombra": -25,
        "tierras_oscuras": -50,
    }

    TERRAIN_PRIORITY = {
        "agua": 7,
        "infranqueable": 6,
        "desalentador": 5,
        "muy_dificil": 4,
        "dificil": 3,
        "moderado": 2,
        "facil": 1,
    }

    LAND_TYPE_PRIORITY = {
        "tierras_oscuras": 5,
        "tierras_sombra": 4,
        "tierras_salvajes": 3,
        "tierras_fronterizas": 2,
        "tierras_libres": 1,
    }

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
        self._build_river_segments()
        self._build_barrier_segments()
        self._build_location_map()
        self._compute_components()
        self._stitch_components(max_gap=0.5)
        self._compute_components()

    _DIFFICULTY_BY_ID = {
        1: "facil",
        2: "moderado",
        3: "dificil",
        4: "muy_dificil",
        5: "desalentador",
        6: "infranqueable",
        7: "agua",
    }

    _LAND_TYPE_BY_ID = {
        1: "tierras_libres",
        2: "tierras_fronterizas",
        3: "tierras_salvajes",
        4: "tierras_sombra",
        5: "tierras_oscuras",
    }

    def _distance(self, p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
        return math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2)

    def _coord_to_cell(self, x: float, y: float) -> Tuple[int, int]:
        if not self._use_grid:
            return (-1, -1)
        cx = max(0, min(self.grid_w - 1, int(round(x * self.grid_w / 100.0))))
        cy = max(0, min(self.grid_h - 1, int(round((100.0 - y) * self.grid_h / 100.0))))
        return cx, cy

    def _grid_lookup_terrain(self, x: float, y: float) -> Optional[str]:
        if not self._use_grid:
            return None
        cx, cy = self._coord_to_cell(x, y)
        cell_id = self.terrain_grid[cy * self.grid_w + cx]
        if cell_id == 0:
            return None
        return self._DIFFICULTY_BY_ID.get(cell_id)

    def _grid_lookup_land(self, x: float, y: float) -> Optional[str]:
        if not self._use_grid or not self.land_grid:
            return None
        cx, cy = self._coord_to_cell(x, y)
        cell_id = self.land_grid[cy * self.grid_w + cx]
        if cell_id == 0:
            return None
        return self._LAND_TYPE_BY_ID.get(cell_id)

    def get_terrain_from_polygons(self, x: float, y: float) -> str:
        grid_val = self._grid_lookup_terrain(x, y)
        return grid_val if grid_val is not None else "moderado"

    def get_land_type_from_polygons(self, x: float, y: float) -> str:
        grid_val = self._grid_lookup_land(x, y)
        return grid_val if grid_val is not None else "tierras_salvajes"

    def _terrain_at(self, x: float, y: float) -> str:
        grid_terrain = self.get_terrain_from_polygons(x, y)
        if grid_terrain != "moderado":
            return grid_terrain

        grid_key = (round(x), round(y))
        if grid_key in self.location_map:
            return self.location_map[grid_key]["terrain"]

        min_dist = float("inf")
        nearest_terrain = "moderado"
        for loc in self.locations:
            dist = self._distance((x, y), (loc.get("x", 0), loc.get("y", 0)))
            if dist < min_dist:
                min_dist = dist
                nearest_terrain = loc.get("tipo_terreno", "moderado")
        return nearest_terrain

    def _land_at(self, x: float, y: float) -> str:
        grid_land = self.get_land_type_from_polygons(x, y)
        return grid_land if grid_land else "tierras_salvajes"

    def _segment_intersects(self, p1, p2, p3, p4) -> bool:
        def ccw(A, B, C):
            return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0])

        return ccw(p1, p3, p4) != ccw(p2, p3, p4) and ccw(p1, p2, p3) != ccw(p1, p2, p4)

    def _point_to_segment_distance(
        self,
        point: Tuple[float, float],
        seg_start: Tuple[float, float],
        seg_end: Tuple[float, float],
    ) -> float:
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

    def _closest_point_on_segment(
        self,
        point: Tuple[float, float],
        seg_start: Tuple[float, float],
        seg_end: Tuple[float, float],
    ) -> Tuple[float, float]:
        px, py = point
        x1, y1 = seg_start
        x2, y2 = seg_end

        dx = x2 - x1
        dy = y2 - y1

        if dx == 0 and dy == 0:
            return seg_start

        t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
        return (x1 + t * dx, y1 + t * dy)

    def _get_intersection_point(
        self,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        p3: Tuple[float, float],
        p4: Tuple[float, float],
    ) -> Optional[Tuple[float, float]]:
        x1, y1 = p1
        x2, y2 = p2
        x3, y3 = p3
        x4, y4 = p4

        denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
        if abs(denom) < 1e-10:
            return None

        t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
        if 0 <= t <= 1:
            ix = x1 + t * (x2 - x1)
            iy = y1 + t * (y2 - y1)
            return (ix, iy)
        return None

    def _build_road_graph(self):
        self.adj: Dict[Tuple[float, float], List[Dict]] = {}
        self.road_segments: List[Dict] = []
        self.road_points: Dict[Tuple[int, int], Dict] = {}

        for road in self.roads:
            rtype = road.get("tipo", "senda")
            rname = road.get("nombre", "")
            pts = road.get("puntos", [])

            for i in range(len(pts) - 1):
                p1 = (round(pts[i]["x"], 3), round(pts[i]["y"], 3))
                p2 = (round(pts[i + 1]["x"], 3), round(pts[i + 1]["y"], 3))
                dist = self._distance(p1, p2)

                self._add_edge(p1, p2, dist, rtype, rname)
                self.road_segments.append({"start": p1, "end": p2, "type": rtype, "name": rname})

                for p in (p1, p2):
                    key = (round(p[0]), round(p[1]))
                    if key not in self.road_points:
                        self.road_points[key] = {"type": rtype, "name": rname}

        # Conectar vértices cercanos entre caminos distintos para unir cruces.
        nodes = list(self.adj.keys())
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                n1, n2 = nodes[i], nodes[j]
                d = self._distance(n1, n2)
                if 0 < d < 0.3:
                    self._add_edge(n1, n2, d, "senda", "Cruce")

    def _add_edge(self, p1, p2, dist, rtype, rname):
        if p1 not in self.adj:
            self.adj[p1] = []
        if p2 not in self.adj:
            self.adj[p2] = []
        self.adj[p1].append({"target": p2, "dist": dist, "type": rtype, "name": rname})
        self.adj[p2].append({"target": p1, "dist": dist, "type": rtype, "name": rname})

    def _build_river_segments(self):
        self.river_segments: List[Dict] = []
        for river in self.rivers:
            river_type = river.get("tipo", "profundo")
            river_name = river.get("nombre", "Unknown")
            points = river.get("puntos", [])
            for i in range(len(points) - 1):
                self.river_segments.append(
                    {
                        "start": (points[i]["x"], points[i]["y"]),
                        "end": (points[i + 1]["x"], points[i + 1]["y"]),
                        "type": river_type,
                        "name": river_name,
                    }
                )

    def _build_barrier_segments(self):
        self.barrier_segments: List[Dict] = []
        for barrier in self.barriers:
            barrier_type = barrier.get("tipo", "montana")
            barrier_name = barrier.get("nombre", "Unknown")
            points = barrier.get("puntos", [])
            for i in range(len(points) - 1):
                self.barrier_segments.append(
                    {
                        "start": (points[i]["x"], points[i]["y"]),
                        "end": (points[i + 1]["x"], points[i + 1]["y"]),
                        "type": barrier_type,
                        "name": barrier_name,
                    }
                )

    def _build_location_map(self):
        self.location_map: Dict[Tuple[int, int], Dict] = {}
        for loc in self.locations:
            grid_key = (round(loc.get("x", 0)), round(loc.get("y", 0)))
            self.location_map[grid_key] = {
                "name": loc.get("nombre", "Unknown"),
                "terrain": loc.get("tipo_terreno", "moderado"),
                "region_class": loc.get("clase_region", "tierras_salvajes"),
                "is_mountain_pass": loc.get("es_paso_montana", False),
            }

    def _get_road_at_point(self, x: float, y: float) -> Optional[Dict]:
        grid_key = (round(x), round(y))
        if grid_key in self.road_points:
            return self.road_points[grid_key]

        point = (x, y)
        closest_road = None
        closest_dist = float("inf")
        tolerance = 0.6 * self.GRID_RESOLUTION

        for segment in self.road_segments:
            dist = self._point_to_segment_distance(point, segment["start"], segment["end"])
            if dist < tolerance and dist < closest_dist:
                closest_dist = dist
                closest_road = {"type": segment["type"], "name": segment["name"]}

        return closest_road

    def _road_crosses_barrier_at_segment(self, path_start, path_end, barrier_seg: Dict) -> bool:
        barrier_start = barrier_seg["start"]
        barrier_end = barrier_seg["end"]

        for road_seg in self.road_segments:
            road_start = road_seg["start"]
            road_end = road_seg["end"]

            if self._segment_intersects(road_start, road_end, barrier_start, barrier_end):
                intersection = self._get_intersection_point(
                    road_start, road_end, barrier_start, barrier_end
                )
                if intersection:
                    dist_to_intersection = self._point_to_segment_distance(
                        intersection, path_start, path_end
                    )
                    if dist_to_intersection < 3.0:
                        return True
        return False

    def _check_barrier_crossing(self, p1, p2) -> bool:
        for barrier_seg in self.barrier_segments:
            if self._segment_intersects(p1, p2, barrier_seg["start"], barrier_seg["end"]):
                if self._road_crosses_barrier_at_segment(p1, p2, barrier_seg):
                    continue
                return True
        return False

    def _check_river_crossing(self, p1, p2) -> Optional[Dict]:
        for river_seg in self.river_segments:
            if self._segment_intersects(p1, p2, river_seg["start"], river_seg["end"]):
                return {"type": river_seg["type"], "name": river_seg["name"]}
        return None

    def _segment_crosses_blocking_terrain(self, from_pos, to_pos) -> bool:
        if (
            self._get_road_at_point(from_pos[0], from_pos[1]) is not None
            and self._get_road_at_point(to_pos[0], to_pos[1]) is not None
        ):
            return False

        if self._check_barrier_crossing(from_pos, to_pos):
            return True

        if not self._use_grid:
            return False

        fx, fy = from_pos
        tx, ty = to_pos
        for i in range(1, 6):
            t = i / 6.0
            x = fx + (tx - fx) * t
            y = fy + (ty - fy) * t
            terr = self._grid_lookup_terrain(x, y)
            if terr in ("infranqueable", "agua"):
                return True
        return False

    def _get_path_nodes(self, end_node: PathNode):
        current = end_node
        while current is not None:
            yield current
            current = current.parent

    def _compute_components(self):
        self._node_comp: Dict[Tuple[float, float], int] = {}
        self._comps: List[List[Tuple[float, float]]] = []

        for n0 in self.adj:
            if n0 in self._node_comp:
                continue
            cid = len(self._comps)
            stack = [n0]
            comp = []
            while stack:
                n = stack.pop()
                if n in self._node_comp:
                    continue
                self._node_comp[n] = cid
                comp.append(n)
                for e in self.adj.get(n, []):
                    if e["target"] not in self._node_comp:
                        stack.append(e["target"])
            self._comps.append(comp)

    def _stitch_components(self, max_gap: float = 0.5):
        """
        Une fragmentos de camino cercanos si no cruzan agua/infranqueable.
        Esto ayuda mucho cuando el mapa tiene trozos de red casi conectados.
        """
        from collections import defaultdict

        if not getattr(self, "_comps", None):
            return

        cell = max_gap
        buckets = defaultdict(list)
        for n in self.adj:
            buckets[(int(n[0] / cell), int(n[1] / cell))].append(n)

        parent = list(range(len(self._comps)))

        def find(a):
            while parent[a] != a:
                parent[a] = parent[parent[a]]
                a = parent[a]
            return a

        candidates = []
        for n in self.adj:
            bx, by = int(n[0] / cell), int(n[1] / cell)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for m in buckets.get((bx + dx, by + dy), []):
                        if m <= n or self._node_comp.get(n) == self._node_comp.get(m):
                            continue
                        d = self._distance(n, m)
                        if 0 < d < max_gap and not self._segment_crosses_blocking_terrain(n, m):
                            candidates.append((d, n, m))

        candidates.sort(key=lambda c: c[0])

        for d, n, m in candidates:
            cn, cm = find(self._node_comp[n]), find(self._node_comp[m])
            if cn != cm:
                self._add_edge(n, m, d, "senda", "Enlace")
                parent[cn] = cm

    def _nearest_road_node_accessible(
        self,
        point: Tuple[float, float],
        max_dist: float = 0.18,
        limit: int = 80,
    ):
        nodes = sorted(self.adj.keys(), key=lambda n: self._distance(point, n))
        for node in nodes[:limit]:
            d = self._distance(point, node)
            if d > max_dist:
                break
            if not self._segment_crosses_blocking_terrain(point, node):
                return node, d
        return None, float("inf")

    def _conn_in_comp(self, point, comp, dest=None):
        ordered = sorted(comp, key=lambda n: self._distance(point, n))
        best = None
        best_score = float("inf")

        for n in ordered[:50]:
            if self._use_grid and self._segment_crosses_blocking_terrain(point, n):
                continue
            snap = self._distance(point, n)
            score = snap
            if dest is not None:
                score += self._distance(n, dest) * 0.03
            if score < best_score:
                best_score = score
                best = (n, snap)

        if best is not None:
            return best

        if ordered:
            return ordered[0], self._distance(point, ordered[0])
        return None, float("inf")

    def _candidate_connection_pairs(self, start, end):
        pairs = []
        for comp in getattr(self, "_comps", []):
            sn, sd = self._conn_in_comp(start, comp, dest=end)
            en, ed = self._conn_in_comp(end, comp, dest=start)
            if sn is None or en is None:
                continue
            pairs.append((sd + ed, sn, en, sd, ed))
        pairs.sort(key=lambda t: t[0])
        return pairs

    def _pick_connection_nodes(self, start, end):
        """
        Mantiene compatibilidad: devuelve la mejor pareja de nodos para enganchar
        inicio y fin a una misma componente.
        """
        pairs = self._candidate_connection_pairs(start, end)
        if pairs:
            _, sn, en, sd, ed = pairs[0]
            return sn, sd, en, ed

        sn, sd = self._nearest_road_node_accessible(start)
        en, ed = self._nearest_road_node_accessible(end)
        return sn, sd, en, ed

    def _road_path_between_nodes(self, start_node, end_node):
        """
        Busca el camino por carretera con A* sobre el grafo de caminos.
        """
        if start_node is None or end_node is None:
            return None

        ROAD_SPEED = {
            "grande": 0.2,
            "mayor": 0.3,
            "menor": 0.5,
            "senda": 0.7,
            "real": 0.3,
            "secundario": 0.5,
            "sendero": 0.7,
            "Cruce": 0.4,
        }

        open_set = [(0.0, start_node)]
        came_from = {}
        g_score = {start_node: 0.0}
        visited = set()

        while open_set:
            _, current = heapq.heappop(open_set)
            if current in visited:
                continue
            visited.add(current)

            if current == end_node:
                road_path = [current]
                while current in came_from:
                    current = came_from[current]
                    road_path.append(current)
                road_path.reverse()
                return road_path

            for edge in self.adj.get(current, []):
                nbr = edge["target"]
                mult = ROAD_SPEED.get(edge["type"], 1.0)
                tentative_g = g_score[current] + (edge["dist"] * mult)
                if nbr not in g_score or tentative_g < g_score[nbr]:
                    came_from[nbr] = current
                    g_score[nbr] = tentative_g
                    f_score = tentative_g + self._distance(nbr, end_node) * 0.1
                    heapq.heappush(open_set, (f_score, nbr))

        return None

    def _dedupe_consecutive_points(self, path: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        if not path:
            return path
        out = [path[0]]
        for p in path[1:]:
            if p != out[-1]:
                out.append(p)
        return out

    def _grid_route_around(
        self,
        start: Tuple[float, float],
        end: Tuple[float, float],
        step: float = 0.12,
        max_iter: int = 2000,
    ) -> Optional[List[Tuple[float, float]]]:
        """
        Pequeña búsqueda en rejilla para rodear agua/infranqueable en tramos cortos.
        Se usa solo como apoyo, no para sustituir el grafo de caminos.
        """
        if not self._use_grid:
            return None

        margin = max(4.0, self._distance(start, end) * 2.0)
        min_x, max_x = min(start[0], end[0]) - margin, max(start[0], end[0]) + margin
        min_y, max_y = min(start[1], end[1]) - margin, max(start[1], end[1]) + margin

        def snap(p):
            return (round(p[0] / step) * step, round(p[1] / step) * step)

        s = snap(start)
        open_set = [(0.0, s)]
        came_from = {}
        g = {s: 0.0}
        dirs = [
            (step, 0),
            (-step, 0),
            (0, step),
            (0, -step),
            (step, step),
            (step, -step),
            (-step, step),
            (-step, -step),
        ]

        goal = None
        it = 0

        while open_set and it < max_iter:
            it += 1
            _, cur = heapq.heappop(open_set)

            if self._distance(cur, end) <= step * 1.5 and not self._segment_crosses_blocking_terrain(cur, end):
                goal = cur
                break

            for dx, dy in dirs:
                nb = (round((cur[0] + dx) / step) * step, round((cur[1] + dy) / step) * step)
                if nb[0] < min_x or nb[0] > max_x or nb[1] < min_y or nb[1] > max_y:
                    continue

                if self._segment_crosses_blocking_terrain(cur, nb):
                    continue

                terr = self._terrain_at(nb[0], nb[1])
                tmult = TerrainType.from_string(terr).multiplier
                if not math.isfinite(tmult):
                    tmult = 4.0

                ng = g[cur] + self._distance(cur, nb) * tmult
                if nb not in g or ng < g[nb]:
                    g[nb] = ng
                    came_from[nb] = cur
                    heapq.heappush(open_set, (ng + self._distance(nb, end), nb))

        if goal is None:
            return None

        chain = [goal]
        c = goal
        while c in came_from:
            c = came_from[c]
            chain.append(c)
        chain.reverse()
        return [start] + chain + [end]

    def _natural_offroad_route(
        self,
        start,
        end,
        warnings,
        snap_to_roads: bool = True,
        step_km: float = 3.0,
        max_iter: int = 600,
    ):
        """
        Campo a través natural con pasos cortos y cierta variación angular.
        Se usa para:
        - tramos de entrada/salida
        - fallback cuando no hay ruta por caminos
        """
        if not self._use_grid:
            return [start, end]

        step = max(step_km / self.COORD_TO_KM, 0.03)
        path = [start]
        current = start

        angle_pattern = [22.0, 0.0, -22.0]

        for i in range(max_iter):
            remaining = self._distance(current, end)

            if remaining <= step * 1.1:
                if not self._segment_crosses_blocking_terrain(current, end):
                    path.append(end)
                    return self._dedupe_consecutive_points(path)

                route = self._grid_route_around(current, end, step=min(step, 0.1))
                if route and len(route) > 1:
                    path.extend(route[1:])
                    return self._dedupe_consecutive_points(path)

            base_angle = math.atan2(end[1] - current[1], end[0] - current[0])

            offsets = [
                angle_pattern[i % 3],
                0.0,
                -angle_pattern[i % 3],
                35.0,
                -35.0,
            ]

            best = None
            best_score = float("inf")

            for deg in offsets:
                ang = base_angle + math.radians(deg)
                cand = (
                    round(current[0] + math.cos(ang) * step, 4),
                    round(current[1] + math.sin(ang) * step, 4),
                )

                if self._segment_crosses_blocking_terrain(current, cand):
                    continue

                terr = self._terrain_at(cand[0], cand[1])
                tmult = TerrainType.from_string(terr).multiplier
                if not math.isfinite(tmult):
                    tmult = 4.0

                turn_penalty = abs(deg) / 90.0
                score = self._distance(cand, end) + (tmult * 0.15) + (turn_penalty * 0.05)

                if score < best_score:
                    best_score = score
                    best = cand

            if best is None:
                route = self._grid_route_around(current, end, step=min(step, 0.1))
                if route and len(route) > 1:
                    path.extend(route[1:])
                    return self._dedupe_consecutive_points(path)

                warnings.append(
                    "Aviso: no se pudo generar un tramo natural de campo a través sin cruzar agua/infranqueable."
                )
                path.append(end)
                return self._dedupe_consecutive_points(path)

            path.append(best)
            current = best

            if snap_to_roads:
                road_node, _ = self._nearest_road_node_accessible(
                    current,
                    max_dist=max(0.12, step * 1.5),
                )
                if road_node is not None:
                    road_route = self._road_route_between_points(current, end, warnings)
                    if road_route and len(road_route) >= 2:
                        path.extend(road_route[1:])
                        return self._dedupe_consecutive_points(path)

        warnings.append("Aviso: se alcanzó el máximo de pasos del tramo natural.")
        path.append(end)
        return self._dedupe_consecutive_points(path)

    def _offroad_leg(self, a, b, warnings, snap_to_roads: bool = True) -> List[Tuple[float, float]]:
        if not self._use_grid:
            return [a, b]
        return self._natural_offroad_route(a, b, warnings, snap_to_roads=snap_to_roads)

    def _road_route_between_points(self, start, end, warnings):
        """
        Ruta completa:
        - tramo corto de entrada al camino
        - camino por grafo
        - tramo corto de salida al destino
        """
        pairs = self._candidate_connection_pairs(start, end)
        if not pairs:
            sn, sd = self._nearest_road_node_accessible(start)
            en, ed = self._nearest_road_node_accessible(end)
            pairs = [(sd + ed, sn, en, sd, ed)]

        for _, start_node, end_node, start_off_dist, end_off_dist in pairs:
            road_path = self._road_path_between_nodes(start_node, end_node)
            if not road_path:
                continue

            full_path = []

            if start_off_dist > 0.1:
                leg = self._offroad_leg(start, road_path[0], warnings, snap_to_roads=False)
                if leg:
                    full_path.extend(leg[:-1])
                warnings.append("Inicio del trayecto realizado campo a través hasta enlazar el camino.")

            full_path.extend(road_path)

            if end_off_dist > 0.1:
                leg = self._offroad_leg(road_path[-1], end, warnings, snap_to_roads=False)
                if leg:
                    full_path.extend(leg[1:])
                warnings.append("Llegada al destino final realizada campo a través.")

            full_path = self._dedupe_consecutive_points(full_path)
            if len(full_path) >= 2:
                return full_path

        return None

    def _calculate_move_cost(
        self,
        from_node: PathNode,
        to_x: float,
        to_y: float,
    ) -> Tuple[float, str, str, str, Optional[str]]:
        """
        Compatible con el sistema anterior. Se mantiene por si alguna parte
        del proyecto lo usa, aunque el cálculo principal ahora va por rutas de
        caminos y tramos naturales.
        """
        from_pos = (from_node.x, from_node.y)
        to_pos = (to_x, to_y)

        distance_km = self._distance(from_pos, to_pos) * self.COORD_TO_KM
        to_road_info = self._get_road_at_point(to_x, to_y)
        on_road = to_road_info is not None
        road_type_str = to_road_info["type"] if to_road_info else "ninguno"
        road_name_str = to_road_info["name"] if to_road_info else ""

        terrain_str = self._terrain_at(to_x, to_y)
        river_crossing = self._check_river_crossing(from_pos, to_pos)
        river_crossing_str = river_crossing["type"] if river_crossing else None
        land_type = self._land_at(to_x, to_y)

        if not on_road and self._segment_crosses_blocking_terrain(from_pos, to_pos):
            return (float("inf"), "ninguno", "", "infranqueable", None)

        TERRAIN_MULT = {
            "facil": 0.75,
            "moderado": 1.0,
            "dificil": 1.5,
            "muy_dificil": 2.0,
            "desalentador": 3.0,
            "infranqueable": float("inf"),
            "agua": float("inf"),
        }

        ROAD_MULT = {
            "grande": 1.0,
            "mayor": 1.1,
            "menor": 1.25,
            "senda": 1.5,
            "sendero": 1.5,
            "secundario": 1.25,
            "real": 1.1,
            "ninguno": 2.0,
        }

        LAND_MULT = {
            "tierras_libres": 0.9,
            "tierras_fronterizas": 1.1,
            "fronterizas": 1.1,
            "tierras_salvajes": 1.3,
            "tierras_sombra": 2.5,
            "tierras_oscuras": 3.5,
        }

        road_mult = ROAD_MULT.get(road_type_str, 2.0)
        land_mult = LAND_MULT.get(land_type, 1.3)

        if on_road:
            terrain_mult = 1.0
            river_mult = 1.0
        else:
            terrain_mult = TERRAIN_MULT.get(terrain_str, 1.0)
            if terrain_mult == float("inf"):
                return (float("inf"), road_type_str, road_name_str, terrain_str, river_crossing_str)
            if river_crossing is not None:
                return (float("inf"), road_type_str, road_name_str, terrain_str, river_crossing_str)
            river_mult = 1.0

        AVOID_PENALTY = 100.0
        if self.avoid_shadow_lands and land_type == "tierras_sombra":
            land_mult *= AVOID_PENALTY
        if self.avoid_dark_lands and land_type == "tierras_oscuras":
            land_mult *= AVOID_PENALTY

        if not on_road:
            if self.avoid_muy_dificil and terrain_str == "muy_dificil":
                terrain_mult *= AVOID_PENALTY
            if self.avoid_desalentador and terrain_str == "desalentador":
                terrain_mult *= AVOID_PENALTY

        if self.direct_mode:
            land_mult = max(0.8, land_mult * 0.3)

        if self.avoid_roads:
            if on_road:
                road_mult *= 5.0
            else:
                road_mult = 1.0

        total_cost = distance_km * road_mult * terrain_mult * land_mult * river_mult
        return (total_cost, road_type_str, road_name_str, terrain_str, river_crossing_str)

    def _build_result_from_path(
        self,
        path: List[Tuple[float, float]],
        warnings: List[str],
    ) -> PathResult:
        if not path or len(path) < 2:
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
                terrain_summary={},
            )

        path = self._dedupe_consecutive_points(path)

        segments: List[PathSegment] = []
        rivers_crossed: List[Dict] = []
        roads_used_ordered: List[str] = []
        roads_distances: Dict[str, float] = {}
        terrain_distances: Dict[str, float] = {}

        total_distance = 0.0
        total_cost = 0.0

        for i in range(len(path) - 1):
            a = path[i]
            b = path[i + 1]
            dist = self._distance(a, b)
            dist_km = dist * self.COORD_TO_KM
            total_distance += dist_km

            mid = ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)
            terrain = self._terrain_at(mid[0], mid[1])
            land_type = self._land_at(mid[0], mid[1])

            road_info = self._get_road_at_point(mid[0], mid[1])
            road_type = road_info["type"] if road_info else "ninguno"
            road_name = road_info["name"] if road_info else ""

            river_crossing = self._check_river_crossing(a, b)
            river_type = river_crossing["type"] if river_crossing else None
            if river_type:
                rivers_crossed.append({"type": river_type, "position": mid})

            terrain_mult = TerrainType.from_string(terrain).multiplier
            if not math.isfinite(terrain_mult):
                terrain_mult = 1.0

            road_mult = RoadType.from_string(road_type).multiplier
            if road_type == "ninguno":
                road_mult = 2.0

            land_mult = {
                "tierras_libres": 0.9,
                "tierras_fronterizas": 1.1,
                "fronterizas": 1.1,
                "tierras_salvajes": 1.3,
                "tierras_sombra": 2.5,
                "tierras_oscuras": 3.5,
            }.get(land_type, 1.3)

            segment_cost = dist_km * terrain_mult * road_mult * land_mult
            if not math.isfinite(segment_cost):
                segment_cost = dist_km

            total_cost += segment_cost
            terrain_distances[terrain] = terrain_distances.get(terrain, 0.0) + dist_km

            if road_name:
                roads_distances[road_name] = roads_distances.get(road_name, 0.0) + dist_km

            segments.append(
                PathSegment(
                    start=a,
                    end=b,
                    distance_km=round(dist_km, 3),
                    terrain=terrain,
                    road_type=road_type,
                    river_crossing=river_type,
                    travel_cost=round(segment_cost, 3),
                )
            )

        min_road_distance = max(30.0, total_distance * 0.05)
        for name, dist in roads_distances.items():
            if dist >= min_road_distance and name not in roads_used_ordered:
                roads_used_ordered.append(name)

        if terrain_distances.get("infranqueable", 0) > 0:
            warnings.append("🛤️ La ruta atraviesa pasos de montaña gracias al camino.")
        if terrain_distances.get("agua", 0) > 0:
            warnings.append("🌉 La ruta cruza zonas de agua mediante puentes o vados.")
        if terrain_distances.get("desalentador", 0) > 10:
            warnings.append("⚠️ Gran parte de la ruta atraviesa terreno desalentador.")
        if len(rivers_crossed) > 0:
            warnings.append(f"🌊 La ruta cruza {len(rivers_crossed)} río(s).")

        estimated_days = total_cost / self.BASE_SPEED_KM_DAY if total_cost > 0 else 0

        return PathResult(
            success=True,
            path=path,
            segments=segments,
            total_distance_km=round(total_distance, 1),
            total_travel_cost=round(total_cost, 1),
            estimated_days=round(estimated_days, 1),
            warnings=warnings,
            rivers_crossed=rivers_crossed,
            roads_used=roads_used_ordered,
            terrain_summary={k: round(v, 1) for k, v in terrain_distances.items()},
        )

    def find_path(
        self,
        start: Tuple[float, float],
        end: Tuple[float, float],
        max_iterations: int = 80000,
    ) -> PathResult:
        """
        Prioridad:
        1. intentar ruta por caminos
        2. si falla, usar campo a través natural
        """
        warnings: List[str] = []

        # 1) Intentar seguir caminos de verdad.
        if self.prefer_roads and self.adj:
            road_route = self._road_route_between_points(start, end, warnings)
            if road_route and len(road_route) >= 2:
                return self._build_result_from_path(road_route, warnings)

        # 2) Fallback natural.
        natural = self._natural_offroad_route(start, end, warnings, snap_to_roads=False)
        if natural and len(natural) >= 2:
            return self._build_result_from_path(natural, warnings)

        warnings.append("No se pudo calcular la ruta. Verifica origen y destino.")
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
            terrain_summary={},
        )

    def find_path_by_location_ids(self, start_id: str, end_id: str) -> PathResult:
        start_loc = next((loc for loc in self.locations if loc.get("id") == start_id), None)
        end_loc = next((loc for loc in self.locations if loc.get("id") == end_id), None)

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
                terrain_summary={},
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
                terrain_summary={},
            )

        start = (start_loc.get("x", 0), start_loc.get("y", 0))
        end = (end_loc.get("x", 0), end_loc.get("y", 0))
        result = self.find_path(start, end)

        if result.success:
            result.warnings.insert(0, f"📍 {start_loc.get('nombre')} → {end_loc.get('nombre')}")

        return result