// src/portal/irpf/Seccions.jsx
// Apartats 0 a 13 de la comunicació de dades personals i familiars al pagador
// (IRPF). Tots els textos surten de text-irpf.json (còpia literal de la
// plantilla); les claus de les dades són les d'irpf-regles.js. Fan servir els
// mateixos camps que el formulari KYC (../kyc/camps).
//  · L'apartat 4 només apareix si està casat/ada o en parella estable.
//  · Els apartats 5, 6, 7 i 8 són opcionals i surten plegats (si no hi ha dades).
//  · El consentiment de l'art. 9.2.a només apareix si hi ha alguna discapacitat
//    o dependència marcada, i llavors és obligatori.
//  · Els avisos d'edat no impedeixen continuar.
import React, { useState } from 'react';
import T from './text-irpf.json';
import { AVIS_EDAT, MAX, anyReferencia, requereixConsentiment } from './irpf-regles';
import {
  Avis, Bilingue, Declaracio, Fila, Llista, Opcio, Opcions, Seccio, SiNo, Text, estilEntrada, llegeix, useForm,
} from '../kyc/camps';

const SI = T.si_no.si;
const NO = T.si_no.no;
const majuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const avui = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });

// Dos camps de text en una mateixa fila (correu i telèfon; nom i NRT del representant)
const Doble = ({ t, camps, obligatori = false }) => {
  const { dades, posa, err, llegir } = useForm();
  return (
    <Fila ca={t.ca} en={t.en} obligatori={obligatori} error={camps.some(([c]) => err(c))}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {camps.map(([cami, placeholder, tipus = 'text', max = 200]) => (
          <input key={cami} type={tipus} value={llegeix(dades, cami) ?? ''} maxLength={max} placeholder={placeholder} disabled={llegir}
            onChange={(e) => posa(cami, e.target.value)} className={estilEntrada(err(cami))} />
        ))}
      </div>
    </Fila>
  );
};

// Import en euros (text, per admetre "1.234,56")
const Import = ({ cami, t, obligatori = false, maj }) => (
  <Text cami={cami} t={t} obligatori={obligatori} max={20} maj={maj} placeholder="0,00 €" />
);

// Apartat plegable (5, 6, 7 i 8): obert si ja té dades
const Plegable = ({ num, t, teDades, children }) => {
  const { llegir } = useForm();
  const [obert, setObert] = useState(teDades);
  const visible = obert || teDades || llegir;
  return (
    <>
      <Seccio num={num} ca={t.ca} en={t.en} />
      {!visible ? (
        <button type="button" onClick={() => setObert(true)}
          className="text-sm font-semibold text-[#007A7B] border border-[#007A7B]/50 rounded-lg px-3 py-1.5 hover:bg-[#007A7B]/5">
          + Desplegar (opcional) / Expand (optional)
        </button>
      ) : (
        <>
          {llegir && !teDades
            ? <p className="text-[13px] text-[#4E6765]">{T.pdf.no_escau.ca} <span className="italic text-[11px]">/ {T.pdf.no_escau.en}</span></p>
            : children}
          {!llegir && !teDades && (
            <button type="button" onClick={() => setObert(false)} className="mt-2 text-xs text-[#4E6765] hover:underline">Plegar / Collapse</button>
          )}
        </>
      )}
    </>
  );
};

// ─── 0 a 2 ──────────────────────────────────────────────────────────────────
export const Introduccio = () => (
  <div className="mt-2">
    <p className="font-bold text-[15px] text-[#007A7B]">{T.subtitol.ca}</p>
    <p className="italic text-xs text-[#4E6765] mb-3">{T.subtitol.en}</p>
    {T.introduccio.ca.map((p, i) => <Bilingue key={i} ca={p} en={T.introduccio.en[i]} className="mb-3" />)}
  </div>
);

export const S0 = () => {
  const { dades } = useForm();
  return (
    <>
      <Seccio num="0" ca={T.s0.titol.ca} en={T.s0.titol.en} />
      <Opcio cami="comunicacio.tipus" t={T.s0.titol} opcions={{ inicial: T.s0.inicial, modificacio: T.s0.modificacio }} />
      {dades.comunicacio?.tipus === 'modificacio' && (
        <Opcions cami="comunicacio.modifica" t={{ ca: majuscula(T.s0.modifica.ca), en: majuscula(T.s0.modifica.en) }} opcions={T.s0.opcions} />
      )}
    </>
  );
};

