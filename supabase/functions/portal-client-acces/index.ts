// supabase/functions/portal-client-acces/index.ts
//
// Àrea de client · activació i accés. Sense sessió prèvia (verify_jwt = false):
// cada acció comprova el que necessita.
//
//   obre      { token }                         dades de l'enllaç d'activació o de restabliment
//   activa    { token, contrasenya, versio }    contrasenya (mínim 12 caràcters; Auth hi aplica la
//                                               protecció de contrasenyes filtrades si està activa) i
//                                               acceptació de les condicions. Consumeix l'enllaç i
//                                               retorna una sessió sense segon factor, només per
//                                               configurar-lo. En un restabliment, n'esborra els
//                                               factors anteriors.
//   completa  (sessió aal2 d'activació)         segon factor TOTP verificat: l'usuari queda actiu
//   entra     { email, contrasenya }            primer pas de l'accés; compta els intents fallits
//   verifica  { codi } (sessió de l'entra)      segon pas: codi TOTP; compta els intents fallits
//   accepta   { versio } (sessió aal2)          acceptació d'una versió nova de les condicions
//   surt      (sessió aal2)                     tanca la sessió de l'àrea
//
// Només compten les sessions que obre aquesta funció: una sessió d'Auth oberta
// per una altra via no dona accés a res (portal.client_usuari_actual()).
// Els comptes de client tenen el rol portal_client al JWT (hook d'Auth).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { clientAdmin, entrada, formatToken, ipClient, llegeixCos, serveix, sha256Hex } from '../_shared/portal.ts';
import { M, claims, jwtDe, verificaClient } from '../_shared/area-client.ts';

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const MIN_CONTRASENYA = 12;
const MAX_CONTRASENYA = 72;  // límit d'Auth (bcrypt)

// Crida directa a l'API d'Auth amb la sessió de l'usuari (o la clau pública)
const auth = async (cami: string, metode: string, cos: unknown, jwt?: string) => {
  const r = await fetch(`${URL_SUPABASE}/auth/v1${cami}`, {
    method: metode,
    headers: { apikey: ANON, Authorization: `Bearer ${jwt || ANON}`, 'Content-Type': 'application/json' },
    body: cos === undefined ? undefined : JSON.stringify(cos),
  });
  const dades = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, dades };
};

const factorTotp = (user: { factors?: { id: string; factor_type: string; status: string }[] }) =>
  (user.factors || []).find((f) => f.factor_type === 'totp' && f.status === 'verified') || null;

