// supabase/functions/portal-kyc-personal/index.ts
//
// KYC i protecció de dades · accions del personal que necessiten el servidor.
//
//   crea               (personal) crea la sol·licitud "KYC i protecció de dades"
//                      d'un client, amb documentacio 'client' (l'aporta el
//                      client) o 'ambit' (ja la té ÀMBIT). Amb revisio_de, la
//                      preomple amb el darrer KYC validat i hi copia els
//                      documents que no caduquen.
//   url_document_ambit (personal) URL signada per pujar un document que aporta
//                      ÀMBIT (abans de validar).
//   registra_document_ambit (personal) el comprova i el registra amb la data
//                      del document, la data de recepció i, si és un document
//                      d'identitat, la de caducitat. L'auditoria en registra
//                      qui l'adjunta.
//   retira_document_ambit (personal) el treu abans de validar (no s'esborra).
//   url_evidencia      (OCIC) URL signada per pujar l'evidència de la
//                      comprovació a les llistes de sancions.
//   registra_evidencia (OCIC) comprova el fitxer i el registra.
//   valida             (OCIC) valida el KYC amb la sessió de l'OCIC (la base
//                      aplica totes les regles) i, només llavors, genera:
//                      · el PDF intern validat (apartat d'ÀMBIT i validació);
//                      · la còpia per al client (sense l'apartat reservat, amb
//                        la recepció signada per l'OCIC).
//                      La firma manuscrita de l'OCIC és al bucket privat
//                      portal-firmes. Cap dels dos es lliura mai pel portal del
//                      client: es descarreguen des del panell.
//   pdf_final          (OCIC) genera els PDF finals que faltin.
//
// La validació la fa sempre la sessió de l'OCIC (clientUsuari): ni el
// servei ni un gestor no poden validar (ho impedeix la base).

import { clientAdmin, clientUsuari, entrada, llegeixCos, sha256Hex, text, verificaPersonal } from '../_shared/portal.ts';
import { generaPdfKyc } from '../_shared/pdf-kyc.ts';

const BUCKET = 'portal-docs';
const MAX_ADJUNT = 20 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ESTAT_ERROR: Record<string, number> = { '42501': 403, 'P0002': 404, '23514': 400, '23505': 409, '22023': 400, '22007': 400, '22008': 400, '22P02': 400 };

