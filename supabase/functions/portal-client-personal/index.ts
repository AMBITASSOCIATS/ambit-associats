// supabase/functions/portal-client-personal/index.ts
//
// Àrea de client · gestió dels usuaris des de la fitxa del client i documents
// rebuts. Només el personal actiu del portal.
//
//   llista      { client_id }                   usuaris vinculats al client
//   afegeix     { client_id, nom, email }       usuari nou (compte d'Auth propi, sense contrasenya
//                                               coneguda) o vincle d'un usuari de client existent.
//                                               Un correu que ja té compte a la web o al portal no es
//                                               pot fer servir: els comptes de client són separats.
//   desvincula  { usuari_id, client_id }
//   convida     { usuari_id }                   enllaç d'activació d'un sol ús (7 dies)
//   restableix  { usuari_id }                   enllaç de restabliment d'un sol ús (7 dies)
//   suspen | reactiva | revoca { usuari_id }    i bloqueja (o desbloqueja) el compte d'Auth
//   descarrega  { fitxer_id }                   URL signada de 60 s d'un fitxer rebut (només el
//                                               destinatari de l'enviament o l'OCIC: RLS)
// No s'envia cap correu: el panell obre la finestra "Copiar / Obrir correu".

import {
  base64url, clientAdmin, clientUsuari, entrada, ipClient, llegeixCos, nouToken, serveix, sha256Hex, verificaPersonal,
} from '../_shared/portal.ts';

