// steps/Step8Deduccions.jsx
// Pas 8 — Deduccions generades en l'exercici (300-L secció 3)
// Nou pas entre DDI (pas 7) i Bases negatives 300-F (pas 9)
import React, { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n) =>
  (n || 0).toLocaleString('ca-AD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Num = ({ value, onChange, className = '', readOnly = false }) => (
  <input
    type="number"
    min={0}
    step="0.01"
    value={value === 0 ? '' : value}
    placeholder="0"
    readOnly={readOnly}
    onChange={(e) => {
      if (readOnly) return;
      const v = e.target.value;
      onChange(v === '' ? 0 : parseFloat(v) || 0);
    }}
    className={`border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#009B9C] w-full
      ${readOnly ? 'bg-gray-50 text-gray-500 cursor-default' : 'border-gray-200'}
      ${className}`}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// BLOC DE DEDUCCIÓ INDIVIDUAL
// ─────────────────────────────────────────────────────────────────────────────

const BlocDeducci = ({
  titol,
  referencia,
  descripcio,
  limit,
  nota,
  importGenerat,
  importAplicat,
  onChangeAplicat,
  readOnlyGenerat = false,
  children, // camps addicionals de càlcul
}) => {
  const [expandit, setExpandit] = useState(false);
  const importPendent = Math.max(0, (importGenerat || 0) - (importAplicat || 0));
  const teDeducci = (importGenerat || 0) > 0;

  return (
    <div className={`border rounded-xl overflow-hidden ${teDeducci ? 'border-[#009B9C]/30' : 'border-gray-200'}`}>
      {/* Capçalera */}
      <div
        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition
          ${teDeducci ? 'bg-[#009B9C]/5 hover:bg-[#009B9C]/10' : 'bg-gray-50 hover:bg-gray-100'}`}
        onClick={() => setExpandit(!expandit)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${teDeducci ? 'bg-[#009B9C]' : 'bg-gray-300'}`} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-800 truncate">{titol}</p>
            <p className="text-xs text-gray-400">{referencia}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-3">
          {teDeducci && (
            <span className="text-xs font-semibold text-[#009B9C]">
              Generat: {fmt(importGenerat)} €
            </span>
          )}
          <span className="text-gray-400 text-sm">{expandit ? '▲' : '▼'}</span>
        </div>
      </div>

      {expandit && (
        <div className="p-4 space-y-4 border-t border-gray-100">
          {/* Descripció normativa */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            <p className="mb-1">{descripcio}</p>
            {limit && <p className="font-semibold mt-1">📌 Límit: {limit}</p>}
            {nota && <p className="text-blue-500 mt-1 italic">{nota}</p>}
          </div>

          {/* Camps de càlcul específics */}
          {children && (
            <div className="space-y-3">
              {children}
            </div>
          )}

          {/* Resum import generat / aplicat / pendent */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Import generat (€)
              </label>
              <Num
                value={importGenerat || 0}
                onChange={() => {}}
                readOnly={readOnlyGenerat}
              />
              {readOnlyGenerat && (
                <p className="text-xs text-gray-400 mt-0.5">Calculat automàticament</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Import que s'aplica ara (€)
              </label>
              <Num
                value={importAplicat || 0}
                onChange={onChangeAplicat}
              />
              <p className="text-xs text-gray-400 mt-0.5">
                Màx. {fmt(importGenerat || 0)} €
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Pendent exercicis futurs (€)
              </label>
              <div className={`border rounded px-2 py-1 text-xs text-right font-semibold
                ${importPendent > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                {fmt(importPendent)} €
              </div>
              {importPendent > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  Diferir al 300-F de l'exercici SEGÜENT (màx. 6 exercicis)
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

const Step8Deduccions = ({ dades, update, resultat }) => {
  const d = dades.deduccionsExercici || {};

  const upd = (camp, valor) => {
    update('deduccionsExercici', { ...d, [camp]: valor });
  };

  // ── Deduccions automàtiques (vénen d'altres passos) ──────────────────────
  const impostComunalArrendaments = (dades.immobles || [])
    .reduce((acc, im) => acc + (im.impostComunal || 0), 0);
  const impostComunalRadicacio = (dades.activitats || [])
    .reduce((acc, a) => acc + (a.impostRadicacio || 0), 0);
  const ddiTotal = resultat?.ddiCalculat || 0;

  // ── Mecenatge ────────────────────────────────────────────────────────────
  // Art. 44 Llei 5/2014: 20% donatius generals, 90% donatius <= 100 € (dineraris, irrevocables)
  const mecenatge20 = (d.donatiu20 || 0) * 0.20;
  const mecenatge90 = Math.min(d.donatiu90 || 0, 100) * 0.90;
  const totalMecenatge = mecenatge20 + mecenatge90;

  // ── Projectes interès nacional ───────────────────────────────────────────
  // Art. 44 bis Llei 5/2014: 75% aportacions
  const dedProjectes = (d.aportacionsProjectes || 0) * 0.75;

  // ── Creació llocs de treball ──────────────────────────────────────────────
  // Art. 44 Llei 5/2014: increment plantilla × 1.000 € (no inscrits) o × 3.500 € (inscrits SOC)
  const incrementNoInscrits = Math.max(0, (d.plantillaNIActual || 0) - (d.plantillaNIAnterior || 0));
  const incrementInscritsNormal = Math.max(0, (d.plantillaINActual || 0) - (d.plantillaINAnterior || 0));
  const incrementInscritsEspecial = Math.max(0, (d.plantillaIEActual || 0) - (d.plantillaIEAnterior || 0));
  const dedLlocs = (incrementNoInscrits * 1000) + (incrementInscritsNormal * 3500) + (incrementInscritsEspecial * 3500);

  // ── Digitalització ───────────────────────────────────────────────────────
  // Art. 44 bis Llei 5/2014: 2% de les inversions en digitalització
  const dedDigital = (d.inversionsDigital || 0) * 0.02;

  // ── Patrocini i esponsorització ──────────────────────────────────────────
  // Art. 44 bis Llei 5/2014: 10% despeses o inversions
  const dedPatrocini = (d.despesesPatrocini || 0) * 0.10;

  // ── Total deduccions generades ────────────────────────────────────────────
  const totalGenerat = impostComunalArrendaments + impostComunalRadicacio + ddiTotal +
    totalMecenatge + dedProjectes + dedLlocs + dedDigital + dedPatrocini;

  // ── Total que s'aplica ────────────────────────────────────────────────────
  // Art.47 i DDI: per defecte s'aplica tot el generat, l'usuari pot reduir-ho
  const aplicatArrendaments = d.aplicatArrendaments !== undefined ? d.aplicatArrendaments : impostComunalArrendaments;
  const aplicatRadicacio = d.aplicatRadicacio !== undefined ? d.aplicatRadicacio : impostComunalRadicacio;
  const aplicatDDI = d.aplicatDDI !== undefined ? d.aplicatDDI : ddiTotal;
  // Les deduccions voluntàries: l'usuari decideix quant aplica
  const aplicatMecenatge = Math.min(d.aplicatMecenatge || 0, totalMecenatge);
  const aplicatProjectes = Math.min(d.aplicatProjectes || 0, dedProjectes);
  const aplicatLlocs = Math.min(d.aplicatLlocs || 0, dedLlocs);
  const aplicatDigital = Math.min(d.aplicatDigital || 0, dedDigital);
  const aplicatPatrocini = Math.min(d.aplicatPatrocini || 0, dedPatrocini);

  const totalAplicatVoluntari = aplicatMecenatge + aplicatProjectes + aplicatLlocs + aplicatDigital + aplicatPatrocini;
  const totalAplicat = aplicatArrendaments + aplicatRadicacio + aplicatDDI + totalAplicatVoluntari;

  return (
    <div className="space-y-4">
      {/* Capçalera */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">
            8
          </span>
          <div>
            <h2 className="font-bold text-gray-800">Deduccions generades en l'exercici</h2>
            <p className="text-xs text-gray-500">300-L sec.3 · Art. 43 bis, 44 i 44 bis Llei 5/2014</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-4">
          <strong>⚠️ Atenció:</strong> Les deduccions generades que no s'apliquen per insuficiència de quota
          es poden diferir als <strong>6 exercicis posteriors</strong> (Art. 45 Llei 5/2014 · Reglament 29/12/2023).
          La part no aplicada s'ha de consignar al formulari <strong>300-F</strong> de la declaració de l'exercici <strong>SEGÜENT</strong>,
          no en aquesta declaració.
        </div>

        {/* Resum total */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">Total deduccions generades</p>
            <p className="text-lg font-bold text-[#009B9C]">{fmt(totalGenerat)} €</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">Total que s'aplica en aquesta declaració</p>
            <p className="text-lg font-bold text-gray-800">{fmt(totalAplicat)} €</p>
          </div>
        </div>
      </div>

      {/* ── DEDUCCIONS AUTOMÀTIQUES ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs flex items-center justify-center">A</span>
          Deduccions automàtiques (calculades dels passos anteriors)
        </h3>
        <div className="space-y-3">
          <BlocDeducci
            titol="Impost comunal arrendaments — Art. 47"
            referencia="Del pas 4 (Capital immobiliari)"
            descripcio="L'impost comunal sobre arrendaments efectivament pagat és deduïble de la quota de l'IRPF (Art. 47 Llei 5/2014). El valor generat prové dels imports introduïts al pas 4."
            importGenerat={impostComunalArrendaments}
            importAplicat={aplicatArrendaments}
            onChangeAplicat={(v) => upd('aplicatArrendaments', Math.min(v, impostComunalArrendaments))}
            readOnlyGenerat={true}
          />
          <BlocDeducci
            titol="Impost comunal de radicació — Art. 47"
            referencia="Del pas 3 (Activitats econòmiques)"
            descripcio="L'impost comunal de radicació efectivament pagat per l'activitat econòmica és deduïble de la quota de l'IRPF (Art. 47 Llei 5/2014). El valor generat prové dels imports introduïts al pas 3."
            importGenerat={impostComunalRadicacio}
            importAplicat={aplicatRadicacio}
            onChangeAplicat={(v) => upd('aplicatRadicacio', Math.min(v, impostComunalRadicacio))}
            readOnlyGenerat={true}
          />
          <BlocDeducci
            titol="Deducció per doble imposició internacional (DDI) — Art. 48"
            referencia="Del pas 7 (DDI)"
            descripcio="La deducció per doble imposició internacional (DDI) evita que les rendes obtingudes a l'estranger tributin dos cops. L'import és el mínim entre l'impost pagat a l'origen i la quota andorrana corresponent (Art. 48 Llei 5/2014). El valor generat prové del pas 7."
            importGenerat={ddiTotal}
            importAplicat={aplicatDDI}
            onChangeAplicat={(v) => upd('aplicatDDI', Math.min(v, ddiTotal))}
            readOnlyGenerat={true}
          />
        </div>
      </div>

      {/* ── DEDUCCIONS VOLUNTÀRIES ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs flex items-center justify-center">B</span>
          Deduccions per incentius fiscals (informar si aplica)
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Aquestes deduccions s'han de declarar per no perdre el dret a aplicar-les en exercicis futurs.
          Si no hi ha import generat, deixar a 0.
        </p>

        <div className="space-y-3">

          {/* 1 — MECENATGE */}
          <BlocDeducci
            titol="Deducció per incentius fiscals al mecenatge"
            referencia="Art. 44 Llei 5/2014"
            descripcio="Els obligats tributaris poden deduir de la quota els donatius dineraris irrevocables, purs i simples realitzats a favor d'entitats sense ànim de lucre d'utilitat pública andorrana o entitats equivalents. La deducció és del 20% del valor del donatiu amb caràcter general. Per a donatius dineraris d'un import total no superior a 100 euros en l'exercici, la deducció és del 90%."
            limit="No hi ha límit legal explícit. S'aplica fins a la quota disponible."
            nota="Nota: El percentatge del 90% només s'aplica sobre l'import total de donatius fins a 100 €. Si el total de donatius supera 100 €, l'excés s'aplica al 20%."
            importGenerat={totalMecenatge}
            importAplicat={d.aplicatMecenatge || 0}
            onChangeAplicat={(v) => upd('aplicatMecenatge', Math.min(v, totalMecenatge))}
            readOnlyGenerat={true}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Donatius generals (20%) — import del donatiu (€)
                </label>
                <Num value={d.donatiu20 || 0} onChange={(v) => upd('donatiu20', v)} />
                <p className="text-xs text-gray-400 mt-0.5">
                  Deducció: {fmt(mecenatge20)} € (20%)
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Donatius fins a 100 € (90%) — import del donatiu (€)
                </label>
                <Num value={d.donatiu90 || 0} onChange={(v) => upd('donatiu90', Math.min(v, 100))} />
                <p className="text-xs text-gray-400 mt-0.5">
                  Màx. 100 €. Deducció: {fmt(mecenatge90)} € (90%)
                </p>
              </div>
            </div>
          </BlocDeducci>

          {/* 2 — PROJECTES D'INTERÈS NACIONAL */}
          <BlocDeducci
            titol="Deducció per participació en projectes d'interès nacional"
            referencia="Art. 44 bis Llei 5/2014"
            descripcio="Els obligats tributaris que participin en projectes declarats d'interès nacional per part del Govern d'Andorra poden deduir de la quota el 75% del valor de les aportacions realitzades en el període impositiu. Les aportacions han de destinar-se al finançament dels projectes i han de complir els requisits establerts reglamentàriament."
            limit="75% del valor de les aportacions realitzades."
            nota="Exclusiu per a projectes declarats formalment d'interès nacional pel Govern. Verificar la resolució de declaració."
            importGenerat={dedProjectes}
            importAplicat={d.aplicatProjectes || 0}
            onChangeAplicat={(v) => upd('aplicatProjectes', Math.min(v, dedProjectes))}
            readOnlyGenerat={true}
          >
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Valor de les aportacions realitzades (€)
              </label>
              <Num value={d.aportacionsProjectes || 0} onChange={(v) => upd('aportacionsProjectes', v)} />
              <p className="text-xs text-gray-400 mt-0.5">
                Deducció generada: {fmt(dedProjectes)} € (75% × {fmt(d.aportacionsProjectes || 0)} €)
              </p>
            </div>
          </BlocDeducci>

          {/* 3 — CREACIÓ LLOCS DE TREBALL */}
          <BlocDeducci
            titol="Deducció per creació de llocs de treball"
            referencia="Art. 44 Llei 5/2014 — Exclusiu obligats amb activitat econòmica"
            descripcio="Els obligats tributaris que realitzin activitats econòmiques i incrementin la seva plantilla mitjana respecte de l'exercici anterior poden deduir: 1.000 € per cada treballador addicional no inscrit al Servei d'Ocupació. 3.500 € per cada treballador addicional inscrit al Servei d'Ocupació (entre 25 i 55 anys sense discapacitat, o menors de 25 anys, majors de 55 anys o amb discapacitat). L'increment s'ha de mantenir durant l'exercici posterior."
            limit="1.000 € per treballador (no inscrits SOC) / 3.500 € per treballador (inscrits SOC). L'increment s'ha de mantenir l'any següent."
            nota="Només per a contribuents que fan activitats econòmiques. L'increment de plantilla es calcula en termes de plantilla mitjana equivalent a jornada completa."
            importGenerat={dedLlocs}
            importAplicat={d.aplicatLlocs || 0}
            onChangeAplicat={(v) => upd('aplicatLlocs', Math.min(v, dedLlocs))}
            readOnlyGenerat={true}
          >
            <div className="space-y-3">
              {/* Treballadors no inscrits */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">
                  Treballadors no inscrits al Servei d'Ocupació — 1.000 €/treballador
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Plantilla mitjana any anterior</label>
                    <Num value={d.plantillaNIAnterior || 0} onChange={(v) => upd('plantillaNIAnterior', v)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Plantilla mitjana any declarat</label>
                    <Num value={d.plantillaNIActual || 0} onChange={(v) => upd('plantillaNIActual', v)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Increment</label>
                    <div className={`border rounded px-2 py-1 text-xs text-right font-semibold
                      ${incrementNoInscrits > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                      {incrementNoInscrits > 0 ? `+${incrementNoInscrits}` : '0'} → {fmt(incrementNoInscrits * 1000)} €
                    </div>
                  </div>
                </div>
              </div>

              {/* Treballadors inscrits normals */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">
                  Treballadors inscrits SOC (25-55 anys, sense discapacitat) — 3.500 €/treballador
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Any anterior</label>
                    <Num value={d.plantillaINAnterior || 0} onChange={(v) => upd('plantillaINAnterior', v)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Any declarat</label>
                    <Num value={d.plantillaINActual || 0} onChange={(v) => upd('plantillaINActual', v)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Increment</label>
                    <div className={`border rounded px-2 py-1 text-xs text-right font-semibold
                      ${incrementInscritsNormal > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                      {incrementInscritsNormal > 0 ? `+${incrementInscritsNormal}` : '0'} → {fmt(incrementInscritsNormal * 3500)} €
                    </div>
                  </div>
                </div>
              </div>

              {/* Treballadors inscrits especials */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">
                  Treballadors inscrits SOC (&lt;25 anys, &gt;55 anys o discapacitat) — 3.500 €/treballador
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Any anterior</label>
                    <Num value={d.plantillaIEAnterior || 0} onChange={(v) => upd('plantillaIEAnterior', v)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Any declarat</label>
                    <Num value={d.plantillaIEActual || 0} onChange={(v) => upd('plantillaIEActual', v)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Increment</label>
                    <div className={`border rounded px-2 py-1 text-xs text-right font-semibold
                      ${incrementInscritsEspecial > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                      {incrementInscritsEspecial > 0 ? `+${incrementInscritsEspecial}` : '0'} → {fmt(incrementInscritsEspecial * 3500)} €
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </BlocDeducci>

          {/* 4 — DIGITALITZACIÓ */}
          <BlocDeducci
            titol="Deducció per digitalització"
            referencia="Art. 44 bis Llei 5/2014 — Exclusiu obligats amb activitat econòmica"
            descripcio="Els obligats tributaris que realitzin activitats econòmiques i efectuïn inversions en projectes de digitalització declarats favorables pel Govern d'Andorra poden deduir el 2% de l'import de les inversions realitzades en el període impositiu. Les inversions han de complir els requisits establerts reglamentàriament i han d'estar relacionades amb la transformació digital de l'activitat."
            limit="2% de l'import de les inversions en digitalització."
            nota="Exclusiu per a contribuents amb activitat econòmica. Les inversions han de ser en projectes de digitalització reconeguts pel Govern."
            importGenerat={dedDigital}
            importAplicat={d.aplicatDigital || 0}
            onChangeAplicat={(v) => upd('aplicatDigital', Math.min(v, dedDigital))}
            readOnlyGenerat={true}
          >
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Import de les inversions en digitalització (€)
              </label>
              <Num value={d.inversionsDigital || 0} onChange={(v) => upd('inversionsDigital', v)} />
              <p className="text-xs text-gray-400 mt-0.5">
                Deducció generada: {fmt(dedDigital)} € (2% × {fmt(d.inversionsDigital || 0)} €)
              </p>
            </div>
          </BlocDeducci>

          {/* 5 — PATROCINI I ESPONSORITZACIÓ */}
          <BlocDeducci
            titol="Deducció per incentius fiscals al patrocini i l'esponsorització"
            referencia="Art. 44 bis Llei 5/2014 — Exclusiu obligats amb activitat econòmica"
            descripcio="Els obligats tributaris que realitzin activitats econòmiques i efectuïn despeses o inversions en concepte de patrocini o esponsorització d'activitats culturals, esportives o d'interès social a Andorra poden deduir el 10% del valor de les despeses o inversions efectuades. Les activitats patrocinades han de complir els requisits establerts reglamentàriament."
            limit="10% del valor de les despeses o inversions de patrocini i esponsorització."
            nota="Exclusiu per a contribuents amb activitat econòmica. Cal disposar del contracte de patrocini i la justificació de les despeses."
            importGenerat={dedPatrocini}
            importAplicat={d.aplicatPatrocini || 0}
            onChangeAplicat={(v) => upd('aplicatPatrocini', Math.min(v, dedPatrocini))}
            readOnlyGenerat={true}
          >
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Valor de les despeses o inversions de patrocini/esponsorització (€)
              </label>
              <Num value={d.despesesPatrocini || 0} onChange={(v) => upd('despesesPatrocini', v)} />
              <p className="text-xs text-gray-400 mt-0.5">
                Deducció generada: {fmt(dedPatrocini)} € (10% × {fmt(d.despesesPatrocini || 0)} €)
              </p>
            </div>
          </BlocDeducci>

        </div>
      </div>

      {/* ── RESUM FINAL ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-sm text-gray-700 mb-3">Resum deduccions — impacte a la liquidació</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left py-2 px-3 font-semibold text-gray-600">Deducció</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-600">Generada</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-600">S'aplica</th>
              <th className="text-right py-2 px-3 font-semibold text-amber-600">Pendent</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Art.47 — Impost comunal arrendaments', impostComunalArrendaments, aplicatArrendaments, impostComunalArrendaments - aplicatArrendaments],
              ['Art.47 — Impost comunal radicació', impostComunalRadicacio, aplicatRadicacio, impostComunalRadicacio - aplicatRadicacio],
              ['Art.48 — DDI doble imposició', ddiTotal, aplicatDDI, ddiTotal - aplicatDDI],
              ['Mecenatge (20% / 90%)', totalMecenatge, aplicatMecenatge, totalMecenatge - aplicatMecenatge],
              ['Projectes interès nacional (75%)', dedProjectes, aplicatProjectes, dedProjectes - aplicatProjectes],
              ['Creació llocs de treball', dedLlocs, aplicatLlocs, dedLlocs - aplicatLlocs],
              ['Digitalització (2%)', dedDigital, aplicatDigital, dedDigital - aplicatDigital],
              ['Patrocini i esponsorització (10%)', dedPatrocini, aplicatPatrocini, dedPatrocini - aplicatPatrocini],
            ].filter(r => r[1] > 0 || r[2] > 0).map(([label, gen, apl, pend], i) => (
              <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <td className="py-1.5 px-3 text-gray-700">{label}</td>
                <td className="py-1.5 px-3 text-right font-mono text-gray-600">{fmt(gen)} €</td>
                <td className="py-1.5 px-3 text-right font-mono font-semibold text-[#009B9C]">{fmt(apl)} €</td>
                <td className={`py-1.5 px-3 text-right font-mono font-semibold ${pend > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                  {pend > 0 ? fmt(pend) + ' €' : '—'}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-bold">
              <td className="py-2 px-3 text-gray-800">TOTAL</td>
              <td className="py-2 px-3 text-right font-mono text-gray-700">{fmt(totalGenerat)} €</td>
              <td className="py-2 px-3 text-right font-mono text-[#009B9C]">{fmt(totalAplicat)} €</td>
              <td className={`py-2 px-3 text-right font-mono ${totalGenerat - totalAplicat > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                {totalGenerat - totalAplicat > 0 ? fmt(totalGenerat - totalAplicat) + ' €' : '—'}
              </td>
            </tr>
          </tbody>
        </table>

        {totalGenerat - totalAplicat > 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            <strong>⚠️ {fmt(totalGenerat - totalAplicat)} € pendents d'aplicar</strong> — A la declaració de l'exercici SEGÜENT,
            introduir aquest import al Pas 9 (300-F), apartat 3 "Deduccions de quota d'exercicis anteriors".
            Sense declarar-les, el dret prescriu als 6 exercicis (Art. 45 Llei 5/2014 · Reglament 29/12/2023).
          </div>
        )}
      </div>
    </div>
  );
};

export default Step8Deduccions;
