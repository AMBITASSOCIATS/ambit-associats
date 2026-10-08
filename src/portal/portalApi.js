// src/portal/portalApi.js
// Accés a l'esquema portal i a les Edge Functions del portal de signatura.
import { supabase } from '../supabaseClient';
import TK from './kyc/text-kyc.json';

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
};
export const esKyc = (t) => t === 'kyc_pf' || t === 'kyc_pj';

// Noms d'estat propis del KYC: signat = pendent de validació de l'OCIC; actiu = validat
export const nomEstat = (estat, tipus) => {
  if (esKyc(tipus) && estat === 'signat') return 'Pendent de validació de l\'OCIC';
  if (esKyc(tipus) && estat === 'actiu') return 'Validat';
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
