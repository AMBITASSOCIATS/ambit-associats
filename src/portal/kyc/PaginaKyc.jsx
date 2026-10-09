// src/portal/kyc/PaginaKyc.jsx
// Pàgina pública del client: /kyc/<token>. Sense compte.
// 1. Formulari KYC per apartats, amb desada automàtica (es pot continuar més
//    tard mentre l'enllaç sigui vigent).
// 2. Documents per tipus; no es pot passar a signar si en falta cap d'obligatori.
// 3. Revisió de tot el que s'ha introduït i signatura del KYC.
// 4. Informació sobre protecció de dades: text íntegre, casella voluntària
//    (no marcada) i una segona signatura.
// 5. Dos PDF per descarregar (enllaços de curta durada).
// Cap missatge no revela marques de risc ni motius de revisió (art. 26 Llei 14/2017).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import T from './text-kyc.json';
import { AVIS_25, campsPendents } from './kyc-regles';
import { FormCtx, ambValor, Bilingue, Seccio } from './camps';
import { SECCIONS_PF, SECCIONS_PJ } from './Seccions';
import SignaturaCanvas from '../signar/SignaturaCanvas';
import logo from '../signar/logo-ambit.jpg';

const MAX_ADJUNT = 20 * 1024 * 1024;
const TIPUS_ADJUNT = ['application/pdf', 'image/jpeg', 'image/png'];
const token = window.location.pathname.replace(/^\/kyc\//, '').replace(/\/+$/, '');
const avui = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });
const dataCurta = (d) => new Date(d).toLocaleDateString('ca-AD', { timeZone: 'Europe/Andorra', day: '2-digit', month: '2-digit', year: 'numeric' });
const hora = (d) => new Date(d).toLocaleTimeString('ca-AD', { timeZone: 'Europe/Andorra', hour: '2-digit', minute: '2-digit' });

const crida = async (body) => {
  const { data, error } = await supabase.functions.invoke('portal-kyc', { body: { token, ...body } });
  if (error) {
    const detall = await error.context?.json?.().catch(() => null);
    const e = new Error(detall?.error || 'No s\'ha pogut connectar. Torneu-ho a provar. / Could not connect. Please try again.');
    e.status = error.context?.status;
    e.detall = detall;
    throw e;
  }
  return data;
};

// ─── Pantalla ───────────────────────────────────────────────────────────────
const Pantalla = ({ titol, children }) => (
  <div className="min-h-screen bg-gray-100 py-6 sm:py-10 px-3">
    <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-lg px-4 sm:px-10 py-8">
      <header className="flex items-start justify-between gap-4 pb-4 border-b-2 border-[#009B9C]">
        <img src={logo} alt="ÀMBIT Associats" className="h-12 sm:h-14 w-auto" />
        <div className="text-right">
          <h1 className="text-sm sm:text-lg font-bold text-[#009B9C] leading-tight">{titol.ca}</h1>
          <p className="text-xs sm:text-sm italic text-gray-500">{titol.en}</p>
        </div>
      </header>
      {children}
      <footer className="mt-10 pt-3 border-t border-[#009B9C]/60 text-[10px] text-gray-500 leading-relaxed">
        <p>{T.peu[0]}</p>
        <p>{T.peu[1]}</p>
      </footer>
    </div>
  </div>
);

const Missatge = ({ icona, ca, en, children, titol }) => (
  <Pantalla titol={titol}>
    <div className="text-center py-12">
      <div className="text-5xl mb-4">{icona}</div>
      <h2 className="text-xl font-bold text-gray-800">{ca}</h2>
      <p className="text-sm italic text-gray-500 mt-1">{en}</p>
      {children}
    </div>
  </Pantalla>
);

const BotoPrimari = ({ children, ...p }) => (
  <button type="button" {...p} className="bg-[#009B9C] hover:bg-[#007A7B] text-white font-bold px-5 py-3 rounded-xl text-sm transition disabled:opacity-50">
    {children}
  </button>
);
const BotoSecundari = ({ children, ...p }) => (
  <button type="button" {...p} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-5 py-3 rounded-xl text-sm transition disabled:opacity-50">
    {children}
  </button>
);
const AvisError = ({ children }) => (children ? <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{children}</div> : null);

