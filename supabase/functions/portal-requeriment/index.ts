// supabase/functions/portal-requeriment/index.ts
//
// "Accés per requeriment d'autoritat": l'única via per consultar una
// sol·licitud bloquejada per conservació. Només OCIC, amb motiu i autoritat
// requeridora obligatoris. Cada accés queda a audit_log (ACCES_REQUERIMENT,
// ho fa portal.acces_requeriment). Els documents es lliuren amb URL signades
// de 60 segons.

import { clientAdmin, entrada, ipClient, llegeixCos, text, verificaPersonal } from '../_shared/portal.ts';

const ESTAT_ERROR: Record<string, number> = { '42501': 403, 'P0002': 404, '23514': 400 };

Deno.serve(async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const personal = await verificaPersonal(req, admin, resposta, 'ocic');
  if (personal instanceof Response) return personal;

  const cos = await llegeixCos<{ request_id?: string; motiu?: string; autoritat?: string }>(req);
  const requestId = cos?.request_id || '';
  if (!/^[0-9a-f-]{36}$/.test(requestId)) return resposta(400, { error: 'Falta la sol·licitud' });

  const { data, error } = await admin.schema('portal').rpc('acces_requeriment', {
    p_actor: personal.userId,
    p_request_id: requestId,
    p_motiu: text(cos?.motiu, 500),
    p_autoritat: text(cos?.autoritat, 200),
    p_ip: ipClient(req),
    p_user_agent: (req.headers.get('user-agent') || '').slice(0, 500) || null,
  });
  if (error) {
    const estat = ESTAT_ERROR[error.code];
    return resposta(estat || 500, { error: estat ? error.message : 'Error intern' });
  }

  const documents = [];
  for (const d of (data.documents || []) as { storage_path: string; kind: string }[]) {
    const ext = d.storage_path.split('.').pop();
    const { data: url } = await admin.storage.from('portal-docs')
      .createSignedUrl(d.storage_path, 60, { download: `${d.kind}-${requestId.slice(0, 8)}.${ext}` });
    documents.push({ ...d, url: url?.signedUrl ?? null });
  }

  return resposta(200, { ok: true, dades: { ...data, documents } });
});
