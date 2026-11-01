// Àrea de client · comprovació del contingut real dels fitxers
// (supabase/functions/_shared/fitxers-client.js), sense servidor.
// Execució: node supabase/tests/client/fitxers.test.mjs

import { comprovaContingut, extensio, nomNet, TIPUS, MAX_FITXER } from '../../functions/_shared/fitxers-client.js';
import * as F from './fabrica-fitxers.mjs';

let fallades = 0;
let total = 0;
const comprova = (cond, nom) => {
  total++;
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${nom}`);
  if (!cond) fallades++;
};
const seccio = (t) => console.log(`\n── ${t} ──`);
const accepta = (ext, b, nom) => { const m = comprovaContingut(ext, b); comprova(m === null, `${nom}${m ? ` (${m})` : ''}`); };
const rebutja = (ext, b, nom) => { const m = comprovaContingut(ext, b); comprova(m !== null && / \/ /.test(m), `${nom}${m ? ` → ${m}` : ' (acceptat!)'}`); };

seccio('Tipus admesos');
comprova(Object.keys(TIPUS).sort().join(',') === 'csv,doc,docx,jpeg,jpg,pdf,png,xls,xlsx', 'Només PDF, JPG, PNG, XLSX, XLS, DOCX, DOC i CSV');
for (const n of ['a.zip', 'a.exe', 'a.rar', 'a.7z', 'a.js', 'a.docm', 'a.xlsm', 'a.html', 'a.svg', 'a', 'a.pdf.exe']) {
  comprova(extensio(n) === null, `Extensió no admesa: ${n}`);
}
comprova(extensio('Factura.PDF') === 'pdf' && extensio('foto.JPEG') === 'jpeg', 'Extensió en majúscules');
comprova(nomNet('../../etc/passwd.pdf') === 'passwd.pdf' && nomNet('C:\\x\\y\\z.pdf') === 'z.pdf', 'El nom no porta camins');
comprova(nomNet('a\u0000b\u001fc.pdf') === 'abc.pdf', 'El nom no porta caràcters de control');
comprova(nomNet('x'.repeat(300) + '.xlsx').length === 200 && nomNet('x'.repeat(300) + '.xlsx').endsWith('.xlsx'), 'Nom de 200 caràcters com a màxim, amb l\'extensió');

seccio('Contingut correcte');
accepta('pdf', F.pdf(), 'PDF');
accepta('png', F.png(), 'PNG');
accepta('jpg', F.jpg(), 'JPG');
accepta('jpeg', F.jpg(), 'JPEG');
accepta('csv', F.csv(), 'CSV UTF-8');
accepta('csv', Buffer.from([0x4e, 0x6f, 0x6d, 0x3b, 0xe0, 0x0d, 0x0a]), 'CSV Windows-1252');
accepta('docx', F.docx(), 'DOCX');
accepta('docx', F.docx([{ nom: 'word/media/image1.png', dades: F.png() }]), 'DOCX amb una imatge');
accepta('xlsx', F.xlsx(), 'XLSX');
accepta('doc', F.doc(), 'DOC');
accepta('xls', F.xls(), 'XLS');
accepta('xls', F.ole(['Book']), 'XLS antic (flux Book)');

seccio('Contingut que no correspon a l\'extensió');
rebutja('pdf', F.png(), 'PNG amb extensió .pdf');
rebutja('png', F.pdf(), 'PDF amb extensió .png');
rebutja('jpg', F.png(), 'PNG amb extensió .jpg');
rebutja('docx', F.zip([{ nom: 'hola.txt', dades: 'hola' }]), 'ZIP qualsevol amb extensió .docx');
rebutja('xlsx', F.docx(), 'DOCX amb extensió .xlsx');
rebutja('docx', F.xlsx(), 'XLSX amb extensió .docx');
rebutja('doc', F.xls(), 'XLS amb extensió .doc');
rebutja('xls', F.doc(), 'DOC amb extensió .xls');
rebutja('doc', F.docx(), 'DOCX amb extensió .doc');
rebutja('csv', F.zip([{ nom: 'a.csv', dades: 'a;b' }]), 'ZIP amb extensió .csv');
rebutja('csv', Buffer.from('a;b\u0000c'), 'CSV amb bytes binaris');
rebutja('csv', F.pdf(), 'PDF amb extensió .csv');
rebutja('pdf', Buffer.alloc(0), 'Fitxer buit');

seccio('Sense ZIP ni executables');
rebutja('pdf', F.exe(), 'Executable (MZ) amb extensió .pdf');
rebutja('csv', Buffer.concat([Buffer.from('#!/bin/sh\n'), Buffer.from('rm -rf /')]), 'Script (#!) amb extensió .csv');
rebutja('png', Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(64)]), 'ELF amb extensió .png');
rebutja('docx', F.docx([{ nom: 'word/vbaProject.bin', dades: 'x' }]), 'DOCX amb macros (vbaProject.bin)');
rebutja('xlsx', F.xlsx([{ nom: 'xl/vbaProject.bin', dades: 'x' }]), 'XLSX amb macros (vbaProject.bin)');
rebutja('docx', F.docx([{ nom: 'word/activeX/activeX1.xml', dades: 'x' }]), 'DOCX amb ActiveX');
rebutja('docx', F.docx([{ nom: 'word/embeddings/oleObject1.bin', dades: 'x' }]), 'DOCX amb objecte OLE incrustat');
rebutja('xlsx', F.xlsx([{ nom: 'xl/media/programa.exe', dades: 'MZ' }]), 'XLSX amb un executable a dins');
rebutja('docx', F.docx([{ nom: 'word/media/arxiu.zip', dades: 'PK' }]), 'DOCX amb un ZIP a dins');
rebutja('docx', F.zip([{ nom: '[Content_Types].xml', dades: 'x' }, { nom: 'word/document.xml', dades: 'x' }], { xifrat: true }), 'DOCX xifrat');
rebutja('doc', F.doc(['Macros']), 'DOC amb macros');
rebutja('xls', F.xls(['_VBA_PROJECT_CUR']), 'XLS amb macros');
rebutja('doc', F.doc(['\u0001Ole10Native']), 'DOC amb un paquet OLE incrustat');
rebutja('pdf', F.pdf('/OpenAction << /S /Launch /F (calc.exe) >>'), 'PDF amb acció /Launch');
rebutja('pdf', F.pdf('/Names << /EmbeddedFiles 3 0 R >>'), 'PDF amb fitxers incrustats');

seccio('Mides');
rebutja('pdf', Buffer.concat([F.pdf(), Buffer.alloc(MAX_FITXER)]), 'Més de 20 MB');
accepta('csv', Buffer.alloc(MAX_FITXER, 0x41), 'Exactament 20 MB');

console.log(`\n${total - fallades}/${total} correctes`);
process.exit(fallades ? 1 : 0);
