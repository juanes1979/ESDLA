/**
 * Character Sheet PDF Generator
 * Generates a 3-page PDF matching the provided character sheet templates
 * Page 1: Attributes, Combat, Skills, Equipment, Shadow
 * Page 2: Community Points, Patron, Virtues, Traditional Equipment, Background
 * Page 3: Story History (long texts)
 */
import { jsPDF } from 'jspdf';

// Helper to calculate modifier from attribute score
const getModifier = (score) => {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

// Calculate proficiency bonus by level
const getProficiencyBonus = (level = 1) => {
  return Math.ceil(1 + level / 4);
};

// Generate character sheet PDF
export const generateCharacterPDF = async (character) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Colors
  const gold = [183, 150, 80];
  const darkBg = [30, 25, 20];
  const textLight = [220, 215, 200];
  const textMuted = [150, 145, 135];

  // Fonts
  doc.setFont('helvetica');

  // ===========================
  // PAGE 1: Main Character Sheet
  // ===========================
  
  // Background
  doc.setFillColor(...darkBg);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Title
  doc.setFontSize(20);
  doc.setTextColor(...gold);
  doc.text('FICHA DE PERSONAJE', pageWidth / 2, 20, { align: 'center' });

  // Character Info Header
  doc.setFontSize(10);
  doc.setTextColor(...textLight);
  doc.text(`Nombre: ${character.nombre || '_______________'}`, margin, 35);
  doc.text(`Cultura: ${character.cultura_nombre || '_______________'}`, pageWidth / 2, 35);
  doc.text(`Ocupación: ${character.vocacion_nombre || '_______________'}`, margin, 43);
  doc.text(`Trasfondo: ${character.trasfondo_nombre || '_______________'}`, pageWidth / 2, 43);
  doc.text(`Nivel: ${character.nivel || 1}`, margin, 51);
  doc.text(`Exp: ${character.experiencia || 0}`, pageWidth / 2, 51);

  // Divider line
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.5);
  doc.line(margin, 56, pageWidth - margin, 56);

  // ATTRIBUTES SECTION
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text('CARACTERÍSTICAS', margin, 65);

  const atributos = character.atributos_finales || {};
  const attrNames = ['Fuerza', 'Destreza', 'Constitución', 'Inteligencia', 'Sabiduría', 'Carisma'];
  const attrKeys = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'sabiduria', 'carisma'];
  
  let attrY = 73;
  const attrColWidth = (pageWidth - 2 * margin) / 3;
  
  doc.setFontSize(9);
  attrKeys.forEach((key, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margin + col * attrColWidth;
    const y = attrY + row * 18;
    
    const score = atributos[key] || 10;
    const mod = getModifier(score);
    
    // Attribute box
    doc.setFillColor(45, 40, 35);
    doc.roundedRect(x, y, attrColWidth - 5, 15, 2, 2, 'F');
    
    doc.setTextColor(...textLight);
    doc.setFontSize(8);
    doc.text(attrNames[i].toUpperCase(), x + 3, y + 5);
    
    doc.setFontSize(14);
    doc.setTextColor(...gold);
    doc.text(`${score}`, x + attrColWidth - 25, y + 11);
    
    doc.setFontSize(10);
    doc.text(`(${mod})`, x + attrColWidth - 12, y + 11);
  });

  // COMBAT SECTION
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text('COMBATE', margin, 115);

  doc.setFontSize(9);
  doc.setTextColor(...textLight);
  
  const ca = 10 + (Math.floor(((atributos.destreza || 10) - 10) / 2));
  const hp = character.puntos_golpe_base || 8;
  const initiative = getModifier(atributos.destreza || 10);
  const profBonus = getProficiencyBonus(character.nivel || 1);
  
  // Combat stats boxes
  const combatStats = [
    { label: 'CA', value: ca },
    { label: 'PG', value: hp },
    { label: 'INICIATIVA', value: initiative },
    { label: 'COMPETENCIA', value: `+${profBonus}` }
  ];
  
  const combatColWidth = (pageWidth - 2 * margin) / 4;
  combatStats.forEach((stat, i) => {
    const x = margin + i * combatColWidth;
    
    doc.setFillColor(45, 40, 35);
    doc.roundedRect(x, 120, combatColWidth - 3, 20, 2, 2, 'F');
    
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.text(stat.label, x + (combatColWidth - 3) / 2, 126, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(...gold);
    doc.text(String(stat.value), x + (combatColWidth - 3) / 2, 136, { align: 'center' });
  });

  // SKILLS SECTION
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text('HABILIDADES', margin, 150);

  const skills = [
    { name: 'Acertijos', attr: 'inteligencia' },
    { name: 'Atletismo', attr: 'fuerza' },
    { name: 'Cantos', attr: 'carisma' },
    { name: 'Cuentos y Sagas', attr: 'sabiduria' },
    { name: 'Educación', attr: 'inteligencia' },
    { name: 'Exploración', attr: 'sabiduria' },
    { name: 'Intimidación', attr: 'carisma' },
    { name: 'Investigación', attr: 'inteligencia' },
    { name: 'Juego de Manos', attr: 'destreza' },
    { name: 'Medicina', attr: 'sabiduria' },
    { name: 'Oficio', attr: 'inteligencia' },
    { name: 'Percepción', attr: 'sabiduria' },
    { name: 'Persuasión', attr: 'carisma' },
    { name: 'Perspicacia', attr: 'sabiduria' },
    { name: 'Sigilo', attr: 'destreza' },
    { name: 'Supervivencia', attr: 'sabiduria' },
    { name: 'Trato con animales', attr: 'sabiduria' },
    { name: 'Viaje', attr: 'destreza' }
  ];

  const competencias = character.habilidades_elegidas || [];
  const pericias = character.pericia_elegida || [];
  
  doc.setFontSize(7);
  let skillY = 158;
  const skillColWidth = (pageWidth - 2 * margin) / 2;
  
  skills.forEach((skill, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * skillColWidth;
    const y = skillY + row * 7;
    
    const attrScore = atributos[skill.attr] || 10;
    const attrMod = Math.floor((attrScore - 10) / 2);
    const isCompetent = competencias.some(c => c.toLowerCase().includes(skill.name.toLowerCase()));
    const isExpert = pericias.some(p => p.toLowerCase().includes(skill.name.toLowerCase()));
    
    let bonus = attrMod;
    if (isCompetent) bonus += profBonus;
    if (isExpert) bonus += profBonus; // Double proficiency for expertise
    
    const bonusStr = bonus >= 0 ? `+${bonus}` : `${bonus}`;
    
    // Competency indicator
    doc.setFillColor(isExpert ? 100 : (isCompetent ? 80 : 50), isExpert ? 80 : (isCompetent ? 65 : 45), isExpert ? 60 : (isCompetent ? 50 : 40));
    doc.circle(x + 3, y + 2, 2, 'F');
    
    doc.setTextColor(isCompetent || isExpert ? gold : textMuted);
    doc.text(`${bonusStr}  ${skill.name}`, x + 8, y + 3);
  });

  // EQUIPMENT SECTION
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text('EQUIPO', pageWidth / 2 + 10, 150);

  const equipo = character.equipo_ocupacion || [];
  const inventario = character.inventario || [];
  const allEquip = [...equipo, ...inventario.map(i => i.nombre || i)];
  
  doc.setFontSize(7);
  doc.setTextColor(...textLight);
  let equipY = 158;
  allEquip.slice(0, 12).forEach((item, i) => {
    doc.text(`• ${item}`, pageWidth / 2 + 10, equipY + i * 6);
  });

  // SHADOW SECTION at bottom
  doc.setFontSize(10);
  doc.setTextColor(...gold);
  doc.text('SOMBRA', margin, pageHeight - 40);
  
  doc.setFontSize(8);
  doc.setTextColor(...textLight);
  doc.text(`Sombra: ${character.sombra || 0}`, margin, pageHeight - 32);
  doc.text(`Corrupción permanente: ${character.corrupcion_permanente || 0}`, margin, pageHeight - 25);

  // Money
  doc.setTextColor(...gold);
  doc.text('DINERO', pageWidth / 2, pageHeight - 40);
  doc.setTextColor(...textLight);
  const dinero = character.dinero || { mp: 0, mo: 0, mc: 0 };
  doc.text(`${dinero.mp || 0} MP | ${dinero.mo || 0} MO | ${dinero.mc || 0} MC`, pageWidth / 2, pageHeight - 32);

  // Footer
  doc.setFontSize(6);
  doc.setTextColor(...textMuted);
  doc.text('Página 1 de 3 - ESDLA 5e Mod', pageWidth / 2, pageHeight - 10, { align: 'center' });

  // ===========================
  // PAGE 2: Community, Virtues, Background
  // ===========================
  doc.addPage();
  
  // Background
  doc.setFillColor(...darkBg);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Title
  doc.setFontSize(16);
  doc.setTextColor(...gold);
  doc.text('FICHA DE PERSONAJE (2/3)', pageWidth / 2, 20, { align: 'center' });

  // Character name
  doc.setFontSize(12);
  doc.setTextColor(...textLight);
  doc.text(character.nombre || 'Sin nombre', pageWidth / 2, 30, { align: 'center' });

  // Divider
  doc.setDrawColor(...gold);
  doc.line(margin, 35, pageWidth - margin, 35);

  // COMMUNITY POINTS
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text('PUNTOS DE COMUNIDAD', margin, 45);

  doc.setFontSize(9);
  doc.setTextColor(...textLight);
  doc.text(`Puntos actuales: ${character.puntos_comunidad || 0}`, margin, 55);
  doc.text(`Esperanza: ${character.esperanza || 0}`, margin + 60, 55);
  doc.text(`Fatiga: ${character.fatiga || 0}`, margin + 110, 55);

  // VIRTUES
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text('VIRTUDES Y RASGOS', margin, 75);

  doc.setFontSize(9);
  doc.setTextColor(...textLight);
  let virtY = 85;
  
  if (character.virtud_nombre) {
    doc.text(`Virtud: ${character.virtud_nombre}`, margin, virtY);
    virtY += 8;
    if (character.rasgos_virtud) {
      const virtDesc = doc.splitTextToSize(character.rasgos_virtud, pageWidth - 2 * margin);
      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      virtDesc.slice(0, 4).forEach((line, i) => {
        doc.text(line, margin, virtY + i * 5);
      });
      virtY += 25;
    }
  } else {
    doc.text('Sin virtud inicial (se obtiene al subir de nivel)', margin, virtY);
    virtY += 10;
  }

  // PERSONALITY TRAITS
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text('RASGOS DE PERSONALIDAD', margin, virtY + 5);

  doc.setFontSize(9);
  doc.setTextColor(...textLight);
  let traitY = virtY + 15;
  
  if (character.rasgo_distintivo) {
    const rasgo1 = typeof character.rasgo_distintivo === 'object' 
      ? character.rasgo_distintivo.nombre 
      : character.rasgo_distintivo;
    doc.text(`• ${rasgo1}`, margin, traitY);
    traitY += 8;
  }
  if (character.rasgo_distintivo_2 || character.defecto) {
    const rasgo2 = character.rasgo_distintivo_2 || character.defecto;
    const rasgo2Text = typeof rasgo2 === 'object' ? rasgo2.nombre : rasgo2;
    doc.text(`• ${rasgo2Text}`, margin, traitY);
  }

  // TRADITIONAL EQUIPMENT
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text('EQUIPO TRADICIONAL', margin, virtY + 40);

  doc.setFontSize(8);
  doc.setTextColor(...textLight);
  
  // Based on nivel_vida
  const nivelVida = character.nivel_vida || 'Común';
  doc.text(`Nivel de Vida: ${nivelVida}`, margin, virtY + 50);

  // BACKGROUND
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text('TRASFONDO', margin, virtY + 70);

  doc.setFontSize(9);
  doc.setTextColor(...textLight);
  doc.text(`${character.trasfondo_nombre || 'Sin trasfondo'}`, margin, virtY + 80);
  
  // Background description
  if (character.historia) {
    const bgDesc = doc.splitTextToSize(character.historia, pageWidth - 2 * margin);
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    bgDesc.slice(0, 8).forEach((line, i) => {
      doc.text(line, margin, virtY + 88 + i * 5);
    });
  }

  // Footer
  doc.setFontSize(6);
  doc.setTextColor(...textMuted);
  doc.text('Página 2 de 3 - ESDLA 5e Mod', pageWidth / 2, pageHeight - 10, { align: 'center' });

  // ===========================
  // PAGE 3: Story/History
  // ===========================
  doc.addPage();
  
  // Background
  doc.setFillColor(...darkBg);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Title
  doc.setFontSize(16);
  doc.setTextColor(...gold);
  doc.text('HOJA PARA HISTORIAS', pageWidth / 2, 20, { align: 'center' });

  // Character name
  doc.setFontSize(12);
  doc.setTextColor(...textLight);
  doc.text(character.nombre || 'Sin nombre', pageWidth / 2, 30, { align: 'center' });

  // Divider
  doc.setDrawColor(...gold);
  doc.line(margin, 35, pageWidth - margin, 35);

  // OCCUPATION DESCRIPTION
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text('OCUPACIÓN', margin, 45);

  doc.setFontSize(9);
  doc.setTextColor(...textLight);
  doc.text(`${character.vocacion_nombre || 'Sin ocupación'}`, margin, 55);

  // Skills chosen
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text('Habilidades elegidas:', margin, 65);
  (character.habilidades_elegidas || []).forEach((skill, i) => {
    doc.text(`• ${skill}`, margin + 5, 72 + i * 5);
  });

  // Expertise
  if (character.pericia_elegida && character.pericia_elegida.length > 0) {
    doc.setTextColor(...gold);
    doc.text('Pericia (x2 competencia):', margin, 95);
    doc.setTextColor(...textMuted);
    character.pericia_elegida.forEach((skill, i) => {
      doc.text(`★ ${skill}`, margin + 5, 102 + i * 5);
    });
  }

  // LONG BACKGROUND TEXT
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text('HISTORIA COMPLETA', margin, 125);

  doc.setFontSize(8);
  doc.setTextColor(...textLight);
  
  const storyText = character.historia || 'Escribe aquí la historia de tu personaje...';
  const storyLines = doc.splitTextToSize(storyText, pageWidth - 2 * margin);
  
  let storyY = 135;
  storyLines.slice(0, 25).forEach((line, i) => {
    doc.text(line, margin, storyY + i * 5);
  });

  // NOTES SECTION
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text('NOTAS DE AVENTURA', margin, pageHeight - 60);

  // Empty lines for notes
  doc.setDrawColor(...textMuted);
  for (let i = 0; i < 8; i++) {
    doc.line(margin, pageHeight - 52 + i * 6, pageWidth - margin, pageHeight - 52 + i * 6);
  }

  // Footer
  doc.setFontSize(6);
  doc.setTextColor(...textMuted);
  doc.text('Página 3 de 3 - ESDLA 5e Mod', pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Return the PDF document
  return doc;
};

// Download PDF
export const downloadCharacterPDF = async (character) => {
  const doc = await generateCharacterPDF(character);
  doc.save(`${character.nombre || 'personaje'}_ficha.pdf`);
};

// Open PDF in new tab
export const openCharacterPDF = async (character) => {
  const doc = await generateCharacterPDF(character);
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

export default generateCharacterPDF;
