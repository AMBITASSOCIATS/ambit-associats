// src/portal/DetallKyc.jsx
// Detall d'un expedient "KYC i protecció de dades": respostes, documents
// (URL signades de curta durada), marques automàtiques, estat, protecció de
// dades i validació de l'OCIC. Gestor: crear, enviar i consultar. Només
// OCIC: validar i anul·lar. Les regles reals les aplica la base.
import React, { useCallback, useEffect, useState } from 'react';
import ModalMissatge from '../auth/ModalMissatge';
import { supabase } from '../supabaseClient';
import TK from './kyc/text-kyc.json';
import { FormCtx } from './kyc/camps';
import { LLISTES_SANCIONS } from './kyc/kyc-regles';
import { SECCIONS_PF, SECCIONS_PJ } from './kyc/Seccions';
import {
  NIVELLS, TIPUS_DOCUMENT, dataCurta, dataHora, invoca, missatgeEnllacKyc, nomEstat, portal, urlDocument,
} from './portalApi';
import { Avis, Boto, Dada, Entrada, EtiquetaEstat, Selector, Targeta } from './ui';

const avui = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });

const NOM_KIND = {
  signat: 'PDF signat pel client (sense l\'apartat reservat)',
  evidencies: 'Imatge de la firma',
  adjunt: 'Document adjunt',
  validat: 'PDF intern validat (apartat reservat i validació de l\'OCIC · només per al portal)',
  copia_client: 'Còpia per al client (sense l\'apartat reservat, amb la recepció signada per l\'OCIC)',
};

