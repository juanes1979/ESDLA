/**
 * Equipment Rewards Modal Component
 * Allows applying rewards/upgrades to character equipment
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Crown, Sword, Shield, Check, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

const EquipmentRewardsModal = ({
  isOpen,
  onClose,
  character,
  onCharacterUpdate,
}) => {
  const [mejoras, setMejoras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [selectedMejora, setSelectedMejora] = useState(null);
  const [applying, setApplying] = useState(false);

  // Load available rewards
  useEffect(() => {
    const loadMejoras = async () => {
      try {
        setLoading(true);
        const res = await api.get('/data/recompensas');
        setMejoras(res.data?.mejoras || []);
      } catch (err) {
        console.error('Error loading rewards:', err);
        toast.error('Error al cargar recompensas');
      } finally {
        setLoading(false);
      }
    };
    
    if (isOpen) {
      loadMejoras();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Get character's equipment (weapons, armor, items)
  const getEquipmentList = () => {
    const equipment = [];
    
    // Weapons
    const weapons = character?.armas || [];
    weapons.forEach((arma, idx) => {
      if (arma?.nombre) {
        equipment.push({
          id: `arma_${idx}`,
          nombre: arma.nombre,
          tipo: 'arma',
          mejoras_aplicadas: arma.mejoras || [],
          data: arma,
          index: idx,
        });
      }
    });
    
    // Armor
    if (character?.armadura?.nombre) {
      equipment.push({
        id: 'armadura',
        nombre: character.armadura.nombre,
        tipo: 'armadura',
        mejoras_aplicadas: character.armadura.mejoras || [],
        data: character.armadura,
      });
    }
    
    // Shield (if exists in equipment)
    const equipoList = character?.equipo || [];
    equipoList.forEach((item, idx) => {
      if (item?.nombre?.toLowerCase().includes('escudo')) {
        equipment.push({
          id: `escudo_${idx}`,
          nombre: item.nombre,
          tipo: 'escudo',
          mejoras_aplicadas: item.mejoras || [],
          data: item,
          index: idx,
        });
      }
    });
    
    return equipment;
  };

  // Get applicable rewards for selected equipment
  const getApplicableMejoras = () => {
    if (!selectedEquipment) return [];
    
    return mejoras.filter(mejora => {
      const tipoMejora = mejora.tipo?.toLowerCase() || '';
      const tiposAplicables = mejora.tipos_aplicables || [];
      
      if (selectedEquipment.tipo === 'arma') {
        return tipoMejora === 'arma' || tiposAplicables.some(t => t.toLowerCase().includes('arma'));
      }
      if (selectedEquipment.tipo === 'armadura') {
        return tipoMejora === 'armadura' || tiposAplicables.some(t => t.toLowerCase().includes('armadura'));
      }
      if (selectedEquipment.tipo === 'escudo') {
        return tipoMejora === 'escudo' || tiposAplicables.some(t => t.toLowerCase().includes('escudo'));
      }
      return false;
    });
  };

  // Apply reward to equipment
  const applyMejora = async () => {
    if (!selectedEquipment || !selectedMejora) return;
    
    setApplying(true);
    
    try {
      // Call the dedicated endpoint for applying rewards
      const payload = {
        equipment_type: selectedEquipment.tipo,
        equipment_index: selectedEquipment.index ?? null,
        mejora_nombre: selectedMejora.nombre,
        mejora_efecto: selectedMejora.efecto || null,
      };
      
      const res = await api.post(`/characters/${character.id}/equipment/apply-reward`, payload);
      
      toast.success(`Mejora "${selectedMejora.nombre}" aplicada a ${selectedEquipment.nombre}`);
      
      // Update parent component with returned character data
      if (onCharacterUpdate && res.data) {
        onCharacterUpdate(res.data);
      }
      
      // Reset selection
      setSelectedEquipment(null);
      setSelectedMejora(null);
      
    } catch (err) {
      console.error('Error applying reward:', err);
      const errorMsg = err.response?.data?.detail || 'Error al aplicar la mejora';
      toast.error(errorMsg);
    } finally {
      setApplying(false);
    }
  };

  const equipmentList = getEquipmentList();
  const applicableMejoras = getApplicableMejoras();

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-[hsl(var(--background))] border-[hsl(var(--gold))]/50">
        <CardHeader className="border-b border-border/30">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl text-[hsl(var(--gold))] flex items-center gap-2">
              <Crown className="w-6 h-6" />
              Aplicar Recompensas al Equipamiento
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Equipment Selection */}
              <div className="space-y-4">
                <h3 className="font-heading text-lg text-[hsl(var(--gold))]">
                  1. Selecciona Equipamiento
                </h3>
                
                {equipmentList.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Este personaje no tiene equipamiento mejorable.
                  </p>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {equipmentList.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSelectedEquipment(item);
                            setSelectedMejora(null);
                          }}
                          className={`w-full text-left p-3 rounded border transition-all ${
                            selectedEquipment?.id === item.id
                              ? 'bg-[hsl(var(--gold))]/20 border-[hsl(var(--gold))]'
                              : 'bg-black/20 border-border/30 hover:border-[hsl(var(--gold))]/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {item.tipo === 'arma' && <Sword className="w-4 h-4 text-red-400" />}
                            {item.tipo === 'armadura' && <Shield className="w-4 h-4 text-blue-400" />}
                            {item.tipo === 'escudo' && <Shield className="w-4 h-4 text-green-400" />}
                            <span className="font-medium">{item.nombre}</span>
                            <Badge variant="outline" className="text-xs">
                              {item.tipo}
                            </Badge>
                          </div>
                          
                          {item.mejoras_aplicadas?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.mejoras_aplicadas.map((m, idx) => (
                                <Badge key={idx} className="text-xs bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]">
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  {m}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
              
              {/* Rewards Selection */}
              <div className="space-y-4">
                <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))]">
                  2. Selecciona Mejora
                </h3>
                
                {!selectedEquipment ? (
                  <p className="text-muted-foreground text-sm">
                    Primero selecciona un equipo a mejorar.
                  </p>
                ) : applicableMejoras.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No hay mejoras disponibles para este tipo de equipo.
                  </p>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {applicableMejoras.map((mejora, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedMejora(mejora)}
                          className={`w-full text-left p-3 rounded border transition-all ${
                            selectedMejora?.nombre === mejora.nombre
                              ? 'bg-[hsl(var(--torch-orange))]/20 border-[hsl(var(--torch-orange))]'
                              : 'bg-black/20 border-border/30 hover:border-[hsl(var(--torch-orange))]/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4 text-[hsl(var(--gold))]" />
                            <span className="font-medium">{mejora.nombre}</span>
                          </div>
                          
                          {mejora.efecto && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {mejora.efecto}
                            </p>
                          )}
                          
                          {mejora.restricciones && (
                            <p className="mt-1 text-xs text-yellow-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {mejora.restricciones}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border/30">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={applyMejora}
              disabled={!selectedEquipment || !selectedMejora || applying}
              className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black"
            >
              {applying ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Aplicar Mejora
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EquipmentRewardsModal;
