// supabase/functions/_shared/contracte-regles.ts
//
// Comprovació del PDF original d'un contracte abans de registrar-lo:
//  · només application/pdf, màxim 20 MB, capçalera %PDF-;
//  · PDF que es pot llegir (pdf-lib), amb una pàgina com a mínim;
//  · sense xifrar ni contrasenya (pdf-lib rebutja qualsevol PDF amb /Encrypt);
//  · s'hi poden afegir les pàgines del portal sense tocar-ne els bytes: es fa
//    una composició de prova i es comprova que l'original queda intacte al
//    principi del resultat i que el resultat es torna a llegir.

import { PDFDocument, StandardFonts } from 'npm:pdf-lib@1.17.1';
import { afegeixIncremental, carregaOriginal } from './pdf-incremental.ts';

export const MAX_ORIGINAL = 20 * 1024 * 1024;

export type Comprovacio =
  | { ok: true; pagines: number }
  | { ok: false; codi: 'buit' | 'mida' | 'no_pdf' | 'xifrat' | 'no_valid'; error: string };

const MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

export const comprovaOriginal = async (bytes: Uint8Array): Promise<Comprovacio> => {
  if (!bytes || bytes.length === 0) return { ok: false, codi: 'buit', error: 'El fitxer és buit' };
  if (bytes.length > MAX_ORIGINAL) return { ok: false, codi: 'mida', error: 'El PDF no pot superar els 20 MB' };
  // La capçalera pot anar precedida d'uns pocs bytes (ISO 32000-1, 7.5.2): es busca al primer KB
  const cap = bytes.subarray(0, 1024);
  let trobat = false;
  for (let i = 0; i + MAGIC.length <= cap.length && !trobat; i++) trobat = MAGIC.every((v, k) => cap[i + k] === v);
  if (!trobat) return { ok: false, codi: 'no_pdf', error: 'El fitxer no és un PDF' };

  let pagines = 0;
  try {
    pagines = (await carregaOriginal(bytes)).pagines;
  } catch (e) {
    const missatge = (e as Error)?.message || '';
    if (/encrypt/i.test(missatge)) {
      return { ok: false, codi: 'xifrat', error: 'El PDF està xifrat o protegit amb contrasenya; no es pot fer servir' };
    }
    return { ok: false, codi: 'no_valid', error: 'El PDF no és vàlid o està malmès' };
  }

  // Composició de prova (no es desa): l'original ha de quedar intacte
  try {
    const prova = await afegeixIncremental(bytes, async (pdf) => {
      const f = await pdf.embedFont(StandardFonts.Helvetica);
      pdf.addPage([595.28, 841.89]).drawText('-', { x: 50, y: 50, size: 8, font: f });
    });
    const intacte = prova.length > bytes.length && bytes.every((v, i) => prova[i] === v);
    const relegit = await PDFDocument.load(prova, { updateMetadata: false });
    if (!intacte || relegit.getPageCount() !== pagines + 1) throw new Error('composició');
  } catch {
    return { ok: false, codi: 'no_valid', error: 'No es poden afegir les pàgines de signatura a aquest PDF sense modificar-lo; deseu-lo de nou en PDF i torneu-lo a pujar' };
  }
  return { ok: true, pagines };
};
