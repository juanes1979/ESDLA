/**
 * Hook del Sistema "Ojo de Mordor".
 *
 * Mantiene el estado del Ojo en sync con el backend y expone funciones
 * para incrementar la Atención. Polling ligero (cada 30s) cuando hay
 * viaje activo. Las acciones de UI (botones manuales del DJ, hooks de
 * eventos) usan `increment` directamente y obtienen una respuesta con
 * `will_trigger` para mostrar el modal de Episodio.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import api from '@/services/api';

const STATE_ID = 'default';

export const SOURCE_LABELS = {
  nat1: 'Tirada natural de 1',
  shadow_gain: 'Sombra ganada',
  magic_minor: 'Magia menor',
  magic_major: 'Magia mayor',
  magic_powerful: 'Magia poderosa',
  manual: 'Ajuste manual del DJ',
  object: 'Objeto notable',
  init: 'Inicialización',
  episode_reset: 'Reinicio tras episodio',
};

export default function useEyeOfMordor({ pollWhenActive = false } = {}) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get(`/eye/state?state_id=${STATE_ID}`);
      setState(res.data);
      return res.data;
    } catch (err) {
      console.error('Eye of Mordor refresh failed', err);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling opcional cuando hay viaje activo
  useEffect(() => {
    if (!pollWhenActive) return undefined;
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [pollWhenActive, refresh]);

  const increment = useCallback(async ({ source, delta, characterId, characterName, descripcion }) => {
    setLoading(true);
    try {
      const res = await api.post(`/eye/increment?state_id=${STATE_ID}`, {
        source,
        delta,
        character_id: characterId,
        character_name: characterName,
        descripcion: descripcion || '',
      });
      setState(res.data);
      // Toast narrativo
      const msg = source === 'nat1'
        ? `🌑 La Sombra se agita… (+${res.data.delta_applied})`
        : `🌑 Algo observa vuestros pasos… (+${res.data.delta_applied})`;
      toast(msg, { duration: 3500 });
      return res.data; // incluye will_trigger para que el caller decida abrir modal
    } catch (err) {
      console.error('Eye increment failed', err);
      toast.error('No se pudo actualizar la Atención del Ojo');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const setCurrentRegion = useCallback(async (regionName) => {
    if (!regionName) return null;
    try {
      const res = await api.post(`/eye/region?state_id=${STATE_ID}&region_name=${encodeURIComponent(regionName)}`);
      setState((s) => (s ? { ...s, ...res.data.state, threshold_info: res.data.threshold_info } : s));
      return res.data;
    } catch (err) {
      console.error('Eye set region failed', err);
      return null;
    }
  }, []);

  const initParty = useCallback(async (partyMemberIds) => {
    setLoading(true);
    try {
      const res = await api.post(`/eye/init?state_id=${STATE_ID}`, { party_member_ids: partyMemberIds });
      await refresh();
      return res.data; // {state, desglose}
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const updateParty = useCallback(async (partyMemberIds) => {
    const res = await api.post(`/eye/party?state_id=${STATE_ID}`, { party_member_ids: partyMemberIds });
    setState((s) => (s ? { ...s, party_member_ids: res.data.party_member_ids } : s));
    return res.data;
  }, []);

  const triggerEpisode = useCallback(async () => {
    const res = await api.post(`/eye/trigger-episode?state_id=${STATE_ID}`);
    await refresh();
    return res.data;
  }, [refresh]);

  const reset = useCallback(async () => {
    const res = await api.post(`/eye/reset?state_id=${STATE_ID}`);
    setState(res.data);
    return res.data;
  }, []);

  const setThresholdModifiers = useCallback(async (modifiers) => {
    const res = await api.post(`/eye/threshold-modifiers?state_id=${STATE_ID}`, {
      threshold_modifiers: modifiers,
    });
    await refresh();
    return res.data;
  }, [refresh]);

  return {
    state,
    loading,
    refresh,
    increment,
    setCurrentRegion,
    initParty,
    updateParty,
    triggerEpisode,
    reset,
    setThresholdModifiers,
  };
}
