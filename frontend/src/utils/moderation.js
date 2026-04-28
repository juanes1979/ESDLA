/**
 * Cliente para el endpoint de moderación inteligente.
 * Centraliza la llamada a /api/moderation/check-name para que cualquier
 * formulario pueda validar texto introducido por el usuario.
 */
import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL;

/**
 * Comprueba si un texto es apropiado.
 * @param {string} text - texto a validar
 * @param {string} context - 'character_name' | 'character_surname' | 'player_name' | 'location_name' | 'campaign_name' | 'other'
 * @param {object} extra - {user_label?: string, draft_id?: string}
 * @returns {Promise<{appropriate: boolean, category: string, reason: string, flagged_term?: string}>}
 */
export async function checkName(text, context = 'other', extra = {}) {
  try {
    const res = await axios.post(`${BASE}/api/moderation/check-name`, {
      text: text ?? '',
      context,
      user_label: extra.user_label || null,
      draft_id: extra.draft_id || null,
    }, { timeout: 15000 });
    return res.data;
  } catch (err) {
    // Fail-open en cliente para no bloquear el flujo si el servicio cae.
    console.warn('[moderation] check-name fallo:', err?.message);
    return { appropriate: true, category: 'ok', reason: '' };
  }
}
