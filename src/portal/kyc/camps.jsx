// src/portal/kyc/camps.jsx
// Peces del formulari KYC del client, amb el mateix estil que el formulari de
// l'autorització de càrrec i que el PDF (català amb l'anglès a sota, camps en
// requadre groc pàl·lid, barres verdes).
import React, { createContext, useContext, useEffect, useState } from 'react';
import PAISOS from './paisos.json';

// Context: dades, funció per canviar-les i camps pendents que cal marcar
export const FormCtx = createContext({ dades: {}, posa: () => {}, err: () => false, llegir: false });
export const useForm = () => useContext(FormCtx);

// Valor d'un camí "a.b.0.c"
export const llegeix = (obj, cami) => cami.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// Còpia amb el valor canviat al camí indicat
export const ambValor = (obj, cami, valor) => {
  const [k, ...resta] = cami.split('.');
  const base = obj == null ? (/^\d+$/.test(k) ? [] : {}) : obj;
  const copia = Array.isArray(base) ? [...base] : { ...base };
  copia[k] = resta.length ? ambValor(base[k], resta.join('.'), valor) : valor;
  return copia;
};

export const nouId = () => (window.crypto?.randomUUID ? window.crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

const majuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const estilEntrada = (error) =>
  `w-full bg-[#FBFAF1] border ${error ? 'border-red-500 ring-1 ring-red-300' : 'border-[#C2BD6B]'} rounded-sm px-3 py-2 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40 disabled:opacity-80`;

// ─── Estructura ─────────────────────────────────────────────────────────────
export const Seccio = ({ num, ca, en }) => (
  <div className="flex items-baseline justify-between gap-3 bg-[#009B9C] text-white px-3 py-1.5 mt-7 mb-2">
    <span className="font-bold text-[15px]">{num ? `${num}. ` : ''}{ca}</span>
    <span className="italic text-xs text-right">{en}</span>
  </div>
);

export const Subtitol = ({ ca, en, children }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#4DB6B7] mt-5 mb-2 pb-1">
    <p className="font-bold text-[#007A7B] text-[15px]">{ca} {en && <span className="font-normal italic text-[11px] text-gray-500">{en}</span>}</p>
    {children}
  </div>
);

export const Avis = ({ t }) => (
  <div className="mb-2">
    <p className="text-[12px] italic text-gray-600">{t.ca}</p>
    <p className="text-[11px] italic text-gray-400">{t.en}</p>
  </div>
);

export const Bilingue = ({ ca, en, className = '' }) => (
  <div className={className}>
    <p className="text-[15px] text-gray-900 text-justify leading-snug">{ca}</p>
    <p className="text-xs italic text-gray-500 text-justify mt-1 leading-snug">{en}</p>
  </div>
);

export const Etiqueta = ({ ca, en, obligatori, htmlFor, maj = false }) => (
  <label htmlFor={htmlFor} className="block sm:w-56 sm:flex-shrink-0 mb-1 sm:mb-0">
    <span className="font-bold text-[15px] text-gray-900">{obligatori && <span className="font-normal">* </span>}{maj ? majuscula(ca) : ca}</span>
    <span className="block italic text-[11px] text-gray-500 pl-3">{maj ? majuscula(en) : en}</span>
  </label>
);

export const Fila = ({ ca, en, obligatori = true, id, error, maj, children }) => (
  <div className="sm:flex sm:items-start gap-4 py-1.5">
    <Etiqueta ca={ca} en={en} obligatori={obligatori} htmlFor={id} maj={maj} />
    <div className="flex-1 min-w-0">
      {children}
      {error && <p className="text-[11px] text-red-600 mt-1">Cal completar aquest camp. / This field is required.</p>}
    </div>
  </div>
);

// ─── Camps ──────────────────────────────────────────────────────────────────
let comptador = 0;
const useId = () => { const [id] = useState(() => `k${++comptador}`); return id; };

export const Text = ({ cami, t, obligatori = true, tipus = 'text', llarg = false, max = 200, maj = false, placeholder }) => {
  const { dades, posa, err, llegir } = useForm();
  const id = useId();
  const valor = llegeix(dades, cami) ?? '';
  const props = {
    id, value: valor, maxLength: max, placeholder, disabled: llegir,
    onChange: (e) => posa(cami, e.target.value),
    className: estilEntrada(err(cami)),
  };
  return (
    <Fila ca={t.ca} en={t.en} obligatori={obligatori} id={id} error={err(cami)} maj={maj}>
      {llarg ? <textarea rows={3} {...props} /> : <input type={tipus} {...props} />}
    </Fila>
  );
};

// Opció única (botons de ràdio)
export const Opcio = ({ cami, t, opcions, obligatori = true, maj = false, detall }) => {
  const { dades, posa, err, llegir } = useForm();
  const valor = llegeix(dades, cami);
  const nom = useId();
  return (
    <Fila ca={t.ca} en={t.en} obligatori={obligatori} error={err(cami)} maj={maj}>
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 pt-1">
        {Object.entries(opcions).map(([k, o]) => (
          <label key={k} className="flex items-start gap-2 text-[15px] min-w-[8rem]">
            <input type="radio" name={nom} checked={valor === k} disabled={llegir} onChange={() => posa(cami, k)} className="accent-[#009B9C] mt-1" />
            <span>{o.ca}{o.en !== o.ca && <span className="italic text-[11px] text-gray-500"> / {o.en}</span>}</span>
          </label>
        ))}
      </div>
      {detall}
    </Fila>
  );
};

// Sí / no (valor booleà)
export const SiNo = ({ cami, t, obligatori = true, si, no, maj }) => {
  const { dades, posa, err, llegir } = useForm();
  const valor = llegeix(dades, cami);
  const nom = useId();
  const opcions = [[true, si || { ca: 'sí', en: 'yes' }], [false, no || { ca: 'no', en: 'no' }]];
  return (
    <Fila ca={t.ca} en={t.en} obligatori={obligatori} error={err(cami)} maj={maj}>
      <div className="flex flex-wrap gap-x-8 gap-y-1.5 pt-1">
        {opcions.map(([v, o]) => (
          <label key={String(v)} className="flex items-center gap-2 text-[15px]">
            <input type="radio" name={nom} checked={valor === v} disabled={llegir} onChange={() => posa(cami, v)} className="accent-[#009B9C]" />
            {o.ca} <span className="italic text-[11px] text-gray-500">/ {o.en}</span>
          </label>
        ))}
      </div>
    </Fila>
  );
};

// Opcions múltiples (caselles). "altres" obre un camp de text.
export const Opcions = ({ cami, t, opcions, camiAltres, exclusiva }) => {
  const { dades, posa, err, llegir } = useForm();
  const valor = llegeix(dades, cami) || [];
  const canvia = (k) => {
    let nou = valor.includes(k) ? valor.filter((x) => x !== k) : [...valor, k];
    if (exclusiva && k === exclusiva && nou.includes(k)) nou = [k];
    else if (exclusiva && k !== exclusiva) nou = nou.filter((x) => x !== exclusiva);
    posa(cami, nou);
  };
  return (
    <Fila ca={t.ca} en={t.en} error={err(cami)}>
      <div className="space-y-1.5 pt-1">
        {Object.entries(opcions).map(([k, o]) => (
          <label key={k} className="flex items-start gap-2 text-[15px]">
            <input type="checkbox" checked={valor.includes(k)} disabled={llegir} onChange={() => canvia(k)} className="accent-[#009B9C] mt-1" />
            <span>{o.ca} <span className="italic text-[11px] text-gray-500">/ {o.en}</span></span>
          </label>
        ))}
      </div>
      {camiAltres && valor.includes('altres') && (
        <input value={llegeix(dades, camiAltres) || ''} maxLength={200} disabled={llegir}
          onChange={(e) => posa(camiAltres, e.target.value)}
          className={`${estilEntrada(err(camiAltres))} mt-2`} placeholder="Especifiqueu-ho / Please specify" />
      )}
    </Fila>
  );
};

const NOM_PAIS = (p) => (p.ca === p.en ? p.ca : `${p.ca} · ${p.en}`);

export const Pais = ({ cami, t, obligatori = true, maj }) => {
  const { dades, posa, err, llegir } = useForm();
  const id = useId();
  return (
    <Fila ca={t.ca} en={t.en} obligatori={obligatori} id={id} error={err(cami)} maj={maj}>
      <select id={id} value={llegeix(dades, cami) || ''} disabled={llegir}
        onChange={(e) => posa(cami, e.target.value)} className={estilEntrada(err(cami))}>
        <option value="">—</option>
        {PAISOS.map((p) => <option key={p.codi} value={p.codi}>{NOM_PAIS(p)}</option>)}
      </select>
    </Fila>
  );
};

// Diversos països: etiquetes amb una creu per treure'n i un selector per afegir-ne
export const Paisos = ({ cami, t, obligatori = true, max = 30, maj }) => {
  const { dades, posa, err, llegir } = useForm();
  const id = useId();
  const valor = llegeix(dades, cami) || [];
  return (
    <Fila ca={t.ca} en={t.en} obligatori={obligatori} id={id} error={err(cami)} maj={maj}>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {valor.map((c) => {
          const p = PAISOS.find((x) => x.codi === c);
          return (
            <span key={c} className="inline-flex items-center gap-1 bg-[#009B9C]/10 text-[#007A7B] text-sm px-2 py-0.5 rounded-full">
              {p ? p.ca : c}
              {!llegir && <button type="button" onClick={() => posa(cami, valor.filter((x) => x !== c))} aria-label={`Treure ${p ? p.ca : c}`} className="font-bold">×</button>}
            </span>
          );
        })}
      </div>
      {!llegir && valor.length < max && (
        <select id={id} value="" onChange={(e) => e.target.value && posa(cami, [...valor, e.target.value])} className={estilEntrada(err(cami))}>
          <option value="">+ Afegir / Add…</option>
          {PAISOS.filter((p) => !valor.includes(p.codi)).map((p) => <option key={p.codi} value={p.codi}>{NOM_PAIS(p)}</option>)}
        </select>
      )}
    </Fila>
  );
};

// Casella d'una declaració
export const Declaracio = ({ cami, t }) => {
  const { dades, posa, err, llegir } = useForm();
  return (
    <label className={`flex items-start gap-3 py-2 ${err(cami) ? 'bg-red-50 -mx-2 px-2 rounded' : ''}`}>
      <input type="checkbox" checked={llegeix(dades, cami) === true} disabled={llegir}
        onChange={(e) => posa(cami, e.target.checked)} className="accent-[#009B9C] mt-1.5 w-4 h-4 flex-shrink-0" />
      <Bilingue ca={t.ca} en={t.en} />
    </label>
  );
};

// Llista repetible (persones, socis...)
export const Llista = ({ cami, max, nou, titol, render, minim = 0, afegir }) => {
  const { dades, posa, llegir, err } = useForm();
  const items = llegeix(dades, cami) || [];
  // Les llistes obligatòries comencen amb una fitxa (p. ex. el signant)
  const buida = items.length === 0;
  useEffect(() => {
    if (buida && minim > 0 && !llegir) posa(cami, [{ id: nouId(), ...nou() }]);
  }, [buida, minim, llegir, cami, posa, nou]);
  return (
    <div>
      {err(cami) && <p className="text-xs text-red-600 mb-2">Cal afegir-ne almenys un. / Please add at least one.</p>}
      {items.map((it, i) => (
        <div key={it.id || i} className="border border-[#4DB6B7]/60 rounded-lg px-3 pb-3 mt-3">
          <Subtitol ca={titol(it, i).ca} en={titol(it, i).en}>
            {!llegir && items.length > minim && (
              <button type="button" onClick={() => posa(cami, items.filter((_, j) => j !== i))}
                className="text-xs text-red-600 hover:underline">Treure / Remove</button>
            )}
          </Subtitol>
          {render(`${cami}.${i}`, it, i)}
        </div>
      ))}
      {!llegir && items.length < max && (
        <button type="button" onClick={() => posa(cami, [...items, { id: nouId(), ...nou() }])}
          className="mt-3 text-sm font-semibold text-[#007A7B] border border-[#009B9C]/50 rounded-lg px-3 py-1.5 hover:bg-[#009B9C]/5">
          {afegir || '+ Afegir / Add'}
        </button>
      )}
    </div>
  );
};
