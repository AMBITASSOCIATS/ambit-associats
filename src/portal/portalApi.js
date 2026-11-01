// src/portal/portalApi.js
// Accés a l'esquema portal i a les Edge Functions del portal de signatura.
import { supabase } from '../supabaseClient';
import TK from './kyc/text-kyc.json';
import TC from './contracte/text-contracte.json';
import TAC from './client/text-area-client.json';

export const portal = supabase.schema('portal');

export const VERSIO_PLANTILLA = 'ABA-01 v1';

// Crida una Edge Function i retorna les dades, o llança l'error amb el missatge del servidor.
export const invoca = async (funcio, body) => {
  const { data, error } = await supabase.functions.invoke(funcio, { body });
  if (error) {
    const detall = await error.context?.json?.().catch(() => null);
    throw new Error(detall?.error || error.message);
  }
  if (!data?.ok) throw new Error(data?.error || 'Error inesperat');
  return data;
};

// URL signada de curta durada per descarregar un document del bucket privat.
export const urlDocument = async (path, nom) => {
  const { data, error } = await supabase.storage.from('portal-docs')
    .createSignedUrl(path, 60, nom ? { download: nom } : undefined);
  if (error) throw error;
  return data.signedUrl;
};

export const ESTATS = {
  esborrany: { nom: 'Esborrany', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  enviat:    { nom: 'Enviat',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  en_curs:   { nom: 'En curs',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
  parcialment_signat: { nom: 'Parcialment signat', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  pendent_ambit: { nom: 'Pendent de signatura d\'ÀMBIT', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  signat:    { nom: 'Signat',    color: 'bg-teal-100 text-teal-700 border-teal-200' },
  actiu:     { nom: 'Actiu',     color: 'bg-green-100 text-green-700 border-green-200' },
  retirat:   { nom: 'Retirat',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  anullat:   { nom: 'Anul·lat',  color: 'bg-red-100 text-red-700 border-red-200' },
};

// Tipus de document
export const TIPUS_DOCUMENT = {
  autoritzacio_carrec: 'Autorització de càrrec en compte',
  kyc_pf: 'KYC i protecció de dades · persona física',
  kyc_pj: 'KYC i protecció de dades · persona jurídica',
  pdp: 'Protecció de dades',
  irpf_comunicacio: 'Comunicació de dades al pagador (IRPF)',
  contracte: 'Contracte',
};
export const esKyc = (t) => t === 'kyc_pf' || t === 'kyc_pj';
export const esIrpf = (t) => t === 'irpf_comunicacio';
export const esContracte = (t) => t === 'contracte';

// Noms d'estat propis del KYC: signat = pendent de validació de l'OCIC; actiu = validat
export const nomEstat = (estat, tipus) => {
  if (esKyc(tipus) && estat === 'signat') return 'Pendent de validació de l\'OCIC';
  if (esKyc(tipus) && estat === 'actiu') return 'Validat';
  if (esIrpf(tipus) && estat === 'signat') return 'Pendent de recepció pel pagador';
  if (esIrpf(tipus) && estat === 'actiu') return 'Rebuda pel pagador';
  return ESTATS[estat]?.nom || estat;
};

export const NIVELLS = { simplificada: 'Simplificada', normal: 'Normal', reforcada: 'Reforçada' };

export const ENTITATS = { andbank: 'Andbank', creand: 'Creand', morabanc: 'MoraBanc' };

export const dataCurta = (d) =>
  d ? new Date(d).toLocaleDateString('ca-AD', { timeZone: 'Europe/Andorra' }) : '—';
export const dataHora = (d) =>
  d ? new Date(d).toLocaleString('ca-AD', { timeZone: 'Europe/Andorra', dateStyle: 'short', timeStyle: 'short' }) : '—';

// IBAN emmascarat: només els 4 últims
export const ibanEmmascarat = (ultims4) => (ultims4 ? `AD•• •••• •••• •••• •••• ${ultims4}` : '—');

// ─── Correu amb l'enllaç (català + anglès) ──────────────────────────────────
export const missatgeEnllac = ({ nom, enllac, expira }) => {
  const data = new Date(expira).toLocaleDateString('ca-AD', {
    timeZone: 'Europe/Andorra', day: '2-digit', month: '2-digit', year: 'numeric',
  });
  return {
    titol: 'Enllaç de signatura',
    ajuda: 'Envia aquest missatge al client des del teu correu. L\'enllaç és personal: no el comparteixis amb ningú més.',
    email: '',
    assumpte: 'Autorització de càrrec en compte · ÀMBIT Associats',
    cos:
      `Benvolgut/da ${nom},\n\n` +
      'Per domiciliar el pagament de les nostres factures, us demanem que ' +
      'empleneu i signeu l\'autorització de càrrec en compte a través de ' +
      'l\'enllaç següent:\n\n' +
      `${enllac}\n\n` +
      `L'enllaç és personal i d'un sol ús, i caduca el ${data}.\n\n` +
      'Per a qualsevol dubte, podeu contactar amb nosaltres a info@ambit.ad o ' +
      'al +376 655 382.\n\n' +
      'Atentament,\n\n' +
      'ÀMBIT Associats\n\n' +
      `Dear ${nom},\n\n` +
      'To set up direct debit for our invoices, please complete and sign the ' +
      'bank debit authorisation using the following link:\n\n' +
      `${enllac}\n\n` +
      `This link is personal, can only be used once and expires on ${data}.\n\n` +
      'If you have any questions, please contact us at info@ambit.ad or on ' +
      '+376 655 382.\n\n' +
      'Kind regards,\n\n' +
      'ÀMBIT Associats',
  };
};

// ─── Correu amb l'enllaç del KYC (text literal de la plantilla) ─────────────
export const missatgeEnllacKyc = ({ nom, enllac, expira }) => {
  const data = new Date(expira).toLocaleDateString('ca-AD', {
    timeZone: 'Europe/Andorra', day: '2-digit', month: '2-digit', year: 'numeric',
  });
  return {
    titol: 'Enllaç del KYC i la protecció de dades',
    ajuda: 'Envia aquest missatge al client des del teu correu. L\'enllaç és personal: no el comparteixis amb ningú més.',
    email: '',
    assumpte: TK.correu.assumpte,
    cos: TK.correu.cos.split('{nom}').join(nom).split('{enllaç}').join(enllac).split('{data}').join(data),
  };
};

// ─── Correu amb l'enllaç de la comunicació IRPF (català + anglès) ───────────
// destinatari: 'perceptor' (omplir i signar) o 'recepcio' (representant del
// pagador, per signar-ne la recepció)
export const missatgeEnllacIrpf = ({ nom, perceptor, pagador, enllac, expira, destinatari, email }) => {
  const data = new Date(expira).toLocaleDateString('ca-AD', {
    timeZone: 'Europe/Andorra', day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const contacte = 'Per a qualsevol dubte, podeu contactar amb nosaltres a info@ambit.ad o al +376 655 382.';
  const contacteEn = 'If you have any questions, please contact us at info@ambit.ad or on +376 655 382.';
  const recepcio = destinatari === 'recepcio';
  return {
    titol: recepcio ? 'Enllaç de recepció pel pagador' : 'Enllaç de la comunicació de dades (IRPF)',
    ajuda: recepcio
      ? 'Envia aquest missatge al representant del pagador des del teu correu. L\'enllaç és personal: no el comparteixis amb ningú més.'
      : 'Envia aquest missatge al perceptor des del teu correu. L\'enllaç és personal: no el comparteixis amb ningú més.',
    email: email || '',
    assumpte: recepcio
      ? `Recepció de la comunicació de dades IRPF · ${pagador} · ÀMBIT Associats`
      : `Comunicació de dades personals i familiars · ${pagador} · ÀMBIT Associats`,
    cos: recepcio
      ? 'Benvolgut/da,\n\n' +
        `${perceptor} ha signat la comunicació de dades personals i familiars per a la retenció de l'IRPF. ` +
        `Com a representant de ${pagador}, us demanem que en signeu la recepció a través de l'enllaç següent:\n\n` +
        `${enllac}\n\n` +
        `L'enllaç és personal i d'un sol ús, i caduca el ${data}.\n\n${contacte}\n\nAtentament,\n\nÀMBIT Associats\n\n` +
        'Dear Sir or Madam,\n\n' +
        `${perceptor} has signed the communication of personal and family data for income tax withholding. ` +
        `As the representative of ${pagador}, please sign the receipt using the following link:\n\n` +
        `${enllac}\n\n` +
        `This link is personal, can only be used once and expires on ${data}.\n\n${contacteEn}\n\nKind regards,\n\nÀMBIT Associats`
      : `Benvolgut/da ${nom},\n\n` +
        `Perquè ${pagador} pugui calcular correctament la retenció de l'IRPF sobre les vostres rendes del treball, ` +
        'us demanem que empleneu i signeu la comunicació de dades personals i familiars a través de l\'enllaç següent:\n\n' +
        `${enllac}\n\n` +
        `L'enllaç és personal i d'un sol ús, i caduca el ${data}. Les respostes es desen soles: podeu continuar més tard amb el mateix enllaç.\n\n` +
        `${contacte}\n\nAtentament,\n\nÀMBIT Associats\n\n` +
        `Dear ${nom},\n\n` +
        `So that ${pagador} can correctly calculate the income tax withholding on your employment income, ` +
        'please complete and sign the communication of personal and family data using the following link:\n\n' +
        `${enllac}\n\n` +
        `This link is personal, can only be used once and expires on ${data}. Your answers are saved automatically: you can continue later with the same link.\n\n` +
        `${contacteEn}\n\nKind regards,\n\nÀMBIT Associats`,
  };
};

// ─── Correu amb l'enllaç d'un signant del contracte (text literal) ──────────
// idioma 'ca': només català; 'ca_en': català i, a sota, anglès
export const missatgeEnllacContracte = ({ nom, titol, enllac, expira, idioma, email }) => {
  const data = new Date(expira).toLocaleDateString('ca-AD', {
    timeZone: 'Europe/Andorra', day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const omple = (t) => t.split('{nom}').join(nom).split('{títol}').join(titol).split('{enllaç}').join(enllac).split('{data}').join(data);
  const ca = TC.correu.ca;
  const en = TC.correu.en;
  const bilingue = idioma === 'ca_en';
  return {
    titol: 'Enllaç per signar el contracte',
    ajuda: 'Envia aquest missatge al signant des del teu correu. L\'enllaç és personal: no el comparteixis amb ningú més.',
    email: email || '',
    assumpte: bilingue ? `${ca.assumpte} / ${en.assumpte}` : ca.assumpte,
    cos: bilingue ? `${omple(ca.cos)}\n\n${omple(en.cos)}` : omple(ca.cos),
  };
};

// ─── Àrea de client: correu d'invitació o de restabliment (text literal) ────
// tipus: 'invitacio' o 'restabliment'. Català i, a sota, anglès.
export const missatgeAreaClient = ({ tipus, nom, enllac, expira, email }) => {
  const data = new Date(expira).toLocaleDateString('ca-AD', {
    timeZone: 'Europe/Andorra', day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const c = tipus === 'restabliment' ? TAC.correu_restabliment : TAC.correu_invitacio;
  const omple = (t) => t.split('{nom}').join(nom).split('{enllaç}').join(enllac).split('{data}').join(data);
  return {
    titol: tipus === 'restabliment' ? 'Enllaç de restabliment de l\'accés' : 'Invitació a l\'àrea de client',
    ajuda: 'Envia aquest missatge a l\'usuari des del teu correu. L\'enllaç és personal: no el comparteixis amb ningú més.',
    email: email || '',
    assumpte: c.assumpte,
    cos: `${omple(c.ca)}\n\n${omple(c.en)}`,
  };
};
