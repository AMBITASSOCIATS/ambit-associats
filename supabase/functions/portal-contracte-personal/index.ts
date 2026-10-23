// supabase/functions/portal-contracte-personal/index.ts
//
// Contractes · accions del personal que necessiten el servidor.
//
//   crea              (personal) crea el contracte en esborrany des d'un
//                     client: títol, idioma ('ca' o 'ca_en') i signants (nom,
//                     correu i qualitat). Amb la sessió del personal.
//   url_original      (personal) URL signada per pujar el PDF original
//                     (només application/pdf, màxim 20 MB).
//   registra_original (personal) comprova que és un PDF vàlid, sense xifrar ni
//                     contrasenya, i que s'hi poden afegir les pàgines de
//                     signatura sense modificar-lo; en calcula l'empremta i el
//                     registra. L'original no se substitueix mai.
//   enllac            (personal) enllaç d'un signant (/contracte/<token>). Si el
//                     contracte és un esborrany, el passa a 'enviat' amb la
//                     sessió del personal. Regenerar revoca l'anterior del
//                     mateix signant.
//   contrafirma       (només mpaleari@ambit.ad, amb la seva sessió) signa en
//                     nom d'ÀMBIT quan han signat tots els signants i, només
//                     llavors, genera el PDF final: l'original intacte i, a
//                     continuació, la clàusula addicional, les signatures i el
//                     full d'evidències.
//   pdf_final         (el mateix signant d'ÀMBIT) genera el PDF final si encara
//                     no existeix (p. ex. si la generació havia fallat).
//
// La firma d'ÀMBIT només s'estampa després de la signatura feta amb la sessió
// del signant d'ÀMBIT (ho exigeix la base). Mai no es lliura pel portal del
// client: el PDF final el descarrega el personal des del panell.

import { clientAdmin, clientUsuari, entrada, llegeixCos, nouToken, provaFalla, serveix, sha256Hex, text, verificaPersonal } from '../_shared/portal.ts';
import { comprovaOriginal, MAX_ORIGINAL } from '../_shared/contracte-regles.ts';
import { generaPdfContracte } from '../_shared/pdf-contracte.ts';