// ─── Documents ──────────────────────────────────────────────────────────────
const nomPersona = (dades, id) =>
  [...(dades.representants || []), ...(dades.beneficiaris || [])].find((p) => p.id === id)?.nom || '—';

// Dates que es demanen en adjuntar: caducitat del document d'identitat i data
// del certificat de vigència i de l'extracte del Registre de beneficiaris efectius
const DATA_DOC = {
  identitat: { camp: 'data_caducitat', ca: 'Data de caducitat del document', en: 'Document expiry date' },
  vigencia: { camp: 'data_document', ca: 'Data del document (menys de 3 mesos)', en: 'Document date (less than three months old)' },
  registre_be: { camp: 'data_document', ca: 'Data del document (menys de 3 mesos)', en: 'Document date (less than three months old)' },
};

const FilaDocument = ({ tipus, persona, nom, obligatori, opcionalAmbit, adjunts, onPuja, onTreu, ocupat, pendent }) => {
  const meus = adjunts.filter((a) => a.tipus === tipus && (a.persona || null) === (persona || null));
  const entrada = useRef(null);
  const dataDoc = DATA_DOC[tipus];
  const [dataValor, setDataValor] = useState('');
  const valids = meus.filter((a) => a.valid !== false);
  return (
    <div className={`py-3 border-b border-gray-100 ${pendent ? 'bg-red-50/60 -mx-2 px-2 rounded' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[14rem]">
          <Bilingue ca={nom.ca} en={nom.en} />
          <p className={`text-[11px] mt-1 font-semibold ${obligatori && !opcionalAmbit ? (valids.length ? 'text-green-700' : 'text-red-600') : 'text-gray-400'}`}>
            {obligatori && opcionalAmbit
              ? (valids.length ? 'Adjuntat ✓ / Attached ✓' : 'Opcional: ÀMBIT ja disposa d\'aquesta documentació / Optional: ÀMBIT already holds this document')
              : obligatori ? (valids.length ? 'Adjuntat ✓ / Attached ✓' : 'Obligatori / Required') : 'Si escau / If applicable'}
          </p>
        </div>
        <div className="text-right">
          {dataDoc && (
            <label className="block text-[11px] text-gray-600 mb-1">
              {dataDoc.ca} <span className="italic text-gray-400">/ {dataDoc.en}</span>
              <input type="date" value={dataValor} onChange={(e) => setDataValor(e.target.value)}
                className="block ml-auto mt-0.5 bg-[#FBFAF1] border border-[#C2BD6B] rounded-sm px-2 py-1 text-sm" />
            </label>
          )}
          <input ref={entrada} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPuja(tipus, persona, f, dataDoc ? { [dataDoc.camp]: dataValor } : {}); }} />
          <button type="button" disabled={ocupat || (dataDoc && !dataValor)} onClick={() => entrada.current?.click()}
            className="text-sm font-semibold text-[#007A7B] border border-[#009B9C]/50 rounded-lg px-3 py-1.5 hover:bg-[#009B9C]/5 disabled:opacity-50">
            + Adjuntar / Attach
          </button>
        </div>
      </div>
      {meus.map((a) => (
        <div key={a.id} className="flex items-center gap-2 text-xs text-gray-600 mt-1.5 pl-1">
          <span>📎 {a.nom_fitxer || 'document'} · {(a.mida / 1024).toFixed(0)} KB
            {a.data_caducitat && ` · caduca el / expires on ${dataCurta(a.data_caducitat)}`}
            {a.data_document && ` · data / date ${dataCurta(a.data_document)}`}
            {a.valid === false && <strong className="text-red-600"> · No vigent: adjunteu-ne un de vigent / Not valid: please attach a valid one</strong>}
          </span>
          <button type="button" onClick={() => onTreu(a.id)} disabled={ocupat} className="text-red-600 hover:underline">Treure / Remove</button>
        </div>
      ))}
    </div>
  );
};

const PasDocuments = ({ tipus, dades, docs, setDocs }) => {
  const [ocupat, setOcupat] = useState(false);
  const [error, setError] = useState('');
  const textos = tipus === 'kyc_pf' ? T.pf.s9 : T.pj.s11;
  const requerit = (t, p) => docs.requerits.some((r) => r.tipus === t && (r.persona || null) === (p || null));
  const pendent = (t, p) => docs.pendents.some((r) => r.tipus === t && (r.persona || null) === (p || null));

  const puja = async (t, persona, fitxer, dates = {}) => {
    setError('');
    if (!TIPUS_ADJUNT.includes(fitxer.type)) { setError('Format no admès: PDF, JPG o PNG. / Format not accepted: PDF, JPG or PNG.'); return; }
    if (fitxer.size > MAX_ADJUNT) { setError('El fitxer supera els 20 MB. / The file exceeds 20 MB.'); return; }
    setOcupat(true);
    try {
      const u = await crida({ accio: 'url_pujada', tipus: t, persona, mime: fitxer.type, mida: fitxer.size });
      const { error: e } = await supabase.storage.from('portal-docs').uploadToSignedUrl(u.path, u.upload_token, fitxer, { contentType: fitxer.type });
      if (e) throw new Error('No s\'ha pogut pujar el fitxer. / The file could not be uploaded.');
      const r = await crida({ accio: 'registra_adjunt', path: u.path, tipus: t, persona, nom_fitxer: fitxer.name, ...dates });
      setDocs(r.documents);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupat(false);
    }
  };
  const treu = async (id) => {
    setOcupat(true);
    try {
      const r = await crida({ accio: 'retira_adjunt', adjunt_id: id });
      setDocs(r.documents);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupat(false);
    }
  };

  // Files: documents generals i, en persona jurídica, els de cada persona
  const files = [];
  if (tipus === 'kyc_pf') {
    for (const [t, nom] of Object.entries(textos.documents)) files.push({ t, p: null, nom });
  } else {
    for (const t of ['escriptura', 'vigencia', 'registre_be', 'nrt', 'fons', 'comerc', 'organigrama', 'trust']) {
      files.push({ t, p: null, nom: textos.documents[t] });
    }
    const perPersona = docs.requerits.filter((r) => r.persona);
    for (const r of perPersona) {
      const n = textos.documents[r.tipus];
      files.push({ t: r.tipus, p: r.persona, nom: { ca: `${n.ca} · ${nomPersona(dades, r.persona)}`, en: n.en } });
    }
  }
  files.sort((a, b) => Number(requerit(b.t, b.p)) - Number(requerit(a.t, a.p)));

  return (
    <>
      <Seccio ca={textos.titol.ca} en={textos.titol.en} />
      <p className="text-xs text-gray-500 mb-2">PDF, JPG o PNG, màxim 20 MB per fitxer. Podeu adjuntar més d'un fitxer per document (p. ex. les dues cares). /
        <span className="italic"> PDF, JPG or PNG, up to 20 MB per file. You may attach more than one file per document (e.g. both sides).</span></p>
      {files.map((f) => (
        <FilaDocument key={`${f.t}-${f.p || ''}`} tipus={f.t} persona={f.p} nom={f.nom} obligatori={requerit(f.t, f.p)}
          opcionalAmbit={docs.documentacio_ambit} pendent={pendent(f.t, f.p) && !docs.documentacio_ambit} adjunts={docs.adjunts} onPuja={puja} onTreu={treu} ocupat={ocupat} />
      ))}
      {ocupat && <p className="text-xs text-gray-500 mt-2">Un moment… / One moment…</p>}
      <AvisError>{error}</AvisError>
    </>
  );
};

// ─── Protecció de dades ─────────────────────────────────────────────────────
const TextPdp = () => (
  <div className="space-y-1">
    {T.pdp.seccions.map((s) => (
      <div key={s.titol.ca}>
        <Seccio ca={s.titol.ca} en={s.titol.en} />
        {s.nota && <p className="text-[11px] italic text-gray-500 mb-1">({s.nota.ca} · {s.nota.en})</p>}
        {(s.paragrafs || []).map((p) => <Bilingue key={p.ca} ca={p.ca} en={p.en} className="mb-2" />)}
        {(s.numerats || s.punts || []).map((p, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <span className="text-[15px]">{s.numerats ? `${i + 1}.` : '•'}</span>
            <div>
              <p className="text-[15px] text-gray-900 leading-snug"><strong>{p.ca_negreta}</strong>{p.ca}</p>
              <p className="text-xs italic text-gray-500 leading-snug mt-0.5"><strong>{p.en_negreta}</strong>{p.en}</p>
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

// ─── Pàgina ─────────────────────────────────────────────────────────────────
const PaginaKyc = () => {
  const [estat, setEstat] = useState('carregant'); // carregant | invalid | form | signant | fet
  const [errorInicial, setErrorInicial] = useState('');
  const [info, setInfo] = useState(null);
  const [dades, setDades] = useState({});
  const [docs, setDocs] = useState({ requerits: [], pendents: [], adjunts: [] });
  const [pas, setPas] = useState(0);
  const [vistos, setVistos] = useState(() => new Set());
  const [desat, setDesat] = useState({ desant: false, at: null, error: '' });
  const [lloc, setLloc] = useState({ kyc: '', pdp: '' });
  const [firmaKyc, setFirmaKyc] = useState(null);
  const [teFirma, setTeFirma] = useState(false);
  const [teFirmaPdp, setTeFirmaPdp] = useState(false);
  const [consentiment, setConsentiment] = useState(false);
  const [error, setError] = useState('');
  const [resultat, setResultat] = useState(null);
  const canvasKyc = useRef(null);
  const canvasPdp = useRef(null);
  const carregat = useRef(false);
  const pendentDesar = useRef(false);
  const darrerDesat = useRef('');  // per no tornar a desar el que ja hi ha

  // L'enllaç conté el token: que no surti cap a altres llocs ni als cercadors
  useEffect(() => {
    document.title = 'Identificació del client · ÀMBIT Associats';
    for (const [name, content] of [['referrer', 'no-referrer'], ['robots', 'noindex, nofollow']]) {
      const m = document.createElement('meta');
      m.name = name;
      m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  useEffect(() => {
    crida({ accio: 'obrir' })
      .then((r) => {
        setInfo(r);
        setDades(r.dades || {});
        darrerDesat.current = JSON.stringify(r.dades || {});
        setDocs(r.documents);
        setDesat({ desant: false, at: r.desat_at, error: '' });
        setEstat('form');
        carregat.current = true;
      })
      .catch((e) => {
        setErrorInicial(e.status === 429 ? e.message : '');
        setEstat('invalid');
      });
  }, []);

  const tipus = info?.tipus;
  const seccions = tipus === 'kyc_pj' ? SECCIONS_PJ : SECCIONS_PF;
  const PAS_DOCS = seccions.length;
  const PAS_REVISIO = PAS_DOCS + 1;
  const PAS_PDP = PAS_DOCS + 2;

  // Desada automàtica (1,5 s després de l'últim canvi)
  const desa = useCallback(async (d) => {
    const json = JSON.stringify(d);
    if (json === darrerDesat.current) { pendentDesar.current = false; return; }
    setDesat((x) => ({ ...x, desant: true, error: '' }));
    try {
      const r = await crida({ accio: 'desa', dades: d });
      setDocs(r.documents);
      setDesat({ desant: false, at: r.desat_at, error: '' });
      darrerDesat.current = json;
      pendentDesar.current = false;
    } catch (e) {
      setDesat((x) => ({ ...x, desant: false, error: e.status === 404 ? 'Enllaç caducat / Link expired' : 'No s\'ha pogut desar / Could not save' }));
    }
  }, []);
  useEffect(() => {
    if (!carregat.current || estat !== 'form') return undefined;
    pendentDesar.current = true;
    const t = setTimeout(() => desa(dades), 1500);
    return () => clearTimeout(t);
  }, [dades, desa, estat]);

  const posa = useCallback((cami, valor) => setDades((d) => ambValor(d, cami, valor)), []);
  const pendents = useMemo(() => (tipus ? campsPendents(dades, tipus, avui()) : []), [dades, tipus]);
  const pendentsPerSeccio = useMemo(() => {
    const m = new Map();
    for (const p of pendents) m.set(p.seccio, (m.get(p.seccio) || 0) + 1);
    return m;
  }, [pendents]);
  const camisPendents = useMemo(() => new Set(pendents.map((p) => p.camp)), [pendents]);

  const vesA = async (n) => {
    setVistos((v) => new Set([...v, pas]));
    if (pendentDesar.current || n >= PAS_DOCS) await desa(dades);
    setError('');
    setPas(n);
    window.scrollTo(0, 0);
  };

  if (estat === 'carregant') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Carregant... / Loading...</div>;
  }
  if (estat === 'invalid') {
    return (
      <Missatge icona="🔒" ca={errorInicial || 'Enllaç no vàlid o caducat'} en="Invalid or expired link" titol={T.pf.titol}>
        <p className="text-sm text-gray-600 mt-6">
          Si necessiteu un enllaç nou, contacteu amb nosaltres a{' '}
          <a href="mailto:info@ambit.ad" className="text-[#009B9C] underline">info@ambit.ad</a> o al +376 655 382.
        </p>
        <p className="text-xs italic text-gray-500 mt-1">If you need a new link, please contact us at info@ambit.ad or on +376 655 382.</p>
      </Missatge>
    );
  }
  const titolKyc = tipus === 'kyc_pj' ? T.pj.titol : T.pf.titol;
  if (estat === 'fet') {
    return (
      <Missatge icona="✅" ca="Documents signats" en="Documents signed" titol={titolKyc}>
        <p className="text-sm text-gray-600 mt-6">Gràcies. Hem rebut el formulari d'identificació i la informació sobre protecció de dades signats.</p>
        <p className="text-xs italic text-gray-500">Thank you. We have received the signed identification form and data protection information.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          {resultat?.kyc?.url && (
            <a href={resultat.kyc.url} download={resultat.kyc.nom_fitxer}
              className="bg-[#009B9C] hover:bg-[#007A7B] text-white font-bold px-6 py-3 rounded-xl text-sm">
              Formulari KYC (PDF) / KYC form (PDF)
            </a>
          )}
          {resultat?.pdp?.url && (
            <a href={resultat.pdp.url} download={resultat.pdp.nom_fitxer}
              className="bg-[#009B9C] hover:bg-[#007A7B] text-white font-bold px-6 py-3 rounded-xl text-sm">
              Protecció de dades (PDF) / Data protection (PDF)
            </a>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Els enllaços de descàrrega són vàlids durant 5 minuts. Si els necessiteu més endavant, demaneu-nos-en una còpia a info@ambit.ad.
        </p>
        <p className="text-[11px] italic text-gray-400">
          The download links are valid for 5 minutes. If you need them later, ask us for a copy at info@ambit.ad.
        </p>
      </Missatge>
    );
  }

  const err = (cami) => vistos.has(pas) || pas >= PAS_REVISIO ? camisPendents.has(cami) : false;
  const seccioActual = seccions[pas];
  const expira = dataCurta(info.expira_at);
  const formulariComplet = pendents.length === 0;
  // Amb "documentació: ja la té ÀMBIT", els documents no són obligatoris per al client
  const documentsComplets = docs.pendents.length === 0 || docs.documentacio_ambit === true;

  const continuarAPdp = () => {
    setError('');
    if (!formulariComplet || !documentsComplets) { setError('Falten dades o documents obligatoris. / Some required data or documents are missing.'); return; }
    if (!lloc.kyc.trim()) { setError('Indiqueu el lloc de signatura. / Please enter the place of signature.'); return; }
    if (!teFirma || canvasKyc.current?.buida()) { setError('Falta la signatura del formulari KYC. / The KYC signature is missing.'); return; }
    setFirmaKyc(canvasKyc.current.png());
    setLloc((l) => ({ ...l, pdp: l.pdp || l.kyc }));
    setPas(PAS_PDP);
    window.scrollTo(0, 0);
  };

  const signa = async () => {
    setError('');
    if (!lloc.pdp.trim()) { setError('Indiqueu el lloc de signatura. / Please enter the place of signature.'); return; }
    if (!teFirmaPdp || canvasPdp.current?.buida()) { setError('Falta la signatura de la protecció de dades. / The data protection signature is missing.'); return; }
    setEstat('signant');
    try {
      const r = await crida({
        accio: 'signar', dades, lloc_kyc: lloc.kyc, lloc_pdp: lloc.pdp,
        signatura_kyc: firmaKyc, signatura_pdp: canvasPdp.current.png(), consentiment_comercial: consentiment,
      });
      setResultat(r);
      setEstat('fet');
      window.scrollTo(0, 0);
    } catch (e) {
      setEstat('form');
      if (e.detall?.documents) setDocs(e.detall.documents);
      setError(e.message);
      if (e.detall?.pendents || e.detall?.documents) { setPas(PAS_REVISIO); setFirmaKyc(null); }
    }
  };

  // Passos: apartats, documents, revisió i signatura, protecció de dades
  const passos = [
    ...seccions.map((s, i) => ({ n: i, nom: `${s.num}. ${s.t.ca}`, falten: pendentsPerSeccio.get(s.num) || 0 })),
    { n: PAS_DOCS, nom: 'Documents', falten: docs.documentacio_ambit ? 0 : docs.pendents.length },
    { n: PAS_REVISIO, nom: 'Revisió i signatura', falten: 0 },
    { n: PAS_PDP, nom: 'Protecció de dades', falten: 0 },
  ];

  return (
    <Pantalla titol={pas === PAS_PDP ? T.pdp.titol : titolKyc}>
      <div className="mt-5 bg-[#009B9C]/5 border border-[#009B9C]/30 rounded-lg p-4 text-sm text-gray-700">
        <p><strong>{info.client_nom}</strong>: empleneu el formulari, adjunteu-hi els documents i signeu. Les respostes es desen soles; podeu continuar més tard amb el mateix enllaç fins al {expira}.</p>
        <p className="text-xs italic text-gray-500 mt-1">Please complete the form, attach the documents and sign. Your answers are saved automatically; you can continue later with the same link until {expira}.</p>
      </div>

      {/* Passos */}
      <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Passos / Steps">
        {passos.map((p) => (
          <button key={p.n} type="button" disabled={estat === 'signant' || (p.n === PAS_PDP && !firmaKyc)}
            onClick={() => (p.n === PAS_PDP ? null : vesA(p.n))}
            className={`text-[11px] px-2 py-1 rounded-full border transition ${pas === p.n ? 'bg-[#009B9C] text-white border-[#009B9C]'
              : vistos.has(p.n) && p.falten ? 'border-red-300 text-red-700 bg-red-50' : 'border-gray-200 text-gray-600 hover:border-[#009B9C]'} disabled:opacity-40`}>
            {p.nom}{vistos.has(p.n) && p.falten ? ` (${p.falten})` : ''}
          </button>
        ))}
      </nav>
      <p className="text-[11px] text-gray-400 mt-2 h-4" aria-live="polite">
        {desat.error || (desat.desant ? 'Desant… / Saving…' : desat.at ? `Desat a les ${hora(desat.at)} / Saved at ${hora(desat.at)}` : '')}
      </p>

      <FormCtx.Provider value={{ dades, posa, err, llegir: false }}>
        {pas === 0 && (
          <div className="mt-2">
            {T.avis_legal.ca.map((p, i) => <Bilingue key={i} ca={p} en={T.avis_legal.en[i]} className="mb-3" />)}
          </div>
        )}
        {seccioActual && <seccioActual.C />}
      </FormCtx.Provider>

      {pas === PAS_DOCS && <PasDocuments tipus={tipus} dades={dades} docs={docs} setDocs={setDocs} />}

      {pas === PAS_REVISIO && (
        <>
          <Seccio ca="Revisió" en="Review" />
          <p className="text-sm text-gray-700">Reviseu totes les respostes abans de signar. Per corregir-ne alguna, torneu a l'apartat corresponent.</p>
          <p className="text-xs italic text-gray-500 mb-2">Please review all your answers before signing. To correct any of them, go back to the relevant section.</p>
          {(!formulariComplet || !documentsComplets) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mt-3">
              <p className="font-semibold">Falta completar: / Still to complete:</p>
              <ul className="list-disc pl-5 mt-1">
                {passos.filter((p) => p.falten && p.n < PAS_REVISIO).map((p) => (
                  <li key={p.n}><button type="button" className="underline" onClick={() => vesA(p.n)}>{p.nom}</button> ({p.falten})</li>
                ))}
              </ul>
              {pendents.filter((p) => p.motiu === 'supera_25').map((p) => (
                <p key={p.nom} className="mt-2"><strong>{p.nom}</strong> ({p.percentatge} %): {AVIS_25.ca} / <span className="italic">{AVIS_25.en}</span></p>
              ))}
            </div>
          )}
          <FormCtx.Provider value={{ dades, posa, err: (c) => camisPendents.has(c), llegir: true }}>
            <fieldset disabled className="opacity-95">
              {seccions.map((s) => <s.C key={s.num} />)}
            </fieldset>
          </FormCtx.Provider>
          <div className="mt-4 text-sm text-gray-700">
            <p className="font-semibold">Documents adjuntats: {docs.adjunts.length} / Attached documents: {docs.adjunts.length}</p>
          </div>

          <Seccio ca={tipus === 'kyc_pj' ? `12. ${T.pj.s12.titol.ca}` : `10. ${T.pf.s10.titol.ca}`} en={tipus === 'kyc_pj' ? T.pj.s12.titol.en : T.pf.s10.titol.en} />
          {tipus === 'kyc_pj' && <p className="text-xs italic text-gray-600 mb-2">{T.pj.s12.avis.ca} / {T.pj.s12.avis.en}</p>}
          <div className="sm:flex sm:items-start gap-4 py-1.5">
            <label htmlFor="llocKyc" className="block sm:w-56 font-bold text-[15px]">* {T.signatura.lloc.ca} <span className="block italic font-normal text-[11px] text-gray-500 pl-3">{T.signatura.lloc.en}</span></label>
            <input id="llocKyc" value={lloc.kyc} maxLength={100} onChange={(e) => setLloc({ ...lloc, kyc: e.target.value })}
              placeholder="p. ex. Andorra la Vella / e.g. Andorra la Vella"
              className="flex-1 w-full bg-[#FBFAF1] border border-[#C2BD6B] rounded-sm px-3 py-2 text-[15px]" />
          </div>
          <div className="sm:flex sm:items-start gap-4 py-1.5">
            <span className="block sm:w-56 font-bold text-[15px]">{T.signatura.data.ca} <span className="block italic font-normal text-[11px] text-gray-500 pl-3">{T.signatura.data.en}</span></span>
            <p className="text-[15px] py-2">{dataCurta(new Date())} <span className="text-[11px] text-gray-400">(la posa el sistema / set by the system)</span></p>
          </div>
          <div className="sm:flex sm:items-start gap-4 py-1.5">
            <span className="block sm:w-56 font-bold text-[15px]">* {T.signatura.signatura.ca} <span className="block italic font-normal text-[11px] text-gray-500 pl-3">{T.signatura.signatura.en}</span></span>
            <div className="flex-1">
              <SignaturaCanvas ref={canvasKyc} onCanvi={setTeFirma} etiqueta={T.signatura.signatura.ca} />
            </div>
          </div>
        </>
      )}

      {pas === PAS_PDP && (
        <>
          <TextPdp />
          <Seccio ca={T.pdp.consentiment.titol.ca} en={T.pdp.consentiment.titol.en} />
          <label className="flex items-start gap-3 py-2">
            <input type="checkbox" checked={consentiment} onChange={(e) => setConsentiment(e.target.checked)} className="accent-[#009B9C] mt-1.5 w-4 h-4 flex-shrink-0" />
            <Bilingue ca={T.pdp.consentiment.ca} en={T.pdp.consentiment.en} />
          </label>
          <p className="text-[11px] text-gray-500">Voluntari: si no ho marqueu, no us enviarem aquesta informació i els serveis es presten igualment. / <span className="italic">Optional: if you leave it unticked, we will not send you this information and the services are provided in the same way.</span></p>

          <Seccio ca={T.pdp.signatura.titol.ca} en={T.pdp.signatura.titol.en} />
          <Bilingue ca={T.pdp.signatura.declaracio.ca} en={T.pdp.signatura.declaracio.en} className="mb-2" />
          <div className="sm:flex sm:items-start gap-4 py-1.5">
            <label htmlFor="llocPdp" className="block sm:w-56 font-bold text-[15px]">* {T.signatura.lloc.ca} <span className="block italic font-normal text-[11px] text-gray-500 pl-3">{T.signatura.lloc.en}</span></label>
            <input id="llocPdp" value={lloc.pdp} maxLength={100} onChange={(e) => setLloc({ ...lloc, pdp: e.target.value })}
              placeholder="p. ex. Andorra la Vella / e.g. Andorra la Vella"
              className="flex-1 w-full bg-[#FBFAF1] border border-[#C2BD6B] rounded-sm px-3 py-2 text-[15px]" />
          </div>
          <div className="sm:flex sm:items-start gap-4 py-1.5">
            <span className="block sm:w-56 font-bold text-[15px]">* {T.signatura.signatura.ca} <span className="block italic font-normal text-[11px] text-gray-500 pl-3">{T.signatura.signatura.en}</span></span>
            <div className="flex-1">
              <p className="text-[11px] text-gray-500 mb-1">Aquesta és una segona signatura, diferent de la del formulari KYC. / <span className="italic">This is a second signature, separate from the one on the KYC form.</span></p>
              <SignaturaCanvas ref={canvasPdp} onCanvi={setTeFirmaPdp} etiqueta={T.signatura.signatura.ca} />
            </div>
          </div>
        </>
      )}

      <AvisError>{error}</AvisError>

      {/* Navegació */}
      <div className="flex flex-wrap justify-between gap-3 mt-8">
        {pas > 0 && pas !== PAS_PDP && <BotoSecundari onClick={() => vesA(pas - 1)} disabled={estat === 'signant'}>← Anterior / Back</BotoSecundari>}
        {pas === PAS_PDP && <BotoSecundari onClick={() => { setPas(PAS_REVISIO); setFirmaKyc(null); }} disabled={estat === 'signant'}>← Tornar al KYC / Back to KYC</BotoSecundari>}
        <span className="flex-1" />
        {pas < PAS_DOCS && <BotoPrimari onClick={() => vesA(pas + 1)}>Següent / Next →</BotoPrimari>}
        {pas === PAS_DOCS && (
          <BotoPrimari onClick={() => vesA(PAS_REVISIO)} disabled={!documentsComplets}>
            {documentsComplets ? 'Revisar i signar / Review and sign →' : `Falten ${docs.pendents.length} documents / ${docs.pendents.length} documents missing`}
          </BotoPrimari>
        )}
        {pas === PAS_REVISIO && (
          <BotoPrimari onClick={continuarAPdp} disabled={!formulariComplet || !documentsComplets}>Signar el KYC i continuar / Sign the KYC and continue →</BotoPrimari>
        )}
        {pas === PAS_PDP && (
          <BotoPrimari onClick={signa} disabled={estat === 'signant'}>{estat === 'signant' ? 'Signant… / Signing…' : 'Signar i finalitzar / Sign and finish'}</BotoPrimari>
        )}
      </div>
      {(pas === PAS_REVISIO || pas === PAS_PDP) && (
        <p className="text-[11px] text-gray-500 text-center mt-3">
          En signar, s'enregistren la data i l'hora, l'adreça IP i el navegador com a evidència.
          <span className="italic block">When you sign, the date and time, IP address and browser are recorded as evidence.</span>
        </p>
      )}
    </Pantalla>
  );
};

export default PaginaKyc;
