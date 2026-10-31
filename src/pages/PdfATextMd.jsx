// pages/PdfATextMd.jsx — Eina pública: converteix un PDF en text (.md)
// Tot el processament es fa al navegador (pdf.js). Cap fitxer s'envia a cap servidor.
import React, { useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Worker servit localment des de public/ (NO CDN). Compatible amb Create React App.
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

const ACCENT = '#007A7B';

const UI = {
  ca: {
    tornar: '← Torna a les eines',
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
    tornar: '← Volver a las herramientas',
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
    tornar: '← Back to tools',
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
    tornar: '← Retour aux outils',
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
  const idiomaActiu = ['ca', 'es', 'en', 'fr'].includes(langProp) ? langProp : 'ca';
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
    <div className="max-w-6xl mx-auto px-5 md:px-10 py-10 md:py-16">
      {onBack && (
        <button onClick={onBack} className="text-[15px] font-semibold text-[#007A7B] hover:underline underline-offset-4">
          {t.tornar}
        </button>
      )}

      {/* Títol */}
      <div className="mt-8 md:mt-10 grid gap-3 max-w-[62ch]">
        <h1 className="font-display font-medium text-[32px] md:text-[44px] leading-[1.1] tracking-[-0.015em] text-[#12302F]">{t.titol}</h1>
        <p className="text-[17px] leading-relaxed text-[#2B4644]">{t.subtitol}</p>
      </div>

      {/* Cos */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)] lg:gap-12 lg:items-start">
        <div className="min-w-0">
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
            className={`rounded-2xl text-center cursor-pointer transition px-6 py-14 border-2 border-dashed outline-none focus-visible:ring-2 focus-visible:ring-[#4DB6B7] ${
              drag ? 'border-[#007A7B] bg-[#E8F6F6]' : 'border-[#BFD9D9] bg-[#F4F8F7] hover:border-[#4DB6B7]'
            }`}
          >
            <svg className="mx-auto mb-4" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <p className="font-display font-medium text-[21px] text-[#12302F] mb-1">{t.dropBig}</p>
            <p className="text-[15px] text-[#4E6765]">
              {t.dropSmall} <span className="font-semibold text-[#007A7B] underline underline-offset-4">{t.browse}</span>
            </p>
            <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" hidden
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>

          {/* Privacitat */}
          <div className="flex items-center gap-2 mt-4 text-sm text-[#4E6765]">
            <svg width="16" height="16" className="flex-none" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>{t.privacitat}</span>
          </div>

          {/* Estat */}
          {status && (
            <p className={`mt-4 text-[15px] font-medium ${status.kind === 'err' ? 'text-[#B23A3A]' : 'text-[#00676A]'}`}>
              {status.msg}
            </p>
          )}

          {/* Avís d'escaneig */}
          {showNote && (
            <div className="mt-4 flex items-start gap-3 rounded-xl px-4 py-3 text-sm bg-[#FBF3E2] border border-[#EAD9AE] border-l-4 border-l-[#9A6B12] text-[#5E4708]">
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
                  <div className="font-semibold text-[15px] text-[#12302F] truncate">{result.name}</div>
                  <div className="text-sm text-[#4E6765] tabular-nums">{result.meta}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={copia} className="text-sm font-semibold rounded-full px-5 py-2.5 bg-white text-[#007A7B] border border-[#007A7B] hover:bg-[#E8F6F6] transition">
                    {copiat ? t.copiat : t.copia}
                  </button>
                  <button onClick={descarrega} className="text-sm font-semibold rounded-full px-5 py-2.5 text-white bg-[#007A7B] border border-[#007A7B] hover:bg-[#00676A] transition">
                    {t.descarrega}
                  </button>
                </div>
              </div>
              <textarea ref={outRef} readOnly spellCheck={false} value={result.md}
                className="w-full h-80 rounded-xl border border-[#C5D6D3] bg-white p-3 text-xs font-mono text-[#2B4644] focus:outline-none focus:ring-2 focus:ring-[#4DB6B7]" />
            </div>
          )}
        </div>

        {/* Panell d'avisos (sempre visible) */}
        <aside aria-label={t.avisosTitol} className="rounded-2xl bg-[#F4F8F7] p-6">
          <h2 className="font-display font-medium text-[19px] text-[#12302F] mb-3">{t.avisosTitol}</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-[#2B4644] leading-relaxed marker:text-[#4DB6B7]">
            {t.avisos.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
          <p className="mt-5 pt-4 border-t border-[#D6E4E2] text-sm text-[#4E6765]">{t.peu}</p>
        </aside>
      </div>
    </div>
  );
};

export default PdfATextMd;