export const S1 = () => {
  const S = T.s1;
  return (
    <>
      <Seccio num="1" ca={S.titol.ca} en={S.titol.en} />
      <Text cami="perceptor.nom" t={S.nom} />
      <Text cami="perceptor.nrt" t={S.nrt} max={30} />
      <Text cami="perceptor.document" t={S.document} max={60} />
      <Text cami="perceptor.domicili" t={S.domicili} max={300} />
      <Doble t={S.contacte} camps={[['perceptor.email', 'nom@exemple.ad', 'email'], ['perceptor.telefon', '+376 …', 'tel', 30]]} />
      <Doble t={S.representant} camps={[['perceptor.representant_nom', `${S.nom.ca} / ${S.nom.en}`], ['perceptor.representant_nrt', 'NRT', 'text', 30]]} />
      <SiNo cami="perceptor.incapacitat" t={S.incapacitat} si={SI} no={NO} />
    </>
  );
};

// Les dades del pagador les posa ÀMBIT (no les modifica el perceptor)
export const S2 = ({ pagador }) => {
  const S = T.s2;
  const fila = (t, v) => (
    <Fila ca={t.ca} en={t.en}>
      <p className="bg-[#F4F8F7] border border-[#D6E4E2] rounded-lg px-3 py-2 text-[15px] text-[#12302F]">{v || '—'}</p>
    </Fila>
  );
  return (
    <>
      <Seccio num="2" ca={S.titol.ca} en={S.titol.en} />
      {fila(S.denominacio, pagador?.denominacio)}
      {fila(S.nrt, pagador?.nrt)}
      {fila(S.domicili, pagador?.domicili)}
    </>
  );
};

// ─── 3 i 4 ──────────────────────────────────────────────────────────────────
export const S3 = () => (
  <>
    <Seccio num="3" ca={T.s3.titol.ca} en={T.s3.titol.en} />
    <Opcio cami="estat_civil.estat" t={T.s3.titol} opcions={T.s3.opcions} />
    <Text cami="estat_civil.des_de" t={T.s3.des_de} tipus="date" obligatori={false} />
  </>
);

export const S4 = () => {
  const { dades } = useForm();
  const S = T.s4;
  if (dades.estat_civil?.estat !== 'casat') return null;
  const opcions = Object.fromEntries(Object.entries(S.opcions).map(([k, o]) => [k, { ca: `${k}) ${o.ca}`, en: o.en }]));
  return (
    <>
      <Seccio num="4" ca={S.titol.ca} en={S.titol.en} />
      <Text cami="conjuge.nom" t={S.nom} />
      <Text cami="conjuge.nrt" t={S.nrt} obligatori={false} max={30} maj />
      <Text cami="conjuge.document" t={S.document} max={60} maj />
      <Opcio cami="conjuge.situacio" t={S.situacio} opcions={opcions} />
      {dades.conjuge?.situacio === 'c' && <Import cami="conjuge.rendes" t={S.import} obligatori />}
      <div className="mt-2"><Avis t={S.ajuda} /></div>
    </>
  );
};

// ─── 5, 6 i 7 ───────────────────────────────────────────────────────────────
const AvisEdat = ({ tipus, x }) => {
  const { dades } = useForm();
  if (!x?.any_naixement) return null;
  const edat = anyReferencia(dades, avui()) - Number(x.any_naixement);
  const avis = (tipus === 'descendents' && edat >= 25 && x.discapacitat !== true)
    || (tipus === 'ascendents' && edat <= 65 && x.discapacitat !== true && x.dependencia !== true);
  if (!avis) return null;
  const t = AVIS_EDAT[tipus === 'descendents' ? 5 : 6];
  return (
    <p className="text-[12px] bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1 mt-1">
      ⚠ {t.ca} <span className="italic text-[11px]">/ {t.en}</span>
    </p>
  );
};

const Persona = ({ cami, tipus, x }) => {
  const S5 = T.s5;
  return (
    <>
      <Text cami={`${cami}.nom`} t={S5.nom} />
      <Text cami={`${cami}.nrt`} t={S5.nrt} obligatori={false} max={30} maj />
      <Text cami={`${cami}.document`} t={S5.document} obligatori={false} max={60} maj />
      <Text cami={`${cami}.any_naixement`} t={S5.any_naixement} max={4} maj placeholder="AAAA" />
      <SiNo cami={`${cami}.conviu`} t={S5.conviu} si={SI} no={NO} />
      <SiNo cami={`${cami}.rendes_superiors`} t={S5.rendes} si={SI} no={NO} />
      <SiNo cami={`${cami}.discapacitat`} t={S5.discapacitat} si={SI} no={NO} />
      {tipus === 'ascendents' && <SiNo cami={`${cami}.dependencia`} t={T.s6.dependencia} si={SI} no={NO} />}
      <Text cami={`${cami}.persones`} t={tipus === 'descendents' ? S5.persones : { ca: majuscula(T.persones_dret.ca), en: T.persones_dret.en }} max={2} />
      {tipus === 'descendents' && <p className="text-[11px] italic text-[#4E6765] sm:pl-60 -mt-1 mb-1">{S5.persones_ajuda.ca} / {S5.persones_ajuda.en}</p>}
      {tipus === 'descendents' && <Import cami={`${cami}.matricules`} t={S5.matricules} />}
      <AvisEdat tipus={tipus} x={x} />
    </>
  );
};

