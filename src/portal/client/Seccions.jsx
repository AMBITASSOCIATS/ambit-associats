// src/portal/client/Seccions.jsx
// Àrea de client: les tres seccions de l'inici (Enviar documents, Els meus
// enviaments i Els meus documents).
import React, { useEffect, useRef, useState } from 'react';
import P from './text-pantalles';
import { EXTENSIONS, MAX_ENVIAMENT, MAX_FITXER, MAX_FITXERS, area, data, extensio, mida } from './clientApi';
import { Bi, Boto, Camp, MissatgeError, estilCamp } from './peces';

const urlPublica = (url) => url.replace(/^https?:\/\/kong:8000/, process.env.REACT_APP_SUPABASE_URL);
const bilingue = (t) => `${t.ca} / ${t.en}`;

// ─── Enviar documents ───────────────────────────────────────────────────────
export const EnviarDocuments = ({ clientId, destinataris, ambSessio, onEnviat }) => {
  const [destinatari, setDestinatari] = useState('');
  const [assumpte, setAssumpte] = useState('');
  const [comentari, setComentari] = useState('');
  const [fitxers, setFitxers] = useState([]);
  const [error, setError] = useState('');
  const [progres, setProgres] = useState(null);
  const [fet, setFet] = useState(false);
  const entrada = useRef(null);

  const afegeix = (llista) => {
    setError('');
    setFet(false);
    const nous = [...fitxers];
    for (const f of llista) {
      if (!extensio(f.name)) { setError(`${f.name}: ${bilingue(P.tipusNoAdmes)}`); continue; }
      if (f.size > MAX_FITXER) { setError(`${f.name}: ${bilingue(P.massaGran)}`); continue; }
      nous.push(f);
    }
    if (nous.length > MAX_FITXERS) { setError(bilingue(P.massaFitxers)); return; }
    if (nous.reduce((s, f) => s + f.size, 0) > MAX_ENVIAMENT) { setError(bilingue(P.massaTotal)); return; }
    setFitxers(nous);
  };

  const envia = async (e) => {
    e.preventDefault();
    setError('');
    if (!destinatari) { setError(bilingue(P.calDestinatari)); return; }
    if (!assumpte.trim()) { setError(bilingue(P.calAssumpte)); return; }
    if (!fitxers.length) { setError(bilingue(P.calFitxers)); return; }
    setProgres(0);
    try {
      const prep = await ambSessio(() => area('prepara', {
        client_id: clientId, destinatari_id: destinatari, assumpte: assumpte.trim(), comentari: comentari.trim(),
        fitxers: fitxers.map((f) => ({ nom: f.name, mida: f.size })),
      }));
      for (let i = 0; i < fitxers.length; i++) {
        const p = prep.pujades[i];
        const r = await fetch(urlPublica(p.url), {
          method: 'PUT', headers: { 'Content-Type': p.mime, apikey: process.env.REACT_APP_SUPABASE_ANON_KEY }, body: fitxers[i],
        });
        if (!r.ok) throw new Error(`${fitxers[i].name}: ${bilingue(P.massaGran)}`);
        setProgres(Math.round(((i + 1) / fitxers.length) * 100));
      }
      await ambSessio(() => area('confirma', { enviament_id: prep.enviament_id }));
      setFitxers([]);
      setAssumpte('');
      setComentari('');
      setDestinatari('');
      setFet(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setProgres(null);
    }
  };

  return (
    <form onSubmit={envia} className="space-y-5">
      <fieldset>
        <legend className="mb-2"><Bi t={P.destinatari} petit className="font-semibold" /></legend>
        <div className="space-y-2">
          {destinataris.map((d) => (
            <label key={d.id} className={`flex items-center gap-3 border rounded-lg px-3 py-2 ${d.disponible ? 'cursor-pointer border-[#B9D3CF]' : 'opacity-60 border-[#E4EEEC] bg-[#F7F9F9]'}`}>
              <input type="radio" name="destinatari" value={d.id} disabled={!d.disponible} checked={destinatari === d.id}
                onChange={() => setDestinatari(d.id)} className="accent-[#007A7B]" />
              <span className="text-sm text-[#12302F]">{d.nom.includes(d.email) ? d.nom : `${d.nom} · ${d.email}`}</span>
              {!d.disponible && <span className="text-xs text-[#6B8280] ml-auto">{P.noDisponible.ca} <span className="italic">/ {P.noDisponible.en}</span></span>}
            </label>
          ))}
        </div>
      </fieldset>
      <Camp t={P.assumpte} ajuda={{ ca: `${assumpte.length}/120`, en: '' }}>
        <input value={assumpte} onChange={(e) => setAssumpte(e.target.value)} maxLength={120} required className={estilCamp} />
      </Camp>
      <Camp t={P.comentari}>
        <textarea value={comentari} onChange={(e) => setComentari(e.target.value)} maxLength={2000} rows={3} className={estilCamp} />
      </Camp>
      <div>
        <Bi t={P.fitxers} petit className="font-semibold mb-1" />
        <p className="text-[11px] text-[#6B8280] mb-2">{P.fitxersAjuda.ca} <span className="italic">/ {P.fitxersAjuda.en}</span></p>
        <input ref={entrada} type="file" multiple accept={EXTENSIONS.map((x) => `.${x}`).join(',')} className="hidden"
          onChange={(e) => { afegeix([...e.target.files]); e.target.value = ''; }} />
        <Boto secundari onClick={() => entrada.current?.click()}>{P.afegirFitxers.ca} / {P.afegirFitxers.en}</Boto>
        {fitxers.length > 0 && (
          <ul className="mt-3 divide-y divide-[#E4EEEC] border border-[#D6E4E2] rounded-lg">
            {fitxers.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">{f.name}</span>
                <span className="flex items-center gap-3 shrink-0 text-xs text-[#6B8280]">
                  {mida(f.size)}
                  <button type="button" onClick={() => setFitxers(fitxers.filter((_, j) => j !== i))} className="text-red-700 hover:underline">
                    {P.treure.ca} / {P.treure.en}
                  </button>
                </span>
              </li>
            ))}
            <li className="px-3 py-2 text-xs text-[#4E6765] text-right">{mida(fitxers.reduce((s, f) => s + f.size, 0))}</li>
          </ul>
        )}
      </div>
      <MissatgeError missatge={error} />
      {fet && (
        <div className="border border-green-200 bg-green-50 rounded-lg px-3 py-2 text-green-800 flex flex-wrap items-center justify-between gap-3">
          <Bi t={P.enviat} petit />
          <Boto secundari onClick={onEnviat}>{P.seccions.enviaments.ca} / {P.seccions.enviaments.en}</Boto>
        </div>
      )}
      <Boto type="submit" disabled={progres !== null}>
        {progres !== null ? `${P.enviant.ca} ${progres} %` : `${P.enviar.ca} / ${P.enviar.en}`}
      </Boto>
    </form>
  );
};

