// src/portal/kyc/Seccions.jsx
// Apartats del formulari KYC (persona física i jurídica). Tots els textos
// surten de text-kyc.json (còpia literal de la plantilla). Les claus de les
// dades són les de kyc-regles.js.
import React from 'react';
import T from './text-kyc.json';
import { AVIS_25, IDIOMES, LLINDAR_BE, nomNormal, participacions } from './kyc-regles';
import {
  Avis, Bilingue, Declaracio, Llista, Opcio, Opcions, Pais, Paisos, SiNo, Subtitol, Text, llegeix, useForm,
} from './camps';

const IDIOMES_OPCIONS = IDIOMES;
const SI = T.si_no.si;
const NO = T.si_no.no;
const amb = (a, b) => ({ ca: `${a.ca}: ${b.ca}`, en: `${a.en}: ${b.en}` });

// ─── Blocs comuns ───────────────────────────────────────────────────────────
const Ppe = ({ cami }) => {
  const { dades } = useForm();
  const p = llegeix(dades, cami) || {};
  const P = T.ppe;
  return (
    <>
      <SiNo cami={`${cami}.exerceix`} t={P.exerceix} si={SI} no={NO} />
      {p.exerceix === true && (
        <div className="sm:pl-6 border-l-2 border-[#4DB6B7]/40 ml-1">
          <Text cami={`${cami}.carrec`} t={amb(P.si_si, P.carrec)} />
          <Text cami={`${cami}.pais_institucio`} t={P.pais_institucio} maj />
          <Text cami={`${cami}.data_inici`} t={P.data_inici} tipus="date" maj />
          <Text cami={`${cami}.data_fi`} t={P.data_fi} tipus="date" obligatori={false} maj />
        </div>
      )}
      <SiNo cami={`${cami}.familiar`} t={P.familiar} si={SI} no={NO} />
      {p.familiar === true && (
        <div className="sm:pl-6 border-l-2 border-[#4DB6B7]/40 ml-1">
          <Text cami={`${cami}.relacio`} t={amb(P.si_si, P.relacio)} />
          <Text cami={`${cami}.nom_ppe`} t={P.nom_ppe} maj />
          <Text cami={`${cami}.carrec_ppe`} t={P.carrec_ppe} maj />
        </div>
      )}
      {(p.exerceix === true || p.familiar === true) && (
        <Text cami={`${cami}.origen_patrimoni`} t={amb(P.alguna_si, P.origen_patrimoni)} llarg max={2000}
          placeholder={`${P.origen_patrimoni_desc.ca} / ${P.origen_patrimoni_desc.en}`} />
      )}
    </>
  );
};

const Proposit = ({ num }) => {
  const { dades } = useForm();
  const P = T.proposit;
  const altres = (dades.proposit?.serveis || []).includes('altres');
  return (
    <>
      <SeccioTitol num={num} t={P.titol} />
      <Opcions cami="proposit.serveis" t={P.serveis} opcions={P.opcions} camiAltres="proposit.serveis_altres" />
      <Text cami="proposit.descripcio" t={P.descripcio} llarg max={2000} obligatori={altres} />
    </>
  );
};

const Fons = ({ num, S }) => {
  const { dades } = useForm();
  const f = dades.fons || {};
  const senseFons = (f.origen || []).length === 1 && f.origen[0] === 'no_escau';
  return (
    <>
      <SeccioTitol num={num} t={S.titol} />
      <Opcions cami="fons.origen" t={S.origen} opcions={S.opcions} camiAltres="fons.origen_altres" exclusiva="no_escau" />
      {!senseFons && (
        <>
          <SiNo cami="fons.andorra" t={S.andorra} si={SI} no={NO} />
          {f.andorra === false && <Paisos cami="fons.paisos" t={S.paisos} />}
          <Text cami="fons.descripcio" t={S.descripcio} llarg max={2000} obligatori={(f.origen || []).includes('altres')} />
        </>
      )}
    </>
  );
};

const Declaracions = ({ num, S }) => (
  <>
    <SeccioTitol num={num} t={S.titol} />
    {S.punts.map((p, i) => <Declaracio key={i} cami={`declaracions.d${i + 1}`} t={p} />)}
  </>
);

// La barra verda (el component pare la mostra; aquí es reutilitza al resum)
const SeccioTitol = ({ num, t }) => (
  <div className="flex items-baseline justify-between gap-3 bg-[#009B9C] text-white px-3 py-1.5 mt-6 mb-2">
    <span className="font-bold text-[15px]">{num}. {t.ca}</span>
    <span className="italic text-xs text-right">{t.en}</span>
  </div>
);

