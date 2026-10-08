// src/portal/signar/PaginaSignar.jsx
// Pàgina pública del client: /signar/<token>. Sense compte.
// Formulari de l'autorització de càrrec en compte amb el mateix contingut i
// estil que el PDF (català amb l'anglès a sota). Els textos surten de
// text-autoritzacio.json, idèntic al que fa servir el PDF del servidor.
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import T from './text-autoritzacio.json';
import PD from './text-proteccio-dades.json';
import logo from './logo-ambit.jpg';
import SignaturaCanvas from './SignaturaCanvas';
import { formata, validaIban } from './iban';

const MAX_ADJUNT = 20 * 1024 * 1024;
const TIPUS_ADJUNT = ['application/pdf', 'image/jpeg', 'image/png'];

const token = window.location.pathname.replace(/^\/signar\//, '').replace(/\/+$/, '');

const crida = async (body) => {
  const { data, error } = await supabase.functions.invoke('portal-signar', { body: { token, ...body } });
  if (error) {
    const detall = await error.context?.json?.().catch(() => null);
    const e = new Error(detall?.error || 'No s\'ha pogut connectar. Torneu-ho a provar.');
    e.status = error.context?.status;
    throw e;
  }
  return data;
};

const dataAvui = () => new Date().toLocaleDateString('ca-AD', { timeZone: 'Europe/Andorra', day: '2-digit', month: '2-digit', year: 'numeric' });

// ─── Peces visuals (mateix estil que el PDF) ────────────────────────────────
const Seccio = ({ ca, en }) => (
  <div className="flex items-baseline justify-between bg-[#009B9C] text-white px-3 py-1.5 mt-7 mb-2">
    <span className="font-bold text-[15px]">{ca}</span>
    <span className="italic text-xs">{en}</span>
  </div>
);

const Etiqueta = ({ ca, en, obligatori, htmlFor }) => (
  <label htmlFor={htmlFor} className="block sm:w-56 sm:flex-shrink-0 mb-1 sm:mb-0">
    <span className="font-bold text-[15px] text-gray-900">{obligatori && <span className="font-normal">* </span>}{ca}</span>
    <span className="block italic text-[11px] text-gray-500 pl-3">{en}</span>
  </label>
);

const Camp = ({ id, ca, en, obligatori = true, children }) => (
  <div className="sm:flex sm:items-start gap-4 py-1.5">
    <Etiqueta ca={ca} en={en} obligatori={obligatori} htmlFor={id} />
    <div className="flex-1">{children}</div>
  </div>
);

const estilEntrada = 'w-full bg-[#FBFAF1] border border-[#C2BD6B] rounded-sm px-3 py-2 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40';

const Entrada = (props) => <input {...props} className={estilEntrada} />;

const Bilingue = ({ ca, en, className = '' }) => (
  <div className={className}>
    <p className="text-[15px] text-gray-900 text-justify leading-snug">{ca}</p>
    <p className="text-xs italic text-gray-500 text-justify mt-1 leading-snug">{en}</p>
  </div>
);

const Pantalla = ({ children }) => (
  <div className="min-h-screen bg-gray-100 py-6 sm:py-10 px-3">
    <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-lg px-4 sm:px-10 py-8">
      <header className="flex items-start justify-between gap-4 pb-4 border-b-2 border-[#009B9C]">
        <img src={logo} alt="ÀMBIT Associats" className="h-12 sm:h-14 w-auto" />
        <div className="text-right">
          <h1 className="text-base sm:text-xl font-bold text-[#009B9C] leading-tight">{T.titol.ca}</h1>
          <p className="text-xs sm:text-sm italic text-gray-500">{T.titol.en}</p>
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

const Missatge = ({ icona, ca, en, children }) => (
  <Pantalla>
    <div className="text-center py-12">
      <div className="text-5xl mb-4">{icona}</div>
      <h2 className="text-xl font-bold text-gray-800">{ca}</h2>
      <p className="text-sm italic text-gray-500 mt-1">{en}</p>
      {children}
    </div>
  </Pantalla>
);

// ─── Pàgina ─────────────────────────────────────────────────────────────────
const PaginaSignar = () => {
  const [estat, setEstat] = useState('carregant'); // carregant | invalid | formulari | signant | fet
  const [errorInicial, setErrorInicial] = useState('');
  const [info, setInfo] = useState(null);
  const [d, setD] = useState({
    titular_nom: '', titular_adreca: '', titular_cp_poblacio: '', iban: '',
    client_facturat_nom: '', signatari_nom: '', signatari_carrec: '', lloc: '',
  });
  const [esAdmin, setEsAdmin] = useState(null);
  const [poder, setPoder] = useState({ path: null, nom: '', pujant: false, error: '' });
  const [teFirma, setTeFirma] = useState(false);
  const [error, setError] = useState('');
  const [resultat, setResultat] = useState(null);
  const firma = useRef(null);

  // L'enllaç conté el token: que no surti cap a altres llocs ni als cercadors
  useEffect(() => {
    document.title = 'Autorització de càrrec en compte · ÀMBIT Associats';
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
        setD((prev) => ({
          ...prev,
          titular_nom: r.titular_nom || '',
          titular_adreca: r.titular_adreca || '',
          titular_cp_poblacio: r.titular_cp_poblacio || '',
          client_facturat_nom: r.client_facturat_nom || '',
        }));
        setEstat('formulari');
      })
      .catch((e) => {
        setErrorInicial(e.status === 429 ? e.message : '');
        setEstat('invalid');
      });
  }, []);

  if (estat === 'carregant') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Carregant... / Loading...</div>;
  }
  if (estat === 'invalid') {
    return (
      <Missatge icona="🔒" ca={errorInicial || 'Enllaç no vàlid o caducat'} en="Invalid or expired link">
        <p className="text-sm text-gray-600 mt-6">
          Si necessiteu un enllaç nou, contacteu amb nosaltres a{' '}
          <a href="mailto:info@ambit.ad" className="text-[#009B9C] underline">info@ambit.ad</a> o al +376 655 382.
        </p>
        <p className="text-xs italic text-gray-500 mt-1">If you need a new link, please contact us at info@ambit.ad or on +376 655 382.</p>
      </Missatge>
    );
  }
  if (estat === 'fet') {
    return (
      <Missatge icona="✅" ca="Autorització signada" en="Authorisation signed">
        <p className="text-sm text-gray-600 mt-6">Gràcies. Hem rebut la vostra autorització signada.</p>
        <p className="text-xs italic text-gray-500">Thank you. We have received your signed authorisation.</p>
        {resultat?.url && (
          <a href={resultat.url} download={resultat.nom_fitxer}
            className="inline-block mt-6 bg-[#009B9C] hover:bg-[#007A7B] text-white font-bold px-6 py-3 rounded-xl text-sm">
            Descarregar el PDF / Download PDF
          </a>
        )}
        <p className="text-xs text-gray-500 mt-4">
          L'enllaç de descàrrega és vàlid durant 5 minuts. Si el necessiteu més endavant, demaneu-nos-en una còpia a info@ambit.ad.
        </p>
        <p className="text-[11px] italic text-gray-400">
          The download link is valid for 5 minutes. If you need it later, ask us for a copy at info@ambit.ad.
        </p>
      </Missatge>
    );
  }

  const pj = info.party_type === 'pj';
  const iban = validaIban(d.iban);
  const calPoder = pj && esAdmin === false;
  const canvi = (k) => (e) => setD({ ...d, [k]: e.target.value });

  const pujaPoder = async (fitxer) => {
    setPoder({ path: null, nom: fitxer?.name || '', pujant: false, error: '' });
    if (!fitxer) return;
    if (!TIPUS_ADJUNT.includes(fitxer.type)) {
      setPoder((p) => ({ ...p, error: 'Format no admès: PDF, JPG o PNG. / Format not accepted: PDF, JPG or PNG.' }));
      return;
    }
    if (fitxer.size > MAX_ADJUNT) {
      setPoder((p) => ({ ...p, error: 'El fitxer supera els 20 MB. / The file exceeds 20 MB.' }));
      return;
    }
    setPoder((p) => ({ ...p, pujant: true }));
    try {
      const r = await crida({ accio: 'url_pujada', mime: fitxer.type, mida: fitxer.size });
      const { error: e } = await supabase.storage.from('portal-docs')
        .uploadToSignedUrl(r.path, r.upload_token, fitxer, { contentType: fitxer.type });
      if (e) throw new Error('No s\'ha pogut pujar el fitxer. / The file could not be uploaded.');
      setPoder((p) => ({ ...p, path: r.path, pujant: false }));
    } catch (e) {
      setPoder((p) => ({ ...p, pujant: false, error: e.message }));
    }
  };

  const signa = async (e) => {
    e.preventDefault();
    setError('');
    if (!iban.ok) { setError('Reviseu l\'IBAN. / Please check the IBAN.'); return; }
    if (pj && esAdmin === null) { setError('Indiqueu si el signant és administrador. / Please state whether the signatory is a director.'); return; }
    if (calPoder && !poder.path) { setError('Adjunteu el poder del signant. / Please attach the signatory\'s power of attorney.'); return; }
    if (!teFirma || firma.current?.buida()) { setError('Falta la signatura. / The signature is missing.'); return; }

    setEstat('signant');
    try {
      const r = await crida({
        accio: 'signar',
        ...d,
        iban: iban.iban,
        signant_es_administrador: pj ? esAdmin : undefined,
        poder_path: calPoder ? poder.path : undefined,
        signatura_png: firma.current.png(),
      });
      setResultat(r);
      setEstat('fet');
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
      setEstat('formulari');
    }
  };

  const signant = estat === 'signant';
  const expira = new Date(info.expira_at).toLocaleDateString('ca-AD', { timeZone: 'Europe/Andorra', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <Pantalla>
      <form onSubmit={signa}>
        <div className="mt-5 bg-[#009B9C]/5 border border-[#009B9C]/30 rounded-lg p-4 text-sm text-gray-700">
          <p><strong>{info.client_nom}</strong>: empleneu i signeu aquesta autorització. L'enllaç caduca el {expira}.</p>
          <p className="text-xs italic text-gray-500 mt-1">Please complete and sign this authorisation. The link expires on {expira}.</p>
        </div>

        {/* Creditor */}
        <Seccio ca={T.creditor.seccio.ca} en={T.creditor.seccio.en} />
        <div className="divide-y divide-gray-200">
          {T.creditor.files.map((f) => (
            <div key={f.ca} className="sm:flex py-1.5 text-[15px]">
              <span className="block sm:w-56 sm:flex-shrink-0 text-gray-900">{f.ca} <span className="italic text-[11px] text-gray-500">/ {f.en}</span></span>
              <span className="block font-bold text-gray-900">{f.valor}</span>
            </div>
          ))}
        </div>

        {/* Titular */}
        <Seccio ca={T.titular.seccio.ca} en={T.titular.seccio.en} />
        <p className="text-[11px] italic text-gray-500 mb-2">{T.titular.avis.ca}  /  {T.titular.avis.en}</p>
        <Camp id="tn" ca={T.titular.nom.ca} en={T.titular.nom.en}>
          <Entrada id="tn" required maxLength={200} autoComplete="name" value={d.titular_nom} onChange={canvi('titular_nom')} />
        </Camp>
        <Camp id="ta" ca={T.titular.adreca.ca} en={T.titular.adreca.en}>
          <Entrada id="ta" required maxLength={200} autoComplete="street-address" value={d.titular_adreca} onChange={canvi('titular_adreca')} />
        </Camp>
        <Camp id="tc" ca={T.titular.cp_poblacio.ca} en={T.titular.cp_poblacio.en}>
          <Entrada id="tc" required maxLength={200} value={d.titular_cp_poblacio} onChange={canvi('titular_cp_poblacio')} />
        </Camp>
        <Camp id="ti" ca={T.titular.iban.ca} en={T.titular.iban.en}>
          <Entrada id="ti" required inputMode="text" autoComplete="off" spellCheck={false} placeholder="AD00 0000 0000 0000 0000 0000"
            value={formata(d.iban)} maxLength={29} onChange={(e) => setD({ ...d, iban: e.target.value })} />
          {iban.error && (
            <p className="text-xs text-red-600 mt-1">{iban.error.ca} <span className="italic text-red-400">/ {iban.error.en}</span></p>
          )}
        </Camp>
        <Camp ca={T.titular.entitat.ca} en={T.titular.entitat.en}>
          <div className="flex flex-wrap gap-x-10 gap-y-2 pt-1" aria-live="polite">
            {[['andbank', 'Andbank'], ['creand', 'Creand'], ['morabanc', 'MoraBanc']].map(([k, nom]) => (
              <span key={k} className="flex items-center gap-2 text-[15px]">
                <span className={`w-5 h-5 border border-[#C2BD6B] flex items-center justify-center text-[#007A7B] font-bold ${iban.entitat === k ? 'bg-[#009B9C]/10' : 'bg-white'}`}>
                  {iban.entitat === k ? '✕' : ''}
                </span>
                {nom}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Es marca sola segons l'IBAN. / Selected automatically from the IBAN.</p>
        </Camp>

        {/* Client facturat */}
        <Seccio ca={T.facturat.seccio.ca} en={T.facturat.seccio.en} />
        <p className="text-[11px] italic text-gray-500 mb-2">{T.facturat.avis.ca}  /  {T.facturat.avis.en}</p>
        <Camp id="cf" ca={T.facturat.nom.ca} en={T.facturat.nom.en} obligatori={false}>
          <Entrada id="cf" maxLength={200} value={d.client_facturat_nom} onChange={canvi('client_facturat_nom')} />
        </Camp>

        {/* Autorització i condicions */}
        <Seccio ca={T.autoritzacio.seccio.ca} en={T.autoritzacio.seccio.en} />
        <Bilingue ca={T.autoritzacio.ca} en={T.autoritzacio.en} />

        <Seccio ca={T.condicions.seccio.ca} en={T.condicions.seccio.en} />
        <ol className="space-y-3">
          {T.condicions.punts.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[15px] text-gray-900">{i + 1}.</span>
              <Bilingue ca={c.ca} en={c.en} className="flex-1" />
            </li>
          ))}
        </ol>

        {/* Informació sobre protecció de dades (art. 16 Llei 29/2021), abans de signar */}
        <details className="mt-5 border border-[#009B9C]/40 rounded-lg">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#007A7B]">
            {PD.ca.titol} <span className="font-normal italic text-gray-500">/ {PD.en.titol}</span>
          </summary>
          <div className="px-4 pb-4 space-y-4">
            {[['ca', 'text-[15px] text-gray-900', 'font-bold'], ['en', 'text-xs italic text-gray-500', 'font-semibold']].map(([idioma, estil, negreta]) => (
              <div key={idioma} lang={idioma} className={`${estil} space-y-1.5 leading-snug`}>
                <p className={negreta}>{PD[idioma].titol}</p>
                {PD[idioma].punts.map((p) => {
                  const i = p.indexOf(': ');
                  return <p key={p}><span className={negreta}>{p.slice(0, i + 1)}</span>{p.slice(i + 1)}</p>;
                })}
              </div>
            ))}
          </div>
        </details>

        {/* Signatura */}
        <Seccio ca={T.signatura.seccio.ca} en={T.signatura.seccio.en} />
        <Camp id="ll" ca={T.signatura.localitat.ca} en={T.signatura.localitat.en}>
          <Entrada id="ll" required maxLength={100} value={d.lloc} onChange={canvi('lloc')} />
        </Camp>
        <Camp ca={T.signatura.data.ca} en={T.signatura.data.en}>
          <p className="text-[15px] py-2">{dataAvui()} <span className="text-[11px] text-gray-400">(la posa el sistema / set by the system)</span></p>
        </Camp>
        <Camp id="sn" ca="Nom del signant" en="Name of the signatory">
          <Entrada id="sn" required maxLength={200} value={d.signatari_nom} onChange={canvi('signatari_nom')} />
        </Camp>
        <Camp id="sc" ca="Càrrec del signant" en="Position of the signatory" obligatori={pj}>
          <Entrada id="sc" required={pj} maxLength={200} value={d.signatari_carrec} onChange={canvi('signatari_carrec')}
            placeholder={pj ? 'p. ex. Administrador únic / Sole director' : ''} />
        </Camp>

        {pj && (
          <Camp ca="El signant és administrador?" en="Is the signatory a director?">
            <div className="flex flex-wrap gap-6 pt-1 text-[15px]">
              <label className="flex items-center gap-2">
                <input type="radio" name="admin" checked={esAdmin === true} onChange={() => setEsAdmin(true)} className="accent-[#009B9C]" />
                Sí / Yes
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="admin" checked={esAdmin === false} onChange={() => setEsAdmin(false)} className="accent-[#009B9C]" />
                No, actua amb poder / No, acting under a power of attorney
              </label>
            </div>
          </Camp>
        )}

        {calPoder && (
          <Camp id="po" ca="Poder del signant" en="Signatory's power of attorney">
            <input id="po" type="file" accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => pujaPoder(e.target.files?.[0])}
              className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#009B9C]/10 file:text-[#007A7B] file:font-semibold" />
            <p className="text-[11px] text-gray-500 mt-1">PDF, JPG o PNG, màxim 20 MB. / PDF, JPG or PNG, up to 20 MB.</p>
            {poder.pujant && <p className="text-xs text-gray-500 mt-1">Pujant... / Uploading...</p>}
            {poder.path && <p className="text-xs text-green-700 mt-1">Fitxer adjuntat ✓ / File attached ✓</p>}
            {poder.error && <p className="text-xs text-red-600 mt-1">{poder.error}</p>}
          </Camp>
        )}

        <div className="sm:flex sm:items-start gap-4 py-1.5">
          <Etiqueta ca={T.signatura.firma.ca} en={T.signatura.firma.en} obligatori />
          <div className="flex-1">
            <SignaturaCanvas ref={firma} onCanvi={setTeFirma} etiqueta={T.signatura.firma.ca} />
          </div>
        </div>

        {error && (
          <div className="mt-5 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}

        <button type="submit" disabled={signant || poder.pujant}
          className="mt-6 w-full bg-[#009B9C] hover:bg-[#007A7B] text-white font-bold py-3.5 rounded-xl transition disabled:opacity-50">
          {signant ? 'Signant... / Signing...' : 'Signar l\'autorització / Sign the authorisation'}
        </button>
        <p className="text-[11px] text-gray-500 text-center mt-2">
          En signar, s'enregistren la data i l'hora, l'adreça IP i el navegador com a evidència.
          <span className="italic block">When you sign, the date and time, IP address and browser are recorded as evidence.</span>
        </p>
      </form>
    </Pantalla>
  );
};

export default PaginaSignar;
