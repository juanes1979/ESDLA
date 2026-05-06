/**
 * API Service for LOTR 5e RPG
 */
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create axios instance with defaults
const api = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json',
  },
});

// === Auth interceptor ===
// Reads the JWT from localStorage (or sessionStorage) and attaches it
// as a Bearer token. The token is written by AuthContext on login.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lotr5e_token') || sessionStorage.getItem('lotr5e_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 (token expired / invalid), wipe the local token so the
// AuthContext bounces the user back to /login on the next render.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('lotr5e_token');
      sessionStorage.removeItem('lotr5e_token');
    }
    return Promise.reject(err);
  }
);

// === GAME DATA ===

export const getCultures = async (categoria = null) => {
  const params = categoria ? { categoria } : {};
  const response = await api.get('/data/cultures', { params });
  return response.data.cultures;
};

export const getCulture = async (id) => {
  const response = await api.get(`/data/cultures/${id}`);
  return response.data;
};

export const getCultureCategories = async () => {
  const response = await api.get('/data/cultures/categories/list');
  return response.data.categories;
};

export const getBackgrounds = async (cultureId = null, cultura = null) => {
  const params = {};
  if (cultureId) params.culture_id = cultureId;
  if (cultura) params.cultura = cultura;
  const response = await api.get('/data/backgrounds', { params });
  return response.data.backgrounds;
};

export const getBackground = async (id) => {
  const response = await api.get(`/data/backgrounds/${id}`);
  return response.data;
};

export const getOccupations = async () => {
  const response = await api.get('/data/occupations');
  return response.data.occupations;
};

export const getOccupation = async (id) => {
  const response = await api.get(`/data/occupations/${id}`);
  return response.data;
};

export const getVirtues = async (cultureId = null, cultura = null, includeCommon = true) => {
  const params = { include_common: includeCommon };
  if (cultureId) params.culture_id = cultureId;
  if (cultura) params.cultura = cultura;
  const response = await api.get('/data/virtues', { params });
  return response.data.virtues;
};

export const getVirtue = async (id) => {
  const response = await api.get(`/data/virtues/${id}`);
  return response.data;
};

export const getArts = async () => {
  const response = await api.get('/data/arts');
  return response.data.arts;
};

export const getPatrons = async () => {
  const response = await api.get('/data/patrons');
  return response.data.patrons;
};

export const getEquipment = async () => {
  const response = await api.get('/data/equipment');
  return response.data.equipment;
};

export const getWeapons = async () => {
  const response = await api.get('/data/weapons');
  return response.data.weapons;
};

export const getArmors = async () => {
  const response = await api.get('/data/armors');
  return response.data.armors;
};

export const getEquipmentLists = async () => {
  const response = await api.get('/data/equipment-lists');
  return response.data;
};

export const getEquipmentCatalog = async (categoria = null, search = null) => {
  const params = {};
  if (categoria) params.categoria = categoria;
  if (search) params.search = search;
  const response = await api.get('/data/equipment-catalog', { params });
  return response.data;
};

export const getCultureNames = async (cultura) => {
  const response = await api.get(`/data/names/${encodeURIComponent(cultura)}`);
  return response.data;
};

export const getAllCultureNames = async () => {
  const response = await api.get('/data/names');
  return response.data.names;
};

// === CHARACTER MANAGEMENT ===

export const createCharacterDraft = async () => {
  const response = await api.post('/characters/draft');
  return response.data;
};

export const getCharacterDraft = async (draftId) => {
  const response = await api.get(`/characters/draft/${draftId}`);
  return response.data;
};

export const updateDraftStep1 = async (draftId, data) => {
  const response = await api.patch(`/characters/draft/${draftId}/step1`, data);
  return response.data;
};

export const updateDraftStep2 = async (draftId, data) => {
  const response = await api.patch(`/characters/draft/${draftId}/step2`, data);
  return response.data;
};

export const updateDraftStep3 = async (draftId, data) => {
  const response = await api.patch(`/characters/draft/${draftId}/step3`, data);
  return response.data;
};

export const updateDraftStep4 = async (draftId, data) => {
  const response = await api.patch(`/characters/draft/${draftId}/step4`, data);
  return response.data;
};

export const updateDraftStep5 = async (draftId, data) => {
  const response = await api.patch(`/characters/draft/${draftId}/step5`, data);
  return response.data;
};

export const updateDraftStep6 = async (draftId, data) => {
  const response = await api.patch(`/characters/draft/${draftId}/step6`, data);
  return response.data;
};

export const updateDraftStep7 = async (draftId, data) => {
  const response = await api.patch(`/characters/draft/${draftId}/step7`, data);
  return response.data;
};

export const updateDraftStep8 = async (draftId, data) => {
  const response = await api.patch(`/characters/draft/${draftId}/step8`, data);
  return response.data;
};

export const updateDraftStep9 = async (draftId, data) => {
  const response = await api.patch(`/characters/draft/${draftId}/step9`, data);
  return response.data;
};

export const finalizeCharacter = async (draftId) => {
  const response = await api.post(`/characters/draft/${draftId}/finalize`);
  return response.data;
};