const BUCKET = 'portal-docs';
const DIES_CADUCITAT = 7;
const BASE = (Deno.env.get('PORTAL_BASE_URL') || 'https://www.ambit.ad').replace(/\/+$/, '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CORREU = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ESTAT_ERROR: Record<string, number> = { '42501': 403, 'P0002': 404, '23514': 400, '23505': 409, '22023': 400, '22P02': 400 };

serveix('portal-contracte-personal', async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const portal = admin.schema('portal');
  const cos = (await llegeixCos<Record<string, unknown>>(req)) || {};
  const accio = String(cos.accio || '');
  const nivell = ['contrafirma', 'pdf_final'].includes(accio) ? 'ocic' : 'personal';

  const personal = await verificaPersonal(req, admin, resposta, nivell);
  if (personal instanceof Response) return personal;
  const usuari = clientUsuari(personal.jwt).schema('portal');

  // Els missatges de les funcions SQL són per al personal (català, sense dades sensibles)
  const errorSql = (e: { code?: string; message?: string }, on: string) => {
    console.error(on, e.code);
    const estat = ESTAT_ERROR[e.code || ''];
    return resposta(estat || 500, { error: estat ? e.message : 'Error intern' });
  };

  // ─── crea ───
  if (accio === 'crea') {
    const clientId = String(cos.client_id || '');
    if (!UUID.test(clientId)) return resposta(400, { error: 'Falta el client' });
    const titol = text(cos.titol, 300);
    if (!titol) return resposta(400, { error: 'Falta el títol del contracte' });
    if (cos.idioma !== 'ca' && cos.idioma !== 'ca_en') return resposta(400, { error: 'Cal triar l\'idioma' });
    const llista = Array.isArray(cos.signants) ? cos.signants : [];
    if (llista.length < 1 || llista.length > 20) return resposta(400, { error: 'Cal indicar entre 1 i 20 signants' });
    const signants = [];
    for (const s of llista as Record<string, unknown>[]) {
      const nom = text(s?.nom, 200);
      const email = text(s?.email, 200)?.toLowerCase() || null;
      const qualitat = text(s?.qualitat, 300);
      if (!nom || !email || !CORREU.test(email) || !qualitat) {
        return resposta(400, { error: 'Cada signant necessita nom i cognoms, un correu vàlid i la qualitat' });
      }
      signants.push({ nom, email, qualitat });
    }
    const { data: id, error } = await usuari.rpc('contracte_crea', {
      p_client_id: clientId, p_titol: titol, p_idioma: cos.idioma, p_signants: signants,
    });
    if (error) return errorSql(error, 'contracte_crea');
    return resposta(200, { ok: true, request_id: id });
  }

  const requestId = String(cos.request_id || '');

  // ─── url_original ───
  if (accio === 'url_original') {
    if (!UUID.test(requestId)) return resposta(400, { error: 'Falta la sol·licitud' });
    if (cos.mime !== 'application/pdf') return resposta(400, { error: 'Només s\'admeten fitxers PDF' });
    const mida = Number(cos.mida);
    if (!Number.isFinite(mida) || mida <= 0 || mida > MAX_ORIGINAL) return resposta(400, { error: 'El PDF no pot superar els 20 MB' });
    const { data: sol } = await portal.from('requests').select('status, document_type, bloquejat_at').eq('id', requestId).maybeSingle();
    if (!sol || sol.document_type !== 'contracte' || sol.status !== 'esborrany' || sol.bloquejat_at) {
      return resposta(409, { error: 'Només es pot pujar l\'original a un contracte en esborrany' });
    }
    const { data: ja } = await portal.from('contracte_originals').select('id').eq('request_id', requestId).maybeSingle();
    if (ja) return resposta(409, { error: 'Aquest contracte ja té el PDF original; per canviar-lo, cal anul·lar-lo i crear-ne un altre' });
    const path = `requests/${requestId}/original/${crypto.randomUUID()}.pdf`;
    const { data: pujada, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !pujada) return resposta(500, { error: 'No s\'ha pogut preparar la pujada' });
    return resposta(200, { ok: true, path, upload_token: pujada.token });
  }

  // ─── registra_original ───
  if (accio === 'registra_original') {
    if (!UUID.test(requestId)) return resposta(400, { error: 'Falta la sol·licitud' });
    const path = String(cos.path || '');
    if (!new RegExp(`^requests/${requestId}/original/[0-9a-f-]{36}\\.pdf$`).test(path)) return resposta(400, { error: 'Fitxer no vàlid' });
    const { data: fitxer, error: errBaixa } = await admin.storage.from(BUCKET).download(path);
    if (errBaixa || !fitxer) return resposta(400, { error: 'No s\'ha trobat el fitxer; torneu-lo a pujar' });
    const bytes = new Uint8Array(await fitxer.arrayBuffer());
    const c = await comprovaOriginal(bytes);
    if (!c.ok) return resposta(400, { error: c.error, codi: c.codi });
    const nom = (text(cos.nom_fitxer, 200) || 'contracte.pdf').replace(/[\\/]/g, '_');
    const sha = await sha256Hex(bytes);
    const { error } = await portal.rpc('contracte_registra_original', {
      p_actor: personal.userId, p_request_id: requestId, p_path: path, p_sha256: sha,
      p_mida: bytes.length, p_nom_fitxer: nom, p_pagines: c.pagines,
    });
    if (error) return errorSql(error, 'contracte_registra_original');
    return resposta(200, { ok: true, sha256: sha, pagines: c.pagines, mida: bytes.length });
  }

  // ─── enllac ───
  if (accio === 'enllac') {
    const signantId = String(cos.signant_id || '');
    if (!UUID.test(signantId)) return resposta(400, { error: 'Falta el signant' });
    const { data: s } = await portal.from('contracte_signants').select('id, request_id, nom, email, signat_at').eq('id', signantId).maybeSingle();
    if (!s) return resposta(404, { error: 'Signant inexistent' });
    const { data: sol } = await portal.from('requests').select('id, status, document_type').eq('id', s.request_id).maybeSingle();
    if (!sol || sol.document_type !== 'contracte') return resposta(404, { error: 'Signant inexistent' });
    if (s.signat_at) return resposta(409, { error: 'Aquest signant ja ha signat' });

    // 1. esborrany → enviat, amb la sessió del personal (la base comprova l'original i els signants)
    if (sol.status === 'esborrany') {
      const { error } = await usuari.from('requests')
        .update({ status: 'enviat', enviat_at: new Date().toISOString() })
        .eq('id', sol.id);
      if (error) return errorSql(error, 'enviat');
    }

    // 2. Token nou del signant (revoca l'anterior del mateix signant)
    const token = nouToken();
    const expira = new Date(Date.now() + DIES_CADUCITAT * 24 * 3600 * 1000);
    const { error: errTok } = await portal.rpc('contracte_crea_token', {
      p_actor: personal.userId, p_signant_id: signantId, p_token_hash: await sha256Hex(token), p_expira_at: expira.toISOString(),
    });
    if (errTok) return errorSql(errTok, 'contracte_crea_token');
    const { data: k } = await portal.from('contractes').select('titol, idioma').eq('request_id', sol.id).maybeSingle();
    return resposta(200, {
      ok: true, enllac: `${BASE}/contracte/${token}`, expira_at: expira.toISOString(),
      nom: s.nom, email: s.email, titol: k?.titol ?? '', idioma: k?.idioma ?? 'ca',
    });
  }

  if (!UUID.test(requestId)) return resposta(400, { error: 'Falta la sol·licitud' });

  // Genera el PDF final amb la firma d'ÀMBIT (només després de la signatura d'ÀMBIT)
  const generaFinal = async (): Promise<Response> => {
    const { data: x, error } = await portal.rpc('contracte_dades_pdf_final', { p_actor: personal.userId, p_request_id: requestId });
    if (error) return errorSql(error, 'contracte_dades_pdf_final');
    const cf = x.contrafirma;
    const baixa = async (bucket: string, path: string, sha: string): Promise<Uint8Array | null> => {
      const { data, error: e } = await admin.storage.from(bucket).download(path);
      if (e || !data) return null;
      const b = new Uint8Array(await data.arrayBuffer());
      return (await sha256Hex(b)) === sha ? b : null;
    };
    // Cada fitxer es comprova amb l'empremta registrada
    const original = await baixa(BUCKET, x.original.storage_path, x.original.sha256);
    if (!original) return resposta(500, { error: 'El PDF original no coincideix amb l\'empremta registrada' });
    const firmaAmbit = await baixa('portal-firmes', cf.imatge_path, cf.imatge_sha256);
    if (!firmaAmbit) return resposta(500, { error: 'La firma d\'ÀMBIT no coincideix amb la registrada' });
    const signants = [];
    for (const s of x.signants as Record<string, any>[]) {
      const png = await baixa(BUCKET, s.imatge_path, s.imatge_sha256);
      if (!png) return resposta(500, { error: 'Una firma no coincideix amb l\'empremta registrada' });
      signants.push({
        ordre: s.ordre, nom: s.nom, qualitat: s.qualitat, lloc: s.lloc,
        acceptatAt: new Date(s.acceptat_at), signatAt: new Date(s.signat_at), ip: s.ip, userAgent: s.user_agent,
        empremtaDades: s.empremta_dades, png, sha256: s.imatge_sha256,
      });
    }

    // Primer el PDF; només si s'ha generat, es puja i es registra
    provaFalla(req, 'pdf');
    const pdf = await generaPdfContracte(original, {
      requestId,
      idioma: x.contracte.idioma,
      titol: x.contracte.titol,
      clientNom: x.client.nom_mostrat,
      partyType: x.client.party_type,
      templateVersion: x.request.template_version,
      original: { nomFitxer: x.original.nom_fitxer, pagines: x.original.pagines, sha256: x.original.sha256, mida: x.original.mida_bytes },
      signants,
      ambit: { nom: cf.nom, carrec: cf.carrec, signatAt: new Date(cf.signat_at), imatge: firmaAmbit, sha256: cf.imatge_sha256 },
    });
    // L'original ha de quedar intacte al principi del PDF final
    if (!original.every((v, i) => pdf[i] === v)) return resposta(500, { error: 'No s\'ha pogut generar el document' });
    const sha = await sha256Hex(pdf);
    const path = `requests/${requestId}/signat/${crypto.randomUUID()}.pdf`;
    const { error: errPuja } = await admin.storage.from(BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: false });
    if (errPuja) return resposta(500, { error: 'No s\'ha pogut desar el PDF final' });
    const { error: errReg } = await portal.rpc('contracte_registra_pdf_final', {
      p_actor: personal.userId, p_request_id: requestId, p_path: path, p_sha256: sha, p_mida: pdf.length,
    });
    if (errReg) return errorSql(errReg, 'contracte_registra_pdf_final');
    const ref = x.client.referencia_client || requestId.slice(0, 8);
    const { data: url } = await admin.storage.from(BUCKET).createSignedUrl(path, 60, { download: `Contracte-signat-${ref}.pdf` });
    return resposta(200, { ok: true, pdf_final: { sha256: sha, url: url?.signedUrl ?? null } });
  };

  // ─── contrafirma ───
  if (accio === 'contrafirma') {
    // Amb la sessió del signant d'ÀMBIT: la base comprova qui és i que han signat tots
    const { error } = await usuari.rpc('contrafirma_contracte', { p_request_id: requestId });
    if (error) return errorSql(error, 'contrafirma_contracte');
    return generaFinal();
  }

  // ─── pdf_final ───
  if (accio === 'pdf_final') return generaFinal();

  return resposta(400, { error: 'Acció no vàlida' });
});