// ─── Persona física ─────────────────────────────────────────────────────────
const P = T.pf;

const PfIdentificacio = () => {
  const { dades } = useForm();
  const i = dades.identificacio || {};
  const S = P.s1;
  return (
    <>
      <SeccioTitol num={1} t={S.titol} />
      <Text cami="identificacio.nom" t={S.nom} />
      <Text cami="identificacio.data_naixement" t={S.data_naixement} tipus="date" />
      <Text cami="identificacio.lloc_naixement" t={S.lloc_naixement} />
      <Paisos cami="identificacio.nacionalitats" t={S.nacionalitats} max={5} />
      <Subtitol ca={S.document.ca} en={S.document.en} />
      <Opcio cami="identificacio.doc_tipus" t={S.doc_tipus} opcions={S.doc_tipus_opcions} maj />
      <Text cami="identificacio.doc_numero" t={S.doc_numero} max={50} maj />
      <Text cami="identificacio.doc_autoritat" t={S.doc_autoritat} maj />
      <Text cami="identificacio.doc_caducitat" t={S.doc_caducitat} tipus="date" maj />
      <div className="h-3" />
      <Text cami="identificacio.nrt" t={S.nrt} obligatori={false} max={30} />
      <Text cami="identificacio.nia" t={S.nia} obligatori={false} max={30} />
      <Text cami="identificacio.domicili" t={S.domicili} max={300} />
      <Pais cami="identificacio.pais_residencia" t={S.pais_residencia} />
      <Pais cami="identificacio.pais_anterior" t={S.pais_anterior} obligatori={false} />
      <Text cami="identificacio.nif_estranger" t={S.nif_estranger} obligatori={false} max={50} />
      <Opcio cami="identificacio.estat_civil" t={S.estat_civil} opcions={S.estat_civil_opcions} />
      <SiNo cami="identificacio.fills" t={S.fills} si={S.fills_si} no={NO} />
      {i.fills === true && <Text cami="identificacio.fills_nombre" t={{ ca: `${S.fills.ca}: ${S.fills_si.ca}`, en: `${S.fills.en}: ${S.fills_si.en}` }} tipus="number" max={3} />}
      <Text cami="identificacio.telefon" t={S.telefon} tipus="tel" max={30} />
      <Text cami="identificacio.email" t={S.email} tipus="email" />
      <Opcio cami="identificacio.idioma" t={S.idioma} opcions={IDIOMES_OPCIONS} />
    </>
  );
};

const PfRepresentacio = () => {
  const { dades } = useForm();
  const r = dades.representacio || {};
  const S = P.s2;
  return (
    <>
      <SeccioTitol num={2} t={S.titol} />
      <SiNo cami="representacio.actua" t={S.avis} si={SI} no={NO} />
      {r.actua === true && (
        <>
          <Text cami="representacio.nom" t={S.nom} />
          <Text cami="representacio.document" t={S.document} max={100} />
          <Opcio cami="representacio.tipus" t={S.tipus} opcions={S.tipus_opcions} />
          {r.tipus === 'altres' && <Text cami="representacio.tipus_altres" t={T.altres} maj />}
          <p className="text-[11px] text-gray-500 sm:pl-60">
            {S.acreditacio.ca} / <span className="italic">{S.acreditacio.en}</span>: es demana al pas de documents. / requested in the documents step.
          </p>
        </>
      )}
    </>
  );
};

