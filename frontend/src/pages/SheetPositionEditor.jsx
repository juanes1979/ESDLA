/**
 * Sheet Position Editor - Tool to find exact coordinates on the character sheet
 * Click anywhere on the sheet to get x, y coordinates
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Sheet dimensions (based on PDF converted images 1701x2197)
const SHEET_WIDTH = 1701;
const SHEET_HEIGHT = 2197;

const SheetPositionEditor = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.7);
  const [clickedPositions, setClickedPositions] = useState([]);
  const [lastCopied, setLastCopied] = useState(null);
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
    };
    
    setClickedPositions(prev => [...prev, newPosition]);
  };

  // Copy position to clipboard
  const copyPosition = (pos) => {
    const text = `x={${pos.x}} y={${pos.y}}`;
    navigator.clipboard.writeText(text);
    setLastCopied(pos.id);
    setTimeout(() => setLastCopied(null), 2000);
  };

  // Copy all positions as code
  const copyAllAsCode = () => {
    const code = clickedPositions
      .filter(p => p.page === currentPage)
      .map((pos, i) => `// Field ${i + 1}\n<DisplayField value={""} x={${pos.x}} y={${pos.y}} width={100} scale={scale} fontSize={14} align="center" />`)
      .join('\n\n');
    navigator.clipboard.writeText(code);
  };

  // Clear all positions
  const clearPositions = () => {
    setClickedPositions([]);
  };

  // Remove single position
  const removePosition = (id) => {
    setClickedPositions(prev => prev.filter(p => p.id !== id));
  };

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
              onClick={copyAllAsCode}
              disabled={clickedPositions.filter(p => p.page === currentPage).length === 0}
              className="border-[hsl(var(--gold))/50]"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar código
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearPositions}
              className="border-[hsl(var(--destructive))/50] text-[hsl(var(--destructive))]"
            >
              Limpiar
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sheet Container */}
        <div 
          ref={containerRef}
          className="flex-1 flex justify-center py-8 overflow-auto"
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
              className="absolute inset-0 w-full h-full pointer-events-none"
              draggable={false}
            />

            {/* Clicked position markers */}
            {clickedPositions
              .filter(pos => pos.page === currentPage)
              .map((pos, index) => (
                <div
                  key={pos.id}
                  className="absolute w-4 h-4 -ml-2 -mt-2 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[8px] font-bold cursor-pointer hover:scale-125 transition-transform"
                  style={{
                    left: `${pos.x * scale}px`,
                    top: `${pos.y * scale}px`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    removePosition(pos.id);
                  }}
                  title={`Click para eliminar\nx=${pos.x}, y=${pos.y}`}
                >
                  {index + 1}
                </div>
              ))}
          </div>
        </div>

        {/* Sidebar - Position List */}
        <div className="w-80 bg-black/50 border-l border-border/50 p-4 overflow-auto max-h-[calc(100vh-64px)]">
          <h2 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">
            Posiciones (Página {currentPage})
          </h2>
          
          <p className="text-xs text-muted-foreground mb-4">
            Haz clic en la ficha para marcar posiciones. Haz clic en un marcador para eliminarlo.
          </p>

          {clickedPositions.filter(p => p.page === currentPage).length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No hay posiciones marcadas
            </p>
          ) : (
            <div className="space-y-2">
              {clickedPositions
                .filter(pos => pos.page === currentPage)
                .map((pos, index) => (
                  <div
                    key={pos.id}
                    className="bg-secondary/50 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-mono text-foreground">
                          x={pos.x}, y={pos.y}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyPosition(pos)}
                      className="h-8 w-8 p-0"
                    >
                      {lastCopied === pos.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 p-3 bg-[hsl(var(--gold))/10] rounded-lg border border-[hsl(var(--gold))/30]">
            <h3 className="text-sm font-heading text-[hsl(var(--gold))] mb-2">
              Instrucciones
            </h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Haz clic en la ficha para marcar una posición</li>
              <li>• Las coordenadas son en píxeles originales (1701×2197)</li>
              <li>• Usa "Copiar código" para obtener el código JSX</li>
              <li>• Haz clic en un marcador rojo para eliminarlo</li>
            </ul>
          </div>

          {/* Quick reference for current sheet dimensions */}
          <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
            <h3 className="text-sm font-heading text-muted-foreground mb-2">
              Dimensiones de la ficha
            </h3>
            <p className="text-xs text-muted-foreground">
              Ancho: {SHEET_WIDTH}px<br />
              Alto: {SHEET_HEIGHT}px
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SheetPositionEditor;