// ─── Els meus enviaments ────────────────────────────────────────────────────
export const ElsMeusEnviaments = ({ clientId, ambSessio }) => {
  const [llista, setLlista] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    ambSessio(() => area('enviaments', { client_id: clientId }))
      .then((r) => setLlista(r.enviaments))
      .catch((err) => setError(err.message));
  }, [clientId, ambSessio]);

  if (error) return <MissatgeError missatge={error} />;
  if (!llista) return <p className="text-sm text-[#6B8280]">{P.carregant.ca}</p>;
  if (!llista.length) return <Bi t={P.capEnviament} petit />;
  const cap = (t) => <th className="text-left font-semibold px-3 py-2">{t.ca}<span className="block font-normal italic text-[11px] text-[#4E6765]">{t.en}</span></th>;
  return (
    <div className="overflow-x-auto border border-[#D6E4E2] rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-[#F4F8F7] text-[#2B4644]">
          <tr>{cap(P.data)}{cap(P.assumpte)}{cap(P.destinatari)}{cap(P.nFitxers)}{cap(P.estat)}</tr>
        </thead>
        <tbody className="divide-y divide-[#E4EEEC]">
          {llista.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-2 whitespace-nowrap">{data(e.data)}</td>
              <td className="px-3 py-2 [overflow-wrap:anywhere]">{e.assumpte}</td>
              <td className="px-3 py-2">{e.destinatari}</td>
              <td className="px-3 py-2 text-center">{e.n_fitxers}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${e.estat === 'rebut' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                  {e.estat === 'rebut' ? bilingue(P.estatRebut) : bilingue(P.estatEnviat)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Els meus documents ─────────────────────────────────────────────────────
export const ElsMeusDocuments = ({ clientId, ambSessio, onDescarrega }) => {
  const [llista, setLlista] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    ambSessio(() => area('documents', { client_id: clientId }))
      .then((r) => setLlista(r.documents))
      .catch((err) => setError(err.message));
  }, [clientId, ambSessio]);

  const baixa = async (id) => {
    setError('');
    try { await onDescarrega(id); } catch (err) { setError(err.message); }
  };

  if (!llista && !error) return <p className="text-sm text-[#6B8280]">{P.carregant.ca}</p>;
  return (
    <div className="space-y-3">
      <MissatgeError missatge={error} />
      {llista && !llista.length && <Bi t={P.capDocument} petit />}
      {llista && llista.length > 0 && (
        <ul className="divide-y divide-[#E4EEEC] border border-[#D6E4E2] rounded-lg">
          {llista.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <Bi t={P.tipusDocument[d.tipus]} petit />
                <p className="text-xs text-[#6B8280] mt-0.5">{d.titol ? `${d.titol} · ` : ''}{data(d.data)}</p>
              </div>
              <Boto secundari onClick={() => baixa(d.id)}>{P.descarregar.ca} / {P.descarregar.en}</Boto>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
