// Proves de la lògica condicional del formulari de la comunicació IRPF
// (irpf-regles.js): apartats que apareixen segons les respostes, camps
// obligatoris, avisos d'edat que no bloquegen i consentiment de l'art. 9.2.a.
// Execució: node supabase/tests/irpf/regles.test.mjs
import { avisosEdat, campsPendents, netejaDades, netejaImport, requereixConsentiment } from '../../functions/_shared/irpf-regles.js';

let fallades = 0;
let total = 0;
const comprova = (cond, nom) => {
  total++;
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${nom}`);
  if (!cond) fallades++;
};
const seccio = (t) => console.log(`\n── ${t} ──`);
const AVUI = '2026-10-20';
const camps = (d) => campsPendents(netejaDades(d), AVUI).map((p) => p.camp);

const completa = (extra = {}) => ({
  comunicacio: { tipus: 'inicial' },
  perceptor: { nom: 'Perceptor Prova', nrt: 'F-111111-A', document: 'X1234567', domicili: 'Carrer Prova, 1', incapacitat: false },
  estat_civil: { estat: 'solter' },
  data_efectes: '2027-01-01',
  declaracions: { d1: true, d2: true, d3: true, d4: true },
  ...extra,
});
const fill = (extra = {}) => ({ nom: 'Fill', any_naixement: '2015', conviu: true, rendes_superiors: false, discapacitat: false, persones: '2', ...extra });

seccio('Formulari complet');
comprova(camps(completa()).length === 0, 'Un perceptor solter amb els camps obligatoris: res pendent');
comprova(camps({}).length >= 10, 'Formulari buit: falten els camps obligatoris');

seccio('Apartat 0: tipus de comunicació');
comprova(camps(completa({ comunicacio: { tipus: 'modificacio' } })).includes('comunicacio.modifica'),
  'Modificació: cal indicar què es modifica');
comprova(camps(completa({ comunicacio: { tipus: 'modificacio', modifica: ['familiars', 'economiques'] } })).length === 0,
  'Modificació amb diverses opcions marcades: correcte');
comprova(netejaDades(completa({ comunicacio: { tipus: 'inicial', modifica: ['familiars'] } })).comunicacio.modifica.length === 0,
  'Comunicació inicial: no es desa cap "què es modifica"');

seccio('Apartat 1: perceptor');
comprova(camps(completa({ perceptor: { ...completa().perceptor, incapacitat: null } })).includes('perceptor.incapacitat'),
  'Situació d\'incapacitat: obligatòria (sí o no)');
comprova(camps(completa({ perceptor: { ...completa().perceptor, representant_nom: 'Tutor' } })).includes('perceptor.representant_nrt'),
  'Representant legal (si escau): amb nom i NRT');
comprova(camps(completa({ perceptor: { ...completa().perceptor, email: 'no-és-un-correu' } })).includes('perceptor.email'),
  'Correu electrònic (si escau): ha de ser vàlid');

seccio('Apartat 4: només si està casat/ada o en parella estable');
comprova(!camps(completa()).some((c) => c.startsWith('conjuge')), 'Solter/a: l\'apartat 4 no es demana');
comprova(netejaDades(completa({ conjuge: { nom: 'X', situacio: 'a' } })).conjuge === undefined,
  'Solter/a: no es desa cap dada del cònjuge encara que n\'arribin');
for (const e of ['separat', 'divorciat', 'vidu']) {
  comprova(!camps(completa({ estat_civil: { estat: e } })).some((c) => c.startsWith('conjuge')), `${e}: l'apartat 4 no es demana`);
}
{
  const c = camps(completa({ estat_civil: { estat: 'casat' } }));
  comprova(['conjuge.nom', 'conjuge.document', 'conjuge.situacio'].every((x) => c.includes(x)), 'Casat/ada: nom, document i situació de les rendes obligatoris');
  comprova(!c.includes('conjuge.nrt'), 'L\'NRT del cònjuge només si escau');
  const cc = camps(completa({ estat_civil: { estat: 'casat' }, conjuge: { nom: 'C', document: 'D', situacio: 'c' } }));
  comprova(cc.includes('conjuge.rendes'), 'Opció c): cal l\'import estimat de les rendes del cònjuge');
  const ca = camps(completa({ estat_civil: { estat: 'casat' }, conjuge: { nom: 'C', document: 'D', situacio: 'a', rendes: '5000' } }));
  comprova(ca.length === 0, 'Opció a): sense import');
  comprova(netejaDades(completa({ estat_civil: { estat: 'casat' }, conjuge: { situacio: 'b', rendes: '5000' } })).conjuge.rendes === '',
    'L\'import només es desa amb l\'opció c)');
}

seccio('Apartats 5, 6 i 7: opcionals; amb una persona, el nombre de persones amb dret és obligatori');
comprova(camps(completa({ descendents: [], ascendents: [], tutelats: [] })).length === 0, 'Sense persones declarades: res pendent');
comprova(camps(completa({ descendents: [fill({ persones: '' })] })).includes('descendents.0.persones'),
  'Descendent sense el nombre de persones amb dret: pendent');
