// supabase/functions/portal-personal/index.ts
//
// Gestió del personal del portal. Només OCIC.
//   llistar          personal amb el seu correu
//   alta  { email }  dona d'alta (o reactiva) un gestor; l'usuari ha d'existir a la web
//   baixa { email }  desactiva un gestor (no s'esborra mai)
// Ningú es pot gestionar a si mateix i els OCIC només es gestionen per migració
// (ho comproven les funcions SQL).

import { clientAdmin, entrada, llegeixCos, verificaPersonal } from '../_shared/portal.ts';

const ESTAT_ERROR: Record<string, number> = { '42501': 403, 'P0002': 404 };

Deno.serve(async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const personal = await verificaPersonal(req, admin, resposta, 'ocic');
  if (personal instanceof Response) return personal;

  const cos = await llegeixCos<{ accio?: string; email?: string }>(req);
  const portal = admin.schema('portal');

  if (cos?.accio === 'llistar') {
    const { data, error } = await portal.rpc('llista_personal', { p_actor: personal.userId });
    if (error) return resposta(ESTAT_ERROR[error.code] || 500, { error: error.message });
    return resposta(200, { ok: true, personal: data });
  }

  if (cos?.accio !== 'alta' && cos?.accio !== 'baixa') return resposta(400, { error: 'Acció no vàlida' });

  const email = String(cos.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resposta(400, { error: 'Correu no vàlid' });

  const { error } = await portal.rpc(cos.accio === 'alta' ? 'alta_gestor' : 'baixa_gestor', {
    p_actor: personal.userId,
    p_email: email,
  });
  if (error) {
    // Els missatges de les funcions SQL són per a l'usuari (català, sense dades sensibles)
    return resposta(ESTAT_ERROR[error.code] || 500, { error: ESTAT_ERROR[error.code] ? error.message : 'Error intern' });
  }
  return resposta(200, { ok: true });
});
