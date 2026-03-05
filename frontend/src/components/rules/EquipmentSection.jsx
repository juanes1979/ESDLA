/**
 * Equipment Section Component
 * Displays equipment tables by category with admin editing capabilities
 */
import { useState } from 'react';
import { Plus, Edit, Trash2, Printer, MapPin, Package, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import api, { getEquipmentCatalog } from '@/services/api';

// Currency display helper
const formatPrice = (precio, moneda) => {
  if (!precio) return '-';
  return `${precio} ${moneda || 'mp'}`;
};

// Settlement levels for availability
const SETTLEMENT_LEVELS = [
  { id: 'aldea', name: 'Aldea', icon: '🏡' },
  { id: 'pueblo', name: 'Pueblo', icon: '🏘️' },
  { id: 'villa', name: 'Villa', icon: '🏛️' },
  { id: 'ciudad', name: 'Ciudad', icon: '🏰' },
  { id: 'capital', name: 'Capital', icon: '👑' },
  { id: 'especial', name: 'Especial', icon: '✨' },
];

// Equipment category sections
const EQUIPMENT_SECTIONS = [
  {
    title: "⚔️ Armas",
    categories: [
      { key: 'armas_sencillas_cc', name: 'Armas Sencillas (Cuerpo a Cuerpo)', fields: ['nombre', 'precio', 'dano', 'modificador', 'herida', 'peso_kg'] },
      { key: 'armas_sencillas_distancia', name: 'Armas Sencillas (Distancia)', fields: ['nombre', 'precio', 'dano', 'alcance', 'herida', 'peso_kg'] },
      { key: 'armas_marciales_cc', name: 'Armas Marciales (Cuerpo a Cuerpo)', fields: ['nombre', 'precio', 'dano', 'modificador', 'herida', 'peso_kg'] },
      { key: 'armas_marciales_distancia', name: 'Armas Marciales (Distancia)', fields: ['nombre', 'precio', 'dano', 'alcance', 'herida', 'peso_kg'] },
    ]
  },
  {
    title: "🛡️ Armaduras",
    categories: [
      { key: 'armaduras_ligeras', name: 'Armaduras Ligeras', fields: ['nombre', 'precio', 'ca', 'comentarios', 'peso_kg'] },
      { key: 'armaduras_medias', name: 'Armaduras Medias', fields: ['nombre', 'precio', 'ca', 'comentarios', 'peso_kg'] },
      { key: 'armaduras_pesadas', name: 'Armaduras Pesadas', fields: ['nombre', 'precio', 'ca', 'comentarios', 'peso_kg'] },
      { key: 'escudos', name: 'Escudos', fields: ['nombre', 'precio', 'ca', 'peso_kg'] },
    ]
  },
  {
    title: "🎒 Equipo y Herramientas",
    categories: [
      { key: 'equipo_general', name: 'Equipo General', fields: ['nombre', 'precio', 'peso_kg'] },
      { key: 'herramientas', name: 'Herramientas', fields: ['nombre', 'precio', 'peso_kg'] },
      { key: 'juegos', name: 'Juegos', fields: ['nombre', 'precio', 'peso_kg'] },
      { key: 'instrumentos_musicales', name: 'Instrumentos Musicales', fields: ['nombre', 'precio', 'peso_kg'] },
    ]
  },
  {
    title: "🍖 Consumibles y Alimentación",
    categories: [
      { key: 'consumibles', name: 'Consumibles y Alimentación', fields: ['nombre', 'precio', 'peso_kg'] },
      { key: 'comida_posadas', name: 'Comida en Posadas y Restaurantes', fields: ['nombre', 'precio', 'peso_kg'] },
    ]
  },
  {
    title: "🌿 Hierbas y Venenos",
    categories: [
      { key: 'hierbas', name: 'Hierbas Medicinales y Pociones', fields: ['nombre', 'precio', 'forma_preparacion', 'efecto', 'peso_kg'] },
      { key: 'venenos', name: 'Venenos', fields: ['nombre', 'precio', 'forma_preparacion', 'efecto', 'peso_kg'] },
    ]
  },
  {
    title: "🐴 Monturas y Transporte",
    categories: [
      { key: 'monturas', name: 'Monturas', fields: ['nombre', 'precio', 'capacidad_carga', 'constitucion', 'velocidad', 'capacidad_pequeno', 'capacidad_mediano'] },
      { key: 'accesorios_monturas', name: 'Accesorios de Monturas', fields: ['nombre', 'precio', 'peso_kg'] },
      { key: 'transporte_terrestre', name: 'Transporte Terrestre', fields: ['nombre', 'precio', 'capacidad_kg'] },
      { key: 'transporte_maritimo', name: 'Transporte Marítimo', fields: ['nombre', 'precio', 'capacidad_kg'] },
    ]
  },
  {
    title: "🏗️ Elementos de Construcción",
    categories: [
      { key: 'construccion', name: 'Elementos de Construcción', fields: ['nombre', 'precio', 'peso_kg', 'm2'] },
    ]
  },
  {
    title: "💎 Gemas",
    categories: [
      { key: 'gemas_preciosas', name: 'Gemas Preciosas', fields: ['nombre', 'precio', 'moneda'] },
      { key: 'gemas_semipreciosas', name: 'Gemas Semipreciosas', fields: ['nombre', 'precio', 'moneda'] },
    ]
  },
];

const EquipmentSection = ({ 
  data, 
  isAdmin = false, 
  searchTerm = '',
  onRefresh,
  onOpenEquipmentEditor,
  availableRegions = []
}) => {
  // Local state for modals
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedPdfCategories, setSelectedPdfCategories] = useState([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfFilterSettlement, setPdfFilterSettlement] = useState('');
  const [pdfFilterRegion, setPdfFilterRegion] = useState('');
  
  // Item editor state
  const [showItemEditor, setShowItemEditor] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [savingItem, setSavingItem] = useState(false);
  
  // Category availability editor state
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [editingCategoryKey, setEditingCategoryKey] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [categoryAvailability, setCategoryAvailability] = useState({ nivel_asentamiento: [], regiones_disponibles: [] });
  const [savingCategory, setSavingCategory] = useState(false);

  if (!data) return null;

  // Filter data by search term
  const filterData = (items, term) => {
    if (!term || !items) return items;
    const lower = term.toLowerCase();
    return items.filter(item => {
      const name = item.nombre || '';
      return name.toLowerCase().includes(lower);
    });
  };

  // Handle delete equipment item
  const handleDeleteItem = async (categoria, nombre) => {
    if (!window.confirm(`¿Eliminar "${nombre}" de ${categoria}?`)) return;
    
    try {
      await api.delete(`/data/equipment/${categoria}/${encodeURIComponent(nombre)}`);
      toast.success(`"${nombre}" eliminado`);
      onRefresh?.();
    } catch (err) {
      toast.error('Error al eliminar: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Handle save equipment item
  const handleSaveItem = async () => {
    if (!editingItem) return;
    
    setSavingItem(true);
    try {
      const { categoria, ...itemData } = editingItem;
      const originalNombre = editingItem._originalNombre || editingItem.nombre;
      
      await api.put(`/data/equipment/${categoria}/${encodeURIComponent(originalNombre)}`, itemData);
      toast.success(`"${itemData.nombre}" actualizado`);
      
      onRefresh?.();
      setShowItemEditor(false);
      setEditingItem(null);
    } catch (err) {
      toast.error('Error al guardar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingItem(false);
    }
  };

  // Open category availability editor
  const openCategoryEditor = (categoryKey, categoryName) => {
    setEditingCategoryKey(categoryKey);
    setEditingCategoryName(categoryName);
    setCategoryAvailability({ nivel_asentamiento: [], regiones_disponibles: [] });
    setShowCategoryEditor(true);
  };

  // Handle save category availability
  const handleSaveCategoryAvailability = async () => {
    if (!editingCategoryKey) return;
    
    setSavingCategory(true);
    try {
      const items = data[editingCategoryKey] || [];
      const updates = items.map(item => ({
        categoria: editingCategoryKey,
        nombre: item.nombre,
        nivel_asentamiento: categoryAvailability.nivel_asentamiento,
        regiones_disponibles: categoryAvailability.regiones_disponibles
      }));
      
      await api.post('/data/equipment/batch-set-availability', updates);
      toast.success(`Disponibilidad actualizada para ${updates.length} items en "${editingCategoryName}"`);
      
      onRefresh?.();
      setShowCategoryEditor(false);
      setEditingCategoryKey(null);
    } catch (err) {
      toast.error('Error al guardar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingCategory(false);
    }
  };

  // Generate PDF
  const generatePdf = async () => {
    if (selectedPdfCategories.length === 0) {
      toast.error('Selecciona al menos una categoría');
      return;
    }
    
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      let y = 20;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('Lista de Equipamiento - Tierra Media 5e', 20, y);
      y += 10;
      
      if (pdfFilterSettlement || pdfFilterRegion) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        let filterText = 'Filtrado por: ';
        if (pdfFilterSettlement) filterText += `Asentamiento: ${pdfFilterSettlement}`;
        if (pdfFilterRegion) filterText += (pdfFilterSettlement ? ', ' : '') + `Región: ${pdfFilterRegion}`;
        doc.text(filterText, 20, y);
        y += 8;
      }
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      for (const catKey of selectedPdfCategories) {
        const catItems = data[catKey];
        if (!catItems?.length) continue;
        
        // Filter by settlement/region if specified
        let filtered = catItems;
        if (pdfFilterSettlement) {
          filtered = filtered.filter(item => 
            !item.nivel_asentamiento?.length || item.nivel_asentamiento.includes(pdfFilterSettlement)
          );
        }
        if (pdfFilterRegion) {
          filtered = filtered.filter(item =>
            !item.regiones_disponibles?.length || item.regiones_disponibles.includes(pdfFilterRegion)
          );
        }
        
        if (!filtered.length) continue;
        
        // Find category name
        let catName = catKey;
        for (const section of EQUIPMENT_SECTIONS) {
          const found = section.categories.find(c => c.key === catKey);
          if (found) { catName = found.name; break; }
        }
        
        // Add new page if needed
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(catName, 20, y);
        y += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        for (const item of filtered) {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          const price = formatPrice(item.precio, item.moneda);
          const weight = item.peso_kg ? `${item.peso_kg}kg` : '';
          doc.text(`• ${item.nombre} - ${price} ${weight}`, 25, y);
          y += 5;
        }
        y += 4;
      }
      
      doc.save('equipamiento_lotr5e.pdf');
      toast.success('PDF generado correctamente');
      setShowPdfModal(false);
    } catch (err) {
      toast.error('Error al generar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Render a single equipment table
  const renderTable = (cat) => {
    const items = data[cat.key];
    if (!items?.length) return null;
    
    const filtered = filterData(items, searchTerm);
    if (!filtered?.length) return null;
    
    return (
      <div key={cat.key} className="card-parchment rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-heading text-md text-[hsl(var(--magic-blue))]">{cat.name}</h4>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCategoryEditor(cat.key, cat.name)}
              className="h-7 text-xs border-[hsl(var(--torch-orange))]/50 hover:bg-[hsl(var(--torch-orange))]/10"
              title="Editar disponibilidad de toda la categoría"
            >
              <MapPin className="w-3 h-3 mr-1 text-[hsl(var(--torch-orange))]" />
              Disponibilidad ({items.length})
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-2">Nombre</th>
                <th className="text-right py-2 px-2">Precio</th>
                {cat.fields.includes('dano') && <th className="text-center py-2 px-2">Daño</th>}
                {cat.fields.includes('modificador') && <th className="text-center py-2 px-2">Tipo</th>}
                {cat.fields.includes('alcance') && <th className="text-center py-2 px-2">Alcance</th>}
                {cat.fields.includes('herida') && <th className="text-center py-2 px-2">Herida</th>}
                {cat.fields.includes('ca') && <th className="text-center py-2 px-2">CA</th>}
                {cat.fields.includes('comentarios') && <th className="text-left py-2 px-2">Modificadores</th>}
                {cat.fields.includes('forma_preparacion') && <th className="text-center py-2 px-2">Preparación</th>}
                {cat.fields.includes('efecto') && <th className="text-left py-2 px-2">Efecto</th>}
                {cat.fields.includes('capacidad_carga') && <th className="text-center py-2 px-2">Carga</th>}
                {cat.fields.includes('constitucion') && <th className="text-center py-2 px-2">Const.</th>}
                {cat.fields.includes('velocidad') && <th className="text-center py-2 px-2">Vel.</th>}
                {cat.fields.includes('capacidad_pequeno') && <th className="text-center py-2 px-2">Pequeño</th>}
                {cat.fields.includes('capacidad_mediano') && <th className="text-center py-2 px-2">Mediano</th>}
                {cat.fields.includes('capacidad_kg') && <th className="text-center py-2 px-2">Cap. (Kg)</th>}
                {cat.fields.includes('m2') && <th className="text-center py-2 px-2">m²</th>}
                {cat.fields.includes('peso_kg') && <th className="text-right py-2 px-2">Peso</th>}
                <th className="text-center py-2 px-2 w-12">Disp.</th>
                {isAdmin && <th className="text-center py-2 px-2 w-20">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={i} className="border-b border-border/10 hover:bg-black/10 group">
                  <td className="py-2 px-2">{item.nombre}</td>
                  <td className="text-right py-2 px-2 text-[hsl(var(--gold))]">{formatPrice(item.precio, item.moneda)}</td>
                  {cat.fields.includes('dano') && <td className="text-center py-2 px-2 text-[hsl(var(--torch-orange))]">{item.dano || '-'}</td>}
                  {cat.fields.includes('modificador') && <td className="text-center py-2 px-2 text-xs">{item.modificador || '-'}</td>}
                  {cat.fields.includes('alcance') && <td className="text-center py-2 px-2">{item.alcance || '-'}</td>}
                  {cat.fields.includes('herida') && <td className="text-center py-2 px-2">{item.herida || '-'}</td>}
                  {cat.fields.includes('ca') && <td className="text-center py-2 px-2 text-[hsl(var(--magic-blue))]">{item.ca || '-'}</td>}
                  {cat.fields.includes('comentarios') && <td className="text-left py-2 px-2 text-xs text-muted-foreground">{item.comentarios || '-'}</td>}
                  {cat.fields.includes('forma_preparacion') && <td className="text-center py-2 px-2 text-xs">{item.forma_preparacion || '-'}</td>}
                  {cat.fields.includes('efecto') && <td className="text-left py-2 px-2 text-xs text-muted-foreground max-w-[200px] truncate" title={item.efecto}>{item.efecto || '-'}</td>}
                  {cat.fields.includes('capacidad_carga') && <td className="text-center py-2 px-2">{item.capacidad_carga || '-'}</td>}
                  {cat.fields.includes('constitucion') && <td className="text-center py-2 px-2 text-[hsl(var(--torch-orange))]">{item.constitucion || '-'}</td>}
                  {cat.fields.includes('velocidad') && <td className="text-center py-2 px-2">{item.velocidad || '-'}</td>}
                  {cat.fields.includes('capacidad_pequeno') && <td className="text-center py-2 px-2">{item.capacidad_pequeno ? '✓' : '-'}</td>}
                  {cat.fields.includes('capacidad_mediano') && <td className="text-center py-2 px-2">{item.capacidad_mediano ? '✓' : '-'}</td>}
                  {cat.fields.includes('capacidad_kg') && <td className="text-center py-2 px-2">{item.capacidad_kg || '-'}</td>}
                  {cat.fields.includes('m2') && <td className="text-center py-2 px-2">{item.m2 || '-'}</td>}
                  {cat.fields.includes('peso_kg') && <td className="text-right py-2 px-2 text-muted-foreground">{item.peso_kg ? `${item.peso_kg} kg` : '-'}</td>}
                  <td className="text-center py-2 px-2">
                    {item.nivel_asentamiento?.length > 0 ? (
                      <span className="text-xs text-muted-foreground" title={item.nivel_asentamiento.join(', ')}>
                        {item.nivel_asentamiento.length === 5 ? '🌍' : 
                         item.nivel_asentamiento.includes('aldea') ? '🏡' : 
                         item.nivel_asentamiento.includes('pueblo') ? '🏘️' : 
                         item.nivel_asentamiento.includes('villa') ? '🏛️' : 
                         item.nivel_asentamiento.includes('ciudad') ? '🏰' : '👑'}
                      </span>
                    ) : '-'}
                  </td>
                  {isAdmin && (
                    <td className="text-center py-2 px-2">
                      <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingItem({ ...item, categoria: cat.key });
                            setShowItemEditor(true);
                          }}
                          className="p-1 hover:text-[hsl(var(--gold))]"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(cat.key, item.nombre)}
                          className="p-1 hover:text-destructive"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Get all category keys for PDF modal
  const allCategoryKeys = EQUIPMENT_SECTIONS.flatMap(s => s.categories.map(c => c.key));

  return (
    <div className="space-y-8" data-testid="equipment-section">
      {/* Action buttons */}
      <div className="flex justify-between items-center mb-4">
        <Button
          onClick={() => setShowPdfModal(true)}
          variant="outline"
          className="border-[hsl(var(--gold))]/50 hover:bg-[hsl(var(--gold))]/10"
          data-testid="export-equipment-pdf-btn"
        >
          <Printer className="w-4 h-4 mr-2 text-[hsl(var(--gold))]" />
          Imprimir Listado PDF
        </Button>
        
        {isAdmin && (
          <Button
            onClick={() => onOpenEquipmentEditor?.()}
            className="btn-fantasy"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear Equipo
          </Button>
        )}
      </div>

      {/* Equipment sections */}
      {EQUIPMENT_SECTIONS.map((section, sectionIdx) => {
        const hasItems = section.categories.some(cat => data[cat.key]?.length > 0);
        if (!hasItems) return null;
        
        return (
          <div key={sectionIdx}>
            <h3 className="font-heading text-xl text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
              {section.title}
            </h3>
            <div className="space-y-4">
              {section.categories.map(cat => renderTable(cat))}
            </div>
          </div>
        );
      })}

      {/* PDF Export Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(var(--background))] border border-[hsl(var(--gold))]/50 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border/30 flex justify-between items-center sticky top-0 bg-[hsl(var(--background))]">
              <h2 className="font-heading text-xl text-[hsl(var(--gold))] flex items-center gap-2">
                <Printer className="w-5 h-5" />
                Exportar Equipamiento a PDF
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowPdfModal(false)}>
                ✕
              </Button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Filtrar por Asentamiento</label>
                  <select
                    value={pdfFilterSettlement}
                    onChange={(e) => setPdfFilterSettlement(e.target.value)}
                    className="w-full h-10 px-2 bg-background border border-border rounded"
                  >
                    <option value="">Todos</option>
                    {SETTLEMENT_LEVELS.map(l => (
                      <option key={l.id} value={l.id}>{l.icon} {l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Filtrar por Región</label>
                  <select
                    value={pdfFilterRegion}
                    onChange={(e) => setPdfFilterRegion(e.target.value)}
                    className="w-full h-10 px-2 bg-background border border-border rounded"
                  >
                    <option value="">Todas</option>
                    {availableRegions.map(r => (
                      <option key={r.id} value={r.nombre}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category selection */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Seleccionar categorías</label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedPdfCategories(allCategoryKeys)}>
                      Todas
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedPdfCategories([])}>
                      Ninguna
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto bg-black/10 rounded p-3">
                  {EQUIPMENT_SECTIONS.map(section => (
                    <div key={section.title} className="space-y-1">
                      <p className="text-xs font-bold text-[hsl(var(--gold))]">{section.title}</p>
                      {section.categories.map(cat => (
                        <div key={cat.key} className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedPdfCategories.includes(cat.key)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedPdfCategories(prev => [...prev, cat.key]);
                              } else {
                                setSelectedPdfCategories(prev => prev.filter(k => k !== cat.key));
                              }
                            }}
                            id={`pdf-cat-${cat.key}`}
                          />
                          <label htmlFor={`pdf-cat-${cat.key}`} className="text-xs cursor-pointer">
                            {cat.name} ({data[cat.key]?.length || 0})
                          </label>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-border/30 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPdfModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={generatePdf}
                disabled={generatingPdf || selectedPdfCategories.length === 0}
                className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black"
              >
                {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
                Generar PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Item Editor Modal */}
      {showItemEditor && editingItem && (
        <ItemEditorModal
          item={editingItem}
          setItem={setEditingItem}
          onSave={handleSaveItem}
          onClose={() => { setShowItemEditor(false); setEditingItem(null); }}
          saving={savingItem}
          availableRegions={availableRegions}
        />
      )}

      {/* Category Availability Editor Modal */}
      {showCategoryEditor && (
        <CategoryAvailabilityModal
          categoryName={editingCategoryName}
          categoryKey={editingCategoryKey}
          data={data}
          availability={categoryAvailability}
          setAvailability={setCategoryAvailability}
          onSave={handleSaveCategoryAvailability}
          onClose={() => { setShowCategoryEditor(false); setEditingCategoryKey(null); }}
          saving={savingCategory}
          availableRegions={availableRegions}
        />
      )}
    </div>
  );
};

// Item Editor Modal Component
const ItemEditorModal = ({ item, setItem, onSave, onClose, saving, availableRegions }) => {
  const updateField = (field, value) => {
    setItem(prev => ({
      ...prev,
      [field]: value,
      _originalNombre: prev._originalNombre || prev.nombre
    }));
  };

  const toggleSettlement = (level) => {
    const current = item.nivel_asentamiento || [];
    const updated = current.includes(level) 
      ? current.filter(l => l !== level)
      : [...current, level];
    updateField('nivel_asentamiento', updated);
  };

  const toggleRegion = (regionName, subregions = []) => {
    const current = item.regiones_disponibles || [];
    const isSelected = current.includes(regionName);
    let updated;
    if (isSelected) {
      const toRemove = [regionName, ...subregions.map(s => s.nombre)];
      updated = current.filter(r => !toRemove.includes(r));
    } else {
      const toAdd = [regionName, ...subregions.map(s => s.nombre)];
      updated = [...new Set([...current, ...toAdd])];
    }
    updateField('regiones_disponibles', updated);
  };

  const toggleSubregion = (subName) => {
    const current = item.regiones_disponibles || [];
    const updated = current.includes(subName)
      ? current.filter(r => r !== subName)
      : [...current, subName];
    updateField('regiones_disponibles', updated);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[hsl(var(--background))] border border-[hsl(var(--gold))]/50 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border/30 flex justify-between items-center sticky top-0 bg-[hsl(var(--background))]">
          <h2 className="font-heading text-xl text-[hsl(var(--gold))] flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Editar: {item.nombre}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Basic fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Nombre</label>
              <Input value={item.nombre || ''} onChange={(e) => updateField('nombre', e.target.value)} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-sm text-muted-foreground">Precio</label>
                <Input type="number" value={item.precio || 0} onChange={(e) => updateField('precio', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="w-24">
                <label className="text-sm text-muted-foreground">Moneda</label>
                <select value={item.moneda || 'mp'} onChange={(e) => updateField('moneda', e.target.value)} className="w-full h-10 px-2 bg-background border border-border rounded">
                  <option value="mc">mc</option>
                  <option value="me">me</option>
                  <option value="mp">mp</option>
                  <option value="mo">mo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Settlement availability */}
          <div className="border-t border-border/30 pt-4">
            <h3 className="text-sm font-medium text-[hsl(var(--gold))] mb-3">Disponibilidad por Asentamiento</h3>
            <div className="flex flex-wrap gap-2">
              {SETTLEMENT_LEVELS.map(level => (
                <button
                  key={level.id}
                  onClick={() => toggleSettlement(level.id)}
                  className={`px-3 py-1.5 rounded border text-sm flex items-center gap-1.5 transition-colors ${
                    (item.nivel_asentamiento || []).includes(level.id)
                      ? 'bg-[hsl(var(--gold))]/20 border-[hsl(var(--gold))] text-[hsl(var(--gold))]'
                      : 'bg-black/20 border-border/30 text-muted-foreground hover:border-border'
                  }`}
                >
                  <span>{level.icon}</span>
                  <span>{level.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Region availability */}
          <div className="border-t border-border/30 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[hsl(var(--magic-blue))]">Disponibilidad por Región</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const allRegions = [];
                  availableRegions.forEach(r => {
                    allRegions.push(r.nombre);
                    r.subregions?.forEach(s => allRegions.push(s.nombre));
                  });
                  updateField('regiones_disponibles', allRegions);
                }} className="text-xs h-7">Todas</Button>
                <Button variant="outline" size="sm" onClick={() => updateField('regiones_disponibles', [])} className="text-xs h-7">Ninguna</Button>
              </div>
            </div>
            
            <div className="max-h-48 overflow-y-auto space-y-2 bg-black/10 rounded p-2">
              {availableRegions.map(region => {
                const regionSelected = (item.regiones_disponibles || []).includes(region.nombre);
                const subregions = region.subregions || [];
                
                return (
                  <div key={region.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={regionSelected}
                        onCheckedChange={() => toggleRegion(region.nombre, subregions)}
                        id={`item-reg-${region.id}`}
                      />
                      <label htmlFor={`item-reg-${region.id}`} className="font-medium text-[hsl(var(--gold))] cursor-pointer">
                        {region.nombre}
                      </label>
                    </div>
                    {subregions.length > 0 && (
                      <div className="ml-6 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {subregions.map(sub => (
                          <div key={sub.id} className="flex items-center gap-1">
                            <Checkbox
                              checked={(item.regiones_disponibles || []).includes(sub.nombre)}
                              onCheckedChange={() => toggleSubregion(sub.nombre)}
                              id={`item-sub-${sub.id}`}
                              className="w-3 h-3"
                            />
                            <label htmlFor={`item-sub-${sub.id}`} className="text-xs text-muted-foreground cursor-pointer">
                              {sub.nombre}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-border/30 flex justify-end gap-2 sticky bottom-0 bg-[hsl(var(--background))]">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving} className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
};

// Category Availability Modal Component
const CategoryAvailabilityModal = ({ categoryName, categoryKey, data, availability, setAvailability, onSave, onClose, saving, availableRegions }) => {
  const toggleSettlement = (level) => {
    setAvailability(prev => {
      const current = prev.nivel_asentamiento || [];
      const updated = current.includes(level) 
        ? current.filter(l => l !== level)
        : [...current, level];
      return { ...prev, nivel_asentamiento: updated };
    });
  };

  const toggleRegion = (regionName, subregions = []) => {
    setAvailability(prev => {
      const current = prev.regiones_disponibles || [];
      const isSelected = current.includes(regionName);
      let updated;
      if (isSelected) {
        const toRemove = [regionName, ...subregions.map(s => s.nombre)];
        updated = current.filter(r => !toRemove.includes(r));
      } else {
        const toAdd = [regionName, ...subregions.map(s => s.nombre)];
        updated = [...new Set([...current, ...toAdd])];
      }
      return { ...prev, regiones_disponibles: updated };
    });
  };

  const toggleSubregion = (subName) => {
    setAvailability(prev => {
      const current = prev.regiones_disponibles || [];
      const updated = current.includes(subName)
        ? current.filter(r => r !== subName)
        : [...current, subName];
      return { ...prev, regiones_disponibles: updated };
    });
  };

  const selectAllSettlements = () => {
    setAvailability(prev => ({ ...prev, nivel_asentamiento: SETTLEMENT_LEVELS.map(l => l.id) }));
  };

  const clearAllSettlements = () => {
    setAvailability(prev => ({ ...prev, nivel_asentamiento: [] }));
  };

  const selectAllRegions = () => {
    const allRegions = [];
    availableRegions.forEach(r => {
      allRegions.push(r.nombre);
      r.subregions?.forEach(s => allRegions.push(s.nombre));
    });
    setAvailability(prev => ({ ...prev, regiones_disponibles: allRegions }));
  };

  const clearAllRegions = () => {
    setAvailability(prev => ({ ...prev, regiones_disponibles: [] }));
  };

  const itemCount = data[categoryKey]?.length || 0;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[hsl(var(--background))] border border-[hsl(var(--torch-orange))]/50 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border/30 flex justify-between items-center sticky top-0 bg-[hsl(var(--background))]">
          <div>
            <h2 className="font-heading text-xl text-[hsl(var(--torch-orange))] flex items-center gap-2">
              <Package className="w-5 h-5" />
              Editar Disponibilidad: {categoryName}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Se aplicará a los {itemCount} items de esta categoría
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        
        <div className="p-4 space-y-6">
          {/* Settlement availability */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[hsl(var(--gold))]">Disponibilidad por Asentamiento</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllSettlements} className="text-xs h-7">Todos</Button>
                <Button variant="outline" size="sm" onClick={clearAllSettlements} className="text-xs h-7">Ninguno</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SETTLEMENT_LEVELS.map(level => (
                <button
                  key={level.id}
                  onClick={() => toggleSettlement(level.id)}
                  className={`px-4 py-2 rounded border text-sm flex items-center gap-2 transition-colors ${
                    (availability.nivel_asentamiento || []).includes(level.id)
                      ? 'bg-[hsl(var(--gold))]/20 border-[hsl(var(--gold))] text-[hsl(var(--gold))]'
                      : 'bg-black/20 border-border/30 text-muted-foreground hover:border-border'
                  }`}
                >
                  <span className="text-lg">{level.icon}</span>
                  <span>{level.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Region availability */}
          <div className="border-t border-border/30 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[hsl(var(--magic-blue))]">Disponibilidad por Región</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllRegions} className="text-xs h-7">Todas</Button>
                <Button variant="outline" size="sm" onClick={clearAllRegions} className="text-xs h-7">Ninguna</Button>
              </div>
            </div>
            
            <div className="max-h-64 overflow-y-auto space-y-3 bg-black/10 rounded p-3">
              {availableRegions.map(region => {
                const regionSelected = (availability.regiones_disponibles || []).includes(region.nombre);
                const subregions = region.subregions || [];
                
                return (
                  <div key={region.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={regionSelected}
                        onCheckedChange={() => toggleRegion(region.nombre, subregions)}
                        id={`cat-reg-${region.id}`}
                      />
                      <label htmlFor={`cat-reg-${region.id}`} className="font-medium text-[hsl(var(--gold))] cursor-pointer">
                        {region.nombre}
                      </label>
                    </div>
                    {subregions.length > 0 && (
                      <div className="ml-6 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {subregions.map(sub => (
                          <div key={sub.id} className="flex items-center gap-1">
                            <Checkbox
                              checked={(availability.regiones_disponibles || []).includes(sub.nombre)}
                              onCheckedChange={() => toggleSubregion(sub.nombre)}
                              id={`cat-sub-${sub.id}`}
                              className="w-3 h-3"
                            />
                            <label htmlFor={`cat-sub-${sub.id}`} className="text-xs text-muted-foreground cursor-pointer">
                              {sub.nombre}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
            <p className="text-sm text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Esta acción sobrescribirá la disponibilidad de TODOS los items en "{categoryName}".
            </p>
          </div>
        </div>
        
        <div className="p-4 border-t border-border/30 flex justify-end gap-2 sticky bottom-0 bg-[hsl(var(--background))]">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving} className="bg-[hsl(var(--torch-orange))] hover:bg-[hsl(var(--torch-orange))]/90 text-black">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Aplicar a {itemCount} Items
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EquipmentSection;