const TIPUS_ADJUNT: Record<string, { ext: string; magic: number[] }> = {
  'application/pdf': { ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  'image/jpeg':      { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  'image/png':       { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
};
const comencaAmb = (b: Uint8Array, m: number[]) => m.every((v, i) => b[i] === v);

Deno.serve(async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const portal = admin.schema('portal');
  const cos = (await llegeixCos<Record<string, unknown>>(req)) || {};
  const accio = String(cos.accio || '');
  const nivell = ['crea', 'url_document_ambit', 'registra_document_ambit', 'retira_document_ambit'].includes(accio) ? 'personal' : 'ocic';

  const personal = await verificaPersonal(req, admin, resposta, nivell);
  if (personal instanceof Response) return personal;
  const usuari = clientUsuari(personal.jwt).schema('portal');

  // Els missatges de les funcions SQL són per al personal (català, sense dades sensibles)
  const errorSql = (e: { code?: string; message?: string }, on: string) => {
    console.error(on, e.code);
    const estat = ESTAT_ERROR[e.code || ''];
    return resposta(estat || 500, { error: estat ? e.message : 'Error intern' });
  };

  const requestId = String(cos.request_id || '');

  // ─── crea ───
  if (accio === 'crea') {
    const clientId = String(cos.client_id || '');
    const revisioDe = cos.revisio_de ? String(cos.revisio_de) : null;
    if (!UUID.test(clientId) || (revisioDe && !UUID.test(revisioDe))) return resposta(400, { error: 'Falta el client' });

    const { data: id, error } = await usuari.rpc('crea_kyc', {
      p_client_id: clientId, p_revisio_de: revisioDe, p_motiu: text(cos.motiu, 500),
      p_documentacio_ambit: cos.documentacio === 'ambit',
    });
    if (error) return errorSql(error, 'crea_kyc');

    // Revisió: còpia dels documents que no caduquen (camins nous, mateixa empremta)
    let copiats = 0;
    if (revisioDe) {
      const { data: aCopiar, error: errC } = await portal.rpc('kyc_adjunts_a_copiar', { p_actor: personal.userId, p_request_id: id });
      if (errC) return errorSql(errC, 'kyc_adjunts_a_copiar');
      for (const d of (aCopiar || []) as { document_id: string; storage_path: string; mime: string }[]) {
        const ext = d.storage_path.split('.').pop();
        const nou = `requests/${id}/adjunts/${crypto.randomUUID()}.${ext}`;
        const { error: errCopia } = await admin.storage.from(BUCKET).copy(d.storage_path, nou);
        if (errCopia) { console.error('copia', errCopia.message); continue; }
        const { error: errReg } = await portal.rpc('kyc_copia_adjunt', {
          p_actor: personal.userId, p_request_id: id, p_document_origen: d.document_id, p_nou_path: nou,
        });
        if (errReg) { console.error('kyc_copia_adjunt', errReg.code); continue; }
        copiats++;
      }
    }
    return resposta(200, { ok: true, request_id: id, documents_copiats: copiats });
  }

  if (!UUID.test(requestId)) return resposta(400, { error: 'Falta la sol·licitud' });

  // ─── url_evidencia ───
  if (accio === 'url_evidencia') {
    const t = TIPUS_ADJUNT[String(cos.mime || '')];
    if (!t) return resposta(400, { error: 'Format no admès: PDF, JPG o PNG' });
    const mida = Number(cos.mida);
    if (!Number.isFinite(mida) || mida <= 0 || mida > MAX_ADJUNT) return resposta(400, { error: 'El fitxer no pot superar els 20 MB' });
    const { data: sol } = await portal.from('requests').select('status, document_type, bloquejat_at').eq('id', requestId).maybeSingle();
    if (!sol || !['kyc_pf', 'kyc_pj'].includes(sol.document_type) || sol.status !== 'signat' || sol.bloquejat_at) {
      return resposta(409, { error: 'Només es poden adjuntar evidències a un KYC pendent de validació' });
    }
    const path = `requests/${requestId}/ocic/${crypto.randomUUID()}.${t.ext}`;
    const { data: pujada, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !pujada) return resposta(500, { error: 'No s\'ha pogut preparar la pujada' });
    return resposta(200, { ok: true, path, upload_token: pujada.token });
  }

  // ─── registra_evidencia ───
  if (accio === 'registra_evidencia') {
    const path = String(cos.path || '');
    if (!new RegExp(`^requests/${requestId}/ocic/[0-9a-f-]{36}\\.(pdf|jpg|png)$`).test(path)) {
      return resposta(400, { error: 'Fitxer no vàlid' });
    }
    const { data: fitxer, error: errBaixa } = await admin.storage.from(BUCKET).download(path);
    if (errBaixa || !fitxer) return resposta(400, { error: 'No s\'ha trobat el fitxer; torneu-lo a pujar' });
    const bytes = new Uint8Array(await fitxer.arrayBuffer());
    const ext = path.split('.').pop();
    const [mime, t] = Object.entries(TIPUS_ADJUNT).find(([, x]) => x.ext === ext)!;
    if (bytes.length === 0 || bytes.length > MAX_ADJUNT || !comencaAmb(bytes, t.magic)) {
      return resposta(400, { error: 'El fitxer no és un PDF, JPG o PNG vàlid' });
    }
    const { data: id, error } = await portal.rpc('kyc_registra_evidencia', {
      p_actor: personal.userId, p_request_id: requestId, p_path: path,
      p_sha256: await sha256Hex(bytes), p_mida: bytes.length, p_mime: mime,
    });
    if (error) return errorSql(error, 'kyc_registra_evidencia');
    return resposta(200, { ok: true, document_id: id });
  }

  // ─── Documents aportats per ÀMBIT ───
  const dataValida = (v: unknown): string | null => {
    const t = String(v || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
    const d = new Date(`${t}T12:00:00Z`);
    return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? null : t;
  };
  if (accio === 'url_document_ambit') {
    const t = TIPUS_ADJUNT[String(cos.mime || '')];
    if (!t) return resposta(400, { error: 'Format no admès: PDF, JPG o PNG' });
    const mida = Number(cos.mida);
    if (!Number.isFinite(mida) || mida <= 0 || mida > MAX_ADJUNT) return resposta(400, { error: 'El fitxer no pot superar els 20 MB' });
    const path = `requests/${requestId}/ambit/${crypto.randomUUID()}.${t.ext}`;
    const { data: pujada, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !pujada) return resposta(500, { error: 'No s\'ha pogut preparar la pujada' });
    return resposta(200, { ok: true, path, upload_token: pujada.token });
  }
  if (accio === 'registra_document_ambit') {
    const path = String(cos.path || '');
    if (!new RegExp(`^requests/${requestId}/ambit/[0-9a-f-]{36}\\.(pdf|jpg|png)$`).test(path)) {
      return resposta(400, { error: 'Fitxer no vàlid' });
    }
    const dataDocument = dataValida(cos.data_document);
    const rebutEl = dataValida(cos.rebut_el);
    if (!dataDocument || !rebutEl) return resposta(400, { error: 'Cal indicar la data del document i la data de recepció' });
    const { data: fitxer, error: errBaixa } = await admin.storage.from(BUCKET).download(path);
    if (errBaixa || !fitxer) return resposta(400, { error: 'No s\'ha trobat el fitxer; torneu-lo a pujar' });
    const bytes = new Uint8Array(await fitxer.arrayBuffer());
    const ext = path.split('.').pop();
    const [mime, t] = Object.entries(TIPUS_ADJUNT).find(([, x]) => x.ext === ext)!;
    if (bytes.length === 0 || bytes.length > MAX_ADJUNT || !comencaAmb(bytes, t.magic)) {
      return resposta(400, { error: 'El fitxer no és un PDF, JPG o PNG vàlid' });
    }
    const persona = cos.persona ? String(cos.persona) : null;
    if (persona && !UUID.test(persona)) return resposta(400, { error: 'Persona no vàlida' });
    const { data: docs, error } = await portal.rpc('kyc_registra_adjunt_ambit', {
      p_actor: personal.userId, p_request_id: requestId, p_path: path, p_sha256: await sha256Hex(bytes),
      p_mida: bytes.length, p_mime: mime, p_tipus: String(cos.tipus || ''), p_persona: persona,
      p_nom_fitxer: text(cos.nom_fitxer, 200), p_data_document: dataDocument, p_rebut_el: rebutEl,
      p_data_caducitat: dataValida(cos.data_caducitat),
    });
    if (error) return errorSql(error, 'kyc_registra_adjunt_ambit');
    return resposta(200, { ok: true, documents: docs });
  }
  if (accio === 'retira_document_ambit') {
    const id = String(cos.adjunt_id || '');
    if (!UUID.test(id)) return resposta(400, { error: 'Document no vàlid' });
    const { data: docs, error } = await portal.rpc('kyc_retira_adjunt_ambit', { p_actor: personal.userId, p_request_id: requestId, p_adjunt_id: id });
    if (error) return errorSql(error, 'kyc_retira_adjunt_ambit');
    return resposta(200, { ok: true, documents: docs });
  }

  // Genera els PDF finals amb la firma de l'OCIC (només després de validar)
  const generaFinal = async (): Promise<Response> => {
    const { data: x, error } = await portal.rpc('kyc_dades_pdf_validat', { p_actor: personal.userId, p_request_id: requestId });
    if (error) return errorSql(error, 'kyc_dades_pdf_validat');
    if (!x.firma) return resposta(409, { error: 'L\'OCIC no té la firma manuscrita registrada' });

    const [firmaClient, firmaOcic] = await Promise.all([
      admin.storage.from(BUCKET).download(x.signatura.imatge_path),
      admin.storage.from('portal-firmes').download(x.firma.imatge_path),
    ]);
    if (firmaClient.error || !firmaClient.data || firmaOcic.error || !firmaOcic.data) {
      return resposta(500, { error: 'No s\'han pogut llegir les firmes' });
    }
    const pngClient = new Uint8Array(await firmaClient.data.arrayBuffer());
    const imgOcic = new Uint8Array(await firmaOcic.data.arrayBuffer());
    if (await sha256Hex(imgOcic) !== x.firma.sha256) return resposta(500, { error: 'La firma de l\'OCIC no coincideix amb la registrada' });

    const v = x.validacio;
    const signat = (x.documents as { kind: string; sha256: string }[]).find((d) => d.kind === 'signat');
    const comuns = {
      tipus: x.request.document_type,
      requestId,
      pdpRequestId: x.formulari.pdp_request_id,
      referenciaClient: x.client.referencia_client,
      clientNom: x.client.nom_mostrat,
      templateVersion: x.request.template_version,
      dades: x.formulari.dades,
      // Al PDF validat i a la còpia només hi consten els documents vigents
      adjunts: (x.adjunts || []).filter((a: Record<string, unknown>) => a.valid !== false).map((a: Record<string, unknown>) => ({
        tipus: a.tipus as string, persona: a.persona as string | null, nom_fitxer: a.nom_fitxer as string | null, sha256: a.sha256 as string,
        aportat_per_ambit: a.aportat_per_ambit === true, rebut_el: a.rebut_el as string | null, data_document: a.data_document as string | null,
      })),
      signatura: {
        signatariNom: x.signatura.signatari_nom,
        signatariCarrec: x.signatura.signatari_carrec,
        lloc: x.signatura.lloc,
        signatAt: new Date(x.signatura.signat_at),
        ip: x.signatura.ip,
        userAgent: x.signatura.user_agent,
        empremtaDades: x.signatura.empremta_dades,
        png: pngClient,
        sha256: await sha256Hex(pngClient),
      },
    };
    const ref = x.client.referencia_client || requestId.slice(0, 8);
    const desa = async (pdf: Uint8Array, kind: 'validat' | 'copia_client') => {
      const sha = await sha256Hex(pdf);
      const path = `requests/${requestId}/${kind === 'validat' ? 'validat' : 'copia-client'}/${crypto.randomUUID()}.pdf`;
      const { error: errPuja } = await admin.storage.from(BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: false });
      if (errPuja) return { error: 'No s\'ha pogut desar el PDF final' };
      const { error: errReg } = await portal.rpc('registra_pdf_validat', {
        p_actor: personal.userId, p_request_id: requestId, p_path: path, p_sha256: sha, p_mida: pdf.length, p_kind: kind,
      });
      if (errReg) return { errReg };
      const nom = kind === 'validat' ? `KYC-validat-intern-${ref}.pdf` : `KYC-copia-client-${ref}.pdf`;
      const { data: url } = await admin.storage.from(BUCKET).createSignedUrl(path, 60, { download: nom });
      return { sha256: sha, url: url?.signedUrl ?? null };
    };

    const resultat: Record<string, unknown> = { ok: true };
    // 1. Versió interna validada: apartat reservat i full de validació
    if (!x.te_validat) {
      const r = await desa(await generaPdfKyc({
        ...comuns,
        mode: 'intern',
        validacio: {
          ...v,
          validat_at: new Date(v.validat_at),
          sancions_evidencia_sha256: x.evidencia.sha256,
          ocicNom: x.firma.nom,
          firmaOcic: imgOcic,
          firmaOcicSha256: x.firma.sha256,
          pdfSignatSha256: signat?.sha256 || '—',
        },
      }), 'validat');
      if ('errReg' in r) return errorSql(r.errReg!, 'registra_pdf_validat');
      if ('error' in r) return resposta(500, { error: r.error });
      resultat.pdf_final = r;
    }
    // 2. Còpia per al client: sense l'apartat reservat; només la recepció
    //    (data de validació i firma de l'OCIC), cap dada de la validació
    if (!x.te_copia) {
      const r = await desa(await generaPdfKyc({
        ...comuns,
        mode: 'copia',
        recepcio: { data: new Date(v.validat_at), nom: x.firma.nom, firma: imgOcic },
      }), 'copia_client');
      if ('errReg' in r) return errorSql(r.errReg!, 'registra_pdf_validat');
      if ('error' in r) return resposta(500, { error: r.error });
      resultat.copia_client = r;
    }
    return resposta(200, resultat);
  };

  // ─── valida ───
  if (accio === 'valida') {
    // Sense firma registrada no es valida (el PDF final ha de portar la firma)
    const { data: firma } = await portal.from('firmes_ocic').select('id').eq('user_id', personal.userId).maybeSingle();
    if (!firma) return resposta(409, { error: 'Abans de validar cal registrar la teva firma manuscrita (vegeu el pla de publicació)' });

    const camps = ['nivell', 'justificacio', 'verificacio_via', 'verificacio_data', 'verificacio_persona', 'sancions_data',
      'sancions_altres', 'sancions_resultat', 'sancions_evidencia_id', 'rbe_data', 'rbe_resultat', 'alta_direccio_nom', 'alta_direccio_data'];
    const p: Record<string, string | string[] | null> = {};
    for (const k of camps) {
      const v = cos[k];
      p[k] = v === undefined || v === null || v === '' ? null : text(v, k === 'justificacio' || k === 'sancions_resultat' ? 2000 : 500);
    }
    // Llistes de sancions fixes marcades (la base exigeix que hi siguin totes)
    p.sancions_llistes_marcades = Array.isArray(cos.sancions_llistes_marcades)
      ? cos.sancions_llistes_marcades.map((x) => String(x)).filter((x) => /^[a-z0-9_]{2,30}$/.test(x)).slice(0, 10)
      : [];
    const { data: r, error } = await usuari.rpc('valida_kyc', { p_request_id: requestId, p });
    if (error) return errorSql(error, 'valida_kyc');
    if (!r?.ok) return resposta(403, { error: r?.error || 'No s\'ha pogut validar', motiu: r?.motiu });
    return generaFinal();
  }

  // ─── pdf_final ───
  if (accio === 'pdf_final') return generaFinal();

  return resposta(400, { error: 'Acció no vàlida' });
});
