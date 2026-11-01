// supabase/functions/web-formulari/index.ts
//
// Formularis públics de la web, sense sessió:
// - tipus 'contacte': formulari de contacte (App.js) → public.missatges_contacte.
// - tipus 'solicitud': sol·licitud d'accés a la Zona Professionals
//   (PaginaLogin.jsx) → public.solicituds, que el maestro revisa al Panell Maestro.
//
// Les dades es desen a Supabase i prou. Formspree només rep un avís sense cap
// dada ("Nou missatge de contacte"); si falla, el formulari ja és vàlid.
// Límit de peticions per IP (portal.registra_intent). Si el correu ja té una
// sol·licitud, es respon igual que si fos nova, per no revelar qui n'ha fet.

import { clientAdmin, entrada, ipClient, llegeixCos, serveix, sha256Hex, text } from '../_shared/portal.ts';

const MAX_PETICIONS = 5;
const FINESTRA = 600;
const FORMSPREE_BASE = Deno.env.get('FORMSPREE_BASE_URL') || 'https://formspree.io/f/';

const AVISOS: Record<'contacte' | 'solicitud', Record<string, string>> = {
  contacte: {
    _subject: 'Nou missatge de contacte a la web',
    message: 'Hi ha un missatge nou al formulari de contacte de la web. Per privacitat, aquest avís no inclou cap dada: consulteu-lo a Supabase (taula missatges_contacte).',
  },
  solicitud: {
    _subject: 'Nova sol·licitud d\'accés',
    message: 'Hi ha una sol·licitud d\'accés nova a la Zona Professionals. Per privacitat, aquest avís no inclou cap dada: reviseu-la al Panell Maestro.',
  },
};

// Mateix formulari que l'avís general de la web (info@)
const avisa = async (cos: Record<string, string>) => {
  const id = Deno.env.get('FORMSPREE_FORM_ID_INFO') || Deno.env.get('FORMSPREE_FORM_ID');
  if (!id) return;
  try {
    const r = await fetch(`${FORMSPREE_BASE}${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(cos),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.warn('Formspree ha respost', r.status);
  } catch (e) {
    console.warn('Formspree no disponible', (e as Error).name);
  }
};

const formatEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// El missatge conserva els salts de línia (text() els converteix en espais)
const textLlarg = (v: unknown, max: number): string | null => {
  if (v === null || v === undefined) return null;
  const net = String(v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').trim();
  return net ? net.slice(0, max) : null;
};

serveix('web-formulari', async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const cos = await llegeixCos<Record<string, unknown>>(req);
  if (!cos || (cos.tipus !== 'contacte' && cos.tipus !== 'solicitud')) return resposta(400, { error: 'Formulari no vàlid' });
  const tipus = cos.tipus;

  const admin = clientAdmin();
  const clauIp = await sha256Hex(`web-formulari:${ipClient(req) || 'sense-ip'}`);
  const { data: dinsLimit } = await admin.schema('portal').rpc('registra_intent', {
    p_clau: `web-formulari:${tipus}:${clauIp}`, p_maxim: MAX_PETICIONS, p_segons: FINESTRA,
  });
  if (dinsLimit === false) return resposta(429, { error: 'Massa intents. Torneu-ho a provar d\'aquí a uns minuts.' });

  const nom = text(cos.nom, 200);
  const email = text(cos.email, 254)?.toLowerCase() || null;
  if (!nom || !email || !formatEmail.test(email)) return resposta(400, { error: 'Reviseu el nom i el correu electrònic.' });

  if (tipus === 'contacte') {
    const missatge = textLlarg(cos.missatge, 5000);
    if (!missatge) return resposta(400, { error: 'Escriviu el missatge.' });
    const idioma = ['ca', 'es', 'en', 'fr'].includes(String(cos.idioma)) ? String(cos.idioma) : null;
    const { error } = await admin.from('missatges_contacte')
      .insert({ nom, email, telefon: text(cos.telefon, 50), missatge, idioma });
    if (error) {
      console.error('missatges_contacte', error.code);
      return resposta(500, { error: 'Error intern' });
    }
    await avisa(AVISOS.contacte);
    return resposta(200, { ok: true });
  }

  const eines = Array.isArray(cos.eines) ? [...new Set(cos.eines.filter((e) => e === 'irpf' || e === 'bretxa'))] : [];
  if (eines.length === 0) return resposta(400, { error: 'Selecciona almenys una eina per sol·licitar accés.' });
  const { error } = await admin.from('solicituds').insert({ nom, email, eines, estat: 'pendent' });
  if (error?.code === '23505') return resposta(200, { ok: true });
  if (error) {
    console.error('solicituds', error.code);
    return resposta(500, { error: 'Error intern' });
  }
  await avisa(AVISOS.solicitud);
  return resposta(200, { ok: true });
});
