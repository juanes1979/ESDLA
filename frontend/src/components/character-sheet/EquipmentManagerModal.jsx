/**
 * Equipment Manager Modal
 * Allows adding, modifying, and removing equipment from characters
 * Handles purchases (deducting money) and gifts/treasures
 * Manages mount carrying capacity
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  X, Package, Plus, Trash2, Search, ShoppingCart, Gift, 
  Loader2, AlertTriangle, Landmark, User, Scale, Coins,
  Sword, Shield, ChevronDown, ChevronRight, Power, PowerOff, Shirt, FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { isNaked, isBarefoot, getActiveClothingByPosition } from '@/utils/clothingState';
import { getMountUsageStatus } from '@/utils/mountUsage';
import DistributionView from './DistributionView';

// Category display names
const CATEGORY_NAMES = {
  equipo_general: 'Equipo General',
  ropa: 'Ropa',
  herramientas: 'Herramientas',
  juegos: 'Juegos',
  instrumentos_musicales: 'Instrumentos Musicales',
  consumibles: 'Consumibles',
  comida_posadas: 'Comida en Posadas',
  hierbas: 'Hierbas y Pociones',
  venenos: 'Venenos',
  armas_sencillas_cc: 'Armas Sencillas (C/C)',
  armas_sencillas_distancia: 'Armas Sencillas (Distancia)',
  armas_marciales_cc: 'Armas Marciales (C/C)',
  armas_marciales_distancia: 'Armas Marciales (Distancia)',
  armaduras_ligeras: 'Armaduras Ligeras',
  armaduras_medias: 'Armaduras Medias',
  armaduras_pesadas: 'Armaduras Pesadas',
  escudos: 'Escudos',
  monturas: 'Monturas',
  accesorios_monturas: 'Accesorios de Montura',
  transporte_terrestre: 'Transporte Terrestre',
  transporte_maritimo: 'Transporte Marítimo',
};

// Category groups for organization
const CATEGORY_GROUPS = {
  'Armas': ['armas_sencillas_cc', 'armas_sencillas_distancia', 'armas_marciales_cc', 'armas_marciales_distancia'],
  'Armaduras': ['armaduras_ligeras', 'armaduras_medias', 'armaduras_pesadas', 'escudos'],
  'Equipo': ['equipo_general', 'herramientas', 'juegos', 'instrumentos_musicales'],
  'Ropa': ['ropa'],
  'Consumibles': ['consumibles', 'comida_posadas', 'hierbas', 'venenos'],
  'Monturas y Transporte': ['monturas', 'accesorios_monturas', 'transporte_terrestre', 'transporte_maritimo'],
};

const POSICIONES = ['cabeza', 'cuerpo', 'brazos', 'piernas', 'pies'];

const COIN_LABELS = { mo: 'Oro', mp: 'Plata', me: 'Estaño', mc: 'Cobre' };

const EquipmentManagerModal = ({
  isOpen,
  onClose,
  character,
  onCharacterUpdate,
}) => {
  const [activeTab, setActiveTab] = useState('add'); // 'add' | 'manage'
  const [catalog, setCatalog] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('equipo_general');
  const [expandedGroups, setExpandedGroups] = useState({ 'Equipo': true });
  const [discardTarget, setDiscardTarget] = useState(null); // { nombreBase, categoria, activa, posicion }
  // Re-categorise dialog target { item_index, source, nombreBase, categoria }
  const [editTarget, setEditTarget] = useState(null);
  const [editCategoria, setEditCategoria] = useState('');
  const [editPosicion, setEditPosicion] = useState('');
  
  // Toggle group expansion
  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };
  const [weightSummary, setWeightSummary] = useState(null);
  
  // Add item form state
  const [selectedItem, setSelectedItem] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [isPurchase, setIsPurchase] = useState(true);
  
  // Price modifiers state
  const [priceModifiers, setPriceModifiers] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState({
    region: null,
    asentamiento: null,
    relacion: null,
    contexto: null,
  });
  const [showModifiers, setShowModifiers] = useState(false);

  // Load catalog, weight summary, price modifiers and chests
  const [chestsApi, setChestsApi] = useState(null);
  useEffect(() => {
    const loadData = async () => {
      if (!isOpen) return;
      try {
        setLoading(true);
        const [catalogRes, weightRes, modifiersRes, chestsRes] = await Promise.all([
          api.get('/data/equipment-catalog'),
          api.get(`/characters/${character.id}/weight-summary`),
          api.get('/data/modificadores-precio'),
          api.get(`/characters/${character.id}/chests`),
        ]);
        setCatalog(catalogRes.data || {});
        setWeightSummary(weightRes.data);
        setPriceModifiers(modifiersRes.data);
        setChestsApi(chestsRes.data);
      } catch (err) {
        console.error('Error loading data:', err);
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isOpen, character?.id]);

  // Refresh weight after changes
  const refreshWeight = async () => {
    try {
      const res = await api.get(`/characters/${character.id}/weight-summary`);
      setWeightSummary(res.data);
    } catch (err) {
      console.error('Error refreshing weight:', err);
    }
  };

  // Calculate total modifier from selected options
  const calculateTotalModifier = () => {
    let total = 1.0;
    if (selectedModifiers.region) total *= selectedModifiers.region.modificador;
    if (selectedModifiers.asentamiento) total *= selectedModifiers.asentamiento.modificador;
    if (selectedModifiers.relacion) total *= selectedModifiers.relacion.modificador;
    if (selectedModifiers.contexto) total *= selectedModifiers.contexto.modificador;
    return total;
  };

  // Filter items based on search and (optionally) the character's
  // current region. The shop filter is enabled by default — items
  // whose `regiones_disponibles` array is non-empty AND does not
  // include the character's current region are hidden. Empty / missing
  // array means "available everywhere". Toggle off to ignore region.
  const [filterByRegion, setFilterByRegion] = useState(true);
  const characterRegion = (character?.ubicacion_actual?.region || '').trim();
  const filteredItems = useMemo(() => {
    let items = catalog[selectedCategory] || [];
    if (filterByRegion && characterRegion) {
      items = items.filter(it => {
        const regs = it.regiones_disponibles || [];
        if (!regs.length) return true; // available everywhere
        return regs.includes(characterRegion);
      });
    }
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => item.nombre?.toLowerCase().includes(term));
  }, [catalog, selectedCategory, searchTerm, filterByRegion, characterRegion]);

  // Mapa nombre(normalizado) -> peso_kg desde TODO el catálogo. Permite a la
  // tabla de portadores mostrar el peso aunque el item no tenga peso_kg persistido.
  const catalogWeights = useMemo(() => {
    const map = {};
    Object.values(catalog || {}).forEach((cat) => {
      if (!Array.isArray(cat)) return;
      cat.forEach((it) => {
        const nombre = it?.nombre;
        const peso = Number(it?.peso_kg);
        if (nombre && Number.isFinite(peso) && peso > 0) {
          const key = String(nombre).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          if (!(key in map)) map[key] = peso;
        }
      });
    });
    return map;
  }, [catalog]);


  // Get current character money in display format
  const getMoneyDisplay = () => {
    const dinero = character?.dinero || { mo: 0, mp: 0, me: 0, mc: 0 };
    const parts = [];
    if (dinero.mo > 0) parts.push(`${dinero.mo} mo`);
    if (dinero.mp > 0) parts.push(`${dinero.mp} mp`);
    if (dinero.me > 0) parts.push(`${dinero.me} me`);
    if (dinero.mc > 0) parts.push(`${dinero.mc} mc`);
    return parts.length > 0 ? parts.join(', ') : '0';
  };

  // Calculate total price with modifiers
  const getTotalPrice = () => {
    if (!selectedItem) return null;
    const precioBase = selectedItem.precio || 0;
    const moneda = selectedItem.moneda || 'mp';
    const modifier = calculateTotalModifier();
    const precioFinal = Math.round(precioBase * cantidad * modifier * 100) / 100;
    return { 
      precioBase: precioBase * cantidad,
      precioFinal,
      moneda,
      modifier,
    };
  };

  // Check if can afford
  const canAfford = () => {
    if (!isPurchase || !selectedItem) return true;
    const priceData = getTotalPrice();
    if (!priceData || priceData.precioFinal === 0) return true;
    
    // Convert everything to copper for comparison
    const rates = { mo: 1000, mp: 100, me: 10, mc: 1 };
    const dinero = character?.dinero || { mo: 0, mp: 0, me: 0, mc: 0 };
    const totalCopper = (dinero.mo || 0) * rates.mo + (dinero.mp || 0) * rates.mp + 
                        (dinero.me || 0) * rates.me + (dinero.mc || 0) * rates.mc;
    const costCopper = priceData.precioFinal * rates[priceData.moneda];
    return totalCopper >= costCopper;
  };

  // Add equipment
  const handleAddEquipment = async () => {
    if (!selectedItem) return;
    
    setProcessing(true);
    try {
      // Get price with modifiers applied
      const priceData = getTotalPrice();
      const finalPrice = isPurchase && priceData ? priceData.precioFinal / cantidad : 0;
      
      const res = await api.post(`/characters/${character.id}/equipment/add`, {
        item_name: selectedItem.nombre,
        item_category: selectedCategory,
        cantidad: cantidad,
        is_purchase: isPurchase,
        precio: finalPrice, // Use modified price
        moneda: selectedItem.moneda || 'mp',
        peso_kg: selectedItem.peso_kg,
        dano: selectedItem.dano,
        ca: selectedItem.ca,
        ca_bonus: selectedItem.ca_bonus,
        herida: selectedItem.herida,
        alcance: selectedItem.alcance,
        capacidad_carga: selectedItem.capacidad_carga,
        posicion: selectedItem.posicion,
      });
      
      toast.success(res.data.message);
      onCharacterUpdate(res.data.character);
      await refreshWeight();

      // Mount-purchase warnings: alert if missing accessories
      if (selectedCategory === 'monturas') {
        const status = getMountUsageStatus(res.data.character);
        if (status.missingForLoad.length > 0) {
          toast.warning(
            `🐎 Has comprado una montura, pero NO podrás cargarla sin: ${status.missingForLoad.join(', ')}.`,
            { duration: 9000 }
          );
        }
        if (status.missingForRide.length > 0 && !status.razaPuedeSinSilla) {
          toast.warning(
            `🏇 Para montarla necesitas: ${status.missingForRide.join(' y ')}. (Excepto Elfo, Rohirrim o Dúnedan, que pueden montar a pelo.)`,
            { duration: 12000 }
          );
        } else if (status.missingForRide.length > 0 && status.razaPuedeSinSilla) {
          toast.info(
            `🏇 Tu cultura te permite montar sin silla, pero te faltan: ${status.missingForRide.join(', ')} para montar de forma estándar.`,
            { duration: 10000 }
          );
        }
      }
      
      // Reset form
      setSelectedItem(null);
      setCantidad(1);
    } catch (err) {
      console.error('Error adding equipment:', err);
      toast.error(err.response?.data?.detail || 'Error al añadir equipo');
    } finally {
      setProcessing(false);
    }
  };

  // Convierte cualquier `detail` de FastAPI (string, lista de validation
  // errors, dict) en un mensaje legible para `toast.error`. Sin esto un
  // 422 con `detail: [{loc, msg, ...}]` se intenta renderizar como objeto y
  // React revienta con "Objects are not valid as a React child".
  const formatApiError = (err, fallback = 'Error') => {
    const d = err?.response?.data?.detail;
    if (!d) return err?.message || fallback;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) {
      return d.map((e) => e?.msg || JSON.stringify(e)).join(' · ') || fallback;
    }
    if (typeof d === 'object') return d.msg || JSON.stringify(d);
    return String(d);
  };

  // ============== CHESTS (baúles por ubicación) ==============

  const refreshChests = async () => {
    try {
      const res = await api.get(`/characters/${character.id}/chests`);
      setChestsApi(res.data);
    } catch (err) {
      console.error('Error refreshing chests:', err);
    }
  };

  const handleStoreInChest = async (item, locationId) => {
    setProcessing(true);
    try {
      const payload = {
        location_id: locationId,
        item_index: item.itemIndex,
        source: item.source === 'mount' ? 'mount' : item.source,
        mount_id: item.mountId || undefined,
        cantidad: item.cantidad > 1 ? item.cantidad : undefined,
      };
      const res = await api.post(`/characters/${character.id}/chest/store`, payload);
      onCharacterUpdate(res.data.character);
      await Promise.all([refreshWeight(), refreshChests()]);
      if (res.data.chest_created) {
        toast.success(`Baúl creado en esta ubicación (-1 mp). Guardado: ${item.nombre}`);
      } else {
        toast.success(`Guardado en el baúl: ${item.nombre}`);
      }
    } catch (err) {
      toast.error(formatApiError(err, 'No se pudo guardar en el baúl'));
    } finally {
      setProcessing(false);
    }
  };

  const handleRetrieveFromChest = async (item, targetCarrier, targetMountId = null) => {
    setProcessing(true);
    try {
      const payload = {
        location_id: item.locationId,
        item_name: item.nombre,
        target_carrier: targetCarrier,
        target_mount_id: targetMountId,
      };
      const res = await api.post(`/characters/${character.id}/chest/retrieve`, payload);
      onCharacterUpdate(res.data.character);
      await Promise.all([refreshWeight(), refreshChests()]);
      toast.success(`Retirado del baúl: ${item.nombre}`);
    } catch (err) {
      toast.error(formatApiError(err, 'No se pudo retirar del baúl'));
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Handler genérico de la nueva DistributionView. Traduce el portador destino
   * a la operación de API correspondiente.
   */
  const handleDistributionMove = async (item, portador) => {
    // Destino baúl → store
    if (portador.kind === 'chest') {
      return handleStoreInChest(item, portador.locationId);
    }
    // Origen baúl → retrieve (a personaje o montura)
    if (item.source === 'chest') {
      const targetCarrier = portador.kind === 'mount' ? 'montura' : 'personaje';
      const targetMountId = portador.kind === 'mount' ? portador.mountId : null;
      return handleRetrieveFromChest(item, targetCarrier, targetMountId);
    }
    // Toggle activo dentro del personaje (equipado ↔ carga personal)
    if ((portador.kind === 'equipado' || portador.kind === 'personaje') &&
        (item.portadorId === 'equipado' || item.portadorId === 'personaje')) {
      const desiredActive = portador.kind === 'equipado';
      if (item.activa === desiredActive) return;
      setProcessing(true);
      try {
        const res = await api.patch(
          `/characters/${character.id}/equipment/toggle-active`,
          { item_index: item.itemIndex, source: item.source, activa: desiredActive }
        );
        const updated = res.data?.character || res.data;
        onCharacterUpdate(updated);
        if (res.data?.weight_summary) setWeightSummary(res.data.weight_summary);
        else await refreshWeight();
      } catch (err) {
        toast.error(formatApiError(err, 'No se pudo activar/desactivar'));
      } finally {
        setProcessing(false);
      }
      return;
    }
    // Carrier change (mount ↔ personaje, mount ↔ mount)
    setProcessing(true);
    try {
      const body = {
        item_index: item.itemIndex,
        source: item.source,
        carried_by: portador.kind === 'mount' ? 'montura' : 'personaje',
      };
      if (portador.kind === 'mount') body.mount_id = portador.mountId;
      const res = await api.patch(
        `/characters/${character.id}/equipment/carry`,
        body
      );
      const updated = res.data?.character || res.data;
      onCharacterUpdate(updated);
      if (res.data?.weight_summary) setWeightSummary(res.data.weight_summary);
      else await refreshWeight();
    } catch (err) {
      toast.error(formatApiError(err, 'No se pudo mover'));
    } finally {
      setProcessing(false);
    }
  };

  // Remove equipment ("Tirar al camino") — with contextual warnings.
  const handleRemoveEquipment = async (itemName, itemCategory, metaBefore = null) => {
    setProcessing(true);
    try {
      const res = await api.delete(`/characters/${character.id}/equipment/remove`, {
        params: { item_name: itemName, item_category: itemCategory }
      });
      
      const updatedChar = res.data.character;
      // Aplicación atómica: peso recalculado viene en la misma respuesta para
      // evitar la race condition que dejaba el peso obsoleto en pantalla.
      onCharacterUpdate(updatedChar);
      if (res.data.weight_summary) {
        setWeightSummary(res.data.weight_summary);
      } else {
        await refreshWeight();
      }

      // Warnings if the removed item was active and uncovered a body slot / left no active weapons
      if (metaBefore?.activa) {
        const pos = (metaBefore.posicion || '').toLowerCase();
        if (pos === 'cuerpo' && getActiveClothingByPosition(updatedChar, 'cuerpo').length === 0) {
          toast.error('Has tirado tu ropa y vas desnud@. Las gentes y autoridades pueden reaccionar mal.', { duration: 10000 });
        } else if (pos === 'pies' && getActiveClothingByPosition(updatedChar, 'pies').length === 0) {
          toast.error('Vas descalzo. El terreno irregular puede dañarte. Tirada CON/hora mientras viajes a pie.', { duration: 10000 });
        } else if (metaBefore.apiSource === 'armadura' || metaBefore.apiSource === 'armadura_piezas') {
          toast.info('Pieza de armadura tirada. CA recalculada.');
        } else if (metaBefore.apiSource === 'armas') {
          toast.warning('Has tirado un arma activa. Si te atacan te pillarán sin arma lista.', { duration: 8000 });
        }
      }

      toast.success(res.data.message);
    } catch (err) {
      console.error('Error removing equipment:', err);
      toast.error(formatApiError(err, 'Error al tirar el objeto'));
    } finally {
      setProcessing(false);
    }
  };

  // Update carrier (character or mount) for ANY equipment source.
  // Fires contextual warnings when moving ACTIVE clothing / armor / weapons to mount.
  const handleUpdateCarrier = async (itemIndex, carriedBy, source = 'inventario', itemMeta = null) => {
    // Hard gate: cannot load items onto a mount without Alforjas.
    if (carriedBy === 'montura') {
      const status = getMountUsageStatus(character);
      if (!status.canLoad) {
        toast.error(
          'No puedes cargar equipo en la montura. Necesitas Alforjas.',
          { duration: 6000 }
        );
        return;
      }
    }
    setProcessing(true);
    try {
      const res = await api.patch(`/characters/${character.id}/equipment/carry`, {
        item_index: itemIndex,
        carried_by: carriedBy,
        source,
      });

      const data = res.data || {};
      const updatedChar = data.character || data;
      // Igual que en remove: aplicar peso atómicamente desde la misma respuesta.
      onCharacterUpdate(updatedChar);
      if (data.weight_summary) {
        setWeightSummary(data.weight_summary);
      } else {
        await refreshWeight();
      }

      // Contextual warnings when moving ACTIVE items to mount
      if (carriedBy === 'montura' && data.deactivated) {
        const pos = (data.item_posicion || itemMeta?.posicion || '').toLowerCase();
        if (source === 'armas') {
          toast.warning(
            'Has retirado un arma de tu inventario personal. Si la quieres usar tendrás varios turnos perdidos para poder blandirla. Ojo si te pillan desprevenido.',
            { duration: 8000 }
          );
        } else if (source === 'armadura' || source === 'armadura_piezas') {
          toast.warning(
            'Has retirado una pieza de tu armadura. Tu CA se ha recalculado sin esta pieza.',
            { duration: 7000 }
          );
        } else if (pos === 'cuerpo') {
          // Only fire the naked warning if there are no other active cuerpo pieces
          const stillCovered = getActiveClothingByPosition(updatedChar, 'cuerpo').length > 0;
          if (!stillCovered) {
            toast.error(
              'Has retirado tu ropa y vas desnud@, puedes tener problemas con las personas que te encuentres y con las autoridades. Ves con cuidado.',
              { duration: 10000 }
            );
          }
        } else if (pos === 'pies') {
          const stillCovered = getActiveClothingByPosition(updatedChar, 'pies').length > 0;
          if (!stillCovered) {
            toast.error(
              'Vas descalzo, el terreno irregular o cualquier cosa del suelo puede dañarte. Ves con precaución. (Tirada de CON/hora mientras viajes a pie.)',
              { duration: 10000 }
            );
          }
        }
      }

      toast.success(`Equipo ${carriedBy === 'montura' ? 'movido a la montura' : 'llevado por el personaje'}`);
    } catch (err) {
      console.error('Error updating carrier:', err);
      toast.error(err.response?.data?.detail || 'Error al actualizar');
    } finally {
      setProcessing(false);
    }
  };

  // Toggle active state on clothing / armor / weapon.
  const handleToggleActive = async (itemIndex, activa, source = 'inventario', itemMeta = null) => {
    setProcessing(true);
    try {
      const res = await api.patch(`/characters/${character.id}/equipment/toggle-active`, {
        item_index: itemIndex,
        activa,
        source,
      });
      const updatedChar = res.data?.character || res.data;
      onCharacterUpdate(updatedChar);
      await refreshWeight();

      // Warnings when deactivating clothing on cuerpo/pies
      if (!activa) {
        const pos = (itemMeta?.posicion || '').toLowerCase();
        if (pos === 'cuerpo') {
          if (getActiveClothingByPosition(updatedChar, 'cuerpo').length === 0) {
            toast.error('Vas desnud@. Las gentes y autoridades pueden reaccionar mal.', { duration: 9000 });
          }
        } else if (pos === 'pies') {
          if (getActiveClothingByPosition(updatedChar, 'pies').length === 0) {
            toast.error('Vas descalzo. Tirada de CON/hora mientras viajes a pie.', { duration: 9000 });
          }
        } else if (source === 'armadura' || source === 'armadura_piezas') {
          toast.info('Pieza de armadura desactivada. CA recalculada.');
        }
      }
    } catch (err) {
      console.error('Error toggling active:', err);
      toast.error(err.response?.data?.detail || 'Error al cambiar estado');
    } finally {
      setProcessing(false);
    }
  };

  // Toggle whether the rider is mounted (jinete sobre la montura).
  // Cuando va montado, la montura carga el peso del jinete y de su equipo
  // personal — no sólo el equipo explícitamente cargado en ella.
  const handleToggleMounted = async (montado, mountId = null) => {
    // Hard gate: if trying to mount, require the rider to actually own
    // the saddle + bridle accessories (or belong to a culture that can
    // ride bareback). Previously this was only a warning.
    if (montado) {
      const status = getMountUsageStatus(character);
      if (!status.canRide) {
        toast.error(
          `No puedes montar la montura. Te faltan: ${status.missingForRide.join(' y ')}. ` +
          `(Sólo Elfo, Rohirrim o Dúnedan pueden montar sin silla/bridas.)`,
          { duration: 8000 }
        );
        return;
      }
    }
    setProcessing(true);
    try {
      const payload = { montado };
      if (mountId) payload.mount_id = mountId;
      const res = await api.patch(`/characters/${character.id}/mounted`, payload);
      const updated = res.data?.character || { ...character, montado: res.data?.montado };
      onCharacterUpdate(updated);
      await refreshWeight();
      toast.success(montado ? 'Jinete montado en la montura.' : 'Jinete a pie.');
    } catch (err) {
      console.error('Error toggling mounted:', err);
      toast.error(err.response?.data?.detail || 'Error al actualizar');
    } finally {
      setProcessing(false);
    }
  };

  // === Multi-montura CRUD ===
  const [renamingMountId, setRenamingMountId] = useState(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [mountPickerFor, setMountPickerFor] = useState(null); // { index, source, itemMeta }

  const handleRenameMount = async (mountId, newName) => {
    if (!newName || !newName.trim()) return;
    try {
      const res = await api.patch(
        `/characters/${character.id}/monturas/${mountId}`,
        { nombre_personalizado: newName.trim() }
      );
      onCharacterUpdate(res.data.character);
      toast.success('Nombre actualizado');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al renombrar');
    } finally {
      setRenamingMountId(null);
      setRenamingValue('');
    }
  };

  const handleDeleteMount = async (mountId, nombre) => {
    if (!confirm(`¿Eliminar la montura ${nombre}? El equipo cargado volverá al personaje.`)) return;
    try {
      const res = await api.delete(`/characters/${character.id}/monturas/${mountId}`);
      onCharacterUpdate(res.data.character);
      await refreshWeight();
      toast.success('Montura eliminada');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    }
  };

  // Save edited item (category/position rename)
  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setProcessing(true);
    try {
      const payload = {
        item_index: editTarget.item_index,
        source: editTarget.source || 'inventario',
      };
      if (editCategoria && editCategoria !== editTarget.categoria) payload.nueva_categoria = editCategoria;
      if (editPosicion && editPosicion !== editTarget.posicion) payload.nueva_posicion = editPosicion;
      if (!payload.nueva_categoria && !payload.nueva_posicion) {
        toast.info('No hay cambios que guardar.');
        setEditTarget(null);
        return;
      }
      const res = await api.patch(`/characters/${character.id}/equipment/edit-item`, payload);
      onCharacterUpdate(res.data?.character || res.data);
      await refreshWeight();
      toast.success('Item recategorizado.');
      setEditTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al editar');
    } finally {
      setProcessing(false);
    }
  };

  // Detect if character has a mount (either as character.montura or in inventory)
  const detectMount = useMemo(() => {
    // Helper to get mount capacity from catalog
    const getMountCapacityFromCatalog = (nombre) => {
      const monturas = catalog.monturas || [];
      const normalizedNombre = (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (const mount of monturas) {
        const catalogName = (mount.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (catalogName === normalizedNombre || normalizedNombre.includes(catalogName) || catalogName.includes(normalizedNombre)) {
          return mount.capacidad_carga || 150;
        }
      }
      return 150; // Default fallback
    };
    
    // First check character.montura
    if (character.montura?.nombre) {
      return {
        nombre: character.montura.nombre,
        capacidad: character.montura.capacidad_carga || getMountCapacityFromCatalog(character.montura.nombre),
        source: 'montura'
      };
    }
    
    // Check inventory for mount items
    const mountNames = ['caballo', 'pony', 'mula', 'burro', 'corcel', 'yegua', 'potro', 'asno'];
    const inventario = character.inventario || [];
    
    for (const item of inventario) {
      const nombre = (typeof item === 'string' ? item : item?.nombre || '').toLowerCase();
      const nombreOriginal = typeof item === 'string' ? item : item?.nombre || '';
      if (mountNames.some(m => nombre.includes(m))) {
        // Get capacity from item data OR lookup in catalog
        const itemData = typeof item === 'object' ? item : {};
        return {
          nombre: nombreOriginal,
          capacidad: itemData.capacidad_carga || getMountCapacityFromCatalog(nombreOriginal),
          source: 'inventario'
        };
      }
    }
    
    // Also check equipo_nivel_vida and equipo_trasfondo
    const otherSources = [
      ...(character.equipo_nivel_vida || []),
      ...(character.equipo_trasfondo || []),
      ...(character.equipo_ocupacion || [])
    ];
    
    for (const item of otherSources) {
      const nombre = (typeof item === 'string' ? item : item?.nombre || '').toLowerCase();
      const nombreOriginal = typeof item === 'string' ? item : item?.nombre || '';
      if (mountNames.some(m => nombre.includes(m))) {
        const itemData = typeof item === 'object' ? item : {};
        return {
          nombre: nombreOriginal,
          capacidad: itemData.capacidad_carga || getMountCapacityFromCatalog(nombreOriginal),
          source: 'equipo'
        };
      }
    }
    
    return null;
  }, [character, catalog]);

  // Check if character has a mount available
  const hasMount = detectMount !== null;
  
  // Helper to check if an item is mount-related (mount or accessory)
  const isMountRelatedItem = (nombre) => {
    const lower = (nombre || '').toLowerCase();
    const mountNames = ['caballo', 'pony', 'mula', 'burro', 'corcel', 'yegua', 'potro', 'asno'];
    const accessoryNames = ['silla de monta', 'alforjas', 'bocado', 'bridas', 'bocado y bridas', 
                           'arreos', 'barda', 'silla de montar', 'albarda', 'estribos', 'riendas', 
                           'herradura', 'manta de montar'];
    return mountNames.some(m => lower.includes(m)) || accessoryNames.some(a => lower.includes(a));
  };

  if (!isOpen) return null;

  // Get all character equipment for management tab
  const getAllEquipment = () => {
    const items = [];
    const addedWeapons = new Set();
    
    // Helper to add weapons from different sources
    const addWeapons = (armasArray, source) => {
      (armasArray || []).forEach((arma, idx) => {
        const nombre = typeof arma === 'object' ? arma.nombre : arma;
        if (!nombre || addedWeapons.has(nombre.toLowerCase())) return;
        addedWeapons.add(nombre.toLowerCase());
        
        const mejoras = typeof arma === 'object' ? (arma.mejoras || []) : [];
        const armaObj = typeof arma === 'object' ? arma : {};
        items.push({
          nombre: mejoras.length > 0 ? `${nombre} [${mejoras.join(', ')}]` : nombre,
          nombreBase: nombre,
          categoria: 'armas',
          tipo: 'Arma',
          peso: armaObj?.peso_kg || 0,
          canMove: source === 'armas', // Only weapons stored in armas[] are movable by index
          portadoPor: armaObj?.portado_por || 'personaje',
          index: idx,
          source: source === 'armas' ? 'armas' : source,
          apiSource: source === 'armas' ? 'armas' : null,
          activa: armaObj?.activa !== false,
          canToggleActive: source === 'armas',
          mejoras,
        });
      });
    };
    
    // Weapons from armas array (movibles + toggle activa)
    addWeapons(character.armas, 'armas');
    
    // Weapons from armas_elegidas (character creation) - legacy, not movible
    addWeapons(character.armas_elegidas, 'elegidas');
    
    // Process equipo_ocupacion (occupation equipment) - weapons, armor, and other items
    (character.equipo_ocupacion || []).forEach((item, idx) => {
      const nombre = typeof item === 'object' ? item.nombre : item;
      if (!nombre) return;
      const mejoras = typeof item === 'object' ? (item.mejoras || []) : [];
      const normalizedName = nombre.toLowerCase();
      
      // Check if it's a weapon
      const weaponNames = ['espada', 'daga', 'arco', 'lanza', 'hacha', 'bastón', 'baston', 'maza', 'martillo', 'ballesta', 'cimitarra', 'estoque', 'garrote', 'hoz', 'flajelo', 'piqueta', 'látigo', 'latigo'];
      const isWeapon = weaponNames.some(w => normalizedName.includes(w));
      
      // Check if it's armor
      const armorNames = ['armadura', 'cota', 'coleto', 'coraza', 'peto'];
      const isArmor = armorNames.some(a => normalizedName.includes(a));
      
      // Check if it's a shield
      const isShield = normalizedName.includes('escudo');
      
      if (isWeapon && !addedWeapons.has(normalizedName)) {
        addedWeapons.add(normalizedName);
        items.push({
          nombre: mejoras.length > 0 ? `${nombre} [${mejoras.join(', ')}]` : nombre,
          nombreBase: nombre,
          categoria: 'armas',
          tipo: 'Arma',
          peso: item?.peso_kg || 0,
          canMove: true,
          portadoPor: item?.portado_por || 'personaje',
          apiSource: 'equipo_ocupacion',
          activa: item?.activa !== false,
          canToggleActive: true,
          index: idx,
          source: 'ocupacion',
          mejoras,
        });
      } else if (isArmor) {
        items.push({
          nombre: mejoras.length > 0 ? `${nombre} [${mejoras.join(', ')}]` : nombre,
          nombreBase: nombre,
          categoria: 'armaduras',
          tipo: 'Armadura',
          peso: item?.peso_kg || 0,
          canMove: true,
          portadoPor: item?.portado_por || 'personaje',
          apiSource: 'equipo_ocupacion',
          activa: item?.activa !== false,
          canToggleActive: true,
          posicion: item?.posicion || 'cuerpo',
          index: idx,
          mejoras,
        });
      } else if (isShield) {
        items.push({
          nombre: mejoras.length > 0 ? `${nombre} [${mejoras.join(', ')}]` : nombre,
          nombreBase: nombre,
          categoria: 'escudos',
          tipo: 'Escudo',
          peso: item?.peso_kg || 0,
          canMove: true,
          portadoPor: item?.portado_por || 'personaje',
          apiSource: 'equipo_ocupacion',
          index: idx,
          mejoras,
        });
      } else if (!isWeapon && !isArmor && !isShield) {
        // Other occupation equipment (carcaj, flechas, etc.)
        items.push({
          nombre,
          nombreBase: nombre,
          categoria: 'equipo_ocupacion',
          tipo: 'Equipo Ocupación',
          peso: item?.peso_kg || 0,
          canMove: true,
          portadoPor: item?.portado_por || 'personaje',
          apiSource: 'equipo_ocupacion',
          index: idx,
        });
      }
    });
    
    // Primary armor (character.armadura) - movable + toggle activa
    const armadura = character.armadura;
    if (armadura && (typeof armadura === 'string' ? armadura : armadura.nombre)) {
      const nombre = typeof armadura === 'object' ? armadura.nombre : armadura;
      const mejoras = typeof armadura === 'object' ? (armadura.mejoras || []) : [];
      const armObj = typeof armadura === 'object' ? armadura : {};
      items.push({
        nombre: mejoras.length > 0 ? `${nombre} [${mejoras.join(', ')}]` : nombre,
        nombreBase: nombre,
        categoria: 'armaduras',
        tipo: 'Armadura',
        peso: armObj?.peso_kg || 0,
        canMove: true,
        portadoPor: armObj?.portado_por || 'personaje',
        apiSource: 'armadura',
        activa: armObj?.activa !== false,
        canToggleActive: true,
        posicion: armObj?.posicion || 'cuerpo',
        mejoras,
      });
    }
    
    // Armor pieces (brazalete, grebas…)
    (character.armadura_piezas || []).forEach((pieza, idx) => {
      if (!pieza || typeof pieza !== 'object') return;
      const nombre = pieza.nombre;
      if (!nombre) return;
      items.push({
        nombre,
        nombreBase: nombre,
        categoria: 'armaduras',
        tipo: `Pieza Armadura${pieza.ca_bonus ? ` (+${pieza.ca_bonus} CA)` : ''}`,
        peso: pieza?.peso_kg || 0,
        canMove: true,
        portadoPor: pieza?.portado_por || 'personaje',
        apiSource: 'armadura_piezas',
        activa: pieza?.activa !== false,
        canToggleActive: true,
        posicion: pieza?.posicion || 'cuerpo',
        index: idx,
      });
    });
    
    // Armor from armadura_elegida (character creation)
    if (!armadura && character.armadura_elegida) {
      const armElegida = Array.isArray(character.armadura_elegida) 
        ? character.armadura_elegida[0] 
        : character.armadura_elegida;
      if (armElegida) {
        const nombre = typeof armElegida === 'object' ? armElegida.nombre : armElegida;
        items.push({
          nombre,
          nombreBase: nombre,
          categoria: 'armaduras',
          tipo: 'Armadura',
          peso: 0,
          canMove: false,
          mejoras: [],
        });
      }
    }
    
    // Shield/Equipment
    (character.equipo || []).forEach((item, idx) => {
      const nombre = typeof item === 'object' ? item.nombre : item;
      const mejoras = typeof item === 'object' ? (item.mejoras || []) : [];
      items.push({
        nombre: mejoras.length > 0 ? `${nombre} [${mejoras.join(', ')}]` : nombre,
        nombreBase: nombre,
        categoria: nombre?.toLowerCase().includes('escudo') ? 'escudos' : 'equipo',
        tipo: nombre?.toLowerCase().includes('escudo') ? 'Escudo' : 'Equipo',
        peso: item?.peso_kg || 0,
        canMove: true,
        portadoPor: item?.portado_por || 'personaje',
        apiSource: 'equipo',
        index: idx,
        mejoras,
      });
    });
    
    // Inventory
    (character.inventario || []).forEach((item, idx) => {
      const nombre = typeof item === 'object' ? item.nombre : item;
      const cantidad = typeof item === 'object' ? item.cantidad : 1;
      const isMountItem = isMountRelatedItem(nombre);
      const isRopa = typeof item === 'object' && (item.categoria || '').toLowerCase() === 'ropa';
      const cat = typeof item === 'object' ? (item.categoria || '').toLowerCase() : '';
      const isFood = cat === 'consumibles' || cat === 'comida_posadas' || (nombre || '').toLowerCase().includes('raci');
      const peso_kg = typeof item === 'object' ? Number(item.peso_kg || 0) : 0;
      const diasComida = isFood && peso_kg > 0 ? (peso_kg * Number(cantidad || 0)) / 0.5 : null;

      // Show fractional cantidades with 2 decimals if applicable
      const cantidadDisplay = (typeof cantidad === 'number' && !Number.isInteger(cantidad))
        ? cantidad.toFixed(2)
        : cantidad;

      items.push({
        nombre: cantidad > 1 || (typeof cantidad === 'number' && cantidad !== 1) ? `${nombre} (x${cantidadDisplay})` : nombre,
        nombreBase: nombre,
        categoria: item?.categoria || 'equipo_general',
        tipo: isMountItem ? 'Montura/Accesorios' : (isRopa ? 'Ropa' : (isFood ? 'Comida' : 'Inventario')),
        peso: peso_kg * Number(cantidad || 0),
        canMove: isMountItem ? false : true,
        portadoPor: isMountItem && hasMount ? 'montura' : (item?.portado_por || 'personaje'),
        apiSource: 'inventario',
        activa: isRopa ? (item?.activa !== false) : undefined,
        canToggleActive: isRopa,
        posicion: isRopa ? (item?.posicion || 'cuerpo') : undefined,
        diasComida,
        index: idx,
        isMountItem,
        isRopa,
        isFood,
      });
    });
    
    // Mount from character.montura field (if exists separately)
    const montura = character.montura;
    if (montura && montura.nombre) {
      items.push({
        nombre: `${montura.nombre} (Cap: ${montura.capacidad_carga || 0}kg)`,
        nombreBase: montura.nombre,
        categoria: 'monturas',
        tipo: 'Montura',
        peso: 0,
        canMove: false,
        isMontura: true,
        isMountItem: true,
        capacidad: montura.capacidad_carga || 0,
      });
    }
    
    return items;
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-[hsl(var(--background))] border-[hsl(var(--gold))]/50">
        <CardHeader className="border-b border-border/30 pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl text-[hsl(var(--gold))] flex items-center gap-2">
              <Package className="w-6 h-6" />
              Gestión de Equipamiento
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Money and Weight Summary */}
          <div className="flex flex-wrap gap-3 mt-3 text-sm">
            <div className="flex items-center gap-2 bg-yellow-900/30 px-3 py-1 rounded">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-200">{getMoneyDisplay()}</span>
            </div>
            {weightSummary && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded ${
                weightSummary.estado_carga === 'muy_cargado' ? 'bg-red-900/30' :
                weightSummary.estado_carga === 'cargado' ? 'bg-orange-900/30' : 'bg-green-900/30'
              }`}>
                <User className="w-4 h-4" />
                <span>Personaje: {weightSummary.peso_personaje} / {weightSummary.limite_muy_cargado} kg</span>
                {weightSummary.estado_carga !== 'normal' && (
                  <Badge variant="destructive" className="text-xs">
                    {weightSummary.estado_carga === 'muy_cargado' ? 'Muy Cargado' : 'Cargado'}
                  </Badge>
                )}
              </div>
            )}
            {(() => {
              const monturas = character.monturas || [];
              const detalle = weightSummary?.monturas_detalle || [];
              if (monturas.length === 0 && !hasMount) return null;
              return (
                <div className="flex flex-col gap-2 bg-blue-900/30 px-3 py-2 rounded w-full lg:w-auto" data-testid="mounts-summary">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-blue-200 flex items-center gap-1">
                      <Landmark className="w-3.5 h-3.5" /> Monturas
                    </span>
                    <button
                      className="text-[11px] text-blue-300 hover:text-blue-200 underline"
                      onClick={async () => {
                        const nombre = prompt('Especie de la montura (ej. "Poni de Bree"):', 'Poni de Bree');
                        if (!nombre) return;
                        const alias = prompt('Nombre personalizado para esta montura:', nombre);
                        try {
                          const res = await api.post(`/characters/${character.id}/monturas`, {
                            nombre_original: nombre,
                            nombre_personalizado: alias || nombre,
                            capacidad_carga: 150,
                            velocidad: 12,
                          });
                          onCharacterUpdate(res.data.character);
                          await refreshWeight();
                          toast.success('Montura añadida');
                        } catch (e) {
                          toast.error(e.response?.data?.detail || 'Error');
                        }
                      }}
                      data-testid="add-mount-btn"
                    >
                      + Añadir
                    </button>
                  </div>
                  {monturas.map((m) => {
                    const det = detalle.find((d) => d.id === m.id) || {};
                    const isRenaming = renamingMountId === m.id;
                    const rides = !!m.es_jinete_activo && !!character.montado;
                    return (
                      <div key={m.id} className="flex items-center gap-2 text-xs flex-wrap" data-testid={`mount-row-${m.id}`}>
                        {isRenaming ? (
                          <>
                            <Input
                              autoFocus
                              value={renamingValue}
                              onChange={(e) => setRenamingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameMount(m.id, renamingValue);
                                if (e.key === 'Escape') { setRenamingMountId(null); setRenamingValue(''); }
                              }}
                              className="h-6 w-40 text-xs"
                              data-testid={`rename-input-${m.id}`}
                            />
                            <button onClick={() => handleRenameMount(m.id, renamingValue)} className="text-emerald-400 text-[11px]">✓</button>
                            <button onClick={() => { setRenamingMountId(null); setRenamingValue(''); }} className="text-gray-400 text-[11px]">✕</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setRenamingMountId(m.id); setRenamingValue(m.nombre_personalizado || m.nombre_original); }}
                              className="font-medium text-blue-100 hover:text-white underline-offset-2 hover:underline"
                              title="Renombrar"
                              data-testid={`mount-name-${m.id}`}
                            >
                              {m.nombre_personalizado || m.nombre_original}
                            </button>
                            <span className="text-[10px] text-blue-300 italic">({m.nombre_original})</span>
                          </>
                        )}
                        {det.capacidad > 0 && (
                          <span className={det.sobrecargada ? 'text-red-300 font-bold' : 'text-blue-200'}>
                            {Math.round(det.peso_cargado || 0)}/{det.capacidad} kg
                            {det.sobrecargada && <span className="ml-1">⚠️</span>}
                          </span>
                        )}
                        <label className="flex items-center gap-1 cursor-pointer select-none ml-auto">
                          <input
                            type="checkbox"
                            checked={rides}
                            onChange={(e) => handleToggleMounted(e.target.checked, m.id)}
                            disabled={processing}
                            className="rounded border-blue-400/40 bg-blue-900/40 text-blue-400"
                            data-testid={`ride-toggle-${m.id}`}
                          />
                          <span className="text-blue-200 text-[11px]">montado aquí</span>
                        </label>
                        <button
                          onClick={() => handleDeleteMount(m.id, m.nombre_personalizado || m.nombre_original)}
                          className="text-red-400 hover:text-red-300 text-[11px]"
                          title="Eliminar montura"
                          data-testid={`delete-mount-${m.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </CardHeader>
        
        <CardContent className="p-4 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
            </div>
          ) : false ? (
            /* ADD EQUIPMENT TAB */
            <div className="grid grid-cols-12 gap-4 h-[60vh]">
              {/* Category Selection */}
              <div className="col-span-3 border-r border-border/30 pr-4">
                <h4 className="font-medium mb-2 text-sm text-muted-foreground">Categorías</h4>
                <ScrollArea className="h-[55vh]">
                  {Object.entries(CATEGORY_GROUPS).map(([group, categories]) => (
                    <div key={group} className="mb-2">
                      <button
                        onClick={() => toggleGroup(group)}
                        className="flex items-center gap-1 w-full text-left py-1 text-sm font-medium text-[hsl(var(--gold))]"
                      >
                        {expandedGroups[group] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {group}
                      </button>
                      {expandedGroups[group] && (
                        <div className="ml-4 space-y-1">
                          {categories.map(cat => (
                            <button
                              key={cat}
                              onClick={() => {
                                setSelectedCategory(cat);
                                setSelectedItem(null);
                              }}
                              className={`w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                                selectedCategory === cat
                                  ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]'
                                  : 'hover:bg-secondary/50'
                              }`}
                            >
                              {CATEGORY_NAMES[cat] || cat}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({catalog[cat]?.length || 0})
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </ScrollArea>
              </div>
              
              {/* Item List */}
              <div className="col-span-5">
                <div className="mb-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {characterRegion && (
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer" data-testid="shop-region-filter-toggle">
                      <input
                        type="checkbox"
                        checked={filterByRegion}
                        onChange={(e) => setFilterByRegion(e.target.checked)}
                        className="accent-[hsl(var(--gold))]"
                      />
                      <span>
                        Sólo objetos disponibles en <span className="text-cyan-300 font-semibold">{characterRegion}</span>
                      </span>
                    </label>
                  )}
                </div>
                <ScrollArea className="h-[50vh]">
                  <div className="space-y-1">
                    {filteredItems.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedItem(item)}
                        className={`w-full text-left p-2 rounded border transition-all ${
                          selectedItem?.nombre === item.nombre
                            ? 'bg-[hsl(var(--gold))]/20 border-[hsl(var(--gold))]'
                            : 'bg-black/20 border-border/30 hover:border-[hsl(var(--gold))]/50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-sm">{item.nombre}</span>
                          {item.precio > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {item.precio} {item.moneda || 'mp'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                          {item.peso_kg > 0 && <span>{item.peso_kg} kg</span>}
                          {item.dano && <span>Daño: {item.dano}</span>}
                          {item.ca && <span>CA: +{item.ca}</span>}
                          {item.capacidad_carga && <span>Carga: {item.capacidad_carga} kg</span>}
                        </div>
                        {item.efecto && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.efecto}</p>
                        )}
                      </button>
                    ))}
                    {filteredItems.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No se encontraron items</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
              
              {/* Add Form */}
              <div className="col-span-4 border-l border-border/30 pl-4">
                <h4 className="font-medium mb-3 text-[hsl(var(--gold))]">Añadir Item</h4>
                {selectedItem ? (
                  <ScrollArea className="h-[55vh]">
                  <div className="space-y-4 pr-2">
                    <div className="p-3 bg-secondary/30 rounded">
                      <h5 className="font-medium">{selectedItem.nombre}</h5>
                      <div className="text-sm text-muted-foreground mt-1 space-y-1">
                        {selectedItem.precio > 0 && <p>Precio base: {selectedItem.precio} {selectedItem.moneda || 'mp'}</p>}
                        {selectedItem.peso_kg > 0 && <p>Peso: {selectedItem.peso_kg} kg</p>}
                        {selectedItem.dano && <p>Daño: {selectedItem.dano}</p>}
                        {selectedItem.ca && <p>CA: +{selectedItem.ca}</p>}
                        {selectedItem.capacidad_carga && <p>Capacidad: {selectedItem.capacidad_carga} kg</p>}
                      </div>
                    </div>
                    
                    <div>
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        value={cantidad}
                        onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                        className="mt-1"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Tipo de adquisición</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={isPurchase ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setIsPurchase(true)}
                          className={isPurchase ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                        >
                          <ShoppingCart className="w-4 h-4 mr-1" />
                          Comprar
                        </Button>
                        <Button
                          variant={!isPurchase ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setIsPurchase(false)}
                          className={!isPurchase ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                          <Gift className="w-4 h-4 mr-1" />
                          Regalo/Tesoro
                        </Button>
                      </div>
                    </div>
                    
                    {/* Price Modifiers - Only show when purchasing */}
                    {isPurchase && selectedItem.precio > 0 && priceModifiers && (
                      <div className="space-y-2 border border-border/30 rounded p-3">
                        <button 
                          onClick={() => setShowModifiers(!showModifiers)}
                          className="flex items-center gap-2 w-full text-left text-sm font-medium text-[hsl(var(--gold))]"
                        >
                          {showModifiers ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          Modificadores de Precio ({(calculateTotalModifier() * 100).toFixed(0)}%)
                        </button>
                        
                        {showModifiers && (
                          <div className="space-y-3 mt-2">
                            {/* Region */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Región</Label>
                              <select 
                                className="w-full mt-1 bg-secondary/50 border border-border/30 rounded p-2 text-sm"
                                value={selectedModifiers.region?.nombre || ''}
                                onChange={(e) => {
                                  const mod = priceModifiers.region.find(m => m.nombre === e.target.value);
                                  setSelectedModifiers(prev => ({ ...prev, region: mod || null }));
                                }}
                              >
                                <option value="">Sin modificador (100%)</option>
                                {priceModifiers.region.map((m, i) => (
                                  <option key={i} value={m.nombre}>{m.nombre} ({(m.modificador * 100).toFixed(0)}%)</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Settlement */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Asentamiento</Label>
                              <select 
                                className="w-full mt-1 bg-secondary/50 border border-border/30 rounded p-2 text-sm"
                                value={selectedModifiers.asentamiento?.nombre || ''}
                                onChange={(e) => {
                                  const mod = priceModifiers.asentamiento.find(m => m.nombre === e.target.value);
                                  setSelectedModifiers(prev => ({ ...prev, asentamiento: mod || null }));
                                }}
                              >
                                <option value="">Sin modificador (100%)</option>
                                {priceModifiers.asentamiento.map((m, i) => (
                                  <option key={i} value={m.nombre}>{m.nombre} ({(m.modificador * 100).toFixed(0)}%)</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Relationship */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Relación con el vendedor</Label>
                              <select 
                                className="w-full mt-1 bg-secondary/50 border border-border/30 rounded p-2 text-sm"
                                value={selectedModifiers.relacion?.nombre || ''}
                                onChange={(e) => {
                                  const mod = priceModifiers.relacion.find(m => m.nombre === e.target.value);
                                  setSelectedModifiers(prev => ({ ...prev, relacion: mod || null }));
                                }}
                              >
                                <option value="">Sin modificador (100%)</option>
                                {priceModifiers.relacion.map((m, i) => (
                                  <option key={i} value={m.nombre}>{m.nombre} ({(m.modificador * 100).toFixed(0)}%)</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Context */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Contexto histórico</Label>
                              <select 
                                className="w-full mt-1 bg-secondary/50 border border-border/30 rounded p-2 text-sm"
                                value={selectedModifiers.contexto?.nombre || ''}
                                onChange={(e) => {
                                  const mod = priceModifiers.contexto.find(m => m.nombre === e.target.value);
                                  setSelectedModifiers(prev => ({ ...prev, contexto: mod || null }));
                                }}
                              >
                                <option value="">Sin modificador (100%)</option>
                                {priceModifiers.contexto.map((m, i) => (
                                  <option key={i} value={m.nombre}>{m.nombre} ({(m.modificador * 100).toFixed(0)}%)</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isPurchase && selectedItem.precio > 0 && (
                      <div className={`p-3 rounded ${canAfford() ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                        <div className="text-sm space-y-1">
                          <p><span className="text-muted-foreground">Base:</span> {getTotalPrice()?.precioBase} {getTotalPrice()?.moneda}</p>
                          {getTotalPrice()?.modifier !== 1 && (
                            <p><span className="text-muted-foreground">Modificador:</span> x{getTotalPrice()?.modifier.toFixed(2)} ({(getTotalPrice()?.modifier * 100).toFixed(0)}%)</p>
                          )}
                          <p className="font-bold text-base">
                            <strong>Total:</strong> {getTotalPrice()?.precioFinal} {getTotalPrice()?.moneda}
                          </p>
                        </div>
                        {!canAfford() && (
                          <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            Dinero insuficiente
                          </p>
                        )}
                      </div>
                    )}
                    
                    <Button
                      onClick={handleAddEquipment}
                      disabled={processing || (isPurchase && !canAfford())}
                      className="w-full bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black"
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : isPurchase ? (
                        <ShoppingCart className="w-4 h-4 mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      {isPurchase ? 'Comprar' : 'Añadir'} {selectedItem.nombre}
                    </Button>
                  </div>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Selecciona un item de la lista para añadirlo.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* MANAGE EQUIPMENT TAB — nuevo diseño + legacy plegable */
            <div className="h-[78vh] overflow-y-auto pr-2" data-testid="equipment-manage-tab">
              <DistributionView
                character={character}
                weightSummary={weightSummary}
                chestsApi={chestsApi}
                catalogWeights={catalogWeights}
                onMoveItem={handleDistributionMove}
                processing={processing}
              />

              <details className="mt-4 border border-border/30 rounded p-3 bg-black/10">
                <summary className="cursor-pointer text-sm text-[hsl(var(--gold))] font-medium">
                  Detalles avanzados (renombrar montura, gestionar piezas, tirar al camino…)
                </summary>
                <div className="mt-3 h-[55vh]">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {getAllEquipment().length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      El personaje no tiene equipamiento
                    </p>
                  ) : (
                    getAllEquipment().map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-black/20 rounded border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          {item.tipo === 'Arma' && <Sword className="w-4 h-4 text-red-400" />}
                          {item.tipo === 'Armadura' && <Shield className="w-4 h-4 text-blue-400" />}
                          {item.tipo === 'Escudo' && <Shield className="w-4 h-4 text-green-400" />}
                          {!['Arma', 'Armadura', 'Escudo'].includes(item.tipo) && <Package className="w-4 h-4 text-gray-400" />}
                          <div>
                            <span className="font-medium">{item.nombre}</span>
                            <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">{item.tipo}</Badge>
                              {item.peso > 0 && <span>{item.peso.toFixed(2)} kg</span>}
                              {item.diasComida != null && item.diasComida > 0 && (
                                <span className="text-emerald-300" data-testid={`dias-comida-${item.nombreBase}`}>
                                  🍞 {item.diasComida.toFixed(2)} días comida
                                </span>
                              )}
                            </div>
                            {/* Comments — shown in player sheet ONLY (per
                                user request). Empty comments render as a
                                discreet em-dash. */}
                            <div
                              className="text-xs italic text-amber-100/70 mt-0.5"
                              data-testid={`item-comentarios-${item.nombreBase}`}
                            >
                              {item.comentarios?.trim() ? item.comentarios : '—'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Active/Inactive toggle for clothing, armor, weapons */}
                          {item.canToggleActive && (
                            <button
                              onClick={() => handleToggleActive(item.index, !item.activa, item.apiSource, item)}
                              disabled={processing}
                              title={item.activa ? 'Desactivar (guardar)' : 'Activar (ponerse / empuñar)'}
                              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                                item.activa
                                  ? 'bg-emerald-700/40 text-emerald-300 hover:bg-emerald-700/60'
                                  : 'bg-gray-700/40 text-gray-400 hover:bg-gray-700/60'
                              }`}
                              data-testid={`toggle-active-${item.nombreBase}`}
                            >
                              {item.activa ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                              {item.activa ? 'Activa' : 'Guardada'}
                              {item.posicion && <span className="text-[10px] italic">· {item.posicion}</span>}
                            </button>
                          )}

                          {/* Mount items indicator - always on mount, no toggle */}
                          {item.isMountItem && hasMount && (
                            <div className="flex items-center gap-1 bg-blue-900/50 rounded p-1 px-2">
                              <Landmark className="w-4 h-4 text-blue-400" />
                              <span className="text-xs text-blue-400">En montura</span>
                            </div>
                          )}

                          {/* Mount items without mount - show person indicator */}
                          {item.isMountItem && !hasMount && (
                            <div className="flex items-center gap-1 bg-amber-900/30 rounded p-1 px-2">
                              <User className="w-4 h-4 text-amber-400" />
                              <span className="text-xs text-amber-400">Sin montura</span>
                            </div>
                          )}

                          {/* Carrier toggle for any moveable item (weapons/armor/inventory) */}
                          {item.canMove && !item.isMountItem && hasMount && (
                            <div className="flex items-center gap-1 bg-secondary/50 rounded p-1">
                              <button
                                onClick={() => handleUpdateCarrier(item.index, 'personaje', item.apiSource || 'inventario', item)}
                                disabled={processing}
                                className={`p-1 rounded ${
                                  item.portadoPor !== 'montura' ? 'bg-[hsl(var(--gold))]/30' : 'hover:bg-secondary'
                                }`}
                                title="Llevado por personaje"
                                data-testid={`carry-personaje-${item.nombreBase}`}
                              >
                                <User className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  const mounts = character.monturas || [];
                                  if (mounts.length > 1) {
                                    setMountPickerFor({ index: item.index, source: item.apiSource || 'inventario', itemMeta: item });
                                  } else {
                                    handleUpdateCarrier(item.index, 'montura', item.apiSource || 'inventario', item);
                                  }
                                }}
                                disabled={processing}
                                className={`p-1 rounded ${
                                  item.portadoPor === 'montura' ? 'bg-blue-600/30' : 'hover:bg-secondary'
                                }`}
                                title={`Llevado por ${detectMount?.nombre || 'montura'}`}
                                data-testid={`carry-montura-${item.nombreBase}`}
                              >
                                <Landmark className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDiscardTarget({
                              nombreBase: item.nombreBase || item.nombre,
                              categoria: item.categoria,
                              activa: item.activa,
                              posicion: item.posicion,
                              apiSource: item.apiSource,
                            })}
                            disabled={processing}
                            title="Tirar al camino"
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                            data-testid={`discard-${item.nombreBase}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
                </div>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mount picker: choose which mount to load the item onto */}
      <AlertDialog open={!!mountPickerFor} onOpenChange={(open) => !open && setMountPickerFor(null)}>
        <AlertDialogContent className="bg-[hsl(var(--background))] border-blue-500/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-blue-300 flex items-center gap-2">
              <Landmark className="w-5 h-5" />
              ¿A qué montura lo cargas?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Elige la montura que cargará <strong className="text-foreground">{mountPickerFor?.itemMeta?.nombreBase}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            {(character.monturas || []).map((m) => {
              const det = (weightSummary?.monturas_detalle || []).find((d) => d.id === m.id) || {};
              return (
                <button
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded border border-blue-500/30 bg-blue-900/20 px-3 py-2 text-sm hover:bg-blue-900/40 transition-colors"
                  data-testid={`mount-picker-${m.id}`}
                  onClick={() => {
                    const picker = mountPickerFor;
                    setMountPickerFor(null);
                    if (picker) {
                      // Hard gate: requires Alforjas to load on a mount.
                      const status = getMountUsageStatus(character);
                      if (!status.canLoad) {
                        toast.error('No puedes cargar equipo en la montura. Necesitas Alforjas.', { duration: 6000 });
                        return;
                      }
                      // Include mount_id in call via custom handler
                      (async () => {
                        setProcessing(true);
                        try {
                          const res = await api.patch(`/characters/${character.id}/equipment/carry`, {
                            item_index: picker.index,
                            carried_by: 'montura',
                            source: picker.source,
                            mount_id: m.id,
                          });
                          onCharacterUpdate(res.data?.character || res.data);
                          await refreshWeight();
                          toast.success(`Cargado en ${m.nombre_personalizado || m.nombre_original}`);
                        } catch (e) {
                          toast.error(e.response?.data?.detail || 'Error');
                        } finally {
                          setProcessing(false);
                        }
                      })();
                    }
                  }}
                >
                  <span className="font-medium text-blue-100">{m.nombre_personalizado || m.nombre_original}</span>
                  {det.capacidad > 0 && (
                    <span className={det.sobrecargada ? 'text-red-300' : 'text-blue-300'}>
                      {Math.round(det.peso_cargado || 0)}/{det.capacidad} kg
                      {det.sobrecargada && ' ⚠️'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="mount-picker-cancel">Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Editar / recategorizar item */}
      <AlertDialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <AlertDialogContent className="bg-[hsl(var(--background))] border-blue-500/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-blue-300 flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Editar / mover de bloque
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Cambia la categoría o la posición de
              {' '}<strong className="text-foreground">{editTarget?.nombreBase}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Categoría / bloque</label>
              <select
                value={editCategoria}
                onChange={(e) => setEditCategoria(e.target.value)}
                className="w-full bg-background/40 border border-[hsl(var(--gold))/40] rounded px-3 py-2 text-sm"
                data-testid="edit-categoria-select"
              >
                <option value="equipo_general">Equipo General</option>
                <option value="herramientas">Herramientas</option>
                <option value="juegos">Juegos</option>
                <option value="instrumentos_musicales">Instrumentos Musicales</option>
                <option value="ropa">Ropa</option>
                <option value="consumibles">Consumibles</option>
                <option value="comida_posadas">Comida en Posadas</option>
                <option value="hierbas">Hierbas y Pociones</option>
                <option value="venenos">Venenos</option>
                <option value="accesorios_monturas">Accesorios de Montura</option>
                <option value="transporte_terrestre">Transporte Terrestre</option>
              </select>
            </div>
            {editCategoria === 'ropa' && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Posición (sólo Ropa)</label>
                <select
                  value={editPosicion || 'cuerpo'}
                  onChange={(e) => setEditPosicion(e.target.value)}
                  className="w-full bg-background/40 border border-[hsl(var(--gold))/40] rounded px-3 py-2 text-sm"
                  data-testid="edit-posicion-select"
                >
                  <option value="cabeza">Cabeza</option>
                  <option value="cuerpo">Cuerpo</option>
                  <option value="brazos">Brazos</option>
                  <option value="piernas">Piernas</option>
                  <option value="pies">Pies</option>
                </select>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="edit-cancel">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="edit-confirm"
            >
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Tirar al camino */}
      <AlertDialog open={!!discardTarget} onOpenChange={(open) => !open && setDiscardTarget(null)}>
        <AlertDialogContent className="bg-[hsl(var(--background))] border-red-500/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              ¿Tirar al camino?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground space-y-2">
              <span className="block">
                Vas a tirar <strong className="text-foreground">{discardTarget?.nombreBase}</strong> al
                camino. Esta acción no se puede deshacer: perderás el objeto definitivamente.
              </span>
              {discardTarget?.activa && (discardTarget?.posicion === 'cuerpo') && (
                <span className="block text-red-300">
                  ⚠️ Esta pieza te cubre el cuerpo. Si la tiras y no llevas otra ropa activa,
                  <strong> irás desnud@</strong>.
                </span>
              )}
              {discardTarget?.activa && (discardTarget?.posicion === 'pies') && (
                <span className="block text-red-300">
                  ⚠️ Esta pieza te cubre los pies. Si la tiras y no llevas otro calzado,
                  <strong> irás descalzo</strong> (tirada CON/hora al viajar a pie).
                </span>
              )}
              {discardTarget?.activa && discardTarget?.apiSource === 'armas' && (
                <span className="block text-red-300">
                  ⚠️ Esta arma está activa. Te quedarás sin arma lista y tardarás turnos en empuñar otra.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="discard-cancel">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = discardTarget;
                setDiscardTarget(null);
                if (target) handleRemoveEquipment(target.nombreBase, target.categoria, target);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="discard-confirm"
            >
              Tirarlo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EquipmentManagerModal;
