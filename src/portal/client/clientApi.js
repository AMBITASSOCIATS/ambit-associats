// src/portal/client/clientApi.js
// Àrea de client: client de Supabase propi (sessió a sessionStorage, separada
// de la de la web i del portal del personal) i crides a les Edge Functions
// portal-client-acces i portal-client-area.
import { createClient } from '@supabase/supabase-js';
import { REGIO_FUNCIONS } from '../../supabaseClient';
import T from './text-area-client.json';

export { T };

export const supabaseClient = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'ambit-area-client',
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Crida una Edge Function amb la sessió actual (o sense). Llança l'error del
// servidor (català / anglès) amb l'estat i el motiu. La regió va com a
// capçalera i com a paràmetre, igual que ho fa functions.invoke().
export const crida = async (funcio, body, jwt) => {
  const token = jwt || (await supabaseClient.auth.getSession()).data.session?.access_token || process.env.REACT_APP_SUPABASE_ANON_KEY;
  let r;
  try {
    r = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/${funcio}?forceFunctionRegion=${REGIO_FUNCIONS}`, {
      method: 'POST',
      headers: {
        apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-region': REGIO_FUNCIONS,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error('No s\'ha pogut connectar. Torneu-ho a provar. / Could not connect. Please try again.'), { status: 0 });
  }
  const dades = await r.json().catch(() => ({}));
  if (!r.ok || !dades.ok) {
    throw Object.assign(new Error(dades.error || 'Error inesperat / Unexpected error'), { status: r.status, motiu: dades.motiu });
  }
  return dades;
};

export const acces = (accio, cos = {}, jwt) => crida('portal-client-acces', { accio, ...cos }, jwt);
export const area = (accio, cos = {}) => crida('portal-client-area', { accio, ...cos });

// Desa la sessió que retorna l'Edge Function d'accés
export const desaSessio = (r) =>
  supabaseClient.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });

export const surt = async () => {
  try {
    await acces('surt');
  } catch { /* la sessió ja pot estar tancada */ }
  await supabaseClient.auth.signOut({ scope: 'local' });
};

// Fitxers admesos (el contingut real el comprova el servidor)
export const EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls', 'docx', 'doc', 'csv'];
export const MIMES = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', csv: 'text/csv',
};
export const MAX_FITXER = 20 * 1024 * 1024;
export const MAX_ENVIAMENT = 100 * 1024 * 1024;
export const MAX_FITXERS = 20;
export const extensio = (nom) => {
  const m = String(nom || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  return m && EXTENSIONS.includes(m[1]) ? m[1] : null;
};

export const mida = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} kB`);
export const data = (d) => (d ? new Date(d).toLocaleDateString('ca-AD', { timeZone: 'Europe/Andorra', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

// "**Objecte.** Text" → { negreta: 'Objecte.', text: ' Text' }
export const ambNegreta = (t) => {
  const m = t.match(/^\*\*(.+?)\*\*(.*)$/);
  return m ? { negreta: m[1], text: m[2] } : { negreta: '', text: t };
};
