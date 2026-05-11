// src/EinaFiscal/index.jsx — Component principal (wizard 9 passos)
// Eina Fiscal IRPF Andorra — Fase 1
// Llei 5/2014 · L2023005 · L2025005 · Reglament 29/12/2023 · Guia IRPF 2025

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { calcularIRPFDetallat } from './engine/analysisEngine';
import WizardNav from './components/WizardNav';
import SummaryPanel from './components/SummaryPanel';
import Step1SituacioPersonal from './steps/Step1SituacioPersonal';
import Step2Treball from './steps/Step2Treball';
import Step3Activitat from './steps/Step3Activitat';
import Step4Immobiliari from './steps/Step4Immobiliari';
import Step5Mobiliari from './steps/Step5Mobiliari';
import Step6GuanysCapital from './steps/Step6GuanysCapital';
import Step7DDI from './steps/Step7DDI';
import Step8Deduccions from './steps/Step8Deduccions';
import Step9Bases300F from './steps/Step8_300F';
import Step10Liquidacio from './steps/Step9Liquidacio';
import { finalitzarDeclaracio, desarDeclaracio } from './engine/DeclaracionsSupabase';

const STEPS = [
  { id: 1,  label: 'Situacio personal',         formulari: '300-A' },
  { id: 2,  label: 'Rendes del treball',         formulari: '300-B sec.1' },
  { id: 3,  label: 'Activitats economiques',     formulari: '300-C' },
  { id: 4,  label: 'Capital immobiliari',        formulari: '300-B sec.2' },
  { id: 5,  label: 'Capital mobiliari',          formulari: '300-D' },
  { id: 6,  label: 'Guanys i perdues capital',   formulari: '300-E' },
  { id: 7,  label: 'Doble imposicio (DDI)',       formulari: 'Art. 48' },
  { id: 8,  label: 'Deduccions exercici',        formulari: '300-L sec.3' },
  { id: 9,  label: 'Bases neg. i deduccions ant.', formulari: '300-F' },
  { id: 10, label: 'Liquidacio i informe',       formulari: '300-L' },
];

const DEFAULT_DADES = {
  // Pas 1 — Situacio personal (300-A complert)
  estatCivil: 'altres',
  conjugeNom: '',
  conjugeNRT: '',
  conjugeRendesGenerals: 0,
  obligatDiscapacitat: false,
  descendents: [],
  ascendents: [],
  tutelats: [],
  // Reduccions 300-A sec.2 (ara al pas 1)
  quotesHabitatge: 0,
  esHabitatgeCompra: true,
  aportacioPensions: 0,
  contribucioPensions: 0,
  pensionsCompensatories: 0,
  anualitatAliments: 0,
  // Pas 2 — Rendes del treball
  rendesTreball: [],
  // Pas 3 — Activitats economiques
  activitats: [],
  // Pas 4 — Capital immobiliari
  immobles: [],
  // Pas 5 — Capital mobiliari (estructura entitat/partides)
  mobiliaris: [],
  // Pas 6 — Guanys i perdues capital
  transmissions: [],
  guanysNoTransmissio: 0,
  perduessNoTransmissio: 0,
  basesNegativesAnteriors: 0,
  // Pas 7 — DDI
  rendesExterior: [],
  // Pas 8 — Deduccions generades en l'exercici
  deduccionsExercici: {},
  // Pas 9 — 300-F: Bases negatives i deduccions anteriors
  basesNegGenerals: [],
  basesNegEstalvi: [],
  deduccionsAnteriors: [],
};

