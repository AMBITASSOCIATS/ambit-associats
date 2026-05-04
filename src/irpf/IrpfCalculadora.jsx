import React, { useState, useCallback } from "react";
import { calcularIRPF } from "./IrpfEngine";
import {
  IconPersonal, IconTreball, IconActivitat, IconImmobiliari,
  IconMobiliari, IconCapital, IconReduccions, IconInforme,
} from "./IrpfIcons";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  typeof n === "number"
    ? n.toLocaleString("ca-AD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
    : "—";

const pct = (n) =>
  typeof n === "number"
    ? (n * 100).toLocaleString("ca-AD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"
    : "—";

const num = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

const Tooltip = ({ text }) => (
  <span className="relative group ml-1 cursor-help">
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#009B9C] text-white text-xs font-bold select-none">?</span>
    <span className="absolute z-50 left-6 top-0 w-64 text-xs bg-gray-800 text-white rounded-lg p-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
      {text}
    </span>
  </span>
);

const Field = ({ label, name, value, onChange, placeholder = "0", tooltip, unit = "€", type = "number", min = "0" }) => (
  <div className="mb-3">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {tooltip && <Tooltip text={tooltip} />}
    </label>
    <div className="relative">
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C] focus:border-transparent"
      />
      {unit && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          {unit}
        </span>
      )}
    </div>
  </div>
);

