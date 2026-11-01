// supabase/functions/_shared/area-client.ts
//
// Peces comunes de les Edge Functions de l'àrea de client: dades del JWT,
// comprovació de la sessió del client (rol portal_client, aal2 i sessió
// registrada, activa i dins del termini d'inactivitat) i avís per Formspree.

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { Resposta } from './portal.ts';
import T from './text-area-client.json' with { type: 'json' };

export const TEXTOS = T;

// Missatges de l'àrea (català / anglès)
export const M = {
  neutre: 'Aquest enllaç no és vàlid o ja s\'ha fet servir. / This link is not valid or has already been used.',
  credencials: 'Correu o contrasenya incorrectes. / Incorrect email or password.',
  codi: 'Codi incorrecte. / Incorrect code.',
  bloquejat: 'Massa intents fallits. Torneu-ho a provar més tard. / Too many failed attempts. Please try again later.',
  sessio: 'La sessió ha caducat. Torneu a entrar. / Your session has expired. Please log in again.',
  segonFactor: 'Cal verificar el segon factor. / Second-factor verification is required.',
  noAutoritzat: 'Accés no autoritzat. / Unauthorised access.',
  condicions: 'Cal acceptar les condicions d\'ús. / You must accept the terms of use.',
  intern: 'No s\'ha pogut completar l\'operació. Torneu-ho a provar més tard. / The operation could not be completed. Please try again later.',
};

export type Claims = { sub?: string; role?: string; aal?: string; session_id?: string; email?: string };

// Dades del JWT. Només es fa servir després de validar-lo amb getUser().
export const claims = (jwt: string): Claims => {
  try {
    const b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64 + '='.repeat((4 - b64.length % 4) % 4)), (c) => c.charCodeAt(0))));
  } catch {
    return {};
  }
};

export const jwtDe = (req: Request): string => (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');

export type SessioClient = {
  jwt: string;
  userId: string;
  sessionId: string;
  usuariId: string;
  calCondicions: boolean;
  versio: string;
};

// Comprova la sessió del client. Amb permetCondicions, accepta una sessió vàlida
// que encara ha d'acceptar la versió nova de les condicions (calCondicions).
export const verificaClient = async (
  req: Request,
  admin: SupabaseClient,
  resposta: Resposta,
  { permetCondicions = false }: { permetCondicions?: boolean } = {},
): Promise<SessioClient | Response> => {
  const jwt = jwtDe(req);
  if (!jwt) return resposta(401, { error: M.sessio, motiu: 'sessio' });
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return resposta(401, { error: M.sessio, motiu: 'sessio' });
  const c = claims(jwt);
  if (c.sub !== user.id || c.role !== 'portal_client') return resposta(403, { error: M.noAutoritzat });
  if (c.aal !== 'aal2' || !c.session_id) return resposta(401, { error: M.segonFactor, motiu: 'segon_factor' });

  const { data: estat, error: errEstat } = await admin.schema('portal').rpc('client_estat_sessio', {
    p_user_id: user.id, p_session_id: c.session_id, p_toca: true,
  });
  if (errEstat || !estat) return resposta(500, { error: M.intern });
  if (estat.motiu === 'condicions' && permetCondicions) {
    return { jwt, userId: user.id, sessionId: c.session_id, usuariId: estat.usuari_id, calCondicions: true, versio: estat.versio };
  }
  if (!estat.ok) {
    if (estat.motiu === 'condicions') return resposta(409, { error: M.condicions, motiu: 'condicions' });
    if (estat.motiu === 'bloquejat') return resposta(423, { error: M.bloquejat, motiu: 'bloquejat' });
    if (estat.motiu === 'usuari') return resposta(403, { error: M.noAutoritzat, motiu: 'usuari' });
    return resposta(401, { error: M.sessio, motiu: estat.motiu });
  }
  return { jwt, userId: user.id, sessionId: c.session_id, usuariId: estat.usuari_id, calCondicions: false, versio: estat.versio };
};

// ─── Avís al destinatari (Formspree), sense cap dada ────────────────────────
// Un formulari per destinatari: FORMSPREE_FORM_ID_<clau> (INFO, MPALEARI,
// MDELSOTO…); si no hi és, el FORMSPREE_FORM_ID general. Si falla, l'enviament
// ja és vàlid.
const FORMSPREE_BASE = Deno.env.get('FORMSPREE_BASE_URL') || 'https://formspree.io/f/';

export const COS_AVIS = { _subject: T.avis.assumpte, message: T.avis.text };

export const avisaDestinatari = async (clau: string | null): Promise<void> => {
  const id = (clau && Deno.env.get(`FORMSPREE_FORM_ID_${clau}`)) || Deno.env.get('FORMSPREE_FORM_ID');
  if (!id) return;
  try {
    const r = await fetch(`${FORMSPREE_BASE}${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(COS_AVIS),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.warn('Formspree ha respost', r.status);
  } catch (e) {
    console.warn('Formspree no disponible', (e as Error).name);
  }
};
