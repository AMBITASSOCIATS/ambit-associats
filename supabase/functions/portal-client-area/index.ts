// supabase/functions/portal-client-area/index.ts
//
// Àrea de client (/client). Sessió del client amb segon factor (aal2), rol
// portal_client i sessió registrada i activa (verificaClient). Les consultes es
// fan amb la sessió del client (RLS i funcions que tornen a comprovar la
// sessió); el servei només genera URL signades i comprova els fitxers.
//
//   inici                                       usuari, clients vinculats, destinataris
//                                               (o cal_condicions si hi ha una versió nova)
//   enviaments { client_id }                    els meus enviaments
//   documents  { client_id }                    els meus documents (només els tipus permesos)
//   descarrega { document_id }                  URL signada de 60 s
//   prepara    { client_id, destinatari_id, assumpte, comentari, fitxers: [{ nom, mida }] }
//                                               crea l'enviament i retorna URL signades de pujada
//   confirma   { enviament_id }                 comprova el contingut real de cada fitxer, la mida i
//                                               l'empremta; l'enviament queda enviat i s'avisa el
//                                               destinatari (Formspree, sense cap dada)

import { clientAdmin, clientUsuari, entrada, llegeixCos, serveix, sha256Hex } from '../_shared/portal.ts';
import { M, avisaDestinatari, verificaClient } from '../_shared/area-client.ts';

const T = { destinatariNoDisponible: 'No disponible temporalment / Temporarily unavailable' };
import { MAX_ENVIAMENT, MAX_FITXER, MAX_FITXERS, comprovaContingut, extensio, nomNet } from '../_shared/fitxers-client.js';

const SEGONS_DESCARREGA = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const NOM_DOCUMENT: Record<string, string> = {
  contracte: 'Contracte',
  kyc_pf: 'KYC-copia-client',
  kyc_pj: 'KYC-copia-client',
  pdp: 'Proteccio-dades',
  autoritzacio_carrec: 'Autoritzacio-carrec',
};

const errorSql = (code?: string) =>
  code === '42501' ? 403 : code === 'P0002' ? 404 : code === '23514' || code === '22023' ? 400 : 500;

