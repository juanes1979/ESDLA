/**
 * Character Sheet Page 2 Component
 * Renders the second page with background, shadow, patron, and equipment details
 */
import { DisplayField } from './SheetPage1';

// PAGE 2 FIELD POSITIONS - Multiline fields have height defined
export const PAGE2_FIELDS = {
  // Basic Info
  nombre: { x: 71, y: 178, width: 609, fontSize: 45, align: 'center' },
  
  // Sombra section - MULTILINE
  sombra: { x: 77, y: 418, width: 456, fontSize: 35, align: 'center' },
  descripcion_sombra: { x: 71, y: 465, width: 455, height: 300, fontSize: 35, align: 'left', multiline: true },
  
  // Trasfondo section - MULTILINE
  trasfondo: { x: 85, y: 1088, width: 437, fontSize: 25, align: 'left' },
  descripcion_trasfondo: { x: 84, y: 1126, width: 438, height: 250, fontSize: 35, align: 'left', multiline: true },
  
  // VIRTUD section - Debajo del trasfondo en la columna izquierda
  virtud_nombre: { x: 85, y: 1400, width: 437, fontSize: 28, align: 'left' },
  virtud_descripcion: { x: 84, y: 1440, width: 438, height: 170, fontSize: 28, align: 'left', multiline: true },
  
  // Puntos comunidad
  puntos_comunidad: { x: 672, y: 372, width: 68, fontSize: 70, align: 'center' },
  
  // Mecenas section - MULTILINE
  mecenas: { x: 617, y: 486, width: 466, fontSize: 35, align: 'left' },
  descripcion_mecenas: { x: 617, y: 539, width: 466, height: 400, fontSize: 35, align: 'left', multiline: true },
  ventaja_mecenas: { x: 1134, y: 351, width: 460, height: 400, fontSize: 35, align: 'left', multiline: true },
  
  // Heredero e inversión
  heredero: { x: 1161, y: 767, width: 408, fontSize: 40, align: 'left' },
  inversion: { x: 1161, y: 820, width: 408, fontSize: 40, align: 'left' },
  
  // Rasgos culturales (personality traits) - Two columns for overflow
  rasgos_culturales_1: { x: 617, y: 1075, width: 466, height: 370, fontSize: 35, align: 'left', multiline: true },
  rasgos_culturales_2: { x: 1157, y: 1078, width: 435, height: 370, fontSize: 35, align: 'left', multiline: true },
  
  // Equipo page 2 (equipo_9 to equipo_28)
  equipo_9: { x: 617, y: 1633, width: 465, fontSize: 30, align: 'left' },
  equipo_10: { x: 617, y: 1679, width: 465, fontSize: 30, align: 'left' },
  equipo_11: { x: 617, y: 1725, width: 465, fontSize: 30, align: 'left' },
  equipo_12: { x: 617, y: 1772, width: 465, fontSize: 30, align: 'left' },
  equipo_13: { x: 617, y: 1814, width: 465, fontSize: 30, align: 'left' },
  equipo_14: { x: 617, y: 1861, width: 465, fontSize: 30, align: 'left' },
  equipo_15: { x: 617, y: 1907, width: 465, fontSize: 30, align: 'left' },
  equipo_16: { x: 615, y: 1953, width: 465, fontSize: 30, align: 'left' },
  equipo_17: { x: 619, y: 2003, width: 465, fontSize: 30, align: 'left' },
  equipo_18: { x: 615, y: 2046, width: 465, fontSize: 30, align: 'left' },
  equipo_19: { x: 1153, y: 1634, width: 465, fontSize: 30, align: 'left' },
  equipo_20: { x: 1153, y: 1678, width: 465, fontSize: 30, align: 'left' },
  equipo_21: { x: 1153, y: 1725, width: 465, fontSize: 30, align: 'left' },
  equipo_22: { x: 1153, y: 1770, width: 465, fontSize: 30, align: 'left' },
  equipo_23: { x: 1153, y: 1814, width: 465, fontSize: 30, align: 'left' },
  equipo_24: { x: 1153, y: 1859, width: 465, fontSize: 30, align: 'left' },
  equipo_25: { x: 1153, y: 1906, width: 465, fontSize: 30, align: 'left' },
  equipo_26: { x: 1153, y: 1956, width: 465, fontSize: 30, align: 'left' },
  equipo_27: { x: 1153, y: 2001, width: 465, fontSize: 30, align: 'left' },
  equipo_28: { x: 1153, y: 2046, width: 465, fontSize: 30, align: 'left' },
};

// Lista de nombres de armas conocidas para filtrar
const WEAPON_NAMES = [
  'bastón', 'garrote', 'gran garrote', 'hacha', 'hoz', 'maza', 'martillo', 'daga',
  'hacha de mano', 'lanza', 'lanza corta', 'arco', 'espada', 'espada corta', 
  'espada larga', 'cimitarra', 'estoque', 'flajelo', 'hacha a dos manos',
  'lanza de caballería', 'látigo', 'gran hacha', 'hacha de guerra', 'lanza pesada',
  'martillo pesado', 'piqueta', 'arco largo', 'ballesta'
];

// Check if item is a weapon
const isWeapon = (itemName) => {
  if (!itemName) return false;
  const normalized = itemName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return WEAPON_NAMES.some(w => normalized.includes(w));
};

