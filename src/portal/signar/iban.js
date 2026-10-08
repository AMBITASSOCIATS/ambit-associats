// src/portal/signar/iban.js
// Validació de l'IBAN andorrà al navegador (la mateixa que fa el servidor,
// supabase/functions/_shared/portal.ts). Només per avisar el client a l'instant.

export const ENTITATS = { '0001': 'andbank', '0003': 'creand', '0007': 'morabanc' };

const mod97 = (s) => {
  let r = 0;
  for (const c of s) {
    const v = /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c;
    for (const d of v) r = (r * 10 + Number(d)) % 97;
  }
  return r;
};

export const normalitza = (v) => String(v || '').replace(/\s+/g, '').toUpperCase();

export const formata = (v) => normalitza(v).replace(/(.{4})/g, '$1 ').trim();

// Retorna { ok, entitat } o { ok: false, error: { ca, en } }
export const validaIban = (entrada) => {
  const iban = normalitza(entrada);
  if (!iban) return { ok: false, error: null };
  if (!iban.startsWith('AD')) {
    return { ok: false, error: { ca: 'L\'IBAN ha de ser andorrà (comença per AD).', en: 'The IBAN must be Andorran (starts with AD).' } };
  }
  if (iban.length !== 24) {
    return { ok: false, error: { ca: `L'IBAN andorrà té 24 caràcters (n'hi ha ${iban.length}).`, en: `An Andorran IBAN has 24 characters (${iban.length} entered).` } };
  }
  if (!/^AD\d{2}\d{8}[0-9A-Z]{12}$/.test(iban)) {
    return { ok: false, error: { ca: 'L\'IBAN conté caràcters no vàlids.', en: 'The IBAN contains invalid characters.' } };
  }
  if (mod97(iban.slice(4) + iban.slice(0, 4)) !== 1) {
    return { ok: false, error: { ca: 'Els dígits de control no són correctes. Reviseu el número.', en: 'The check digits are not correct. Please check the number.' } };
  }
  const entitat = ENTITATS[iban.slice(4, 8)];
  if (!entitat) {
    return { ok: false, error: { ca: 'Entitat no admesa: només Andbank, Creand o MoraBanc.', en: 'Bank not accepted: only Andbank, Creand or MoraBanc.' } };
  }
  return { ok: true, entitat, iban };
};
