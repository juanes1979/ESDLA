/**
 * Interactive Character Sheet - 3-page character sheet with image backgrounds
 * Uses the official LOTR RPG sheet images as backgrounds with data overlay fields
 * Coordinates based on 1701x2197 pixel images
 * 
 * REFACTORED: Split into SheetPage1 and SheetPage2 components
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, Printer, ZoomIn, ZoomOut, Download, FileText, Crown, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getCharacter } from '@/services/api';
import api from '@/services/api';
import SheetPage1 from '@/components/character-sheet/SheetPage1';
import SheetPage2 from '@/components/character-sheet/SheetPage2';
import SheetPage3 from '@/components/character-sheet/SheetPage3';
import EquipmentRewardsModal from '@/components/character-sheet/EquipmentRewardsModal';
import EquipmentManagerModal from '@/components/character-sheet/EquipmentManagerModal';

// Sheet dimensions (based on PDF converted images 1701x2197)
const SHEET_WIDTH = 1701;
const SHEET_HEIGHT = 2197;

const InteractiveCharacterSheet = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);
  const [weaponCatalog, setWeaponCatalog] = useState([]);
  const [equipmentCatalog, setEquipmentCatalog] = useState({ equipo_general: [], herramientas: [], armas: [], armaduras: [] });
  const [fieldPositions, setFieldPositions] = useState({ page1: {}, page2: {}, page3: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.6);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const containerRef = useRef(null);
  const sheetRef = useRef(null);

  // Load character data, equipment catalog, and field positions
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load character, equipment catalog, and positions in parallel
        const [characterData, catalogRes, positionsRes] = await Promise.all([
          getCharacter(characterId),
          api.get('/data/equipment-catalog'),
          api.get('/data/sheet-positions')
        ]);
        
        setCharacter(characterData);
        const catalog = catalogRes.data || {};
        setWeaponCatalog(catalog.armas || []);
        setEquipmentCatalog(catalog);
        setFieldPositions(positionsRes.data || { page1: {}, page2: {}, page3: {} });
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err.response?.data?.detail || err.message || 'Error al cargar el personaje');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [characterId]);

  // Handle print/PDF
  const handlePrint = () => {
    window.print();
  };

  // Generate PDF with all 3 pages
  const generatePDF = async (saveToStorage = false) => {
    if (!sheetRef.current) return;
    
    setGeneratingPdf(true);
    toast.info('Generando PDF... Por favor espera.');
    
    const originalPage = currentPage;
    const originalScale = scale;
    
    try {
      // Set scale to 1 for best quality
      setScale(1);
      
      // Create PDF with A4 dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm
      
      // Generate each page
      for (let pageNum = 1; pageNum <= 3; pageNum++) {
        setCurrentPage(pageNum);
        
        // Wait for page to render
        await new Promise(resolve => setTimeout(resolve, 500));

        // Espera a que TODAS las fuentes (incluida la caligráfica) estén cargadas
        // para que el texto quede EXACTAMENTE en el mismo sitio que en pantalla.
        if (document.fonts && document.fonts.ready) {
          try { await document.fonts.ready; } catch { /* noop */ }
        }

        // Captura con html-to-image (usa el motor SVG del propio navegador):
        // reproduce el render real de la pantalla y elimina el desfase del texto
        // que provocaba html2canvas.
        const imgData = await toJpeg(sheetRef.current, {
          quality: 0.95,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
          width: SHEET_WIDTH,
          height: SHEET_HEIGHT,
        });

        if (pageNum > 1) {
          pdf.addPage();
        }

        // Escala la imagen para que quepa ENTERA dentro de la página A4
        // sin desbordar hacia abajo (preserva relación de aspecto y centra).
        const ratio = SHEET_WIDTH / SHEET_HEIGHT;
        let imgWidth = pdfWidth;
        let imgHeight = pdfWidth / ratio;
        if (imgHeight > pdfHeight) {
          imgHeight = pdfHeight;
          imgWidth = pdfHeight * ratio;
        }
        const xOffset = (pdfWidth - imgWidth) / 2;
        const yOffset = (pdfHeight - imgHeight) / 2;

        pdf.addImage(imgData, 'JPEG', xOffset, yOffset, imgWidth, imgHeight);
      }
      
      // Generate filename
      const filename = `${character.nombre || 'personaje'}_ficha.pdf`.replace(/\s+/g, '_');
      
      // Download PDF
      pdf.save(filename);
      
      // Also save to GridFS storage if requested
      if (saveToStorage) {
        try {
          const pdfBlob = pdf.output('blob');
          const formData = new FormData();
          formData.append('file', pdfBlob, filename);
          formData.append('maestro_id', 'default_maestro');
          formData.append('character_id', characterId);
          formData.append('folder', 'character_sheets');
          
          await api.post('/storage/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          
          toast.success('PDF guardado en el almacén');
        } catch (storageErr) {
          console.error('Error saving to storage:', storageErr);
          toast.warning('PDF descargado pero no se pudo guardar en el almacén');
        }
      } else {
        toast.success('PDF generado correctamente');
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Error al generar el PDF');
    } finally {
      // Restore original state
      setCurrentPage(originalPage);
      setScale(originalScale);
      setGeneratingPdf(false);
    }
  };

  // Page navigation handlers
  const goToPreviousPage = () => {
    setCurrentPage(p => Math.max(1, p - 1));
  };

  const goToNextPage = () => {
    setCurrentPage(p => Math.min(3, p + 1));
  };

  if (loading) {
    return (
      <div className="min-h-screen tavern-bg flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="min-h-screen tavern-bg flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || 'Personaje no encontrado'}</p>
        <Button variant="outline" onClick={() => navigate('/characters')}>
          Volver a Mis Personajes
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#2a2a2a]" data-testid="interactive-sheet">
      {/* Import handwritten font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap');
      `}</style>

      {/* Header */}
      <header className="border-b border-border/50 bg-black/70 backdrop-blur-sm sticky top-0 z-50 print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/character/${characterId}`)}
              className="text-muted-foreground hover:text-foreground"
              data-testid="back-button"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a la ficha
            </Button>
            <h1 className="font-heading text-xl text-[hsl(var(--gold))]">
              {character.nombre}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Page navigation */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="h-7 w-7 p-0"
                data-testid="prev-page-btn"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-2 min-w-[80px] text-center" data-testid="page-indicator">
                Página {currentPage} / 3
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage === 3}
                className="h-7 w-7 p-0"
                data-testid="next-page-btn"
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
                data-testid="zoom-out-btn"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScale(s => Math.min(1.2, s + 0.1))}
                className="h-7 w-7 p-0"
                data-testid="zoom-in-btn"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-[hsl(var(--magic-blue))/50] hover:bg-[hsl(var(--magic-blue))/10]"
              data-testid="print-btn"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            
            <Button
              size="sm"
              onClick={() => generatePDF(false)}
              disabled={generatingPdf}
              className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))/80]"
              data-testid="pdf-btn"
            >
              {generatingPdf ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              {generatingPdf ? 'Generando...' : 'Descargar PDF'}
            </Button>
            
            <Button
              size="sm"
              onClick={() => generatePDF(true)}
              disabled={generatingPdf}
              variant="outline"
              className="border-green-500/50 hover:bg-green-500/10"
              data-testid="save-pdf-storage-btn"
            >
              {generatingPdf ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2 text-green-400" />
              )}
              Guardar en Almacén
            </Button>
            
            <Button
              size="sm"
              onClick={() => setShowRewardsModal(true)}
              variant="outline"
              className="border-[hsl(var(--torch-orange))/50] hover:bg-[hsl(var(--torch-orange))/10]"
              data-testid="rewards-btn"
            >
              <Crown className="w-4 h-4 mr-2 text-[hsl(var(--torch-orange))]" />
              Recompensas
            </Button>
            
            <Button
              size="sm"
              onClick={() => setShowEquipmentModal(true)}
              variant="outline"
              className="border-[hsl(var(--magic-blue))/50] hover:bg-[hsl(var(--magic-blue))/10]"
              data-testid="equipment-btn"
            >
              <Package className="w-4 h-4 mr-2 text-[hsl(var(--magic-blue))]" />
              Equipo
            </Button>
          </div>
        </div>
      </header>

      {/* Sheet Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto py-8 print:py-0 print:overflow-visible"
      >
        <div className="flex justify-center min-w-fit px-4">
          <div 
            ref={sheetRef}
            className="relative bg-white shadow-2xl print:shadow-none flex-shrink-0"
            style={{
              width: SHEET_WIDTH * scale,
              height: SHEET_HEIGHT * scale,
              aspectRatio: `${SHEET_WIDTH} / ${SHEET_HEIGHT}`,
            }}
            data-testid="sheet-container"
          >
            {/* Background Image */}
            <img
              src={`/assets/sheets/sheet_page${currentPage}_web.png`}
              alt={`Character Sheet Page ${currentPage}`}
              className="absolute inset-0 w-full h-full"
              draggable={false}
            />

            {/* PAGE 1 */}
            {currentPage === 1 && (
              <SheetPage1 
                character={character} 
                scale={scale} 
                weaponCatalog={weaponCatalog}
                equipmentCatalog={equipmentCatalog}
              />
            )}

            {/* PAGE 2 */}
            {currentPage === 2 && (
              <SheetPage2 
                character={character} 
                scale={scale}
                fieldPositions={fieldPositions.page2}
              />
            )}

            {/* PAGE 3 */}
            {currentPage === 3 && (
              <SheetPage3 
                character={character} 
                scale={scale}
                fieldPositions={fieldPositions.page3}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Equipment Rewards Modal */}
      <EquipmentRewardsModal
        isOpen={showRewardsModal}
        onClose={() => setShowRewardsModal(false)}
        character={character}
        onCharacterUpdate={(updatedChar) => setCharacter(updatedChar)}
      />
      
      {/* Equipment Manager Modal */}
      <EquipmentManagerModal
        isOpen={showEquipmentModal}
        onClose={() => setShowEquipmentModal(false)}
        character={character}
        onCharacterUpdate={(updatedChar) => setCharacter(updatedChar)}
      />
    </div>
  );
};

export default InteractiveCharacterSheet;
