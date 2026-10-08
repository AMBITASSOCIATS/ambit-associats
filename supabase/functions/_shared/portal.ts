// supabase/functions/_shared/portal.ts
//
// Peces comunes de les Edge Functions del portal de signatura: orígens
// permesos (igual que aprovar-solicitud), respostes, comprovació del personal,
// IBAN andorrà i xifratge AES-256-GCM de l'IBAN.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

// ─── Orígens i respostes ────────────────────────────────────────────────────

// Orígens permesos, separats per comes (variable d'entorn ALLOWED_ORIGINS).
// Si no està definida, no se n'accepta cap des del navegador.
const ORIGENS_PERMESOS = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const capcaleresCors = (origen: string | null): Record<string, string> => ({
  ...(origen && ORIGENS_PERMESOS.includes(origen) ? { 'Access-Control-Allow-Origin': origen } : {}),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

export type Resposta = (status: number, body: Record<string, unknown>) => Response;

// Filtre comú d'entrada. Retorna una resposta si la petició s'ha d'aturar aquí
// (origen no permès, OPTIONS o mètode no permès) i la funció per respondre.
export const entrada = (req: Request): { atura: Response | null; resposta: Resposta; cors: Record<string, string> } => {
  const origen = req.headers.get('Origin');
  const cors = capcaleresCors(origen);
  const resposta: Resposta = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  // Una petició des d'un navegador d'un origen no permès es rebutja sempre.
  if (origen && !ORIGENS_PERMESOS.includes(origen)) {
    return { atura: resposta(403, { error: 'Origen no permès' }), resposta, cors };
  }
  if (req.method === 'OPTIONS') return { atura: new Response('ok', { headers: cors }), resposta, cors };
  if (req.method !== 'POST') return { atura: resposta(405, { error: 'Mètode no permès' }), resposta, cors };
  return { atura: null, resposta, cors };
};

export const clientAdmin = (): SupabaseClient =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

// Client amb la sessió de qui crida (rol authenticated): per als canvis que la
// base exigeix que faci el personal amb la seva pròpia sessió.
export const clientUsuari = (jwt: string): SupabaseClient =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    },
  );

export const llegeixCos = async <T>(req: Request): Promise<T | null> => {
  try {
    return await req.json() as T;
  } catch {
    return null;
  }
};

// IP del client (primera de x-forwarded-for). Només IPv4 o IPv6 ben formades,
// perquè la base la desa com a inet.
export const ipClient = (req: Request): string | null => {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return v4.slice(1).every((n) => Number(n) <= 255) ? ip : null;
  return /^[0-9a-fA-F]{0,4}(:[0-9a-fA-F]{0,4}){2,7}$/.test(ip) ? ip : null;
};

// ─── Personal del portal ────────────────────────────────────────────────────

export type Personal = { userId: string; role: 'ocic' | 'gestor'; jwt: string };

// Comprova sessió, personal actiu a portal.staff_profiles i, si cal, rol OCIC.
export const verificaPersonal = async (
  req: Request,
  admin: SupabaseClient,
  resposta: Resposta,
  nivell: 'personal' | 'ocic',
): Promise<Personal | Response> => {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return resposta(401, { error: 'Cal iniciar sessió' });

  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return resposta(401, { error: 'Sessió no vàlida' });

  const { data: staff } = await admin
    .schema('portal')
    .from('staff_profiles')
    .select('role, actiu')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!staff?.actiu) return resposta(403, { error: 'Accés no autoritzat' });
  if (nivell === 'ocic' && staff.role !== 'ocic') {
    return resposta(403, { error: 'Només el personal OCIC pot fer aquesta acció' });
  }
  return { userId: user.id, role: staff.role, jwt };
};

// ─── Utilitats de bytes ─────────────────────────────────────────────────────

