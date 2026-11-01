// src/portal/client/ClientApp.jsx
// Àrea de client (/client) i activació de l'accés (/client/activar#<token>).
// Català amb l'anglès a sota. Tota la informació passa per les Edge Functions
// (sessió amb segon factor, registrada i activa); aquí només es tria què es mostra.
// Tancament de la sessió als 30 minuts d'inactivitat (també al servidor).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import MarcClient from '../MarcClient';
import TA from '../signar/text-autoritzacio.json';
import P from './text-pantalles';
import { T, acces, area, desaSessio, supabaseClient, surt, ambNegreta } from './clientApi';
import { EnviarDocuments, ElsMeusDocuments, ElsMeusEnviaments } from './Seccions';
import { Bi, Boto, Camp, MissatgeError, estilCamp } from './peces';
import CampContrasenya from '../../auth/CampContrasenya';

const INACTIVITAT_MS = 30 * 60 * 1000;
const ULL = { mostra: `${P.mostraContrasenya.ca} / ${P.mostraContrasenya.en}`, amaga: `${P.amagaContrasenya.ca} / ${P.amagaContrasenya.en}` };

const Pantalla = ({ titol, accions, children, onCondicions, onPdp }) => (
  <MarcClient>
    <header className="pb-5 border-b border-[#D6E4E2] flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display font-medium text-[22px] sm:text-[28px] leading-tight text-[#12302F]">{titol.ca}</h1>
        <p className="text-sm italic text-[#4E6765] mt-1">{titol.en}</p>
      </div>
      {accions}
    </header>
    {children}
    <footer className="mt-10 pt-4 border-t border-[#D6E4E2] text-[11px] text-[#4E6765] leading-relaxed">
      {(onCondicions || onPdp) && (
        <p className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {onCondicions && (
            <button type="button" onClick={onCondicions} className="text-[#007A7B] underline underline-offset-2">
              {P.condicionsEnllac.ca} <span className="italic">/ {P.condicionsEnllac.en}</span>
            </button>
          )}
          {onPdp && (
            <button type="button" onClick={onPdp} className="text-[#007A7B] underline underline-offset-2">
              {P.pdpEnllac.ca} <span className="italic">/ {P.pdpEnllac.en}</span>
            </button>
          )}
        </p>
      )}
      <p>{TA.peu[0]}</p>
      <p>{TA.peu[1]}</p>
    </footer>
  </MarcClient>
);

// Text de les condicions d'ús (literal del fitxer de textos)
export const TextCondicions = () => (
  <div className="space-y-3">
    <div>
      <h2 className="font-display font-medium text-[19px] text-[#12302F]">{T.condicions.titol.ca}</h2>
      <p className="text-sm italic text-[#4E6765]">{T.condicions.titol.en}</p>
    </div>
    {T.condicions.punts.map((p, i) => {
      const ca = ambNegreta(p.ca);
      const en = ambNegreta(p.en);
      return (
        <div key={i}>
          <p className="text-[14px] text-[#12302F] text-justify leading-snug">{i + 1}. <strong>{ca.negreta}</strong>{ca.text}</p>
          <p className="text-xs italic text-[#4E6765] text-justify leading-snug mt-1">{i + 1}. <strong>{en.negreta}</strong>{en.text}</p>
        </div>
      );
    })}
  </div>
);

