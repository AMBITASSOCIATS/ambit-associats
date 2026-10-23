// src/portal/contracte/PaginaContracte.jsx
// Pàgina pública del signant d'un contracte: /contracte/<token>. Sense compte.
// 1. Contracte complet dins del portal (totes les pàgines) i casella de lectura.
// 2. Text íntegre de la clàusula addicional de signatura electrònica i casella
//    d'acceptació prèvia; l'acceptació es registra amb la seva data i hora.
// 3. Lloc i signatura en pantalla.
// Idioma del contracte: 'ca' (només català) o 'ca_en' (català i, a sota,
// l'anglès en cursiva). Tots els textos surten de text-contracte.json.
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import T from './text-contracte.json';
import TK from '../kyc/text-kyc.json';
import SignaturaCanvas from '../signar/SignaturaCanvas';
import VisorPdf from './VisorPdf';
import logo from '../signar/logo-ambit.jpg';

const token = window.location.pathname.replace(/^\/contracte\//, '').replace(/\/+$/, '');
const P = T.pantalla;
const omple = (t, v = {}) => Object.entries(v).reduce((s, [k, x]) => s.split(`{${k}}`).join(x), t);
const dataCurta = (d) => new Date(d).toLocaleDateString('ca-AD', { timeZone: 'Europe/Andorra', day: '2-digit', month: '2-digit', year: 'numeric' });
const hora = (d) => new Date(d).toLocaleTimeString('ca-AD', { timeZone: 'Europe/Andorra', hour: '2-digit', minute: '2-digit' });

const crida = async (body) => {
  const { data, error } = await supabase.functions.invoke('portal-contracte', { body: { token, ...body } });
  if (error) {
    const detall = await error.context?.json?.().catch(() => null);
    const e = new Error(detall?.error || 'error');
    e.codi = detall?.codi || (error.context?.status === 429 ? 'massa_intents' : detall ? 'error' : 'error_connexio');
    e.status = error.context?.status;
    throw e;
  }
  return data;
};

// Text en l'idioma del contracte: català i, si és bilingüe, l'anglès a sota en cursiva
const Text = ({ t, bi, v, gran = false, className = '' }) => (
  <div className={className}>
    <p className={gran ? 'text-[15px] text-gray-900 text-justify leading-snug' : 'text-sm text-gray-800'}>{omple(t.ca, v)}</p>
    {bi && t.en && <p className="text-xs italic text-gray-500 text-justify mt-1 leading-snug">{omple(t.en, v)}</p>}
  </div>
);

const Pantalla = ({ bi, children }) => (
  <div className="min-h-screen bg-gray-100 py-6 sm:py-10 px-3">
    <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-lg px-4 sm:px-10 py-8">
      <header className="flex items-start justify-between gap-4 pb-4 border-b-2 border-[#009B9C]">
        <img src={logo} alt="ÀMBIT Associats" className="h-12 sm:h-14 w-auto" />
        <div className="text-right">
          <h1 className="text-sm sm:text-lg font-bold text-[#009B9C] leading-tight">{P.titol.ca}</h1>
          {bi && <p className="text-xs sm:text-sm italic text-gray-500">{P.titol.en}</p>}
        </div>
      </header>
      {children}
      <footer className="mt-10 pt-3 border-t border-[#009B9C]/60 text-[10px] text-gray-500 leading-relaxed">
        <p>{TK.peu[0]}</p>
        <p>{TK.peu[1]}</p>
      </footer>
    </div>
  </div>
);

const Seccio = ({ t, bi }) => (
  <div className="flex items-baseline justify-between gap-3 bg-[#009B9C] text-white px-3 py-1.5 mt-7 mb-3">
    <span className="font-bold text-[15px]">{t.ca}</span>
    {bi && <span className="italic text-xs text-right">{t.en}</span>}
  </div>
);

const Casella = ({ t, bi, marcada, onCanvi, disabled }) => (
  <label className={`flex items-start gap-3 p-3 rounded-lg border ${marcada ? 'border-[#009B9C] bg-[#009B9C]/5' : 'border-gray-300'} ${disabled ? 'opacity-70' : 'cursor-pointer'}`}>
    <input type="checkbox" checked={marcada} disabled={disabled} onChange={(e) => onCanvi(e.target.checked)} className="mt-1 w-5 h-5 accent-[#009B9C] flex-shrink-0" />
    <Text t={t} bi={bi} gran />
  </label>
);

const Boto = ({ children, secundari, ...p }) => (
  <button type="button" {...p}
    className={`${secundari ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-[#009B9C] hover:bg-[#007A7B] text-white'} font-bold px-5 py-3 rounded-xl text-sm transition disabled:opacity-50`}>
    {children}
  </button>
);

const PaginaContracte = () => {
  const [estat, setEstat] = useState('carregant'); // carregant | invalid | contracte | fet
  const [info, setInfo] = useState(null);
  const [pas, setPas] = useState(1);
  const [vist, setVist] = useState(false);
  const [llegit, setLlegit] = useState(false);
  const [accepta, setAccepta] = useState(false);
  const [acceptatAt, setAcceptatAt] = useState(null);
  const [lloc, setLloc] = useState('');
  const [teFirma, setTeFirma] = useState(false);
  const [ocupat, setOcupat] = useState(false);
  const [error, setError] = useState(null);
  const canvas = useRef(null);

  useEffect(() => {
    document.title = 'ÀMBIT Associats';
    crida({ accio: 'obrir' })
      .then((r) => {
        setInfo(r);
        setAcceptatAt(r.signant.acceptat_at);
        setEstat('contracte');
      })
      .catch(() => setEstat('invalid'));
  }, []);

  const bi = info?.idioma === 'ca_en';
  const missatgeError = (e) => P[e.codi] || P.error;
  const amunt = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Enllaç no vàlid: no se sap l'idioma del contracte; només en català
  if (estat === 'carregant') return <Pantalla bi={false}><p className="text-sm text-gray-500 py-12 text-center">{P.carregant.ca}</p></Pantalla>;
  if (estat === 'invalid') {
    return (
      <Pantalla bi={false}>
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-800">{P.invalid.ca}</h2>
          <p className="text-sm text-gray-500 mt-3">{P.invalid_ajuda.ca}</p>
        </div>
      </Pantalla>
    );
  }
  if (estat === 'fet') {
    return (
      <Pantalla bi={bi}>
        <div className="text-center py-12">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-800">{P.fet_titol.ca}</h2>
          {bi && <p className="text-sm italic text-gray-500 mt-1">{P.fet_titol.en}</p>}
          <Text t={P.fet_text} bi={bi} className="mt-4 max-w-lg mx-auto" />
        </div>
      </Pantalla>
    );
  }

  const continua = async () => {
    setError(null);
    if (pas === 1) { setPas(2); amunt(); return; }
    if (pas === 2) {
      setOcupat(true);
      try {
        const r = await crida({ accio: 'accepta', llegit: true, accepta: true });
        setAcceptatAt(r.acceptat_at);
        setPas(3);
        amunt();
      } catch (e) {
        if (e.codi === 'invalid') setEstat('invalid'); else setError(missatgeError(e));
      } finally {
        setOcupat(false);
      }
    }
  };

  const signa = async () => {
    setError(null);
    if (!lloc.trim()) { setError(P.falta_lloc); return; }
    if (!teFirma || canvas.current?.buida()) { setError(P.falta_firma); return; }
    setOcupat(true);
    try {
      await crida({ accio: 'signar', lloc: lloc.trim(), signatura: canvas.current.png() });
      setEstat('fet');
      amunt();
    } catch (e) {
      if (e.codi === 'invalid') setEstat('invalid'); else setError(missatgeError(e));
    } finally {
      setOcupat(false);
    }
  };

  const passos = [P.pas_contracte, P.pas_clausula, P.pas_signatura];

  return (
    <Pantalla bi={bi}>
      <div className="mt-6">
        <h2 className="text-lg font-bold text-gray-800">{info.titol}</h2>
        <Text t={P.salutacio} v={{ nom: info.signant.nom }} bi={bi} className="mt-2" />
        <Text t={P.caduca} v={{ data: dataCurta(info.expira_at) }} bi={bi} className="mt-1 opacity-70" />
      </div>

      <ol className="flex flex-wrap gap-2 mt-5">
        {passos.map((t, i) => (
          <li key={t.ca} className={`text-xs px-3 py-1.5 rounded-full border ${pas === i + 1 ? 'bg-[#009B9C] text-white border-[#009B9C]' : pas > i + 1 ? 'border-[#4DB6B7] text-[#007A7B]' : 'border-gray-200 text-gray-400'}`}>
            {t.ca}{bi && <span className="italic"> · {t.en}</span>}
          </li>
        ))}
      </ol>

      {pas === 1 && (
        <>
          <Seccio t={P.pas_contracte} bi={bi} />
          <Text t={P.intro} bi={bi} className="mb-3" />
          <VisorPdf url={`${process.env.REACT_APP_SUPABASE_URL}${info.original.ruta}`}
            textPagina={(n, total) => ({ ca: omple(P.pagina.ca, { n, total }), en: bi ? omple(P.pagina.en, { n, total }) : '' })}
            textCarregant={<Text t={P.carregant_contracte} bi={bi} />}
            textError={<Text t={P.error_visor} bi={bi} />}
            onLlegit={() => setVist(true)} />
          <div className="mt-4">
            <Casella t={T.casella_lectura} bi={bi} marcada={llegit} onCanvi={setLlegit} disabled={!vist} />
          </div>
          <div className="mt-5 flex justify-end">
            <Boto onClick={continua} disabled={!llegit || !vist}>{P.continuar.ca}{bi && ` · ${P.continuar.en}`}</Boto>
          </div>
        </>
      )}

      {pas === 2 && (
        <>
          <Seccio t={T.clausula.titol} bi={bi} />
          <Text t={P.clausula_intro} bi={bi} className="mb-4 opacity-80" />
          {T.clausula.punts.map((p, i) => (
            <div key={i} className="flex gap-2 mb-3">
              <span className="text-[15px] font-semibold text-gray-700">{i + 1}.</span>
              <Text t={p} bi={bi} gran className="flex-1" />
            </div>
          ))}
          <div className="mt-5">
            <Casella t={T.casella_acceptacio} bi={bi} marcada={accepta || !!acceptatAt} onCanvi={setAccepta} disabled={!!acceptatAt} />
            {acceptatAt && <Text t={P.acceptat} v={{ data: dataCurta(acceptatAt), hora: hora(acceptatAt) }} bi={bi} className="mt-2 text-green-700" />}
          </div>
          <div className="mt-5 flex justify-between gap-3">
            <Boto secundari onClick={() => { setPas(1); amunt(); }} disabled={ocupat}>{P.tornar.ca}{bi && ` · ${P.tornar.en}`}</Boto>
            <Boto onClick={continua} disabled={ocupat || !(accepta || acceptatAt)}>{P.continuar.ca}{bi && ` · ${P.continuar.en}`}</Boto>
          </div>
        </>
      )}

      {pas === 3 && (
        <>
          <Seccio t={P.pas_signatura} bi={bi} />
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-bold text-gray-900">{P.nom.ca}{bi && <span className="block font-normal italic text-[11px] text-gray-500">{P.nom.en}</span>}</dt>
              <dd className="text-[15px] text-gray-900 bg-[#FBFAF1] border border-[#C2BD6B] rounded-sm px-3 py-2 mt-1">{info.signant.nom}</dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-gray-900">{P.qualitat.ca}{bi && <span className="block font-normal italic text-[11px] text-gray-500">{P.qualitat.en}</span>}</dt>
              <dd className="text-[15px] text-gray-900 bg-[#FBFAF1] border border-[#C2BD6B] rounded-sm px-3 py-2 mt-1">{info.signant.qualitat}</dd>
            </div>
            <label className="block">
              <span className="text-sm font-bold text-gray-900">* {P.lloc.ca}{bi && <span className="block font-normal italic text-[11px] text-gray-500">{P.lloc.en}</span>}</span>
              <input value={lloc} maxLength={100} onChange={(e) => setLloc(e.target.value)} placeholder={T.lloc_exemple}
                className="w-full bg-[#FBFAF1] border border-[#C2BD6B] rounded-sm px-3 py-2 text-[15px] mt-1 focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40" />
            </label>
            <div>
              <span className="text-sm font-bold text-gray-900">* {P.signatura.ca}{bi && <span className="block font-normal italic text-[11px] text-gray-500">{P.signatura.en}</span>}</span>
              <div className="mt-1">
                <SignaturaCanvas ref={canvas} onCanvi={setTeFirma} etiqueta={P.signatura.ca}
                  textos={{
                    signeu: bi ? `${P.signeu_aqui.ca} / ${P.signeu_aqui.en}` : P.signeu_aqui.ca,
                    esborrar: bi ? `${P.esborrar_firma.ca} / ${P.esborrar_firma.en}` : P.esborrar_firma.ca,
                  }} />
              </div>
            </div>
          </dl>
          <div className="mt-6 flex justify-between gap-3">
            <Boto secundari onClick={() => { setPas(2); amunt(); }} disabled={ocupat}>{P.tornar.ca}{bi && ` · ${P.tornar.en}`}</Boto>
            <Boto onClick={signa} disabled={ocupat}>
              {ocupat ? P.signant_ara.ca : P.signar.ca}{bi && ` · ${ocupat ? P.signant_ara.en : P.signar.en}`}
            </Boto>
          </div>
        </>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <Text t={error} bi={bi} />
        </div>
      )}
    </Pantalla>
  );
};

export default PaginaContracte;
