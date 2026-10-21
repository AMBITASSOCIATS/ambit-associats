// supabase/functions/portal-irpf-personal/index.ts
//
// Comunicació de dades al pagador (IRPF) · accions del personal que
// necessiten el servidor.
//
//   calcula   (personal) calcula el percentatge de retenció (art. 24.1 del
//             Reglament) amb els paràmetres de l'exercici de la data
//             d'efectes, les retribucions anuals estimades i les cotitzacions
//             que indica el personal, i les dades de la comunicació rebuda
//             (o sense comunicació, art. 24.4). Si n'hi ha un d'anterior del
//             mateix exercici, aplica la regularització de l'art. 25.
//             La situació del cònjuge segueix els arts. 27.1.b, 28.3 i 31.d
//             (irpf-calcul.js) amb la data en què el pagador va rebre la
//             comunicació; una variació s'aplica des del mes següent a la data
//             en què el pagador la coneix (data_coneixement; per defecte, la de
//             recepció de la comunicació nova).
//             Amb previsualitza: només retorna el resultat. Si no, genera el
//             PDF d'ÀMBIT amb el full intern del càlcul i ho desa tot en una
//             sola transacció (el càlcul no es modifica mai: un de nou el
//             substitueix des de la seva data d'efectes).
//
// El càlcul és el d'irpf-calcul.js (la mateixa còpia que el panell).

import { clientAdmin, entrada, llegeixCos, sha256Hex, verificaPersonal } from '../_shared/portal.ts';
import { generaPdfIrpf } from '../_shared/pdf-irpf.ts';
import { calcula } from '../_shared/irpf-calcul.js';
import { netejaImport } from '../_shared/irpf-regles.js';

const BUCKET = 'portal-docs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ESTAT_ERROR: Record<string, number> = { '42501': 403, 'P0002': 404, '23514': 400, '23505': 409, '22023': 400, '40001': 409, '22P02': 400 };

const dataValida = (v: unknown): string | null => {
  const t = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? null : t;
};
const dataAndorra = (d: string) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });

