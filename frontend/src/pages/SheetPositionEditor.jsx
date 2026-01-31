/**
 * Sheet Position Editor - Tool to find exact coordinates on the character sheet
 * Click anywhere on the sheet to get x, y coordinates and assign field names
 * Now with live preview of text in each field
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, Trash2, Eye, EyeOff, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// LocalStorage key for saving work
const STORAGE_KEY = 'sheet-editor-positions';

// Sheet dimensions (based on PDF converted images 1701x2197)
const SHEET_WIDTH = 1701;
const SHEET_HEIGHT = 2197;

// Predefined field suggestions for quick selection
const FIELD_SUGGESTIONS = [
  // Datos básicos
  'nombre', 'jugador', 'ocupacion_nivel', 'cultura', 'rasgos_distintivos', 'experiencia', 'senda_sombra',
  
  // Atributos - valores y modificadores
  'fuerza_valor', 'fuerza_mod', 'destreza_valor', 'destreza_mod', 
  'constitucion_valor', 'constitucion_mod', 'inteligencia_valor', 'inteligencia_mod',
  'sabiduria_valor', 'sabiduria_mod', 'carisma_valor', 'carisma_mod',
  
  // Estadísticas de combate
  'inspiracion', 'bonificador_competencia', 'clase_armadura', 'iniciativa', 'velocidad',
  'pg_max', 'pg_actual', 'pg_temp', 'dado_golpe',
  
  // Tiradas de salvación - valores
  'salvacion_fue', 'salvacion_des', 'salvacion_con', 'salvacion_int', 'salvacion_sab', 'salvacion_car',
  // Tiradas de salvación - checkboxes de competencia (x si competente)
  'comp_salvacion_fue', 'comp_salvacion_des', 'comp_salvacion_con', 
  'comp_salvacion_int', 'comp_salvacion_sab', 'comp_salvacion_car',
  
  // Habilidades - valores
  'hab_acertijos', 'hab_acrobacias', 'hab_atletismo', 'hab_cazar', 'hab_engano',
  'hab_explorar', 'hab_interpretacion', 'hab_intimidacion', 'hab_investigacion',
  'hab_juego_manos', 'hab_medicina', 'hab_naturaleza', 'hab_percepcion',
  'hab_perspicacia', 'hab_persuasion', 'hab_saber_antiguo', 'hab_sigilo',
  'hab_trato_animales', 'hab_viajar', 
  
  // Habilidades - checkboxes de competencia/pericia (x=competencia, P=pericia)
  'comp_hab_acertijos', 'comp_hab_acrobacias', 'comp_hab_atletismo', 'comp_hab_cazar', 'comp_hab_engano',
  'comp_hab_explorar', 'comp_hab_interpretacion', 'comp_hab_intimidacion', 'comp_hab_investigacion',
  'comp_hab_juego_manos', 'comp_hab_medicina', 'comp_hab_naturaleza', 'comp_hab_percepcion',
  'comp_hab_perspicacia', 'comp_hab_persuasion', 'comp_hab_saber_antiguo', 'comp_hab_sigilo',
  'comp_hab_trato_animales', 'comp_hab_viajar',
  
  'percepcion_pasiva',
  
  // Sombra
  'sombra_puntuacion', 'sombra_cicatrices',
  
  // Monedas - campos separados
  'monedas_estano', 'monedas_cobre', 'monedas_plata', 'monedas_oro',
  
  // Equipo - 20 filas
  'equipo_1', 'equipo_2', 'equipo_3', 'equipo_4', 'equipo_5', 'equipo_6', 'equipo_7', 'equipo_8',
  'equipo_9', 'equipo_10', 'equipo_11', 'equipo_12', 'equipo_13', 'equipo_14', 'equipo_15', 'equipo_16',
  'equipo_17', 'equipo_18', 'equipo_19', 'equipo_20',
  
  // Armas - 5 filas con subcampos (nombre, daño, herida, distancia)
  'arma_1_nombre', 'arma_1_dano', 'arma_1_herida', 'arma_1_distancia',
  'arma_2_nombre', 'arma_2_dano', 'arma_2_herida', 'arma_2_distancia',
  'arma_3_nombre', 'arma_3_dano', 'arma_3_herida', 'arma_3_distancia',
  'arma_4_nombre', 'arma_4_dano', 'arma_4_herida', 'arma_4_distancia',
  'arma_5_nombre', 'arma_5_dano', 'arma_5_herida', 'arma_5_distancia',
  
  // Idiomas y herramientas - 6 filas
  'idioma_herr_1', 'idioma_herr_2', 'idioma_herr_3', 'idioma_herr_4', 'idioma_herr_5', 'idioma_herr_6',
  
  // Otros
  'trasfondo', 'rasgos_personalidad', 'ataques', 'virtudes',
];

const SheetPositionEditor = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.7);
  const [positions, setPositions] = useState([]);
  const [lastCopied, setLastCopied] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(null);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showTextFields, setShowTextFields] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null); // 'saved', 'loaded', null
  const containerRef = useRef(null);

  // Load saved positions from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPositions(parsed);
          setSaveStatus('loaded');
          setTimeout(() => setSaveStatus(null), 2000);
        }
      } catch (e) {
        console.error('Error loading saved positions:', e);
      }
    }
  }, []);

  // Save positions to localStorage
  const saveToLocalStorage = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  // Load positions from file
  const loadFromFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // Convert from export format back to internal format
        const loaded = [];
        let id = Date.now();
        Object.entries(data).forEach(([pageKey, fields]) => {
          const pageNum = parseInt(pageKey.replace('page', ''));
          fields.forEach((field) => {
            loaded.push({
              id: id++,
              x: field.x,
              y: field.y,
              page: pageNum,
              fieldName: field.field,
              width: field.width || 150,
              fontSize: field.fontSize || 16,
              previewText: '',
              align: field.align || 'left',
            });
          });
        });
        setPositions(loaded);
        setSaveStatus('loaded');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch (err) {
        alert('Error al cargar el archivo JSON');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // Handle click on sheet
  const handleSheetClick = (e) => {
    // Don't add new position if clicking on an existing text field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Convert to original coordinates (unscaled)
    const originalX = Math.round(clickX / scale);
    const originalY = Math.round(clickY / scale);
    
    const newPosition = {
      id: Date.now(),
      x: originalX,
      y: originalY,
      page: currentPage,
      fieldName: '',
      width: 150,
      fontSize: 16,
      previewText: '',
      align: 'left',
    };
    
    setPositions(prev => [...prev, newPosition]);
    setEditingId(newPosition.id);
  };

  // Update position field name
  const updateFieldName = (id, name) => {
    setPositions(prev => prev.map(p => 
      p.id === id ? { ...p, fieldName: name } : p
    ));
  };

  // Update position property
  const updatePosition = (id, prop, value) => {
    setPositions(prev => prev.map(p => 
      p.id === id ? { ...p, [prop]: value } : p
    ));
  };

  // Copy single position
  const copyPosition = (pos) => {
    const text = `{ field: "${pos.fieldName}", x: ${pos.x}, y: ${pos.y}, width: ${pos.width}, fontSize: ${pos.fontSize} }`;
    navigator.clipboard.writeText(text);
    setLastCopied(pos.id);
    setTimeout(() => setLastCopied(null), 2000);
  };

  // Export all positions as JSON
  const exportPositions = () => {
    const data = positions.reduce((acc, pos) => {
      const pageKey = `page${pos.page}`;
      if (!acc[pageKey]) acc[pageKey] = [];
      acc[pageKey].push({
        field: pos.fieldName || `field_${pos.id}`,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        fontSize: pos.fontSize,
        align: pos.align || 'left',
      });
      return acc;
    }, {});
    
    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json);
    alert('Posiciones copiadas al portapapeles como JSON');
  };

  // Clear all positions for current page
  const clearCurrentPage = () => {
    setPositions(prev => prev.filter(p => p.page !== currentPage));
  };

  // Remove single position
  const removePosition = (id) => {
    setPositions(prev => prev.filter(p => p.id !== id));
    if (editingId === id) setEditingId(null);
  };

  // Get positions for current page
  const currentPagePositions = positions.filter(p => p.page === currentPage);

  return (
    <div className="min-h-screen bg-[#1a1a1a]" data-testid="sheet-editor">
      {/* Import Ink Free font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap');
        
        .sheet-field-text {
          font-family: 'Caveat', 'Ink Free', cursive;
        }
      `}</style>

      {/* Header */}
      <header className="border-b border-border/50 bg-black/70 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="font-heading text-xl text-[hsl(var(--gold))]">
              Editor de Posiciones de Ficha
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Page navigation */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-2 min-w-[80px] text-center">
                Página {currentPage} / 3
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(3, p + 1))}
                disabled={currentPage === 3}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScale(s => Math.max(0.3, s - 0.1))}
                className="h-7 w-7 p-0"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScale(s => Math.min(1.5, s + 0.1))}
                className="h-7 w-7 p-0"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            {/* Toggle markers */}
            <Button
              variant={showMarkers ? "default" : "outline"}
              size="sm"
              onClick={() => setShowMarkers(!showMarkers)}
              className={showMarkers ? "bg-red-500 hover:bg-red-600" : ""}
            >
              {showMarkers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>

            {/* Save status indicator */}
            {saveStatus && (
              <span className={cn(
                "text-xs px-2 py-1 rounded",
                saveStatus === 'saved' ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
              )}>
                {saveStatus === 'saved' ? '✓ Guardado' : '✓ Cargado'}
              </span>
            )}

            {/* Save to localStorage */}
            <Button
              variant="outline"
              size="sm"
              onClick={saveToLocalStorage}
              disabled={positions.length === 0}
              className="border-green-500/50 text-green-400 hover:bg-green-500/10"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>

            {/* Load from file */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={loadFromFile}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 pointer-events-none"
                asChild
              >
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Cargar JSON
                </span>
              </Button>
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={exportPositions}
              disabled={positions.length === 0}
              className="border-[hsl(var(--gold))/50]"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearCurrentPage}
              className="border-[hsl(var(--destructive))/50] text-[hsl(var(--destructive))]"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sheet Container - Fixed width container that allows horizontal scroll */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto py-8"
          style={{ maxHeight: 'calc(100vh - 64px)' }}
        >
          <div className="flex justify-center min-w-fit px-4">
            <div 
              className="relative bg-white shadow-2xl cursor-crosshair flex-shrink-0"
              style={{
                width: SHEET_WIDTH * scale,
                height: SHEET_HEIGHT * scale,
                aspectRatio: `${SHEET_WIDTH} / ${SHEET_HEIGHT}`, // Mantiene proporción DIN A4
              }}
              onClick={handleSheetClick}
            >
              {/* Background Image */}
              <img
                src={`/assets/sheets/sheet_page${currentPage}_web.png`}
                alt={`Character Sheet Page ${currentPage}`}
                className="absolute inset-0 w-full h-full pointer-events-none select-none"
                draggable={false}
              />

            {/* Editable text fields at each position */}
            {currentPagePositions.map((pos) => (
              <input
                key={`text-${pos.id}`}
                type="text"
                value={pos.previewText}
                onChange={(e) => updatePosition(pos.id, 'previewText', e.target.value)}
                placeholder={pos.fieldName || '...'}
                className="sheet-field-text absolute bg-transparent border-none outline-none text-black placeholder:text-gray-400/50"
                style={{
                  left: `${pos.x * scale}px`,
                  top: `${pos.y * scale}px`,
                  width: `${pos.width * scale}px`,
                  fontSize: `${pos.fontSize * scale}px`,
                  textAlign: pos.align || 'left',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(pos.id);
                }}
              />
            ))}

            {/* Position markers (circles with numbers) */}
            {showMarkers && currentPagePositions.map((pos, index) => (
              <div
                key={`marker-${pos.id}`}
                className={cn(
                  "absolute flex items-center justify-center cursor-pointer transition-all pointer-events-auto",
                  editingId === pos.id 
                    ? "bg-blue-500 ring-2 ring-blue-300" 
                    : pos.fieldName 
                      ? "bg-green-500" 
                      : "bg-red-500"
                )}
                style={{
                  left: `${pos.x * scale - 8}px`,
                  top: `${pos.y * scale - 20}px`,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  fontSize: '8px',
                  color: 'white',
                  fontWeight: 'bold',
                  zIndex: 10,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(pos.id === editingId ? null : pos.id);
                }}
                title={`${pos.fieldName || 'Sin nombre'} (x:${pos.x}, y:${pos.y})`}
              >
                {index + 1}
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* Sidebar - Position List */}
        <div className="w-96 bg-black/50 border-l border-border/50 p-4 overflow-auto" style={{ maxHeight: 'calc(100vh - 64px)' }}>
          <h2 className="font-heading text-lg text-[hsl(var(--gold))] mb-2">
            Posiciones - Página {currentPage}
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Total: {currentPagePositions.length} campos · 
            <span className="text-green-400 ml-1">{currentPagePositions.filter(p => p.fieldName).length} nombrados</span>
          </p>

          {currentPagePositions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm mb-2">
                No hay posiciones marcadas
              </p>
              <p className="text-xs text-muted-foreground">
                Haz clic en la ficha para añadir campos
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentPagePositions.map((pos, index) => (
                <div
                  key={pos.id}
                  className={cn(
                    "rounded-lg p-3 transition-all",
                    editingId === pos.id 
                      ? "bg-blue-500/20 border border-blue-500/50" 
                      : "bg-secondary/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span 
                        className={cn(
                          "w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold",
                          pos.fieldName ? "bg-green-500" : "bg-red-500"
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        x:{pos.x} y:{pos.y}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyPosition(pos)}
                        className="h-6 w-6 p-0"
                      >
                        {lastCopied === pos.id ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePosition(pos.id)}
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* X/Y Position inputs */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-xs text-muted-foreground">X</label>
                      <Input
                        type="number"
                        value={pos.x}
                        onChange={(e) => updatePosition(pos.id, 'x', parseInt(e.target.value) || 0)}
                        className="h-7 text-xs bg-black/30 border-border/50 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Y</label>
                      <Input
                        type="number"
                        value={pos.y}
                        onChange={(e) => updatePosition(pos.id, 'y', parseInt(e.target.value) || 0)}
                        className="h-7 text-xs bg-black/30 border-border/50 font-mono"
                      />
                    </div>
                  </div>

                  {/* Field name input */}
                  <div className="relative mb-2">
                    <Input
                      placeholder="Nombre del campo..."
                      value={pos.fieldName}
                      onChange={(e) => updateFieldName(pos.id, e.target.value)}
                      onFocus={() => setShowSuggestions(pos.id)}
                      onBlur={() => setTimeout(() => setShowSuggestions(null), 200)}
                      className="h-8 text-sm bg-black/30 border-border/50"
                    />
                    
                    {/* Suggestions dropdown */}
                    {showSuggestions === pos.id && (
                      <div className="absolute z-20 w-full mt-1 max-h-32 overflow-auto bg-secondary border border-border rounded-lg shadow-lg">
                        {FIELD_SUGGESTIONS
                          .filter(s => s.includes(pos.fieldName.toLowerCase()))
                          .slice(0, 8)
                          .map(suggestion => (
                            <button
                              key={suggestion}
                              className="w-full px-3 py-1 text-left text-xs hover:bg-[hsl(var(--gold))/10] transition-colors"
                              onMouseDown={() => updateFieldName(pos.id, suggestion)}
                            >
                              {suggestion}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Preview text */}
                  <div className="mb-2">
                    <label className="text-xs text-muted-foreground mb-1 block">Texto de prueba</label>
                    <Input
                      placeholder="Escribe para ver cómo queda..."
                      value={pos.previewText}
                      onChange={(e) => updatePosition(pos.id, 'previewText', e.target.value)}
                      className="h-8 text-sm bg-black/30 border-border/50 sheet-field-text"
                    />
                  </div>

                  {/* Width, fontSize, align controls */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Ancho</label>
                      <Input
                        type="number"
                        value={pos.width}
                        onChange={(e) => updatePosition(pos.id, 'width', parseInt(e.target.value) || 100)}
                        className="h-7 text-xs bg-black/30 border-border/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Tamaño</label>
                      <Input
                        type="number"
                        value={pos.fontSize}
                        onChange={(e) => updatePosition(pos.id, 'fontSize', parseInt(e.target.value) || 14)}
                        className="h-7 text-xs bg-black/30 border-border/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Alinear</label>
                      <select
                        value={pos.align || 'left'}
                        onChange={(e) => updatePosition(pos.id, 'align', e.target.value)}
                        className="h-7 w-full text-xs bg-black/30 border border-border/50 rounded-md px-2"
                      >
                        <option value="left">Izq</option>
                        <option value="center">Centro</option>
                        <option value="right">Der</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Font preview */}
          <div className="mt-6 p-3 bg-[hsl(var(--gold))/10] rounded-lg border border-[hsl(var(--gold))/30]">
            <h3 className="text-sm font-heading text-[hsl(var(--gold))] mb-2">
              Vista previa de fuente
            </h3>
            <p className="sheet-field-text text-lg text-foreground">
              Fuente: Caveat (similar a Ink Free)
            </p>
            <p className="sheet-field-text text-base text-muted-foreground">
              ABCDEFGHIJKLMNÑOPQRSTUVWXYZ
            </p>
            <p className="sheet-field-text text-base text-muted-foreground">
              abcdefghijklmnñopqrstuvwxyz 0123456789
            </p>
          </div>

          {/* Instructions */}
          <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
            <h3 className="text-sm font-heading text-muted-foreground mb-2">
              Cómo usar
            </h3>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Haz clic en la ficha donde va cada campo</li>
              <li>Escribe el nombre del campo</li>
              <li>Escribe texto de prueba para ver cómo queda</li>
              <li>Ajusta ancho, tamaño y alineación</li>
              <li>Cuando termines, "Exportar JSON"</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SheetPositionEditor;
