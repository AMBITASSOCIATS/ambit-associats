// src/pages/CalendariLaboral.jsx — Calendari laboral d'Andorra 2026 (pàgina pública)
import React, { useState } from 'react';

// ── Dades ─────────────────────────────────────────────────────────────────────
const festius = [
  // NACIONALS
  { mes: 1,  dia: 1,  nom: "Cap d'Any",                                   tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 1,  dia: 6,  nom: "Reis",                                        tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 2,  dia: 16, nom: "Dilluns de Carnaval",                         tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 3,  dia: 14, nom: "Dia de la Constitució",                       tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 4,  dia: 3,  nom: "Divendres Sant",                              tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 4,  dia: 6,  nom: "Dilluns de Pasqua",                           tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 5,  dia: 1,  nom: "Festa del Treball",                           tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 5,  dia: 25, nom: "Dilluns de Pentecosta",                       tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 8,  dia: 15, nom: "L'Assumpció",                                 tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 9,  dia: 8,  nom: "Nostra Senyora de Meritxell",                 tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 11, dia: 1,  nom: "Tots Sants",                                  tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 12, dia: 8,  nom: "Immaculada Concepció",                        tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 12, dia: 25, nom: "Nadal",                                       tipus: "nacional", parroquia: "totes",               detall: "" },
  { mes: 12, dia: 26, nom: "Sant Esteve",                                 tipus: "nacional", parroquia: "totes",               detall: "" },
  // ANDORRA LA VELLA
  { mes: 6,  dia: 24, nom: "Festa del Poble (Sant Joan)",                 tipus: "local",    parroquia: "Andorra la Vella",    detall: "" },
  { mes: 8,  dia: 1,  nom: "Festa Major d'Andorra la Vella",              tipus: "local",    parroquia: "Andorra la Vella",    detall: "" },
  { mes: 8,  dia: 2,  nom: "Festa Major d'Andorra la Vella",              tipus: "local",    parroquia: "Andorra la Vella",    detall: "" },
  { mes: 8,  dia: 3,  nom: "Festa Major d'Andorra la Vella",              tipus: "local",    parroquia: "Andorra la Vella",    detall: "" },
  // CANILLO
  { mes: 5,  dia: 9,  nom: "Festa Major de Prats",                        tipus: "local",    parroquia: "Canillo",             detall: "Solament a Prats" },
  { mes: 6,  dia: 29, nom: "Sant Pere",                                   tipus: "local",    parroquia: "Canillo",             detall: "Solament al Pas de la Casa i El Tarter" },
  { mes: 7,  dia: 11, nom: "Festa Major de Soldeu",                       tipus: "local",    parroquia: "Canillo",             detall: "Solament a Soldeu" },
  { mes: 7,  dia: 20, nom: "Festa Major de Canillo",                      tipus: "local",    parroquia: "Canillo",             detall: "Solament a Canillo" },
  { mes: 7,  dia: 25, nom: "Sant Jaume",                                  tipus: "local",    parroquia: "Canillo",             detall: "Solament a Ransol, Aldosa i Els Plans" },
  { mes: 8,  dia: 16, nom: "Sant Roc",                                    tipus: "local",    parroquia: "Canillo",             detall: "Solament a Encamp i Canillo" },
  { mes: 8,  dia: 24, nom: "Sant Bartomeu de Soldeu",                     tipus: "local",    parroquia: "Canillo",             detall: "Solament a Soldeu" },
  { mes: 9,  dia: 19, nom: "Festa Major del Forn",                        tipus: "local",    parroquia: "Canillo",             detall: "Solament al Forn" },
  { mes: 12, dia: 27, nom: "El Vilar",                                    tipus: "local",    parroquia: "Canillo",             detall: "Solament al Vilar" },
  // ENCAMP
  { mes: 6,  dia: 20, nom: "Festa del Poble d'Encamp",                    tipus: "local",    parroquia: "Encamp",              detall: "Solament a Encamp" },
  { mes: 6,  dia: 21, nom: "Festa del Poble d'Encamp",                    tipus: "local",    parroquia: "Encamp",              detall: "Solament a Encamp" },
  { mes: 6,  dia: 22, nom: "Festa del Poble d'Encamp",                    tipus: "local",    parroquia: "Encamp",              detall: "Solament a Encamp" },
  { mes: 6,  dia: 29, nom: "Sant Pere, patró del Pas de la Casa",         tipus: "local",    parroquia: "Encamp",              detall: "Solament al Pas de la Casa" },
  { mes: 8,  dia: 16, nom: "Sant Roc",                                    tipus: "local",    parroquia: "Encamp",              detall: "Solament a Encamp" },
  // ESCALDES-ENGORDANY
  { mes: 5,  dia: 8,  nom: "Diada de Sant Miquel d'Engolasters",          tipus: "local",    parroquia: "Escaldes-Engordany",  detall: "" },
  { mes: 6,  dia: 14, nom: "Diada commemorativa de la creació de la parròquia", tipus: "local", parroquia: "Escaldes-Engordany", detall: "" },
  { mes: 7,  dia: 25, nom: "Diada de Sant Jaume – Festa Major",           tipus: "local",    parroquia: "Escaldes-Engordany",  detall: "" },
  { mes: 7,  dia: 26, nom: "Diada de Santa Anna – Festa Major",           tipus: "local",    parroquia: "Escaldes-Engordany",  detall: "" },
  // LA MASSANA
  { mes: 1,  dia: 17, nom: "Sant Antoni",                                 tipus: "local",    parroquia: "La Massana",          detall: "Solament a La Massana" },
  { mes: 6,  dia: 24, nom: "Sant Joan – Festa Major de Sispony",          tipus: "local",    parroquia: "La Massana",          detall: "Solament a Sispony" },
  { mes: 6,  dia: 27, nom: "Festa Major de Pal",                          tipus: "local",    parroquia: "La Massana",          detall: "Solament a Pal" },
  { mes: 7,  dia: 10, nom: "Sant Cristòfol – Festa Major d'Anyós",        tipus: "local",    parroquia: "La Massana",          detall: "Solament a Anyós" },
  { mes: 7,  dia: 12, nom: "Roser de la Massana",                         tipus: "local",    parroquia: "La Massana",          detall: "Solament a la Massana" },
  { mes: 7,  dia: 19, nom: "Festa Major d'Erts",                          tipus: "local",    parroquia: "La Massana",          detall: "Solament a Erts" },
  { mes: 8,  dia: 9,  nom: "Festa Major de l'Aldosa",                     tipus: "local",    parroquia: "La Massana",          detall: "Solament a l'Aldosa" },
  { mes: 8,  dia: 16, nom: "Sant Roc",                                    tipus: "local",    parroquia: "La Massana",          detall: "Solament a la Massana" },
  { mes: 8,  dia: 23, nom: "Festa Major d'Arinsal",                       tipus: "local",    parroquia: "La Massana",          detall: "Solament a Arinsal" },
  { mes: 11, dia: 30, nom: "Sant Andreu",                                 tipus: "local",    parroquia: "La Massana",          detall: "Solament a Arinsal" },
  // ORDINO
  { mes: 1,  dia: 20, nom: "Sant Sebastià",                               tipus: "local",    parroquia: "Ordino",              detall: "Solament a Ansalonga" },
  { mes: 6,  dia: 29, nom: "Sant Pere",                                   tipus: "local",    parroquia: "Ordino",              detall: "Tota la parròquia" },
  { mes: 7,  dia: 6,  nom: "Festa del Roser",                             tipus: "local",    parroquia: "Ordino",              detall: "Solament a Ordino" },
  { mes: 7,  dia: 7,  nom: "Festa del Roser",                             tipus: "local",    parroquia: "Ordino",              detall: "Solament a Ordino" },
  { mes: 8,  dia: 1,  nom: "Festa Major de Llorts",                       tipus: "local",    parroquia: "Ordino",              detall: "Solament a Llorts" },
  { mes: 8,  dia: 2,  nom: "Festa Major de Llorts",                       tipus: "local",    parroquia: "Ordino",              detall: "Solament a Llorts" },
  { mes: 8,  dia: 16, nom: "Festa Major de Sornàs",                       tipus: "local",    parroquia: "Ordino",              detall: "Solament a Sornàs" },
  { mes: 9,  dia: 5,  nom: "Festa Major de la Cortinada",                 tipus: "local",    parroquia: "Ordino",              detall: "Solament a la Cortinada" },
  { mes: 9,  dia: 6,  nom: "Festa Major de la Cortinada",                 tipus: "local",    parroquia: "Ordino",              detall: "Solament a la Cortinada" },
  { mes: 9,  dia: 16, nom: "Festa Major d'Ordino",                        tipus: "local",    parroquia: "Ordino",              detall: "Solament a Ordino" },
  { mes: 9,  dia: 29, nom: "Festa Major d'Ansalonga",                     tipus: "local",    parroquia: "Ordino",              detall: "Solament a Ansalonga" },
  // SANT JULIÀ DE LÒRIA
  { mes: 1,  dia: 7,  nom: "Sant Julià, Patró de la Parròquia",           tipus: "local",    parroquia: "Sant Julià de Lòria", detall: "" },
  { mes: 5,  dia: 30, nom: "Diada de Canòlich, Patrona de la Parròquia",  tipus: "local",    parroquia: "Sant Julià de Lòria", detall: "" },
  { mes: 7,  dia: 27, nom: "Dilluns de Festa Major",                      tipus: "local",    parroquia: "Sant Julià de Lòria", detall: "" },
  { mes: 7,  dia: 28, nom: "Dimarts de Festa Major",                      tipus: "local",    parroquia: "Sant Julià de Lòria", detall: "" },
];

