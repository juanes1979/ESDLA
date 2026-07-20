/**
 * Character Sheet Page 3 Component
 * Renders the third page with occupation details and special abilities
 */
import { DisplayField, AutoFitField } from './SheetPage1';

// PAGE 3 FIELD POSITIONS
export const PAGE3_FIELDS = {
  // Basic Info
  nombre: { x: 77, y: 250, width: 600, fontSize: 45, align: 'center' },
  ocupacion_nivel: { x: 723, y: 210, width: 330, fontSize: 40, align: 'left' },
  // Descripción corta de la ocupación (fila 16 hoja Ocupaciones) - MULTILINEA
  descripcion_ocupacion: { x: 723, y: 259, width: 882, height: 150, fontSize: 35, align: 'left', multiline: true },
  
  // Combined occupation description with all special abilities AND VIRTUE at the end - MULTILINE
  descripcion_ocupacion_larga: { x: 77, y: 445, width: 1530, height: 1600, fontSize: 40, align: 'left', multiline: true },
};

const SheetPage3 = ({ character, scale, fieldPositions = {} }) => {
  // Respeta las posiciones/tamaños personalizados guardados en el Editor; si no hay,
  // usa los valores por defecto de PAGE3_FIELDS.
  const getPos = (fieldName) => {
    return fieldPositions?.[fieldName] || PAGE3_FIELDS[fieldName] || { x: 0, y: 0, width: 100, fontSize: 14, align: 'left' };
  };
  
  // Get combined occupation description with all special abilities and virtue
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
    
    // Add VIRTUE at the end if character has one
    if (character.virtud_nombre) {
      let virtudBlock = `★ VIRTUD: ${character.virtud_nombre}`;
      if (character.virtud_rasgos || character.virtud_descripcion) {
        virtudBlock += `: ${character.virtud_rasgos || character.virtud_descripcion}`;
      }
      parts.push(virtudBlock);
    }
    
    // Join all parts with double line break
    return parts.join('\n\n');
  };

  const nivel = character.nivel || 1;
  const descripcionCompleta = getDescripcionOcupacionCompleta();
  const nombrePos = getPos('nombre');
  const nivelPos = getPos('ocupacion_nivel');
  const descCortaPos = getPos('descripcion_ocupacion');
  const descLargaPos = getPos('descripcion_ocupacion_larga');

  return (
    <>
      {/* Basic Info */}
      <DisplayField 
        {...nombrePos} 
        value={character.nombre} 
        scale={scale} 
      />
      <DisplayField 
        {...nivelPos} 
        value={`${character.ocupacion_nombre || character.vocacion_nombre || ''} ${nivel}`} 
        scale={scale} 
      />
      <DisplayField 
        x={descCortaPos.x}
        y={descCortaPos.y}
        width={descCortaPos.width}
        height={descCortaPos.height}
        fontSize={descCortaPos.fontSize}
        align={descCortaPos.align}
        multiline={true}
        value={character.descripcion_corta || character.descripcion_ocupacion_corta || ''} 
        scale={scale} 
      />
      
      {/* Combined occupation description with all special abilities AND VIRTUE at the end.
          AUTO-AJUSTE: el tamaño de letra se reduce automáticamente para que TODO el texto
          quepa dentro del recuadro (width × height) del campo tal como se editó. */}
      <AutoFitField 
        x={descLargaPos.x}
        y={descLargaPos.y}
        width={descLargaPos.width}
        height={descLargaPos.height}
        fontSize={descLargaPos.fontSize}
        align={descLargaPos.align}
        minFontSize={12}
        value={descripcionCompleta} 
        scale={scale} 
      />
    </>
  );
};

export default SheetPage3;