export const aHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const deHex = (hex: string): Uint8Array => {
  const net = hex.replace(/^\\x/, '');
  const out = new Uint8Array(net.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(net.slice(i * 2, i * 2 + 2), 16);
  return out;
};

// bytea per a PostgREST
export const aBytea = (bytes: Uint8Array): string => `\\x${aHex(bytes)}`;

export const sha256Hex = async (dades: Uint8Array | string): Promise<string> => {
  const bytes = typeof dades === 'string' ? new TextEncoder().encode(dades) : dades;
  return aHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
};

export const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const deBase64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// Token de l'enllaç: 32 bytes aleatoris. A la base només se'n desa el hash.
export const nouToken = (): string => base64url(crypto.getRandomValues(new Uint8Array(32)));
export const formatToken = /^[A-Za-z0-9_-]{43}$/;

// ─── IBAN andorrà ───────────────────────────────────────────────────────────

export const ENTITATS: Record<string, 'andbank' | 'creand' | 'morabanc'> = {
  '0001': 'andbank',
  '0003': 'creand',
  '0007': 'morabanc',
};

export const NOM_ENTITAT: Record<string, string> = {
  andbank: 'Andbank',
  creand: 'Creand',
  morabanc: 'MoraBanc',
};

const mod97 = (s: string): number => {
  let r = 0;
  for (const c of s) {
    const v = /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c;
    for (const d of v) r = (r * 10 + Number(d)) % 97;
  }
  return r;
};

export type ResultatIban =
  | { ok: true; iban: string; entitat: 'andbank' | 'creand' | 'morabanc' }
  | { ok: false; error: string };

export const validaIban = (entrada: unknown): ResultatIban => {
  const iban = String(entrada ?? '').replace(/\s+/g, '').toUpperCase();
  if (!iban.startsWith('AD')) return { ok: false, error: 'L\'IBAN ha de ser andorrà (AD)' };
  if (iban.length !== 24) return { ok: false, error: 'L\'IBAN andorrà ha de tenir 24 caràcters' };
  if (!/^AD\d{2}\d{8}[0-9A-Z]{12}$/.test(iban)) return { ok: false, error: 'L\'IBAN conté caràcters no vàlids' };
  if (mod97(iban.slice(4) + iban.slice(0, 4)) !== 1) {
    return { ok: false, error: 'Els dígits de control de l\'IBAN no són correctes' };
  }
  const entitat = ENTITATS[iban.slice(4, 8)];
  if (!entitat) return { ok: false, error: 'Entitat no admesa: només Andbank, Creand o MoraBanc' };
  return { ok: true, iban, entitat };
};

export const formataIban = (iban: string): string => iban.replace(/(.{4})/g, '$1 ').trim();

// ─── Xifratge de l'IBAN (AES-256-GCM) ───────────────────────────────────────
// Format desat a iban_xifrat: versió (1 byte) · IV (12 bytes) · xifrat + etiqueta.
// L'identificador de la sol·licitud va com a dades addicionals autenticades:
// un IBAN xifrat no es pot copiar a una altra sol·licitud.

const VERSIO_XIFRAT = 1;

const clauIban = async (): Promise<CryptoKey> => {
  const b64 = Deno.env.get('PORTAL_IBAN_KEY');
  if (!b64) throw new Error('Falta PORTAL_IBAN_KEY');
  const crua = deBase64(b64.trim());
  if (crua.length !== 32) throw new Error('PORTAL_IBAN_KEY ha de tenir 32 bytes');
  return crypto.subtle.importKey('raw', crua, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

export const xifraIban = async (iban: string, requestId: string): Promise<Uint8Array> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const xifrat = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(requestId) },
    await clauIban(),
    new TextEncoder().encode(iban),
  ));
  const out = new Uint8Array(1 + iv.length + xifrat.length);
  out[0] = VERSIO_XIFRAT;
  out.set(iv, 1);
  out.set(xifrat, 1 + iv.length);
  return out;
};

export const desxifraIban = async (dades: Uint8Array, requestId: string): Promise<string> => {
  if (dades[0] !== VERSIO_XIFRAT) throw new Error('Versió de xifrat desconeguda');
  const clar = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: dades.slice(1, 13), additionalData: new TextEncoder().encode(requestId) },
    await clauIban(),
    dades.slice(13),
  );
  return new TextDecoder().decode(clar);
};

// ─── Text lliure ────────────────────────────────────────────────────────────

// Neteja un camp de text: sense caràcters de control, espais simples, longitud màxima.
export const text = (v: unknown, max = 200): string | null => {
  if (v === null || v === undefined) return null;
  const net = String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return net ? net.slice(0, max) : null;
};
