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
