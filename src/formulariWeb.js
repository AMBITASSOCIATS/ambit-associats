// src/formulariWeb.js
// Formularis públics de la web (contacte i sol·licitud d'accés). Les dades van
// a Supabase per la funció web-formulari; Formspree només rep un avís sense dades.
import { supabase, REGIO_FUNCIONS } from './supabaseClient';

// Llança l'error amb el missatge del servidor si no s'ha pogut desar.
export const enviaFormulari = async (body) => {
  const { data, error } = await supabase.functions.invoke('web-formulari', { body, region: REGIO_FUNCIONS });
  if (error) {
    const detall = await error.context?.json?.().catch(() => null);
    throw new Error(detall?.error || error.message);
  }
  if (!data?.ok) throw new Error(data?.error || 'Error inesperat');
};