comprova(camps(completa({ ascendents: [{ ...fill({ any_naixement: '1950', persones: '' }), dependencia: false }] })).includes('ascendents.0.persones'),
  'Ascendent sense el nombre de persones amb dret: pendent');
comprova(camps(completa({ tutelats: [fill({ persones: '' })] })).includes('tutelats.0.persones'),
  'Persona en tutela o acolliment sense el nombre de persones amb dret: pendent');
comprova(camps(completa({ ascendents: [fill({ any_naixement: '1950' })] })).includes('ascendents.0.dependencia'),
  'Ascendent: cal indicar la dependència');
comprova(camps(completa({ descendents: [fill({ persones: '0' })] })).includes('descendents.0.persones'), 'El nombre de persones és com a mínim 1');
comprova(camps(completa({ descendents: [fill({ any_naixement: '2030' })] })).includes('descendents.0.any_naixement'), 'Any de naixement no futur');

seccio('Avisos d\'edat (no bloquegen)');
{
  const d = netejaDades(completa({
    descendents: [fill({ nom: 'Gran', any_naixement: '2000' }), fill({ nom: 'Petit' }), fill({ nom: 'Amb discapacitat', any_naixement: '1990', discapacitat: true })],
    ascendents: [{ ...fill({ nom: 'Jove', any_naixement: '1965' }), dependencia: false }, { ...fill({ nom: 'Gran', any_naixement: '1940' }), dependencia: false }],
    declaracions: { d1: true, d2: true, d3: true, d4: true, consentiment: true },
  }));
  const a = avisosEdat(d, AVUI);
  comprova(a.length === 2 && a.some((x) => x.cami === 'descendents.0' && x.edat === 27) && a.some((x) => x.cami === 'ascendents.0' && x.edat === 62),
    'Descendent de 27 anys i ascendent de 62 sense discapacitat: avís (edat a 31/12 de l\'any de la data d\'efectes)');
  comprova(campsPendents(d, AVUI).length === 0, 'Els avisos d\'edat no impedeixen signar');
}

seccio('Apartat 8: l\'any d\'aplicació és obligatori si s\'indica un import');
comprova(camps(completa({ altres: { habitatge: { import: '1000' } } })).includes('altres.habitatge.any'), 'Habitatge amb import i sense any: pendent');
comprova(camps(completa({ altres: { plans: { import: '1000' } } })).includes('altres.plans.any'), 'Plans de pensions amb import i sense any: pendent');
comprova(camps(completa({ altres: { pensions: { import: '1000', any: '2027' } } })).includes('altres.pensions.origen'),
  'Pensions compensatòries: cal l\'origen');
comprova(camps(completa({ altres: { habitatge: { any: '2027' } } })).length === 0, 'Sense import, l\'any no cal');
comprova(camps(completa({ altres: { habitatge: { import: '1.000,50', any: '2027' } } })).length === 0, 'Import amb format català acceptat');

seccio('Apartat 10: consentiment de l\'art. 9.2.a');
{
  comprova(!requereixConsentiment(netejaDades(completa({ descendents: [fill()] }))), 'Sense discapacitat ni dependència: no apareix');
  comprova(netejaDades(completa({ declaracions: { d1: true, d2: true, d3: true, d4: true, consentiment: true } })).declaracions.consentiment === false,
    'Si no apareix, no es desa com a marcat');
  const amb = completa({ descendents: [fill({ discapacitat: true })] });
  comprova(requereixConsentiment(netejaDades(amb)), 'Amb una discapacitat marcada: apareix');
  comprova(camps(amb).includes('declaracions.consentiment'), '… i és obligatori');
  comprova(camps({ ...amb, declaracions: { ...amb.declaracions, consentiment: true } }).length === 0, 'Marcat: correcte');
  comprova(requereixConsentiment(netejaDades(completa({ ascendents: [{ ...fill({ any_naixement: '1940' }), dependencia: true }] }))),
    'També amb una dependència reconeguda per la COVASS');
  comprova(camps(completa({ declaracions: { d1: true, d2: true, d3: false, d4: true } })).includes('declaracions.d3'),
    'Les quatre declaracions són obligatòries');
}

seccio('Apartat 9 i imports');
comprova(camps(completa({ data_efectes: '2027-02-30' })).includes('data_efectes'), 'Data d\'efectes no vàlida: pendent');
comprova(netejaImport('1.234,56') === '1234.56' && netejaImport('1234.5') === '1234.50' && netejaImport('12 000 €') === '12000.00'
  && netejaImport('45.000') === '45000.00' && netejaImport('1.250.000') === '1250000.00'
  && netejaImport('1.2345') === '' && netejaImport('-5') === '', 'Imports: formats acceptats (també punts de milers) i rebutjats');

console.log(`\n${total - fallades}/${total} correctes`);
process.exit(fallades ? 1 : 0);
