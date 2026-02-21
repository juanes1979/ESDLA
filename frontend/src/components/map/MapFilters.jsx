/**
 * Map Filters Component
 * Handles region, type and search filtering for the Middle-earth Map
 */
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const MapFilters = ({
  filterRegion,
  setFilterRegion,
  filterType,
  setFilterType,
  searchTerm,
  setSearchTerm,
  regions,
  types,
  typeNames,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Region filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Región:</label>
        <Select value={filterRegion} onValueChange={setFilterRegion}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {regions.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Type filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Tipo:</label>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {types.map(t => (
              <SelectItem key={t} value={t}>{typeNames[t] || t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar ubicación..."
          className="pl-9"
        />
      </div>
    </div>
  );
};

export default MapFilters;
