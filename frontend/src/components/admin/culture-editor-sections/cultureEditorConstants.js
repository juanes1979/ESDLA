/**
 * Shared constants for `CultureEditor` subsections (extracted from
 * CultureEditor.jsx during the iter82 refactor).
 */

export const ALL_SKILLS = [
  'Acertijos', 'Acrobacias', 'Atletismo', 'Cazar', 'Engaño', 'Explorar',
  'Interpretación', 'Intimidación', 'Investigación', 'Juego de manos',
  'Medicina', 'Naturaleza', 'Percepción', 'Perspicacia', 'Persuasión',
  'Saber antiguo', 'Sigilo', 'Trato con animales', 'Viajar',
];

export const ALL_TOOLS = [
  'Herramientas de carpintería', 'Herramientas de herrero', 'Herramientas de alfarero',
  'Herramientas de joyero', 'Herramientas de curtidor', 'Herramientas de zapatero',
  'Herramientas de tejedor', 'Herramientas de albañil', 'Herramientas de cartógrafo',
  'Herramientas de cocinero', 'Herramientas de cervecero', 'Herramientas de pintor',
  'Instrumentos musicales', 'Juegos', 'Pipa', 'Vehículos acuáticos', 'Vehículos terrestres',
  'Kit de herborista', 'Kit de disfraz', 'Kit de falsificador', 'Kit de navegante',
  'Suministros de calígrafo', 'Útiles de soplador de vidrio',
];

export const COMPETENCIA_ADICIONAL_CATEGORIAS = [
  { value: 'herramientas', label: 'Herramientas', items: [
    'Herramientas de carpintería', 'Herramientas de herrero', 'Herramientas de alfarero',
    'Herramientas de joyero', 'Herramientas de curtidor', 'Herramientas de zapatero',
    'Herramientas de tejedor', 'Herramientas de albañil', 'Herramientas de cartógrafo',
    'Herramientas de cocinero', 'Herramientas de cervecero', 'Herramientas de pintor',
    'Kit de herborista', 'Kit de disfraz', 'Kit de falsificador', 'Kit de navegante',
    'Suministros de calígrafo', 'Útiles de soplador de vidrio', 'Vehículos acuáticos', 'Vehículos terrestres',
  ] },
  { value: 'juegos', label: 'Juegos', items: [
    'Dados', 'Naipes', 'Tablero (Ajedrez)', 'Tablero (Damas)', 'Juego de fichas',
  ] },
  { value: 'instrumentos', label: 'Instrumentos musicales', items: [
    'Arpa', 'Flauta', 'Laúd', 'Lira', 'Cuerno', 'Tambor', 'Gaita', 'Violín', 'Zanfoña',
  ] },
  { value: 'pipa', label: 'Pipa', items: ['Pipa'] },
];

export const ATTRIBUTES = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'sabiduria', 'carisma'];
