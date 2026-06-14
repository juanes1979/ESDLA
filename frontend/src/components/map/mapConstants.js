/**
 * Map Constants
 * Shared constants for the Middle-earth map components
 */

// Terrain colors matching the map legend (difficulty)
export const TERRAIN_COLORS = {
  facil: '#c4b998',          // Cream/tan
  moderado: '#8b9a6b',       // Olive green
  dificil: '#a08060',        // Light brown
  muy_dificil: '#8b6914',    // Medium brown
  desalentador: '#c45c30',   // Orange/rust
  infranqueable: '#4a3728',  // Dark brown
};

// Terrain type names for display
export const TERRAIN_NAMES = {
  facil: 'Fácil',
  moderado: 'Moderado',
  dificil: 'Difícil',
  muy_dificil: 'Muy Difícil',
  desalentador: 'Desalentador',
  infranqueable: 'Infranqueable',
};

// Land type colors (danger level)
export const LAND_COLORS = {
  tierras_libres: '#22c55e',    // Green
  fronterizas: '#eab308',       // Yellow
  tierras_salvajes: '#f97316',  // Orange
  tierras_sombra: '#ef4444',    // Red
  tierras_oscuras: '#7c3aed',   // Purple
};

// Location type icons
export const LOCATION_ICONS = {
  ciudad_capital: '🏰',
  ciudad: '🏘️',
  ciudad_puerto: '⚓',
  ciudad_elfica: '✨',
  ciudad_lago: '🏞️',
  pueblo: '🏠',
  fortaleza: '🏯',
  fortaleza_enemiga: '💀',
  fortaleza_abandonada: '🏚️',
  reino_enano: '⛏️',
  reino_elfico: '🌟',
  refugio_elfico: '🌿',
  refugio: '🛖',
  ruinas: '🏛️',
  bosque: '🌲',
  bosque_antiguo: '🌳',
  bosque_elfico: '🌸',
  bosque_oscuro: '🌑',
  cordillera: '⛰️',
  volcan: '🌋',
  paso_montaña: '🚶',
  colinas: '🏔️',
  lago: '💧',
  rio: '🌊',
  pantano: '🐸',
  region: '📍',
  vado: '🌉',
  camino: '🛤️',
  puerto: '⛵',
  almenaras: '🔥',
  monumento: '🗿',
  lugar_especial: '⭐',
  // Iter 121 (Feb 2026) — tipos extra creados durante el juego, ahora con icono
  cascada: '💦',
  cueva: '🕳️',
  isla: '🏝️',
  llanura: '🌾',
  mina: '⛏️',
  paramo: '🌬️',
  peninsula: '🏖️',
  puente: '🌁',
  puerta: '🚪',
  túmulos: '🪦',
  valle: '🏞️',
};

// Human-readable type names
export const TYPE_NAMES = {
  ciudad_capital: 'Capital',
  ciudad: 'Ciudad',
  ciudad_puerto: 'Ciudad Puerto',
  ciudad_elfica: 'Ciudad Élfica',
  ciudad_lago: 'Ciudad sobre el Lago',
  pueblo: 'Pueblo',
  fortaleza: 'Fortaleza',
  fortaleza_enemiga: 'Fortaleza Enemiga',
  fortaleza_abandonada: 'Ruinas de Fortaleza',
  reino_enano: 'Reino Enano',
  reino_elfico: 'Reino Élfico',
  refugio_elfico: 'Refugio Élfico',
  refugio: 'Refugio',
  ruinas: 'Ruinas',
  bosque: 'Bosque',
  bosque_antiguo: 'Bosque Antiguo',
  bosque_elfico: 'Bosque Élfico',
  bosque_oscuro: 'Bosque Oscuro',
  cordillera: 'Cordillera',
  volcan: 'Volcán',
  paso_montaña: 'Paso de Montaña',
  colinas: 'Colinas',
  lago: 'Lago',
  rio: 'Río',
  pantano: 'Pantano',
  region: 'Región',
  vado: 'Vado',
  camino: 'Camino',
  puerto: 'Puerto',
  almenaras: 'Almenara',
  monumento: 'Monumento',
  lugar_especial: 'Lugar Especial',
  // Feb 2026
  cascada: 'Cascada',
  cueva: 'Cueva',
  isla: 'Isla',
  llanura: 'Llanura',
  mina: 'Mina',
  paramo: 'Páramo',
  peninsula: 'Península',
  puente: 'Puente',
  puerta: 'Puerta',
  túmulos: 'Túmulos',
  valle: 'Valle',
};

// Type categories for filtering
export const TYPE_CATEGORIES = {
  settlements: ['ciudad_capital', 'ciudad', 'ciudad_puerto', 'ciudad_elfica', 'ciudad_lago', 'pueblo', 'refugio', 'refugio_elfico'],
  fortresses: ['fortaleza', 'fortaleza_enemiga', 'fortaleza_abandonada', 'reino_enano', 'reino_elfico'],
  nature: ['bosque', 'bosque_antiguo', 'bosque_elfico', 'bosque_oscuro', 'cordillera', 'volcan', 'colinas', 'lago', 'rio', 'pantano', 'cascada', 'isla', 'llanura', 'paramo', 'peninsula', 'valle'],
  other: ['ruinas', 'region', 'vado', 'camino', 'puerto', 'almenaras', 'paso_montaña', 'monumento', 'lugar_especial', 'cueva', 'mina', 'puente', 'puerta', 'túmulos'],
};