const Casella = ({ marcada, onChange }) => (
  <label className="flex items-start gap-3 bg-[#F7FBFA] border border-[#B9D3CF] rounded-lg p-3 cursor-pointer">
    <input type="checkbox" checked={marcada} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-[#007A7B]" />
    <Bi t={T.condicions.casella} petit />
  </label>
);

const Finestra = ({ children, onTancar }) => (
  <div className="fixed inset-0 bg-[#12302F]/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 font-text">
      {children}
      <div className="pt-5 text-right"><Boto secundari onClick={onTancar}>{P.tancar.ca} / {P.tancar.en}</Boto></div>
    </div>
  </div>
);

// ─── Codi TOTP ──────────────────────────────────────────────────────────────
const CampCodi = ({ valor, onChange }) => (
  <Camp t={P.codi} ajuda={P.codiAjuda}>
    <input value={valor} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric" autoComplete="one-time-code" required pattern="\d{6}"
      className={`${estilCamp} tracking-[0.4em] font-mono text-center text-lg`} />
  </Camp>
);

// ─── Activació (enllaç d'invitació o de restabliment) ───────────────────────
const Activacio = () => {
  const token = useRef(window.location.hash.replace(/^#/, ''));
  const [enllac, setEnllac] = useState(null);
  const [pas, setPas] = useState('carregant'); // carregant | invalid | contrasenya | totp | fet
  const [c1, setC1] = useState('');
  const [c2, setC2] = useState('');
  const [accepta, setAccepta] = useState(false);
  const [factor, setFactor] = useState(null);
  const [codi, setCodi] = useState('');
  const [error, setError] = useState('');
  const [ocupat, setOcupat] = useState(false);

  // Configura el segon factor amb la sessió d'activació
  const iniciaTotp = useCallback(async () => {
    const { data: f } = await supabaseClient.auth.mfa.listFactors();
    for (const x of f?.all || []) {
      if (x.status !== 'verified') await supabaseClient.auth.mfa.unenroll({ factorId: x.id });
    }
    const { data, error: e } = await supabaseClient.auth.mfa.enroll({ factorType: 'totp' });
    if (e) throw e;
    setFactor(data);
    setPas('totp');
  }, []);

  useEffect(() => {
    // El token no es queda a la barra d'adreces ni a l'historial
    window.history.replaceState(null, '', '/client/activar');
    (async () => {
      try {
        const r = await acces('obre', { token: token.current });
        setEnllac(r);
        setPas('contrasenya');
      } catch {
        // Enllaç ja consumit en aquesta mateixa sessió d'activació: continua al pas 2
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
          try { await iniciaTotp(); return; } catch { /* sessió no vàlida */ }
        }
        setPas('invalid');
      }
    })();
  }, [iniciaTotp]);

  const desaContrasenya = async (e) => {
    e.preventDefault();
    setError('');
    if (c1.length < 12) { setError(`${P.curta.ca} / ${P.curta.en}`); return; }
    if (c1 !== c2) { setError(`${P.noCoincideixen.ca} / ${P.noCoincideixen.en}`); return; }
    setOcupat(true);
    try {
      const r = await acces('activa', { token: token.current, contrasenya: c1, versio: enllac.versio });
      await desaSessio(r);
      setC1(''); setC2('');
      await iniciaTotp();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupat(false);
    }
  };

  const verificaTotp = async (e) => {
    e.preventDefault();
    setError('');
    setOcupat(true);
    try {
      const { error: errV } = await supabaseClient.auth.mfa.challengeAndVerify({ factorId: factor.id, code: codi });
      if (errV) throw new Error('Codi incorrecte. / Incorrect code.');
      const { data: { session } } = await supabaseClient.auth.getSession();
      await acces('completa', {}, session.access_token);
      setPas('fet');
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupat(false);
    }
  };

  const titol = enllac?.motiu === 'restabliment' ? P.restablirTitol : P.activarTitol;
  if (pas === 'carregant') return <Pantalla titol={titol}><p className="py-10 text-center text-sm text-[#6B8280]">{P.carregant.ca}</p></Pantalla>;
  if (pas === 'invalid') {
    return (
      <Pantalla titol={titol}>
        <div className="py-8 space-y-4">
          <MissatgeError missatge="Aquest enllaç no és vàlid o ja s'ha fet servir. / This link is not valid or has already been used." />
          <Bi t={P.noAcces} petit />
        </div>
      </Pantalla>
    );
  }
  if (pas === 'fet') {
    return (
      <Pantalla titol={titol}>
        <div className="text-center py-10 space-y-5">
          <div className="text-5xl">✓</div>
          <Bi t={P.activat} />
          <Boto onClick={() => window.location.replace('/client')}>{P.anarArea.ca} / {P.anarArea.en}</Boto>
        </div>
      </Pantalla>
    );
  }
  return (
    <Pantalla titol={titol}>
      {pas === 'contrasenya' && (
        <form onSubmit={desaContrasenya} className="space-y-5 mt-6">
          <Bi t={P.pas1} className="font-semibold" />
          <p className="text-sm text-[#2B4644]">{enllac.nom} · {enllac.email}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Camp t={P.novaContrasenya} ajuda={P.contrasenyaAjuda}>
              <CampContrasenya etiquetes={ULL} value={c1} onChange={(e) => setC1(e.target.value)} autoComplete="new-password" minLength={12} maxLength={72} required className={estilCamp} />
            </Camp>
            <Camp t={P.repeteix}>
              <CampContrasenya etiquetes={ULL} value={c2} onChange={(e) => setC2(e.target.value)} autoComplete="new-password" minLength={12} maxLength={72} required className={estilCamp} />
            </Camp>
          </div>
          <div className="border border-[#D6E4E2] rounded-lg p-4 max-h-80 overflow-y-auto"><TextCondicions /></div>
          <Casella marcada={accepta} onChange={setAccepta} />
          <MissatgeError missatge={error} />
          <Boto type="submit" disabled={ocupat || !accepta || !c1 || !c2}>{P.continuar.ca} / {P.continuar.en}</Boto>
        </form>
      )}
      {pas === 'totp' && factor && (
        <form onSubmit={verificaTotp} className="space-y-5 mt-6">
          <Bi t={P.pas2} className="font-semibold" />
          <Bi t={P.totpInstruccions} petit />
          <img src={factor.totp.qr_code} alt="QR" className="w-48 h-48 border border-[#D6E4E2] rounded-lg p-2 bg-white" />
          <div>
            <Bi t={P.totpClau} petit />
            <p className="font-mono text-sm break-all bg-[#F4F8F7] border border-[#D6E4E2] rounded px-2 py-1 mt-1 select-all">{factor.totp.secret}</p>
          </div>
          <div className="max-w-xs"><CampCodi valor={codi} onChange={setCodi} /></div>
          <MissatgeError missatge={error} />
          <Boto type="submit" disabled={ocupat || codi.length !== 6}>{P.verificar.ca} / {P.verificar.en}</Boto>
        </form>
      )}
    </Pantalla>
  );
};

// ─── Entrada: contrasenya i codi ────────────────────────────────────────────
const Entrada = ({ onEntrat, avis }) => {
  const [pas, setPas] = useState(1);
  const [email, setEmail] = useState('');
  const [contrasenya, setContrasenya] = useState('');
  const [codi, setCodi] = useState('');
  const [error, setError] = useState('');
  const [ocupat, setOcupat] = useState(false);

  const pas1 = async (e) => {
    e.preventDefault();
    setError('');
    setOcupat(true);
    try {
      await desaSessio(await acces('entra', { email, contrasenya }));
      setContrasenya('');
      setPas(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupat(false);
    }
  };
  const pas2 = async (e) => {
    e.preventDefault();
    setError('');
    setOcupat(true);
    try {
      await desaSessio(await acces('verifica', { codi }));
      onEntrat();
    } catch (err) {
      setError(err.message);
      setCodi('');
      if (err.status === 423 || (err.status === 401 && /sessió/i.test(err.message))) {
        await supabaseClient.auth.signOut({ scope: 'local' });
        setPas(1);
      }
    } finally {
      setOcupat(false);
    }
  };

  return (
    <Pantalla titol={P.titol}>
      <div className="max-w-sm mt-6 space-y-5">
        {avis && <Bi t={avis} petit className="border border-[#CFE3E1] bg-[#EEF6F6] rounded-lg px-3 py-2" />}
        {pas === 1 ? (
          <form onSubmit={pas1} className="space-y-4">
            <Camp t={P.correu}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required className={estilCamp} />
            </Camp>
            <Camp t={P.contrasenya}>
              <CampContrasenya etiquetes={ULL} value={contrasenya} onChange={(e) => setContrasenya(e.target.value)} autoComplete="current-password" required className={estilCamp} />
            </Camp>
            <MissatgeError missatge={error} />
            <Boto type="submit" disabled={ocupat}>{P.entrar.ca} / {P.entrar.en}</Boto>
          </form>
        ) : (
          <form onSubmit={pas2} className="space-y-4">
            <CampCodi valor={codi} onChange={setCodi} />
            <MissatgeError missatge={error} />
            <div className="flex gap-3">
              <Boto type="submit" disabled={ocupat || codi.length !== 6}>{P.verificar.ca} / {P.verificar.en}</Boto>
              <Boto secundari onClick={async () => { await surt(); setPas(1); setError(''); }}>{P.tornar.ca} / {P.tornar.en}</Boto>
            </div>
          </form>
        )}
        <Bi t={P.noAcces} petit className="pt-4 border-t border-[#E4EEEC]" />
      </div>
    </Pantalla>
  );
};

// ─── Condicions noves ───────────────────────────────────────────────────────
const CondicionsNoves = ({ versio, onAcceptades, onSurt }) => {
  const [accepta, setAccepta] = useState(false);
  const [error, setError] = useState('');
  const desa = async () => {
    setError('');
    try {
      await acces('accepta', { versio });
      onAcceptades();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Pantalla titol={P.titol} accions={<Boto secundari onClick={onSurt}>{P.sortir.ca} / {P.sortir.en}</Boto>}>
      <div className="mt-6 space-y-5">
        <Bi t={P.condicionsNoves} />
        <div className="border border-[#D6E4E2] rounded-lg p-4"><TextCondicions /></div>
        <Casella marcada={accepta} onChange={setAccepta} />
        <MissatgeError missatge={error} />
        <Boto disabled={!accepta} onClick={desa}>{P.acceptar.ca} / {P.acceptar.en}</Boto>
      </div>
    </Pantalla>
  );
};

// ─── Àrea ───────────────────────────────────────────────────────────────────
const SECCIONS = ['enviar', 'enviaments', 'documents'];

const Area = ({ inici, onSurt, onSessio }) => {
  const [clientId, setClientId] = useState(inici.clients[0]?.id || null);
  const [seccio, setSeccio] = useState('enviar');
  const [finestra, setFinestra] = useState(null); // condicions | pdp
  const [pdp, setPdp] = useState(null);

  // Errors de sessió de qualsevol secció: torna a l'entrada
  const ambSessio = useCallback(async (fn) => {
    try {
      return await fn();
    } catch (err) {
      if (err.status === 401 || err.status === 403 || err.status === 409 || err.status === 423) onSessio(err);
      throw err;
    }
  }, [onSessio]);

  const obrePdp = async () => {
    setFinestra('pdp');
    setPdp(null);
    try {
      const r = await ambSessio(() => area('documents', { client_id: clientId }));
      setPdp(r.documents.filter((d) => d.tipus === 'pdp'));
    } catch { setPdp([]); }
  };
  const descarrega = async (id) => {
    const r = await ambSessio(() => area('descarrega', { document_id: id }));
    window.location.assign(r.url.replace(/^https?:\/\/kong:8000/, process.env.REACT_APP_SUPABASE_URL));
  };

  const client = inici.clients.find((c) => c.id === clientId);
  return (
    <Pantalla titol={P.titol}
      accions={(
        <div className="text-right space-y-2">
          <p className="text-xs text-[#4E6765]">{inici.usuari.nom} · {inici.usuari.email}</p>
          <Boto secundari onClick={onSurt}>{P.sortir.ca} / {P.sortir.en}</Boto>
        </div>
      )}
      onCondicions={() => setFinestra('condicions')} onPdp={obrePdp}>
      {inici.clients.length > 1 && (
        <div className="mt-6 max-w-md">
          <Camp t={P.client}>
            <select value={clientId || ''} onChange={(e) => setClientId(e.target.value)} className={estilCamp}>
              {inici.clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Camp>
        </div>
      )}
      {inici.clients.length === 1 && <p className="mt-6 text-sm font-semibold text-[#12302F]">{client?.nom}</p>}

      <nav className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SECCIONS.map((s) => (
          <button key={s} type="button" onClick={() => setSeccio(s)}
            className={`text-left rounded-xl border px-4 py-3 transition ${seccio === s ? 'border-[#007A7B] bg-[#EEF6F6]' : 'border-[#D6E4E2] hover:border-[#9CC9C6]'}`}>
            <span className="block font-semibold text-[#12302F]">{P.seccions[s].ca}</span>
            <span className="block text-xs italic text-[#4E6765]">{P.seccions[s].en}</span>
          </button>
        ))}
      </nav>

      {clientId && (
        <section className="mt-6">
          {seccio === 'enviar' && <EnviarDocuments key={clientId} clientId={clientId} destinataris={inici.destinataris} ambSessio={ambSessio} onEnviat={() => setSeccio('enviaments')} />}
          {seccio === 'enviaments' && <ElsMeusEnviaments key={clientId} clientId={clientId} ambSessio={ambSessio} />}
          {seccio === 'documents' && <ElsMeusDocuments key={clientId} clientId={clientId} ambSessio={ambSessio} onDescarrega={descarrega} />}
        </section>
      )}

      {finestra === 'condicions' && <Finestra onTancar={() => setFinestra(null)}><TextCondicions /></Finestra>}
      {finestra === 'pdp' && (
        <Finestra onTancar={() => setFinestra(null)}>
          <h2 className="font-display font-medium text-[19px] text-[#12302F]">{P.pdpEnllac.ca}</h2>
          <p className="text-sm italic text-[#4E6765] mb-3">{P.pdpEnllac.en}</p>
          <p className="text-[14px] text-[#12302F] text-justify leading-snug">6. <strong>{ambNegreta(T.condicions.punts[5].ca).negreta}</strong>{ambNegreta(T.condicions.punts[5].ca).text}</p>
          <p className="text-xs italic text-[#4E6765] text-justify leading-snug mt-1 mb-4">6. <strong>{ambNegreta(T.condicions.punts[5].en).negreta}</strong>{ambNegreta(T.condicions.punts[5].en).text}</p>
          <Bi t={P.pdpDocuments} className="font-semibold mb-2" />
          {pdp === null ? <p className="text-sm text-[#6B8280]">{P.carregant.ca}</p>
            : pdp.length === 0 ? <Bi t={P.pdpCap} petit />
              : pdp.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 py-2 border-t border-[#E4EEEC]">
                  <span className="text-sm">{new Date(d.data).toLocaleDateString('ca-AD')}</span>
                  <Boto secundari onClick={() => descarrega(d.id)}>{P.descarregar.ca} / {P.descarregar.en}</Boto>
                </div>
              ))}
        </Finestra>
      )}
    </Pantalla>
  );
};

// ─── Arrel ──────────────────────────────────────────────────────────────────
const ClientApp = () => {
  const activacio = window.location.pathname.startsWith('/client/activar');
  const [estat, setEstat] = useState('carregant'); // carregant | entrada | condicions | area
  const [inici, setInici] = useState(null);
  const [avis, setAvis] = useState(null);
  const darrera = useRef(Date.now());

  useEffect(() => { document.title = 'Àrea de client · ÀMBIT Associats'; }, []);

  const carrega = useCallback(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { setEstat('entrada'); return; }
    try {
      const r = await area('inici');
      if (r.cal_condicions) { setInici({ versio: r.versio }); setEstat('condicions'); return; }
      setInici(r);
      setEstat('area');
    } catch (err) {
      await supabaseClient.auth.signOut({ scope: 'local' });
      setAvis(err.motiu === 'inactivitat' ? P.sessioCaducada : null);
      setEstat('entrada');
    }
  }, []);

  useEffect(() => { if (!activacio) carrega(); }, [activacio, carrega]);

  const tancaSessio = useCallback(async (motiu) => {
    await surt();
    setInici(null);
    setAvis(motiu === 'inactivitat' ? P.sessioCaducada : null);
    setEstat('entrada');
  }, []);

  // Inactivitat: 30 minuts sense cap interacció
  useEffect(() => {
    if (estat !== 'area' && estat !== 'condicions') return undefined;
    darrera.current = Date.now();
    const toca = () => { darrera.current = Date.now(); };
    const esdeveniments = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    esdeveniments.forEach((e) => window.addEventListener(e, toca, { passive: true }));
    const rellotge = setInterval(() => {
      if (Date.now() - darrera.current > INACTIVITAT_MS) tancaSessio('inactivitat');
    }, 15000);
    return () => {
      esdeveniments.forEach((e) => window.removeEventListener(e, toca));
      clearInterval(rellotge);
    };
  }, [estat, tancaSessio]);

  const errorSessio = useCallback((err) => {
    if (err.status === 409) { carrega(); return; }
    tancaSessio(err.motiu);
  }, [carrega, tancaSessio]);

  if (activacio) return <Activacio />;
  if (estat === 'carregant') return <Pantalla titol={P.titol}><p className="py-10 text-center text-sm text-[#6B8280]">{P.carregant.ca}</p></Pantalla>;
  if (estat === 'entrada') return <Entrada avis={avis} onEntrat={() => { setAvis(null); carrega(); }} />;
  if (estat === 'condicions') return <CondicionsNoves versio={inici.versio} onAcceptades={carrega} onSurt={() => tancaSessio()} />;
  return <Area inici={inici} onSurt={() => tancaSessio()} onSessio={errorSessio} />;
};

export default ClientApp;