const PfActivitat = () => {
  const { dades, posa, err, llegir } = useForm();
  const a = dades.activitat || {};
  const S = P.s3;
  return (
    <>
      <SeccioTitol num={3} t={S.titol} />
      <Avis t={S.avis} />
      {err('activitat.tipus') && <p className="text-xs text-red-600">Cal triar una opció. / Please select an option.</p>}
      {Object.entries(S.tipus).map(([k, tipus]) => (
        <div key={k} className="py-1">
          <label className="flex items-start gap-3">
            <input type="radio" name="activitat" checked={a.tipus === k} disabled={llegir}
              onChange={() => posa('activitat', { tipus: k })} className="accent-[#009B9C] mt-1.5" />
            <Bilingue ca={tipus.ca} en={tipus.en} />
          </label>
          {a.tipus === k && k !== 'sense' && (
            <div className="sm:pl-7 mt-1">
              {Object.entries(tipus.camps).map(([c, t]) => {
                const cami = `activitat.${c}`;
                if (c === 'paisos') return <Paisos key={c} cami={cami} t={t} maj />;
                if (c === 'data_inici') return <Text key={c} cami={cami} t={t} tipus="date" maj />;
                if (c === 'contracte') return <Opcio key={c} cami={cami} t={t} opcions={S.contracte_opcions} maj />;
                if (c === 'jornada') {
                  return (
                    <React.Fragment key={c}>
                      <Opcio cami={cami} t={t} opcions={S.jornada_opcions} maj />
                      <Text cami="activitat.hores" t={S.hores} max={10} maj />
                    </React.Fragment>
                  );
                }
                if (c === 'pais_domicili') {
                  return (
                    <React.Fragment key={c}>
                      <Pais cami="activitat.pais" t={t} maj />
                      <Text cami="activitat.domicili" t={{ ca: '', en: '' }} max={300} obligatori={false} />
                    </React.Fragment>
                  );
                }
                if (c === 'detall') return <Text key={c} cami={cami} t={t} llarg max={1000} maj />;
                return <Text key={c} cami={cami} t={t} obligatori={c !== 'web'} maj />;
              })}
            </div>
          )}
          {a.tipus === 'sense' && k === 'sense' && (
            <div className="sm:pl-7 mt-1">
              <Opcio cami="activitat.sense" t={{ ca: '', en: '' }} opcions={tipus.opcions} />
              {a.sense === 'altres' && <Text cami="activitat.sense_altres" t={T.altres} maj />}
            </div>
          )}
        </div>
      ))}
    </>
  );
};

const PfPpe = () => (
  <>
    <SeccioTitol num={6} t={T.ppe.titol} />
    <details className="mb-2 border border-[#009B9C]/30 rounded-lg px-3 py-2" open>
      <summary className="cursor-pointer text-sm font-semibold text-[#007A7B]">Definició / Definition</summary>
      {T.ppe.explicacio.ca.map((p, i) => <Bilingue key={i} ca={p} en={T.ppe.explicacio.en[i]} className="mt-2" />)}
    </details>
    <Subtitol ca={T.ppe.preguntes.ca} en={T.ppe.preguntes.en} />
    <Ppe cami="ppe" />
  </>
);

const PfSancions = () => (
  <>
    <SeccioTitol num={7} t={P.s7.titol} />
    <SiNo cami="sancions.residencia_ru_by" t={P.s7.residencia_ru_by} si={SI} no={NO} />
    <SiNo cami="sancions.actua_ru_by" t={P.s7.actua_ru_by} si={SI} no={NO} />
  </>
);

export const SECCIONS_PF = [
  { num: 1, t: P.s1.titol, C: PfIdentificacio },
  { num: 2, t: P.s2.titol, C: PfRepresentacio },
  { num: 3, t: P.s3.titol, C: PfActivitat },
  { num: 4, t: T.proposit.titol, C: () => <Proposit num={4} /> },
  { num: 5, t: P.s5.titol, C: () => <Fons num={5} S={P.s5} /> },
  { num: 6, t: T.ppe.titol, C: PfPpe },
  { num: 7, t: P.s7.titol, C: PfSancions },
  { num: 8, t: P.s8.titol, C: () => <Declaracions num={8} S={P.s8} /> },
];

// ─── Persona jurídica ───────────────────────────────────────────────────────
const J = T.pj;

const PjSocietat = () => {
  const S = J.s1;
  return (
    <>
      <SeccioTitol num={1} t={S.titol} />
      <Text cami="societat.denominacio" t={S.denominacio} />
      <Text cami="societat.nom_comercial" t={S.nom_comercial} obligatori={false} />
      <Text cami="societat.forma" t={S.forma} max={100} />
      <Pais cami="societat.pais_constitucio" t={S.pais_constitucio} />
      <Text cami="societat.data_constitucio" t={S.data_constitucio} tipus="date" />
      <Pais cami="societat.pais_activitat" t={S.pais_activitat} />
      <Text cami="societat.domicili_social" t={S.domicili_social} max={300} />
      <Text cami="societat.adreca_activitat" t={S.adreca_activitat} obligatori={false} max={300} />
      <Text cami="societat.nrt" t={S.nrt} max={50} />
      <Text cami="societat.registrals" t={S.registrals} max={300} />
      <Text cami="societat.capital" t={S.capital} max={50} />
      <Text cami="societat.objecte" t={S.objecte} llarg max={1500} />
      <Paisos cami="societat.paisos" t={S.paisos} />
      <Text cami="societat.telefon" t={S.telefon} tipus="tel" max={30} />
      <Text cami="societat.email" t={S.email} tipus="email" />
      <Text cami="societat.web" t={S.web} obligatori={false} />
      <SiNo cami="societat.cotitza" t={S.cotitza} si={SI} no={NO} />
    </>
  );
};