// Road types
export const ROAD_TYPES = {
  grande: { label: 'Grandes Caminos', color: '#FFD700', width: 6 },
  mayor: { label: 'Caminos Mayores', color: '#C9A227', width: 4.5 },
  menor: { label: 'Caminos Menores', color: '#A08050', width: 3 },
  senda: { label: 'Sendas', color: '#8B7355', width: 2, dashed: true },
  // Legacy types for backwards compatibility
  real: { label: 'Grandes Caminos', color: '#FFD700', width: 6 },
  principal: { label: 'Caminos Mayores', color: '#C9A227', width: 4.5 },
  secundario: { label: 'Caminos Menores', color: '#A08050', width: 3 },
  sendero: { label: 'Sendas', color: '#8B7355', width: 2, dashed: true },
};

// River types
export const RIVER_TYPES = {
  grande: { label: 'Río Grande', color: '#1E90FF', width: 4 },
  rio: { label: 'Río', color: '#4169E1', width: 3 },
  arroyo: { label: 'Arroyo', color: '#6495ED', width: 2 },
  lago: { label: 'Orilla de Lago', color: '#00CED1', width: 3 },
};

// Barrier types
export const BARRIER_TYPES = {
  cordillera: { label: 'Cordillera', color: '#808080', width: 6 },
  precipicio: { label: 'Precipicio', color: '#A52A2A', width: 4 },
  muro: { label: 'Muro/Muralla', color: '#2F4F4F', width: 3 },
  frontera: { label: 'Frontera', color: '#FFD700', width: 2, dashed: true },
};

// Map dimensions
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 900;

// Map images for different views
export const MAP_IMAGES = {
  political: {
    name: 'Mapa Político',
    url: 'https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/c65i3dse_middle_earth_map.jpg',
  },
  terrain: {
    name: 'Mapa de Terreno',
    url: 'https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/p8yvqxag_middle_earth_terrain.jpg',
  },
  detailed: {
    name: 'Mapa Detallado',
    url: 'https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/k1rmvdnf_middle_earth_detailed.png',
  },
  simple: {
    name: 'Mapa Simple',
    url: 'https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/zsv8gniq_middle_earth_simple.png',
  },
  lotr: {
    name: 'Mapa del Anillo',
    url: 'https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/f9mclj10_middle_earth_lotr.jpg',
  },
};

// Default regions hierarchy
export const REGION_HIERARCHY = {
  eriador: {
    name: 'Eriador',
    children: ['La Comarca', 'Bree-Land', 'Arthedain', 'Cardolan', 'Rhudaur', 'Lindon', 'Eregion']
  },
  angmar: {
    name: 'Angmar',
    children: ['Monte Gundabad', 'Carn Dûm']
  },
  misty_mountains: {
    name: 'Montañas Nubladas',
    children: ['Alto Paso', 'Paso de Cirith Forn', 'Moria']
  },
  rhovanion: {
    name: 'Rhovanion',
    children: ['Valle del Anduin', 'Bosque Negro', 'El Valle', 'Lago Largo', 'Tierras Pardas', 'Dorwinion', 'Mar de Rhûn']
  },
  gondor: {
    name: 'Gondor',
    children: ['Minas Tirith', 'Ithilien', 'Osgiliath', 'Pelargir', 'Dol Amroth', 'Lossarnach', 'Lebennin']
  },
  rohan: {
    name: 'Rohan',
    children: ['Edoras', 'Abismo de Helm', 'Isengard', 'Fangorn']
  },
  mordor: {
    name: 'Mordor',
    children: ['Barad-dûr', 'Monte del Destino', 'Minas Morgul', 'Cirith Ungol', 'Núrn']
  },
  harad: {
    name: 'Harad',
    children: ['Harad Cercano', 'Harad Lejano', 'Umbar']
  },
};

// Static region list for fallback
export const REGIONS = [
  'Eriador', 'La Comarca', 'Bree-Land', 'Arthedain', 'Lindon', 'Rivendell',
  'Angmar', 'Montañas Nubladas', 'Rhovanion', 'Bosque Negro', 'El Valle',
  'Lothlórien', 'Fangorn', 'Rohan', 'Gondor', 'Mordor', 'Harad', 'Rhûn'
];

// Terrain difficulty multipliers for travel time
export const TERRAIN_MULTIPLIERS = {
  facil: 1.0,
  moderado: 1.25,
  dificil: 1.5,
  muy_dificil: 2.0,
  desalentador: 3.0,
  infranqueable: Infinity,
};

// Land type encounter chances
export const LAND_ENCOUNTER_CHANCES = {
  tierras_libres: 0.05,
  fronterizas: 0.15,
  tierras_salvajes: 0.25,
  tierras_sombra: 0.40,
  tierras_oscuras: 0.60,
};
