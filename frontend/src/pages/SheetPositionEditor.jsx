/**
 * Sheet Position Editor - Tool to find exact coordinates on the character sheet
 * Click anywhere on the sheet to get x, y coordinates and assign field names
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Sheet dimensions (based on PDF converted images 1701x2197)
const SHEET_WIDTH = 1701;
const SHEET_HEIGHT = 2197;

// Predefined field suggestions for quick selection
const FIELD_SUGGESTIONS = [
  // Header
  'nombre', 'jugador', 'ocupacion_nivel', 'cultura', 'rasgos_distintivos', 'experiencia',
  // Attributes
  'fuerza_valor', 'fuerza_mod', 'destreza_valor', 'destreza_mod', 
  'constitucion_valor', 'constitucion_mod', 'inteligencia_valor', 'inteligencia_mod',
  'sabiduria_valor', 'sabiduria_mod', 'carisma_valor', 'carisma_mod',
  // Combat
  'inspiracion', 'bonificador_competencia', 'clase_armadura', 'iniciativa', 'velocidad',
  'pg_max', 'pg_temp', 'pg_actual', 'dado_golpe',
  // Saving throws
  'salvacion_fue', 'salvacion_des', 'salvacion_con', 'salvacion_int', 'salvacion_sab', 'salvacion_car',
  // Skills
  'hab_acertijos', 'hab_acrobacias', 'hab_atletismo', 'hab_cazar', 'hab_engano',
  'hab_explorar', 'hab_interpretacion', 'hab_intimidacion', 'hab_investigacion',
  'hab_juego_manos', 'hab_medicina', 'hab_naturaleza', 'hab_percepcion',
  'hab_perspicacia', 'hab_persuasion', 'hab_saber_antiguo', 'hab_sigilo',
  'hab_trato_animales', 'hab_viajar', 'percepcion_pasiva',
  // Shadow
  'sombra_puntuacion', 'sombra_cicatrices', 'senda_sombra',
  // Other
  'trasfondo', 'rasgos_personalidad', 'equipo', 'monedas', 'ataques', 'virtudes',
];

const SheetPositionEditor = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.7);
  const [positions, setPositions] = useState([]);
  const [lastCopied, setLastCopied] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(null);
  const containerRef = useRef(null);

  // Handle click on sheet
  const handleSheetClick = (e) => {
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
      width: 100,
      fontSize: 14,
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
      if (!acc[`page${pos.page}`]) acc[`page${pos.page}`] = [];
      acc[`page${pos.page}`].push({
        field: pos.fieldName || `field_${pos.id}`,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        fontSize: pos.fontSize,
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
              Limpiar página
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sheet Container */}
        <div 
          ref={containerRef}
          className="flex-1 flex justify-center py-8 overflow-auto"
          style={{ maxHeight: 'calc(100vh - 64px)' }}
        >
          <div 
            className="relative bg-white shadow-2xl cursor-crosshair"
            style={{
              width: SHEET_WIDTH * scale,
              height: SHEET_HEIGHT * scale,
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

            {/* Clicked position markers */}
            {currentPagePositions.map((pos, index) => (
              <div
                key={pos.id}
                className={cn(
                  "absolute flex items-center justify-center cursor-pointer transition-all",
                  editingId === pos.id 
                    ? "bg-blue-500 ring-2 ring-blue-300" 
                    : pos.fieldName 
                      ? "bg-green-500" 
                      : "bg-red-500"
                )}
                style={{
                  left: `${pos.x * scale - 10}px`,
                  top: `${pos.y * scale - 10}px`,
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  fontSize: '10px',
                  color: 'white',
                  fontWeight: 'bold',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(pos.id === editingId ? null : pos.id);
                }}
                title={pos.fieldName || `Campo ${index + 1}`}
              >
                {index + 1}
              </div>
            ))}
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
                          "w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold",
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
                        className="h-7 w-7 p-0"
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
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Field name input */}
                  <div className="relative">
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
                      <div className="absolute z-10 w-full mt-1 max-h-40 overflow-auto bg-secondary border border-border rounded-lg shadow-lg">
                        {FIELD_SUGGESTIONS
                          .filter(s => s.includes(pos.fieldName.toLowerCase()))
                          .slice(0, 10)
                          .map(suggestion => (
                            <button
                              key={suggestion}
                              className="w-full px-3 py-1.5 text-left text-sm hover:bg-[hsl(var(--gold))/10] transition-colors"
                              onMouseDown={() => updateFieldName(pos.id, suggestion)}
                            >
                              {suggestion}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Width and fontSize controls */}
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Ancho</label>
                      <Input
                        type="number"
                        value={pos.width}
                        onChange={(e) => updatePosition(pos.id, 'width', parseInt(e.target.value) || 100)}
                        className="h-7 text-xs bg-black/30 border-border/50"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Tamaño</label>
                      <Input
                        type="number"
                        value={pos.fontSize}
                        onChange={(e) => updatePosition(pos.id, 'fontSize', parseInt(e.target.value) || 14)}
                        className="h-7 text-xs bg-black/30 border-border/50"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 p-3 bg-[hsl(var(--gold))/10] rounded-lg border border-[hsl(var(--gold))/30]">
            <h3 className="text-sm font-heading text-[hsl(var(--gold))] mb-2">
              Cómo usar
            </h3>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Haz clic en la ficha donde va cada campo</li>
              <li>Escribe el nombre del campo (ej: "nombre", "fuerza_valor")</li>
              <li>Ajusta ancho y tamaño de fuente si es necesario</li>
              <li>Cuando termines, haz clic en "Exportar JSON"</li>
              <li>Pásame el JSON y yo actualizo la ficha</li>
            </ol>
          </div>

          {/* Color legend */}
          <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
            <h3 className="text-sm font-heading text-muted-foreground mb-2">
              Leyenda de colores
            </h3>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-muted-foreground">Sin nombre asignado</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-muted-foreground">Con nombre asignado</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-muted-foreground">Editando</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SheetPositionEditor;
