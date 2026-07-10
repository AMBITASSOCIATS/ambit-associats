// engine/DeclaracionsSupabase.js
// Capa de persistència de declaracions via Supabase
// Substitueix DeclaracionsStorage.js (localStorage)

import { supabase } from '../../supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNS
// ─────────────────────────────────────────────────────────────────────────────

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
    creatEn: row.creat_el,
    modificatEn: row.modificat_el,
    dades: row.dades || {},
  };
}

// Normalitza un NRT per comparar identitat de client: majúscules, sense guions
// ni espais. NOMÉS per comparar — el NRT es desa i es mostra tal com l'introdueix
// l'usuari (amb guions).
export function normalitzarNRT(nrt) {
  return (nrt || '').toUpperCase().replace(/[\s-]/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna declaracions ordenades per data de modificació (més recent primer).
 * Si isMaestro és true, retorna TOTES les declaracions de tots els usuaris.
 * Si isMaestro és false, filtra per user_id.
 */
export async function llistarDeclaracions(userId, isMaestro = false) {
  console.log('llistarDeclaracions called:', { userId, isMaestro });
  let query = supabase
    .from('declaracions')
    .select('*')
    .order('modificat_el', { ascending: false });
  if (!isMaestro) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query;
  if (error) { console.error('llistarDeclaracions:', JSON.stringify(error)); return []; }
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
  if (error) { console.error('obtenirDeclaracio:', JSON.stringify(error)); return null; }
  return mapRow(data);
}

/**
 * Crea una nova declaració buida i la desa
 * Retorna la declaració creada, o null si error
 */
export async function novaDeclaracio(clientNom = '', clientNRT = '', exercici = 2025, userId) {
  console.log('novaDeclaracio called:', { clientNom, clientNRT, exercici, userId });
  const { data, error } = await supabase
    .from('declaracions')
    .insert({
      client_nom: clientNom,
      client_nrt: clientNRT,
      exercici,
      estat: 'esborrany',
      dades: {},
      user_id: userId,
      creat_el: new Date().toISOString(),
      modificat_el: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    console.error('Error creant declaració:', JSON.stringify(error));
    return null;
  }
  console.log('Declaració creada:', data);
  return mapRow(data);
}

/**
 * Crea una nova declaració d'un altre exercici DERIVADA d'una d'existent.
 * Copia sempre les dades de client i parella. Si ambSaldos=true (només cas
 * posterior 2025→2025+), deriva els saldos pendents (bases negatives i
 * deduccions) amb pendent = max(0, pendentInici − aplicat) > 0, conservant
 * l'exercici de generació original. La resta de dades queden en blanc
 * (el wizard aplica DEFAULT_DADES en obrir). Deixa marca d'origen (Fase 3).
 * Retorna la fila creada (mapRow) o null si error.
 */
export async function crearDeclaracioDerivada({ origen, exerciciDesti, ambSaldos = false }) {
  if (!origen) return null;
  const d = origen.dades || {};

  // Client + parella (sempre) + marca d'origen (preparació Fase 3)
  const dades = {
    estatCivil: d.estatCivil,
    conjugeNom: d.conjugeNom,
    conjugeNRT: d.conjugeNRT,
    conjugeRendesGenerals: d.conjugeRendesGenerals,
    origenExercici: origen.exercici,
    origenId: origen.id,
  };

  // Saldos derivats (només posterior 2025→2025+)
  if (ambSaldos) {
    const derivar = (arr, campFutur) => (arr || [])
      .map(f => ({ f, pendent: Math.max(0, (f.pendentInici || 0) - (f.aplicat || 0)) }))
      .filter(x => x.pendent > 0)
      .map(x => ({ exercici: x.f.exercici, pendentInici: x.pendent, aplicat: 0, [campFutur]: x.pendent }));
    dades.basesNegGenerals = derivar(d.basesNegGenerals, 'pendentFuturs');
    dades.basesNegEstalvi = derivar(d.basesNegEstalvi, 'pendentFuturs');
    dades.deduccionsAnteriors = derivar(d.deduccionsAnteriors, 'diferit');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('declaracions')
    .insert({
      user_id: origen.userId,
      client_nom: origen.clientNom,
      client_nrt: origen.clientNRT,
      exercici: exerciciDesti,
      estat: 'esborrany',
      dades,
      creat_el: now,
      modificat_el: now,
    })
    .select()
    .single();
  if (error) { console.error('crearDeclaracioDerivada:', JSON.stringify(error)); return null; }
  return mapRow(data);
}

/**
 * Desa (actualitza) una declaració existent.
 * Retorna true si OK, false si error.
 */
export async function desarDeclaracio(id, { clientNom, clientNRT, exercici, dades, estat } = {}) {
  const update = { modificat_el: new Date().toISOString() };
  if (clientNom !== undefined) update.client_nom = clientNom;
  if (clientNRT !== undefined) update.client_nrt = clientNRT;
  if (exercici !== undefined) update.exercici = exercici;
  if (dades !== undefined) update.dades = dades;
  if (estat !== undefined) update.estat = estat;

  const { error } = await supabase
    .from('declaracions')
    .update(update)
    .eq('id', id);
  if (error) { console.error('desarDeclaracio:', JSON.stringify(error)); return false; }
  return true;
}

/**
 * Duplica una declaració amb un nou ID
 * Retorna la nova declaració, o null si l'original no existeix
 */
export async function duplicarDeclaracio(id) {
  const original = await obtenirDeclaracio(id);
  if (!original) return null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('declaracions')
    .insert({
      user_id: original.userId,
      client_nom: `${original.clientNom} (còpia)`,
      client_nrt: original.clientNRT,
      exercici: original.exercici,
      estat: 'esborrany',
      dades: original.dades,
      creat_el: now,
      modificat_el: now,
    })
    .select()
    .single();
  if (error) { console.error('duplicarDeclaracio:', JSON.stringify(error)); return null; }
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
  if (error) { console.error('eliminarDeclaracio:', JSON.stringify(error)); return false; }
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
