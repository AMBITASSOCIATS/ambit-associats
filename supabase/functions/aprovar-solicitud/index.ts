// supabase/functions/aprovar-solicitud/index.ts
//
// Aprova una sol·licitud d'accés: crea el compte (correu ja confirmat, amb la
// contrasenya que fixa el maestro), crea la fitxa activa amb les eines
// aprovades i esborra la sol·licitud.
//
// Es fa al servidor amb service_role perquè el navegador del maestro no canviï
// de sessió (abans supabase.auth.signUp() el deixava connectat com l'usuari nou).
// Només el pot cridar un maestro actiu de public.profiles. No dona cap accés al
// portal de signatura.

import { createClient } from 'npm:@supabase/supabase-js@2';

const EINES_VALIDES = ['irpf', 'bretxa'];

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

Deno.serve(async (req) => {
  const origen = req.headers.get('Origin');
  const corsHeaders = capcaleresCors(origen);
  const resposta = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // Una petició des d'un navegador d'un origen no permès es rebutja sempre.
  // Les peticions sense Origin (no navegador) continuen necessitant un maestro.
  if (origen && !ORIGENS_PERMESOS.includes(origen)) {
    return resposta(403, { error: 'Origen no permès' });
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return resposta(405, { error: 'Mètode no permès' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 1. Qui crida ha de ser un maestro actiu
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return resposta(401, { error: 'Cal iniciar sessió' });

  const { data: { user: crida }, error: errUser } = await admin.auth.getUser(jwt);
  if (errUser || !crida) return resposta(401, { error: 'Sessió no vàlida' });

  const { data: perfilCrida } = await admin
    .from('profiles')
    .select('rol, estat')
    .eq('id', crida.id)
    .maybeSingle();
  if (perfilCrida?.rol !== 'maestro' || perfilCrida?.estat !== 'actiu') {
    return resposta(403, { error: 'Només un maestro actiu pot aprovar sol·licituds' });
  }

  // 2. Validar dades d'entrada
  let body: { solicitud_id?: string; contrasenya?: string; eines?: string[] };
  try {
    body = await req.json();
  } catch {
    return resposta(400, { error: 'Cos de la petició no vàlid' });
  }
  const { solicitud_id, contrasenya, eines } = body;

  if (!solicitud_id) return resposta(400, { error: 'Falta la sol·licitud' });
  if (!contrasenya || contrasenya.length < 8) {
    return resposta(400, { error: 'La contrasenya ha de tenir almenys 8 caràcters' });
  }
  if (!Array.isArray(eines) || eines.length === 0 || !eines.every((e) => EINES_VALIDES.includes(e))) {
    return resposta(400, { error: 'Eines no vàlides' });
  }

  const { data: sol } = await admin
    .from('solicituds')
    .select('id, nom, email, estat')
    .eq('id', solicitud_id)
    .maybeSingle();
  if (!sol) return resposta(404, { error: 'Sol·licitud inexistent' });
  if (sol.estat !== 'pendent') return resposta(409, { error: 'La sol·licitud ja no està pendent' });

  // 3. Crear el compte amb el correu ja confirmat
  const { data: creat, error: errCrear } = await admin.auth.admin.createUser({
    email: sol.email,
    password: contrasenya,
    email_confirm: true,
    user_metadata: { nom: sol.nom },
  });
  if (errCrear || !creat?.user) {
    return resposta(400, { error: errCrear?.message || 'No s\'ha pogut crear el compte' });
  }

  // 4. Crear la fitxa activa; si falla, desfer el compte
  const { error: errPerfil } = await admin.from('profiles').insert({
    id: creat.user.id,
    email: sol.email,
    nom: sol.nom,
    rol: 'individual',
    estat: 'actiu',
    eines,
  });
  if (errPerfil) {
    await admin.auth.admin.deleteUser(creat.user.id);
    return resposta(500, { error: 'No s\'ha pogut crear el perfil' });
  }

  // 5. Esborrar la sol·licitud
  const { error: errSol } = await admin.from('solicituds').delete().eq('id', sol.id);
  if (errSol) console.warn('Compte creat però no s\'ha pogut esborrar la sol·licitud', sol.id);

  return resposta(200, { ok: true, user_id: creat.user.id });
});
