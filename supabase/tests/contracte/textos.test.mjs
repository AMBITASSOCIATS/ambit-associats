// Comprova que els textos del contracte (text-contracte.json) són literalment
// els que s'han demanat (clàusula addicional, caselles, lloc, avís de
// Formspree i correu), que les còpies del formulari web i de les Edge
// Functions són idèntiques byte a byte i que el correu en català no porta
// anglès.
// Execució: node supabase/tests/contracte/textos.test.mjs
import fs from 'node:fs';

const arrel = new URL('../../../', import.meta.url);
const llegeix = (p) => fs.readFileSync(new URL(p, arrel));

let fallades = 0;
let total = 0;
const comprova = (cond, nom) => {
  total++;
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${nom}`);
  if (!cond) fallades++;
};

const T = JSON.parse(llegeix('supabase/functions/_shared/text-contracte.json'));

// Textos literals demanats
const C = T.clausula;
comprova(T.versio === 'CONTRACTE v1', 'Versió de les pàgines afegides: CONTRACTE v1');
comprova(C.titol.ca === 'Clàusula addicional. Signatura electrònica' && C.titol.en === 'Additional clause. Electronic signature', 'Títol de la clàusula (CA i EN)');
const punts = [
  ['Les parts acorden signar aquest contracte mitjançant el sistema de signatura electrònica del portal de signatura de DEL SOTO – PALEARI & ASSOCIATS, SL, que consisteix en la signatura manuscrita feta per cada signant en pantalla, vinculada al document per mitjà de l\'empremta digital SHA-256 del contracte i acompanyada d\'un full d\'evidències amb la data i l\'hora de cada signatura, l\'adreça IP i el navegador utilitzats.',
    'The parties agree to sign this agreement using the electronic signature system of the signing portal of DEL SOTO – PALEARI & ASSOCIATS, SL, consisting of each signatory\'s handwritten signature made on screen, linked to the document by the SHA-256 digital fingerprint of the agreement and accompanied by an evidence sheet stating the date and time of each signature and the IP address and browser used.'],
  ['Abans de signar, cada signant ha acceptat expressament al portal les condicions d\'aquest sistema. D\'acord amb l\'article 5.4 de la Llei 35/2014, del 27 de novembre, les parts el reconeixen com a mitjà vàlid per manifestar el seu consentiment i atribueixen a la signatura així feta plena eficàcia entre elles.',
    'Before signing, each signatory expressly accepted the conditions of this system on the portal. In accordance with Article 5.4 of Andorran Law 35/2014, of 27 November, the parties recognise it as a valid means of expressing their consent and give the signature so made full effect between them.'],
  ['El contracte signat és un document electrònic als efectes de l\'article 22 de la mateixa Llei. Qualsevol modificació posterior seria detectable comparant-ne l\'empremta digital amb la que consta al full d\'evidències.',
    'The signed agreement is an electronic document for the purposes of Article 22 of that Law. Any subsequent alteration would be detectable by comparing its digital fingerprint with the one recorded on the evidence sheet.'],
  ['Cada part rep una còpia electrònica del contracte signat per totes les parts.',
    'Each party receives an electronic copy of the agreement signed by all parties.'],
];
comprova(C.punts.length === 4 && punts.every(([ca, en], i) => C.punts[i].ca === ca && C.punts[i].en === en), 'Els 4 punts de la clàusula, en català i en anglès, amb el text exacte');
comprova(T.casella_lectura.ca === 'He llegit el contracte complet.' && T.casella_lectura.en === 'I have read the full agreement.', 'Casella de lectura (CA i EN)');
comprova(T.casella_acceptacio.ca === 'Accepto signar electrònicament aquest contracte mitjançant el portal de signatura de DEL SOTO – PALEARI & ASSOCIATS, SL, en les condicions descrites a la clàusula addicional de signatura electrònica, i reconec a aquesta signatura plena eficàcia entre les parts.'
  && T.casella_acceptacio.en === 'I agree to sign this agreement electronically through the signing portal of DEL SOTO – PALEARI & ASSOCIATS, SL, under the conditions described in the additional electronic signature clause, and I recognise this signature as fully effective between the parties.',
'Casella d\'acceptació prèvia (CA i EN)');
comprova(T.lloc_exemple === 'p. ex. Andorra la Vella', 'Text d\'exemple del lloc');
comprova(T.ambit.nom === 'Martín Paleari · Administrador solidari' && T.ambit.societat === 'DEL SOTO – PALEARI & ASSOCIATS, SL', 'Signatura d\'ÀMBIT: nom, càrrec i societat');
comprova(T.avis._subject === 'Nou contracte signat al portal'
  && T.avis.message === 'S\'ha signat un contracte al portal de signatura d\'ÀMBIT Associats. Podeu consultar-lo a https://www.ambit.ad/portal', 'Avís de Formspree: assumpte i text');
comprova(Object.keys(T.avis).length === 2, 'L\'avís de Formspree no té cap altre camp');

// Textos corregits a la revisió
comprova(T.pdf.e_acceptacio.ca === 'Acceptació prèvia de la signatura electrònica', 'Full d\'evidències: «Acceptació prèvia de la signatura electrònica»');
comprova(T.pdf.e_sha_firma.ca === 'Empremta de la imatge de la signatura (SHA-256)', 'Full d\'evidències: «Empremta de la imatge de la signatura (SHA-256)»');
comprova(T.pdf.nota.ca.startsWith('Les pàgines de la 1 a la {pagines} d’aquest PDF són el PDF original del contracte, sense cap modificació:'), 'Nota del full d\'evidències: «Les pàgines de la 1 a la {pagines} d’aquest PDF són…»');
comprova(T.pantalla.esborrar_firma.ca === 'Esborrar la signatura', 'Pantalla: «Esborrar la signatura»');

// Correu
const ca = T.correu.ca;
const en = T.correu.en;
comprova(ca.assumpte === 'Contracte per signar · ÀMBIT Associats' && en.assumpte === 'Agreement for signature · ÀMBIT Associats', 'Assumpte del correu (CA i EN)');
const normal = (s) => s.replace(/\s+/g, ' ').trim();
comprova(normal(ca.cos) === normal('Benvolgut/da {nom}, Us fem arribar el contracte {títol} perquè el pugueu llegir i signar electrònicament a través de l\'enllaç següent: {enllaç} L\'enllaç és personal i d\'un sol ús, i caduca el {data}. Per a qualsevol dubte, podeu contactar amb nosaltres a info@ambit.ad o al +376 655 382. Atentament, ÀMBIT Associats'),
  'Cos del correu en català');
comprova(normal(en.cos) === normal('Dear {nom}, Please find the agreement {títol} for you to read and sign electronically using the following link: {enllaç} This link is personal, can only be used once and expires on {data}. If you have any questions, please contact us at info@ambit.ad or on +376 655 382. Kind regards, ÀMBIT Associats'),
  'Cos del correu en anglès');
// El correu que prepara el panell (portalApi.js): amb "Català", només ca; amb "Català i anglès", ca i a sota en
const api = llegeix('src/portal/portalApi.js').toString('utf8');
comprova(api.includes('assumpte: bilingue ? `${ca.assumpte} / ${en.assumpte}` : ca.assumpte')
  && api.includes('cos: bilingue ? `${omple(ca.cos)}\\n\\n${omple(en.cos)}` : omple(ca.cos)'), 'Correu del panell: català sol o català i, a sota, anglès');

// Cap text català amb anglès barrejat (cap clau 'ca' conté les paraules angleses més habituals)
const fulles = [];
const recorre = (v, cami) => {
  if (typeof v === 'string') fulles.push([cami, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => recorre(x, `${cami}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) recorre(x, cami ? `${cami}.${k}` : k);
};
recorre(T, '');
const catalans = fulles.filter(([c]) => /(^|\.)ca$|(\.|^)(versio|lloc_exemple|ambit\.\w+|avis\.\w+)$|correu\.ca\./.test(c));
const angles = /\b(the|and|agreement|signature|please|sign|signed|signatory|link|date|place)\b/i;
comprova(catalans.length >= 80 && catalans.every(([, t]) => !angles.test(t)), `Cap dels ${catalans.length} textos en català conté anglès`);

// Còpies idèntiques
let igual = false;
try { igual = llegeix('supabase/functions/_shared/text-contracte.json').equals(llegeix('src/portal/contracte/text-contracte.json')); } catch { igual = false; }
comprova(igual, 'text-contracte.json: la còpia de la web i la del servidor són idèntiques');

console.log(`\n${total - fallades}/${total} correctes`);
process.exit(fallades ? 1 : 0);
