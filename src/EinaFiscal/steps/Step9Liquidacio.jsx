// steps/Step9Liquidacio.jsx — Pas 10: Liquidació i informe professional (300-L)
import React, { useRef } from 'react';
import { generarCaselles300L } from '../engine/liquidacioEngine';

const AMBIT = {
  nom: 'DEL SOTO – PALEARI & ASSOCIATS, S.L.',
  nomComercial: 'ÀMBIT Associats',
  nrt: 'L-720543-P',
  adreca: 'Av. Fiter i Rossell, 78, 2n B · Edifici Carlemany',
  poblacio: 'Escaldes-Engordany · Principat d\'Andorra',
  email: 'info@ambit.ad',
  tel: '+376 655 382',
  web: 'www.ambit.ad',
  color: '#009B9C',
  colorFosc: '#007A7B',
};

const fmt = n => {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return n.toLocaleString('ca-AD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

const fmtPct = n => {
  if (!n) return '0,00%';
  return (n * 100).toFixed(2).replace('.', ',') + '%';
};

const dataAvui = () => {
  return new Date().toLocaleDateString('ca-AD', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
};


// ─── Components interns ───────────────────────────────────────────────────────

const SeccioBlocNormatiu = ({ titol, children }) => (
  <div className="avoid-break mb-6">
    <div style={{ borderLeft: `4px solid ${AMBIT.color}`, paddingLeft: '12px', marginBottom: '12px' }}>
      <h3 style={{ fontSize: '11px', fontWeight: '700', color: AMBIT.colorFosc, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
        {titol}
      </h3>
    </div>
    {children}
  </div>
);

const FilaDetall = ({ label, valor, negrita = false, destacat = false, negatiu = false, nota = null }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '5px 10px',
    backgroundColor: destacat ? '#e6f7f7' : 'transparent',
    borderBottom: '1px solid #f0f0f0',
    fontSize: '10px',
  }}>
    <div style={{ flex: 1 }}>
      <span style={{ fontWeight: negrita || destacat ? '700' : '400', color: destacat ? AMBIT.colorFosc : '#333' }}>
        {label}
      </span>
      {nota && <div style={{ fontSize: '9px', color: '#888', marginTop: '1px', fontStyle: 'italic' }}>{nota}</div>}
    </div>
    <span style={{
      fontWeight: negrita || destacat ? '700' : '500',
      color: destacat ? AMBIT.color : negatiu ? '#c0392b' : '#333',
      fontFamily: 'monospace', fontSize: '10px', marginLeft: '8px', whiteSpace: 'nowrap'
    }}>
      {valor}
    </span>
  </div>
);

const NotaNormativa = ({ ref: refText, text }) => (
  <div style={{
    backgroundColor: '#f0fafa', border: '1px solid #b2e0e0', borderRadius: '4px',
    padding: '6px 10px', marginTop: '6px', fontSize: '9px', color: '#005f5f'
  }}>
    <span style={{ fontWeight: '700' }}>📋 {refText}:</span> {text}
  </div>
);

// ─── CAPÇALERA DEL DOCUMENT (repetida a cada secció impresa) ─────────────────
const CapcaleraDocument = ({ clientNom, clientNRT, exercici, seccio }) => (
  <div style={{ marginBottom: '20px' }}>
    {/* Header principal */}
    <div style={{
      background: `linear-gradient(135deg, ${AMBIT.colorFosc} 0%, ${AMBIT.color} 100%)`,
      padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }}>
      <div>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' }}>
          ÀMBIT Associats
        </div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '9px', marginTop: '2px' }}>
          Assessoria fiscal, comptable i mercantil · Escaldes-Engordany
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>
          Informe IRPF {exercici}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '9px' }}>{seccio}</div>
      </div>
    </div>
    {/* Barra client */}
    <div style={{
      backgroundColor: '#f7fafa', borderBottom: '1px solid #d0eaea',
      padding: '8px 30px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555'
    }}>
      <span><strong>Client:</strong> {clientNom || '—'} {clientNRT ? `· NRT: ${clientNRT}` : ''}</span>
      <span><strong>Exercici:</strong> {exercici} · <strong>Generat:</strong> {dataAvui()}</span>
    </div>
  </div>
);

