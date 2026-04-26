/**
 * Shared constants and helpers for the Enhanced Travel System.
 * Extracted from EnhancedTravelSystem.jsx to keep that file manageable.
 */
import React from 'react';
import {
  Compass, Zap, Eye, Map, Snowflake, Leaf, Sun
} from 'lucide-react';

// Map URLs and coordinate system
// Both maps have the same pixel dimensions (19791x15133)
// Player map loaded from local public folder
export const PLAYER_MAP_URL = '/mapa_jugadores.jpg';
// Use actual pixel dimensions for coordinate system
export const MAP_PIXEL_WIDTH = 19791;
export const MAP_PIXEL_HEIGHT = 15133;

// Elvish months with seasons
export const MESES_ELFICOS = [
  { id: "Nénimë", nombre: "Nénimë (Enero)", estacion: "invierno" },
  { id: "Súlimë", nombre: "Súlimë (Febrero)", estacion: "invierno" },
  { id: "Coiviennë", nombre: "Coiviennë (Marzo)", estacion: "primavera" },
  { id: "Víressë", nombre: "Víressë (Abril)", estacion: "primavera" },
  { id: "Lótessë", nombre: "Lótessë (Mayo)", estacion: "primavera" },
  { id: "Nárië", nombre: "Nárië (Junio)", estacion: "verano" },
  { id: "Cermië", nombre: "Cermië (Julio)", estacion: "verano" },
  { id: "Urimë", nombre: "Urimë (Agosto)", estacion: "verano" },
  { id: "Yavannië", nombre: "Yavannië (Septiembre)", estacion: "verano" },
  { id: "Narquelië", nombre: "Narquelië (Octubre)", estacion: "otono" },
  { id: "Hísimë", nombre: "Hísimë (Noviembre)", estacion: "otono" },
  { id: "Ringarë", nombre: "Ringarë (Diciembre)", estacion: "invierno" },
];

export const SeasonIcon = ({ estacion }) => {
  switch (estacion) {
    case 'invierno': return <Snowflake className="w-4 h-4 text-blue-400" />;
    case 'primavera': return <Leaf className="w-4 h-4 text-green-400" />;
    case 'verano': return <Sun className="w-4 h-4 text-yellow-400" />;
    case 'otono': return <Leaf className="w-4 h-4 text-orange-400" />;
    default: return null;
  }
};

// Role icons
export const ROLE_ICONS = {
  guia: <Compass className="w-4 h-4" />,
  cazador: <Zap className="w-4 h-4" />,
  vigia: <Eye className="w-4 h-4" />,
  explorador: <Map className="w-4 h-4" />
};

export const ROLE_INFO = {
  guia: {
    nombre: 'Guía',
    desc: 'A cargo de todas las decisiones relativas a la ruta, el descanso y los suministros.',
    habilidad: 'Viajar',
    habilidad_key: 'viajar',
    atributo: 'sabiduria',
    atributo_nombre: 'Sabiduría'
  },
  cazador: {
    nombre: 'Cazador',
    desc: 'Encargado de encontrar comida en la naturaleza.',
    habilidad: 'Caza',
    habilidad_key: 'caza',
    atributo: 'sabiduria',
    atributo_nombre: 'Sabiduría'
  },
  vigia: {
    nombre: 'Vigía',
    desc: 'Responsable de la vigilancia.',
    habilidad: 'Percepción',
    habilidad_key: 'percepcion',
    atributo: 'sabiduria',
    atributo_nombre: 'Sabiduría'
  },
  explorador: {
    nombre: 'Explorador',
    desc: 'Encargado de montar el campamento y de abrir nuevos caminos.',
    habilidad: 'Explorar',
    habilidad_key: 'explorar',
    atributo: 'sabiduria',
    atributo_nombre: 'Sabiduría'
  }
};

// Helper to check if a character has multiple roles
export const hasMultipleRoles = (member) => {
  return member.papeles && member.papeles.length > 1;
};

// Helper to check if character has penalty (multiple roles or forced march)
export const hasPenalty = (member, marchaForzada = 0) => {
  return hasMultipleRoles(member) || marchaForzada > 0;
};

// Penalty amount for multiple roles or forced march
export const MULTI_ROLE_PENALTY = -5;

// Maximum roles per character
export const MAX_ROLES_PER_CHARACTER = 2;
