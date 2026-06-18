// steps/Step9Liquidacio.jsx — Pas 10: Liquidació i informe professional (300-L)
import React, { useRef, useState } from 'react';
import { generarCaselles300L } from '../engine/liquidacioEngine';
import { PDF_LANGS, t } from '../engine/pdfTranslations';

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

// Genera una versió més fosca d'un color HEX per usar als recuadres
function colorFosc(hex) {
  if (!hex || !hex.startsWith('#')) return '#007A7B';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const factor = 0.75; // 25% més fosc
  const rf = Math.round(r * factor).toString(16).padStart(2, '0');
  const gf = Math.round(g * factor).toString(16).padStart(2, '0');
  const bf = Math.round(b * factor).toString(16).padStart(2, '0');
  return `#${rf}${gf}${bf}`;
}

// Genera una versió molt clara d'un color HEX per usar als fons dels recuadres
function colorClar(hex) {
  if (!hex || !hex.startsWith('#')) return '#e6f7f7';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const rf = Math.round(r + (255 - r) * 0.88).toString(16).padStart(2, '0');
  const gf = Math.round(g + (255 - g) * 0.88).toString(16).padStart(2, '0');
  const bf = Math.round(b + (255 - b) * 0.88).toString(16).padStart(2, '0');
  return `#${rf}${gf}${bf}`;
}

// Genera una versió mitjanament clara per a bordes
function colorBorde(hex) {
  if (!hex || !hex.startsWith('#')) return '#b2e0e0';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const rf = Math.round(r + (255 - r) * 0.60).toString(16).padStart(2, '0');
  const gf = Math.round(g + (255 - g) * 0.60).toString(16).padStart(2, '0');
  const bf = Math.round(b + (255 - b) * 0.60).toString(16).padStart(2, '0');
  return `#${rf}${gf}${bf}`;
}