serveix('portal-client-area', async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const cos = (await llegeixCos<Record<string, unknown>>(req)) || {};
  const accio = String(cos.accio || '');

  const sessio = await verificaClient(req, admin, resposta, { permetCondicions: accio === 'inici' });
  if (sessio instanceof Response) return sessio;
  if (sessio.calCondicions) return resposta(200, { ok: true, cal_condicions: true, versio: sessio.versio });

  // Consultes amb la sessió del client (rol portal_client)
  const client = clientUsuari(sessio.jwt).schema('portal');
  const missatgeSql = (e: { code?: string; message?: string }) =>
    errorSql(e.code) === 500 ? M.intern : e.code === '42501' ? M.noAutoritzat : e.message;

  if (accio === 'inici') {
    const { data, error } = await client.rpc('client_inici');
    if (error) return resposta(errorSql(error.code), { error: missatgeSql(error) });
    return resposta(200, { ok: true, ...data });
  }

  if (accio === 'enviaments' || accio === 'documents') {
    const clientId = String(cos.client_id || '');
    if (!UUID.test(clientId)) return resposta(400, { error: M.noAutoritzat });
    const { data, error } = await client.rpc(accio === 'enviaments' ? 'client_enviaments_llista' : 'client_documents_llista', { p_client_id: clientId });
    if (error) return resposta(errorSql(error.code), { error: missatgeSql(error) });
    return resposta(200, { ok: true, [accio]: data });
  }

  if (accio === 'descarrega') {
    const documentId = String(cos.document_id || '');
    if (!UUID.test(documentId)) return resposta(404, { error: M.noAutoritzat });
    const { data, error } = await client.rpc('client_document_cami', { p_document_id: documentId });
    if (error || !data) return resposta(404, { error: 'Document no disponible. / Document not available.' });
    const nom = `${NOM_DOCUMENT[data.tipus] || 'Document'}-${String(data.data).slice(0, 10)}.pdf`;
    const { data: url } = await admin.storage.from('portal-docs').createSignedUrl(data.storage_path, SEGONS_DESCARREGA, { download: nom });
    if (!url?.signedUrl) return resposta(500, { error: M.intern });
    return resposta(200, { ok: true, url: url.signedUrl, nom_fitxer: nom });
  }

  if (accio === 'prepara') {
    const fitxers = Array.isArray(cos.fitxers) ? cos.fitxers as { nom?: string; mida?: number }[] : [];
    if (fitxers.length < 1 || fitxers.length > MAX_FITXERS) {
      return resposta(400, { error: 'Cal adjuntar entre 1 i 20 fitxers. / Please attach between 1 and 20 files.' });
    }
    const nets = [];
    let total = 0;
    for (const f of fitxers) {
      const nom = nomNet(f.nom);
      const ext = extensio(nom);
      const mida = Number(f.mida);
      if (!ext) return resposta(400, { error: `Tipus de fitxer no admès: ${nom} / File type not accepted: ${nom}` });
      if (!Number.isInteger(mida) || mida < 1) return resposta(400, { error: `El fitxer és buit: ${nom} / The file is empty: ${nom}` });
      if (mida > MAX_FITXER) return resposta(400, { error: `El fitxer supera els 20 MB: ${nom} / The file exceeds 20 MB: ${nom}` });
      total += mida;
      nets.push({ nom, extensio: ext, mida });
    }
    if (total > MAX_ENVIAMENT) return resposta(400, { error: 'L\'enviament supera els 100 MB. / The submission exceeds 100 MB.' });
    const assumpte = String(cos.assumpte || '').trim();
    if (!assumpte || assumpte.length > 120) {
      return resposta(400, { error: 'L\'assumpte és obligatori (màxim 120 caràcters). / The subject is required (maximum 120 characters).' });
    }
    const comentari = String(cos.comentari || '').trim();
    if (comentari.length > 2000) return resposta(400, { error: 'El comentari és massa llarg (màxim 2.000 caràcters). / The comment is too long (maximum 2,000 characters).' });

    const { data, error } = await client.rpc('client_enviament_crea', {
      p_client_id: String(cos.client_id || ''), p_destinatari_id: String(cos.destinatari_id || ''),
      p_assumpte: assumpte, p_comentari: comentari, p_fitxers: nets,
    });
    if (error) {
      if (error.code === '23514' && /Destinatari/.test(error.message || '')) {
        return resposta(400, { error: T.destinatariNoDisponible });
      }
      return resposta(errorSql(error.code), { error: missatgeSql(error) });
    }
    const pujades = [];
    for (const f of data.fitxers as { id: string; storage_path: string; mime: string }[]) {
      const { data: s, error: e } = await admin.storage.from('client-enviaments').createSignedUploadUrl(f.storage_path);
      if (e || !s) return resposta(500, { error: M.intern });
      pujades.push({ id: f.id, url: s.signedUrl, mime: f.mime });
    }
    return resposta(200, { ok: true, enviament_id: data.enviament_id, pujades });
  }

  if (accio === 'confirma') {
    const enviamentId = String(cos.enviament_id || '');
    if (!UUID.test(enviamentId)) return resposta(400, { error: M.noAutoritzat });
    const { data: env } = await admin.schema('portal').from('client_enviaments')
      .select('id, estat, usuari_id, client_enviament_fitxers(id, ordre, nom_fitxer, extensio, storage_path)')
      .eq('id', enviamentId).maybeSingle();
    if (!env || env.usuari_id !== sessio.usuariId || env.estat !== 'pujant') return resposta(404, { error: M.noAutoritzat });

    const fitxers = (env.client_enviament_fitxers as { id: string; ordre: number; nom_fitxer: string; extensio: string; storage_path: string }[])
      .sort((a, b) => a.ordre - b.ordre);
    const camins = fitxers.map((f) => f.storage_path);
    const rebutja = async (motiu: string, nom?: string) => {
      await admin.storage.from('client-enviaments').remove(camins);
      await admin.schema('portal').rpc('client_enviament_rebutja', { p_user_id: sessio.userId, p_enviament_id: enviamentId });
      return resposta(422, { error: nom ? `${nom}: ${motiu}` : motiu });
    };

    const verificats = [];
    let total = 0;
    for (const f of fitxers) {
      const { data: blob, error } = await admin.storage.from('client-enviaments').download(f.storage_path);
      if (error || !blob) return rebutja('No s\'ha rebut el fitxer. Torneu-lo a enviar. / The file was not received. Please send it again.', f.nom_fitxer);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const motiu = comprovaContingut(f.extensio, bytes);
      if (motiu) return rebutja(motiu, f.nom_fitxer);
      total += bytes.length;
      if (total > MAX_ENVIAMENT) return rebutja('L\'enviament supera els 100 MB. / The submission exceeds 100 MB.');
      verificats.push({ id: f.id, sha256: await sha256Hex(bytes), mida: bytes.length });
    }

    const { data: clau, error } = await admin.schema('portal').rpc('client_enviament_registra', {
      p_user_id: sessio.userId, p_enviament_id: enviamentId, p_fitxers: verificats,
    });
    if (error) {
      console.error('client_enviament_registra', error.code);
      if (error.code === '23514' && /Destinatari/.test(error.message || '')) return rebutja(T.destinatariNoDisponible);
      return rebutja(M.intern);
    }
    await avisaDestinatari(clau);
    return resposta(200, { ok: true });
  }

  return resposta(400, { error: 'Acció no vàlida' });
});