Deno.serve(async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const portal = admin.schema('portal');
  const personal = await verificaPersonal(req, admin, resposta, 'personal');
  if (personal instanceof Response) return personal;
  const cos = (await llegeixCos<Record<string, unknown>>(req)) || {};

  const errorSql = (e: { code?: string; message?: string }, on: string) => {
    console.error(on, e.code);
    const estat = ESTAT_ERROR[e.code || ''];
    return resposta(estat || 500, { error: estat ? e.message : 'Error intern' });
  };

  if (cos.accio !== 'calcula') return resposta(400, { error: 'Acció no vàlida' });

  const requestId = String(cos.request_id || '');
  if (!UUID.test(requestId)) return resposta(400, { error: 'Falta la comunicació' });
  const dataEfectes = dataValida(cos.data_efectes);
  if (!dataEfectes) return resposta(400, { error: 'Cal indicar la data d\'efectes del percentatge' });
  const exercici = Number(dataEfectes.slice(0, 4));
  const mode = cos.mode === 'sense_comunicacio' ? 'sense_comunicacio' : 'comunicacio';
  const retribucions = netejaImport(cos.retribucions);
  const cotitzacions = netejaImport(cos.cotitzacions ?? '0') || (cos.cotitzacions ? '' : '0.00');
  if (!retribucions || Number(retribucions) <= 0) return resposta(400, { error: 'Cal indicar les retribucions anuals estimades' });
  if (!cotitzacions) return resposta(400, { error: 'Cotitzacions no vàlides' });
  const satisfetes = cos.retribucions_satisfetes === undefined || cos.retribucions_satisfetes === '' ? null : netejaImport(cos.retribucions_satisfetes);
  const practicades = cos.retencions_practicades === undefined || cos.retencions_practicades === '' ? null : netejaImport(cos.retencions_practicades);
  if (satisfetes === '' || practicades === '') return resposta(400, { error: 'Imports de la regularització no vàlids' });
  const coneixementIndicat = cos.data_coneixement ? dataValida(cos.data_coneixement) : null;
  if (cos.data_coneixement && !coneixementIndicat) return resposta(400, { error: 'Data de coneixement de la variació no vàlida' });

  // 1. Dades (comunicació, paràmetres de l'exercici i càlcul anterior)
  const { data: x, error } = await portal.rpc('irpf_dades_calcul', {
    p_actor: personal.userId, p_request_id: requestId, p_exercici: exercici, p_data_efectes: dataEfectes,
  });
  if (error) return errorSql(error, 'irpf_dades_calcul');
  if (!x.parametres) {
    return resposta(409, { error: `Cal crear els paràmetres de l'exercici ${exercici}`, sense_parametres: exercici });
  }
  if (mode === 'comunicacio' && x.request.status !== 'actiu') {
    return resposta(409, { error: 'Només es pot calcular amb les dades d\'una comunicació rebuda pel pagador. Sense comunicació, trieu el càlcul de l\'art. 24.4.' });
  }

  // 2. Càlcul. Data en què el pagador va rebre la comunicació (apartat 12)
  const dades = mode === 'comunicacio' ? x.comunicacio.dades : null;
  const rebudaEl = x.recepcio ? dataAndorra(x.recepcio.signat_at) : null;
  // Variació: per defecte, el pagador la coneix quan rep la comunicació nova
  const coneixement = x.anterior
    ? coneixementIndicat || (mode === 'comunicacio' && x.anterior.request_id !== requestId ? rebudaEl : null)
    : null;
  let r;
  try {
    r = calcula({
      parametres: x.parametres, exercici, retribucions, cotitzacions, dades, data_efectes: dataEfectes,
      comunicacio: dades ? {
        data_efectes: x.comunicacio.data_efectes, rebuda_el: rebudaEl, tipus: dades.comunicacio?.tipus,
        inici_relacio: x.perceptor.inici_relacio, relacio_laboral: x.perceptor.relacio_laboral,
      } : null,
      anterior: x.anterior ? { percentatge: String(x.anterior.percentatge), percentatge_aplicat: String(x.anterior.percentatge_aplicat) } : null,
      coneixement,
      regularitzacio: satisfetes !== null || practicades !== null ? { retribucions_satisfetes: satisfetes, retencions_practicades: practicades } : null,
    });
  } catch (e) {
    return resposta(400, { error: (e as Error).message });
  }

  // 3. Detall (amb els avisos al personal: situació del cònjuge)
  const detall = { ...r, data_coneixement: coneixement };
  const resultat = {
    exercici, data_efectes: dataEfectes, mode, percentatge: r.percentatge, percentatge_aplicat: r.percentatge_aplicat,
    regularitzat: r.regularitzat, detall, anterior: x.anterior || null, data_coneixement: coneixement,
  };
  if (cos.previsualitza === true) return resposta(200, { ok: true, ...resultat });

  // 4. PDF d'ÀMBIT amb el full intern (amb la comunicació signada, si n'hi ha)
  const baixa = async (path: string) => {
    const { data, error: e } = await admin.storage.from(BUCKET).download(path);
    if (e || !data) throw new Error('No s\'han pogut llegir les firmes');
    return new Uint8Array(await data.arrayBuffer());
  };
  const s = x.signatura;
  const rec = x.recepcio;
  let pdf: Uint8Array;
  try {
    const firma = s ? await baixa(s.imatge_path) : null;
    const firmaRec = rec ? await baixa(rec.imatge_path) : null;
    const signat = (x.documents as { kind: string; sha256: string }[]).find((d) => d.kind === 'signat');
    const { data: u } = await admin.auth.admin.getUserById(personal.userId);
    const ambComunicacio = mode === 'comunicacio' && s;
    pdf = await generaPdfIrpf({
      mode: 'intern',
      requestId,
      referenciaClient: x.client.referencia_client,
      templateVersion: x.request.template_version,
      pagador: x.comunicacio.pagador,
      perceptor: { nom: x.perceptor.nom, nrt: x.perceptor.nrt },
      dades: ambComunicacio ? x.comunicacio.dades : null,
      signatura: ambComunicacio && firma ? {
        signatariNom: s.signatari_nom, signatariCarrec: null, lloc: s.lloc, signatAt: new Date(s.signat_at), ip: s.ip,
        userAgent: s.user_agent, empremtaDades: s.empremta_dades, png: firma, sha256: await sha256Hex(firma),
      } : null,
      recepcio: ambComunicacio && rec && firmaRec ? {
        nom: rec.representant_nom, carrec: rec.representant_carrec, signatAt: new Date(rec.signat_at), ip: rec.ip,
        userAgent: rec.user_agent, empremtaDades: rec.empremta_dades, png: firmaRec, sha256: await sha256Hex(firmaRec),
        mateixaSessio: rec.mateixa_sessio,
      } : null,
      calcul: {
        exercici, dataEfectes, mode: r.mode, retribucions, cotitzacions, percentatge: r.percentatge, percentatgeAplicat: r.percentatge_aplicat,
        parametres: x.parametres, detall, creatPer: u?.user?.email || personal.userId, creatAt: new Date(),
        pdfSignatSha256: ambComunicacio ? signat?.sha256 || null : null,
      },
    });
  } catch (e) {
    console.error('pdf intern', (e as Error).message);
    return resposta(500, { error: 'No s\'ha pogut generar el PDF intern' });
  }
  const sha = await sha256Hex(pdf);
  const path = `requests/${requestId}/intern/${crypto.randomUUID()}.pdf`;
  const { error: errPuja } = await admin.storage.from(BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  if (errPuja) return resposta(500, { error: 'No s\'ha pogut desar el PDF intern' });

  // 5. Càlcul i PDF en una sola transacció
  const { data: id, error: errReg } = await portal.rpc('irpf_registra_calcul', {
    p_actor: personal.userId,
    p_request_id: requestId,
    p: {
      exercici, data_efectes: dataEfectes, mode, retribucions, cotitzacions,
      retribucions_satisfetes: satisfetes, retencions_practicades: practicades,
      calcul_anterior: x.anterior?.id || null,
      data_coneixement: coneixement,
      percentatge: r.percentatge, percentatge_aplicat: r.percentatge_aplicat, regularitzat: r.regularitzat,
      parametres: x.parametres, detall,
    },
    p_pdf: { path, sha256: sha, mida: pdf.length },
  });
  if (errReg) return errorSql(errReg, 'irpf_registra_calcul');

  const ref = x.client.referencia_client || requestId.slice(0, 8);
  const { data: url } = await admin.storage.from(BUCKET)
    .createSignedUrl(path, 60, { download: `IRPF-intern-${ref}-${exercici}.pdf` });
  return resposta(200, { ok: true, calcul_id: id, ...resultat, pdf_intern: { sha256: sha, url: url?.signedUrl ?? null } });
});
