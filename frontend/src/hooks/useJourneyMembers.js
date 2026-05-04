import { useCallback } from 'react';
import { toast } from 'sonner';
import { MAX_ROLES_PER_CHARACTER } from '@/components/travel/travelConstants';
import {
  calcBonusCompetencia,
  tieneCompetenciaEn,
  tienePericia,
  getModAtributo,
  calcModHabilidad,
} from '@/components/travel/travelHelpers';

const MAX_ACOMPANANTES = 10;

/**
 * Hook que encapsula la gestión de miembros (con papel de viaje) y
 * acompañantes (pasajeros sin papel) dentro del sistema de viaje.
 *
 * Recibe el estado `config` y el setter `setConfig` desde el contenedor
 * principal, junto con el listado de `characters` disponibles. Expone todas
 * las funciones de alta/baja/modificación sin tocar estado externo.
 */
const useJourneyMembers = ({ config, setConfig, characters }) => {
  const buildMemberPayload = useCallback((char, { papeles }) => {
    const monturaPropia = char.montura
      ? {
          nombre: char.montura.nombre,
          capacidad: char.montura.capacidad_carga,
          velocidad: char.montura.velocidad || 18,
          constitucion: char.montura.constitucion,
        }
      : null;

    const velocidadBase = char.velocidad || 9;
    const nivel = char.nivel || 1;
    const bonusCompetencia = calcBonusCompetencia(nivel);
    const modViajar = calcModHabilidad(char, 'Viajar');
    const modCaza = calcModHabilidad(char, 'Cazar');
    const modPercepcion = calcModHabilidad(char, 'Percepción');
    const modExplorar = calcModHabilidad(char, 'Explorar');

    return {
      id: char.id,
      nombre: char.nombre,
      raza: char.cultura_nombre || char.cultura || char.raza || 'Desconocida',
      papeles,
      tieneMontura: false,
      monturaNombre: null,
      monturaConBonus: 0,
      monturaPropia,
      velocidadBase,
      modViajar,
      modCaza,
      modPercepcion,
      modExplorar,
      modSabiduria: getModAtributo(char, 'sabiduria'),
      modDestreza: getModAtributo(char, 'destreza'),
      percepcionPasiva: 10 + modPercepcion,
      competencias: char.habilidades_competencia || char.habilidades || [],
      pericias: char.pericia_elegida || [],
      competenciaViajar: tieneCompetenciaEn(char, 'Viajar'),
      periciaViajar: tienePericia(char, 'Viajar'),
      competenciaCartografia: tieneCompetenciaEn(char, 'cartograf'),
      nivel,
      bonusCompetencia,
    };
  }, []);

  const addMember = useCallback((charId) => {
    const char = characters.find((c) => c.id === charId);
    if (!char) return;
    if (config.miembros.some((m) => m.id === charId)) {
      toast.error('Este personaje ya está en el grupo');
      return;
    }
    setConfig((prev) => ({
      ...prev,
      miembros: [...prev.miembros, buildMemberPayload(char, { papeles: [] })],
    }));
  }, [characters, config.miembros, setConfig, buildMemberPayload]);

  const addMemberWithRole = useCallback((charId, role) => {
    const char = characters.find((c) => c.id === charId);
    if (!char) return;

    const existingMember = config.miembros.find((m) => m.id === charId);

    if (existingMember) {
      setConfig((prev) => ({
        ...prev,
        miembros: prev.miembros.map((m) => {
          if (m.id !== charId) return m;
          if (m.papeles.length >= MAX_ROLES_PER_CHARACTER && !m.papeles.includes(role)) {
            toast.error(`Máximo ${MAX_ROLES_PER_CHARACTER} papeles por personaje`);
            return m;
          }
          const newPapeles = m.papeles.includes(role) ? m.papeles : [...m.papeles, role];
          return { ...m, papeles: newPapeles };
        }),
      }));
    } else {
      setConfig((prev) => ({
        ...prev,
        miembros: [...prev.miembros, buildMemberPayload(char, { papeles: [role] })],
      }));
    }
  }, [characters, config.miembros, setConfig, buildMemberPayload]);

  const removeMember = useCallback((charId) => {
    setConfig((prev) => ({
      ...prev,
      miembros: prev.miembros.filter((m) => m.id !== charId),
    }));
  }, [setConfig]);

  const removeRoleFromMember = useCallback((charId, role) => {
    setConfig((prev) => ({
      ...prev,
      miembros: prev.miembros.map((m) =>
        m.id === charId ? { ...m, papeles: m.papeles.filter((p) => p !== role) } : m
      ),
    }));
  }, [setConfig]);

  const toggleMemberRole = useCallback((charId, role) => {
    const member = config.miembros.find((m) => m.id === charId);
    if (member && member.papeles.length >= MAX_ROLES_PER_CHARACTER && !member.papeles.includes(role)) {
      toast.error(`Máximo ${MAX_ROLES_PER_CHARACTER} papeles por personaje`);
      return;
    }
    setConfig((prev) => ({
      ...prev,
      miembros: prev.miembros.map((m) => {
        if (m.id !== charId) return m;
        const hasPapel = m.papeles.includes(role);
        return {
          ...m,
          papeles: hasPapel ? m.papeles.filter((p) => p !== role) : [...m.papeles, role],
        };
      }),
    }));
  }, [config.miembros, setConfig]);

  const updateMemberRole = useCallback((charId, role) => {
    if (!role) return;
    setConfig((prev) => ({
      ...prev,
      miembros: prev.miembros.map((m) => {
        if (m.id !== charId) return m;
        if (m.papeles.includes(role)) return m;
        return { ...m, papeles: [...m.papeles, role] };
      }),
    }));
  }, [setConfig]);

  const updateMemberMount = useCallback((charId, useMount) => {
    setConfig((prev) => ({
      ...prev,
      miembros: prev.miembros.map((m) => {
        if (m.id !== charId) return m;
        if (useMount && m.monturaPropia) {
          const consRaw = m.monturaPropia.constitucion;
          let modCon = 0;
          if (typeof m.monturaPropia.constitucion_mod === 'number') {
            modCon = m.monturaPropia.constitucion_mod;
          } else if (typeof consRaw === 'string') {
            const m2 = consRaw.match(/[+-]?\d+/);
            modCon = m2 ? parseInt(m2[0], 10) : 0;
          } else if (typeof consRaw === 'number') {
            modCon = Math.floor((consRaw - 10) / 2);
          }
          return {
            ...m,
            tieneMontura: true,
            monturaNombre: m.monturaPropia.nombre,
            monturaConBonus: modCon,
          };
        }
        return {
          ...m,
          tieneMontura: false,
          monturaNombre: null,
          monturaConBonus: 0,
        };
      }),
    }));
  }, [setConfig]);

  // =============== ACOMPAÑANTES ===============

  const addAcompanante = useCallback((charId) => {
    const char = characters.find((c) => c.id === charId);
    if (!char) return;
    if (config.miembros.some((m) => m.id === charId)) {
      toast.error('Este personaje ya tiene un papel de viaje asignado.');
      return;
    }
    if ((config.acompanantes || []).some((a) => a.id === charId)) {
      toast.error('Este personaje ya está como acompañante.');
      return;
    }
    if ((config.acompanantes || []).length >= MAX_ACOMPANANTES) {
      toast.error(`Máximo ${MAX_ACOMPANANTES} acompañantes.`);
      return;
    }

    const monturaPropia = char.montura
      ? {
          nombre: char.montura.nombre,
          capacidad: char.montura.capacidad_carga,
          velocidad: char.montura.velocidad || 18,
          constitucion: char.montura.constitucion,
        }
      : null;

    setConfig((prev) => ({
      ...prev,
      acompanantes: [
        ...(prev.acompanantes || []),
        {
          id: char.id,
          nombre: char.nombre,
          raza: char.cultura_nombre || char.cultura || char.raza || 'Desconocida',
          velocidadBase: char.velocidad || 9,
          monturaPropia,
          tieneMontura: !!monturaPropia,
          monturaNombre: monturaPropia?.nombre || null,
          modSabiduria: getModAtributo(char, 'sabiduria'),
        },
      ],
    }));
  }, [characters, config.miembros, config.acompanantes, setConfig]);

  const removeAcompanante = useCallback((charId) => {
    setConfig((prev) => ({
      ...prev,
      acompanantes: (prev.acompanantes || []).filter((a) => a.id !== charId),
    }));
  }, [setConfig]);

  const toggleAcompananteMount = useCallback((charId, useMount) => {
    setConfig((prev) => ({
      ...prev,
      acompanantes: (prev.acompanantes || []).map((a) => {
        if (a.id !== charId) return a;
        if (useMount && a.monturaPropia) {
          return { ...a, tieneMontura: true, monturaNombre: a.monturaPropia.nombre };
        }
        return { ...a, tieneMontura: false, monturaNombre: null };
      }),
    }));
  }, [setConfig]);

  return {
    addMember,
    addMemberWithRole,
    removeMember,
    removeRoleFromMember,
    toggleMemberRole,
    updateMemberRole,
    updateMemberMount,
    addAcompanante,
    removeAcompanante,
    toggleAcompananteMount,
    MAX_ACOMPANANTES,
  };
};

export default useJourneyMembers;
