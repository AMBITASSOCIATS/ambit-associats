// src/portal/irpf/PaginaIrpf.jsx
// Pàgina pública /irpf/<token> de la comunicació de dades personals i
// familiars al pagador (IRPF). Sense compte. El mateix enllaç serveix:
//  · al perceptor: formulari per apartats amb desada automàtica (es pot
//    continuar més tard mentre l'enllaç sigui vigent), revisió i signatura
//    (apartat 11). Si és el representant del pagador (p. ex. l'administrador
//    únic), també signa la recepció (apartat 12) en la mateixa sessió;
//  · al representant del pagador, un cop signada pel perceptor: lectura de la
//    comunicació i signatura de la recepció (apartat 12).
// En acabar, un PDF per descarregar (enllaç de curta durada). El càlcul del
// percentatge és intern d'ÀMBIT i no es mostra mai aquí.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import T from './text-irpf.json';
import { avisosEdat, campsPendents } from './irpf-regles';
import { FormCtx, ambValor, Bilingue, Seccio } from '../kyc/camps';
import { PASSOS, S13, Tota } from './Seccions';
import SignaturaCanvas from '../signar/SignaturaCanvas';

const token = window.location.pathname.replace(/^\/irpf\//, '').replace(/\/+$/, '');
const avui = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });
const dataCurta = (d) => new Date(d).toLocaleDateString('ca-AD', { timeZone: 'Europe/Andorra', day: '2-digit', month: '2-digit', year: 'numeric' });
const hora = (d) => new Date(d).toLocaleTimeString('ca-AD', { timeZone: 'Europe/Andorra', hour: '2-digit', minute: '2-digit' });

const crida = async (body) => {
  const { data, error } = await supabase.functions.invoke('portal-irpf', { body: { token, ...body } });
  if (error) {
    const detall = await error.context?.json?.().catch(() => null);
    const e = new Error(detall?.error || 'No s\'ha pogut connectar. Torneu-ho a provar. / Could not connect. Please try again.');
    e.status = error.context?.status;
    e.detall = detall;
    throw e;
  }
  return data;
};