// ── Constants ─────────────────────────────────────────────────────────────────
const MESOS = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny", "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];

const DIES = {
  ca: ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"],
  es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
};

const PARROQUIES = [
  "Andorra la Vella",
  "Canillo",
  "Encamp",
  "Escaldes-Engordany",
  "La Massana",
  "Ordino",
  "Sant Julià de Lòria",
];

// ── Traduccions de la UI ───────────────────────────────────────────────────────
const UI = {
  ca: {
    titol: "Calendari laboral d'Andorra 2026",
    intro: "14 festius nacionals comuns a tot el territori i festes parroquials específiques de cada comú. Les festes parroquials s'apliquen als treballadors amb centre de treball a la parròquia corresponent.",
    totes: "Totes les parròquies",
    nacional: "Nacional",
    parroquial: "Parroquial",
    tots: "Tots els sectors",
    cols: { data: "Data", dia: "Dia", festivitat: "Festivitat", ambit: "Àmbit", detall: "Detall / Parròquia" },
    font: "Font: Butlletí Oficial del Principat d'Andorra (BOPA). Decret 340/2025, de l'1-10-2025, del Govern d'Andorra, i edictes dels comuns publicats entre novembre i desembre del 2025.",
    tornar: "← Tornar",
  },
  es: {
    titol: "Calendario laboral de Andorra 2026",
    intro: "14 festivos nacionales comunes a todo el territorio y fiestas parroquiales específicas de cada común. Las fiestas parroquiales se aplican a los trabajadores con centro de trabajo en la parroquia correspondiente.",
    totes: "Todas las parroquias",
    nacional: "Nacional",
    parroquial: "Parroquial",
    tots: "Todos los sectores",
    cols: { data: "Fecha", dia: "Día", festivitat: "Festividad", ambit: "Ámbito", detall: "Detalle / Parroquia" },
    font: "Fuente: Boletín Oficial del Principado de Andorra (BOPA). Decreto 340/2025, de 1-10-2025, del Gobierno de Andorra, y edictos de los comunes publicados entre noviembre y diciembre de 2025.",
    tornar: "← Volver",
  },
  en: {
    titol: "Andorra Labour Calendar 2026",
    intro: "14 national public holidays applicable throughout the territory and parish holidays specific to each commune. Parish holidays apply to workers whose workplace is in the corresponding parish.",
    totes: "All parishes",
    nacional: "National",
    parroquial: "Parish",
    tots: "All sectors",
    cols: { data: "Date", dia: "Day", festivitat: "Holiday", ambit: "Scope", detall: "Detail / Parish" },
    font: "Source: Official Gazette of the Principality of Andorra (BOPA). Decree 340/2025, dated 01-10-2025, of the Andorran Government, and edicts from the parish councils published between November and December 2025.",
    tornar: "← Back",
  },
  fr: {
    titol: "Calendrier du travail d'Andorre 2026",
    intro: "14 jours fériés nationaux communs à tout le territoire et fêtes paroissiales spécifiques à chaque commune. Les fêtes paroissiales s'appliquent aux travailleurs dont le lieu de travail se trouve dans la paroisse correspondante.",
    totes: "Toutes les paroisses",
    nacional: "Nacional",
    parroquial: "Paroissial",
    tots: "Tous les secteurs",
    cols: { data: "Date", dia: "Jour", festivitat: "Fête", ambit: "Portée", detall: "Détail / Paroisse" },
    font: "Source : Journal officiel de la Principauté d'Andorre (BOPA). Décret 340/2025 du 1er octobre 2025 du Gouvernement andorran, et édits des comuns publiés entre novembre et décembre 2025.",
    tornar: "← Retour",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
const CalendariLaboral = ({ onBack, language: langProp = 'ca' }) => {
  const [idiomaActiu, setIdiomaActiu] = useState(langProp);
  const [filtreActiu, setFiltreActiu] = useState('totes');

  const t = UI[idiomaActiu];

  // Festius filtrats i ordenats per mes/dia
  const festesFiltrades = festius
    .filter(f => {
      if (filtreActiu === 'totes') return true;
      if (filtreActiu === 'nacional') return f.tipus === 'nacional';
      return f.parroquia === filtreActiu || f.parroquia === 'totes';
    })
    .sort((a, b) => a.mes - b.mes || a.dia - b.dia);

  // Construir files amb capçaleres de mes intercalades
  const rows = [];
  let lastMes = null;
  festesFiltrades.forEach(f => {
    if (f.mes !== lastMes) {
      rows.push({ type: 'header', mes: f.mes });
      lastMes = f.mes;
    }
    rows.push({ type: 'row', f });
  });

  const nomDia = (mes, dia) => DIES[idiomaActiu][new Date(2026, mes - 1, dia).getDay()];

  const detallText = (f) => {
    if (f.parroquia === 'totes') return t.tots;
    if (f.detall) return `${f.parroquia} · ${f.detall}`;
    return f.parroquia;
  };

  return (
    <div className="bg-white min-h-screen">

      {/* ── Botó enrere sticky (només si hi ha onBack) ──────────────────── */}
      {onBack && (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
            <button
              onClick={onBack}
              className="text-sm text-gray-400 hover:text-gray-700 transition"
            >
              {t.tornar}
            </button>
          </div>
        </div>
      )}

      {/* ── Hero institucional ───────────────────────────────────────────── */}
      <div style={{ backgroundColor: '#1A9E8F' }} className="w-full py-14 px-6 text-center">
        <div className="flex justify-center mb-5">
          <img src="/ÀMBIT Associats.png" alt="ÀMBIT Associats" className="h-16 w-auto" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">{t.titol}</h1>
        <p className="text-teal-100 text-sm max-w-xl mx-auto mb-6 leading-relaxed">{t.intro}</p>

        {/* Selector d'idioma */}
        <div className="flex justify-center gap-2">
          {['ca', 'es', 'en', 'fr'].map(lang => (
            <button
              key={lang}
              onClick={() => setIdiomaActiu(lang)}
              className={`px-3 py-1 text-xs font-medium rounded border transition ${
                idiomaActiu === lang
                  ? 'bg-white text-teal-700 border-white'
                  : 'bg-transparent text-white border-white/40 hover:bg-white/10'
              }`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cos principal ────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Barra de filtres ──────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Totes */}
          <button
            onClick={() => setFiltreActiu('totes')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition ${
              filtreActiu === 'totes'
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
            }`}
          >
            {t.totes}
          </button>

          {/* Nacional */}
          <button
            onClick={() => setFiltreActiu('nacional')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition ${
              filtreActiu === 'nacional'
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
            }`}
          >
            {t.nacional}
          </button>

          {/* Parròquies */}
          {PARROQUIES.map(p => (
            <button
              key={p}
              onClick={() => setFiltreActiu(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition ${
                filtreActiu === p
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* ── Taula ────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-28">
                  {t.cols.data}
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-24 hidden sm:table-cell">
                  {t.cols.dia}
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t.cols.festivitat}
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-28">
                  {t.cols.ambit}
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  {t.cols.detall}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                if (row.type === 'header') {
                  return (
                    <tr key={`mes-${row.mes}-${i}`} className="bg-gray-50">
                      <td
                        colSpan={5}
                        className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {MESOS[row.mes - 1]}
                      </td>
                    </tr>
                  );
                }

                const { f } = row;
                return (
                  <tr
                    key={`${f.mes}-${f.dia}-${f.parroquia}-${i}`}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    {/* Data */}
                    <td className="px-3 py-2.5 text-gray-500 tabular-nums whitespace-nowrap text-sm">
                      {f.dia} {MESOS[f.mes - 1]}
                    </td>

                    {/* Dia de la setmana */}
                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap text-sm hidden sm:table-cell">
                      {nomDia(f.mes, f.dia)}
                    </td>

                    {/* Nom de la festivitat */}
                    <td className="px-3 py-2.5 text-gray-800 font-medium text-sm">
                      {f.nom}
                    </td>

                    {/* Badge àmbit */}
                    <td className="px-3 py-2.5">
                      {f.tipus === 'nacional' ? (
                        <span className="inline-block bg-teal-50 text-teal-700 px-2 py-0.5 rounded text-xs font-medium">
                          {t.nacional}
                        </span>
                      ) : (
                        <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">
                          {t.parroquial}
                        </span>
                      )}
                    </td>

                    {/* Detall */}
                    <td className="px-3 py-2.5 text-gray-400 text-xs hidden md:table-cell">
                      {detallText(f)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Nota de font ─────────────────────────────────────────────── */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 italic">{t.font}</p>
        </div>
      </div>
    </div>
  );
};

export default CalendariLaboral;
