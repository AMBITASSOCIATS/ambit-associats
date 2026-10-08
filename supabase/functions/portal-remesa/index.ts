// supabase/functions/portal-remesa/index.ts
//
// Exporta en CSV les autoritzacions actives per preparar la remesa:
// referència, titular, entitat i IBAN complet (desxifrat aquí, mai a la base
// ni al navegador fins a la descàrrega). Només personal actiu. Cada
// exportació queda a portal.audit_log (ho fa portal.remesa_exporta).

import {
  clientAdmin, desxifraIban, deHex, entrada, ipClient, verificaPersonal, NOM_ENTITAT,
} from '../_shared/portal.ts';

// Camp CSV: entre cometes si cal; neutralitza fórmules en obrir-lo amb un full de càlcul.
const campCsv = (v: unknown): string => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

Deno.serve(async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const personal = await verificaPersonal(req, admin, resposta, 'personal');
  if (personal instanceof Response) return personal;

  const { data: files, error } = await admin.schema('portal').rpc('remesa_exporta', {
    p_actor: personal.userId,
    p_ip: ipClient(req),
    p_user_agent: (req.headers.get('user-agent') || '').slice(0, 500) || null,
  });
  if (error) {
    console.error('remesa_exporta', error.code);
    return resposta(error.code === '42501' ? 403 : 500, { error: 'No s\'ha pogut exportar la remesa' });
  }

  const linies = ['Referència;Titular;Entitat;IBAN'];
  for (const f of files as { request_id: string; referencia_client: string; titular_nom: string; entitat: string; iban_xifrat: string }[]) {
    let iban: string;
    try {
      iban = await desxifraIban(deHex(f.iban_xifrat), f.request_id);
    } catch {
      console.error('No s\'ha pogut desxifrar l\'IBAN de', f.request_id);
      return resposta(500, { error: 'No s\'ha pogut desxifrar un IBAN. Reviseu PORTAL_IBAN_KEY.' });
    }
    linies.push([f.referencia_client, f.titular_nom, NOM_ENTITAT[f.entitat] || f.entitat, iban].map(campCsv).join(';'));
  }

  const avui = new Date().toISOString().slice(0, 10);
  return resposta(200, {
    ok: true,
    files: linies.length - 1,
    nom_fitxer: `remesa-autoritzacions-${avui}.csv`,
    // BOM perquè el full de càlcul llegeixi bé els accents
    csv: '﻿' + linies.join('\r\n') + '\r\n',
  });
});