// ─── Pantalla: el pagador a l'esquerra (sense logotip) i el títol a la dreta ──
const Pantalla = ({ pagador, children }) => (
  <div className="min-h-screen bg-gray-100 py-6 sm:py-10 px-3">
    <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-lg px-4 sm:px-10 py-8">
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b-2 border-[#009B9C]">
        <div className="text-[#009B9C] sm:max-w-[45%]">
          {pagador ? (
            <>
              <p className="font-bold text-base sm:text-lg leading-tight">{pagador.denominacio}</p>
              <p className="text-sm">NRT {pagador.nrt}</p>
            </>
          ) : <p className="font-bold text-base">ÀMBIT Associats</p>}
        </div>
        <div className="sm:text-right sm:max-w-[55%]">
          <h1 className="text-sm sm:text-base font-bold text-[#009B9C] leading-tight">{T.titol.ca}</h1>
          <p className="text-xs italic text-gray-500 mt-0.5">{T.titol.en}</p>
        </div>
      </header>
      {children}
      <footer className="mt-10 pt-3 border-t border-[#009B9C]/60 text-[10px] text-gray-500 leading-relaxed">
        {pagador && (
          <>
            <p>{T.pdf.gestionat.ca.replace('{pagador}', pagador.denominacio)}</p>
            <p className="italic">{T.pdf.gestionat.en.replace('{pagador}', pagador.denominacio)}</p>
          </>
        )}
        <p>{T.peu[0]}</p>
        <p>{T.peu[1]}</p>
      </footer>
    </div>
  </div>
);

const Missatge = ({ icona, ca, en, children, pagador }) => (
  <Pantalla pagador={pagador}>
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

const FilaSignatura = ({ ca, en, obligatori = true, children }) => (
  <div className="sm:flex sm:items-start gap-4 py-1.5">
    <span className="block sm:w-56 font-bold text-[15px]">{obligatori && '* '}{ca} <span className="block italic font-normal text-[11px] text-gray-500 pl-3">{en}</span></span>
    <div className="flex-1">{children}</div>
  </div>
);
const estilInput = 'flex-1 w-full bg-[#FBFAF1] border border-[#C2BD6B] rounded-sm px-3 py-2 text-[15px]';

const Descarrega = ({ pdf }) => (
  <>
    {pdf?.url && (
      <a href={pdf.url} download={pdf.nom_fitxer}
        className="inline-block mt-6 bg-[#009B9C] hover:bg-[#007A7B] text-white font-bold px-6 py-3 rounded-xl text-sm">
        Comunicació signada (PDF) / Signed communication (PDF)
      </a>
    )}
    <p className="text-xs text-gray-500 mt-4">
      L'enllaç de descàrrega és vàlid durant 5 minuts. Si el necessiteu més endavant, demaneu-nos-en una còpia a info@ambit.ad.
    </p>
    <p className="text-[11px] italic text-gray-400">
      The download link is valid for 5 minutes. If you need it later, ask us for a copy at info@ambit.ad.
    </p>
  </>
);

// ─── Recepció pel pagador (representant amb el seu enllaç) ──────────────────
const Recepcio = ({ info }) => {
  const [nom, setNom] = useState('');
  const [carrec, setCarrec] = useState('');
  const [teFirma, setTeFirma] = useState(false);
  const [error, setError] = useState('');
  const [estat, setEstat] = useState('form');
  const [resultat, setResultat] = useState(null);
  const [veure, setVeure] = useState(false);
  const canvas = useRef(null);
  const S12 = T.s12;

  const signa = async () => {
    setError('');
    if (!nom.trim() || !carrec.trim()) { setError('Indiqueu el nom i el càrrec. / Please enter your name and position.'); return; }
    if (!teFirma || canvas.current?.buida()) { setError('Falta la signatura. / The signature is missing.'); return; }
    setEstat('signant');
    try {
      const r = await crida({ accio: 'signar_recepcio', nom, carrec, signatura: canvas.current.png() });
      setResultat(r);
      setEstat('fet');
      window.scrollTo(0, 0);
    } catch (e) {
      setEstat('form');
      setError(e.message);
    }
  };

  if (estat === 'fet') {
    return (
      <Missatge icona="✅" ca="Recepció signada" en="Receipt signed" pagador={info.pagador}>
        <p className="text-sm text-gray-600 mt-6">Gràcies. La comunicació consta com a rebuda pel pagador.</p>
        <p className="text-xs italic text-gray-500">Thank you. The communication is recorded as received by the payer.</p>
        <Descarrega pdf={resultat?.pdf} />
      </Missatge>
    );
  }

  return (
    <Pantalla pagador={info.pagador}>
      <div className="mt-5 bg-[#009B9C]/5 border border-[#009B9C]/30 rounded-lg p-4 text-sm text-gray-700">
        <p><strong>{info.signatura?.signatari_nom || info.perceptor_nom}</strong> ha signat la comunicació el {info.signatura ? dataCurta(info.signatura.signat_at) : '—'}. Com a representant del pagador, signeu-ne la recepció.</p>
        <p className="text-xs italic text-gray-500 mt-1">{info.signatura?.signatari_nom || info.perceptor_nom} signed the communication. As the payer's representative, please sign the receipt.</p>
      </div>
      <button type="button" onClick={() => setVeure(!veure)} className="mt-4 text-sm font-semibold text-[#007A7B] hover:underline">
        {veure ? '− Amagar la comunicació / Hide the communication' : '+ Veure la comunicació / View the communication'}
      </button>
      {veure && (
        <FormCtx.Provider value={{ dades: info.dades || {}, posa: () => {}, err: () => false, llegir: true }}>
          <fieldset disabled className="opacity-95"><Tota pagador={info.pagador} /></fieldset>
        </FormCtx.Provider>
      )}

      <Seccio num="12" ca={S12.titol.ca} en={S12.titol.en} />
      <Bilingue ca={S12.text.ca} en={S12.text.en} className="mb-2" />
      <FilaSignatura ca={S12.representant.ca} en={S12.representant.en}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={nom} maxLength={200} onChange={(e) => setNom(e.target.value)} placeholder="Nom i cognoms / Full name" className={estilInput} />
          <input value={carrec} maxLength={200} onChange={(e) => setCarrec(e.target.value)} placeholder="Càrrec / Position" className={estilInput} />
        </div>
      </FilaSignatura>
      <FilaSignatura ca={T.s11.data.ca} en={T.s11.data.en} obligatori={false}>
        <p className="text-[15px] py-2">{dataCurta(new Date())} <span className="text-[11px] text-gray-400">(la posa el sistema / set by the system)</span></p>
      </FilaSignatura>
      <FilaSignatura ca={T.s11.signatura.ca} en={T.s11.signatura.en}>
        <SignaturaCanvas ref={canvas} onCanvi={setTeFirma} etiqueta={T.s11.signatura.ca} />
      </FilaSignatura>
      <AvisError>{error}</AvisError>
      <div className="flex justify-end mt-8">
        <BotoPrimari onClick={signa} disabled={estat === 'signant'}>{estat === 'signant' ? 'Signant… / Signing…' : 'Signar la recepció / Sign the receipt'}</BotoPrimari>
      </div>
      <p className="text-[11px] text-gray-500 text-center mt-3">
        En signar, s'enregistren la data i l'hora, l'adreça IP i el navegador com a evidència.
        <span className="italic block">When you sign, the date and time, IP address and browser are recorded as evidence.</span>
      </p>
    </Pantalla>
  );
};

// ─── Pàgina ─────────────────────────────────────────────────────────────────
const PaginaIrpf = () => {
  const [estat, setEstat] = useState('carregant'); // carregant | invalid | form | signant | fet
  const [errorInicial, setErrorInicial] = useState('');
  const [info, setInfo] = useState(null);
  const [dades, setDades] = useState({});
  const [pas, setPas] = useState(0);
  const [vistos, setVistos] = useState(() => new Set());
  const [desat, setDesat] = useState({ desant: false, at: null, error: '' });
  const [lloc, setLloc] = useState('');
  const [carrec, setCarrec] = useState('');
  const [teFirma, setTeFirma] = useState(false);
  const [teFirmaRec, setTeFirmaRec] = useState(false);
  const [error, setError] = useState('');
  const [resultat, setResultat] = useState(null);
  const canvas = useRef(null);
  const canvasRec = useRef(null);
  const carregat = useRef(false);
  const pendentDesar = useRef(false);
  const darrerDesat = useRef('');

  // L'enllaç conté el token: que no surti cap a altres llocs ni als cercadors
  useEffect(() => {
    document.title = 'Comunicació de dades al pagador · ÀMBIT Associats';
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
        setDesat({ desant: false, at: r.desat_at, error: '' });
        setEstat('form');
        carregat.current = true;
      })
      .catch((e) => {
        setErrorInicial(e.status === 429 ? e.message : '');
        setEstat('invalid');
      });
  }, []);

  const perceptor = info?.mode === 'perceptor';
  const PAS_REVISIO = PASSOS.length;

  // Desada automàtica (1,5 s després de l'últim canvi)
  const desa = useCallback(async (d) => {
    const json = JSON.stringify(d);
    if (json === darrerDesat.current) { pendentDesar.current = false; return; }
    setDesat((x) => ({ ...x, desant: true, error: '' }));
    try {
      const r = await crida({ accio: 'desa', dades: d });
      setDesat({ desant: false, at: r.desat_at, error: '' });
      darrerDesat.current = json;
      pendentDesar.current = false;
    } catch (e) {
      setDesat((x) => ({ ...x, desant: false, error: e.status === 404 ? 'Enllaç caducat / Link expired' : 'No s\'ha pogut desar / Could not save' }));
    }
  }, []);
  useEffect(() => {
    if (!carregat.current || estat !== 'form' || !perceptor) return undefined;
    pendentDesar.current = true;
    const t = setTimeout(() => desa(dades), 1500);
    return () => clearTimeout(t);
  }, [dades, desa, estat, perceptor]);

  const posa = useCallback((cami, valor) => setDades((d) => ambValor(d, cami, valor)), []);
  const pendents = useMemo(() => campsPendents(dades, avui()), [dades]);
  const camisPendents = useMemo(() => new Set(pendents.map((p) => p.camp)), [pendents]);
  const avisos = useMemo(() => avisosEdat(dades, avui()), [dades]);

  const vesA = async (n) => {
    setVistos((v) => new Set([...v, pas]));
    if (pendentDesar.current || n >= PAS_REVISIO) await desa(dades);
    setError('');
    setPas(n);
    window.scrollTo(0, 0);
  };

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
  if (info.mode === 'recepcio') return <Recepcio info={info} />;

  if (estat === 'fet') {
    return (
      <Missatge icona="✅" ca="Comunicació signada" en="Communication signed" pagador={info.pagador}>
        <p className="text-sm text-gray-600 mt-6">
          Gràcies. Hem rebut la comunicació signada{resultat?.rebuda ? ', i també la recepció pel pagador.' : '. El pagador en signarà la recepció.'}
        </p>
        <p className="text-xs italic text-gray-500">
          Thank you. We have received the signed communication{resultat?.rebuda ? ', and the receipt by the payer.' : '. The payer will sign the receipt.'}
        </p>
        <Descarrega pdf={resultat?.pdf} />
      </Missatge>
    );
  }

  const err = (cami) => (vistos.has(pas) || pas >= PAS_REVISIO ? camisPendents.has(cami) : false);
  const expira = dataCurta(info.expira_at);
  const complet = pendents.length === 0;
  const pendentsPas = (i) => pendents.filter((p) => PASSOS[i].seccions.includes(p.seccio)).length;

  const signa = async () => {
    setError('');
    if (!complet) { setError('Falten dades obligatòries. / Some required data are missing.'); return; }
    if (!lloc.trim()) { setError('Indiqueu el lloc de signatura. / Please enter the place of signature.'); return; }
    if (!teFirma || canvas.current?.buida()) { setError('Falta la signatura. / The signature is missing.'); return; }
    if (info.doble_signatura) {
      if (!carrec.trim()) { setError('Indiqueu el vostre càrrec al pagador. / Please enter your position at the payer.'); return; }
      if (!teFirmaRec || canvasRec.current?.buida()) { setError('Falta la signatura de la recepció pel pagador. / The receipt signature is missing.'); return; }
    }
    setEstat('signant');
    try {
      const r = await crida({
        accio: 'signar', dades, lloc, signatura: canvas.current.png(),
        ...(info.doble_signatura ? { carrec_recepcio: carrec, signatura_recepcio: canvasRec.current.png() } : {}),
      });
      setResultat(r);
      setEstat('fet');
      window.scrollTo(0, 0);
    } catch (e) {
      setEstat('form');
      setError(e.message);
    }
  };

  const passos = [
    ...PASSOS.map((p, i) => ({ n: i, nom: `Apartats ${p.nom}`, falten: pendentsPas(i) })),
    { n: PAS_REVISIO, nom: 'Revisió i signatura', falten: 0 },
  ];
  const Actual = PASSOS[pas]?.C;

  return (
    <Pantalla pagador={info.pagador}>
      <div className="mt-5 bg-[#009B9C]/5 border border-[#009B9C]/30 rounded-lg p-4 text-sm text-gray-700">
        <p>Empleneu la comunicació i signeu-la. Les respostes es desen soles; podeu continuar més tard amb el mateix enllaç fins al {expira}.</p>
        <p className="text-xs italic text-gray-500 mt-1">Please complete and sign the communication. Your answers are saved automatically; you can continue later with the same link until {expira}.</p>
      </div>

      <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Passos / Steps">
        {passos.map((p) => (
          <button key={p.n} type="button" disabled={estat === 'signant'} onClick={() => vesA(p.n)}
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
        {Actual && <Actual pagador={info.pagador} />}
      </FormCtx.Provider>

      {pas === PAS_REVISIO && (
        <>
          <Seccio ca="Revisió" en="Review" />
          <p className="text-sm text-gray-700">Reviseu totes les respostes abans de signar. Per corregir-ne alguna, torneu a l'apartat corresponent.</p>
          <p className="text-xs italic text-gray-500 mb-2">Please review all your answers before signing. To correct any of them, go back to the relevant section.</p>
          {!complet && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mt-3">
              <p className="font-semibold">Falta completar: / Still to complete:</p>
              <ul className="list-disc pl-5 mt-1">
                {passos.filter((p) => p.falten && p.n < PAS_REVISIO).map((p) => (
                  <li key={p.n}><button type="button" className="underline" onClick={() => vesA(p.n)}>{p.nom}</button> ({p.falten})</li>
                ))}
              </ul>
            </div>
          )}
          {avisos.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mt-3">
              {avisos.length} avís d'edat (no impedeix signar) / {avisos.length} age warning (does not prevent signing)
            </div>
          )}
          <FormCtx.Provider value={{ dades, posa, err: (c) => camisPendents.has(c), llegir: true }}>
            <fieldset disabled className="opacity-95">
              <Tota pagador={info.pagador} />
              <S13 />
            </fieldset>
          </FormCtx.Provider>

          <Seccio num="11" ca={T.s11.titol.ca} en={T.s11.titol.en} />
          <FilaSignatura ca={T.s11.lloc.ca} en={T.s11.lloc.en}>
            <input value={lloc} maxLength={100} onChange={(e) => setLloc(e.target.value)} placeholder={`${T.s11.exemple_lloc} / e.g. Andorra la Vella`} className={estilInput} />
          </FilaSignatura>
          <FilaSignatura ca={T.s11.data.ca} en={T.s11.data.en} obligatori={false}>
            <p className="text-[15px] py-2">{dataCurta(new Date())} <span className="text-[11px] text-gray-400">(la posa el sistema / set by the system)</span></p>
          </FilaSignatura>
          <FilaSignatura ca={T.s11.signatura.ca} en={T.s11.signatura.en}>
            <SignaturaCanvas ref={canvas} onCanvi={setTeFirma} etiqueta={T.s11.signatura.ca} />
          </FilaSignatura>

          {info.doble_signatura && (
            <>
              <Seccio num="12" ca={T.s12.titol.ca} en={T.s12.titol.en} />
              <Bilingue ca={T.s12.text.ca} en={T.s12.text.en} className="mb-2" />
              <p className="text-[12px] bg-[#009B9C]/5 border border-[#009B9C]/30 rounded px-2 py-1 mb-2">
                Sou el representant del pagador: signeu també la recepció, amb una segona signatura. / <span className="italic">You are the payer's representative: please also sign the receipt, with a second signature.</span>
              </p>
              <FilaSignatura ca={T.s12.representant.ca} en={T.s12.representant.en}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <p className="bg-gray-50 border border-gray-200 rounded-sm px-3 py-2 text-[15px]">{dades.perceptor?.nom || '—'}</p>
                  <input value={carrec} maxLength={200} onChange={(e) => setCarrec(e.target.value)} placeholder="Càrrec, p. ex. administrador únic / Position" className={estilInput} />
                </div>
              </FilaSignatura>
              <FilaSignatura ca={T.s11.signatura.ca} en={T.s11.signatura.en}>
                <SignaturaCanvas ref={canvasRec} onCanvi={setTeFirmaRec} etiqueta={`${T.s12.titol.ca} · ${T.s11.signatura.ca}`} />
              </FilaSignatura>
            </>
          )}
        </>
      )}

      <AvisError>{error}</AvisError>

      <div className="flex flex-wrap justify-between gap-3 mt-8">
        {pas > 0 && <BotoSecundari onClick={() => vesA(pas - 1)} disabled={estat === 'signant'}>← Anterior / Back</BotoSecundari>}
        <span className="flex-1" />
        {pas < PAS_REVISIO && <BotoPrimari onClick={() => vesA(pas + 1)}>{pas === PAS_REVISIO - 1 ? 'Revisar i signar / Review and sign →' : 'Següent / Next →'}</BotoPrimari>}
        {pas === PAS_REVISIO && (
          <BotoPrimari onClick={signa} disabled={estat === 'signant' || !complet}>{estat === 'signant' ? 'Signant… / Signing…' : 'Signar i finalitzar / Sign and finish'}</BotoPrimari>
        )}
      </div>
      {pas === PAS_REVISIO && (
        <p className="text-[11px] text-gray-500 text-center mt-3">
          En signar, s'enregistren la data i l'hora, l'adreça IP i el navegador com a evidència.
          <span className="italic block">When you sign, the date and time, IP address and browser are recorded as evidence.</span>
        </p>
      )}
    </Pantalla>
  );
};

export default PaginaIrpf;
