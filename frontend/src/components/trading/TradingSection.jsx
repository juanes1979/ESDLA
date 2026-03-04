/**
 * Trading System - Main Component
 * Comprehensive buy/sell system with NPC generation, relationship tracking, and dynamic pricing
 */
import React, { useState, useEffect } from 'react';
import { Loader2, Settings, Calculator, Users, History, Coins, Package } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import api from '@/services/api';

// Sub-components
import TradingCalculator from './TradingCalculator';
import TradingConfigEditor from './TradingConfigEditor';
import NPCManager from './NPCManager';
import NPCTemplatesEditor from './NPCTemplatesEditor';

const TradingSection = ({ isAdmin }) => {
  const [activeTab, setActiveTab] = useState('calculator');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState([]);
  const [locations, setLocations] = useState([]);
  const [characters, setCharacters] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load all necessary data in parallel
      const [configRes, equipRes, locRes, charRes] = await Promise.all([
        api.get('/trading/config'),
        api.get('/data/equipment'),
        api.get('/data/locations'),
        api.get('/characters')
      ]);
      
      setConfig(configRes.data);
      setEquipment(equipRes.data?.equipment || equipRes.data || []);
      setLocations(locRes.data?.locations || []);
      setCharacters(charRes.data?.characters || []);
      
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const reloadConfig = async () => {
    try {
      const res = await api.get('/trading/config');
      setConfig(res.data);
    } catch (err) {
      console.error('Error reloading config:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading text-[hsl(var(--gold))]">
            Sistema de Compra-Venta
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Negociación dinámica con PNJs, precios contextuales y relaciones
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-black/40 border border-gray-700">
          <TabsTrigger 
            value="calculator" 
            className="data-[state=active]:bg-[hsl(var(--gold))]/20 data-[state=active]:text-[hsl(var(--gold))]"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Calculadora
          </TabsTrigger>
          <TabsTrigger 
            value="npcs" 
            className="data-[state=active]:bg-[hsl(var(--magic-blue))]/20 data-[state=active]:text-[hsl(var(--magic-blue))]"
          >
            <Users className="h-4 w-4 mr-2" />
            PNJs
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger 
              value="config" 
              className="data-[state=active]:bg-[hsl(var(--torch-orange))]/20 data-[state=active]:text-[hsl(var(--torch-orange))]"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configuración
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger 
              value="templates" 
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
            >
              <Package className="h-4 w-4 mr-2" />
              Plantillas PNJ
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="calculator" className="mt-4">
          <TradingCalculator 
            config={config} 
            equipment={equipment}
            locations={locations}
            characters={characters}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="npcs" className="mt-4">
          <NPCManager 
            config={config}
            locations={locations}
            characters={characters}
            isAdmin={isAdmin}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="config" className="mt-4">
            <TradingConfigEditor 
              config={config} 
              onConfigUpdate={reloadConfig}
            />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="templates" className="mt-4">
            <NPCTemplatesEditor />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default TradingSection;