const PjRepresentants = () => {
  const S = J.s2;
  return (
    <>
      <SeccioTitol num={2} t={S.titol} />
      <Avis t={S.avis} />
      <Llista cami="representants" max={10} minim={1}
        nou={() => ({ nom: '', nacionalitat: '', actua_com: '' })}
        titol={(it, i) => ({ ca: `${i + 1}. ${it.nom || '—'}${i === 0 ? ` (${S.signant.ca})` : ''}`, en: i === 0 ? `(${S.signant.en})` : '' })}
        render={(c, it, i) => (
          <>
            <Text cami={`${c}.nom`} t={S.nom} />
            <Pais cami={`${c}.nacionalitat`} t={S.nacionalitat} maj />
            <Text cami={`${c}.data_naixement`} t={S.data_naixement} tipus="date" maj />
            <Text cami={`${c}.domicili`} t={S.domicili} max={300} maj />
            <Text cami={`${c}.document`} t={S.document} max={100} maj />
            <Text cami={`${c}.nrt`} t={S.nrt} obligatori={false} max={30} />
            <Text cami={`${c}.carrec`} t={S.carrec} />
            <Opcio cami={`${c}.actua_com`} t={S.actua} opcions={S.actua_opcions} />
            <Text cami={`${c}.telefon`} t={S.telefon} tipus="tel" max={30} obligatori={i === 0} />
            <Text cami={`${c}.email`} t={S.email} tipus="email" obligatori={i === 0} maj />
            <Opcio cami={`${c}.idioma`} t={S.idioma} opcions={IDIOMES_OPCIONS} obligatori={i === 0} maj />
          </>
        )} />
    </>
  );
};

const PjAdministradors = () => {
  const S = J.s3;
  return (
    <>
      <SeccioTitol num={3} t={S.titol} />
      <Avis t={S.avis} />
      <Llista cami="administradors" max={30} minim={1} nou={() => ({ nom: '', carrec: '', nacionalitat: '' })}
        titol={(it, i) => ({ ca: `${i + 1}. ${it.nom || '—'}`, en: '' })}
        render={(c) => (
          <>
            <Text cami={`${c}.nom`} t={S.nom} maj />
            <Text cami={`${c}.carrec`} t={S.carrec} maj />
            <Pais cami={`${c}.nacionalitat`} t={S.nacionalitat} maj />
          </>
        )} />
    </>
  );
};