// Documents obligatoris que falten i que pot aportar ÀMBIT abans de validar
const DATA_DOC = { identitat: 'caducitat', vigencia: 'menys de 3 mesos', registre_be: 'menys de 3 mesos' };
const DocumentsAmbit = ({ s, persones, onFet }) => {
  const pendents = s.estatDocs?.pendents || [];
  const [tria, setTria] = useState('');
  const [d, setD] = useState({ data_document: '', rebut_el: avui(), data_caducitat: '' });
  const [fitxer, setFitxer] = useState(null);
  const [error, setError] = useState('');
  const [ocupat, setOcupat] = useState(false);
  const [tipus, persona] = tria ? tria.split('|') : ['', ''];
  const nomPend = (p) => `${nomDoc(p.tipus, s.document_type)}${p.persona ? ` · ${persones.get(p.persona) || ''}` : ''}`;

  const adjunta = async () => {
    setError('');
    if (!fitxer || !['application/pdf', 'image/jpeg', 'image/png'].includes(fitxer.type) || fitxer.size > 20 * 1024 * 1024) {
      setError('Cal un fitxer PDF, JPG o PNG de com a màxim 20 MB');
      return;
    }
    setOcupat(true);
    try {
      const u = await invoca('portal-kyc-personal', { accio: 'url_document_ambit', request_id: s.id, mime: fitxer.type, mida: fitxer.size });
      const { error: e } = await supabase.storage.from('portal-docs').uploadToSignedUrl(u.path, u.upload_token, fitxer, { contentType: fitxer.type });
      if (e) throw new Error('No s\'ha pogut pujar el fitxer');
      await invoca('portal-kyc-personal', {
        accio: 'registra_document_ambit', request_id: s.id, path: u.path, tipus, persona: persona || null,
        nom_fitxer: fitxer.name, data_document: d.data_document, rebut_el: d.rebut_el,
        data_caducitat: tipus === 'identitat' ? d.data_caducitat : null,
      });
      setTria(''); setFitxer(null); setD({ data_document: '', rebut_el: avui(), data_caducitat: '' });
      onFet();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupat(false);
    }
  };

  return (
    <Targeta titol={`Documents obligatoris pendents (${pendents.length})`}>
      <p className="text-xs text-gray-500 mb-3">
        {s.f.documentacio_ambit ? 'Documentació: ja la té ÀMBIT. ' : 'Documentació: l\'aporta el client. '}
        L'OCIC no pot validar mentre en falti cap o n'hi hagi de no vigents (document d'identitat caducat; certificat de vigència o
        extracte del Registre de beneficiaris efectius de més de 3 mesos). Els que adjuntis aquí consten com a «Aportat per ÀMBIT».
      </p>
      {pendents.length === 0 ? (
        <p className="text-sm text-green-700">Tots els documents obligatoris hi són i són vigents.</p>
      ) : (
        <ul className="text-sm text-red-700 list-disc pl-5 mb-3">{pendents.map((p) => <li key={`${p.tipus}${p.persona}`}>{nomPend(p)}</li>)}</ul>
      )}
      {pendents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Selector etiqueta="Document que aporta ÀMBIT *" value={tria} onChange={(e) => setTria(e.target.value)}>
            <option value="">—</option>
            {pendents.map((p) => <option key={`${p.tipus}|${p.persona || ''}`} value={`${p.tipus}|${p.persona || ''}`}>{nomPend(p)}</option>)}
          </Selector>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Fitxer (PDF, JPG o PNG) *</span>
            <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFitxer(e.target.files?.[0] || null)}
              className="block text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#009B9C]/10 file:text-[#007A7B] file:font-semibold" />
          </label>
          <Entrada etiqueta={`Data del document *${DATA_DOC[tipus] === 'menys de 3 mesos' ? ' (menys de 3 mesos)' : ''}`} type="date" max={avui()}
            value={d.data_document} onChange={(e) => setD({ ...d, data_document: e.target.value })} />
          <Entrada etiqueta="Aportat per ÀMBIT, rebut el *" type="date" max={avui()} value={d.rebut_el} onChange={(e) => setD({ ...d, rebut_el: e.target.value })} />
          {tipus === 'identitat' && (
            <Entrada etiqueta="Data de caducitat del document d'identitat *" type="date" value={d.data_caducitat} onChange={(e) => setD({ ...d, data_caducitat: e.target.value })} />
          )}
        </div>
      )}
      {pendents.length > 0 && (
        <div className="flex items-center gap-3 mt-3">
          <Boto onClick={adjunta} disabled={ocupat || !tria || !fitxer || !d.data_document || !d.rebut_el || (tipus === 'identitat' && !d.data_caducitat)}>
            {ocupat ? 'Adjuntant…' : 'Adjuntar'}
          </Boto>
          <Avis>{error}</Avis>
        </div>
      )}
    </Targeta>
  );
};
const COLOR_MARCA = {
  prohibicio_total: 'bg-red-600 text-white',
  pais_risc: 'bg-red-100 text-red-800 border border-red-200',
  ppe: 'bg-amber-100 text-amber-800 border border-amber-200',
  russia_belarus: 'bg-purple-100 text-purple-800 border border-purple-200',
  trust: 'bg-blue-100 text-blue-800 border border-blue-200',
  be_no_declarat: 'bg-red-100 text-red-800 border border-red-200',
};
const NOM_MARCA = { prohibicio_total: 'Prohibició total', pais_risc: 'País de risc', ppe: 'PPE', russia_belarus: 'Rússia / Belarús', trust: 'Trust', be_no_declarat: 'BE no declarat (+25 %)' };

const nomDoc = (tipus, kycTipus) => {
  const llista = kycTipus === 'kyc_pj' ? TK.pj.s11.documents : TK.pf.s9.documents;
  return llista[tipus]?.ca || tipus;
};