export const getCharacters = async (jugador = null) => {
  const params = jugador ? { jugador } : {};
  const response = await api.get('/characters/', { params });
  return response.data.characters;
};

export const getCharacter = async (id) => {
  const response = await api.get(`/characters/${id}`);
  return response.data;
};

export const deleteCharacter = async (id) => {
  const response = await api.delete(`/characters/${id}`);
  return response.data;
};

// === UTILITIES ===

export const generateRandomName = (nameData, gender = 'hombre') => {
  if (!nameData) return '';
  
  const genderData = nameData[gender] || nameData.hombre;
  if (!genderData || !genderData.prefijos || !genderData.sufijos) return '';
  
  const prefijos = genderData.prefijos.filter(p => p);
  const sufijos = genderData.sufijos.filter(s => s);
  
  if (prefijos.length === 0 || sufijos.length === 0) return '';
  
  const prefix = prefijos[Math.floor(Math.random() * prefijos.length)];
  const suffix = sufijos[Math.floor(Math.random() * sufijos.length)];
  
  return prefix + suffix;
};

export default api;

// === ADVENTURES (Fase 1: Sistema Aventuras & Campañas) ===

export const listAdventures = async (scope = 'all') => {
  const response = await api.get('/adventures', { params: { scope } });
  return response.data;
};

export const getAdventure = async (id) => {
  const response = await api.get(`/adventures/${id}`);
  return response.data;
};

export const createAdventure = async (payload) => {
  const response = await api.post('/adventures', payload);
  return response.data;
};

export const updateAdventure = async (id, payload) => {
  const response = await api.patch(`/adventures/${id}`, payload);
  return response.data;
};

export const deleteAdventure = async (id) => {
  const response = await api.delete(`/adventures/${id}`);
  return response.data;
};

export const cloneAdventure = async (id) => {
  const response = await api.post(`/adventures/${id}/clone`);
  return response.data;
};

// Bestiary picker for the adventure wizard ("PNJs" tab).
// Returns categories: malignos / pnj / animales / especiales.
export const getBestiary = async (categoria = null, search = null) => {
  const params = {};
  if (categoria) params.categoria = categoria;
  if (search) params.search = search;
  const response = await api.get('/data/npcs', { params });
  return response.data;
};

// Locations list for the "¿Dónde?" picker.
export const getLocations = async () => {
  const response = await api.get('/data/locations');
  return response.data.locations || response.data;
};

// Generic file upload (used for adventure cover and maps).
export const uploadAdventureImage = async (file, { description } = {}) => {
  const form = new FormData();
  form.append('file', file);
  form.append('folder', 'adventures');
  if (description) form.append('description', description);
  const response = await api.post('/storage/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data; // { file_id, path, ... }
};

// === CAMPAIGN RUNS (Fase 2) ===

export const generateCampaignRun = async (adventureId) => {
  const response = await api.post(`/campaign-runs/from-adventure/${adventureId}`);
  return response.data;
};

export const listCampaignRuns = async (scope = 'mine', status = null) => {
  const params = { scope };
  if (status) params.status = status;
  const response = await api.get('/campaign-runs', { params });
  return response.data;
};

export const getCampaignRun = async (id) => {
  const response = await api.get(`/campaign-runs/${id}`);
  return response.data;
};

export const getCampaignContent = async (id) => {
  const response = await api.get(`/campaign-runs/${id}/content`);
  return response.data;
};

export const getCampaignLog = async (id) => {
  const response = await api.get(`/campaign-runs/${id}/log`);
  return response.data;
};

export const activateCampaignRun = async (id) => {
  const response = await api.post(`/campaign-runs/${id}/activate`);
  return response.data;
};

export const pauseCampaignRun = async (id) => {
  const response = await api.post(`/campaign-runs/${id}/pause`);
  return response.data;
};

export const finishCampaignRun = async (id) => {
  const response = await api.post(`/campaign-runs/${id}/finish`);
  return response.data;
};

export const deleteCampaignRun = async (id) => {
  const response = await api.delete(`/campaign-runs/${id}`);
  return response.data;
};

// === CAMPAIGN PLAYERS (Fase 3: unión por código) ===

export const joinByCode = async (code, characterId) => {
  const response = await api.post('/campaign-runs/join-by-code', {
    code,
    character_id: characterId,
  });
  return response.data;
};

export const listCampaignPlayers = async (runId) => {
  const response = await api.get(`/campaign-runs/${runId}/players`);
  return response.data;
};

export const updatePlayerStatus = async (playerId, status) => {
  const response = await api.patch(`/campaign-players/${playerId}`, { status });
  return response.data;
};

export const leaveCampaign = async (playerId) => {
  const response = await api.post(`/campaign-players/${playerId}/leave`);
  return response.data;
};

export const myCampaigns = async (status = null) => {
  const params = status ? { status } : {};
  const response = await api.get('/my/campaigns', { params });
  return response.data;
};

// Used by the player when joining: list their own characters (eligible).
// `summary=true` returns minimal fields to keep the payload small (full docs
// are several MB each because of inventory + chests).
export const listMyCharacters = async () => {
  const response = await api.get('/characters/?summary=true');
  return response.data.characters || [];
};