const Persones = ({ num, tipus, S, ajuda }) => {
  const { dades } = useForm();
  const llista = dades[tipus] || [];
  return (
    <Plegable num={num} t={S.titol} teDades={llista.length > 0}>
      {ajuda && <Avis t={ajuda} />}
      <Llista cami={tipus} max={MAX[tipus]} nou={() => ({})}
        titol={(x, i) => ({ ca: `${i + 1}. ${x.nom || '—'}`, en: '' })}
        render={(c, x) => <Persona cami={c} tipus={tipus} x={x} />} />
    </Plegable>
  );
};

export const S5 = () => <Persones num="5" tipus="descendents" S={T.s5} ajuda={T.s5.ajuda} />;
export const S6 = () => <Persones num="6" tipus="ascendents" S={T.s6} ajuda={T.s6.ajuda} />;
export const S7 = () => <Persones num="7" tipus="tutelats" S={T.s7} />;

// ─── 8 a 10 i 13 ────────────────────────────────────────────────────────────
export const S8 = () => {
  const { dades } = useForm();
  const S = T.s8;
  const a = dades.altres || {};
  const teDades = ['habitatge', 'pensions', 'plans'].some((k) => a[k]?.import);
  const any = { ca: majuscula(S.any.ca), en: majuscula(S.any.en) };
  return (
    <Plegable num="8" t={S.titol} teDades={teDades}>
      <Avis t={S.ajuda} />
      {['habitatge', 'pensions', 'plans'].map((k) => (
        <div key={k} className="border border-[#4DB6B7]/60 rounded-lg px-3 pb-2 mt-3">
          <Import cami={`altres.${k}.import`} t={S[k]} />
          <Text cami={`altres.${k}.any`} t={any} max={4} obligatori={!!a[k]?.import} placeholder="AAAA" />
          {k === 'pensions' && <Opcio cami="altres.pensions.origen" t={S.origen} opcions={S.origens} obligatori={!!a.pensions?.import} />}
        </div>
      ))}
    </Plegable>
  );
};

export const S9 = () => (
  <>
    <Seccio num="9" ca={T.s9.titol.ca} en={T.s9.titol.en} />
    <Bilingue ca={T.s9.text.ca} en={T.s9.text.en} className="mb-2" />
    <Text cami="data_efectes" t={T.s9.titol} tipus="date" />
  </>
);

export const S10 = () => {
  const { dades } = useForm();
  return (
    <>
      <Seccio num="10" ca={T.s10.titol.ca} en={T.s10.titol.en} />
      {T.s10.punts.map((p, i) => <Declaracio key={i} cami={`declaracions.d${i + 1}`} t={p} />)}
      {requereixConsentiment(dades) && <Declaracio cami="declaracions.consentiment" t={T.s10.consentiment} />}
    </>
  );
};

export const S13 = () => (
  <>
    <Seccio num="13" ca={T.s13.titol.ca} en={T.s13.titol.en} />
    {T.s13.paragrafs.ca.map((p, i) => <Bilingue key={i} ca={p} en={T.s13.paragrafs.en[i]} className="mb-2" />)}
  </>
);

// Passos del formulari: [apartats, components]
export const PASSOS = [
  { nom: '0-2', seccions: [0, 1, 2], C: ({ pagador }) => (<><Introduccio /><S0 /><S1 /><S2 pagador={pagador} /></>) },
  { nom: '3-4', seccions: [3, 4], C: () => (<><S3 /><S4 /></>) },
  { nom: '5-8', seccions: [5, 6, 7, 8], C: () => (<><S5 /><S6 /><S7 /><S8 /></>) },
  { nom: '9-10', seccions: [9, 10], C: () => (<><S9 /><S10 /><S13 /></>) },
];

// Tota la comunicació (revisió i lectura)
export const Tota = ({ pagador }) => (
  <>
    <S0 /><S1 /><S2 pagador={pagador} /><S3 /><S4 /><S5 /><S6 /><S7 /><S8 /><S9 /><S10 />
  </>
);