// ─── Formulari de validació (només OCIC) ────────────────────────────────────
const Validacio = ({ s, marques, onFet }) => {
  const pj = s.document_type === 'kyc_pj';
  const codis = new Set(marques.map((m) => m.codi));
  const calAlta = codis.has('ppe') || codis.has('pais_risc');
  const prohibit = codis.has('prohibicio_total');
  const [v, setV] = useState({
    nivell: '', justificacio: '', verificacio_via: '', verificacio_data: avui(), verificacio_persona: '',
    sancions_data: avui(), sancions_altres: '', sancions_resultat: '',
    rbe_data: avui(), rbe_resultat: '', alta_direccio_nom: '', alta_direccio_data: avui(),
  });
  const [evidencia, setEvidencia] = useState(null);
  const [llistes, setLlistes] = useState([]);  // llistes de sancions fixes marcades
  const totesLlistes = LLISTES_SANCIONS.every((l) => llistes.includes(l.codi));
  const docsPendents = (s.estatDocs?.pendents || []).length;
  const [error, setError] = useState('');
  const [ocupat, setOcupat] = useState(false);
  const [teFirma, setTeFirma] = useState(null);
  const canvi = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const necessitaAlta = calAlta || v.nivell === 'reforcada';

  useEffect(() => { portal.rpc('tinc_firma_ocic').then(({ data }) => setTeFirma(!!data)); }, []);

  const pujaEvidencia = async (fitxer) => {
    setError('');
    if (!fitxer) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(fitxer.type) || fitxer.size > 20 * 1024 * 1024) {
      setError('Format no admès o fitxer massa gran (PDF, JPG o PNG, màxim 20 MB)');
      return;
    }
    setOcupat(true);
    try {
      const u = await invoca('portal-kyc-personal', { accio: 'url_evidencia', request_id: s.id, mime: fitxer.type, mida: fitxer.size });
      const { error: e } = await supabase.storage.from('portal-docs').uploadToSignedUrl(u.path, u.upload_token, fitxer, { contentType: fitxer.type });
      if (e) throw new Error('No s\'ha pogut pujar el fitxer');
      const r = await invoca('portal-kyc-personal', { accio: 'registra_evidencia', request_id: s.id, path: u.path });
      setEvidencia({ id: r.document_id, nom: fitxer.name });
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupat(false);
    }
  };

  const valida = async () => {
    setError('');
    if (!window.confirm('Validar el KYC? Es generarà el PDF final amb la teva firma manuscrita. No es pot desfer.')) return;
    setOcupat(true);
    try {
      await invoca('portal-kyc-personal', {
        accio: 'valida', request_id: s.id, ...v, sancions_evidencia_id: evidencia?.id, sancions_llistes_marcades: llistes,
        ...(pj ? {} : { rbe_data: '', rbe_resultat: '' }),
        ...(necessitaAlta ? {} : { alta_direccio_nom: '', alta_direccio_data: '' }),
      });
      onFet();
    } catch (e) {
      setError(e.message);
      onFet(true);
    } finally {
      setOcupat(false);
    }
  };

  const A = TK.ambit;
  return (
    <Targeta titol="Validació de l'OCIC · apartat reservat a ÀMBIT">
      {prohibit && (
        <div className="mb-3"><Avis>Hi ha un país de prohibició total (CT-03/2026): el KYC no es pot validar. Si ho intentes, quedarà registrat.</Avis></div>
      )}
      {teFirma === false && (
        <div className="mb-3"><Avis>No tens la firma manuscrita registrada al portal: no podràs validar fins que es registri.</Avis></div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Selector etiqueta={`${A.risc.ca} *`} value={v.nivell} onChange={canvi('nivell')}>
          <option value="">—</option>
          <option value="simplificada" disabled={marques.length > 0}>Simplificada (risc reduït · revisió 5 anys){marques.length ? ' · no permesa amb marques' : ''}</option>
          <option value="normal">Normal (risc normal · revisió 3 anys)</option>
          <option value="reforcada">Reforçada (risc alt · revisió 1 any)</option>
        </Selector>
        <Selector etiqueta={`${A.verificacio.ca} *`} value={v.verificacio_via} onChange={canvi('verificacio_via')}>
          <option value="">—</option>
          {Object.entries(A.vies).map(([k, o]) => <option key={k} value={k}>{o.ca}</option>)}
        </Selector>
        <label className="block md:col-span-2">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Justificació del nivell de diligència *</span>
          <textarea rows={2} value={v.justificacio} onChange={canvi('justificacio')} maxLength={2000}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40" />
        </label>
        <Entrada etiqueta="Verificació de la identitat: data *" type="date" value={v.verificacio_data} max={avui()} onChange={canvi('verificacio_data')} />
        <Entrada etiqueta="Verificació de la identitat: persona que la comprova *" value={v.verificacio_persona} maxLength={200} onChange={canvi('verificacio_persona')} />
        <Entrada etiqueta="Llistes de sancions: data *" type="date" value={v.sancions_data} max={avui()} onChange={canvi('sancions_data')} />
        <div className="md:col-span-2">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Llistes de sancions consultades (totes obligatòries) *</span>
          {LLISTES_SANCIONS.map((l) => (
            <label key={l.codi} className="flex items-start gap-2 text-sm text-gray-700 py-0.5">
              <input type="checkbox" className="accent-[#009B9C] mt-1" checked={llistes.includes(l.codi)}
                onChange={(e) => setLlistes(e.target.checked ? [...llistes, l.codi] : llistes.filter((x) => x !== l.codi))} />
              {l.nom}
            </label>
          ))}
        </div>
        <Entrada etiqueta="Altres llistes consultades (opcional)" value={v.sancions_altres} maxLength={500} onChange={canvi('sancions_altres')} />
        <Entrada etiqueta="Resultat de la comprovació de sancions *" value={v.sancions_resultat} maxLength={500} onChange={canvi('sancions_resultat')} className="md:col-span-2" />
        <div className="md:col-span-2">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Evidència de la comprovació de sancions (obligatòria) *</span>
          <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={ocupat} onChange={(e) => pujaEvidencia(e.target.files?.[0])}
            className="block text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#009B9C]/10 file:text-[#007A7B] file:font-semibold" />
          {evidencia && <p className="text-xs text-green-700 mt-1">Adjuntada ✓ {evidencia.nom}</p>}
        </div>
        {pj && (
          <>
            <Entrada etiqueta="Registre de beneficiaris efectius: data *" type="date" value={v.rbe_data} max={avui()} onChange={canvi('rbe_data')} />
            <Entrada etiqueta="Registre de beneficiaris efectius: resultat *" value={v.rbe_resultat} maxLength={500} onChange={canvi('rbe_resultat')} />
          </>
        )}
        {necessitaAlta && (
          <>
            <Entrada etiqueta={`${A.alta_direccio.ca}: qui l'autoritza *`} value={v.alta_direccio_nom} maxLength={200} onChange={canvi('alta_direccio_nom')} />
            <Entrada etiqueta={`${A.alta_direccio.ca}: data *`} type="date" value={v.alta_direccio_data} max={avui()} onChange={canvi('alta_direccio_data')} />
            <p className="md:col-span-2 text-[11px] text-gray-500">Obligatòria perquè hi ha {[codis.has('ppe') && 'una PPE', codis.has('pais_risc') && 'un país de risc', v.nivell === 'reforcada' && 'diligència reforçada'].filter(Boolean).join(', ')}.</p>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        {docsPendents > 0 && <Avis>Falten {docsPendents} documents obligatoris o vigents: no es pot validar.</Avis>}
        <Boto variant="exit" onClick={valida} disabled={ocupat || teFirma === false || !evidencia || !totesLlistes || docsPendents > 0}>{ocupat ? 'Validant…' : 'Validar i estampar la meva firma'}</Boto>
        <Avis>{error}</Avis>
      </div>
    </Targeta>
  );
};

// ─── Detall ─────────────────────────────────────────────────────────────────
const DetallKyc = ({ id, onTorna, rol }) => {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [missatge, setMissatge] = useState(null);
  const [ocupat, setOcupat] = useState(false);
  const [motiu, setMotiu] = useState('');
  const [motiuRevisio, setMotiuRevisio] = useState('');
  const [docRevisio, setDocRevisio] = useState('client');
  const [veureRespostes, setVeureRespostes] = useState(false);

  const carrega = useCallback(async () => {
    const { data: req, error: e } = await portal.from('requests')
      .select('id, status, document_type, template_version, created_at, enviat_at, signat_at, activat_at, anullat_at, motiu_anullacio, clients(id, nom_mostrat, party_type, referencia_client, data_fi_relacio, consentiment_comercial, consentiment_comercial_at, consentiment_retirat_el)')
      .eq('id', id).single();
    if (e) { setError(e.message); return; }
    const { data: f } = await portal.from('kyc_formularis').select('pdp_request_id, revisio_de, motiu_revisio, dades, desat_at, documentacio_ambit').eq('request_id', id).single();
    const [pdp, docs, adj, sig, val, marq, enllac, cons, estat] = await Promise.all([
      portal.from('requests').select('id, status, signat_at, template_version').eq('id', f.pdp_request_id).maybeSingle(),
      portal.from('documents').select('id, request_id, kind, storage_path, sha256, mida_bytes, created_at').in('request_id', [id, f.pdp_request_id]).order('created_at'),
      portal.from('kyc_adjunts').select('document_id, tipus, persona, nom_fitxer, retirat_at, aportat_per_ambit, rebut_el, data_document, data_caducitat').eq('request_id', id),
      portal.from('signatures').select('request_id, signatari_nom, signatari_carrec, lloc, signat_at, ip, user_agent, empremta_dades').in('request_id', [id, f.pdp_request_id]),
      portal.from('kyc_validacions').select('*').eq('request_id', id).maybeSingle(),
      portal.rpc('kyc_marques', { p_request_id: id }),
      portal.rpc('estat_enllac', { p_request_id: id }),
      portal.from('pdp_consentiments').select('consentiment_comercial').eq('request_id', f.pdp_request_id).maybeSingle(),
      portal.rpc('kyc_estat_documents', { p_request_id: id }),
    ]);
    setS({
      ...req, f, pdp: pdp.data, docs: docs.data || [], adjunts: adj.data || [], sigs: sig.data || [],
      validacio: val.data, marques: marq.data || [], enllac: enllac.data?.[0] || null, consentiment: cons.data,
      estatDocs: estat.data,
    });
  }, [id]);
  useEffect(() => { carrega(); }, [carrega]);

  const accio = async (fn) => {
    setError('');
    setOcupat(true);
    try { await fn(); await carrega(); } catch (e) { setError(e.message); } finally { setOcupat(false); }
  };

  const generaEnllac = () => accio(async () => {
    const r = await invoca('portal-enllac', { request_id: id });
    setMissatge(missatgeEnllacKyc({ nom: s.clients.nom_mostrat, enllac: r.enllac, expira: r.expira_at }));
  });
  const anulla = () => {
    if (!window.confirm('Segur que vols anul·lar aquest KYC? No es pot desfer.')) return;
    accio(async () => {
      const { error: e } = await portal.rpc('anulla_kyc', { p_request_id: id, p_motiu: motiu.trim() });
      if (e) throw e;
    });
  };
  const creaRevisio = () => accio(async () => {
    const r = await invoca('portal-kyc-personal', { accio: 'crea', client_id: s.clients.id, revisio_de: id, motiu: motiuRevisio.trim() || null, documentacio: docRevisio });
    onTorna(r.request_id);
  });
  const pdfFinal = () => accio(async () => {
    const r = await invoca('portal-kyc-personal', { accio: 'pdf_final', request_id: id });
    const url = r.pdf_final?.url || r.copia_client?.url;
    if (url) window.open(url, '_blank', 'noopener');
  });
  const descarrega = (doc) => accio(async () => {
    const ext = doc.storage_path.split('.').pop();
    const url = await urlDocument(doc.storage_path, `${doc.kind}-${s.clients.referencia_client || id.slice(0, 8)}.${ext}`);
    window.open(url, '_blank', 'noopener');
  });

  if (!s) return <p className="text-sm text-gray-400">{error || 'Carregant...'}</p>;
  const client = s.clients;
  const pj = s.document_type === 'kyc_pj';
  const seccions = pj ? SECCIONS_PJ : SECCIONS_PF;
  const potEnllac = ['esborrany', 'enviat', 'en_curs'].includes(s.status);
  const sigKyc = s.sigs.find((x) => x.request_id === id);
  const sigPdp = s.sigs.find((x) => x.request_id === s.pdp?.id);
  const docsKyc = s.docs.filter((d) => d.request_id === id);
  const docsPdp = s.docs.filter((d) => d.request_id === s.pdp?.id);
  const adjPerDoc = new Map(s.adjunts.map((a) => [a.document_id, a]));
  const persones = new Map([...(s.f.dades.representants || []), ...(s.f.dades.beneficiaris || [])].map((p) => [p.id, p.nom]));
  const validat = s.status === 'actiu' && s.validacio;
  const teFinal = docsKyc.some((d) => d.kind === 'validat') && docsKyc.some((d) => d.kind === 'copia_client');

  const FilaDoc = ({ d }) => {
    const a = adjPerDoc.get(d.id);
    const ocic = d.storage_path.includes('/ocic/');
    const nom = a ? `${nomDoc(a.tipus, s.document_type)}${a.persona ? ` · ${persones.get(a.persona) || ''}` : ''}` : ocic ? 'Evidència de sancions (OCIC)' : NOM_KIND[d.kind];
    return (
      <div className={`py-2.5 flex flex-wrap items-center gap-3 ${a?.retirat_at ? 'opacity-50' : ''}`}>
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm text-gray-800">{nom}{a?.nom_fitxer ? <span className="text-gray-400"> · {a.nom_fitxer}</span> : ''}{a?.retirat_at ? ' (tret)' : ''}</p>
          {a?.aportat_per_ambit && (
            <p className="text-[11px] text-[#007A7B]">Aportat per ÀMBIT, rebut el {dataCurta(a.rebut_el)} · data del document {dataCurta(a.data_document)}
              {a.data_caducitat && ` · caduca el ${dataCurta(a.data_caducitat)}`}</p>
          )}
          {!a?.aportat_per_ambit && (a?.data_caducitat || a?.data_document) && (
            <p className="text-[11px] text-gray-500">{a.data_caducitat ? `Caduca el ${dataCurta(a.data_caducitat)}` : `Data del document ${dataCurta(a.data_document)}`}</p>
          )}
          <p className="text-[11px] text-gray-400 font-mono break-all">SHA-256 {d.sha256} · {(d.mida_bytes / 1024).toFixed(0)} KB · {dataHora(d.created_at)}</p>
        </div>
        <Boto variant="secundari" onClick={() => descarrega(d)} disabled={ocupat}>Descarregar</Boto>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <button onClick={() => onTorna(null)} className="text-sm text-[#009B9C] hover:underline">← Totes les sol·licituds</button>

      <Targeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">{TIPUS_DOCUMENT[s.document_type]} · {s.template_version} + {s.pdp?.template_version}</p>
            <h2 className="text-lg font-bold text-gray-800">{client.nom_mostrat}</h2>
            <p className="text-xs text-gray-500">
              {pj ? 'Persona jurídica' : 'Persona física'} · Referència: <span className="font-mono">{client.referencia_client || 'sense assignar'}</span>
              {s.f.revisio_de && ' · Revisió d\'un KYC anterior'}{s.f.motiu_revisio && ` (${s.f.motiu_revisio})`}
              {' · '}<strong>{s.f.documentacio_ambit ? 'Documentació: ja la té ÀMBIT' : 'Documentació: l\'aporta el client'}</strong>
            </p>
          </div>
          <div className="text-right space-y-1">
            <div>KYC: <EtiquetaEstat estat={s.status} tipus={s.document_type} /></div>
            <div>Protecció de dades: <EtiquetaEstat estat={s.pdp?.status} tipus="pdp" /></div>
          </div>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <Dada etiqueta="Creada">{dataCurta(s.created_at)}</Dada>
          <Dada etiqueta="Enviada">{dataHora(s.enviat_at)}</Dada>
          <Dada etiqueta="Signada">{dataHora(s.signat_at)}</Dada>
          <Dada etiqueta="Validada">{dataHora(s.activat_at)}</Dada>
          {s.f.desat_at && !s.signat_at && <Dada etiqueta="Darrera desada del client">{dataHora(s.f.desat_at)}</Dada>}
          {s.anullat_at && <Dada etiqueta="Anul·lada">{dataHora(s.anullat_at)}</Dada>}
          {s.motiu_anullacio && <Dada etiqueta="Motiu de l'anul·lació">{s.motiu_anullacio}</Dada>}
          {client.data_fi_relacio && <Dada etiqueta="Fi de la relació">{dataCurta(client.data_fi_relacio)}</Dada>}
        </dl>
      </Targeta>

      <Avis>{error}</Avis>

      {/* Marques automàtiques (només per al personal; mai no es mostren al client) */}
      <Targeta titol="Marques automàtiques">
        {s.marques.length === 0 ? (
          <p className="text-sm text-gray-500">Cap marca amb les respostes actuals i les llistes vigents.</p>
        ) : (
          <ul className="space-y-1.5">
            {s.marques.map((m, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${COLOR_MARCA[m.codi] || ''}`}>{NOM_MARCA[m.codi] || m.codi}</span>
                <span className="text-gray-700">{m.detall}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-gray-400 mt-2">No es comuniquen mai al client (art. 26 Llei 14/2017).</p>
      </Targeta>

      {potEnllac && (
        <Targeta titol="Enllaç per al client">
          <p className="text-xs text-gray-500 mb-3">
            {s.enllac
              ? `Hi ha un enllaç vigent fins al ${dataHora(s.enllac.expira_at)}. Si el generes de nou, l'anterior deixarà de funcionar (les respostes desades es mantenen).`
              : 'Genera l\'enllaç i envia\'l al client des del teu correu. Un sol enllaç per al KYC i la protecció de dades; caduca als 7 dies.'}
          </p>
          <Boto onClick={generaEnllac} disabled={ocupat}>{s.enllac || s.status !== 'esborrany' ? 'Regenerar enllaç' : 'Generar enllaç'}</Boto>
        </Targeta>
      )}

      {rol === 'ocic' && (potEnllac || s.status === 'signat') && (
        <Targeta titol="Anul·lar (només OCIC)">
          <div className="flex flex-wrap items-end gap-3">
            <Entrada etiqueta="Motiu (obligatori)" value={motiu} className="flex-1 min-w-[240px]" maxLength={500} onChange={(e) => setMotiu(e.target.value)} />
            <Boto variant="perill" onClick={anulla} disabled={ocupat || !motiu.trim()}>Anul·lar</Boto>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">El motiu és intern: no es comunica al client.</p>
        </Targeta>
      )}

      {['enviat', 'en_curs', 'signat'].includes(s.status) && !s.validacio && (
        <DocumentsAmbit s={s} persones={persones} onFet={carrega} />
      )}

      {s.status === 'signat' && rol === 'ocic' && (
        <>
          {!client.referencia_client && <Avis tipus="info">Abans de validar cal assignar la referència del client (pestanya Clients).</Avis>}
          <Validacio s={s} marques={s.marques} onFet={(err) => (err ? carrega() : carrega())} />
        </>
      )}
      {s.status === 'signat' && rol !== 'ocic' && (
        <Avis tipus="info">Pendent de validació de l'OCIC.</Avis>
      )}

      {validat && (
        <Targeta titol="Validació de l'OCIC">
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Dada etiqueta="Nivell de diligència">{NIVELLS[s.validacio.nivell]}</Dada>
            <Dada etiqueta="Validat">{dataHora(s.validacio.validat_at)}</Dada>
            <Dada etiqueta="Propera revisió">{dataCurta(s.validacio.propera_revisio)}</Dada>
            <Dada etiqueta="Justificació">{s.validacio.justificacio}</Dada>
            <Dada etiqueta="Verificació de la identitat">{`${TK.ambit.vies[s.validacio.verificacio_via]?.ca} · ${dataCurta(s.validacio.verificacio_data)} · ${s.validacio.verificacio_persona}`}</Dada>
            <Dada etiqueta="Sancions">{`${dataCurta(s.validacio.sancions_data)} · ${s.validacio.sancions_resultat} · ${s.validacio.sancions_llistes}`}</Dada>
            {pj && <Dada etiqueta="Registre de beneficiaris efectius">{`${dataCurta(s.validacio.rbe_data)} · ${s.validacio.rbe_resultat}`}</Dada>}
            <Dada etiqueta="Alta direcció">{s.validacio.alta_direccio_nom ? `${s.validacio.alta_direccio_nom} · ${dataCurta(s.validacio.alta_direccio_data)}` : 'No escau'}</Dada>
            <Dada etiqueta="Llistes aplicades">{`UE ${(s.validacio.llistes?.UE || []).join(', ')} · GAFI ${(s.validacio.llistes?.GAFI || []).join(', ')}`}</Dada>
          </dl>
          {!teFinal && rol === 'ocic' && (
            <div className="mt-3 flex items-center gap-3">
              <Avis>Falta el PDF final.</Avis>
              <Boto onClick={pdfFinal} disabled={ocupat}>Generar el PDF final</Boto>
            </div>
          )}
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500 mb-2">Revisió per un fet rellevant o periòdica: crea una sol·licitud nova preomplerta amb aquestes dades. Aquest KYC es conserva intacte.</p>
            <div className="flex flex-wrap items-end gap-3">
              <Entrada etiqueta="Motiu intern (opcional, no es mostra al client)" value={motiuRevisio} maxLength={500} className="flex-1 min-w-[240px]" onChange={(e) => setMotiuRevisio(e.target.value)} />
              <Selector value={docRevisio} onChange={(e) => setDocRevisio(e.target.value)}>
                <option value="client">Documentació: l'aporta el client</option>
                <option value="ambit">Documentació: ja la té ÀMBIT</option>
              </Selector>
              <Boto onClick={creaRevisio} disabled={ocupat}>Crear revisió</Boto>
            </div>
          </div>
        </Targeta>
      )}

      {/* Respostes */}
      <Targeta titol="Respostes del formulari"
        accions={<Boto variant="secundari" onClick={() => setVeureRespostes(!veureRespostes)}>{veureRespostes ? 'Amagar' : 'Mostrar'}</Boto>}>
        {Object.keys(s.f.dades || {}).length === 0 ? (
          <p className="text-sm text-gray-400">El client encara no ha començat el formulari.</p>
        ) : veureRespostes ? (
          <FormCtx.Provider value={{ dades: s.f.dades, posa: () => {}, err: () => false, llegir: true }}>
            <fieldset disabled>{seccions.map((x) => <x.C key={x.num} />)}</fieldset>
          </FormCtx.Provider>
        ) : (
          <p className="text-sm text-gray-500">{s.signat_at ? 'Respostes signades.' : 'Respostes desades pel client (encara no signades).'} Prem «Mostrar» per veure-les.</p>
        )}
      </Targeta>

      {sigKyc && (
        <Targeta titol="Signatures i evidències">
          {[['KYC', sigKyc], ['Protecció de dades', sigPdp]].filter(([, x]) => x).map(([nom, x]) => (
            <dl key={nom} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Dada etiqueta={`${nom} · signant`}>{[x.signatari_nom, x.signatari_carrec].filter(Boolean).join(' · ')}</Dada>
              <Dada etiqueta="Lloc i data (UTC)">{`${x.lloc} · ${new Date(x.signat_at).toISOString().replace('T', ' ').slice(0, 19)}`}</Dada>
              <Dada etiqueta="IP i navegador"><span className="text-xs">{x.ip} · {x.user_agent}</span></Dada>
              <Dada etiqueta="Empremta de les dades"><span className="font-mono text-xs break-all">{x.empremta_dades}</span></Dada>
            </dl>
          ))}
          {s.consentiment && (
            <p className="text-sm text-gray-700">Comunicacions comercials: <strong>{s.consentiment.consentiment_comercial ? 'autoritzades' : 'no autoritzades'}</strong>
              {client.consentiment_retirat_el && ` · retirada anotada el ${dataCurta(client.consentiment_retirat_el)}`}</p>
          )}
        </Targeta>
      )}

      {(docsKyc.length > 0 || docsPdp.length > 0) && (
        <Targeta titol="Documents">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">KYC</p>
          <div className="divide-y divide-gray-100 mb-3">{docsKyc.map((d) => <FilaDoc key={d.id} d={d} />)}</div>
          {docsPdp.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Protecció de dades</p>
              <div className="divide-y divide-gray-100">{docsPdp.map((d) => <FilaDoc key={d.id} d={d} />)}</div>
            </>
          )}
          <p className="text-[11px] text-gray-400 mt-2">Les descàrregues són enllaços signats de 60 segons.</p>
        </Targeta>
      )}

      {missatge && <ModalMissatge missatge={missatge} onTancar={() => setMissatge(null)} />}
      {/* Estat de la PDP per a lectors de pantalla */}
      <span className="sr-only">{nomEstat(s.pdp?.status, 'pdp')}</span>
    </div>
  );
};

export default DetallKyc;