// Socis: directes i, si un soci és societat, els seus socis (fins a les persones físiques)
const PjPropietat = () => {
  const { dades, posa, llegir, err } = useForm();
  const S = J.s4;
  const socis = dades.socis || [];
  const afegeix = (pare) => posa('socis', [...socis, { id: window.crypto?.randomUUID?.() || String(Math.random()).slice(2), nom: '', tipus: '', percentatge: '', soci_de: pare }]);
  const treu = (id) => {
    const fora = new Set([id]);
    let canvi = true;
    while (canvi) { canvi = false; for (const s of socis) if (s.soci_de && fora.has(s.soci_de) && !fora.has(s.id)) { fora.add(s.id); canvi = true; } }
    posa('socis', socis.filter((s) => !fora.has(s.id)));
  };
  // Funció de dibuix (no un component): així els camps no perden el focus en escriure
  const soci = (s, prof) => {
    const i = socis.findIndex((x) => x.id === s.id);
    const c = `socis.${i}`;
    const fills = socis.filter((x) => x.soci_de === s.id);
    return (
      <div className={`mt-2 ${prof ? 'ml-4 sm:ml-8 border-l-2 border-[#4DB6B7]/50 pl-3' : ''}`}>
        <div className="border border-[#4DB6B7]/60 rounded-lg px-3 pb-2">
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs font-semibold text-[#007A7B]">{prof ? `Soci de / Shareholder of: ${socis.find((x) => x.id === s.soci_de)?.nom || '—'}` : `${S.socis.ca} / ${S.socis.en}`}</p>
            {!llegir && <button type="button" onClick={() => treu(s.id)} className="text-xs text-red-600 hover:underline">Treure / Remove</button>}
          </div>
          <Text cami={`${c}.nom`} t={J.s3.nom} maj />
          <Opcio cami={`${c}.tipus`} t={{ ca: 'Tipus', en: 'Type' }} opcions={{ pf: { ca: 'persona física', en: 'individual' }, pj: { ca: 'societat', en: 'company' } }} />
          <Text cami={`${c}.percentatge`} t={{ ca: `${S.percentatge.ca} (%)`, en: `${S.percentatge.en} (%)` }} max={10} maj />
          {s.tipus === 'pj' && err(`${c}.socis`) && <p className="text-xs text-red-600">Cal indicar els socis d'aquesta societat. / Please list this company's shareholders.</p>}
          {s.tipus === 'pj' && !llegir && (
            <button type="button" onClick={() => afegeix(s.id)} className="mt-1 text-xs font-semibold text-[#007A7B] hover:underline">
              + Afegir un soci d'aquesta societat / Add a shareholder of this company
            </button>
          )}
        </div>
        {fills.map((f) => <React.Fragment key={f.id}>{soci(f, prof + 1)}</React.Fragment>)}
      </div>
    );
  };
  return (
    <>
      <SeccioTitol num={4} t={S.titol} />
      <Avis t={S.avis} />
      {err('socis') && <p className="text-xs text-red-600">Cal afegir-ne almenys un. / Please add at least one.</p>}
      {socis.filter((s) => !s.soci_de).map((s) => <React.Fragment key={s.id}>{soci(s, 0)}</React.Fragment>)}
      {!llegir && socis.length < 40 && (
        <button type="button" onClick={() => afegeix(null)}
          className="mt-3 text-sm font-semibold text-[#007A7B] border border-[#009B9C]/50 rounded-lg px-3 py-1.5 hover:bg-[#009B9C]/5">
          + Afegir un soci directe / Add a direct shareholder
        </button>
      )}
    </>
  );
};

// Mateixa persona que un representant: pot fer servir el mateix document d'identitat
const MateixaPersona = ({ cami }) => {
  const { dades, posa, llegir } = useForm();
  const reps = (dades.representants || []).filter((r) => r.id);
  const valor = llegeix(dades, `${cami}.representant_id`) || '';
  if (reps.length === 0) return null;
  return (
    <div className="sm:flex sm:items-start gap-4 py-1.5">
      <span className="block sm:w-56 text-[13px] text-gray-700">És també representant? <span className="block italic text-[11px] text-gray-500">Is this person also a representative?</span></span>
      <div className="flex-1">
        <select value={valor} disabled={llegir} onChange={(e) => posa(`${cami}.representant_id`, e.target.value || null)}
          className="w-full bg-[#FBFAF1] border border-[#C2BD6B] rounded-sm px-3 py-2 text-[15px]">
          <option value="">No / No</option>
          {reps.map((r, i) => <option key={r.id} value={r.id}>Sí: {i + 1}. {r.nom || '—'} / Yes</option>)}
        </select>
        {valor && <p className="text-[11px] text-gray-500 mt-1">N'hi ha prou amb el document d'identitat del representant. / The representative's identity document is enough.</p>}
      </div>
    </div>
  );
};

// Percentatges calculats de l'estructura de propietat i avís de les persones
// de més del 25 % que no s'han declarat com a beneficiari efectiu
const AvisParticipacions = () => {
  const { dades } = useForm();
  const parts = participacions(dades);
  if (parts.length === 0) return null;
  const declarats = new Set((dades.beneficiaris || []).map((b) => nomNormal(b.nom)));
  return (
    <div className="mt-3 border border-[#4DB6B7]/60 rounded-lg p-3 text-sm">
      <p className="font-semibold text-[#007A7B]">Participació directa i indirecta (segons l'estructura de propietat) <span className="font-normal italic text-[11px] text-gray-500">/ Direct and indirect holding (from the ownership structure)</span></p>
      <ul className="mt-1 space-y-1">
        {parts.map((p) => {
          const falta = p.percentatge > LLINDAR_BE && !declarats.has(nomNormal(p.nom));
          return (
            <li key={p.nom} className={falta ? 'text-red-700' : 'text-gray-700'}>
              {p.nom}: {p.percentatge.toLocaleString('ca-AD')} %
              {falta && (
                <span className="block text-xs font-semibold">
                  {AVIS_25.ca} / <span className="italic">{AVIS_25.en}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const PjBeneficiaris = () => {
  const S = J.s5;
  return (
    <>
      <SeccioTitol num={5} t={S.titol} />
      {S.explicacio.ca.map((p, i) => <Bilingue key={i} ca={p} en={S.explicacio.en[i]} className="mt-1.5" />)}
      <AvisParticipacions />
      <Llista cami="beneficiaris" max={20} minim={1}
        nou={() => ({ nom: '', nacionalitats: [], criteri: '', ppe: {} })}
        titol={(it, i) => ({ ca: `${S.per_cada.ca} · ${i + 1}. ${it.nom || '—'}`, en: S.per_cada.en })}
        render={(c) => (
          <>
            <Text cami={`${c}.nom`} t={S.nom} />
            <MateixaPersona cami={c} />
            <Paisos cami={`${c}.nacionalitats`} t={S.nacionalitats} max={5} maj />
            <Text cami={`${c}.data_naixement`} t={S.data_naixement} tipus="date" maj />
            <Text cami={`${c}.domicili`} t={S.domicili} max={300} maj />
            <Pais cami={`${c}.pais_residencia`} t={S.pais_residencia} maj />
            <Text cami={`${c}.document`} t={S.document} max={100} maj />
            <Text cami={`${c}.nrt`} t={S.nrt} obligatori={false} max={30} />
            <Text cami={`${c}.participacio`} t={S.participacio} />
            <Opcio cami={`${c}.criteri`} t={S.criteri} opcions={{ a: { ca: 'a', en: 'a' }, b: { ca: 'b', en: 'b' }, c: { ca: 'c', en: 'c' } }} />
            <Subtitol ca={S.ppe.ca} en={S.ppe.en} />
            <Ppe cami={`${c}.ppe`} />
          </>
        )} />
      <Subtitol ca={S.declaracio_titol.ca} en={S.declaracio_titol.en} />
      <Declaracio cami="declaracio_beneficiaris" t={S.declaracio} />
    </>
  );
};

const PjTrust = () => {
  const { dades } = useForm();
  const S = J.s6;
  return (
    <>
      <SeccioTitol num={6} t={S.titol} />
      <SiNo cami="trust.forma_part" t={S.pregunta} si={SI} no={NO} />
      {dades.trust?.forma_part === true && (
        <>
          <Subtitol ca={`${S.si_si.ca}: ${S.amb.ca}`} en={`${S.si_si.en}: ${S.amb.en}`} />
          <Llista cami="trust.parts" max={20} minim={0} nou={() => ({ rol: '', nom: '' })}
            titol={(it, i) => ({ ca: `${i + 1}. ${it.nom || '—'}`, en: '' })}
            render={(c) => (
              <>
                <Opcio cami={`${c}.rol`} t={{ ca: '', en: '' }} opcions={S.rols} obligatori={false} />
                <Text cami={`${c}.nom`} t={S.nom} maj />
                <Pais cami={`${c}.nacionalitat`} t={S.nacionalitat} maj />
                <Pais cami={`${c}.residencia`} t={S.residencia} maj />
              </>
            )} />
        </>
      )}
    </>
  );
};

const PjSancions = () => (
  <>
    <SeccioTitol num={7} t={J.s7.titol} />
    <SiNo cami="sancions.establert_ru_by" t={J.s7.establert_ru_by} si={SI} no={NO} />
    <SiNo cami="sancions.actua_ru_by" t={J.s7.actua_ru_by} si={SI} no={NO} />
  </>
);

export const SECCIONS_PJ = [
  { num: 1, t: J.s1.titol, C: PjSocietat },
  { num: 2, t: J.s2.titol, C: PjRepresentants },
  { num: 3, t: J.s3.titol, C: PjAdministradors },
  { num: 4, t: J.s4.titol, C: PjPropietat },
  { num: 5, t: J.s5.titol, C: PjBeneficiaris },
  { num: 6, t: J.s6.titol, C: PjTrust },
  { num: 7, t: J.s7.titol, C: PjSancions },
  { num: 8, t: T.proposit.titol, C: () => <Proposit num={8} /> },
  { num: 9, t: J.s9.titol, C: () => <Fons num={9} S={J.s9} /> },
  { num: 10, t: J.s10.titol, C: () => <Declaracions num={10} S={J.s10} /> },
];
