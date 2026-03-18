const { supabase } = require('./supabaseClient');
const path = require('path');
const fs   = require('fs');

const MAPPING_PATH = path.join(__dirname, '../../data/discord_to_member.json');

/**
 * Resuelve el member_id de Supabase a partir del Discord userId.
 * Primero busca en discord_to_member.json; si no hay mapeo explícito,
 * cae al displayName en minúsculas como fallback.
 */
function getMemberId(userId, displayName) {
  try {
    const raw     = fs.readFileSync(MAPPING_PATH, 'utf8');
    const mapping = JSON.parse(raw);
    if (mapping[userId]) return mapping[userId];
  } catch {
    // mapping file no disponible
  }
  // Fallback: nombre en minúsculas (funciona si el displayName coincide con el roster)
  return displayName ? displayName.toLowerCase() : null;
}

/**
 * Upsert de sesión activa en team_checkins.
 * @param {string} userId     - Discord user ID
 * @param {string} displayName - Nombre visible en Discord
 * @param {string} until      - UTC ISO timestamp o 'indefinidamente'
 * @param {string} project    - Nombre del proyecto
 */
async function syncLogin(userId, displayName, until, project) {
  if (!supabase) return;

  const memberId = getMemberId(userId, displayName);
  if (!memberId) {
    console.warn(`[checkinSync] Sin mapeo para userId=${userId} (${displayName})`);
    return;
  }

  const { error } = await supabase
    .from('team_checkins')
    .upsert(
      { member_id: memberId, until, project, updated_at: new Date().toISOString() },
      { onConflict: 'member_id' }
    );

  if (error) console.error(`[checkinSync] Error en login sync (${memberId}):`, error.message);
}

/**
 * Elimina la sesión de team_checkins al hacer logout o al expirar.
 * @param {string} userId      - Discord user ID
 * @param {string} displayName - Nombre visible (para el fallback de memberId)
 */
async function syncLogout(userId, displayName) {
  if (!supabase) return;

  const memberId = getMemberId(userId, displayName);
  if (!memberId) return;

  const { error } = await supabase
    .from('team_checkins')
    .delete()
    .eq('member_id', memberId);

  if (error) console.error(`[checkinSync] Error en logout sync (${memberId}):`, error.message);
}

module.exports = { syncLogin, syncLogout };
