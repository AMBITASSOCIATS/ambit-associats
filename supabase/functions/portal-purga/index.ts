// supabase/functions/portal-purga/index.ts
//
// Conservació del portal (art. 30 i 70.1 Llei 29/2021). La crida cada dia
// pg_cron (portal.llanca_purga) amb el secret de Vault portal_purga_secret a
// la capçalera x-portal-purga. No és per al navegador.
// El secret el genera i el guarda la base; aquí no se'l coneix: es comprova
// amb portal.secret_purga_correcte(), que només respon cert o fals.
//
//   { "simulacio": true }   (per defecte) només llista què es bloquejaria i
//                           què es destruiria, sense canviar res.
//   { "simulacio": false }  1. bloqueja les sol·licituds vençudes;
//                           2. per a cada sol·licitud destruïble, esborra els
//                              seus fitxers de portal-docs (Storage API) i
//                              després les files (portal.destrueix_solicitud).
//
// ÚNICA EXCEPCIÓ a la regla "service_role no esborra mai fitxers de
// portal-docs": aquesta funció, i només els fitxers que
// portal.candidats_destruccio() dona per destruïbles (bloquejades, termini de
// bloqueig passat, sense retenció).
//
// Idempotent: si falla a mitges, la propera execució acaba la feina. Esborrar
// un fitxer que ja no hi és no falla, i la funció SQL no esborra cap fila
// mentre quedi algun fitxer de la sol·licitud.
//
// Àrea de client (mateixa execució, després de les sol·licituds):
//   3. fitxers dels enviaments vençuts (30 dies després d'arxivar-los i, en tot
//      cas, 90 dies després de rebre'ls; pujades no acabades i rebutjats):
//      s'esborren del bucket client-enviaments i en queda un registre mínim
//      sense dades personals (portal.client_destrueix_enviament);
//   4. usuaris revocats passat termini_revocats: se n'esborren les dades i el
//      registre d'accessos (portal.client_destrueix_usuari) i, després, el
//      compte d'Auth (Admin API).
// També aquí, només els fitxers i comptes que la base dona per destruïbles.
//
// Formularis de la web (portal.purga_formularis_web):
//   5. missatges de contacte de més de 12 mesos, sol·licituds d'accés
//      rebutjades fa més de 12 mesos i límits de peticions (empremtes d'IP) de
//      més d'un dia.

import { clientAdmin, entrada, llegeixCos } from '../_shared/portal.ts';

const BUCKET = 'portal-docs';
const BUCKET_CLIENT = 'client-enviaments';
const LOT = 100;

