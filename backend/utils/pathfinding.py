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


# Mapa id→nombre del ráster de dificultad (espejo de terrain_grid_routes.py).
_DIFFICULTY_NAMES = {
    1: "facil", 2: "moderado", 3: "dificil", 4: "muy_dificil",
    5: "desalentador", 6: "infranqueable", 7: "agua",
}


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

        # 3. Componentes + coser fragmentos de camino cercanos POR TIERRA a la
        #    red principal (evita rectas y rodeos por trozos aislados).
        self._compute_components()
        self._stitch_components(max_gap=0.5)
        self._compute_components()

    def _compute_components(self):
        """Calcula las componentes conexas del grafo de caminos."""
        self._node_comp = {}
        self._comps = []
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
                for e in self.adj[n]:
                    if e['target'] not in self._node_comp:
                        stack.append(e['target'])
            self._comps.append(comp)

    def _stitch_components(self, max_gap: float = 0.5):
        """Une fragmentos de camino cercanos (< max_gap) SOLO si el enlace no
        cruza agua/infranqueable. Hash espacial + unión por Kruskal para que
        caminos que visualmente se juntan queden conectados en el grafo."""
        from collections import defaultdict
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
                        if m <= n or self._node_comp[n] == self._node_comp[m]:
                            continue
                        d = self._distance(n, m)
                        if 0 < d < max_gap and not self._segment_crosses_water(n, m):
                            candidates.append((d, n, m))
        candidates.sort(key=lambda c: c[0])
        for d, n, m in candidates:
            cn, cm = find(self._node_comp[n]), find(self._node_comp[m])
            if cn != cm:
                self._add_edge(n, m, d, 'senda', 'Enlace')
                parent[cn] = cm

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

    # --- Muestreo de terreno y construcción de segmentos (para PX/días/terreno) ---
    def _terrain_at(self, x: float, y: float) -> str:
        """Lee la dificultad del terreno en (x,y) desde el ráster (coords 0-100)."""
        if not self._use_grid:
            return 'moderado'
        cx, cy = self._coord_to_cell(x, y)
        val = self.terrain_grid[cy * self.grid_w + cx]
        return _DIFFICULTY_NAMES.get(val, 'moderado')

    def _road_edge_between(self, a, b) -> Optional[Dict]:
        for edge in self.adj.get(a, []):
            if edge['target'] == b:
                return edge
        return None

    _ROAD_MULT = {
        'grande': 0.35, 'mayor': 0.5, 'menor': 0.7, 'senda': 0.85,
        'real': 0.5, 'secundario': 0.7, 'sendero': 0.85, 'Cruce': 0.6, 'ninguno': 1.0,
    }

    def _build_segments(self, full_path: List[Tuple[float, float]]):
        """Construye segmentos finos (~1 km) con terreno/camino reales.

        Devuelve (segments, terrain_summary, roads_used). Los PX y días son
        proporcionales a la distancia, así que subdividir no altera el total.
        """
        segments: List[PathSegment] = []
        terrain_summary: Dict[str, float] = {}
        roads_used: List[str] = []

        for i in range(len(full_path) - 1):
            a, b = full_path[i], full_path[i + 1]
            edge = self._road_edge_between(a, b)
            road_type = edge['type'] if edge else 'ninguno'
            if edge and edge.get('name') and edge['name'] not in ('Cruce', '') \
                    and edge['name'] not in roads_used:
                roads_used.append(edge['name'])

            seg_len_km = self._distance(a, b) * self.COORD_TO_KM
            if seg_len_km <= 0:
                continue

            n = max(1, int(round(seg_len_km)))  # ~1 km por sub-tramo
            rmult = self._ROAD_MULT.get(road_type, 1.0)
            for k in range(n):
                t0, t1 = k / n, (k + 1) / n
                s = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
                e = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
                mx, my = (s[0] + e[0]) / 2, (s[1] + e[1]) / 2
                terr = self._terrain_at(mx, my)
                # En camino (puente/vado) no dejamos agua/infranqueable.
                if road_type != 'ninguno' and terr in ('agua', 'infranqueable'):
                    terr = 'moderado'
                sub_km = seg_len_km / n
                tmult = TerrainType.from_string(terr).multiplier
                if not math.isfinite(tmult):
                    tmult = 4.0
                cost = sub_km * tmult * rmult
                segments.append(PathSegment(
                    start=s, end=e, distance_km=round(sub_km, 3),
                    terrain=terr, road_type=road_type,
                    river_crossing=None, travel_cost=round(cost, 3),
                ))
                terrain_summary[terr] = round(terrain_summary.get(terr, 0.0) + sub_km, 3)

        return segments, terrain_summary, roads_used

    # --- Enrutado fuera de camino evitando agua/infranqueable ---
    def _coord_to_cell(self, x: float, y: float):
        # El ráster tiene el origen arriba: la Y del mapa (0-100) va invertida.
        cx = int(round(x * self.grid_w / 100.0))
        cy = int(round((100.0 - y) * self.grid_h / 100.0))
        cx = 0 if cx < 0 else (self.grid_w - 1 if cx >= self.grid_w else cx)
        cy = 0 if cy < 0 else (self.grid_h - 1 if cy >= self.grid_h else cy)
        return cx, cy

    def _cell_blocked(self, cx: int, cy: int) -> bool:
        if cx < 0 or cy < 0 or cx >= self.grid_w or cy >= self.grid_h:
            return True
        # 6 = infranqueable, 7 = agua
        return self.terrain_grid[cy * self.grid_w + cx] in (6, 7)

    def _segment_crosses_water(self, a, b) -> bool:
        """True si la recta a→b toca agua o terreno infranqueable."""
        if not self._use_grid:
            return False
        n = max(2, int(self._distance(a, b) / 0.025))  # muestreo fino (~1/2 celda)
        for i in range(n + 1):
            t = i / n
            cx, cy = self._coord_to_cell(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            if self._cell_blocked(cx, cy):
                return True
        return False

    def _grid_route_around(self, start, end, step: float = 0.1, max_iter: int = 45000):
        """A* de rejilla (8-dir) que rodea agua/infranqueable. Devuelve la lista
        de puntos [start,...,end] o None si no encuentra rodeo dentro del margen."""
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
        dirs = [(step, 0), (-step, 0), (0, step), (0, -step),
                (step, step), (step, -step), (-step, step), (-step, -step)]
        goal = None
        it = 0
        while open_set and it < max_iter:
            it += 1
            _, cur = heapq.heappop(open_set)
            if self._distance(cur, end) <= step * 1.5 and not self._segment_crosses_water(cur, end):
                goal = cur
                break
            for dx, dy in dirs:
                nb = (round((cur[0] + dx) / step) * step, round((cur[1] + dy) / step) * step)
                if nb[0] < min_x or nb[0] > max_x or nb[1] < min_y or nb[1] > max_y:
                    continue
                cx, cy = self._coord_to_cell(nb[0], nb[1])
                if self._cell_blocked(cx, cy) or self._segment_crosses_water(cur, nb):
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

    def _offroad_leg(self, a, b, warnings) -> List[Tuple[float, float]]:
        """Tramo fuera de camino: recta si está limpia, si no rodea el agua."""
        if not self._use_grid or not self._segment_crosses_water(a, b):
            return [a, b]
        route = self._grid_route_around(a, b)
        if route and len(route) >= 2:
            return route
        warnings.append("Aviso: un tramo fuera de camino cruza agua/terreno infranqueable (sin rodeo posible).")
        return [a, b]

    def _closest_land_road_node(self, point):
        """Nodo de carretera más cercano ACCESIBLE POR TIERRA (sin cruzar agua
        en la recta punto→nodo). Así se entra/sale de la red por el lado
        correcto y la red de caminos (con puentes) hace los cruces de río."""
        nodes = list(self.adj.keys())
        if not nodes:
            return None, float('inf')
        ordered = sorted(nodes, key=lambda n: self._distance(point, n))
        if self._use_grid:
            for n in ordered[:60]:
                if not self._segment_crosses_water(point, n):
                    return n, self._distance(point, n)
        return ordered[0], self._distance(point, ordered[0])

    def _conn_in_comp(self, point, comp):
        """En una componente, nodo de enganche: el más cercano accesible por
        tierra; si ninguno de los cercanos lo es, el geométricamente más cercano."""
        ordered = sorted(comp, key=lambda n: self._distance(point, n))
        if self._use_grid:
            for n in ordered[:40]:
                if not self._segment_crosses_water(point, n):
                    return n, self._distance(point, n)
        return ordered[0], self._distance(point, ordered[0])

    def _pick_connection_nodes(self, start, end):
        """Elige nodos de enganche de inicio y fin que estén en la MISMA
        componente conexa (para que la ruta llegue por camino) y, dentro de
        ella, accesibles por tierra. Minimiza la distancia total fuera de camino."""
        best = None
        for comp in getattr(self, '_comps', []):
            sn, sd = self._conn_in_comp(start, comp)
            en, ed = self._conn_in_comp(end, comp)
            if sn is None or en is None:
                continue
            total = sd + ed
            if best is None or total < best[0]:
                best = (total, sn, en, sd, ed)
        if best is None:
            sn, sd = self._get_closest_road_node(start)
            en, ed = self._get_closest_road_node(end)
            return sn, sd, en, ed
        return best[1], best[3], best[2], best[4]

    def find_path(self, start: Tuple[float, float], end: Tuple[float, float], max_iterations: int = 80000) -> PathResult:
        warnings = []

        # Nodos de enganche en la misma componente conexa y accesibles por tierra,
        # para que la ruta llegue por camino al lado correcto del río.
        start_node, start_off_dist, end_node, end_off_dist = self._pick_connection_nodes(start, end)

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

                # Añadir tramos inicial y final campo a través (rodeando agua)
                full_path = []
                if start_off_dist > 0.1:
                    leg = self._offroad_leg(start, road_path[0], warnings)
                    full_path.extend(leg[:-1])
                    warnings.append("Inicio del trayecto realizado campo a través hasta enlazar el camino.")

                full_path.extend(road_path)

                if end_off_dist > 0.1:
                    leg = self._offroad_leg(road_path[-1], end, warnings)
                    full_path.extend(leg[1:])
                    warnings.append("Llegada al destino final realizada campo a través.")

                # Generar puntos de paso cada 1 km exacto
                dense_path = self._interpolate_path_by_km(full_path, step_km=1.0)

                total_km = 0.0
                for i in range(len(full_path) - 1):
                    total_km += self._distance(full_path[i], full_path[i+1]) * self.COORD_TO_KM

                # Segmentos finos con terreno/camino reales (para PX y días).
                segments, terrain_summary, roads_used = self._build_segments(full_path)
                total_cost = round(sum(s.travel_cost for s in segments), 1) or round(total_km * 0.5, 1)
                if not roads_used:
                    roads_used = ["Red Vial"]

                return PathResult(
                    success=True,
                    path=dense_path,
                    segments=segments,
                    total_distance_km=round(total_km, 1),
                    total_travel_cost=total_cost,
                    estimated_days=round(total_km / self.BASE_SPEED_KM_DAY, 1),
                    warnings=warnings,
                    rivers_crossed=[],
                    roads_used=roads_used,
                    terrain_summary=terrain_summary or {'moderado': round(total_km, 1)}
                )

        # Si no hay ninguna carretera cerca o prefer_roads=False, ir campo a través
        # (rodeando agua/infranqueable si es necesario).
        raw_path = self._offroad_leg(start, end, warnings)
        dense_path = self._interpolate_path_by_km(raw_path, step_km=1.0)
        total_km = sum(
            self._distance(raw_path[i], raw_path[i + 1]) for i in range(len(raw_path) - 1)
        ) * self.COORD_TO_KM

        warnings.append("Trayecto realizado campo a través.")

        # Segmentos finos campo a través con terreno real (para PX y días).
        segments, terrain_summary, _ = self._build_segments(raw_path)
        total_cost = round(sum(s.travel_cost for s in segments), 1) or round(total_km * 1.5, 1)

        return PathResult(
            success=True,
            path=dense_path,
            segments=segments,
            total_distance_km=round(total_km, 1),
            total_travel_cost=total_cost,
            estimated_days=round((total_km * 1.5) / self.BASE_SPEED_KM_DAY, 1),
            warnings=warnings,
            rivers_crossed=[],
            roads_used=[],
            terrain_summary=terrain_summary or {'dificil': round(total_km, 1)}
        )

    def find_path_by_location_ids(self, start_id: str, end_id: str) -> PathResult:
        start_loc = next((loc for loc in self.locations if loc.get('id') == start_id), None)
        end_loc = next((loc for loc in self.locations if loc.get('id') == end_id), None)
        
        if not start_loc or not end_loc:
            return PathResult(False, [], [], 0, 0, 0, ["Ubicación no encontrada"], [], [], {})
        
        return self.find_path((start_loc['x'], start_loc['y']), (end_loc['x'], end_loc['y']))