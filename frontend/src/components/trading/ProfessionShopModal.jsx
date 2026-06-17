/**
 * ProfessionShopModal — "Tienda según profesión"
 *
 * Muestra, por orden alfabético, cada profesión y los ítems que puede vender,
 * agrupados por bloque de equipo. El DJ puede DESELECCIONAR un ítem de una
 * profesión desde aquí (crea/ajusta el override de profesiones de ese ítem).
 *
 * La pertenencia se resuelve con herencia: un ítem lo vende una profesión si
 * está en sus profesiones propias (override) o, si no tiene, en las del bloque.
 */
import { useState, useMemo } from 'react';
import { X, Search, ChevronDown, ChevronRight, Store, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

const ProfessionShopModal = ({
  data = {},
  blockProf = {},
  npcProfesiones = [],
  categories = [],     // [{ key, name }]
  isAdmin = false,
  onDeselect,          // async (catKey, itemName, prof) => void
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(null); // `${cat}|${item}|${prof}`

  // profesión → [{ catKey, catName, items: [nombre] }]
  const byProfession = useMemo(() => {
    const map = {};
    npcProfesiones.forEach((p) => { map[p] = []; });
    categories.forEach((cat) => {
      const items = data[cat.key] || [];
      const perProf = {};
      items.forEach((it) => {
        const eff = (it.profesiones && it.profesiones.length) ? it.profesiones : (blockProf[cat.key] || []);
        // Si eff está vacío → lo vende cualquiera: aparece en TODAS las profesiones.
        const sellers = eff.length ? eff : npcProfesiones;
        sellers.forEach((p) => {
          if (!(p in map)) return;
          (perProf[p] = perProf[p] || []).push(it.nombre);
        });
      });
      Object.entries(perProf).forEach(([p, names]) => {
        map[p].push({ catKey: cat.key, catName: cat.name, items: names });
      });
    });
    return map;
  }, [data, blockProf, npcProfesiones, categories]);

  const profList = useMemo(() => {
    const q = search.toLowerCase().trim();
    return [...npcProfesiones]
      .filter((p) => !q || p.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b, 'es'));
  }, [npcProfesiones, search]);

  const handleDeselect = async (catKey, itemName, prof) => {
    const id = `${catKey}|${itemName}|${prof}`;
    setBusy(id);
    try { await onDeselect?.(catKey, itemName, prof); }
    finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" data-testid="profession-shop-modal">
      <div className="bg-[hsl(var(--background))] border border-[hsl(var(--gold))]/50 rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-border/30 flex justify-between items-center sticky top-0 bg-[hsl(var(--background))]">
          <h2 className="font-heading text-xl text-[hsl(var(--gold))] flex items-center gap-2">
            <Store className="w-5 h-5" /> Tienda según profesión
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="profshop-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-border/30">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar profesión…" className="pl-8" data-testid="profshop-search" />
          </div>
          {isAdmin && (
            <p className="text-xs text-muted-foreground mt-2">
              Pulsa la ✕ de un ítem para que esa profesión deje de venderlo (se ajusta el override del ítem).
            </p>
          )}
        </div>

        <div className="overflow-y-auto p-2 space-y-1" data-testid="profshop-list">
          {profList.map((prof) => {
            const blocks = byProfession[prof] || [];
            const total = blocks.reduce((n, b) => n + b.items.length, 0);
            const isOpen = expanded === prof;
            return (
              <div key={prof} className="border border-border/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : prof)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-black/20 hover:bg-black/30 text-left"
                  data-testid={`profshop-prof-${prof}`}
                >
                  <span className="flex items-center gap-2 font-medium text-[hsl(var(--gold))]">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {prof}
                  </span>
                  <span className="text-xs text-muted-foreground">{total} ítems · {blocks.length} bloques</span>
                </button>
                {isOpen && (
                  <div className="p-3 space-y-3">
                    {blocks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No vende ningún ítem.</p>
                    ) : (
                      blocks.map((b) => (
                        <div key={b.catKey}>
                          <p className="text-xs font-medium text-[hsl(var(--magic-blue))] mb-1">{b.catName} <span className="text-muted-foreground">({b.items.length})</span></p>
                          <div className="flex flex-wrap gap-1.5">
                            {b.items.map((nombre) => {
                              const id = `${b.catKey}|${nombre}|${prof}`;
                              return (
                                <span key={nombre}
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-black/30 border border-border/40"
                                  data-testid={`profshop-item-${b.catKey}-${nombre}`}>
                                  {nombre}
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDeselect(b.catKey, nombre, prof)}
                                      disabled={busy === id}
                                      className="text-red-400 hover:text-red-300"
                                      title={`Quitar "${nombre}" de ${prof}`}
                                      data-testid={`profshop-remove-${b.catKey}-${nombre}`}>
                                      {busy === id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProfessionShopModal;
