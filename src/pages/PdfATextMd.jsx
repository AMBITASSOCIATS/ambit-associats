// pages/PdfATextMd.jsx — Eina pública: converteix un PDF en text (.md)
// Tot el processament es fa al navegador (pdf.js). Cap fitxer s'envia a cap servidor.
import React, { useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Worker servit localment des de public/ (NO CDN). Compatible amb Create React App.
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

const ACCENT = '#009B9C';
const ACCENT_DARK = '#007D7E';

const UI = {
  ca: {
    tornar: '← Tornar',
    titol: 'Converteix un PDF en text (.md)',
    subtitol: "Arrossega un PDF i descarrega't el text net, a punt per enganxar a Claude o qualsevol IA sense topar amb el límit de pàgines.",
    dropBig: 'Arrossega el PDF aquí',
    dropSmall: 'o',
    browse: "tria'l del teu ordinador",
    privacitat: "El fitxer es processa íntegrament al teu navegador. No s'envia a cap servidor.",
    avisEscaneig: "Sembla un PDF escanejat. Gairebé no s'hi ha trobat text: cal passar-li primer l'OCR (p. ex. amb l'Adobe Acrobat) i tornar a provar.",
    copia: 'Copia', copiat: 'Copiat ✓', descarrega: 'Descarrega .md',
    noEsPdf: 'Això no és un PDF. Tria un fitxer acabat en .pdf.',
    llegint: 'Llegint «{name}»…',
    errorObrir: "No s'ha pogut obrir el fitxer. Torna-ho a provar.",
    errorLlegir: "No s'ha pogut llegir el PDF. Pot estar protegit o malmès.",
    fet: "Fet. Revisa el text i descarrega'l.",
    fetPocText: 'Fet, però amb molt poc text.',
    noText: "(No s'ha trobat text.)",
    pagina: 'pàgina', pagines: 'pàgines', caracters: 'caràcters',
    avisosTitol: 'Avisos importants',
    avisos: [
      'La qualitat del text extret depèn directament de la qualitat del PDF original.',
      "Si el document és un escaneig, cal aplicar-li primer un OCR (p. ex. amb l'Adobe Acrobat). La fiabilitat del text dependrà de la qualitat d'aquest OCR.",
      "L'extracció és automàtica i pot contenir errors de lectura o ometre elements com taules, columnes, segells o formatació.",
      'Reviseu sempre el resultat —especialment noms, NRT/NIF, imports i dates— contrastant-lo amb el document original abans d\'utilitzar-lo.',
      'Aquesta eina és una ajuda i no substitueix la revisió professional del document.',
      "El tractament es fa al navegador: cap fitxer s'envia ni s'emmagatzema en servidors externs.",
    ],
    peu: 'Servei gratuït · ÀMBIT Associats',
  },
  es: {
    tornar: '← Volver',
    titol: 'Convierte un PDF en texto (.md)',
    subtitol: 'Arrastra un PDF y descárgate el texto limpio, listo para pegar en Claude o cualquier IA sin toparte con el límite de páginas.',
    dropBig: 'Arrastra el PDF aquí',
    dropSmall: 'o',
    browse: 'selecciónalo de tu ordenador',
    privacitat: 'El archivo se procesa íntegramente en tu navegador. No se envía a ningún servidor.',
    avisEscaneig: 'Parece un PDF escaneado. Casi no se ha encontrado texto: hay que pasarle primero el OCR (p. ej. con Adobe Acrobat) y volver a probar.',
    copia: 'Copiar', copiat: 'Copiado ✓', descarrega: 'Descargar .md',
    noEsPdf: 'Esto no es un PDF. Elige un archivo acabado en .pdf.',
    llegint: 'Leyendo «{name}»…',
    errorObrir: 'No se ha podido abrir el archivo. Inténtalo de nuevo.',
    errorLlegir: 'No se ha podido leer el PDF. Puede estar protegido o dañado.',
    fet: 'Hecho. Revisa el texto y descárgalo.',
    fetPocText: 'Hecho, pero con muy poco texto.',
    noText: '(No se ha encontrado texto.)',
    pagina: 'página', pagines: 'páginas', caracters: 'caracteres',
    avisosTitol: 'Avisos importantes',
    avisos: [
      'La calidad del texto extraído depende directamente de la calidad del PDF original.',
      'Si el documento es un escaneo, hay que aplicarle primero un OCR (p. ej. con Adobe Acrobat). La fiabilidad del texto dependerá de la calidad de ese OCR.',
      'La extracción es automática y puede contener errores de lectura u omitir elementos como tablas, columnas, sellos o formato.',
      'Revisad siempre el resultado —especialmente nombres, NRT/NIF, importes y fechas— contrastándolo con el documento original antes de utilizarlo.',
      'Esta herramienta es una ayuda y no sustituye la revisión profesional del documento.',
      'El tratamiento se hace en el navegador: ningún archivo se envía ni se almacena en servidores externos.',
    ],
    peu: 'Servicio gratuito · ÀMBIT Associats',
  },
  en: {
    tornar: '← Back',
    titol: 'Convert a PDF into text (.md)',
    subtitol: 'Drag a PDF and download clean text, ready to paste into Claude or any AI without hitting the page limit.',
    dropBig: 'Drag the PDF here',
    dropSmall: 'or',
    browse: 'pick it from your computer',
    privacitat: 'The file is processed entirely in your browser. It is not sent to any server.',
    avisEscaneig: 'This looks like a scanned PDF. Almost no text was found: you need to run OCR first (e.g. with Adobe Acrobat) and try again.',
    copia: 'Copy', copiat: 'Copied ✓', descarrega: 'Download .md',
    noEsPdf: 'This is not a PDF. Choose a file ending in .pdf.',
    llegint: 'Reading «{name}»…',
    errorObrir: 'The file could not be opened. Please try again.',
    errorLlegir: 'The PDF could not be read. It may be protected or damaged.',
    fet: 'Done. Review the text and download it.',
    fetPocText: 'Done, but with very little text.',
    noText: '(No text found.)',
    pagina: 'page', pagines: 'pages', caracters: 'characters',
    avisosTitol: 'Important notices',
    avisos: [
      'The quality of the extracted text depends directly on the quality of the original PDF.',
      'If the document is a scan, you must run OCR on it first (e.g. with Adobe Acrobat). Text reliability will depend on the quality of that OCR.',
      'Extraction is automatic and may contain reading errors or omit elements such as tables, columns, stamps or formatting.',
      'Always review the result —especially names, NRT/NIF, amounts and dates— against the original document before using it.',
      'This tool is an aid and does not replace professional review of the document.',
      'Processing happens in the browser: no file is sent to or stored on external servers.',
    ],
    peu: 'Free service · ÀMBIT Associats',
  },
  fr: {
    tornar: '← Retour',
    titol: 'Convertissez un PDF en texte (.md)',
    subtitol: "Glissez un PDF et téléchargez le texte propre, prêt à coller dans Claude ou n'importe quelle IA sans buter sur la limite de pages.",
    dropBig: 'Glissez le PDF ici',
    dropSmall: 'ou',
    browse: 'choisissez-le depuis votre ordinateur',
    privacitat: "Le fichier est traité entièrement dans votre navigateur. Il n'est envoyé à aucun serveur.",
    avisEscaneig: "Cela ressemble à un PDF scanné. Presque aucun texte n'a été trouvé : il faut d'abord lui appliquer l'OCR (p. ex. avec Adobe Acrobat) et réessayer.",
    copia: 'Copier', copiat: 'Copié ✓', descarrega: 'Télécharger .md',
    noEsPdf: "Ceci n'est pas un PDF. Choisissez un fichier terminant par .pdf.",
    llegint: 'Lecture de «{name}»…',
    errorObrir: "Le fichier n'a pas pu être ouvert. Veuillez réessayer.",
    errorLlegir: "Le PDF n'a pas pu être lu. Il est peut-être protégé ou endommagé.",
    fet: 'Terminé. Vérifiez le texte et téléchargez-le.',
    fetPocText: 'Terminé, mais avec très peu de texte.',
    noText: '(Aucun texte trouvé.)',
    pagina: 'page', pagines: 'pages', caracters: 'caractères',
    avisosTitol: 'Avis importants',
    avisos: [
      'La qualité du texte extrait dépend directement de la qualité du PDF original.',
      "Si le document est un scan, il faut d'abord lui appliquer un OCR (p. ex. avec Adobe Acrobat). La fiabilité du texte dépendra de la qualité de cet OCR.",
      "L'extraction est automatique et peut contenir des erreurs de lecture ou omettre des éléments tels que tableaux, colonnes, cachets ou mise en forme.",
      'Vérifiez toujours le résultat —surtout noms, NRT/NIF, montants et dates— en le comparant au document original avant de l\'utiliser.',
      "Cet outil est une aide et ne remplace pas la révision professionnelle du document.",
      "Le traitement se fait dans le navigateur : aucun fichier n'est envoyé ni stocké sur des serveurs externes.",
    ],
    peu: 'Service gratuit · ÀMBIT Associats',
  },
};

// Reconstrueix les línies d'una pàgina agrupant els items per posició vertical (igual que el prototip)
async function readPage(pdf, num) {
  const page = await pdf.getPage(num);
  const tc = await page.getTextContent();
  const items = [];
  for (const it of tc.items) {
    if (typeof it.str !== 'string' || it.str === '') continue;
    items.push({ x: it.transform[4], y: it.transform[5], s: it.str });
  }
  items.sort((a, b) => (Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x));
  const lines = [];
  let curY = null, cur = '';
  for (const node of items) {
    if (curY === null) { curY = node.y; cur = node.s; }
    else if (Math.abs(node.y - curY) > 3) { lines.push(cur); cur = node.s; curY = node.y; }
    else { const glue = (cur && !/\s$/.test(cur) && !/^\s/.test(node.s)) ? ' ' : ''; cur += glue + node.s; }
  }
  if (cur) lines.push(cur);
  return lines.join('\n').replace(/[ \t]+\n/g, '\n').trim();
}

const PdfATextMd = ({ onBack, language: langProp = 'ca' }) => {
  const [idiomaActiu, setIdiomaActiu] = useState(['ca', 'es', 'en', 'fr'].includes(langProp) ? langProp : 'ca');
  const t = UI[idiomaActiu];

  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState(null); // { msg, kind: 'work'|'err' }
  const [showNote, setShowNote] = useState(false);
  const [result, setResult] = useState(null); // { name, meta, md }
  const [copiat, setCopiat] = useState(false);
  const fileInputRef = useRef(null);
  const outRef = useRef(null);

  const finish = useCallback((md, name, pages, chars) => {
    const currentName = name.replace(/\.pdf$/i, '') + '.md';
    const metaTxt = pages + ' ' + (pages === 1 ? t.pagina : t.pagines) + ' · ' +
      chars.toLocaleString(idiomaActiu === 'en' ? 'en-US' : 'es-ES') + ' ' + t.caracters;
    setResult({ name: currentName, meta: metaTxt, md: md.length ? md : t.noText });
    if (chars < pages * 15) { setShowNote(true); setStatus({ msg: t.fetPocText, kind: 'work' }); }
    else { setShowNote(false); setStatus({ msg: t.fet, kind: 'work' }); }
  }, [t, idiomaActiu]);

  const convert = useCallback((buffer, name) => {
    pdfjsLib.getDocument({ data: buffer }).promise.then(async (pdf) => {
      const texts = [];
      for (let p = 1; p <= pdf.numPages; p++) texts.push(await readPage(pdf, p));
      const md = texts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
      finish(md, name, pdf.numPages, md.replace(/\s/g, '').length);
    }).catch((err) => {
      console.error(err);
      setStatus({ msg: t.errorLlegir, kind: 'err' });
    });
  }, [finish, t]);

  const handleFile = useCallback((file) => {
    setShowNote(false); setResult(null); setCopiat(false);
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) { setStatus({ msg: t.noEsPdf, kind: 'err' }); return; }
    setStatus({ msg: t.llegint.replace('{name}', file.name), kind: 'work' });
    const reader = new FileReader();
    reader.onload = () => convert(reader.result, file.name);
    reader.onerror = () => setStatus({ msg: t.errorObrir, kind: 'err' });
    reader.readAsArrayBuffer(file);
  }, [convert, t]);

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  };

  const copia = () => {
    if (!result) return;
    const done = () => { setCopiat(true); setTimeout(() => setCopiat(false), 1600); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(result.md).then(done, () => {});
    else if (outRef.current) { outRef.current.select(); try { document.execCommand('copy'); done(); } catch (e) {} }
  };

  const descarrega = () => {
    if (!result) return;
    const blob = new Blob([result.md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = result.name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="bg-[#F2F7F7] min-h-screen">
      {/* Barra superior amb botó tornar */}
      {onBack && (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
            <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-700 transition">
              {t.tornar}
            </button>
          </div>
        </div>
      )}

      {/* Hero institucional */}
      <div style={{ backgroundColor: ACCENT }} className="w-full py-12 px-6 text-center">
        <div className="flex justify-center mb-5">
          <img src="/ÀMBIT Associats.png" alt="ÀMBIT Associats" className="h-14 w-auto" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 max-w-2xl mx-auto">{t.titol}</h1>
        <p className="text-white/85 text-sm max-w-xl mx-auto mb-6 leading-relaxed">{t.subtitol}</p>
        <div className="flex justify-center gap-2">
          {['ca', 'es', 'en', 'fr'].map((lang) => (
            <button
              key={lang}
              onClick={() => setIdiomaActiu(lang)}
              className={`px-3 py-1 text-xs font-medium rounded border transition ${
                idiomaActiu === lang ? 'bg-white border-white' : 'bg-transparent text-white border-white/40 hover:bg-white/10'
              }`}
              style={idiomaActiu === lang ? { color: ACCENT_DARK } : undefined}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Cos */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label={t.dropBig}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
          onDrop={onDrop}
          className="rounded-2xl bg-white text-center cursor-pointer transition px-6 py-12 outline-none"
          style={{
            border: `2px dashed ${drag ? ACCENT : '#BFD9D9'}`,
            backgroundColor: drag ? '#E0F3F3' : '#FFFFFF',
          }}
        >
          <svg className="mx-auto mb-4" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          <p className="text-lg font-semibold text-gray-800 mb-1">{t.dropBig}</p>
          <p className="text-sm text-gray-500">
            {t.dropSmall} <span className="underline" style={{ color: ACCENT }}>{t.browse}</span>
          </p>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" hidden
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        </div>

        {/* Privacitat */}
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F7A57" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>{t.privacitat}</span>
        </div>

        {/* Estat */}
        {status && (
          <p className="mt-4 text-sm text-center" style={{ color: status.kind === 'err' ? '#B23A3A' : ACCENT_DARK }}>
            {status.msg}
          </p>
        )}

        {/* Avís d'escaneig */}
        {showNote && (
          <div className="mt-4 flex items-start gap-3 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: '#FBF3E2', border: '1px solid #EAD9AE', borderLeft: '4px solid #9A6B12', color: '#5E4708' }}>
            <svg width="18" height="18" className="flex-none mt-0.5" viewBox="0 0 24 24" fill="none" stroke="#9A6B12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>{t.avisEscaneig}</span>
          </div>
        )}

        {/* Resultat */}
        {result && (
          <div className="mt-7">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm text-gray-800 truncate">{result.name}</div>
                <div className="text-xs text-gray-500">{result.meta}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={copia} className="text-sm font-semibold rounded-lg px-4 py-2 bg-white transition"
                  style={{ color: ACCENT_DARK, border: `1px solid ${ACCENT}` }}>
                  {copiat ? t.copiat : t.copia}
                </button>
                <button onClick={descarrega} className="text-sm font-semibold rounded-lg px-4 py-2 text-white transition"
                  style={{ backgroundColor: ACCENT, border: `1px solid ${ACCENT}` }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = ACCENT_DARK)}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}>
                  {t.descarrega}
                </button>
              </div>
            </div>
            <textarea ref={outRef} readOnly spellCheck={false} value={result.md}
              className="w-full h-80 rounded-xl border border-gray-300 bg-white p-3 text-xs font-mono text-gray-700 focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': ACCENT }} />
          </div>
        )}

        {/* Panell d'avisos (sempre visible) */}
        <section aria-label={t.avisosTitol} className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            {t.avisosTitol}
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-600 leading-relaxed">
            {t.avisos.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </section>

        {/* Peu de la secció */}
        <p className="text-center text-xs text-gray-400 mt-8">{t.peu}</p>
      </div>
    </div>
  );
};

export default PdfATextMd;
