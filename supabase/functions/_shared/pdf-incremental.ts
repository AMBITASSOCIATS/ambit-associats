// supabase/functions/_shared/pdf-incremental.ts
//
// Afegeix pàgines a un PDF existent com a actualització incremental (ISO
// 32000-1, apartat 7.5.6): els bytes del PDF original queden intactes al
// principi del fitxer final i només s'hi afegeixen al final els objectes nous
// o canviats (les pàgines noves, l'arbre de pàgines amb el recompte nou), una
// taula de referències creuades nova i un tràiler amb /Prev.
//
// Així, qualsevol persona pot comprovar que el contracte no s'ha tocat: els
// primers N bytes del PDF final (N = mida de l'original) tenen la mateixa
// empremta SHA-256 que l'original, que consta al full d'evidències.
//
// No admet PDF xifrats (pdf-lib llança EncryptedPDFError en carregar-los).

import {
  PDFCrossRefSection, PDFCrossRefStream, PDFDocument, PDFName, PDFObject, PDFRawStream, PDFRef,
  PDFTrailer, PDFTrailerDict,
} from 'npm:pdf-lib@1.17.1';

const enc = new TextEncoder();

const bytesDe = (obj: PDFObject): Uint8Array => {
  const out = new Uint8Array(obj.sizeInBytes());
  obj.copyBytesInto(out, 0);
  return out;
};

// Empremta lleugera d'un objecte per detectar si ha canviat. Els fluxos
// originals (imatges, continguts) no es tornen a serialitzar sencers: el seu
// contingut no canvia mai; només el diccionari.
const instantania = (obj: PDFObject): string => {
  if (obj instanceof PDFRawStream) return `S${obj.contents.length}:${new TextDecoder('latin1').decode(bytesDe(obj.dict))}`;
  return new TextDecoder('latin1').decode(bytesDe(obj));
};

// Darrer "startxref" de l'original: on comença la seva darrera taula
const darrerStartxref = (pdf: Uint8Array): number => {
  const cua = new TextDecoder('latin1').decode(pdf.subarray(Math.max(0, pdf.length - 2048)));
  const m = [...cua.matchAll(/startxref\s+(\d+)/g)].pop();
  if (!m) throw new Error('PDF sense startxref');
  const n = Number(m[1]);
  if (!Number.isSafeInteger(n) || n <= 0 || n >= pdf.length) throw new Error('startxref no vàlid');
  return n;
};

// /Size de la darrera secció de l'original (tràiler o flux de referències)
const midaOriginal = (pdf: Uint8Array, prev: number): number => {
  const tros = new TextDecoder('latin1').decode(pdf.subarray(prev, Math.min(pdf.length, prev + 4 * 1024 * 1024)));
  const m = tros.match(/\/Size\s+(\d+)/);
  return m ? Number(m[1]) : 0;
};

export type Carregat = { pdf: PDFDocument; pagines: number };

// Carrega i valida un PDF per afegir-hi pàgines. Llança un error si no és un
// PDF vàlid, si està xifrat o si no té cap pàgina.
export const carregaOriginal = async (original: Uint8Array): Promise<Carregat> => {
  const pdf = await PDFDocument.load(original, { updateMetadata: false });
  const pagines = pdf.getPageCount();
  if (pagines < 1) throw new Error('PDF sense pàgines');
  darrerStartxref(original);
  return { pdf, pagines };
};

// Retorna l'original seguit de l'actualització incremental amb el que hi
// dibuixa `afegeix` (pàgines noves al final).
export const afegeixIncremental = async (
  original: Uint8Array,
  afegeix: (pdf: PDFDocument) => Promise<void>,
): Promise<Uint8Array> => {
  const prev = darrerStartxref(original);
  const pdf = await PDFDocument.load(original, { updateMetadata: false });
  const ctx = pdf.context;
  // Els objectes nous mai no reutilitzen números de l'original (ni els lliures)
  ctx.largestObjectNumber = Math.max(ctx.largestObjectNumber, midaOriginal(original, prev) - 1);

  const abans = new Map<string, string>();
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) abans.set(ref.tag, instantania(obj));

  await afegeix(pdf);
  await pdf.flush();

  // Objectes nous o modificats, per ordre de número
  const canviats = ctx.enumerateIndirectObjects()
    .filter(([ref, obj]) => abans.get(ref.tag) !== instantania(obj))
    .sort(([a], [b]) => a.objectNumber - b.objectNumber);

  const trossos: Uint8Array[] = [original];
  let pos = original.length;
  const escriu = (b: Uint8Array) => { trossos.push(b); pos += b.length; };
  const darrer = original[original.length - 1];
  if (darrer !== 0x0a && darrer !== 0x0d) escriu(enc.encode('\n'));

  const offsets: [PDFRef, number][] = [];
  for (const [ref, obj] of canviats) {
    offsets.push([ref, pos]);
    escriu(enc.encode(`${ref.objectNumber} ${ref.generationNumber} obj\n`));
    escriu(bytesDe(obj));
    escriu(enc.encode('\nendobj\n'));
  }

  const { Root, Info, ID } = ctx.trailerInfo;
  const xrefClassica = new TextDecoder('latin1').decode(original.subarray(prev, prev + 4)) === 'xref';

  if (xrefClassica) {
    const seccio = PDFCrossRefSection.createEmpty();
    for (const [ref, off] of offsets) seccio.addEntry(ref, off);
    const posXref = pos;
    escriu(bytesDe(seccio as unknown as PDFObject));
    const dict = ctx.obj({}) as any;
    dict.set(PDFName.of('Size'), ctx.obj(ctx.largestObjectNumber + 1));
    if (Root) dict.set(PDFName.of('Root'), Root);
    if (Info) dict.set(PDFName.of('Info'), Info);
    if (ID) dict.set(PDFName.of('ID'), ID);
    dict.set(PDFName.of('Prev'), ctx.obj(prev));
    escriu(enc.encode('\n'));
    escriu(bytesDe(PDFTrailerDict.of(dict) as unknown as PDFObject));
    escriu(enc.encode('\n'));
    escriu(bytesDe(PDFTrailer.forLastCrossRefSectionOffset(posXref) as unknown as PDFObject));
  } else {
    // L'original fa servir un flux de referències creuades: l'actualització també
    const refXref = ctx.nextRef();
    const dict = ctx.obj({}) as any;
    dict.set(PDFName.of('Size'), ctx.obj(ctx.largestObjectNumber + 1));
    if (Root) dict.set(PDFName.of('Root'), Root);
    if (Info) dict.set(PDFName.of('Info'), Info);
    if (ID) dict.set(PDFName.of('ID'), ID);
    dict.set(PDFName.of('Prev'), ctx.obj(prev));
    const flux = PDFCrossRefStream.create(dict, true);
    for (const [ref, off] of offsets) flux.addUncompressedEntry(ref, off);
    const posXref = pos;
    flux.addUncompressedEntry(refXref, posXref);
    escriu(enc.encode(`${refXref.objectNumber} 0 obj\n`));
    escriu(bytesDe(flux));
    escriu(enc.encode('\nendobj\n'));
    escriu(bytesDe(PDFTrailer.forLastCrossRefSectionOffset(posXref) as unknown as PDFObject));
  }

  const out = new Uint8Array(pos);
  let o = 0;
  for (const t of trossos) { out.set(t, o); o += t.length; }
  return out;
};