// ─── COMPONENT PRINCIPAL ──────────────────────────────────────────────────────
const Step9Liquidacio = ({ dades, resultat, clientNom, clientNRT, exercici }) => {
  const informeRef = useRef(null);

  if (!resultat) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
        <p className="text-gray-500">Introdueix dades als passos anteriors per generar la liquidació.</p>
      </div>
    );
  }

  const caselles = generarCaselles300L(resultat);
  const r = resultat;

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const node = document.getElementById('informe-professional');
    if (!node) return;

    // Mostrar temporalment per forçar render
    node.style.display = 'block';
    node.style.position = 'absolute';
    node.style.left = '-9999px';
    node.style.width = '210mm';

    const htmlContent = node.innerHTML;

    // Tornar a amagar
    node.style.display = 'none';
    node.style.position = '';
    node.style.left = '';
    node.style.width = '';

    win.document.write(`<!DOCTYPE html><html lang="ca"><head>
    <meta charset="UTF-8"/>
    <title>Informe IRPF ${exercici} — ${clientNom || 'Client'}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #333; line-height: 1.5; background: white; }
      .page-break { page-break-before: always; break-before: page; }
      .avoid-break { page-break-inside: avoid; break-inside: avoid; }
      .page-content { padding: 0 30px 30px 30px; }
      @page { margin: 0; size: A4; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
  </head><body>${htmlContent}
    <script>window.onload=function(){setTimeout(function(){window.print();},500);};</script>
  </body></html>`);
    win.document.close();
  };

  // ── Calcular totals per a la portada ──────────────────────────────────────
  const tensTreball = (dades.rendesTreball || []).length > 0;
  const tensActivitats = (dades.activitats || []).length > 0;
  const tensImmobles = (dades.immobles || []).length > 0;
  const tensMobiliaris = (dades.mobiliaris || []).length > 0;
  const tensTransmissions = (dades.transmissions || []).length > 0;
  const tensDDI = (dades.rendesExterior || []).length > 0;

  return (
    <div className="space-y-6">

      {/* ── VISTA PANTALLA (no s'imprimeix) ────────────────────────────────── */}
      <div className="no-print">
        {/* Capçalera del pas */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">10</span>
            <div>
              <h2 className="font-bold text-gray-800">Liquidació i informe — Formulari 300-L</h2>
              <p className="text-xs text-gray-500">Resum complet de la liquidació IRPF {exercici}</p>
            </div>
          </div>

          {(clientNom || clientNRT) && (
            <div className="bg-gray-50 rounded-xl px-4 py-2 text-sm text-gray-600 mb-4">
              {clientNom && <span><strong>Client:</strong> {clientNom}</span>}
              {clientNRT && <span className="ml-4"><strong>NRT:</strong> {clientNRT}</span>}
              <span className="ml-4"><strong>Exercici:</strong> {exercici}</span>
            </div>
          )}

          {/* Resum 300-L en pantalla */}
          <div className="space-y-1">
            {caselles.map((c, i) => (
              <div key={i} className={`flex items-center justify-between py-2 px-3 rounded-lg ${c.destacat ? 'bg-[#009B9C]/10 font-semibold' : 'hover:bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-gray-500 w-16 text-right flex-shrink-0">{c.casella}</span>
                  <span className={`text-sm ${c.destacat ? 'text-gray-800' : 'text-gray-600'}`}>{c.descripcio}</span>
                </div>
                <span className={`font-mono text-sm font-semibold flex-shrink-0 ml-4 ${c.destacat ? 'text-[#009B9C]' : typeof c.valor === 'number' && c.valor < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                  {fmt(c.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Resultat final */}
        <div className={`rounded-2xl p-6 text-center ${r.resultatDeclaracio > 0 ? 'bg-red-50 border-2 border-red-300' : r.resultatDeclaracio < 0 ? 'bg-green-50 border-2 border-green-300' : 'bg-gray-50 border-2 border-gray-200'}`}>
          <p className="text-sm font-semibold text-gray-600 mb-2">RESULTAT DE LA DECLARACIÓ</p>
          <p className={`text-3xl font-bold mb-2 ${r.resultatDeclaracio > 0 ? 'text-red-600' : r.resultatDeclaracio < 0 ? 'text-green-600' : 'text-gray-700'}`}>
            {fmt(Math.abs(r.resultatDeclaracio))}
          </p>
          <p className={`text-lg font-semibold ${r.resultatDeclaracio > 0 ? 'text-red-700' : r.resultatDeclaracio < 0 ? 'text-green-700' : 'text-gray-600'}`}>
            {r.resultatDeclaracio > 0 ? 'A INGRESSAR' : r.resultatDeclaracio < 0 ? 'A RETORNAR' : 'RESULTAT ZERO'}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Tipus efectiu: <strong>{fmtPct(r.tipusEfectiu)}</strong> · Quota final: <strong>{fmt(r.quotaFinal)}</strong>
          </p>
        </div>

        {/* Botó generar informe */}
        <button
          onClick={handlePrint}
          className="w-full bg-[#009B9C] hover:bg-[#007A7B] text-white font-semibold py-4 px-6 rounded-xl transition flex items-center justify-center gap-3 text-base shadow-lg"
        >
          <span className="text-xl">🖨️</span>
          <div className="text-left">
            <div>Generar informe professional</div>
            <div className="text-xs font-normal opacity-80">PDF complet amb portada, detall de rendes i liquidació 300-L</div>
          </div>
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          Al diàleg d'impressió, seleccioneu "Desar com a PDF". Recomanem orientació vertical, mida A4.
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* INFORME PROFESSIONAL — S'imprimeix, no es veu en pantalla          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div
        id="informe-professional"
        ref={informeRef}
        style={{
          display: 'none',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '10px',
          color: '#333',
          lineHeight: '1.5',
          backgroundColor: 'white',
        }}
      >
        <style>{`
          @media print {
            #informe-professional { display: block !important; }
            .page-content { padding: 0 30px 30px 30px; }
            .page-break { page-break-before: always; break-before: page; }
            .avoid-break { page-break-inside: avoid; break-inside: avoid; }
          }
        `}</style>

        {/* ══ PÀGINA 1 — PORTADA ══════════════════════════════════════════ */}
        <div style={{ minHeight: '297mm', display: 'flex', flexDirection: 'column' }}>
          {/* Header gran portada */}
          <div style={{
            background: `linear-gradient(135deg, ${AMBIT.colorFosc} 0%, ${AMBIT.color} 60%, #00B5B6 100%)`,
            padding: '50px 40px 40px',
            color: 'white',
          }}>
            <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-1px', marginBottom: '4px' }}>
              ÀMBIT Associats
            </div>
            <div style={{ fontSize: '12px', opacity: 0.85, marginBottom: '40px' }}>
              Assessoria fiscal, comptable i mercantil · Escaldes-Engordany
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '30px' }}>
              <div style={{ fontSize: '11px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                Informe de liquidació
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>
                Impost sobre la Renda de les Persones Físiques
              </div>
              <div style={{ fontSize: '22px', fontWeight: '400', opacity: 0.9, marginTop: '4px' }}>
                Exercici {exercici}
              </div>
            </div>
          </div>

          {/* Dades del client */}
          <div style={{ padding: '30px 40px', backgroundColor: '#f7fafa', borderBottom: '2px solid #d0eaea' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Obligat Tributari</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#222' }}>{clientNom || '—'}</div>
                {clientNRT && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>NRT: {clientNRT}</div>}
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Dades de l'informe</div>
                <div style={{ fontSize: '11px', color: '#333' }}>Exercici fiscal: <strong>{exercici}</strong></div>
                <div style={{ fontSize: '11px', color: '#333' }}>Data de generació: <strong>{dataAvui()}</strong></div>
                <div style={{ fontSize: '11px', color: '#333' }}>Normativa: <strong>Llei 5/2014 · L2023005 · L2025005</strong></div>
              </div>
            </div>
          </div>

          {/* Resum executiu portada */}
          <div style={{ padding: '30px 40px', flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: AMBIT.colorFosc, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', borderBottom: `2px solid ${AMBIT.color}`, paddingBottom: '6px' }}>
              Resum executiu
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Base Tributació General', valor: fmt(r.baseTributacioGeneral) },
                { label: 'Base Tributació Estalvi', valor: fmt(r.baseTributacioEstalvi) },
                { label: 'Quota de Tributació', valor: fmt(r.quotaTributacio) },
                { label: 'Bonificació Art. 46', valor: fmt(r.bonificacio) },
                { label: 'Quota de Liquidació', valor: fmt(r.quotaLiquidacio) },
                { label: 'Quota Final', valor: fmt(r.quotaFinal) },
              ].map((item, i) => (
                <div key={i} style={{
                  backgroundColor: 'white', border: '1px solid #d0eaea',
                  borderRadius: '6px', padding: '10px 12px',
                  borderLeft: `3px solid ${AMBIT.color}`
                }}>
                  <div style={{ fontSize: '9px', color: '#888', marginBottom: '3px' }}>{item.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: AMBIT.colorFosc, fontFamily: 'monospace' }}>{item.valor}</div>
                </div>
              ))}
            </div>

            {/* Resultat gran */}
            <div style={{
              backgroundColor: r.resultatDeclaracio > 0 ? '#fff0f0' : r.resultatDeclaracio < 0 ? '#f0fff4' : '#f5f5f5',
              border: `2px solid ${r.resultatDeclaracio > 0 ? '#e74c3c' : r.resultatDeclaracio < 0 ? '#27ae60' : '#ccc'}`,
              borderRadius: '8px', padding: '16px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resultat de la declaració</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: r.resultatDeclaracio > 0 ? '#c0392b' : r.resultatDeclaracio < 0 ? '#27ae60' : '#555' }}>
                  {fmt(Math.abs(r.resultatDeclaracio))}
                </div>
              </div>
              <div style={{
                backgroundColor: r.resultatDeclaracio > 0 ? '#e74c3c' : r.resultatDeclaracio < 0 ? '#27ae60' : '#999',
                color: 'white', padding: '8px 16px', borderRadius: '6px',
                fontSize: '13px', fontWeight: '700'
              }}>
                {r.resultatDeclaracio > 0 ? 'A INGRESSAR' : r.resultatDeclaracio < 0 ? 'A RETORNAR' : 'RESULTAT ZERO'}
              </div>
            </div>

            {/* Tipus efectiu */}
            <div style={{ marginTop: '12px', fontSize: '10px', color: '#666', textAlign: 'right' }}>
              Tipus efectiu de tributació: <strong style={{ color: AMBIT.colorFosc }}>{fmtPct(r.tipusEfectiu)}</strong>
              {' · '}Retencions practicades: <strong>{fmt(r.retencions)}</strong>
            </div>
          </div>

          {/* Peu portada */}
          <div style={{ padding: '16px 40px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ddd', fontSize: '9px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>{AMBIT.nomComercial} · {AMBIT.nom} · NRT {AMBIT.nrt}</span>
            <span>{AMBIT.adreca} · {AMBIT.email} · {AMBIT.tel}</span>
          </div>
        </div>

        {/* ══ PÀGINA 2 — DETALL DE RENDES ════════════════════════════════ */}
        <div className="page-break" style={{ minHeight: '297mm', display: 'flex', flexDirection: 'column' }}>
          <CapcaleraDocument clientNom={clientNom} clientNRT={clientNRT} exercici={exercici} seccio="Detall de rendes" />

          <div className="page-content" style={{ flex: 1 }}>

            {/* Rendes del treball */}
            {tensTreball && (
              <SeccioBlocNormatiu titol="1. Rendes del treball — Formulari 300-B sec.1">
                <FilaDetall label="Renda neta del treball" valor={fmt(r.rendaTreball)} negrita destacat
                  nota="Art. 12-13 Llei 5/2014 · Ingressos bruts − cotitzacions CASS − 3% altres despeses (màx. 2.500 €)" />
                {(dades.rendesTreball || []).map((f, i) => (
                  <FilaDetall key={i} label={`Font ${i + 1}: ${f.tipus || 'Treball'}`} valor={fmt(f.importBrut)} nota={`Cotitzacions CASS: ${fmt(f.cotitzacionsCASS)} · Retencions: ${fmt(f.retencions)}`} />
                ))}
                <NotaNormativa refText="Art. 12 Llei 5/2014" text="Constitueixen rendes del treball totes les contraprestacions o utilitats, sigui quina sigui la seva denominació o naturalesa, que derivin de les relacions laborals o estatutàries." />
              </SeccioBlocNormatiu>
            )}

            {/* Activitats econòmiques */}
            {tensActivitats && (
              <SeccioBlocNormatiu titol="2. Rendes d'activitats econòmiques — Formulari 300-C">
                <FilaDetall label="Renda neta d'activitats econòmiques" valor={fmt(r.rendaActivitat)} negrita destacat
                  nota="Art. 14-19 Llei 5/2014 · Casella (3) del 300-C" />
                {(dades.activitats || []).map((a, i) => (
                  <FilaDetall key={i}
                    label={a.descripcio || `Activitat ${i + 1}`}
                    valor={fmt(a.columnes ? a.columnes.reduce((s, col) => s + (col.xifraNegocios || 0) + (col.ingressosFinancers || 0) + (col.altresIngressos || 0), 0) : (a.ingressos || 0))}
                    nota={`Mètode: ${a.tipusDeterminacio === 'directa' ? 'Determinació directa' : 'Determinació objectiva'} · Radicació: ${fmt(a.impostRadicacio)}`}
                  />
                ))}
                <NotaNormativa refText="Art. 14 Llei 5/2014" text="Constitueixen rendes d'activitats econòmiques les que provenen del treball personal i del capital conjuntament, o d'un sol d'aquests factors, suposant l'ordenació per compte propi de factors de producció i de recursos humans o d'un d'ambdós." />
              </SeccioBlocNormatiu>
            )}

            {/* Capital immobiliari */}
            {tensImmobles && (
              <SeccioBlocNormatiu titol="3. Rendes del capital immobiliari — Formulari 300-B sec.2">
                <FilaDetall label="Renda neta del capital immobiliari" valor={fmt(r.rendaImmobiliaria)} negrita destacat
                  nota="Art. 20-22 Llei 5/2014 · Ingressos íntegres − despeses deduïbles" />
                {(dades.immobles || []).map((im, i) => (
                  <FilaDetall key={i}
                    label={im.descripcio || `Immoble ${i + 1}`}
                    valor={fmt(im.ingressosIntegres)}
                    nota={`Mètode: ${im.tipusDeterminacio === 'forfetaria' ? 'Forfetari' : 'Directe'} · Impost comunal: ${fmt(im.impostComunal)}`}
                  />
                ))}
                <NotaNormativa refText="Art. 20-22 Llei 5/2014" text="Constitueixen rendes del capital immobiliari les procedents de béns immobles, tant rústics com urbans, que es trobin en el patrimoni de l'obligat tributari." />
              </SeccioBlocNormatiu>
            )}

            {/* Capital mobiliari */}
            {tensMobiliaris && (
              <SeccioBlocNormatiu titol="4. Rendes del capital mobiliari — Formulari 300-D">
                <FilaDetall label="Renda neta del capital mobiliari" valor={fmt(r.rendaMobiliaria)} negrita destacat
                  nota="Art. 23-29 Llei 5/2014 · Renda de l'estalvi · Mínim exempt 3.000 € (Art. 37)" />
                {(dades.mobiliaris || []).map((ent, i) => (
                  <FilaDetall key={i}
                    label={ent.entitat || `Entitat ${i + 1}`}
                    valor={fmt((ent.partides || []).reduce((s, p) => s + (p.importBrut || 0) - (p.despeses || 0), 0))}
                    nota={`Retencions AND: ${fmt((ent.partides || []).reduce((s, p) => s + (p.retencioAndorra || 0), 0))}`}
                  />
                ))}
                <NotaNormativa refText="Art. 23-29 Llei 5/2014" text="Constitueixen rendes del capital mobiliari els rendiments procedents de la participació en fons propis d'entitats, cedió de capitals propis a tercers, operacions de capitalització i contractes d'assegurança." />
              </SeccioBlocNormatiu>
            )}

            {/* Guanys capital */}
            {tensTransmissions && (
              <SeccioBlocNormatiu titol="5. Guanys i pèrdues de capital — Formulari 300-E">
                <FilaDetall label="Guanys i pèrdues de capital nets" valor={fmt(r.guanysCapital)} negrita destacat
                  nota="Art. 30-32 Llei 5/2014 · Valor transmissió − valor adquisició actualitzat" />
                {(dades.transmissions || []).map((t, i) => (
                  <FilaDetall key={i}
                    label={t.descripcio || `Transmissió ${i + 1} (${t.tipusElement || ''})`}
                    valor={fmt((t.valorTransmissio || 0) - (t.despesesTransmissio || 0) - (t.valorAdquisicio || 0) - (t.despesesAdquisicio || 0))}
                    nota={`Adquisició: ${fmt(t.valorAdquisicio)} (${t.anyAdquisicio}) · Transmissió: ${fmt(t.valorTransmissio)} (${t.anyTransmissio})`}
                  />
                ))}
                <NotaNormativa refText="Art. 30 Llei 5/2014" text="Constitueixen guanys o pèrdues de capital les variacions en el valor del patrimoni de l'obligat tributari que es posin de manifest amb ocasió d'alteració en la composició d'aquell." />
              </SeccioBlocNormatiu>
            )}

            {/* DDI */}
            {tensDDI && r.ddiDetall && r.ddiDetall.length > 0 && (
              <SeccioBlocNormatiu titol="6. Deducció per doble imposició (DDI) — Art. 48">
                {r.ddiDetall.map((d, i) => (
                  <FilaDetall key={i}
                    label={`${d.pais} — ${d.tipusRenda}`}
                    valor={fmt(d.ddi)}
                    nota={d.explicacio}
                  />
                ))}
                <NotaNormativa refText="Art. 48 Llei 5/2014" text="La DDI és el mínim entre: (a) l'impost efectivament pagat a l'estranger i (b) la quota andorrana que correspondria a aquella renda si s'hagués obtingut a Andorra." />
              </SeccioBlocNormatiu>
            )}
          </div>

          <div style={{ padding: '10px 40px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ddd', fontSize: '9px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>ÀMBIT Associats · Informe IRPF {exercici} · {clientNom || '—'}</span>
            <span>Pàgina 2 / 4</span>
          </div>
        </div>

        {/* ══ PÀGINA 3 — BASES I REDUCCIONS ══════════════════════════════ */}
        <div className="page-break" style={{ minHeight: '297mm', display: 'flex', flexDirection: 'column' }}>
          <CapcaleraDocument clientNom={clientNom} clientNRT={clientNRT} exercici={exercici} seccio="Bases i reduccions" />

          <div className="page-content" style={{ flex: 1 }}>

            <SeccioBlocNormatiu titol="Bases de tributació">
              <FilaDetall label="Renda del treball" valor={fmt(r.rendaTreball)} />
              <FilaDetall label="Renda d'activitats econòmiques" valor={fmt(r.rendaActivitat)} />
              <FilaDetall label="Renda del capital immobiliari" valor={fmt(r.rendaImmobiliaria)} />
              <FilaDetall label="Base de Tributació General (BTG)" valor={fmt(r.baseTributacioGeneral)} negrita destacat nota="Art. 33 Llei 5/2014 · Suma de rendes generals" />
              <div style={{ height: '8px' }} />
              <FilaDetall label="Renda del capital mobiliari" valor={fmt(r.rendaMobiliaria)} />
              <FilaDetall label="Guanys i pèrdues de capital" valor={fmt(r.guanysCapital)} />
              <FilaDetall label="Base de Tributació de l'Estalvi (BTE)" valor={fmt(r.baseTributacioEstalvi)} negrita destacat nota="Art. 37 Llei 5/2014 · Suma de rendes de l'estalvi · Mínim exempt 3.000 €" />
              <NotaNormativa refText="Art. 33-37 Llei 5/2014" text="La base de tributació general integra les rendes del treball, activitats econòmiques i capital immobiliari. La base de tributació de l'estalvi integra les rendes del capital mobiliari i els guanys i pèrdues de capital." />
            </SeccioBlocNormatiu>

            <SeccioBlocNormatiu titol="Mínim personal i reduccions — Formulari 300-A sec.2">
              <FilaDetall label="Mínim personal exempt" valor={`− ${fmt(r.minimPersonal)}`} nota={`Art. 35.1 Llei 5/2014 · ${dades.estatCivil === 'casat' ? `Casat/da · Rendes cònjuge: ${fmt(dades.conjugeRendesGenerals)}` : 'Solter/a, vidu/a o divorciat/da'} · ${dades.obligatDiscapacitat ? 'Discapacitat CONAVA' : 'Sense discapacitat reconeguda'}`} />
              {r.redFamiliar > 0 && <FilaDetall label="Reducció per càrregues familiars" valor={`− ${fmt(r.redFamiliar)}`} nota="Art. 35.2 Llei 5/2014 · Descendents, ascendents i tutela: 1.000 € per persona" />}
              {r.redHabitatge > 0 && <FilaDetall label="Reducció per habitatge habitual" valor={`− ${fmt(r.redHabitatge)}`} nota="Art. 38 Llei 5/2014 · 50% quotes hipoteca o lloguer assequible, màx. 5.000 €/any" />}
              {r.redPensions > 0 && <FilaDetall label="Reducció per plans de pensions" valor={`− ${fmt(r.redPensions)}`} nota="Art. 39 Llei 5/2014 · 100% aportació, màx. 5.000 €/any" />}
              <FilaDetall label="Total reduccions" valor={`− ${fmt(r.totalReduccions)}`} negrita />
              <NotaNormativa refText="Art. 35-39 Llei 5/2014" text="El mínim personal exempt no pot ser superior a la base de tributació general. Quan el cònjuge percep rendes inferiors a 24.000 €, el mínim s'incrementa fins a un màxim de 40.000 € (40.000 − rendes netes cònjuge)." />
            </SeccioBlocNormatiu>

            <SeccioBlocNormatiu titol="Bases de liquidació">
              <FilaDetall label="Base de Liquidació General (BLG)" valor={fmt(r.baseLiquidacioGeneral)} negrita destacat nota="BTG − reduccions − bases negatives 300-F. No pot ser negativa." />
              <FilaDetall label="Base de Liquidació de l'Estalvi (BLE)" valor={fmt(r.baseLiquidacioEstalvi)} negrita destacat nota="BTE − mínim exempt estalvi (3.000 €). No pot ser negativa." />
            </SeccioBlocNormatiu>

            <SeccioBlocNormatiu titol="Quota de tributació i bonificació">
              <FilaDetall label="Quota de tributació (10% sobre BLG + BLE)" valor={fmt(r.quotaTributacio)} nota="Art. 41-42 Llei 5/2014 · Tipus únic del 10% sobre la suma de BLG i BLE" />
              <FilaDetall label="Bonificació Art. 46 (màx. 800 €)" valor={`− ${fmt(r.bonificacio)}`} nota="Art. 46 Llei 5/2014 · Bonificació per obligats amb BLG baixa. Per al càlcul s'usa el mínim personal base (24.000 €), no l'incrementat." />
              <FilaDetall label="Quota de liquidació" valor={fmt(r.quotaLiquidacio)} negrita destacat />
              <NotaNormativa refText="Art. 41-46 Llei 5/2014" text="El tipus de gravamen general és del 10%. La bonificació de l'Art. 46 redueix la quota per als obligats tributaris amb rendes moderades, però no pot generar quota negativa." />
            </SeccioBlocNormatiu>

          </div>

          <div style={{ padding: '10px 40px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ddd', fontSize: '9px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>ÀMBIT Associats · Informe IRPF {exercici} · {clientNom || '—'}</span>
            <span>Pàgina 3 / 4</span>
          </div>
        </div>

        {/* ══ PÀGINA 4 — LIQUIDACIÓ FINAL 300-L (INDEPENDENT) ════════════ */}
        <div className="page-break" style={{ minHeight: '297mm', display: 'flex', flexDirection: 'column' }}>
          <CapcaleraDocument clientNom={clientNom} clientNRT={clientNRT} exercici={exercici} seccio="Liquidació final — Formulari 300-L" />

          <div className="page-content" style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: AMBIT.colorFosc, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', borderBottom: `2px solid ${AMBIT.color}`, paddingBottom: '6px' }}>
              Formulari 300-L · Liquidació de l'IRPF {exercici}
            </div>

            {/* Taula 300-L */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: AMBIT.color, color: 'white' }}>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: '600', width: '70px' }}>Casella</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: '600' }}>Descripció</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '600', width: '120px' }}>Import</th>
                </tr>
              </thead>
              <tbody>
                {caselles.map((c, i) => (
                  <tr key={i} style={{
                    backgroundColor: c.destacat ? '#e6f7f7' : i % 2 === 0 ? '#fafafa' : 'white',
                    borderBottom: '1px solid #eee'
                  }}>
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: '9px', color: '#666', fontWeight: c.destacat ? '700' : '400' }}>
                      {c.casella}
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: c.destacat ? '700' : '400', color: c.destacat ? AMBIT.colorFosc : '#333' }}>
                      {c.descripcio}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: c.destacat ? '700' : '500', color: c.destacat ? AMBIT.color : typeof c.valor === 'number' && c.valor < 0 ? '#c0392b' : '#333' }}>
                      {fmt(c.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Resultat final destacat */}
            <div style={{
              backgroundColor: r.resultatDeclaracio > 0 ? '#fff0f0' : r.resultatDeclaracio < 0 ? '#f0fff4' : '#f5f5f5',
              border: `2px solid ${r.resultatDeclaracio > 0 ? '#e74c3c' : r.resultatDeclaracio < 0 ? '#27ae60' : '#ccc'}`,
              borderRadius: '8px', padding: '16px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '16px'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resultat de la declaració</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: r.resultatDeclaracio > 0 ? '#c0392b' : r.resultatDeclaracio < 0 ? '#27ae60' : '#555', fontFamily: 'monospace' }}>
                  {fmt(Math.abs(r.resultatDeclaracio))}
                </div>
                <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                  Tipus efectiu: <strong>{fmtPct(r.tipusEfectiu)}</strong>
                  {' · '}Quota final: <strong>{fmt(r.quotaFinal)}</strong>
                  {' · '}Retencions: <strong>{fmt(r.retencions)}</strong>
                </div>
              </div>
              <div style={{
                backgroundColor: r.resultatDeclaracio > 0 ? '#e74c3c' : r.resultatDeclaracio < 0 ? '#27ae60' : '#999',
                color: 'white', padding: '10px 20px', borderRadius: '6px',
                fontSize: '16px', fontWeight: '800', textAlign: 'center'
              }}>
                {r.resultatDeclaracio > 0 ? 'A INGRESSAR' : r.resultatDeclaracio < 0 ? 'A RETORNAR' : 'RESULTAT ZERO'}
              </div>
            </div>

            {/* Formularis a presentar */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: AMBIT.colorFosc, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Formularis a presentar al Portal Tributari
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { codi: '300-A', actiu: true, desc: 'Situació personal' },
                  { codi: '300-B', actiu: tensTreball || tensImmobles, desc: 'Treball / Immobiliari' },
                  { codi: '300-C', actiu: tensActivitats, desc: 'Activitats econòmiques' },
                  { codi: '300-D', actiu: tensMobiliaris, desc: 'Capital mobiliari' },
                  { codi: '300-E', actiu: tensTransmissions, desc: 'Guanys capital' },
                  { codi: '300-F', actiu: (dades.basesNegGenerals || []).length > 0 || (dades.deduccionsAnteriors || []).length > 0, desc: 'Bases neg. anteriors' },
                  { codi: '300-L', actiu: true, desc: 'Liquidació' },
                ].map(f => (
                  <div key={f.codi} style={{
                    backgroundColor: f.actiu ? '#e6f7f7' : '#f5f5f5',
                    border: `1px solid ${f.actiu ? AMBIT.color : '#ddd'}`,
                    borderRadius: '4px', padding: '4px 8px',
                    fontSize: '9px', color: f.actiu ? AMBIT.colorFosc : '#aaa',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <span style={{ fontWeight: '700', fontFamily: 'monospace' }}>{f.codi}</span>
                    <span>{f.actiu ? '✓' : '○'} {f.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <NotaNormativa refText="Termini de presentació" text={`La declaració de l'IRPF de l'exercici ${exercici} s'ha de presentar entre l'1 d'abril i el 30 de setembre de ${exercici + 1}. El pagament fraccionat (formulari 320) es presenta a l'Administració tributària durant el mes de setembre de ${exercici}. Portal Tributari: www.eda.ad`} />
          </div>

          <div style={{ padding: '10px 40px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ddd', fontSize: '9px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>ÀMBIT Associats · Informe IRPF {exercici} · {clientNom || '—'}</span>
            <span>Pàgina 4 / 4</span>
          </div>
        </div>

        {/* ══ ÚLTIMA PÀGINA — DISCLAIMERS I PEU LEGAL ════════════════════ */}
        <div className="page-break" style={{ minHeight: '297mm', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            background: `linear-gradient(135deg, ${AMBIT.colorFosc} 0%, ${AMBIT.color} 100%)`,
            padding: '30px 40px', color: 'white'
          }}>
            <div style={{ fontSize: '18px', fontWeight: '800' }}>ÀMBIT Associats</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>Informació legal i avisos importants</div>
          </div>

          <div className="page-content" style={{ flex: 1, paddingTop: '30px' }}>

            {/* Avís principal */}
            <div style={{ backgroundColor: '#fff8e1', border: '2px solid #f9a825', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#e65100', marginBottom: '8px' }}>⚠️ AVÍS IMPORTANT</div>
              <p style={{ fontSize: '10px', color: '#555', lineHeight: '1.6', margin: 0 }}>
                Aquest informe ha estat generat per l'<strong>Eina Fiscal IRPF d'ÀMBIT Associats</strong> a partir de les dades introduïdes per l'usuari. El seu contingut té caràcter <strong>merament informatiu i orientatiu</strong>, i no constitueix ni substitueix en cap cas l'assessorament fiscal professional personalitzat. ÀMBIT Associats no assumeix cap responsabilitat sobre les decisions preses en base a aquest informe sense una revisió professional prèvia.
              </p>
            </div>

            {[
              {
                titol: '1. Responsabilitat i limitació de responsabilitat',
                text: `Els càlculs continguts en aquest informe s'han efectuat d'acord amb la Llei 5/2014, del 24 d'abril, de l'Impost sobre la Renda de les Persones Físiques del Principat d'Andorra, i les seves modificacions posteriors (L2023005 i L2025005), així com el Reglament de 29/12/2023. Tanmateix, l'eina pot no reflectir la totalitat de les particularitats normatives aplicables a cada situació individual. DEL SOTO – PALEARI & ASSOCIATS, S.L. no es fa responsable dels errors, omissions o inexactituds que poguessin derivar-se de les dades introduïdes per l'usuari o de canvis normatius posteriors a l'última actualització de l'eina.`
              },
              {
                titol: '2. Naturalesa de l\'informe',
                text: 'Aquest document és un informe de treball intern o de presentació al client, elaborat per un professional de l\'assessoria tributària. No substitueix en cap cas la declaració oficial de l\'IRPF, que s\'ha de presentar obligatòriament a través del Portal Tributari del Govern d\'Andorra (www.eda.ad) dins dels terminis legals establerts. La presentació d\'una liquidació incorrecta o fora de termini pot comportar sancions administratives.'
              },
              {
                titol: '3. Protecció de dades personals (Llei 29/2021)',
                text: `En compliment de la Llei 29/2021, del 28 d'octubre, qualificada de protecció de dades personals del Principat d'Andorra, i del Reglament (UE) 2016/679 (RGPD), s'informa que les dades personals contingudes en aquest informe (nom, NRT, dades fiscals) han estat introduïdes per l'assessor tributari en el marc de la relació professional establerta amb l'obligat tributari. Les dades es tracten únicament per a la finalitat de gestionar la liquidació de l'IRPF i no es cediran a tercers sense consentiment exprés. Les dades es guarden localment al navegador (localStorage) i no es transmeten a cap servidor extern. L'obligat tributari pot exercir els seus drets d'accés, rectificació i supressió dirigint-se a ${AMBIT.email}.`
              },
              {
                titol: '4. Confidencialitat',
                text: 'Aquest informe conté dades fiscals de caràcter confidencial. La seva difusió, còpia o utilització per a finalitats diferents de les previstes queda expressament prohibida sense l\'autorització de l\'obligat tributari o del professional que l\'ha elaborat.'
              },
              {
                titol: '5. Normativa de referència',
                text: `Llei 5/2014, del 24 d'abril, de l'impost sobre la renda de les persones físiques (IRPF) del Principat d'Andorra (BOPA núm. 30, del 30/04/2014). Modificació L2023005 (L2023005 BOPA). Modificació L2025005 (L2025005 BOPA). Reglament de l'IRPF, del 29/12/2023 (BOPA R20231229B i R20231229D). Guia pràctica IRPF 2025 del Ministeri de Finances del Govern d'Andorra.`
              }
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: '14px' }} className="avoid-break">
                <div style={{ fontSize: '10px', fontWeight: '700', color: AMBIT.colorFosc, marginBottom: '4px' }}>{item.titol}</div>
                <p style={{ fontSize: '9px', color: '#555', lineHeight: '1.6', margin: 0 }}>{item.text}</p>
              </div>
            ))}
          </div>

          {/* Peu legal final */}
          <div style={{
            backgroundColor: AMBIT.colorFosc, color: 'white',
            padding: '20px 40px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '9px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: '700', marginBottom: '4px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '8px' }}>Entitat</div>
                <div>{AMBIT.nom}</div>
                <div style={{ opacity: 0.75 }}>NRT: {AMBIT.nrt}</div>
              </div>
              <div>
                <div style={{ fontWeight: '700', marginBottom: '4px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '8px' }}>Adreça</div>
                <div>{AMBIT.adreca}</div>
                <div style={{ opacity: 0.75 }}>{AMBIT.poblacio}</div>
              </div>
              <div>
                <div style={{ fontWeight: '700', marginBottom: '4px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '8px' }}>Contacte</div>
                <div>{AMBIT.email}</div>
                <div style={{ opacity: 0.75 }}>{AMBIT.tel} · {AMBIT.web}</div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '10px', fontSize: '8px', opacity: 0.6, textAlign: 'center' }}>
              © {new Date().getFullYear()} {AMBIT.nom} · Tots els drets reservats · Informe generat el {dataAvui()} · Normativa: Llei 5/2014 · L2023005 · L2025005 · Reglament 29/12/2023
            </div>
          </div>
        </div>

      </div>
      {/* FI INFORME PROFESSIONAL */}

    </div>
  );
};

export default Step9Liquidacio;