serveix('portal-client-acces', async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const portal = admin.schema('portal');
  const cos = (await llegeixCos<Record<string, unknown>>(req)) || {};
  const accio = String(cos.accio || '');
  const ip = ipClient(req);
  const ua = (req.headers.get('user-agent') || '').slice(0, 500);

  // ─── Enllaç d'activació o de restabliment ─────────────────────────────────
  if (accio === 'obre' || accio === 'activa') {
    const token = String(cos.token || '');
    if (!formatToken.test(token)) return resposta(404, { error: M.neutre });
    const hash = await sha256Hex(token);
    const { data: enllac } = await portal.rpc('client_obre_token', { p_token_hash: hash });
    if (!enllac) return resposta(404, { error: M.neutre });

    if (accio === 'obre') {
      return resposta(200, { ok: true, nom: enllac.nom, email: enllac.email, motiu: enllac.motiu, expira_at: enllac.expira_at, versio: enllac.condicions });
    }

    const contrasenya = String(cos.contrasenya || '');
    if (contrasenya.length < MIN_CONTRASENYA) {
      return resposta(400, { error: 'La contrasenya ha de tenir almenys 12 caràcters. / The password must be at least 12 characters long.' });
    }
    if (contrasenya.length > MAX_CONTRASENYA) {
      return resposta(400, { error: 'La contrasenya és massa llarga (màxim 72 caràcters). / The password is too long (maximum 72 characters).' });
    }
    if (cos.versio !== enllac.condicions) return resposta(400, { error: M.condicions });

    // Restabliment: fora els factors anteriors (s'ha de configurar de nou)
    const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: enllac.user_id });
    for (const f of factors?.factors || []) {
      const { error } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: enllac.user_id });
      if (error) {
        console.error('deleteFactor', error.status);
        return resposta(500, { error: M.intern });
      }
    }

    // Sessió temporal de l'usuari (enllaç màgic generat al servidor, no s'envia cap correu)
    const { data: link, error: errLink } = await admin.auth.admin.generateLink({ type: 'magiclink', email: enllac.email });
    if (errLink || !link?.properties?.hashed_token) {
      console.error('generateLink', errLink?.status);
      return resposta(500, { error: M.intern });
    }
    const anonim = createClient(URL_SUPABASE, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: ses, error: errOtp } = await anonim.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
    if (errOtp || !ses?.session) {
      console.error('verifyOtp', errOtp?.status);
      return resposta(500, { error: M.intern });
    }

    // Contrasenya amb la sessió de l'usuari: Auth hi aplica les seves regles
    const canvi = await auth('/user', 'PUT', { password: contrasenya }, ses.session.access_token);
    if (!canvi.ok) {
      const codi = canvi.dades?.error_code || canvi.dades?.code;
      if (codi === 'weak_password') {
        const filtrada = (canvi.dades?.weak_password?.reasons || []).includes('pwned');
        return resposta(400, {
          error: filtrada
            ? 'Aquesta contrasenya apareix en filtracions de dades conegudes. Trieu-ne una altra. / This password appears in known data breaches. Please choose another one.'
            : 'La contrasenya no és prou segura. Trieu-ne una altra. / The password is not strong enough. Please choose another one.',
        });
      }
      console.error('password', canvi.status, codi);
      return resposta(500, { error: M.intern });
    }

    const sid = claims(ses.session.access_token).session_id;
    const { error: errCons } = await portal.rpc('client_consumeix_token', {
      p_token_hash: hash, p_session_id: sid, p_versio: cos.versio, p_ip: ip, p_user_agent: ua,
    });
    if (errCons) {
      console.error('client_consumeix_token', errCons.code);
      return resposta(errCons.code === '23514' ? 400 : 404, { error: errCons.code === '23514' ? M.condicions : M.neutre });
    }
    return resposta(200, {
      ok: true,
      access_token: ses.session.access_token,
      refresh_token: ses.session.refresh_token,
    });
  }

  // ─── Segon factor configurat: activació completa ──────────────────────────
  if (accio === 'completa') {
    const jwt = jwtDe(req);
    const { data: { user } } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
    const c = claims(jwt);
    if (!user || c.sub !== user.id || c.role !== 'portal_client') return resposta(401, { error: M.sessio });
    if (c.aal !== 'aal2' || !factorTotp(user)) return resposta(400, { error: M.segonFactor });
    const { error } = await portal.rpc('client_completa_activacio', { p_user_id: user.id, p_session_id: c.session_id });
    if (error) {
      console.error('client_completa_activacio', error.code);
      return resposta(error.code === '23514' ? 400 : 403, { error: error.code === '23514' ? M.condicions : M.noAutoritzat });
    }
    return resposta(200, { ok: true });
  }

  // ─── Accés, primer pas: correu i contrasenya ──────────────────────────────
  if (accio === 'entra') {
    const email = String(cos.email || '').trim().toLowerCase();
    const contrasenya = String(cos.contrasenya || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !contrasenya || contrasenya.length > MAX_CONTRASENYA) {
      return resposta(401, { error: M.credencials });
    }
    const { data: u } = await portal.rpc('client_prepara_acces', { p_email: email });
    if (!u || u.estat !== 'actiu') return resposta(401, { error: M.credencials });
    if (u.bloquejat_fins) return resposta(423, { error: M.bloquejat, bloquejat_fins: u.bloquejat_fins });

    const r = await auth('/token?grant_type=password', 'POST', { email, password: contrasenya });
    if (!r.ok || !r.dades?.access_token) {
      const { data: fins } = await portal.rpc('client_registra_fallada', { p_usuari_id: u.usuari_id, p_pas: 'contrasenya', p_ip: ip, p_user_agent: ua });
      return fins ? resposta(423, { error: M.bloquejat, bloquejat_fins: fins }) : resposta(401, { error: M.credencials });
    }
    const factor = factorTotp(r.dades.user || {});
    if (!factor) return resposta(403, { error: M.noAutoritzat });
    const sid = claims(r.dades.access_token).session_id;
    const { error } = await portal.rpc('client_obre_sessio', { p_usuari_id: u.usuari_id, p_session_id: sid, p_ip: ip, p_user_agent: ua });
    if (error) return resposta(403, { error: M.noAutoritzat });
    return resposta(200, { ok: true, access_token: r.dades.access_token, refresh_token: r.dades.refresh_token });
  }

  // ─── Accés, segon pas: codi de l'aplicació d'autenticació ─────────────────
  if (accio === 'verifica') {
    const jwt = jwtDe(req);
    const { data: { user } } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
    const c = claims(jwt);
    if (!user || c.sub !== user.id || c.role !== 'portal_client' || !c.session_id) return resposta(401, { error: M.sessio });
    const { data: u } = await portal.rpc('client_prepara_acces', { p_email: user.email });
    if (!u || u.estat !== 'actiu') return resposta(403, { error: M.noAutoritzat });
    if (u.bloquejat_fins) return resposta(423, { error: M.bloquejat, bloquejat_fins: u.bloquejat_fins });

    const factor = factorTotp(user);
    const codi = String(cos.codi || '').replace(/\s+/g, '');
    let r = null;
    if (factor && /^\d{6}$/.test(codi)) {
      const repte = await auth(`/factors/${factor.id}/challenge`, 'POST', {}, jwt);
      if (repte.ok) r = await auth(`/factors/${factor.id}/verify`, 'POST', { challenge_id: repte.dades.id, code: codi }, jwt);
    }
    if (!r?.ok || !r.dades?.access_token) {
      const { data: fins } = await portal.rpc('client_registra_fallada', { p_usuari_id: u.usuari_id, p_pas: 'codi', p_ip: ip, p_user_agent: ua });
      return fins ? resposta(423, { error: M.bloquejat, bloquejat_fins: fins }) : resposta(401, { error: M.codi });
    }
    const nou = claims(r.dades.access_token);
    if (nou.aal !== 'aal2' || nou.session_id !== c.session_id) return resposta(401, { error: M.sessio });
    const { error } = await portal.rpc('client_sessio_mfa', { p_user_id: user.id, p_session_id: c.session_id, p_ip: ip, p_user_agent: ua });
    if (error) return resposta(401, { error: M.sessio });
    return resposta(200, { ok: true, access_token: r.dades.access_token, refresh_token: r.dades.refresh_token });
  }

  // ─── Condicions noves i sortida (sessió aal2 de l'àrea) ───────────────────
  if (accio === 'accepta') {
    const sessio = await verificaClient(req, admin, resposta, { permetCondicions: true });
    if (sessio instanceof Response) return sessio;
    if (cos.versio !== sessio.versio) return resposta(400, { error: M.condicions });
    const { error } = await portal.rpc('client_registra_acceptacio', {
      p_user_id: sessio.userId, p_session_id: sessio.sessionId, p_versio: cos.versio, p_ip: ip, p_user_agent: ua,
    });
    if (error) return resposta(400, { error: M.condicions });
    return resposta(200, { ok: true });
  }

  if (accio === 'surt') {
    const jwt = jwtDe(req);
    const { data: { user } } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
    const c = claims(jwt);
    if (user && c.sub === user.id && c.session_id) {
      await portal.rpc('client_tanca_sessio', { p_user_id: user.id, p_session_id: c.session_id });
    }
    return resposta(200, { ok: true });
  }

  return resposta(400, { error: 'Acció no vàlida' });
});
