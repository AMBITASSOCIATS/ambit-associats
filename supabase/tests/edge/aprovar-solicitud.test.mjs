// Prova local de l'Edge Function aprovar-solicitud.
// Requisits: `supabase start` i `supabase functions serve` en marxa.
// Execució: node supabase/tests/edge/aprovar-solicitud.test.mjs
// Les claus locals es llegeixen de `supabase status -o env` i no s'imprimeixen.

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  execSync('supabase status -o env', { encoding: 'utf8' })
    .split('\n')
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const URL = env.API_URL;
const ANON = env.ANON_KEY;
const SERVICE = env.SERVICE_ROLE_KEY;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const nouClient = () => createClient(URL, ANON, { auth: { persistSession: false } });

let fallades = 0;
const comprova = (cond, nom) => {
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${nom}`);
  if (!cond) fallades++;
};

const sufix = Date.now();
const PASS = 'Prova-1234-local';
const correus = {
  maestro: `maestro-${sufix}@test.local`,
  normal: `normal-${sufix}@test.local`,
  nou: `nou-${sufix}@test.local`,
};

const creaUsuari = async (email, perfil) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true });
  if (error) throw error;
  if (perfil) {
    const { error: e } = await admin.from('profiles').insert({ id: data.user.id, email, ...perfil });
    if (e) throw e;
  }
  return data.user.id;
};

const idMaestro = await creaUsuari(correus.maestro, { rol: 'maestro', estat: 'actiu', eines: ['irpf'] });
await creaUsuari(correus.normal, { rol: 'individual', estat: 'actiu', eines: ['irpf'] });

const { data: sol, error: errSol } = await admin
  .from('solicituds')
  .insert({ nom: 'Usuari Nou', email: correus.nou, eines: ['irpf', 'bretxa'], estat: 'pendent' })
  .select()
  .single();
if (errSol) throw errSol;

// 1. Un usuari que no és maestro no pot aprovar
const normal = nouClient();
await normal.auth.signInWithPassword({ email: correus.normal, password: PASS });
const r1 = await normal.functions.invoke('aprovar-solicitud', {
  body: { solicitud_id: sol.id, contrasenya: 'Nova-1234-local', eines: ['irpf'] },
});
comprova(r1.error?.context?.status === 403, 'Usuari normal rep 403');

// 2. Sense sessió no es pot aprovar
const r2 = await nouClient().functions.invoke('aprovar-solicitud', {
  body: { solicitud_id: sol.id, contrasenya: 'Nova-1234-local', eines: ['irpf'] },
});
comprova(r2.error?.context?.status === 401, 'Sense sessió rep 401');

// 3. El maestro no pot colar eines inventades
const maestro = nouClient();
await maestro.auth.signInWithPassword({ email: correus.maestro, password: PASS });
const r3 = await maestro.functions.invoke('aprovar-solicitud', {
  body: { solicitud_id: sol.id, contrasenya: 'Nova-1234-local', eines: ['portal'] },
});
comprova(r3.error?.context?.status === 400, 'Eina no vàlida rep 400');

// 3b. Orígens permesos (ALLOWED_ORIGINS)
// Nota: en local, el gateway (Kong) respon ell mateix els OPTIONS i reescriu
// Access-Control-Allow-Origin a '*', així que aquí es comprova la decisió de
// la funció pel codi d'estat. La capçalera es verifica al Supabase real.
const FUNCIO = `${URL}/functions/v1/aprovar-solicitud`;
const { data: { session: sessioMaestro } } = await maestro.auth.getSession();
const cridaAmbOrigen = (origen, eines) => fetch(FUNCIO, {
  method: 'POST',
  headers: {
    Origin: origen,
    Authorization: `Bearer ${sessioMaestro.access_token}`,
    apikey: ANON,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ solicitud_id: sol.id, contrasenya: 'Nova-1234-local', eines }),
});

const postDolent = await cridaAmbOrigen('https://malicios.example', ['irpf']);
const cosDolent = await postDolent.json().catch(() => ({}));
comprova(postDolent.status === 403 && cosDolent.error === 'Origen no permès',
  'Origen desconegut rep 403 encara que el token sigui de maestro');

const postBo = await cridaAmbOrigen('https://www.ambit.ad', ['inventada']);
comprova(postBo.status === 400, 'Origen www.ambit.ad passa el filtre (arriba a validar les dades)');

const { data: solEncara } = await admin.from('solicituds').select('id').eq('id', sol.id).maybeSingle();
comprova(!!solEncara, 'La crida des d\'un origen desconegut no ha aprovat res');

// 4. Aprovació correcta
const r4 = await maestro.functions.invoke('aprovar-solicitud', {
  body: { solicitud_id: sol.id, contrasenya: 'Nova-1234-local', eines: ['irpf', 'bretxa'] },
});
comprova(r4.data?.ok === true, 'Maestro aprova la sol·licitud');

// 5. La sessió del maestro no ha canviat
const { data: { session } } = await maestro.auth.getSession();
const { data: { user: actual } } = await maestro.auth.getUser();
comprova(session?.user?.id === idMaestro && actual?.id === idMaestro,
  'La sessió del maestro continua sent la del maestro');

// 6. El compte nou existeix, amb correu confirmat, i pot entrar
const nou = nouClient();
const { data: login, error: errLogin } = await nou.auth.signInWithPassword({
  email: correus.nou,
  password: 'Nova-1234-local',
});
comprova(!errLogin && !!login.user?.email_confirmed_at, 'El compte nou pot entrar i té el correu confirmat');

// 7. La fitxa nova és activa, individual i amb les eines aprovades
const { data: perfilNou } = await admin
  .from('profiles').select('rol, estat, eines, empresa_id').eq('email', correus.nou).single();
comprova(
  perfilNou?.rol === 'individual' && perfilNou?.estat === 'actiu' &&
    perfilNou?.eines?.join(',') === 'irpf,bretxa' && perfilNou?.empresa_id === null,
  'Fitxa nova: individual, actiu, eines irpf+bretxa, sense empresa',
);

// 8. La sol·licitud s'ha esborrat
const { data: solDespres } = await admin.from('solicituds').select('id').eq('id', sol.id).maybeSingle();
comprova(solDespres === null, 'La sol·licitud s\'ha esborrat');

// 9. Tornar a aprovar la mateixa sol·licitud falla
const r9 = await maestro.functions.invoke('aprovar-solicitud', {
  body: { solicitud_id: sol.id, contrasenya: 'Nova-1234-local', eines: ['irpf'] },
});
comprova(r9.error?.context?.status === 404, 'Una sol·licitud ja aprovada no es pot tornar a aprovar');

// 10. Des del navegador, el maestro no pot assignar el rol maestro
const { data: perfilNouId } = await admin.from('profiles').select('id').eq('email', correus.nou).single();
const r10 = await maestro.rpc('maestro_actualitza_perfil', { p_id: perfilNouId.id, p_rol: 'maestro' });
comprova(!!r10.error, 'Maestro no pot assignar el rol maestro (RPC)');

// 11. El maestro sí pot bloquejar l'usuari nou
const r11 = await maestro.rpc('maestro_actualitza_perfil', { p_id: perfilNouId.id, p_estat: 'bloquejat' });
comprova(!r11.error, 'Maestro bloqueja un usuari');

// 12. L'usuari bloquejat no veu ni crea declaracions
const { data: declBloq } = await nou.from('declaracions').select('id');
const { error: errInsBloq } = await nou.from('declaracions').insert({ user_id: perfilNouId.id, client_nom: 'X' });
comprova((declBloq?.length ?? 0) === 0 && !!errInsBloq, 'Usuari bloquejat no llegeix ni crea declaracions');

// 13. L'usuari no es pot reactivar ell mateix
const { error: errAuto } = await nou.from('profiles').update({ estat: 'actiu' }).eq('id', perfilNouId.id);
comprova(!!errAuto, 'Usuari bloquejat no es pot reactivar ell mateix');

console.log(fallades === 0 ? '\nTotes les proves han passat.' : `\n${fallades} prova(es) han fallat.`);
process.exit(fallades === 0 ? 0 : 1);
