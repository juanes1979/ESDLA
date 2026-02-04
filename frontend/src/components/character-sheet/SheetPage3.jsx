/**
 * Character Sheet Page 3 Component
 * Renders the third page with occupation details and special abilities
 */
import { DisplayField } from './SheetPage1';

// PAGE 3 FIELD POSITIONS
export const PAGE3_FIELDS = {
  // Basic Info
  nombre: { x: 77, y: 250, width: 600, fontSize: 45, align: 'center' },
  ocupacion_nivel: { x: 723, y: 210, width: 330, fontSize: 40, align: 'left' },
  descripcion_ocupacion: { x: 723, y: 245, width: 882, fontSize: 35, align: 'left' },
  
  // Combined occupation description with all special abilities - MULTILINE
  descripcion_ocupacion_larga: { x: 77, y: 445, width: 1530, height: 1600, fontSize: 40, align: 'left', multiline: true },
};

const SheetPage3 = ({ character, scale, fieldPositions = {} }) => {
  
  // Get combined occupation description with all special abilities
  // Each block separated by line break (punto y aparte)
  const getDescripcionOcupacionCompleta = () => {
    const parts = [];
    
    // Main description
    if (character.descripcion_ocupacion_larga || character.descripcion_ocupacion) {
      parts.push(character.descripcion_ocupacion_larga || character.descripcion_ocupacion);
    }
    
    // Special abilities 1-6
    for (let i = 1; i <= 6; i++) {
      const nombreKey = `especiales_ocupacion${i}`;
      const descKey = `especiales_ocupacion${i}_descripcion`;
      
      const nombre = character[nombreKey];
      const descripcion = character[descKey];
      
      if (nombre || descripcion) {
        let block = '';
        if (nombre) {
          block += nombre;
          if (descripcion) {
            block += ': ' + descripcion;
          }
        } else if (descripcion) {
          block += descripcion;
        }
        parts.push(block);
      }
    }
    
    // Also check for rasgos_ocupacion array if it exists
    if (character.rasgos_ocupacion && Array.isArray(character.rasgos_ocupacion)) {
      character.rasgos_ocupacion.forEach(rasgo => {
        if (typeof rasgo === 'string') {
          parts.push(rasgo);
        } else if (rasgo && rasgo.nombre) {
          let block = rasgo.nombre;
          if (rasgo.descripcion) {
            block += ': ' + rasgo.descripcion;
          }
          parts.push(block);
        }
      });
    }
    
    // Join all parts with double line break
    return parts.join('\n\n');
  };

  const nivel = character.nivel || 1;
  const descripcionCompleta = getDescripcionOcupacionCompleta();

  return (
    <>
      {/* Basic Info */}
      <DisplayField 
        {...PAGE3_FIELDS.nombre} 
        value={character.nombre} 
        scale={scale} 
      />
      <DisplayField 
        {...PAGE3_FIELDS.ocupacion_nivel} 
        value={`${character.ocupacion_nombre || character.vocacion_nombre || ''} ${nivel}`} 
        scale={scale} 
      />
      <DisplayField 
        {...PAGE3_FIELDS.descripcion_ocupacion} 
        value={character.descripcion_ocupacion_corta || ''} 
        scale={scale} 
      />
      
      {/* Combined occupation description with all special abilities */}
      <DisplayField 
        x={PAGE3_FIELDS.descripcion_ocupacion_larga.x}
        y={PAGE3_FIELDS.descripcion_ocupacion_larga.y}
        width={PAGE3_FIELDS.descripcion_ocupacion_larga.width}
        height={PAGE3_FIELDS.descripcion_ocupacion_larga.height}
        fontSize={PAGE3_FIELDS.descripcion_ocupacion_larga.fontSize}
        align={PAGE3_FIELDS.descripcion_ocupacion_larga.align}
        multiline={true}
        value={descripcionCompleta} 
        scale={scale} 
      />
    </>
  );
};

export default SheetPage3;