const CheckField = ({ label, name, checked, onChange, tooltip }) => (
  <div className="flex items-center mb-3">
    <input
      type="checkbox"
      id={name}
      name={name}
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 text-[#009B9C] border-gray-300 rounded focus:ring-[#009B9C]"
    />
    <label htmlFor={name} className="ml-2 text-sm text-gray-700">
      {label}
      {tooltip && <Tooltip text={tooltip} />}
    </label>
  </div>
);

const Section = ({ title, Icon, open, onToggle, children }) => (
  <div className="border border-gray-200 rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
    >
      <span className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
        <span className="text-[#009B9C] flex-shrink-0"><Icon /></span>
        {title}
      </span>
      <span className="text-[#009B9C] font-bold text-lg leading-none">{open ? "−" : "+"}</span>
    </button>
    {open && <div className="px-4 pt-3 pb-4 bg-white">{children}</div>}
  </div>
);

const ResultRow = ({ label, value, bold, highlight, indent, pctVal }) => (
  <div className={`flex justify-between items-start py-1.5 ${indent ? "pl-4" : ""} ${highlight ? "bg-[#009B9C]/10 rounded-lg px-2 -mx-2" : ""} border-b border-gray-100 last:border-0`}>
    <span className={`text-sm ${bold ? "font-bold text-gray-900" : "text-gray-600"}`}>{label}</span>
    <div className="text-right">
      <span className={`text-sm font-mono ${bold ? "font-bold text-gray-900" : "text-gray-700"} ${highlight ? "text-[#009B9C] font-bold text-base" : ""}`}>
        {value}
      </span>
      {pctVal !== undefined && (
        <div className="text-xs text-gray-400 font-mono">{pctVal}</div>
      )}
    </div>
  </div>
);

// ── Informe 300-L ─────────────────────────────────────────────────────────────

const InformeRow = ({ casella, descripcio, valor, bold, separator }) => (
  <>
    {separator && <div className="border-t border-gray-200 my-2" />}
    <div className={`flex items-center py-1.5 gap-3 ${bold ? "font-bold" : ""}`}>
      {casella ? (
        <span className="w-16 flex-shrink-0 text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 text-center font-mono">{casella}</span>
      ) : (
        <span className="w-16 flex-shrink-0" />
      )}
      <span className={`flex-1 text-sm ${bold ? "text-gray-900" : "text-gray-600"}`}>{descripcio}</span>
      <span className={`text-sm font-mono text-right ${bold ? "text-gray-900" : "text-gray-700"}`}>{valor}</span>
    </div>
  </>
);

// ── Valors inicials del formulari ─────────────────────────────────────────────

const defaultForm = {
  // Personal
  conjugeACarrec: false,
  rendesConjuge: "",
  obligatDiscapacitat: false,
  numDescendents: "",
  numAscendents: "",
  numTutelats: "",
  numDiscapacitats: "",
  matricules: "",
  // Treball
  inputMode: "brut",
  rendaTreballIntegra: "",
  cotitzacionsCASS: "",
  rendaTreballNet: "",
  esPensionista: false,
  anysCotitzats: "",
  // Activitat
  rendaActivitat: "",
  // Immobiliari
  rendaImmobiliaria: "",
  impostComunal: "",
  // Mobiliari
  rendaMobiliaria: "",
  // Guanys capital
  guanysCapital: "",
  // Reduccions
  quotesHabitatge: "",
  aportacioPensions: "",
  pensionsCompensatories: "",
};

// ── Component principal ────────────────────────────────────────────────────────

const IrpfCalculadora = ({ onBack }) => {
  const [form, setForm] = useState(defaultForm);
  const [open, setOpen] = useState({
    personal: true,
    treball: false,
    activitat: false,
    immobiliari: false,
    mobiliari: false,
    capital: false,
    reduccions: false,
    informe: false,
  });

  const toggle = (sec) => setOpen((prev) => ({ ...prev, [sec]: !prev[sec] }));

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }, []);

  // Preparar input per al motor
  const engineInput = (() => {
    const isNet = form.inputMode === "net";
    const integra = isNet ? 0 : num(form.rendaTreballIntegra);
    const cass = isNet ? 0 : num(form.cotitzacionsCASS);

    return {
      rendaTreballIntegra: isNet ? num(form.rendaTreballNet) / (1 - 0.03) : integra,
      cotitzacionsCASS: cass,
      esPensionista: form.esPensionista,
      anysCotitzats: num(form.anysCotitzats),
      rendaActivitat: num(form.rendaActivitat),
      rendaImmobiliaria: num(form.rendaImmobiliaria),
      rendaMobiliaria: num(form.rendaMobiliaria),
      guanysCapital: num(form.guanysCapital),
      conjugeACarrec: form.conjugeACarrec,
      rendesConjuge: num(form.rendesConjuge),
      obligatDiscapacitat: form.obligatDiscapacitat,
      numDescendents: num(form.numDescendents),
      numAscendents: num(form.numAscendents),
      numTutelats: num(form.numTutelats),
      numDiscapacitats: num(form.numDiscapacitats),
      matricules: num(form.matricules),
      quotesHabitatge: num(form.quotesHabitatge),
      aportacioPensions: num(form.aportacioPensions),
      pensionsCompensatories: num(form.pensionsCompensatories),
      impostComunal: num(form.impostComunal),
    };
  })();

  const r = calcularIRPF(engineInput);
  const quota0 = r.rendaTotal <= 0 || r.baseLiquidacioGeneral + r.baseLiquidacioEstalvi <= 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Capçalera */}
      <div className="bg-[#009B9C] text-white py-6 px-4">
        <div className="container mx-auto max-w-6xl">
          <button onClick={onBack} className="text-white/80 hover:text-white text-sm mb-3 flex items-center gap-1">
            ← Tornar a la web
          </button>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">Calculadora IRPF Andorra 2025</h1>
          <p className="text-white/90 text-sm">Llei 5/2014 · L2023005 · L2025005 · Guia pràctica Govern d'Andorra</p>
          <div className="mt-3 bg-white/20 rounded-lg px-4 py-2 text-sm">
            ⚠️ Eina orientativa. Per a una liquidació oficial consulteu un assessor fiscal o el{" "}
            <a href="https://www.impostos.ad" target="_blank" rel="noopener noreferrer" className="underline">Ministeri de Finances d'Andorra</a>.
          </div>
          <div className="mt-2 text-xs text-white/80">
            📅 Termini presentació declaració: 1 d'abril – 30 de setembre de 2026
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ─── Formulari ─── */}
          <div className="flex-1 min-w-0">

            {/* 1. Situació personal i familiar */}
            <Section title="1. Situació personal i familiar" Icon={IconPersonal} open={open.personal} onToggle={() => toggle("personal")}>
              <CheckField label="Cònjuge o parella a càrrec (sense rendes generals pròpies)" name="conjugeACarrec" checked={form.conjugeACarrec} onChange={handleChange}
                tooltip="Incrementa el mínim personal a 40.000 €. El cònjuge no ha de tenir rendes generals iguals o superiors a 24.000 €." />

              {form.conjugeACarrec && (
                <div className="ml-6 mt-1 mb-3 bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-700 mb-2 font-medium">El cònjuge percep rendes de la base general?</p>
                  <Field
                    label="Import de les rendes generals del cònjuge"
                    name="rendesConjuge"
                    value={form.rendesConjuge}
                    onChange={handleChange}
                    tooltip="Si les rendes del cònjuge/parella estable de la base tributació general són inferiors a 24.000 €, aplica el mínim personal incrementat de 40.000 €. Si superen 24.000 €, s'aplica el mínim general de 24.000 €."
                  />
                  {num(form.rendesConjuge) > 0 && num(form.rendesConjuge) < 24000 && (
                    <p className="text-xs text-green-700 mt-1">✓ Rendes inferiors a 24.000 € → Mínim personal: 40.000 €</p>
                  )}
                  {num(form.rendesConjuge) >= 24000 && (
                    <p className="text-xs text-amber-700 mt-1">⚠️ Rendes iguals o superiors a 24.000 € → Mínim personal: 24.000 €</p>
                  )}
                </div>
              )}

              <CheckField label="Discapacitat reconeguda per la Conava (obligat tributari)" name="obligatDiscapacitat" checked={form.obligatDiscapacitat} onChange={handleChange}
                tooltip="Incrementa el mínim personal a 30.000 €. S'aplica quan el propi declarant té discapacitat reconeguda per la CONAVA." />
              {form.conjugeACarrec && form.obligatDiscapacitat && (
                <div className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 mb-2">
                  ℹ️ Si hi ha cònjuge a càrrec, s'aplica el mínim de 40.000 € (prioritat sobre el de discapacitat).
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Fills < 25 anys a càrrec" name="numDescendents" value={form.numDescendents} onChange={handleChange} unit=""
                  tooltip="Fills menors de 25 anys que conviuen i no tenen rendes superiors al mínim personal." />
                <Field label="Ascendents > 65 anys a càrrec" name="numAscendents" value={form.numAscendents} onChange={handleChange} unit=""
                  tooltip="Pares o avis majors de 65 anys que conviuen i no obtenen rendes pròpies." />
                <Field label="Persones en tutela/acolliment" name="numTutelats" value={form.numTutelats} onChange={handleChange} unit=""
                  tooltip="Persones sota tutela legal o acolliment familiar reconegudes per l'autoritat competent." />
                <Field label="Membres amb discapacitat reconeguda" name="numDiscapacitats" value={form.numDiscapacitats} onChange={handleChange} unit=""
                  tooltip="Membres de la unitat familiar amb discapacitat reconeguda per la CONAVA. S'aplica un coeficient 1,5 sobre les reduccions corresponents." />
              </div>
              <Field label="Import total de matrícules d'ensenyament superior" name="matricules" value={form.matricules} onChange={handleChange}
                tooltip="Màxim 300 € per fill en ensenyament universitari o equivalent." />
            </Section>

            {/* 2. Rendes del treball */}
            <Section title="2. Rendes del treball" Icon={IconTreball} open={open.treball} onToggle={() => toggle("treball")}>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Mode d'introducció</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="inputMode" value="brut" checked={form.inputMode === "brut"} onChange={handleChange} className="text-[#009B9C]" />
                    <span className="text-sm">Salari brut + CASS</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="inputMode" value="net" checked={form.inputMode === "net"} onChange={handleChange} className="text-[#009B9C]" />
                    <span className="text-sm">Rendiment net directe</span>
                  </label>
                </div>
              </div>

              {form.inputMode === "brut" ? (
                <>
                  <Field label="Salari brut anual" name="rendaTreballIntegra" value={form.rendaTreballIntegra} onChange={handleChange}
                    tooltip="Ingressos totals del treball abans de qualsevol deducció. El 3% d'altres despeses es calcula automàticament (màx. 2.500 €)." />
                  <Field label="Cotitzacions CASS a càrrec del treballador" name="cotitzacionsCASS" value={form.cotitzacionsCASS} onChange={handleChange}
                    tooltip="Import real de les cotitzacions a la CASS deduïdes del salari (aprox. 6,5% del brut com a referència orientativa)." />
                  {num(form.rendaTreballIntegra) > 0 && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mb-2">
                      Altres despeses deduïbles (3%): {fmt(Math.min(num(form.rendaTreballIntegra) * 0.03, 2500))}
                      &nbsp;→ Rendiment net estimat: {fmt(Math.max(0, num(form.rendaTreballIntegra) - num(form.cotitzacionsCASS) - Math.min(num(form.rendaTreballIntegra) * 0.03, 2500)))}
                    </div>
                  )}
                </>
              ) : (
                <Field label="Rendiment net del treball" name="rendaTreballNet" value={form.rendaTreballNet} onChange={handleChange}
                  tooltip="Salari brut menys cotitzacions CASS i altres despeses deduïbles. Aquest és l'import que s'inclou directament a la Base de Tributació General." />
              )}

              <CheckField label="Sóc pensionista de la CASS" name="esPensionista" checked={form.esPensionista} onChange={handleChange}
                tooltip="Els pensionistes poden deduir un 1% per any cotitzat (màxim 30%) de la seva pensió." />
              {form.esPensionista && (
                <Field label="Anys cotitzats a la CASS" name="anysCotitzats" value={form.anysCotitzats} onChange={handleChange} unit="anys"
                  tooltip="Nombre total d'anys cotitzats. S'aplicarà una reducció del 1% per any, fins a un màxim del 30%." />
              )}
            </Section>

            {/* 3. Activitats econòmiques */}
            <Section title="3. Activitats econòmiques" Icon={IconActivitat} open={open.activitat} onToggle={() => toggle("activitat")}>
              <Field label="Resultat net d'activitats econòmiques" name="rendaActivitat" value={form.rendaActivitat} onChange={handleChange}
                tooltip="Ingressos menys despeses deduïbles de l'activitat professional o empresarial." />
            </Section>

            {/* 4. Capital immobiliari */}
            <Section title="4. Capital immobiliari (lloguers)" Icon={IconImmobiliari} open={open.immobiliari} onToggle={() => toggle("immobiliari")}>
              <Field label="Renda neta del capital immobiliari" name="rendaImmobiliaria" value={form.rendaImmobiliaria} onChange={handleChange}
                tooltip="Ingressos per lloguers menys despeses deduïbles: amortitzacions, interessos, conservació, tributs, assegurances i subministraments." />
              <Field label="Impost comunal sobre arrendaments pagat (Art. 47)" name="impostComunal" value={form.impostComunal} onChange={handleChange}
                tooltip="Import de l'impost comunal sobre rendiments arrendataris pagat. Es dedueix directament de la quota de liquidació (Art. 47)." />
            </Section>

            {/* 5. Capital mobiliari */}
            <Section title="5. Capital mobiliari" Icon={IconMobiliari} open={open.mobiliari} onToggle={() => toggle("mobiliari")}>
              <Field label="Interessos, dividends i altres rendes del capital" name="rendaMobiliaria" value={form.rendaMobiliaria} onChange={handleChange}
                tooltip="Inclou interessos de dipòsits bancaris, dividends d'accions i altres rendiments del capital mobiliari. Tributen com a Renda de l'Estalvi." />
              {num(form.rendaMobiliaria) > 0 && num(form.rendaMobiliaria) <= 3000 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-1">
                  <p className="text-sm text-green-800 font-medium">Rendes dins del mínim exempt de l'estalvi</p>
                  <p className="text-xs text-green-700 mt-1">
                    Total renda neta mobiliari ({fmt(num(form.rendaMobiliaria))}) ≤ 3.000 €. Mínim exempt Art. 37 — Quota de l'estalvi = 0 €.
                  </p>
                </div>
              )}
              {num(form.rendaMobiliaria) > 3000 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-1">
                  <p className="text-sm text-amber-800 font-medium">Part de les rendes mobiliari tributen</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Import exempt (Art. 37): 3.000 € · Import subjecte: {fmt(num(form.rendaMobiliaria) - 3000)}
                  </p>
                </div>
              )}
            </Section>

            {/* 6. Guanys i pèrdues de capital */}
            <Section title="6. Guanys i pèrdues de capital" Icon={IconCapital} open={open.capital} onToggle={() => toggle("capital")}>
              <Field label="Guany/pèrdua net de transmissions" name="guanysCapital" value={form.guanysCapital} onChange={handleChange}
                tooltip="Resultat net de vendes d'actius (immobles, accions, etc.). Un valor negatiu indica pèrdua." />
              {num(form.guanysCapital) < 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
                  ⚠️ Pèrdua de capital. Podeu compensar-la amb guanys en els propers 10 exercicis (Art. 32).
                </div>
              )}
            </Section>

            {/* 7. Reduccions addicionals */}
            <Section title="7. Reduccions addicionals" Icon={IconReduccions} open={open.reduccions} onToggle={() => toggle("reduccions")}>
              <Field label="Quotes hipoteca / compra habitatge habitual" name="quotesHabitatge" value={form.quotesHabitatge} onChange={handleChange}
                tooltip="Import total de les quotes anuals del préstec hipotecari. Es dedueix el 50%, màx. 5.000 €/any (Art. 38)." />
              <Field label="Aportació a plans de pensions" name="aportacioPensions" value={form.aportacioPensions} onChange={handleChange}
                tooltip="Límit: el menor entre l'aportació real, el 30% de les rendes netes i 5.000 € (Art. 39)." />
              <Field label="Pensions compensatòries pagades" name="pensionsCompensatories" value={form.pensionsCompensatories} onChange={handleChange}
                tooltip="Pensions compensatòries pagades a l'ex-cònjuge per sentència judicial. Es dedueixen íntegrament de la BTG." />
            </Section>

            {/* Botó informe */}
            <button
              type="button"
              onClick={() => toggle("informe")}
              className="w-full mt-2 py-2.5 rounded-lg bg-[#009B9C] text-white font-semibold text-sm hover:bg-[#007A7B] transition flex items-center justify-center gap-2"
            >
              <IconInforme />
              {open.informe ? "Tancar informe" : "Generar informe per a la declaració (300-L)"}
            </button>

            {/* Informe 300-L */}
            {open.informe && (
              <div id="informe-irpf" className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-800 text-white px-5 py-3 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-sm">INFORME IRPF 2025 — ÀMBIT Associats — ambit.ad</div>
                    <div className="text-xs text-gray-400 mt-0.5">Generat: {new Date().toLocaleDateString("ca-AD")}</div>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="bg-white text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
                  >
                    🖨️ Imprimir
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                    Document orientatiu. Per a la declaració oficial: <a href="https://www.e-tramits.ad/tramits/impostos/irpf" target="_blank" rel="noopener noreferrer" className="underline">e-tramits.ad</a>
                  </div>

                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Base de Tributació General</div>
                  <InformeRow casella="(1)" descripcio="Renda neta del treball" valor={fmt(r.rendaTreball)} />
                  <InformeRow casella="(2)" descripcio="Renda neta capital immobiliari" valor={fmt(engineInput.rendaImmobiliaria)} />
                  <InformeRow casella="(3)" descripcio="Renda neta activitats econòmiques" valor={fmt(engineInput.rendaActivitat)} />
                  <InformeRow descripcio="Base de Tributació General (BTG)" valor={fmt(r.baseTributacioGeneral)} bold separator />

                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">Reduccions generals</div>
                  <InformeRow descripcio="Mínim personal exempt" valor={fmt(r.minimPersonal)} />
                  <InformeRow casella="(5)" descripcio="Reducció per càrregues familiars" valor={fmt(r.reduccioFamiliar)} />
                  <InformeRow casella="(6)" descripcio="Reducció habitatge habitual (Art. 38)" valor={fmt(r.reduccioHabitatge)} />
                  <InformeRow casella="(7)" descripcio="Reducció plans de pensions (Art. 39)" valor={fmt(r.reduccioPensions)} />
                  <InformeRow casella="(8)" descripcio="Pensions compensatòries (Art. 39.2)" valor={fmt(r.pensionsCompensatories)} />
                  <InformeRow descripcio="Base de Liquidació General (BLG)" valor={fmt(r.baseLiquidacioGeneral)} bold separator />

                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">Base de Tributació de l'Estalvi</div>
                  <InformeRow casella="(9)" descripcio="Renda neta capital mobiliari" valor={fmt(Math.max(0, engineInput.rendaMobiliaria))} />
                  <InformeRow casella="(10)" descripcio="Guanys i pèrdues de capital" valor={fmt(engineInput.guanysCapital)} />
                  <InformeRow descripcio="Base de Tributació Estalvi (BTE)" valor={fmt(Math.max(0, r.baseTributacioEstalvi))} />
                  <InformeRow descripcio="Reducció mínim exempt estalvi (3.000 €)" valor={fmt(Math.min(3000, Math.max(0, r.baseTributacioEstalvi)))} />
                  <InformeRow descripcio="Base de Liquidació Estalvi (BLE)" valor={fmt(r.baseLiquidacioEstalvi)} bold separator />

                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">Liquidació</div>
                  <InformeRow casella="(12)" descripcio="Quota de tributació (10%)" valor={fmt(r.quotaTributacio)} />
                  <InformeRow casella="(13)" descripcio="Bonificació Art. 46 (−)" valor={r.bonificacio > 0 ? `− ${fmt(r.bonificacio)}` : fmt(0)} />
                  <InformeRow descripcio="Quota de liquidació" valor={fmt(r.quotaLiquidacio)} />
                  <InformeRow casella="Art.47" descripcio="Deducció impost comunal (−)" valor={r.deduccioDobleImpInterna > 0 ? `− ${fmt(r.deduccioDobleImpInterna)}` : fmt(0)} />
                  <InformeRow casella="(15)" descripcio="RESULTAT DE LA DECLARACIÓ" valor={fmt(r.quotaFinal)} bold separator />
                </div>
              </div>
            )}

            {/* Reset */}
            <button
              type="button"
              onClick={() => setForm(defaultForm)}
              className="w-full mt-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-100 transition"
            >
              Reiniciar tots els camps
            </button>
          </div>

          {/* ─── Panell de resultats ─── */}
          <div className="lg:w-96 lg:flex-shrink-0">
            <div className="lg:sticky lg:top-4 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-[#009B9C] px-5 py-4 text-white">
                <h2 className="text-lg font-bold">Resultat estimat 2025</h2>
                <p className="text-xs text-white/80 mt-0.5">Exercici fiscal 2025 · Art. 43-46 Llei 5/2014</p>
              </div>

              <div className="px-5 py-4 space-y-0.5">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-1">Bases de Tributació</div>
                <ResultRow label="Base Tributació General (BTG)" value={fmt(r.baseTributacioGeneral)} />
                <ResultRow label="Base Tributació Estalvi (BTE)" value={fmt(Math.max(0, r.baseTributacioEstalvi))} />

                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">Reduccions</div>
                <ResultRow label="Mínim personal" value={fmt(r.minimPersonal)} indent />
                {r.reduccioFamiliar > 0 && <ResultRow label="Reducció familiar" value={fmt(r.reduccioFamiliar)} indent />}
                {r.reduccioHabitatge > 0 && <ResultRow label="Reducció habitatge (Art. 38)" value={fmt(r.reduccioHabitatge)} indent />}
                {r.reduccioPensions > 0 && <ResultRow label="Reducció plans de pensions (Art. 39)" value={fmt(r.reduccioPensions)} indent />}
                {r.pensionsCompensatories > 0 && <ResultRow label="Pensions compensatòries" value={fmt(r.pensionsCompensatories)} indent />}
                <ResultRow label="Total reduccions generals" value={fmt(r.totalReduccions)} bold />

                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">Bases de Liquidació</div>
                <ResultRow label="Base Liquidació General (BLG)" value={fmt(r.baseLiquidacioGeneral)} />
                <ResultRow label="Base Liquidació Estalvi (BLE)" value={fmt(r.baseLiquidacioEstalvi)} />

                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">Quotes</div>
                <ResultRow label="Quota de tributació (10%)" value={fmt(r.quotaTributacio)} />
                {r.bonificacio > 0 && <ResultRow label="Bonificació Art. 46 (−)" value={`− ${fmt(r.bonificacio)}`} indent />}
                <ResultRow label="Quota de liquidació" value={fmt(r.quotaLiquidacio)} />
                {r.deduccioDobleImpInterna > 0 && (
                  <ResultRow label="Deducció impost comunal Art. 47 (−)" value={`− ${fmt(r.deduccioDobleImpInterna)}`} indent />
                )}

                <div className="mt-4 mb-1">
                  <ResultRow
                    label="QUOTA FINAL"
                    value={fmt(r.quotaFinal)}
                    bold
                    highlight
                    pctVal={`Tipus efectiu: ${pct(r.tipusEfectiu)}`}
                  />
                </div>

                {(engineInput.rendaActivitat > 0 || engineInput.rendaTreballIntegra > 50000) && (
                  <div className="bg-blue-50 rounded-lg p-3 mt-3">
                    <div className="text-xs text-blue-700 font-medium">Pagament fraccionat (setembre 2026)</div>
                    <div className="text-sm font-bold text-blue-800 font-mono mt-0.5">{fmt(r.pagamentFraccionat)}</div>
                    <div className="text-xs text-blue-600 mt-0.5">50% de la quota de liquidació</div>
                  </div>
                )}

                {quota0 && r.rendaTotal > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3 text-sm text-green-800">
                    ✅ La renda total no supera el mínim exempt. Quota = 0 €.
                  </div>
                )}
                {r.bteNegatiu && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3 text-xs text-amber-800">
                    ⚠️ La Base de Tributació de l'Estalvi és negativa. La pèrdua es pot compensar en els 10 exercicis posteriors.
                  </div>
                )}
                {r.obligacioDeclarar && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-3 text-xs text-orange-800">
                    📋 La renda total supera el mínim personal. En general existeix <strong>obligació de presentar declaració</strong>.
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-1">
                  <p>* Resultat aproximat. No inclou retencions practicades ni situacions especials.</p>
                  <p>* Exercici fiscal 2025.</p>
                  <p className="pt-1">
                    <a href="https://www.impostos.ad" target="_blank" rel="noopener noreferrer" className="text-[#009B9C] underline">impostos.ad</a>
                    {" · "}
                    <a href="https://www.e-tramits.ad/tramits/impostos/irpf" target="_blank" rel="noopener noreferrer" className="text-[#009B9C] underline">Seu Electrònica IRPF</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IrpfCalculadora;
