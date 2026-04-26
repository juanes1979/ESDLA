/**
 * Travel chronicle print/export utilities.
 * Pure functions that receive all data they need; no React state.
 * Extracted from EnhancedTravelSystem.jsx to keep that file manageable.
 */
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { ROLE_INFO } from './travelConstants';

// Export debug JSON for journey analysis
const exportDebugJson = ({
  config, journeyCalc, events, orientationChecks,
  currentPosition, nextEventPosition,
}) => {
  const debugData = {
    timestamp: new Date().toISOString(),
    journey: {
      origen: config.origenNombre,
      destino: config.destinoNombre,
      origen_id: config.origenId,
      destino_id: config.destinoId,
      preferir_caminos: config.preferirCaminos,
      evitar_sombra: config.evitarSombra,
      estacion: config.estacion,
      ritmo: config.ritmo
    },
    calculation_result: journeyCalc,
    events: events.map(e => ({
      casilla: e.casilla,
      evento_nombre: e.evento?.nombre,
      resuelto: e.resuelto,
      exito: e.exito,
      tirada: e.tirada,
      orientacion: e.orientacion
    })),
    orientation_checks: orientationChecks,
    positions: {
      current: currentPosition,
      next_event: nextEventPosition
    }
  };

  const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `viaje_debug_${config.origenNombre}_${config.destinoNombre}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast.success('Debug JSON exportado');
};

// Capture map image with html2canvas
const captureMapImage = async ({ savedMapImage, mapContainerRef }) => {
  if (savedMapImage) return savedMapImage;
  if (!mapContainerRef?.current) return null;

  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    const canvas = await html2canvas(mapContainerRef.current, {
      backgroundColor: '#f4efe6',
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 15000
    });
    return canvas.toDataURL('image/png', 0.9);
  } catch (err) {
    console.error('Error capturing map with html2canvas:', err);
    return null;
  }
};

// Generate map image placeholder HTML
const generateMapPlaceholder = (mapDataUrl, events) => {
  if (!mapDataUrl) {
    return '<p style="text-align: center; color: #888; padding: 40px;">Mapa no disponible</p>';
  }
  return `<div style="margin: 20px 0; border: 2px solid #d4c4a8; border-radius: 8px; overflow: hidden;">
    <img src="${mapDataUrl}" style="width: 100%; max-height: 400px; object-fit: contain; display: block;" />
    <div style="display: flex; justify-content: center; gap: 20px; padding: 8px; background: rgba(139, 69, 19, 0.05); border-top: 1px solid #d4c4a8; font-size: 10pt;">
      <span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #2d5a27; margin-right: 5px;"></span> Origen</span>
      <span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #8B2500; margin-right: 5px;"></span> Destino</span>
      ${events.length > 0 ? `<span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: rgba(144, 238, 144, 0.8); border: 1px solid #228B22; margin-right: 5px;"></span> Éxito</span>
      <span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: rgba(255, 182, 193, 0.8); border: 1px solid #8B0000; margin-right: 5px;"></span> Fracaso</span>` : ''}
    </div>
  </div>`;
};

// Build full HTML chronicle and open print window
export const printJourneyDocument = (opts) => {
  const {
    config, journeyCalc, events, orientationChecks,
    currentPosition, nextEventPosition,
    savedMapImage, mapContainerRef,
    characterXP, journeyNarrative, journeyChronicle, includeChronicleInPDF,
    fatigueResults
  } = opts;

  // Shift+click → export debug JSON instead of printing
  if (window.event?.shiftKey) {
    exportDebugJson({ config, journeyCalc, events, orientationChecks, currentPosition, nextEventPosition });
    return;
  }

  const generatePrintContent = async () => {
    toast.info('Generando crónica del viaje...');
    const mapDataUrl = await captureMapImage({ savedMapImage, mapContainerRef });
    const mapHTML = generateMapPlaceholder(mapDataUrl, events);

    return `<!DOCTYPE html>
    <html>
    <head>
      <title>Crónica del Viaje - ${config.origenNombre} a ${config.destinoNombre}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Spectral:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
      <style>
        @page { margin: 2cm; size: A4; }
        body {
          font-family: 'Spectral', Georgia, serif;
          font-size: 12pt;
          line-height: 1.8;
          color: #2c1810;
          background: #f4efe6;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
        }
        h1 {
          font-family: 'Cinzel', serif;
          font-size: 24pt;
          text-align: center;
          color: #8B4513;
          border-bottom: 2px solid #8B4513;
          padding-bottom: 15px;
          margin-bottom: 30px;
        }
        h2 {
          font-family: 'Cinzel', serif;
          font-size: 16pt;
          color: #5c4033;
          margin-top: 25px;
          border-bottom: 1px solid #d4c4a8;
        }
        .narrative {
          font-style: italic;
          text-align: justify;
          margin: 25px 0;
          padding: 20px;
          background: rgba(139, 69, 19, 0.05);
          border-left: 4px solid #8B4513;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin: 20px 0;
        }
        .stat {
          text-align: center;
          padding: 15px;
          background: rgba(139, 69, 19, 0.08);
          border: 1px solid #d4c4a8;
        }
        .stat-value {
          font-family: 'Cinzel', serif;
          font-size: 24pt;
          color: #8B4513;
        }
        .stat-label { font-size: 10pt; color: #666; }
        .event {
          padding: 12px;
          margin: 10px 0;
          border-left: 3px solid;
        }
        .event-success { border-color: #228B22; background: rgba(34, 139, 34, 0.08); }
        .event-failure { border-color: #8B0000; background: rgba(139, 0, 0, 0.08); }
        .party-member {
          display: inline-block;
          padding: 5px 15px;
          margin: 5px;
          background: #f0e6d3;
          border: 1px solid #d4c4a8;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 10pt;
          color: #888;
          border-top: 1px solid #d4c4a8;
          padding-top: 15px;
        }
        @media print {
          body { background: white; }
        }
      </style>
    </head>
    <body>
      <h1>Crónica del Viaje</h1>
      <p style="text-align: center; font-size: 14pt;">
        De <strong>${config.origenNombre}</strong> a <strong>${config.destinoNombre}</strong>
      </p>

      ${mapHTML}

      <div class="stats">
        <div class="stat">
          <div class="stat-value">${journeyCalc?.estimaciones?.dias_estimados || 0}</div>
          <div class="stat-label">Días de Marcha</div>
        </div>
        <div class="stat">
          <div class="stat-value">${journeyCalc?.ruta?.casillas || 0}</div>
          <div class="stat-label">Casillas</div>
        </div>
        <div class="stat">
          <div class="stat-value">${Math.round(journeyCalc?.ruta?.distance_km || 0)}</div>
          <div class="stat-label">Kilómetros</div>
        </div>
        <div class="stat">
          <div class="stat-value">${journeyCalc?.estimaciones?.px_total || 0}</div>
          <div class="stat-label">PX Ganados</div>
        </div>
      </div>

      ${journeyNarrative ? `
        <h2>Relato del Viaje</h2>
        <div class="narrative">${journeyNarrative}</div>
      ` : ''}

      ${includeChronicleInPDF && journeyChronicle ? `
        <h2>Diario del Viaje</h2>
        <div style="text-align: justify; line-height: 1.8; margin: 20px 0; padding: 20px 24px; background: rgba(139, 69, 19, 0.04); border-left: 4px solid #8B4513;">
          ${journeyChronicle.split(/\n\n+/).map(p => `<p style="margin: 0 0 14px 0;">${p.replace(/\n/g, '<br>')}</p>`).join('')}
        </div>
      ` : ''}

      <h2>La Compañía</h2>
      <div>
        ${config.miembros.filter(m => m.papeles?.length).map(m => `
          <div class="party-member">
            <strong>${m.nombre}</strong><br>
            <small>${m.papeles.map(p => ROLE_INFO[p]?.nombre || p).join(', ')}</small>
          </div>
        `).join('')}
      </div>

      ${journeyCalc?.ruta?.terrain_summary && Object.keys(journeyCalc.ruta.terrain_summary).length > 0 ? `
        <h2>Tierras Atravesadas</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
          ${Object.entries(journeyCalc.ruta.terrain_summary).map(([terrain, km]) => {
            const terrainNames = {
              'facil': 'Camino Fácil',
              'moderado': 'Terreno Moderado',
              'dificil': 'Terreno Difícil',
              'muy_dificil': 'Terreno Muy Difícil',
              'desalentador': 'Terreno Desalentador',
              'infranqueable': 'Terreno Infranqueable'
            };
            return `<span style="padding: 5px 15px; background: rgba(139, 69, 19, 0.1); border: 1px solid #d4c4a8; border-radius: 4px;">
              ${terrainNames[terrain] || terrain}: <strong>${km.toFixed(1)} km</strong>
            </span>`;
          }).join('')}
        </div>
      ` : ''}

      ${journeyCalc?.px_desglose && journeyCalc.estimaciones?.px_total > 0 ? `
        <h2>Experiencia Ganada</h2>
        <p style="margin-bottom: 10px;">El viaje a través de tierras peligrosas ha otorgado <strong>${journeyCalc.estimaciones.px_total} puntos de experiencia</strong> al total de la compañía, a repartir entre los ${config.miembros.filter(m => m.papeles?.length).length || config.miembros.length} viajeros (${Math.floor((journeyCalc.estimaciones.px_total) / Math.max(1, config.miembros.filter(m => m.papeles?.length).length || config.miembros.length))} PX por cabeza, antes de bonificaciones individuales por tiradas).</p>
        ${journeyCalc.px_desglose.por_tipo_tierra ? `
          <div style="padding: 15px; background: rgba(34, 139, 34, 0.08); border: 1px solid #d4c4a8; margin-bottom: 15px;">
            <p style="margin: 0 0 10px 0; font-weight: bold;">Desglose por Tipo de Tierra:</p>
            ${Object.entries(journeyCalc.px_desglose.por_tipo_tierra).map(([tipo, info]) => {
              const landNames = {
                'tierras_salvajes': 'Tierras Salvajes',
                'tierras_fronterizas': 'Tierras Fronterizas',
                'tierras_sombra': 'Tierras de la Sombra',
                'tierras_oscuras': 'Tierras Oscuras',
                'tierras_libres': 'Tierras Libres'
              };
              return `<p style="margin: 5px 0;">• ${landNames[tipo] || tipo}: ${info.km?.toFixed(1) || 0} km → <strong>${info.px || 0} PX</strong></p>`;
            }).join('')}
          </div>
        ` : ''}
        ${(() => {
          const membersWithRoles = config.miembros.filter(m => m.papeles?.length);
          if (membersWithRoles.length === 0) return '';
          const journeyBasePX = journeyCalc.estimaciones.px_total;
          const pxPerMemberFromJourney = Math.floor(journeyBasePX / membersWithRoles.length);
          const allRolls = Object.values(characterXP || {}).flatMap(c => c.rolls || []);
          const aciertos = allRolls.filter(r => r.exito).length;
          const fallos = allRolls.length - aciertos;
          const totalRolls = aciertos + fallos;
          // Mismo cálculo que calculateGroupMultiplier (Tabla 2)
          let groupMult = 1.0;
          if (totalRolls > 0) {
            const ratio = aciertos / totalRolls;
            if (ratio >= 0.85) groupMult = 1.5;
            else if (ratio >= 0.7) groupMult = 1.25;
            else if (ratio >= 0.5) groupMult = 1.0;
            else if (ratio >= 0.3) groupMult = 0.75;
            else groupMult = 0.5;
          }
          const groupMultLabel = `×${groupMult.toFixed(2)} (grupo: ${aciertos} éxitos / ${fallos} fracasos)`;
          return `
            <div style="margin-top: 15px;">
              <p style="font-weight: bold; margin-bottom: 8px;">PX por jugador (multiplicador del grupo: ${groupMultLabel}):</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px;">
                <thead>
                  <tr style="background: rgba(212, 196, 168, 0.3);">
                    <th style="padding: 6px 8px; text-align: left; border-bottom: 2px solid #c8b88a;">Personaje</th>
                    <th style="padding: 6px 8px; text-align: left; border-bottom: 2px solid #c8b88a;">Papel</th>
                    <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #c8b88a;">PX viaje</th>
                    <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #c8b88a;">PX tiradas</th>
                    <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #c8b88a;">PX ajustados</th>
                    <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #c8b88a; color: #1d4ed8;">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  ${membersWithRoles.map(m => {
                    const rollsXP = characterXP[m.id]?.total || 0;
                    const rollsXPAjustado = Math.floor(rollsXP * groupMult);
                    const totalXP = Math.max(0, pxPerMemberFromJourney + rollsXPAjustado);
                    const papeles = (m.papeles || []).join(', ');
                    return `
                      <tr style="border-bottom: 1px solid rgba(0,0,0,0.1);">
                        <td style="padding: 5px 8px; font-weight: 600;">${m.nombre}</td>
                        <td style="padding: 5px 8px; font-style: italic; color: #6b5b3a;">${papeles}</td>
                        <td style="padding: 5px 8px; text-align: center;">${pxPerMemberFromJourney}</td>
                        <td style="padding: 5px 8px; text-align: center;">${rollsXP}</td>
                        <td style="padding: 5px 8px; text-align: center;">${rollsXPAjustado}</td>
                        <td style="padding: 5px 8px; text-align: center; font-weight: bold; color: #1d4ed8; font-size: 14px;">${totalXP} PX</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              <p style="font-size: 11px; color: #6b5b3a; margin-top: 6px; font-style: italic;">
                PX viaje = base del trayecto dividida entre los miembros con papeles. PX tiradas = bonificaciones por tiradas individuales (por CD y resultado). PX ajustados = PX tiradas multiplicados por el rendimiento del grupo. TOTAL = PX viaje + PX ajustados (mínimo 0).
              </p>
            </div>
          `;
        })()}
      ` : ''}

      ${events.length > 0 ? `
        <h2>Acontecimientos del Viaje</h2>
        ${events.map((e) => `
          <div class="event ${e.exito ? 'event-success' : 'event-failure'}">
            <strong>Casilla ${e.casilla}: ${e.evento?.nombre || 'Acontecimiento'}</strong>
            <span style="float: right;">${e.exito ? '✓ Éxito' : '✗ Fracaso'} (${e.tirada} vs CD ${e.resolucion?.cd || '?'})</span>
            ${e.clima_dia ? `
              <div style="font-size:11px; color:#6b5b3a; margin:6px 0; padding:4px 8px; background:rgba(212,196,168,0.25); border-left:3px solid #c8b88a; font-family:monospace;">
                ${e.clima_dia.icon || ''} ${e.clima_dia.estado_label || ''}
                ${e.clima_dia.temp_min !== undefined ? ` · ${e.clima_dia.temp_min}°→${e.clima_dia.temp_max}°` : ''}
                ${e.clima_dia.viento_kmh !== undefined ? ` · viento ${e.clima_dia.viento_kmh}km/h${e.clima_dia.dir_viento ? ' ' + e.clima_dia.dir_viento : ''}` : ''}
                ${e.clima_dia.pct_lluvia !== undefined && e.clima_dia.pct_lluvia > 0 ? ` · lluvia ${Math.round(e.clima_dia.pct_lluvia)}%` : ''}
              </div>
            ` : ''}
            <p style="margin: 8px 0 0 0; font-style: italic;">
              ${e.narrativa || (e.exito ? e.evento?.consecuencias_exito : e.evento?.consecuencias_fracaso) || ''}
            </p>
          </div>
        `).join('')}
      ` : '<p><em>El viaje transcurrió sin mayores contratiempos.</em></p>'}

      ${fatigueResults.length > 0 ? `
        <h2>Fatiga del Viaje</h2>
        ${fatigueResults.map(r => `
          <p>
            <strong>${r.personaje}:</strong>
            Tirada ${r.tirada?.d20} + ${r.tirada?.modificador_con} CON = ${r.tirada?.total} vs CD ${r.cd}
            → <strong>${r.niveles_cansancio} nivel(es) de cansancio</strong>
          </p>
        `).join('')}
      ` : ''}

      <div class="footer">
        <p>Generado por el Sistema de Viajes de Rutas por la Tierra Media</p>
        <p>${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </body>
    </html>`;
  };

  generatePrintContent().then(printContent => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    } else {
      toast.error('No se pudo abrir la ventana de impresión. Verifica que los pop-ups no estén bloqueados.');
    }
  }).catch(err => {
    console.error('Error generating print content:', err);
    toast.error('Error al generar la crónica');
  });
};
