// supabase/functions/portal-purga/index.ts
//
// Conservació del portal (art. 30 i 70.1 Llei 29/2021). La crida cada dia
// pg_cron (portal.llanca_purga) amb el secret PORTAL_PURGA_SECRET a la
// capçalera x-portal-purga. No és per al navegador.
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

import { clientAdmin, entrada, llegeixCos, sha256Hex } from '../_shared/portal.ts';

const BUCKET = 'portal-docs';
const LOT = 100;

// Comparació del secret sense filtrar-ne la longitud ni el contingut pel temps de resposta
const secretCorrecte = async (rebut: string, esperat: string) => {
  const [a, b] = await Promise.all([sha256Hex(rebut), sha256Hex(esperat)]);
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
};

Deno.serve(async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const esperat = Deno.env.get('PORTAL_PURGA_SECRET') || '';
  const rebut = req.headers.get('x-portal-purga') || '';
  if (esperat.length < 32 || !(await secretCorrecte(rebut, esperat))) {
    return resposta(401, { error: 'No autoritzat' });
  }

  const cos = (await llegeixCos<{ simulacio?: boolean }>(req)) || {};
  const simulacio = cos.simulacio !== false;
  const admin = clientAdmin();
  const portal = admin.schema('portal');

  if (simulacio) {
    const { data, error } = await portal.rpc('simula_conservacio');
    if (error) return resposta(500, { error: 'Error en la simulació' });
    return resposta(200, { ok: true, simulacio: true, ...data });
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

  const resum = {
    ok: errors.length === 0,
    simulacio: false,
    bloquejades: (bloquejades as unknown[]).length,
    destruides,
    errors,
  };
  console.log('portal-purga', JSON.stringify({ bloquejades: resum.bloquejades, destruides: destruides.length, errors: errors.length }));
  return resposta(errors.length ? 207 : 200, resum);
});