const SheetPage2 = ({ character, scale, fieldPositions = {} }) => {
  // Get all equipment items (excluding weapons) - same as page 1 but different indices
  const getAllEquipment = () => {
    const allItems = [
      ...(character.inventario || []).map(i => typeof i === 'string' ? i : i.nombre),
      ...(character.equipo_ocupacion || []),
      ...(character.equipo_trasfondo || []),
      ...(character.equipo_nivel_vida || []),
    ];
    return allItems.filter(item => item && !isWeapon(item));
  };
  
  // Get equipment rows for page 2 (indices 8-27, displayed as equipo_9 to equipo_28)
  const getEquipmentRowsPage2 = () => {
    const equipment = getAllEquipment();
    // Skip first 8 items (shown on page 1), get next 20 items
    return Array.from({ length: 20 }, (_, i) => equipment[i + 8] || '');
  };

  // Get rasgos culturales formatted with line breaks between each trait
  // Returns { col1: string, col2: string } for two columns if needed
  const getRasgosCulturales = () => {
    const rasgos = character.rasgos_culturales || [];
    if (!rasgos.length) return { col1: '', col2: '' };
    
    // Join all traits with double line break (punto y aparte)
    const allText = rasgos.join('\n\n');
    
    // For 4 or fewer rasgos, split in half (2 + 2)
    // For more, try to balance by character count
    if (rasgos.length <= 4) {
      const halfIndex = Math.ceil(rasgos.length / 2);
      const col1Rasgos = rasgos.slice(0, halfIndex);
      const col2Rasgos = rasgos.slice(halfIndex);
      
      return {
        col1: col1Rasgos.join('\n\n'),
        col2: col2Rasgos.join('\n\n')
      };
    }
    
    // For more rasgos, estimate characters that fit in first column
    const maxCharsCol1 = 500;
    let breakIndex = 0;
    let charCount = 0;
    
    for (let i = 0; i < rasgos.length; i++) {
      const traitLength = rasgos[i].length + 2; // +2 for \n\n
      if (charCount + traitLength > maxCharsCol1) {
        break;
      }
      charCount += traitLength;
      breakIndex = i + 1;
    }
    
    // Ensure at least one trait in each column if possible
    if (breakIndex === 0) breakIndex = 1;
    if (breakIndex >= rasgos.length) breakIndex = rasgos.length - 1;
    
    const col1Rasgos = rasgos.slice(0, breakIndex);
    const col2Rasgos = rasgos.slice(breakIndex);
    
    return {
      col1: col1Rasgos.join('\n\n'),
      col2: col2Rasgos.join('\n\n')
    };
  };

  const equipmentRows = getEquipmentRowsPage2();
  const rasgosCulturales = getRasgosCulturales();
  
  // Helper to get field position (from DB or fallback)
  const getPos = (fieldName) => {
    return fieldPositions?.[fieldName] || PAGE2_FIELDS[fieldName] || { x: 0, y: 0, width: 100, fontSize: 14, align: 'left' };
  };

  return (
    <>
      {/* Basic Info */}
      <DisplayField {...getPos('nombre')} value={character.nombre} scale={scale} />
      
      {/* Sombra section */}
      <DisplayField {...getPos('sombra')} value={character.senda_sombra || ''} scale={scale} />
      <DisplayField 
        {...getPos('descripcion_sombra')} 
        value={character.senda_sombra_descripcion || character.maldicion_descripcion || character.descripcion_sombra || ''} 
        scale={scale} 
      />
      
      {/* Trasfondo section */}
      <DisplayField {...getPos('trasfondo')} value={character.trasfondo_nombre || ''} scale={scale} />
      <DisplayField 
        {...getPos('descripcion_trasfondo')} 
        value={character.descripcion_trasfondo || ''} 
        scale={scale} 
      />
      
      {/* VIRTUD section - Only show if character has a virtue */}
      {character.virtud_nombre && (
        <>
          <DisplayField 
            {...getPos('virtud_nombre')} 
            value={`★ ${character.virtud_nombre}`} 
            scale={scale} 
          />
          <DisplayField 
            {...getPos('virtud_descripcion')} 
            value={character.virtud_rasgos || character.virtud_descripcion || ''} 
            scale={scale} 
          />
        </>
      )}
      
      {/* Resources */}
      <DisplayField {...getPos('puntos_comunidad')} value={character.puntos_comunidad ? character.puntos_comunidad : ''} scale={scale} />
      <DisplayField {...getPos('heredero')} value={character.heredero || ''} scale={scale} />
      <DisplayField {...getPos('inversion')} value={character.inversion || ''} scale={scale} />
      
      {/* Mecenas section */}
      <DisplayField {...getPos('mecenas')} value={character.mecenas || character.patron_nombre || ''} scale={scale} />
      <DisplayField 
        {...getPos('descripcion_mecenas')} 
        value={character.descripcion_mecenas || ''} 
        scale={scale} 
      />
      <DisplayField 
        {...getPos('ventaja_mecenas')} 
        value={character.ventaja_mecenas || ''} 
        scale={scale} 
      />
      
      {/* Rasgos culturales - Two columns */}
      <DisplayField 
        {...getPos('rasgos_culturales_1')} 
        value={rasgosCulturales.col1} 
        scale={scale} 
      />
      <DisplayField 
        {...getPos('rasgos_culturales_2')} 
        value={rasgosCulturales.col2} 
        scale={scale} 
      />
      
      {/* Equipo 9-28 */}
      {equipmentRows.map((item, i) => {
        const fieldKey = `equipo_${i + 9}`;
        const pos = getPos(fieldKey);
        return (
          <DisplayField key={fieldKey} {...pos} value={item} scale={scale} />
        );
      })}
    </>
  );
};

export default SheetPage2;