const EinaFiscal = ({ onBack, declaracioId, declaracioInicial, onDesar, onDadesChange, onSortir, ultimDesat, onLogout, onAdminPanel, pendents = 0 }) => {
  const [pas, setPas] = useState(1);
  const [dades, setDades] = useState(() => ({
    ...DEFAULT_DADES,
    ...(declaracioInicial?.dades || {}),
  }));
  const [clientNom, setClientNom] = useState(() => declaracioInicial?.clientNom || '');
  const [clientNRT, setClientNRT] = useState(() => declaracioInicial?.clientNRT || '');
  const [exercici, setExercici] = useState(() => declaracioInicial?.exercici || 2025);

  const updateDades = useCallback((clau, valor) => {
    setDades(prev => ({ ...prev, [clau]: valor }));
  }, []);

  useEffect(() => {
    if (onDadesChange) onDadesChange(dades, clientNom, clientNRT, exercici);
  }, [dades, clientNom, clientNRT, exercici]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calcul en temps real
  const resultat = useMemo(() => {
    try { return calcularIRPFDetallat(dades); }
    catch (e) { return null; }
  }, [dades]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Capcalera */}
      <header className="bg-gradient-to-r from-[#007A7B] to-[#009B9C] text-white py-4 px-4 no-print">
        <div className="container mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                if (onSortir) {
                  if (window.confirm('La declaració s\'ha desat. Vols sortir?')) {
                    onSortir();
                  }
                } else if (onBack) {
                  onBack();
                }
              }}
              className="text-white/70 hover:text-white text-sm mb-1 flex items-center gap-1 transition"
            >
              ← Tornar a la web
            </button>
            <h1 className="text-xl font-bold">Eina Fiscal IRPF Andorra {exercici}</h1>
            <p className="text-white/80 text-xs">
              Llei 5/2014 · L2023005 · L2025005 · Reglament 29/12/2023
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Nom del client"
              value={clientNom}
              onChange={e => setClientNom(e.target.value)}
              className="bg-white/20 text-white placeholder-white/60 border border-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 w-48"
            />
            <input
              type="text"
              placeholder="NRT client"
              value={clientNRT}
              onChange={e => setClientNRT(e.target.value)}
              className="bg-white/20 text-white placeholder-white/60 border border-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 w-32"
            />
            <select
              value={exercici}
              onChange={e => setExercici(Number(e.target.value))}
              className="bg-white/20 text-white border border-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none"
            >
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
              <option value={2023}>2023</option>
            </select>
            {onDesar && (
              <button
                onClick={() => onDesar(dades, clientNom, clientNRT, exercici)}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg px-3 py-2 text-sm transition flex items-center gap-1"
              >
                💾 Desar
              </button>
            )}
            {ultimDesat && (
              <span className="text-white/60 text-xs">
                Desat: {ultimDesat.toLocaleTimeString('ca-AD', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {onAdminPanel && (
              <button
                onClick={onAdminPanel}
                className="relative bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg px-3 py-2 text-sm transition"
              >
                ⚙️ Administració
                {pendents > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {pendents}
                  </span>
                )}
              </button>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                className="bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/20 rounded-lg px-3 py-2 text-sm transition"
              >
                Tancar sessió
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Navegacio wizard */}
      <div className="no-print">
        <WizardNav steps={STEPS} pasActual={pas} onNavegar={setPas} />
      </div>

      {/* Cos: formulari + panell resum */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6">
          {/* Formulari del pas actiu */}
          <div className="flex-1 min-w-0">
            {pas === 1 && <Step1SituacioPersonal dades={dades} update={updateDades} />}
            {pas === 2 && <Step2Treball dades={dades} update={updateDades} />}
            {pas === 3 && <Step3Activitat dades={dades} update={updateDades} />}
            {pas === 4 && <Step4Immobiliari dades={dades} update={updateDades} />}
            {pas === 5 && <Step5Mobiliari dades={dades} update={updateDades} />}
            {pas === 6 && <Step6GuanysCapital dades={dades} update={updateDades} />}
            {pas === 7 && <Step7DDI dades={dades} update={updateDades} />}
            {pas === 8 && <Step8Deduccions dades={dades} update={updateDades} resultat={resultat} />}
            {pas === 9 && <Step9Bases300F dades={dades} update={updateDades} />}
            {pas === 10 && (
              <Step10Liquidacio
                dades={dades}
                resultat={resultat}
                clientNom={clientNom}
                exercici={exercici}
                estat={declaracioInicial?.estat}
                onFinalitzar={async () => {
                  await finalitzarDeclaracio(declaracioId);
                  onSortir();
                }}
                onReobrir={async () => {
                  await desarDeclaracio(declaracioId, { estat: 'esborrany' });
                  window.location.reload();
                }}
              />
            )}
          </div>

          {/* Panell resum lateral */}
          <div className="w-80 flex-shrink-0 no-print">
            <SummaryPanel resultat={resultat} pas={pas} />
          </div>
        </div>

        {/* Navegacio inferior */}
        <div className="flex justify-between mt-6 no-print">
          <button
            onClick={() => setPas(p => Math.max(1, p - 1))}
            disabled={pas === 1}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500 self-center">
            Pas {pas} de {STEPS.length} — {STEPS[pas - 1]?.formulari}
          </span>
          <button
            onClick={() => setPas(p => Math.min(STEPS.length, p + 1))}
            disabled={pas === STEPS.length}
            className="px-6 py-2 bg-[#009B9C] text-white rounded-lg font-semibold hover:bg-[#007A7B] disabled:opacity-40 transition"
          >
            Seguent
          </button>
        </div>
      </div>

      {/* Avis us intern */}
      <div className="no-print bg-amber-50 border-t border-amber-200 py-2 px-4 text-center text-xs text-amber-700">
        Eina d'us intern exclusiu de AMBIT Associats. No substitueix l'assessorament fiscal personalitzat.
      </div>
    </div>
  );
};

export default EinaFiscal;