const DIES_CADUCITAT = 7;
const BASE = (Deno.env.get('PORTAL_BASE_URL') || 'https://www.ambit.ad').replace(/\/+$/, '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SEGONS_DESCARREGA = 60;
const ESTAT_ERROR: Record<string, number> = { '42501': 403, 'P0002': 404, '23505': 409, '23514': 400, '22023': 400 };

serveix('portal-client-personal', async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const personal = await verificaPersonal(req, admin, resposta, 'personal');
  if (personal instanceof Response) return personal;

  const portal = admin.schema('portal');
  const cos = (await llegeixCos<Record<string, unknown>>(req)) || {};
  const accio = String(cos.accio || '');
  // Els missatges de les funcions SQL són per al personal (català, sense dades sensibles)
  const errorSql = (e: { code?: string; message?: string }) =>
    resposta(ESTAT_ERROR[e.code || ''] || 500, { error: ESTAT_ERROR[e.code || ''] ? e.message : 'Error intern' });

  const usuariId = String(cos.usuari_id || '');
  const clientId = String(cos.client_id || '');

  if (accio === 'llista') {
    if (!UUID.test(clientId)) return resposta(400, { error: 'Falta el client' });
    const { data, error } = await portal.rpc('client_usuaris_llista', { p_actor: personal.userId, p_client_id: clientId });
    if (error) return errorSql(error);
    return resposta(200, { ok: true, usuaris: data });
  }

  if (accio === 'afegeix') {
    const nom = String(cos.nom || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    const email = String(cos.email || '').trim().toLowerCase();
    if (!UUID.test(clientId)) return resposta(400, { error: 'Falta el client' });
    if (!nom || nom.length > 200) return resposta(400, { error: 'Falta el nom' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return resposta(400, { error: 'Correu no vàlid' });

    const { data: existent } = await portal.from('client_usuaris').select('id').eq('email', email).maybeSingle();
    let creat: string | null = null;
    if (!existent) {
      const { data: lliure } = await portal.rpc('client_correu_lliure', { p_email: email });
      if (lliure !== true) {
        return resposta(409, { error: 'Aquest correu ja té un compte a la web o al portal. L\'àrea de client necessita un compte propi: feu servir un altre correu.' });
      }
      // Contrasenya aleatòria que ningú no coneix: l'usuari en fixa una en activar l'accés
      const { data: u, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: base64url(crypto.getRandomValues(new Uint8Array(36))),
      });
      if (error || !u?.user) {
        console.error('createUser', error?.status);
        return resposta(500, { error: 'No s\'ha pogut crear el compte' });
      }
      creat = u.user.id;
    }
    const { data: id, error } = await portal.rpc('client_usuari_afegeix', {
      p_actor: personal.userId, p_client_id: clientId, p_nom: nom, p_email: email, p_user_id: creat,
    });
    if (error) {
      if (creat) await admin.auth.admin.deleteUser(creat);
      return errorSql(error);
    }
    return resposta(200, { ok: true, usuari_id: id });
  }

  if (accio === 'desvincula') {
    if (!UUID.test(usuariId) || !UUID.test(clientId)) return resposta(400, { error: 'Falten dades' });
    const { error } = await portal.rpc('client_desvincula', { p_actor: personal.userId, p_usuari_id: usuariId, p_client_id: clientId });
    if (error) return errorSql(error);
    return resposta(200, { ok: true });
  }

  if (accio === 'convida' || accio === 'restableix') {
    if (!UUID.test(usuariId)) return resposta(400, { error: 'Falta l\'usuari' });
    const token = nouToken();
    const expira = new Date(Date.now() + DIES_CADUCITAT * 24 * 3600 * 1000);
    const { error } = await portal.rpc('client_crea_token', {
      p_actor: personal.userId, p_usuari_id: usuariId, p_motiu: accio === 'convida' ? 'invitacio' : 'restabliment',
      p_token_hash: await sha256Hex(token), p_expira_at: expira.toISOString(),
    });
    if (error) return errorSql(error);
    const { data: u } = await portal.from('client_usuaris').select('nom, email').eq('id', usuariId).single();
    // El token va al fragment (#): el navegador no l'envia mai al servidor
    return resposta(200, { ok: true, enllac: `${BASE}/client/activar#${token}`, expira_at: expira.toISOString(), nom: u?.nom, email: u?.email });
  }

  if (accio === 'suspen' || accio === 'reactiva' || accio === 'revoca') {
    if (!UUID.test(usuariId)) return resposta(400, { error: 'Falta l\'usuari' });
    const { data: userId, error } = await portal.rpc('client_canvia_estat', { p_actor: personal.userId, p_usuari_id: usuariId, p_accio: accio });
    if (error) return errorSql(error);
    // Compte d'Auth: bloquejat mentre està suspès o revocat (no pot renovar la sessió)
    const { error: errBan } = await admin.auth.admin.updateUserById(userId, { ban_duration: accio === 'reactiva' ? 'none' : '876000h' });
    if (errBan) console.error('ban', accio, errBan.status);
    return resposta(200, { ok: true });
  }

  if (accio === 'descarrega') {
    const fitxerId = String(cos.fitxer_id || '');
    if (!UUID.test(fitxerId)) return resposta(400, { error: 'Falta el fitxer' });
    // Permís amb la sessió del personal (RLS: destinatari o OCIC)
    const { data: visible } = await clientUsuari(personal.jwt).schema('portal')
      .from('client_enviament_fitxers').select('id').eq('id', fitxerId).maybeSingle();
    if (!visible) return resposta(404, { error: 'Fitxer no disponible' });
    const { data, error } = await portal.rpc('client_registra_descarrega', {
      p_actor: personal.userId, p_fitxer_id: fitxerId, p_ip: ipClient(req), p_user_agent: (req.headers.get('user-agent') || '').slice(0, 500),
    });
    if (error) return errorSql(error);
    const { data: url } = await admin.storage.from('client-enviaments')
      .createSignedUrl(data.storage_path, SEGONS_DESCARREGA, { download: data.nom_fitxer });
    if (!url?.signedUrl) return resposta(500, { error: 'No s\'ha pogut generar l\'enllaç de descàrrega' });
    return resposta(200, { ok: true, url: url.signedUrl, nom_fitxer: data.nom_fitxer, sha256: data.sha256 });
  }

  return resposta(400, { error: 'Acció no vàlida' });
});
