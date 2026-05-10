// engine/DeclaracionsSupabase.js
// Capa de persistència de declaracions via Supabase
// Substitueix DeclaracionsStorage.js (localStorage)

import { supabase } from '../../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNS
// ─────────────────────────────────────────────────────────────────────────────

function ara() {
  return new Date().toISOString();
}

// Converteix una fila Supabase (snake_case) a objecte de l'app (camelCase)
function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email || '',
    clientNom: row.client_nom || '',
    clientNRT: row.client_nrt || '',
    exercici: row.exercici || 2025,
    estat: row.estat || 'esborrany',
    creatEn: row.creat_en,
    modificatEn: row.modificat_en,
    dades: row.dades || {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna les declaracions d'un usuari, ordenades per data de modificació (més recent primer)
 */
export async function llistarDeclaracions(userId) {
  const { data, error } = await supabase
    .from('declaracions')
    .select('*')
    .eq('user_id', userId)
    .order('modificat_en', { ascending: false });
  if (error) { console.error('llistarDeclaracions:', error); return []; }
  return (data || []).map(mapRow);
}

/**
 * Retorna TOTES les declaracions (per al maestro), ordenades per data de modificació
 */
export async function llistarTotesDeclaracions() {
  const { data, error } = await supabase
    .from('declaracions')
    .select('*')
    .order('modificat_en', { ascending: false });
  if (error) { console.error('llistarTotesDeclaracions:', error); return []; }
  return (data || []).map(mapRow);
}

/**
 * Retorna una declaració per ID, o null si no existeix
 */
export async function obtenirDeclaracio(id) {
  const { data, error } = await supabase
    .from('declaracions')
    .select('*')
    .eq('id', id)
    .single();
  if (error) { console.error('obtenirDeclaracio:', error); return null; }
  return mapRow(data);
}

/**
 * Crea una nova declaració buida i la desa
 * Retorna la declaració creada, o null si error
 */
export async function novaDeclaracio(userId, userEmail, clientNom = '', clientNRT = '', exercici = 2025) {
  const now = ara();
  const { data, error } = await supabase
    .from('declaracions')
    .insert({
      user_id: userId,
      user_email: userEmail || '',
      client_nom: clientNom,
      client_nrt: clientNRT,
      exercici,
      estat: 'esborrany',
      dades: {},
      creat_en: now,
      modificat_en: now,
    })
    .select()
    .single();
  if (error) { console.error('novaDeclaracio:', error); return null; }
  return mapRow(data);
}

/**
 * Desa (actualitza) una declaració existent.
 * Retorna true si OK, false si error.
 */
export async function desarDeclaracio(id, { clientNom, clientNRT, exercici, dades, estat } = {}) {
  const update = { modificat_en: ara() };
  if (clientNom !== undefined) update.client_nom = clientNom;
  if (clientNRT !== undefined) update.client_nrt = clientNRT;
  if (exercici !== undefined) update.exercici = exercici;
  if (dades !== undefined) update.dades = dades;
  if (estat !== undefined) update.estat = estat;

  const { error } = await supabase
    .from('declaracions')
    .update(update)
    .eq('id', id);
  if (error) { console.error('desarDeclaracio:', error); return false; }
  return true;
}

/**
 * Duplica una declaració amb un nou ID
 * Retorna la nova declaració, o null si l'original no existeix
 */
export async function duplicarDeclaracio(id) {
  const original = await obtenirDeclaracio(id);
  if (!original) return null;

  const now = ara();
  const { data, error } = await supabase
    .from('declaracions')
    .insert({
      user_id: original.userId,
      user_email: original.userEmail,
      client_nom: `${original.clientNom} (còpia)`,
      client_nrt: original.clientNRT,
      exercici: original.exercici,
      estat: 'esborrany',
      dades: original.dades,
      creat_en: now,
      modificat_en: now,
    })
    .select()
    .single();
  if (error) { console.error('duplicarDeclaracio:', error); return null; }
  return mapRow(data);
}

/**
 * Elimina una declaració per ID
 * Retorna true si OK, false si error
 */
export async function eliminarDeclaracio(id) {
  const { error } = await supabase
    .from('declaracions')
    .delete()
    .eq('id', id);
  if (error) { console.error('eliminarDeclaracio:', error); return false; }
  return true;
}

/**
 * Marca una declaració com a finalitzada
 */
export async function finalitzarDeclaracio(id) {
  return desarDeclaracio(id, { estat: 'finalitzada' });
}

/**
 * Retorna el nombre de declaracions d'un usuari (o de tots si userId és null)
 */
export async function tamanyEmmagatzemat(userId) {
  const query = supabase
    .from('declaracions')
    .select('*', { count: 'exact', head: true });
  if (userId) query.eq('user_id', userId);
  const { count } = await query;
  return count || 0;
}