const dataAvui = () => {
  return new Date().toLocaleDateString('ca-AD', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
};


// ─── Components interns ───────────────────────────────────────────────────────
// (definits dins Step9Liquidacio per tenir accés directe al CAP i als colors personalitzats)

// ─── CAPÇALERA DEL DOCUMENT (rep cap com a prop per suportar capçalera personalitzada) ──
const CapcaleraDocument = ({ clientNom, clientNRT, exercici, seccio, cap }) => {
  const C = cap || AMBIT;
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{
        background: `linear-gradient(135deg, ${C.colorFosc} 0%, ${C.color} 100%)`,
        padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ color: 'white', fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' }}>
            {C.nomComercial || C.nom}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '9px', marginTop: '2px' }}>
            {C.adreca}{C.poblacio ? ` · ${C.poblacio}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>
            Informe IRPF {exercici}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '9px' }}>{seccio}</div>
        </div>
      </div>
      <div style={{
        backgroundColor: '#f7fafa', borderBottom: '1px solid #d0eaea',
        padding: '8px 30px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555'
      }}>
        <span><strong>Client:</strong> {clientNom || '—'} {clientNRT ? `· NRT: ${clientNRT}` : ''}</span>
        <span><strong>Exercici:</strong> {exercici} · <strong>Generat:</strong> {dataAvui()}</span>
      </div>
    </div>
  );
};

// Noms descriptius de les partides de capital mobiliari (300-D): vegeu claus
// mobiliariA-D a pdfTranslations.js (traduïts a 4 idiomes).

// ─── COMPONENT PRINCIPAL ──────────────────────────────────────────────────────
const Step9Liquidacio = ({ dades, resultat, clientNom, clientNRT, exercici, onFinalitzar, onReobrir, estat, capcalera }) => {
  const informeRef = useRef(null);

  // Combinar capçalera personalitzada amb valors ÀMBIT per defecte
  const CAP = {
    nom: capcalera?.nom || AMBIT.nom,
    nomComercial: capcalera?.nom || AMBIT.nomComercial,
    nrt: capcalera?.nrt || AMBIT.nrt,
    adreca: capcalera?.adreca || AMBIT.adreca,
    poblacio: capcalera?.poblacio || AMBIT.poblacio,
    email: capcalera?.email || AMBIT.email,
    tel: capcalera?.tel || AMBIT.tel,
    web: capcalera?.web || AMBIT.web,
    color: capcalera?.color || AMBIT.color,
    colorFosc: colorFosc(capcalera?.color || AMBIT.color),
    colorClar: colorClar(capcalera?.color || AMBIT.color),
    colorBorde: colorBorde(capcalera?.color || AMBIT.color),
  };

  const esAmbit = CAP.nom === AMBIT.nom;

  const [idiomaInforme, setIdiomaInforme] = useState('CA');
  // Helper de traducció lligat a l'idioma triat per a l'informe PDF
  const tr = (key) => t(key, idiomaInforme);
  // Helper amb paràmetres: substitueix placeholders {x} de la traducció pels valors donats
  const trp = (key, params = {}) => {
    let s = t(key, idiomaInforme);
    Object.keys(params).forEach(p => { s = s.split(`{${p}}`).join(params[p]); });
    return s;
  };
  const [blocsExclosos, setBlocsExclosos] = useState({
    treball: false, activitats: false, immobiliari: false,
    mobiliari: false, transmissions: false, ddi: false,
  });
  const toggleBloc = (bloc) => setBlocsExclosos(prev => ({ ...prev, [bloc]: !prev[bloc] }));

  // Components interns que tanquen sobre CAP per usar els colors personalitzats
  const SeccioBlocNormatiu = ({ titol, children }) => (
    <div style={{ pageBreakInside: 'avoid', breakInside: 'avoid', marginBottom: '16px' }}>
      <div style={{ borderLeft: `4px solid ${CAP.color}`, paddingLeft: '12px', marginBottom: '10px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
        <h3 style={{ fontSize: '11px', fontWeight: '700', color: CAP.colorFosc, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          {titol}
        </h3>
      </div>
      {children}
    </div>
  );

  const FilaDetall = ({ label, valor, negrita = false, destacat = false, negatiu = false, nota = null }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '3px 10px',
      backgroundColor: destacat ? CAP.colorClar : 'transparent',
      borderBottom: '1px solid #f0f0f0',
      fontSize: '10px',
    }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: negrita || destacat ? '700' : '400', color: destacat ? CAP.colorFosc : '#333' }}>
          {label}
        </span>
        {nota && <div style={{ fontSize: '9px', color: '#888', marginTop: '1px', fontStyle: 'italic' }}>{nota}</div>}
      </div>
      <span style={{
        fontWeight: negrita || destacat ? '700' : '500',
        color: destacat ? CAP.color : negatiu ? '#c0392b' : '#333',
        fontFamily: 'monospace', fontSize: '10px', marginLeft: '8px', whiteSpace: 'nowrap'
      }}>
        {valor === null ? '' : valor}
      </span>
    </div>
  );

  const NotaNormativa = ({ refText, text }) => (
    <div style={{
      backgroundColor: CAP.colorClar, border: `1px solid ${CAP.colorBorde}`, borderRadius: '4px',
      padding: '6px 10px', marginTop: '6px', fontSize: '9px', color: CAP.colorFosc
    }}>
      <span style={{ fontWeight: '700' }}>📋 {refText}:</span> {text}
    </div>
  );

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
    const node = document.getElementById('informe-professional');
    if (!node) return;

    // Mostrar temporalment per forçar render del navegador
    node.style.display = 'block';
    node.style.position = 'absolute';
    node.style.left = '-9999px';
    node.style.top = '0';
    node.style.width = '210mm';
    node.style.backgroundColor = 'white';

    // Esperar 2 frames perquè el navegador calculi el layout
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const htmlContent = node.innerHTML;

        // Tornar a amagar
        node.style.display = 'none';
        node.style.position = '';
        node.style.left = '';
        node.style.top = '';
        node.style.width = '';

        const win = window.open('', '_blank');
        if (!win) {
          alert('El navegador ha blocat la finestra emergent. Permet les finestres emergents per a aquest lloc.');
          return;
        }

        win.document.write(`<!DOCTYPE html>
<html lang="ca">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Informe IRPF ${exercici} — ${clientNom || 'Client'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      color: #333;
      line-height: 1.5;
      background: white;
    }
    .page-break { page-break-before: always; break-before: page; }
    .avoid-break { page-break-inside: avoid; break-inside: avoid; }
    .page-content { padding: 0 30px 30px 30px; }
    /* Capçalera i peu repetits a cada pàgina física d'una secció (thead/tfoot) */
    .sec-table { width: 100%; border-collapse: collapse; }
    .sec-table > thead { display: table-header-group; }
    .sec-table > tfoot { display: table-footer-group; }
    .sec-table > thead > tr > td, .sec-table > tbody > tr > td, .sec-table > tfoot > tr > td { padding: 0; }
    @page { margin: 0; size: A4 portrait; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${htmlContent}<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 800);
  };
</script>
</body>
</html>`);
        win.document.close();
      });
    });
  };

  // ── Calcular totals per a la portada ──────────────────────────────────────
  const tensTreball = (dades.rendesTreball || []).length > 0;
  const tensActivitats = (dades.activitats || []).length > 0;
  const tensImmobles = (dades.immobles || []).length > 0;
  const tensMobiliaris = (dades.mobiliaris || []).length > 0;
  const tensTransmissions = (dades.transmissions || []).length > 0;
  const tensTransmissionsGravades = (dades.transmissions || []).some(t => !t.exempta);
  const tensTransmissionsExemptes = (dades.transmissions || []).some(t => t.exempta);
  const tensDDI = (dades.rendesExterior || []).length > 0;
  const tensRendesSenseTransmissio = (dades.rendesSenseTransmissio || []).length > 0;
  const totalSenseTransmissio = (dades.rendesSenseTransmissio || []).reduce((s, rr) => s + (rr.resultat || 0), 0);
  const tensDevolucionsCapital = (dades.transmissions || []).some(t => t.esDevolucioCapital);

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

          {/* Configuració de l'informe */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
            <p className="text-xs font-semibold text-gray-600 mb-3">⚙️ Configuració de l'informe — Blocs a mostrar</p>
            <div className="flex flex-wrap gap-3">
              {tensTreball && (
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={!blocsExclosos.treball} onChange={() => toggleBloc('treball')} className="accent-[#009B9C]" />
                  Rendes del treball
                </label>
              )}
              {tensActivitats && (
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={!blocsExclosos.activitats} onChange={() => toggleBloc('activitats')} className="accent-[#009B9C]" />
                  Activitats econòmiques
                </label>
              )}
              {tensImmobles && (
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={!blocsExclosos.immobiliari} onChange={() => toggleBloc('immobiliari')} className="accent-[#009B9C]" />
                  Capital immobiliari
                </label>
              )}
              {tensMobiliaris && (
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={!blocsExclosos.mobiliari} onChange={() => toggleBloc('mobiliari')} className="accent-[#009B9C]" />
                  Capital mobiliari
                </label>
              )}
              {tensTransmissions && (
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={!blocsExclosos.transmissions} onChange={() => toggleBloc('transmissions')} className="accent-[#009B9C]" />
                  Guanys i pèrdues de capital
                </label>
              )}
              {tensDDI && (
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={!blocsExclosos.ddi} onChange={() => toggleBloc('ddi')} className="accent-[#009B9C]" />
                  Deducció doble imposició (DDI)
                </label>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">Els blocs desmarcats no apareixeran al PDF però el càlcul 300-L no canvia.</p>
          </div>

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
            {(r.pagamentACompte || 0) > 0 && <> · Pag. fraccionat (320): <strong>{fmt(r.pagamentACompte)}</strong></>}
          </p>
        </div>

        {/* Selector d'idioma de l'informe */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
          <p className="text-xs font-semibold text-gray-600 mb-3">🌐 Idioma de l'informe</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(PDF_LANGS).map(([codi, nom]) => (
              <button
                key={codi}
                onClick={() => setIdiomaInforme(codi)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  idiomaInforme === codi
                    ? 'bg-[#009B9C] text-white'
                    : 'bg-white border border-gray-300 text-gray-600 hover:border-[#009B9C]'
                }`}
              >
                {codi === 'CA' ? '🇦🇩' : codi === 'ES' ? '🇪🇸' : codi === 'FR' ? '🇫🇷' : '🇬🇧'} {nom}
              </button>
            ))}
          </div>
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
        {estat === 'finalitzada' ? (
          <div className="space-y-3">
            <div className="w-full bg-green-50 border-2 border-green-300 text-green-700 font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-3 text-sm">
              <span>✅</span>
              <span>Declaració finalitzada</span>
            </div>
            {onReobrir && (
              <button
                onClick={onReobrir}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center gap-3 text-sm"
              >
                <span>✏️</span>
                <div className="text-left">
                  <div>Reobrir i editar</div>
                  <div className="text-xs font-normal opacity-70">Torna la declaració a estat esborrany per poder modificar-la</div>
                </div>
              </button>
            )}
          </div>
        ) : (
          onFinalitzar && (
            <button
              onClick={onFinalitzar}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center gap-3 text-sm"
            >
              <span>✅</span>
              <div className="text-left">
                <div>Finalitzar declaració</div>
                <div className="text-xs font-normal opacity-80">Marca la declaració com a finalitzada i torna a la llista</div>
              </div>
            </button>
          )
        )}
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
            background: `linear-gradient(135deg, ${CAP.colorFosc} 0%, ${CAP.color} 100%)`,
            padding: '50px 40px 40px',
            color: 'white',
          }}>
            <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-1px', marginBottom: '4px' }}>
              {CAP.nomComercial || CAP.nom}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.85, marginBottom: '40px' }}>
              {CAP.adreca}{CAP.poblacio ? ` · ${CAP.poblacio}` : ''}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '30px' }}>
              <div style={{ fontSize: '11px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                {tr('subtitolInforme')}
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>
                {tr('titolInforme')}
              </div>
              <div style={{ fontSize: '22px', fontWeight: '400', opacity: 0.9, marginTop: '4px' }}>
                {tr('exerciciFiscal')} {exercici}
              </div>
            </div>
          </div>

          {/* Dades del client */}
          <div style={{ padding: '30px 40px', backgroundColor: CAP.colorClar, borderBottom: `2px solid ${CAP.colorBorde}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{tr('obligatTributari')}</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#222' }}>{clientNom || '—'}</div>
                {clientNRT && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{tr('nrt')}: {clientNRT}</div>}
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{tr('dadesInforme')}</div>
                <div style={{ fontSize: '11px', color: '#333' }}>{tr('exerciciFiscal')}: <strong>{exercici}</strong></div>
                <div style={{ fontSize: '11px', color: '#333' }}>{tr('dataGeneracio')}: <strong>{dataAvui()}</strong></div>
                <div style={{ fontSize: '11px', color: '#333' }}>{tr('normativa')}: <strong>Llei 5/2014 · L2023005 · L2025005</strong></div>
              </div>
            </div>
          </div>

          {/* Resum executiu portada */}
          <div style={{ padding: '30px 40px', flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: CAP.colorFosc, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', borderBottom: `2px solid ${CAP.color}`, paddingBottom: '6px' }}>
              {tr('resumExecutiu')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: tr('baseTributacioGeneral'), valor: fmt(r.baseTributacioGeneral) },
                { label: tr('baseTributacioEstalvi'), valor: fmt(r.baseTributacioEstalvi) },
                { label: tr('quotaTributacio'), valor: fmt(r.quotaTributacio) },
                { label: tr('bonificacioArt46'), valor: fmt(r.bonificacio) },
                { label: tr('quotaLiquidacio'), valor: fmt(r.quotaLiquidacio) },
                { label: tr('quotaFinal'), valor: fmt(r.quotaFinal) },
              ].map((item, i) => (
                <div key={i} style={{
                  backgroundColor: 'white', border: `1px solid ${CAP.colorBorde}`,
                  borderRadius: '6px', padding: '10px 12px',
                  borderLeft: `3px solid ${CAP.color}`
                }}>
                  <div style={{ fontSize: '9px', color: '#888', marginBottom: '3px' }}>{item.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: CAP.colorFosc, fontFamily: 'monospace' }}>{item.valor}</div>
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
                <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tr('resultatDeclaracio')}</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: r.resultatDeclaracio > 0 ? '#c0392b' : r.resultatDeclaracio < 0 ? '#27ae60' : '#555' }}>
                  {fmt(Math.abs(r.resultatDeclaracio))}
                </div>
              </div>
              <div style={{
                backgroundColor: r.resultatDeclaracio > 0 ? '#e74c3c' : r.resultatDeclaracio < 0 ? '#27ae60' : '#999',
                color: 'white', padding: '8px 16px', borderRadius: '6px',
                fontSize: '13px', fontWeight: '700'
              }}>
                {r.resultatDeclaracio > 0 ? tr('aIngressar') : r.resultatDeclaracio < 0 ? tr('aRetornar') : tr('quotaZero')}
              </div>
            </div>

            {/* Tipus efectiu */}
            <div style={{ marginTop: '12px', fontSize: '10px', color: '#666', textAlign: 'right' }}>
              {tr('tipusEfectiu')}: <strong style={{ color: CAP.colorFosc }}>{fmtPct(r.tipusEfectiu)}</strong>
              {' · '}{tr('retencions')}: <strong>{fmt(r.retencions)}</strong>
            </div>
          </div>

          {/* Peu portada */}
          <div style={{ padding: '16px 40px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ddd', fontSize: '9px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>{CAP.nomComercial} · {CAP.nom} · NRT {CAP.nrt}</span>
            <span>{CAP.adreca} · {CAP.email} · {CAP.tel}</span>
          </div>
        </div>

        {/* ══ PÀGINA 2 — DETALL DE RENDES ════════════════════════════════ */}
        <div className="page-break">
         <table className="sec-table">
          <thead><tr><td>
            <CapcaleraDocument clientNom={clientNom} clientNRT={clientNRT} exercici={exercici} seccio={tr('detallRendes')} cap={CAP} />
          </td></tr></thead>
          <tbody><tr><td>
          <div className="page-content" style={{ padding: '10px 30px 20px 30px' }}>

            {exercici < 2024 && (
              <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '6px', padding: '8px 12px', marginBottom: '10px', fontSize: '9px', color: '#92400E' }}>
                ⚠️ <strong>Exercici {exercici} — Normativa Llei 5/2014 text refós 9 (vigent fins 31/12/2023)</strong>: S'aplica la normativa anterior a la L2023005 (en vigor des de l'1/1/2024). Diferències aplicades: (1) Art. 5.k COT/NCT: exempció únicament si participació ≤ 25%; la branca de tinença ≥ 10 anys no aplica per a aquest exercici; (2) Deduccions de mecenatge, digitalització, llocs de treball i patrocini no disponibles.
              </div>
            )}

            {/* Rendes del treball */}
            {tensTreball && !blocsExclosos.treball && (
              <SeccioBlocNormatiu titol={`1. ${tr('rendesTreball')}`}>
                <FilaDetall label={tr('rendaNetaTreballLabel')} valor={fmt(r.rendaTreball)} negrita destacat
                  nota={tr('notaRendaNetaTreball')} />
                {(() => {
                  const TIPUS_SENSE_3PCT = ['PENSIO_CASS', 'PENSIO_CLASSES_PASSIVES', 'PENSIO_PRIVADA', 'DIETES', 'INDEMNITZACIO_ACOMIADAMENT', 'BECA', 'PREMI'];
                  const TIPUS_LABEL = { SALARI_GENERAL: 'Salari / Nòmina', ADMINISTRADOR: 'Retribució administrador', PENSIO_PRIVADA: 'Pensió privada / estrangera', ALTRES_TREBALL: 'Altres rendes del treball', DIETES: 'Dietes', INDEMNITZACIO_ACOMIADAMENT: 'Indemnització acomiadament', BECA: 'Beca / Ajut recerca', PREMI: 'Premi literari / artístic' };
                  const totalGravat3pct = (dades.rendesTreball || []).reduce((sum, f) => {
                    if (TIPUS_SENSE_3PCT.includes(f.tipus)) return sum;
                    return sum + (f.importBrut || 0);
                  }, 0);
                  const altresDespesesTotal = Math.min(totalGravat3pct * 0.03, 2500);
                  return (dades.rendesTreball || []).map((f, i) => {
                  const brut = f.importBrut || 0;

                  if (f.tipus === 'PENSIO_CASS') {
                    const anysTotals = f.anysTotals || 0;
                    const anysCotAbans2015 = f.anysCotitzatsAbans2015 != null ? f.anysCotitzatsAbans2015 : (f.anysCotitzats || 0);
                    const ratio = anysTotals >= 15 ? Math.min(anysCotAbans2015 * 0.01, 0.30) : 0;
                    const importExempt = brut * ratio;
                    const importGravat = brut - importExempt;
                    const cassPensio = f.cotitzacionsCASS || 0;
                    return (
                      <React.Fragment key={i}>
                        <FilaDetall label={trp('fontPensioCassNum', { n: i + 1 })} valor={fmt(brut)} nota={tr('notaImportBrutDispAdd5a')} />
                        <FilaDetall label={`  − Reducció Disp. add. 5a (${anysCotAbans2015} anys × 1% = ${(ratio * 100).toFixed(0)}%, màx. 30%)`}
                          valor={fmt(-importExempt)} negatiu
                          nota={anysTotals < 15 ? `Anys totals cotitzats: ${anysTotals} (< 15 → reducció 0%)` : `Anys totals: ${anysTotals} · Anys abans 2015: ${anysCotAbans2015}`} />
                        <FilaDetall label={tr('importGravatPensioCass')} valor={fmt(importGravat)} negrita={cassPensio === 0}
                          nota={cassPensio > 0 ? undefined : `Retencions practicades: ${fmt(f.retencions || 0)}`} />
                        {cassPensio > 0 && <FilaDetall label={tr('cotitzacionsCassBrancaSalut')} valor={fmt(-cassPensio)} negatiu />}
                        {cassPensio > 0 && <FilaDetall label={tr('rendaNetaPensioCass')} valor={fmt(importGravat - cassPensio)} negrita
                          nota={`Retencions practicades: ${fmt(f.retencions || 0)}`} />}
                      </React.Fragment>
                    );
                  }

                  if (f.tipus === 'PENSIO_CLASSES_PASSIVES') {
                    const a = brut;
                    const b = f.b || 0; const c = f.c || 0;
                    const d = f.d || 0; const dPrima = f.dPrima || 0;
                    const e = b > 0 ? Math.min(Math.max(0, a * ((b - c) - (d - dPrima)) / b), a) : 0;
                    return (
                      <React.Fragment key={i}>
                        <FilaDetall label={trp('fontClassesPassivesNum', { n: i + 1 })} valor={fmt(a)} nota={tr('notaRendaIntegraAnual')} />
                        <FilaDetall label={tr('partExemptFins2014')} valor={fmt(-(a - e))} negatiu
                          nota={`b=${fmt(b)} · c=${fmt(c)} · d=${fmt(d)} · d'=${fmt(dPrima)}${b === c ? tr('bcTotExempt') : ''}`} />
                        <FilaDetall label={tr('importGravatE')} valor={fmt(e)} negrita
                          nota={`Retencions practicades: ${fmt(f.retencions || 0)}`} />
                      </React.Fragment>
                    );
                  }

                  const aplicaDespeses3pct = !TIPUS_SENSE_3PCT.includes(f.tipus);
                  const desp3pctFont = aplicaDespeses3pct && totalGravat3pct > 0
                    ? altresDespesesTotal * (brut / totalGravat3pct)
                    : 0;
                  const rendaNeta = brut - (f.cotitzacionsCASS || 0) - desp3pctFont;
                  return (
                    <React.Fragment key={i}>
                      <FilaDetall label={`Font ${i + 1}: ${TIPUS_LABEL[f.tipus] || f.tipus || 'Treball'}`} valor={fmt(brut)} nota={tr('ingressosBrutsNota')} />
                      {(f.cotitzacionsCASS || 0) > 0 && <FilaDetall label={tr('cotitzacionsCass')} valor={fmt(-(f.cotitzacionsCASS || 0))} negatiu />}
                      {aplicaDespeses3pct && desp3pctFont > 0 && <FilaDetall label={tr('altresDespeses3pctLabel')} valor={fmt(-desp3pctFont)} negatiu nota={trp('notaBase3pct', { base: fmt(totalGravat3pct) })} />}
                      {!aplicaDespeses3pct && <FilaDetall label={tr('altresDespeses3pctNoAplica')} valor={tr('noAplica2')} nota={`Art. 13.2.b Llei 5/2014 — el tipus '${f.tipus}' està exclòs de la deducció del 3%`} />}
                      <FilaDetall label={tr('rendaNetaFont')} valor={fmt(rendaNeta)} negrita
                        nota={`Retencions practicades: ${fmt(f.retencions || 0)}`} />
                    </React.Fragment>
                  );
                  });
                })()}
                {/* Bloc de totals de les rendes del treball */}
                {(dades.rendesTreball || []).length > 0 && (() => {
                  const TIPUS_SENSE_3PCT = ['PENSIO_CASS', 'PENSIO_CLASSES_PASSIVES', 'PENSIO_PRIVADA', 'DIETES', 'INDEMNITZACIO_ACOMIADAMENT', 'BECA', 'PREMI'];
                  const totalBrut = (dades.rendesTreball || []).reduce((s, f) => s + (f.importBrut || 0), 0);
                  const totalCASS = (dades.rendesTreball || []).reduce((s, f) => s + (f.cotitzacionsCASS || 0), 0);
                  const totalGravat3pct = (dades.rendesTreball || []).reduce((s, f) => {
                    if (TIPUS_SENSE_3PCT.includes(f.tipus)) return s;
                    return s + (f.importBrut || 0);
                  }, 0);
                  const altresDespesesTotal = Math.min(totalGravat3pct * 0.03, 2500);
                  return (
                    <div style={{ marginTop: '8px', borderTop: `2px solid ${CAP.color}`, paddingTop: '6px' }}>
                      <FilaDetall label={tr('totalIngressosBruts')} valor={fmt(totalBrut)} negrita />
                      {totalCASS > 0 && <FilaDetall label={tr('totalCotitzacionsCass')} valor={fmt(-totalCASS)} negatiu />}
                      {altresDespesesTotal > 0 && <FilaDetall label={tr('totalAltresDespeses3pct')} valor={fmt(-altresDespesesTotal)} negatiu nota={trp('aplicatSobreRendesOrd', { base: fmt(totalGravat3pct) })} />}
                      <FilaDetall label={tr('rendaNetaTreballCasella300B')} valor={fmt(r.rendaTreball)} negrita destacat nota={tr('notaIntegraBTG')} />
                    </div>
                  );
                })()}
                <NotaNormativa refText={tr('refArt12')} text={tr('citaArt12')} />
              </SeccioBlocNormatiu>
            )}

            {/* Activitats econòmiques */}
            {tensActivitats && !blocsExclosos.activitats && (
              <SeccioBlocNormatiu titol={`2. ${tr('activitatsEconomiques')}`}>
                <FilaDetall label={tr('rendaNetaActivitatsLabel')} valor={fmt(r.rendaActivitat)} negrita destacat
                  nota={tr('notaActivitatsArt14_19')} />
                {(dades.activitats || []).map((a, i) => {
                  const ingressos = a.columnes
                    ? a.columnes.reduce((s, col) => s + (col.xifraNegocios || 0) + (col.ingressosFinancers || 0) + (col.altresIngressos || 0), 0)
                    : (a.ingressos || 0);
                  const despeses = a.columnes
                    ? a.columnes.reduce((s, col) => s + (col.consumMercaderies || 0) + (col.despesesPersonal || 0) +
                        (col.amortitzacions || 0) + (col.arrendamentsCànons || 0) + (col.reparacionsConservacio || 0) +
                        (col.subministraments || 0) + (col.tributsDeduibles || 0) + (col.serveisExteriors || 0) +
                        (col.despesesFinanceres || 0) + (col.altresDespeses || 0), 0)
                    : (a.despeses || 0);
                  const radicacio = a.impostRadicacio || 0;
                  const rendaNeta = ingressos - despeses - radicacio;
                  return (
                    <React.Fragment key={i}>
                      <FilaDetall label={`${trp('activitatNum', { n: i + 1 })}${a.descripcio ? `: ${a.descripcio}` : ''}${a.tipusActivitat ? ` (${a.tipusActivitat})` : ''}`} valor={fmt(ingressos)} nota={tr('totalIngressosNota')} />
                      {a.columnes ? a.columnes.map((col, ci) => {
                        const despExplotacio = (col.consumMercaderies || 0) + (col.arrendamentsCànons || 0) +
                          (col.reparacionsConservacio || 0) + (col.subministraments || 0) +
                          (col.tributsDeduibles || 0) + (col.serveisExteriors || 0);
                        return (
                          <React.Fragment key={ci}>
                            {(col.despesesPersonal || 0) > 0 && <FilaDetall label={tr('despesesPersonal')} valor={fmt(-(col.despesesPersonal || 0))} negatiu />}
                            {despExplotacio > 0 && <FilaDetall label={tr('despesesExplotacio')} valor={fmt(-despExplotacio)} negatiu />}
                            {(col.despesesFinanceres || 0) > 0 && <FilaDetall label={tr('despesesFinanceres')} valor={fmt(-(col.despesesFinanceres || 0))} negatiu />}
                            {(col.amortitzacions || 0) > 0 && <FilaDetall label={tr('amortitzacions')} valor={fmt(-(col.amortitzacions || 0))} negatiu />}
                            {(col.altresDespeses || 0) > 0 && <FilaDetall label={tr('altresDespeses')} valor={fmt(-(col.altresDespeses || 0))} negatiu />}
                          </React.Fragment>
                        );
                      }) : (
                        <FilaDetall label={tr('despesesDeduibles')} valor={fmt(-despeses)} negatiu />
                      )}
                      {radicacio > 0 && <FilaDetall label={tr('impostRadicacio')} valor={fmt(-radicacio)} negatiu />}
                      <FilaDetall label={tr('rendaNetaActivitat')} valor={fmt(rendaNeta)} negrita
                        nota={trp('metodeDeterminacioP', { metode: a.tipusDeterminacio === 'directa' ? tr('metodeDirecta') : tr('metodeObjectiva') })} />
                    </React.Fragment>
                  );
                })}
                <NotaNormativa refText={tr('refArt14')} text={tr('citaArt14')} />
              </SeccioBlocNormatiu>
            )}

            {/* Capital immobiliari */}
            {tensImmobles && !blocsExclosos.immobiliari && (
              <SeccioBlocNormatiu titol={`3. ${tr('capitalImmobiliari')}`}>
                <FilaDetall label={tr('rendaNetaCapitalImmobiliariLabel')} valor={fmt(r.rendaImmobiliaria)} negrita destacat
                  nota={tr('notaArt2022Immobiliari')} />
                {(dades.immobles || []).map((im, i) => {
                  const pctForfet = im.esHabitatgeAssequible ? 0.50 : 0.40;
                  const despesesForfet = (im.ingressosIntegres || 0) * pctForfet;
                  const despesesDirecta = (im.despesaReparacio || 0) + (im.despesaFinancera || 0) +
                    (im.serveisPrestatsTercers || 0) + (im.amortitzacio || 0) +
                    (im.tributs || 0) + (im.asseguranca || 0) +
                    (im.comunitat || 0) + (im.altresDespeses || 0);
                  const reduccioHab = im.aplicarReduccioHabitatge ? (im.reduccioHabitatge || 0) : 0;
                  const esForfet = im.tipusDeterminacio === 'forfetaria';
                  const despeses = esForfet ? despesesForfet : despesesDirecta;
                  const rendaNeta = (im.ingressosIntegres || 0) - despeses - (esForfet ? 0 : reduccioHab);
                  return (
                    <React.Fragment key={i}>
                      <FilaDetall label={`${trp('immobleNum', { n: i + 1 })}: ${im.descripcio || ''}`} valor={fmt(im.ingressosIntegres || 0)} nota={tr('ingressosIntegresNota')} />
                      {esForfet
                        ? <FilaDetall label={trp('reduccioForfetariaP', { pct: Math.round(pctForfet * 100) })} valor={fmt(-despesesForfet)} negatiu nota={tr('metodeForfetariNota')} />
                        : <FilaDetall label={tr('despesesDeduibles')} valor={fmt(-despesesDirecta)} negatiu />
                      }
                      {!esForfet && reduccioHab > 0 && <FilaDetall label={tr('reduccioHabitatgeLabel')} valor={fmt(-reduccioHab)} negatiu />}
                      <FilaDetall label={tr('rendaNetaImmobleLabel')} valor={fmt(rendaNeta)} negrita />
                      {(im.impostComunal || 0) > 0 && <FilaDetall label={tr('impostComunalLabel')} valor={fmt(im.impostComunal || 0)} nota={tr('notaImpostComunalArt47')} />}
                    </React.Fragment>
                  );
                })}
                <NotaNormativa refText={tr('refArt2022Immobiliari')} text={tr('citaArt2022Immobiliari')} />
              </SeccioBlocNormatiu>
            )}

            {/* Capital mobiliari */}
            {tensMobiliaris && !blocsExclosos.mobiliari && (
              <SeccioBlocNormatiu titol={`4. ${tr('capitalMobiliari')}`}>
                <FilaDetall label={tr('rendaNetaCapitalMobiliariLabel')} valor={fmt(r.rendaMobiliaria)} negrita destacat
                  nota={tr('notaArt2329Mobiliari')} />
                {(dades.mobiliaris || []).map((ent, i) => (
                  <React.Fragment key={i}>
                    <FilaDetall label={`${trp('entitatNum', { n: i + 1 })}: ${ent.entitat || ''}`} valor={null} negrita />
                    {(ent.partides || []).map((p, j) => (
                      <React.Fragment key={j}>
                        <FilaDetall label={`  ${({ a: tr('mobiliariA'), b: tr('mobiliariB'), c: tr('mobiliariC'), d: tr('mobiliariD') })[p.tipus] || p.tipusRenda || 'Renda'}`} valor={fmt(p.importBrut || 0)} nota={trp('apartat300D', { ap: (p.tipus || '?').toUpperCase() })} />
                        {(p.despeses || 0) > 0 && <FilaDetall label={tr('despesesCustodiaGestioLabel')} valor={fmt(-(p.despeses || 0))} negatiu />}
                        {(p.retencioAndorra || 0) > 0 && <FilaDetall label={tr('retencioAndorraLabel')} valor={fmt(p.retencioAndorra || 0)} nota={tr('deduibleQuotaNota')} />}
                        {(p.retencioEstranger || 0) > 0 && <FilaDetall label={tr('retencioEstrangerLabel')} valor={fmt(p.retencioEstranger || 0)} nota={tr('baseCalculDdiNota')} />}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
                <NotaNormativa refText={tr('refArt2329Mobiliari')} text={tr('citaArt2329Mobiliari')} />
              </SeccioBlocNormatiu>
            )}

            {/* Guanys de capital — Apartat 1 (sense transmissió) + Apartat 2 (transmissió) */}
            {(tensRendesSenseTransmissio || tensTransmissions) && !blocsExclosos.transmissions && (() => {
              const transGravades = (dades.transmissions || []).filter(t => !t.exempta && !t.esDevolucioCapital);
              const subtotalApt2 = transGravades.reduce((s, t) =>
                s + ((t.valorTransmissio || 0) - (t.despesesTransmissio || 0) - (t.valorAdquisicio || 0) - (t.despesesAdquisicio || 0)), 0);
              return (
              <SeccioBlocNormatiu titol={`5. ${tr('guanysCapital')}`}>

                {/* Apartat 1 — guanys/pèrdues no derivats de transmissió */}
                {tensRendesSenseTransmissio && (
                  <>
                    <FilaDetall label={tr('apartat1Label')} valor={null} negrita />
                    {(dades.rendesSenseTransmissio || []).map((rs, i) => (
                      <FilaDetall key={`s${i}`}
                        label={`  ${rs.descripcio || rs.tipusRenda || trp('rendaNum', { n: i + 1 })}${rs.data ? ` (${rs.data})` : ''}`}
                        valor={fmt(rs.resultat || 0)} negatiu={(rs.resultat || 0) < 0} />
                    ))}
                    <FilaDetall label={tr('subtotalApartat1Label')} valor={fmt(totalSenseTransmissio)} negrita />
                  </>
                )}

                {/* Apartat 2 — guanys/pèrdues derivats de transmissió */}
                {tensTransmissionsGravades && (
                  <>
                    <FilaDetall label={tr('apartat2Label')} valor={null} negrita />
                    {transGravades.map((t, i) => {
                      const guany = (t.valorTransmissio || 0) - (t.despesesTransmissio || 0) - (t.valorAdquisicio || 0) - (t.despesesAdquisicio || 0);
                      return (
                        <React.Fragment key={i}>
                          <FilaDetall label={`${trp('transmissioNum', { n: i + 1 })}: ${t.descripcio || ''} (${t.tipusElement || ''})`} valor={null} negrita />
                          <FilaDetall label={tr('valorTransmissioLabel')} valor={fmt(t.valorTransmissio || 0)} />
                          {(t.despesesTransmissio || 0) > 0 && <FilaDetall label={tr('despesesTransmissioLabel')} valor={fmt(-(t.despesesTransmissio || 0))} negatiu />}
                          <FilaDetall label={tr('valorAdquisicioLabel')} valor={fmt(-(t.valorAdquisicio || 0))} negatiu nota={trp('anyAdquisicio', { any: t.anyAdquisicio || '—' })} />
                          {(t.despesesAdquisicio || 0) > 0 && <FilaDetall label={tr('despesesAdquisicioLabel')} valor={fmt(-(t.despesesAdquisicio || 0))} negatiu />}
                          <FilaDetall label={tr('guanyPerduaLabel')} valor={fmt(guany)} negrita nota={trp('anyTransmissio', { any: t.anyTransmissio || '—' })} />
                        </React.Fragment>
                      );
                    })}
                    <FilaDetall label={tr('subtotalApartat2Label')} valor={fmt(subtotalApt2)} negrita />
                  </>
                )}

                {!tensTransmissionsGravades && tensTransmissions && (
                  <FilaDetall label={tr('apartat2CapTransmissioLabel')} valor="0,00 €"
                    nota={tr('notaTransmissionsExemptes')} />
                )}

                {/* Reconciliació final */}
                <div style={{ borderTop: `2px solid ${CAP.color}`, marginTop: '8px', paddingTop: '6px' }}>
                  <FilaDetall label={tr('totalGuanysPerduesLabel')} valor={fmt(r.guanysCapital)} negrita destacat
                    nota={tr('notaIntegraBte')} />
                </div>

                <NotaNormativa refText={tr('refArt30Guanys')} text={tr('citaArt30Guanys')} />
              </SeccioBlocNormatiu>
              );
            })()}

            {/* DDI — càlcul país per país (Art. 48.4) */}
            {tensDDI && r.ddiDetall && r.ddiDetall.length > 0 && !blocsExclosos.ddi && (
              <SeccioBlocNormatiu titol={`6. ${tr('ddi')}`}>
                <FilaDetall label={tr('totalDdiAplicadaLabel')} valor={fmt(r.ddiDetall.reduce((s, d) => s + (d.ddi || 0), 0))} negrita destacat />
                {r.ddiDetall.map((d, i) => {
                  const ret = d.retencioEfectiva ?? d.retencioOrigen ?? 0;
                  const topCDI = (d.tipusMaxCDI || 0) / 100 * (d.importBrut || 0);
                  return (
                    <React.Fragment key={i}>
                      <FilaDetall label={`${d.pais || '—'} — ${d.tipusRenda || ''}`} valor={fmt(d.ddi)} negrita />
                      <FilaDetall label={tr('rendaBrutaObtingudaLabel')} valor={fmt(d.importBrut || 0)} />
                      <FilaDetall label={tr('retencioEfectivaLabel')} valor={fmt(ret)} nota={d.tensCDI ? `CDI vigent — tipus màxim ${d.tipusMaxCDI || 0}%` : 'Sense CDI'} />
                      {d.tensCDI && ret > topCDI && (
                        <FilaDetall label={tr('excesNoComputableLabel')} valor={fmt(-(ret - (d.impostEtopat || 0)))} negatiu
                          nota={`Tipus màxim CDI: ${d.tipusMaxCDI || 0}% — excés reclamable en origen`} />
                      )}
                      <FilaDetall label={tr('limitQuotaAndorranaLabel')} valor={fmt(d.quotaAndorrana ?? d.quotaAndorra ?? 0)} />
                      <FilaDetall label={tr('ddiAplicadaMinimLabel')} valor={fmt(d.ddi)} destacat nota={d.explicacio} />
                    </React.Fragment>
                  );
                })}
                <NotaNormativa refText={tr('refArt484Ddi')} text={tr('citaArt484Ddi')} />
              </SeccioBlocNormatiu>
            )}
          </div>
          </td></tr></tbody>
          <tfoot><tr><td>
          <div style={{ padding: '10px 40px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ddd', fontSize: '9px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>{CAP.nomComercial || CAP.nom} · {trp('informeIRPFAny', { any: exercici })} · {clientNom || '—'}</span>
            <span>{tr('detallRendes')}</span>
          </div>
          </td></tr></tfoot>
         </table>
        </div>

        {/* ══ PÀGINA 3 — BASES I REDUCCIONS ══════════════════════════════ */}
        <div className="page-break">
         <table className="sec-table">
          <thead><tr><td>
            <CapcaleraDocument clientNom={clientNom} clientNRT={clientNRT} exercici={exercici} seccio={tr('basesReduccions')} cap={CAP} />
          </td></tr></thead>
          <tbody><tr><td>
          <div className="page-content" style={{ padding: '10px 30px 20px 30px' }}>

            <SeccioBlocNormatiu titol={tr('basesTributacioTitol')}>
              <FilaDetall label={tr('rendaTreballLabel')} valor={fmt(r.rendaTreball)} />
              <FilaDetall label={tr('rendaActivitatsLabel')} valor={fmt(r.rendaActivitat)} />
              <FilaDetall label={tr('rendaCapitalImmobiliariLabel')} valor={fmt(r.rendaImmobiliaria)} />
              <FilaDetall label={tr('baseTributacioGeneralLabel')} valor={fmt(r.baseTributacioGeneral)} negrita destacat nota={tr('notaBtgArt33')} />
              <div style={{ height: '8px' }} />
              <FilaDetall label={tr('rendaCapitalMobiliariLabel')} valor={fmt(r.rendaMobiliaria)} />
              <FilaDetall label={tr('guanysPerduesCapitalLabel')} valor={fmt(r.guanysCapital)} />
              <FilaDetall label={tr('baseTributacioEstalviLabel')} valor={fmt(r.baseTributacioEstalvi)} negrita destacat nota={tr('notaBteArt37')} />
              <NotaNormativa refText={tr('refArt3337')} text={tr('notaNormBasesTributacio')} />
            </SeccioBlocNormatiu>

            {dades.estatCivil === 'casat' && (
              <SeccioBlocNormatiu titol={tr('formulari300ATitol')}>
                <FilaDetall label={tr('estatCivilLabel')} valor={tr('casatParellaFetValor')} />
                <FilaDetall
                  label={tr('conjugeParellaFetLabel')}
                  valor={`${dades.conjugeNom || '—'}${dades.conjugeNRT ? ` (NRT: ${dades.conjugeNRT})` : ''}`}
                />
                <FilaDetall
                  label={tr('rendesGeneralsConjugeLabel')}
                  valor={fmt(dades.conjugeRendesGenerals || 0)}
                  nota={
                    dades.conjugePercepRendes === false
                      ? tr('conjugeNoRendes')
                      : (dades.conjugeRendesInf24k === false || (dades.conjugeRendesGenerals || 0) >= 24000)
                      ? tr('conjugeMes24k')
                      : trp('conjugeMenys24kP', { imp: fmt(Math.max(24000, 40000 - (dades.conjugeRendesGenerals || 0))) })
                  }
                />
              </SeccioBlocNormatiu>
            )}

            <SeccioBlocNormatiu titol={tr('minimPersonalReduccionsTitol')}>
              <FilaDetall label={tr('minimPersonalExemptLabel')} valor={`− ${fmt(r.minimPersonal)}`} nota={`Art. 35.1 Llei 5/2014 · ${dades.estatCivil === 'casat' ? dades.conjugePercepRendes === false ? tr('mpCasatNoRendes') : dades.conjugeRendesInf24k === false ? tr('mpCasatMes24k') : trp('mpCasatMenys24kP', { imp: fmt(dades.conjugeRendesGenerals) }) : tr('mpSolter')} · ${dades.obligatDiscapacitat ? tr('mpDiscapacitat') : tr('mpSenseDiscapacitat')}`} />
              {r.redFamiliar > 0 && <FilaDetall label={tr('reduccioCarreguesFamiliarsLabel')} valor={`− ${fmt(r.redFamiliar)}`} nota={tr('notaCarreguesFamiliarsArt352')} />}
              {r.redHabitatge > 0 && <FilaDetall label={tr('reduccioHabitatgeLabel2')} valor={`− ${fmt(r.redHabitatge)}`} nota={tr('notaHabitatgeArt38')} />}
              {r.redPensions > 0 && <FilaDetall label={tr('reduccioPlansPensionsLabel')} valor={`− ${fmt(r.redPensions)}`} nota={tr('notaPensionsArt39')} />}
              <FilaDetall label={tr('totalReduccionsLabel')} valor={`− ${fmt(r.totalReduccions)}`} negrita />
              <NotaNormativa refText={tr('refArt3539')} text={tr('notaNormMinimPersonal')} />
            </SeccioBlocNormatiu>

            <SeccioBlocNormatiu titol={tr('basesLiquidacioTitol')}>
              {/* Base general */}
              <FilaDetall label={tr('baseTributacioGeneralLabel')} valor={fmt(r.baseTributacioGeneral)} />
              <FilaDetall label={tr('reduccionsDesglossLabel')} valor={`− ${fmt(r.totalReduccions)}`} nota={tr('refArt3539')} />
              <FilaDetall label={tr('baseLiquidacioGeneralLabel')} valor={fmt(r.baseLiquidacioGeneral)} negrita destacat nota={tr('notaNoNegativa')} />
              <div style={{ height: '10px' }} />
              {/* Base estalvi */}
              <FilaDetall label={tr('baseTributacioEstalviLabel')} valor={fmt(r.baseTributacioEstalvi)} />
              <FilaDetall label={tr('minimExemptEstalviLabel')} valor={`− ${fmt(Math.min(3000, Math.max(0, r.baseTributacioEstalvi)))}`} nota={tr('notaMinimEstalviArt37')} />
              <FilaDetall label={tr('baseLiquidacioEstalviLabel')} valor={fmt(r.baseLiquidacioEstalvi)} negrita destacat nota={tr('notaNoNegativa')} />
              <NotaNormativa refText={tr('refArt3339')} text={tr('notaNormBasesLiquidacio')} />
            </SeccioBlocNormatiu>

            <SeccioBlocNormatiu titol={tr('quotaTributacioBonificacioTitol')}>
              <FilaDetall label={tr('quotaTributacioLabel')} valor={fmt(r.quotaTributacio)} nota={tr('notaQuotaArt4142')} />
              <FilaDetall label={tr('bonificacioArt46Label')} valor={`− ${fmt(r.bonificacio)}`} nota={tr('notaBonificacioArt46')} />
              <FilaDetall label={tr('quotaLiquidacioLabel')} valor={fmt(r.quotaLiquidacio)} negrita destacat />
              <NotaNormativa refText={tr('refArt4146')} text={tr('notaNormQuotaBonificacio')} />
            </SeccioBlocNormatiu>

          </div>
          </td></tr></tbody>
          <tfoot><tr><td>
          <div style={{ padding: '10px 40px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ddd', fontSize: '9px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>{CAP.nomComercial || CAP.nom} · {trp('informeIRPFAny', { any: exercici })} · {clientNom || '—'}</span>
            <span>{tr('basesReduccions')}</span>
          </div>
          </td></tr></tfoot>
         </table>
        </div>

        {/* ══ PÀGINA 300-F — BASES NEGATIVES I DEDUCCIONS (condicional) ══ */}
        {(() => {
          const d8 = dades.deduccionsExercici || {};

          // Importos generats per cada partida de deducció
          const impostComunalGenerat = (dades.immobles || []).reduce((a, im) => a + (im.impostComunal || 0), 0)
                                     + (dades.activitats || []).reduce((a, act) => a + (act.impostRadicacio || 0), 0);
          const ddiGenerat    = r.ddiCalculat || 0;
          const mecenGen      = (d8.donatiu20 || 0) * 0.20 + Math.min(d8.donatiu90 || 0, 100) * 0.90;
          const projGen       = (d8.aportacionsProjectes || 0) * 0.75;
          const digGen        = (d8.inversionsDigital || 0) * 0.02;
          const patGen        = (d8.despesesPatrocini || 0) * 0.10;
          const incNI = Math.max(0,(d8.plantillaNIActual||0)-(d8.plantillaNIAnterior||0));
          const incIN = Math.max(0,(d8.plantillaINActual||0)-(d8.plantillaINAnterior||0));
          const incIE = Math.max(0,(d8.plantillaIEActual||0)-(d8.plantillaIEAnterior||0));
          const llocsGen      = incNI * 1000 + incIN * 3500 + incIE * 3500;

          const hiHaBasesNeg  = (dades.basesNegGenerals || []).length > 0 || (dades.basesNegEstalvi || []).length > 0;
          const hiHaDedAnts   = (dades.deduccionsAnteriors || []).length > 0;
          const hiHaDedExerc  = impostComunalGenerat > 0 || ddiGenerat > 0 || mecenGen > 0 ||
                                projGen > 0 || digGen > 0 || patGen > 0 || llocsGen > 0;

          if (!hiHaBasesNeg && !hiHaDedAnts && !hiHaDedExerc) return null;

          // Helper: mostra Generades / Aplicades / Pendents + venciment per a una partida
          const deduccioRows = (key, titol, ref, generades, aplicades, anysVig, noDiferable = false, anyGeneracio = null) => {
            if (!generades || generades <= 0) return null;
            const pendents = Math.max(0, generades - aplicades);
            const anyBase = anyGeneracio || exercici;
            const notaPendent = pendents > 0
              ? (noDiferable
                ? "Import no diferible — s'extingeix si la quota és insuficient"
                : trp('notaDiferibleP', { any: anyBase + anysVig, gen: anyBase, anys: anysVig, ref }))
              : 'Totalment aplicada en l\'exercici';
            return (
              <React.Fragment key={key}>
                <FilaDetall label={`${titol} (${ref})`} valor={null} negrita />
                <FilaDetall label={tr('labelDeduccioGenerada')} valor={fmt(generades)} />
                <FilaDetall label={`    Aplicada en ${exercici}`} valor={fmt(-aplicades)} negatiu={aplicades > 0} />
                <FilaDetall label={tr('labelPendentDeDiferir')} valor={fmt(pendents)} negrita={pendents > 0} nota={notaPendent} />
              </React.Fragment>
            );
          };

          return (
            <div className="page-break">
             <table className="sec-table">
              <thead><tr><td>
                <CapcaleraDocument clientNom={clientNom} clientNRT={clientNRT} exercici={exercici} seccio={tr('seccioFormulari300F')} cap={CAP} />
              </td></tr></thead>
              <tbody><tr><td>
              <div className="page-content" style={{ padding: '10px 30px 20px 30px' }}>

                {/* Bases negatives generals */}
                {(dades.basesNegGenerals || []).length > 0 && (
                  <SeccioBlocNormatiu titol={tr('titolBasesNegGenerals')}>
                    {(dades.basesNegGenerals || []).map((f, i) => (
                      <React.Fragment key={i}>
                        <FilaDetall label={trp('exerciciPendentInici', { any: f.exercici })} valor={fmt(f.pendentInici || 0)} />
                        <FilaDetall label={trp('aplicatEnExercici', { any: exercici })} valor={fmt(-(f.aplicat || 0))} negatiu={f.aplicat > 0} />
                        <FilaDetall label={tr('labelPendentExercicisFuturs')} valor={fmt(Math.max(0, (f.pendentInici||0)-(f.aplicat||0)))} negrita={Math.max(0,(f.pendentInici||0)-(f.aplicat||0)) > 0} nota={Math.max(0,(f.pendentInici||0)-(f.aplicat||0)) > 0 ? trp('vencimentExercici', { any: f.exercici + 10 }) : undefined} />
                      </React.Fragment>
                    ))}
                    <FilaDetall label={tr('labelTotalAplicatExercici')} valor={fmt(-(dades.basesNegGenerals||[]).reduce((a,f)=>a+(f.aplicat||0),0))} negrita destacat negatiu />
                    <NotaNormativa refText={tr('refArt33Llei')} text={tr('textBasesNegGeneralsCompensacio')} />
                  </SeccioBlocNormatiu>
                )}

                {/* Bases negatives estalvi */}
                {(dades.basesNegEstalvi || []).length > 0 && (
                  <SeccioBlocNormatiu titol={tr('titolBasesNegEstalvi')}>
                    {(dades.basesNegEstalvi || []).map((f, i) => (
                      <React.Fragment key={i}>
                        <FilaDetall label={trp('exerciciPendentInici', { any: f.exercici })} valor={fmt(f.pendentInici || 0)} />
                        <FilaDetall label={trp('aplicatEnExercici', { any: exercici })} valor={fmt(-(f.aplicat || 0))} negatiu={f.aplicat > 0} />
                        <FilaDetall label={tr('labelPendentExercicisFuturs')} valor={fmt(Math.max(0,(f.pendentInici||0)-(f.aplicat||0)))} negrita={Math.max(0,(f.pendentInici||0)-(f.aplicat||0)) > 0} nota={Math.max(0,(f.pendentInici||0)-(f.aplicat||0)) > 0 ? trp('vencimentExercici', { any: f.exercici + 10 }) : undefined} />
                      </React.Fragment>
                    ))}
                    <FilaDetall label={tr('labelTotalAplicatExercici')} valor={fmt(-(dades.basesNegEstalvi||[]).reduce((a,f)=>a+(f.aplicat||0),0))} negrita destacat negatiu />
                    <NotaNormativa refText={tr('refArt37Llei')} text={tr('textBasesNegEstalviCompensacio')} />
                  </SeccioBlocNormatiu>
                )}

                {/* Deduccions pendents exercicis anteriors */}
                {(dades.deduccionsAnteriors || []).length > 0 && (
                  <SeccioBlocNormatiu titol={tr('titolDeduccionsPendentsAnteriors')}>
                    {(dades.deduccionsAnteriors || []).map((ded, i) =>
                      deduccioRows(
                        `ded-ant-${i}`,
                        ded.descripcio || `Deducció exercici ${ded.exercici}`,
                        ded.ref || 'Art. 43',
                        ded.pendentInici || 0,
                        ded.aplicat || 0,
                        ded.anysVig || 5,
                        false,
                        ded.exercici || (exercici - 1)
                      )
                    )}
                    <FilaDetall label={tr('labelTotalDeduccionsAnteriorsAplicades')} valor={fmt(-r.deduccionsAnteriorsAplicades)} negrita destacat negatiu />
                  </SeccioBlocNormatiu>
                )}

                {/* Deduccions generades en l'exercici — detall per partida */}
                {hiHaDedExerc && (
                  <SeccioBlocNormatiu titol={trp('deduccionsGeneradesTitolP', { any: exercici })}>
                    {deduccioRows('comunal', "Impost comunal arrendaments i radicació", 'Art. 43 bis', impostComunalGenerat, r.deduccioImpostComunal || 0, 6, false)}
                    {deduccioRows('ddi', "Deducció per Doble Imposició Internacional", 'Art. 48', ddiGenerat, r.ddi || 0, 10)}
                    {deduccioRows('mecen', "Mecenatge i donacions", 'Art. 43 bis', mecenGen, d8.aplicatMecenatge || 0, 5)}
                    {deduccioRows('proj', "Projectes d'interès nacional", 'Art. 44', projGen, d8.aplicatProjectes || 0, 5)}
                    {deduccioRows('dig', "Inversions en digitalització", 'Art. 44 bis', digGen, d8.aplicatDigital || 0, 5)}
                    {deduccioRows('pat', "Patrocini esportiu i cultural", 'Art. 44 ter', patGen, d8.aplicatPatrocini || 0, 5)}
                    {deduccioRows('llocs', "Creació de llocs de treball", 'Art. 44 quater', llocsGen, d8.aplicatLlocs || 0, 5)}
                    <FilaDetall label={tr('labelTotalDeduccionsAplicadesQuota')} valor={fmt(-r.totalDeduccionsExercici)} negrita destacat negatiu />
                    <NotaNormativa refText={tr('refArts43Bis48Llei')} text={`Deduccions pendents diferibles fins a exercici ${exercici + 5} (general) o ${exercici + 10} (DDI). L'impost comunal (Art. 47) no és diferible: la part que excedeixi la quota s'extingeix.`} />
                  </SeccioBlocNormatiu>
                )}

              </div>
              </td></tr></tbody>
              <tfoot><tr><td>
              <div style={{ padding: '10px 40px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ddd', fontSize: '9px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
                <span>{CAP.nomComercial || CAP.nom} · {trp('informeIRPFAny', { any: exercici })} · {clientNom || '—'}</span>
                <span>{tr('peuFormulari300F')}</span>
              </div>
              </td></tr></tfoot>
             </table>
            </div>
          );
        })()}

        {/* ══ PÀGINA 4 — LIQUIDACIÓ FINAL 300-L (INDEPENDENT) ════════════ */}
        <div className="page-break">
         <table className="sec-table">
          <thead><tr><td>
            <CapcaleraDocument clientNom={clientNom} clientNRT={clientNRT} exercici={exercici} seccio={tr('liquidacio')} cap={CAP} />
          </td></tr></thead>
          <tbody><tr><td>
          <div className="page-content" style={{ padding: '10px 15px 15px 15px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: CAP.colorFosc, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', borderBottom: `2px solid ${CAP.color}`, paddingBottom: '6px' }}>
              {trp('titol300LExercici', { any: exercici })}
            </div>

            {/* Taula 300-L */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: CAP.color, color: 'white' }}>
                  <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: '600', width: '70px' }}>Casella</th>
                  <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: '600' }}>Descripció</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '600', width: '120px' }}>Import</th>
                </tr>
              </thead>
              <tbody>
                {caselles.map((c, i) => (
                  <tr key={i} style={{
                    backgroundColor: c.destacat ? CAP.colorClar : i % 2 === 0 ? '#fafafa' : 'white',
                    borderBottom: '1px solid #eee'
                  }}>
                    <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: '9px', color: '#666', fontWeight: c.destacat ? '700' : '400' }}>
                      {c.casella}
                    </td>
                    <td style={{ padding: '4px 8px', fontWeight: c.destacat ? '700' : '400', color: c.destacat ? CAP.colorFosc : '#333' }}>
                      {c.descripcio}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: c.destacat ? '700' : '500', color: c.destacat ? CAP.color : typeof c.valor === 'number' && c.valor < 0 ? '#c0392b' : '#333' }}>
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
              borderRadius: '8px', padding: '10px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '8px'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resultat de la declaració</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: r.resultatDeclaracio > 0 ? '#c0392b' : r.resultatDeclaracio < 0 ? '#27ae60' : '#555', fontFamily: 'monospace' }}>
                  {fmt(Math.abs(r.resultatDeclaracio))}
                </div>
                <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                  Tipus efectiu: <strong>{fmtPct(r.tipusEfectiu)}</strong>
                  {' · '}Quota final: <strong>{fmt(r.quotaFinal)}</strong>
                  {' · '}Retencions: <strong>{fmt(r.retencions)}</strong>
                  {(r.pagamentACompte || 0) > 0 && <>{' · '}Pag. fraccionat (320): <strong>{fmt(r.pagamentACompte)}</strong></>}
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
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: CAP.colorFosc, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                    backgroundColor: f.actiu ? CAP.colorClar : '#f5f5f5',
                    border: `1px solid ${f.actiu ? CAP.color : '#ddd'}`,
                    borderRadius: '4px', padding: '4px 8px',
                    fontSize: '9px', color: f.actiu ? CAP.colorFosc : '#aaa',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <span style={{ fontWeight: '700', fontFamily: 'monospace' }}>{f.codi}</span>
                    <span>{f.actiu ? '✓' : '○'} {f.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: CAP.colorClar, border: `1px solid ${CAP.colorBorde}`, borderRadius: '4px', padding: '4px 8px', marginTop: '6px', fontSize: '8px', color: CAP.colorFosc }}>
              <span style={{ fontWeight: '700' }}>📋 {tr('terminiPresentacio')}:</span> {trp('terminiPresentacioText', { any: exercici, anyseg: exercici + 1 })}
            </div>
          </div>
          </td></tr></tbody>
          <tfoot><tr><td>
          <div style={{ padding: '10px 40px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ddd', fontSize: '9px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>{CAP.nomComercial || CAP.nom} · {trp('informeIRPFAny', { any: exercici })} · {clientNom || '—'}</span>
            <span>{tr('liquidacio')}</span>
          </div>
          </td></tr></tfoot>
         </table>
        </div>

        {/* ══ PÀGINA 5b — RENDES EXEMPTES (Art. 5.k) I NO SUBJECTES (Art. 27.3) ══ */}
        {((tensTransmissionsExemptes && r.transmissionsExemptes && r.transmissionsExemptes.length > 0) || tensDevolucionsCapital) && (
          <div className="page-break">
           <table className="sec-table">
            <thead><tr><td>
              <CapcaleraDocument clientNom={clientNom} clientNRT={clientNRT} exercici={exercici} seccio={tr('seccioRendesExemptesNoSubjectes')} cap={CAP} />
            </td></tr></thead>
            <tbody><tr><td>
            <div className="page-content" style={{ padding: '10px 30px 20px 30px' }}>
              <SeccioBlocNormatiu titol={tr('titol5bRendesExemptes')}>

                {/* Subsecció A — Exemptes Art. 5.k */}
                {tensTransmissionsExemptes && r.transmissionsExemptes && r.transmissionsExemptes.length > 0 && (
                  <>
                    <FilaDetall label={tr('labelGuanysExemptsArt5k')} valor={null} negrita destacat />
                    {r.transmissionsExemptes.map((t, i) => (
                      <FilaDetall key={`ex${i}`}
                        label={`  ${t.descripcio || trp('transmissioNum', { n: i + 1 })} (${t.tipusElement || ''})`}
                        valor={fmt(t.importExempt || 0)}
                        nota={trp('exemptMotiu', { motiu: t.motivExempcio || 'Art. 5.k' })} />
                    ))}
                    <FilaDetall label={tr('labelTotalExemptArt5k')} valor={fmt(r.totalExempt)} negrita />
                  </>
                )}

                {/* Subsecció B — No subjectes Art. 27.3 */}
                {tensDevolucionsCapital && (
                  <>
                    <FilaDetall label={tr('labelDevolucionsCapitalArt273')} valor={null} negrita destacat />
                    {(dades.transmissions || []).filter(t => t.esDevolucioCapital).map((t, i) => (
                      <FilaDetall key={`dc${i}`}
                        label={`  ${t.descripcio || trp('devolucioNum', { n: i + 1 })} (${t.tipusElement || ''})`}
                        valor={fmt(t.valorTransmissio || 0)}
                        nota={tr('notaNoSubjectaArt273')} />
                    ))}
                  </>
                )}

                <NotaNormativa
                  refText={tr('refTextArt5kArt273')}
                  text={tr('textRendesNoIntegradesBase')}
                />
              </SeccioBlocNormatiu>
            </div>
            </td></tr></tbody>
            <tfoot><tr><td>
            <div style={{ padding: '10px 40px', backgroundColor: '#f0f0f0', borderTop: '1px solid #ddd', fontSize: '9px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
              <span>{CAP.nomComercial || CAP.nom} · {trp('informeIRPFAny', { any: exercici })} · {clientNom || '—'}</span>
              <span>{tr('peuRendesExemptes')}</span>
            </div>
            </td></tr></tfoot>
           </table>
          </div>
        )}

        {/* ══ ÚLTIMA PÀGINA — DISCLAIMERS I PEU LEGAL ════════════════════ */}
        <div className="page-break" style={{ minHeight: '297mm', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            background: `linear-gradient(135deg, ${CAP.colorFosc} 0%, ${CAP.color} 100%)`,
            padding: '30px 40px', color: 'white'
          }}>
            <div style={{ fontSize: '18px', fontWeight: '800' }}>{CAP.nomComercial || CAP.nom}</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>Informació legal i avisos importants</div>
          </div>

          <div className="page-content" style={{ flex: 1, paddingTop: '30px' }}>

            {/* Avís principal */}
            <div style={{ backgroundColor: '#fff8e1', border: '2px solid #f9a825', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#e65100', marginBottom: '8px' }}>⚠️ AVÍS IMPORTANT</div>
              <p style={{ fontSize: '10px', color: '#555', lineHeight: '1.6', margin: 0 }}>
                {esAmbit
                  ? `Aquest informe ha estat generat per l'Eina Fiscal IRPF d'ÀMBIT Associats a partir de les dades introduïdes per l'usuari.`
                  : `Aquest informe ha estat generat per ${CAP.nomComercial || CAP.nom} a partir de les dades introduïdes per l'usuari.`
                }
                {` El seu contingut té caràcter merament informatiu i orientatiu, i no constitueix ni substitueix en cap cas l'assessorament fiscal professional personalitzat. ${CAP.nomComercial || CAP.nom} no assumeix cap responsabilitat sobre les decisions preses en base a aquest informe sense una revisió professional prèvia.`}
              </p>
            </div>

            {[
              {
                titol: '1. Responsabilitat i limitació de responsabilitat',
                text: trp('disclaimerResponsabilitat', { nom: CAP.nomComercial || CAP.nom })
              },
              {
                titol: '2. Naturalesa de l\'informe',
                text: tr('disclaimerNaturalesa')
              },
              {
                titol: '3. Protecció de dades personals (Llei 29/2021)',
                text: trp('disclaimerProteccioDades', { email: CAP.email })
              },
              {
                titol: '4. Confidencialitat',
                text: tr('disclaimerConfidencialitat')
              },
              {
                titol: '5. Normativa de referència',
                text: `Llei 5/2014, del 24 d'abril, de l'impost sobre la renda de les persones físiques (IRPF) del Principat d'Andorra (BOPA núm. 30, del 30/04/2014). Modificació L2023005 (L2023005 BOPA). Modificació L2025005 (L2025005 BOPA). Reglament de l'IRPF, del 29/12/2023 (BOPA R20231229B i R20231229D). Guia pràctica IRPF 2025 del Ministeri de Finances del Govern d'Andorra.`
              }
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: '14px' }} className="avoid-break">
                <div style={{ fontSize: '10px', fontWeight: '700', color: CAP.colorFosc, marginBottom: '4px' }}>{item.titol}</div>
                <p style={{ fontSize: '9px', color: '#555', lineHeight: '1.6', margin: 0 }}>{item.text}</p>
              </div>
            ))}
          </div>

          {/* Peu legal final */}
          <div style={{
            backgroundColor: CAP.colorFosc, color: 'white',
            padding: '20px 40px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '9px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: '700', marginBottom: '4px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '8px' }}>Entitat</div>
                <div>{CAP.nom}</div>
                <div style={{ opacity: 0.75 }}>NRT: {CAP.nrt}</div>
              </div>
              <div>
                <div style={{ fontWeight: '700', marginBottom: '4px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '8px' }}>Adreça</div>
                <div>{CAP.adreca}</div>
                <div style={{ opacity: 0.75 }}>{CAP.poblacio}</div>
              </div>
              <div>
                <div style={{ fontWeight: '700', marginBottom: '4px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '8px' }}>Contacte</div>
                <div>{CAP.email}</div>
                <div style={{ opacity: 0.75 }}>{CAP.tel}{CAP.web ? ` · ${CAP.web}` : ''}</div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '10px', fontSize: '8px', opacity: 0.6, textAlign: 'center' }}>
              {trp('copyrightText', { year: new Date().getFullYear(), nom: CAP.nom, data: dataAvui() })}
            </div>
            {!esAmbit && (
              <div style={{ textAlign: 'center', fontSize: '7px', opacity: 0.4, color: 'white', paddingBottom: '4px' }}>
                Informe generat amb l'Eina Fiscal IRPF d'ÀMBIT Associats · DEL SOTO – PALEARI &amp; ASSOCIATS, S.L. · NRT L-720543-P · www.ambit.ad
              </div>
            )}
          </div>
        </div>

      </div>
      {/* FI INFORME PROFESSIONAL */}

    </div>
  );
};

export default Step9Liquidacio;
