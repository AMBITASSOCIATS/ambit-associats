// supabase/functions/portal-enllac/index.ts
//
// Genera (o regenera) l'enllaç de signatura d'una sol·licitud. Només el pot
// cridar el personal actiu del portal.
//
// - Token de 32 bytes aleatoris; a la base només se'n desa el hash SHA-256.
// - Caduca als 7 dies i és d'un sol ús (es consumeix en signar).
// - Si la sol·licitud és un esborrany, la passa a 'enviat' amb la sessió del
//   personal (la base exigeix que aquest pas el faci el personal, no el servei).
// - Regenerar revoca l'enllaç anterior. No es pot fer un cop signada.

import { clientAdmin, clientUsuari, entrada, llegeixCos, nouToken, sha256Hex, verificaPersonal } from '../_shared/portal.ts';

const DIES_CADUCITAT = 7;
const BASE = (Deno.env.get('PORTAL_BASE_URL') || 'https://www.ambit.ad').replace(/\/+$/, '');

Deno.serve(async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const personal = await verificaPersonal(req, admin, resposta, 'personal');
  if (personal instanceof Response) return personal;

  const cos = await llegeixCos<{ request_id?: string }>(req);
  const requestId = cos?.request_id;
  if (!requestId || !/^[0-9a-f-]{36}$/.test(requestId)) return resposta(400, { error: 'Falta la sol·licitud' });

  const { data: sol } = await admin.schema('portal')
    .from('requests').select('id, status').eq('id', requestId).maybeSingle();
  if (!sol) return resposta(404, { error: 'Sol·licitud inexistent' });
  if (!['esborrany', 'enviat', 'en_curs'].includes(sol.status)) {
    return resposta(409, { error: 'Aquesta sol·licitud ja no admet cap enllaç nou' });
  }

  // 1. esborrany → enviat, amb la sessió del personal
  if (sol.status === 'esborrany') {
    const { error } = await clientUsuari(personal.jwt).schema('portal')
      .from('requests')
      .update({ status: 'enviat', enviat_at: new Date().toISOString() })
      .eq('id', requestId);
    if (error) {
      console.error('enviat', error.code);
      return resposta(403, { error: 'No s\'ha pogut marcar la sol·licitud com a enviada' });
    }
  }

  // 2. Token nou (revoca l'anterior)
  const token = nouToken();
  const expira = new Date(Date.now() + DIES_CADUCITAT * 24 * 3600 * 1000);
  const { error: errTok } = await admin.schema('portal').rpc('crea_token', {
    p_actor: personal.userId,
    p_request_id: requestId,
    p_token_hash: await sha256Hex(token),
    p_expira_at: expira.toISOString(),
  });
  if (errTok) {
    console.error('crea_token', errTok.code);
    return resposta(errTok.code === '42501' ? 403 : 409, { error: 'No s\'ha pogut generar l\'enllaç' });
  }

  return resposta(200, { ok: true, enllac: `${BASE}/signar/${token}`, expira_at: expira.toISOString() });
});
