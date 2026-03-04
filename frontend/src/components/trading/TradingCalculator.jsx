/**
 * Trading Calculator - The main buy/sell calculator
 */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, Coins, ShoppingCart, TrendingUp, TrendingDown, 
  User, MapPin, Building, History, Sparkles, Dice6, RefreshCw,
  Check, X, MessageSquare, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

const TradingCalculator = ({ config, equipment, locations, characters, isAdmin }) => {
  // Form state
  const [modo, setModo] = useState('compra');
  const [articulo, setArticulo] = useState(null);
  const [articuloSearch, setArticuloSearch] = useState('');
  const [precioBase, setPrecioBase] = useState(0);
  const [bendicion, setBendicion] = useState('ninguna');
  const [categoria, setCategoria] = useState('general');
  
  const [ubicacion, setUbicacion] = useState('');
  const [region, setRegion] = useState('');
  const [tipoAsentamiento, setTipoAsentamiento] = useState('');
  const [contextoHistorico, setContextoHistorico] = useState('');
  
  const [relacion, setRelacion] = useState('neutral');
  const [perfilComerciante, setPerfilComerciante] = useState('normal');
  
  const [oferta, setOferta] = useState(0);
  
  // Modifiers (from price_modifiers system)
  const [modRegion, setModRegion] = useState(0);
  const [modAsentamiento, setModAsentamiento] = useState(0);
  
  // Result state
  const [resultado, setResultado] = useState(null);
  const [calculating, setCalculating] = useState(false);

  // Filter equipment for autocomplete
  const filteredEquipment = useMemo(() => {
    if (!articuloSearch || articuloSearch.length < 2) return [];
    const search = articuloSearch.toLowerCase();
    return equipment.filter(e => 
      e.nombre?.toLowerCase().includes(search) ||
      e.nombre_es?.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [equipment, articuloSearch]);

  // Categories from equipment
  const categorias = useMemo(() => {
    const cats = new Set();
    equipment.forEach(e => {
      if (e.categoria) cats.add(e.categoria);
      if (e.tipo) cats.add(e.tipo);
    });
    return ['general', 'armas', 'armadura', 'lujo', 'comida', ...Array.from(cats)];
  }, [equipment]);

  // Select article
  const selectArticulo = (item) => {
    setArticulo(item);
    setArticuloSearch(item.nombre || item.nombre_es || '');
    setPrecioBase(item.precio || item.coste || 0);
    setCategoria(item.categoria || item.tipo || 'general');
    setBendicion('ninguna');
  };

  // Calculate trade
  const calcularTransaccion = async () => {
    if (!precioBase || precioBase <= 0) {
      toast.error('Introduce un precio base válido');
      return;
    }
    if (!oferta || oferta <= 0) {
      toast.error('Introduce una oferta válida');
      return;
    }

    try {
      setCalculating(true);
      
      const params = {
        articulo: {
          nombre: articulo?.nombre || articuloSearch || 'Artículo',
          precio_base: parseFloat(precioBase),
          categoria: categoria,
          bendicion: bendicion
        },
        modificador_region: parseFloat(modRegion) || 0,
        modificador_asentamiento: parseFloat(modAsentamiento) || 0,
        contexto_historico: contextoHistorico,
        relacion: relacion,
        oferta: parseFloat(oferta),
        modo: modo,
        perfil_comerciante: perfilComerciante
      };

      const response = await api.post('/trading/calculate', params);
      setResultado(response.data);
      
    } catch (err) {
      console.error('Error calculating trade:', err);
      toast.error('Error al calcular transacción');
    } finally {
      setCalculating(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setArticulo(null);
    setArticuloSearch('');
    setPrecioBase(0);
    setBendicion('ninguna');
    setOferta(0);
    setResultado(null);
  };

  // Get result color and icon
  const getResultStyle = (tipo) => {
    switch (tipo) {
      case 'acepta':
        return { color: 'text-green-400', bg: 'bg-green-900/30', icon: Check };
      case 'rechaza':
        return { color: 'text-red-400', bg: 'bg-red-900/30', icon: X };
      case 'contraoferta':
        return { color: 'text-yellow-400', bg: 'bg-yellow-900/30', icon: MessageSquare };
      case 'enfado':
        return { color: 'text-orange-400', bg: 'bg-orange-900/30', icon: AlertTriangle };
      default:
        return { color: 'text-gray-400', bg: 'bg-gray-900/30', icon: Coins };
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <div className="flex gap-4">
        <Button
          variant={modo === 'compra' ? 'default' : 'outline'}
          onClick={() => setModo('compra')}
          className={modo === 'compra' ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Compra
        </Button>
        <Button
          variant={modo === 'venta' ? 'default' : 'outline'}
          onClick={() => setModo('venta')}
          className={modo === 'venta' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Venta
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Input Form */}
        <div className="space-y-4">
          {/* Article Selection */}
          <div className="bg-black/40 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-heading text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Artículo
            </h3>
            
            <div className="space-y-3">
              {/* Autocomplete */}
              <div className="relative">
                <Input
                  value={articuloSearch}
                  onChange={(e) => setArticuloSearch(e.target.value)}
                  placeholder="Buscar artículo..."
                  className="bg-black/50 border-gray-600"
                />
                {filteredEquipment.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredEquipment.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => selectArticulo(item)}
                        className="px-3 py-2 hover:bg-gray-800 cursor-pointer text-sm"
                      >
                        <span className="text-white">{item.nombre || item.nombre_es}</span>
                        <span className="text-gray-400 ml-2">
                          {item.precio || item.coste} mo
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual price input */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">Precio Base (mo)</label>
                  <Input
                    type="number"
                    value={precioBase}
                    onChange={(e) => setPrecioBase(e.target.value)}
                    className="bg-black/50 border-gray-600"
                    min="0"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Categoría</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full bg-black/50 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  >
                    {categorias.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Blessing */}
              <div>
                <label className="text-xs text-gray-400">Bendición/Recompensa</label>
                <select
                  value={bendicion}
                  onChange={(e) => setBendicion(e.target.value)}
                  className="w-full bg-black/50 border border-gray-600 rounded-md px-3 py-2 text-sm"
                >
                  {config?.blessing_modifiers && Object.entries(config.blessing_modifiers).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.nombre} {val.modificador > 0 ? `(+${val.modificador}%)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Location & Context */}
          <div className="bg-black/40 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Ubicación y Contexto
            </h3>
            
            <div className="space-y-3">
              {/* Region modifier */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">Mod. Región (%)</label>
                  <Input
                    type="number"
                    value={modRegion}
                    onChange={(e) => setModRegion(e.target.value)}
                    className="bg-black/50 border-gray-600"
                    placeholder="Ej: -10 o +20"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Mod. Asentamiento (%)</label>
                  <Input
                    type="number"
                    value={modAsentamiento}
                    onChange={(e) => setModAsentamiento(e.target.value)}
                    className="bg-black/50 border-gray-600"
                    placeholder="Ej: +15"
                  />
                </div>
              </div>

              {/* Historical context */}
              <div>
                <label className="text-xs text-gray-400">Contexto Histórico</label>
                <select
                  value={contextoHistorico}
                  onChange={(e) => setContextoHistorico(e.target.value)}
                  className="w-full bg-black/50 border border-gray-600 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Sin contexto especial</option>
                  {config?.historical_contexts && Object.entries(config.historical_contexts).map(([key, val]) => (
                    <option key={key} value={key}>{val.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Relationship & Merchant */}
          <div className="bg-black/40 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-heading text-[hsl(var(--torch-orange))] mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Relación y Comerciante
            </h3>
            
            <div className="space-y-3">
              {/* Relationship */}
              <div>
                <label className="text-xs text-gray-400">Relación con el PNJ</label>
                <select
                  value={relacion}
                  onChange={(e) => setRelacion(e.target.value)}
                  className="w-full bg-black/50 border border-gray-600 rounded-md px-3 py-2 text-sm"
                >
                  {config?.relationship_levels && Object.entries(config.relationship_levels)
                    .sort((a, b) => a[1].orden - b[1].orden)
                    .map(([key, val]) => (
                      <option key={key} value={key}>
                        {val.nombre} (Compra: {val.mod_compra > 0 ? '+' : ''}{val.mod_compra}%, Venta: {val.mod_venta > 0 ? '+' : ''}{val.mod_venta}%)
                      </option>
                    ))}
                </select>
              </div>

              {/* Merchant profile */}
              <div>
                <label className="text-xs text-gray-400">Perfil del Comerciante</label>
                <select
                  value={perfilComerciante}
                  onChange={(e) => setPerfilComerciante(e.target.value)}
                  className="w-full bg-black/50 border border-gray-600 rounded-md px-3 py-2 text-sm"
                >
                  {config?.merchant_profiles && Object.entries(config.merchant_profiles).map(([key, val]) => (
                    <option key={key} value={key}>{val.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Offer */}
          <div className="bg-black/40 border border-[hsl(var(--gold))]/50 rounded-lg p-4">
            <h3 className="text-sm font-heading text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Tu Oferta
            </h3>
            
            <div className="flex gap-2">
              <Input
                type="number"
                value={oferta}
                onChange={(e) => setOferta(e.target.value)}
                className="bg-black/50 border-[hsl(var(--gold))]/50 text-lg"
                placeholder="Cantidad en mo"
                min="0"
                step="0.1"
              />
              <span className="flex items-center text-[hsl(var(--gold))]">mo</span>
            </div>
            
            {resultado?.desglose?.precio_justo && (
              <p className="text-xs text-gray-400 mt-2">
                Precio justo calculado: <span className="text-[hsl(var(--gold))]">{resultado.desglose.precio_justo} mo</span>
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={calcularTransaccion}
              disabled={calculating}
              className="flex-1 bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
            >
              {calculating ? (
                <Dice6 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              Calcular Transacción
            </Button>
            <Button variant="outline" onClick={resetForm}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-4">
          {resultado ? (
            <>
              {/* Price breakdown */}
              <div className="bg-black/40 border border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-heading text-gray-300 mb-3">Desglose de Precio</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Precio base:</span>
                    <span className="text-white">{resultado.desglose.precio_base} mo</span>
                  </div>
                  {resultado.desglose.precio_con_bendicion !== resultado.desglose.precio_base && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">+ Bendición:</span>
                      <span className="text-purple-400">{resultado.desglose.precio_con_bendicion} mo</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">× Región ({((resultado.desglose.factor_region - 1) * 100).toFixed(0)}%):</span>
                    <span className="text-white">{resultado.desglose.factor_region.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">× Asentamiento ({((resultado.desglose.factor_asentamiento - 1) * 100).toFixed(0)}%):</span>
                    <span className="text-white">{resultado.desglose.factor_asentamiento.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">× Contexto ({((resultado.desglose.factor_contexto - 1) * 100).toFixed(0)}%):</span>
                    <span className="text-white">{resultado.desglose.factor_contexto.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-700 pt-2">
                    <span className="text-gray-400">= Precio mercado:</span>
                    <span className="text-white">{resultado.desglose.precio_mercado} mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">× Relación ({((resultado.desglose.factor_relacion - 1) * 100).toFixed(0)}%):</span>
                    <span className="text-white">{resultado.desglose.factor_relacion.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">× Perfil comerciante:</span>
                    <span className="text-white">{resultado.desglose.factor_perfil.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-700 pt-2 text-lg">
                    <span className="text-[hsl(var(--gold))] font-heading">PRECIO JUSTO:</span>
                    <span className="text-[hsl(var(--gold))] font-bold">{resultado.desglose.precio_justo} mo</span>
                  </div>
                </div>
              </div>

              {/* Dice roll */}
              <div className="bg-black/40 border border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-heading text-gray-300 mb-3 flex items-center gap-2">
                  <Dice6 className="h-4 w-4" />
                  Tirada de Negociación
                </h3>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">{resultado.tirada.base}</div>
                    <div className="text-xs text-gray-400">Base</div>
                  </div>
                  <div className="text-gray-400">+</div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-400">{resultado.tirada.bono_relacion}</div>
                    <div className="text-xs text-gray-400">Relación</div>
                  </div>
                  <div className="text-gray-400">+</div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-400">{resultado.tirada.bono_contexto}</div>
                    <div className="text-xs text-gray-400">Contexto</div>
                  </div>
                  <div className="text-gray-400">=</div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[hsl(var(--gold))]">{resultado.tirada.total}</div>
                    <div className="text-xs text-gray-400">Total</div>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  <span className="text-gray-400">Diferencia de oferta: </span>
                  <span className={resultado.diferencia_porcentual >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {resultado.diferencia_porcentual > 0 ? '+' : ''}{resultado.diferencia_porcentual}%
                  </span>
                </div>
              </div>

              {/* Result */}
              {(() => {
                const style = getResultStyle(resultado.resultado.tipo);
                const Icon = style.icon;
                return (
                  <div className={`${style.bg} border border-current/30 rounded-lg p-6 ${style.color}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <Icon className="h-8 w-8" />
                      <h3 className="text-2xl font-heading uppercase">
                        {resultado.resultado.tipo === 'acepta' && '¡Acepta!'}
                        {resultado.resultado.tipo === 'rechaza' && 'Rechaza'}
                        {resultado.resultado.tipo === 'contraoferta' && 'Contraoferta'}
                        {resultado.resultado.tipo === 'enfado' && '¡Se enfada!'}
                      </h3>
                    </div>
                    
                    {resultado.resultado.contraoferta && (
                      <div className="bg-black/30 rounded p-3 mb-3">
                        <span className="text-gray-300">El comerciante propone: </span>
                        <span className="text-xl font-bold">{resultado.resultado.contraoferta} mo</span>
                      </div>
                    )}
                    
                    {resultado.resultado.enfado && (
                      <div className="bg-black/30 rounded p-3 mb-3">
                        <span className="text-gray-300">Nivel de enfado: </span>
                        <span className="font-bold capitalize">{resultado.resultado.enfado}</span>
                        <br />
                        <span className="text-gray-300">Cambio en relación: </span>
                        <span className="font-bold">{resultado.resultado.cambio_relacion}</span>
                      </div>
                    )}
                    
                    <p className="text-sm text-gray-300 italic">
                      {resultado.resultado.tipo === 'acepta' && modo === 'compra' && 
                        '"Trato hecho. Es un placer hacer negocios contigo."'}
                      {resultado.resultado.tipo === 'acepta' && modo === 'venta' && 
                        '"Me parece un precio justo. Te lo compro."'}
                      {resultado.resultado.tipo === 'rechaza' && 
                        '"No, eso no me convence. Vuelve cuando tengas una oferta seria."'}
                      {resultado.resultado.tipo === 'contraoferta' && 
                        `"Hmm... ¿Qué tal si lo dejamos en ${resultado.resultado.contraoferta} monedas?"`}
                      {resultado.resultado.tipo === 'enfado' && resultado.resultado.enfado === 'leve' && 
                        '"¡¿Me tomas por tonto?! Será mejor que te vayas antes de que me arrepienta."'}
                      {resultado.resultado.tipo === 'enfado' && resultado.resultado.enfado === 'moderado' && 
                        '"¡Fuera de mi tienda! No quiero volver a verte en días."'}
                      {resultado.resultado.tipo === 'enfado' && resultado.resultado.enfado === 'severo' && 
                        '"¡LARGO! ¡Y no vuelvas a poner un pie aquí o llamaré a la guardia!"'}
                    </p>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="bg-black/40 border border-gray-700 rounded-lg p-8 text-center">
              <Calculator className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                Configura los parámetros de la transacción y haz clic en "Calcular" para ver el resultado.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradingCalculator;