Deno.serve(async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const portal = admin.schema('portal');

  const rebut = req.headers.get('x-portal-purga') || '';
  if (rebut.length < 32 || rebut.length > 256) return resposta(401, { error: 'No autoritzat' });
  const { data: correcte, error: errSecret } = await portal.rpc('secret_purga_correcte', { p_rebut: rebut });
  if (errSecret || correcte !== true) return resposta(401, { error: 'No autoritzat' });

  const cos = (await llegeixCos<{ simulacio?: boolean }>(req)) || {};
  const simulacio = cos.simulacio !== false;

  if (simulacio) {
    const { data, error } = await portal.rpc('simula_conservacio');
    if (error) return resposta(500, { error: 'Error en la simulació' });
    const { data: client, error: errClient } = await portal.rpc('client_simula_conservacio');
    if (errClient) return resposta(500, { error: 'Error en la simulació' });
    const { data: web, error: errWeb } = await portal.rpc('purga_formularis_web', { p_simulacio: true });
    if (errWeb) return resposta(500, { error: 'Error en la simulació' });
    return resposta(200, { ok: true, simulacio: true, ...data, area_client: client, formularis_web: web });
  }

  // 1. Bloqueig
  const { data: bloquejades, error: errBloq } = await portal.rpc('bloqueja_vencudes', { p_simulacio: false });
  if (errBloq) {
    console.error('bloqueja_vencudes', errBloq.code);
    return resposta(500, { error: 'Error en el bloqueig' });
  }

  // 2. Destrucció
  const { data: candidats, error: errCand } = await portal.rpc('candidats_destruccio');
  if (errCand) {
    console.error('candidats_destruccio', errCand.code);
    return resposta(500, { error: 'Error en llistar les destruccions' });
  }

  const destruides: string[] = [];
  const errors: { request_id: string; pas: string }[] = [];
  for (const c of candidats as { request_id: string; fitxers: string[]; registrats: number }[]) {
    let esborrats = true;
    for (let i = 0; i < c.fitxers.length; i += LOT) {
      const { error } = await admin.storage.from(BUCKET).remove(c.fitxers.slice(i, i + LOT));
      if (error) { esborrats = false; break; }
    }
    if (!esborrats) {
      errors.push({ request_id: c.request_id, pas: 'fitxers' });
      continue;
    }
    const { error } = await portal.rpc('destrueix_solicitud', {
      p_request_id: c.request_id,
      p_altres_fitxers: Math.max(c.fitxers.length - c.registrats, 0),
    });
    if (error) {
      console.error('destrueix_solicitud', c.request_id, error.code);
      errors.push({ request_id: c.request_id, pas: 'files' });
      continue;
    }
    destruides.push(c.request_id);
  }

  // 3. Àrea de client: fitxers dels enviaments
  const enviaments: string[] = [];
  const { data: aDestruir, error: errEnv } = await portal.rpc('client_enviaments_a_destruir');
  if (errEnv) {
    console.error('client_enviaments_a_destruir', errEnv.code);
    errors.push({ request_id: 'area-client', pas: 'enviaments' });
  }
  for (const e of (aDestruir || []) as { enviament_id: string; fitxers: string[] }[]) {
    let esborrats = true;
    for (let i = 0; i < e.fitxers.length; i += LOT) {
      const { error } = await admin.storage.from(BUCKET_CLIENT).remove(e.fitxers.slice(i, i + LOT));
      if (error) { esborrats = false; break; }
    }
    const { error } = esborrats ? await portal.rpc('client_destrueix_enviament', { p_enviament_id: e.enviament_id }) : { error: true };
    if (error) {
      errors.push({ request_id: e.enviament_id, pas: esborrats ? 'enviament' : 'fitxers enviament' });
      continue;
    }
    enviaments.push(e.enviament_id);
  }

  // 4. Àrea de client: usuaris revocats i, després, els seus comptes d'Auth
  const usuaris: string[] = [];
  const { data: revocats, error: errRev } = await portal.rpc('client_usuaris_a_destruir');
  if (errRev) errors.push({ request_id: 'area-client', pas: 'usuaris' });
  for (const u of (revocats || []) as { usuari_id: string }[]) {
    const { error } = await portal.rpc('client_destrueix_usuari', { p_usuari_id: u.usuari_id });
    if (error) {
      console.error('client_destrueix_usuari', error.code);
      errors.push({ request_id: u.usuari_id, pas: 'usuari' });
      continue;
    }
    usuaris.push(u.usuari_id);
  }
  const { data: comptes } = await portal.rpc('client_comptes_pendents');
  for (const userId of (comptes || []) as string[]) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && error.status !== 404) {
      errors.push({ request_id: userId, pas: 'compte' });
      continue;
    }
    const { error: errFi } = await portal.rpc('client_compte_esborrat', { p_user_id: userId });
    if (errFi) errors.push({ request_id: userId, pas: 'compte' });
  }

  // 5. Formularis de la web i límits de peticions
  const { data: web, error: errWeb } = await portal.rpc('purga_formularis_web', { p_simulacio: false });
  if (errWeb) {
    console.error('purga_formularis_web', errWeb.code);
    errors.push({ request_id: 'formularis-web', pas: 'purga' });
  }

  const resum = {
    ok: errors.length === 0,
    simulacio: false,
    bloquejades: (bloquejades as unknown[]).length,
    destruides,
    area_client: { enviaments, usuaris },
    formularis_web: web,
    errors,
  };
  console.log('portal-purga', JSON.stringify({
    bloquejades: resum.bloquejades, destruides: destruides.length,
    enviaments: enviaments.length, usuaris: usuaris.length, formularis_web: web, errors: errors.length,
  }));
  return resposta(errors.length ? 207 : 200, resum);
});
