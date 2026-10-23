// src/portal/contracte/original.js
// Puja el PDF original d'un contracte en esborrany: URL signada, pujada a
// portal-docs i comprovació i registre al servidor (PDF vàlid, sense xifrar).
import { supabase } from '../../supabaseClient';
import { invoca } from '../portalApi';

export const pujaOriginal = async (requestId, fitxer) => {
  const u = await invoca('portal-contracte-personal', {
    accio: 'url_original', request_id: requestId, mime: fitxer.type, mida: fitxer.size,
  });
  const { error } = await supabase.storage.from('portal-docs')
    .uploadToSignedUrl(u.path, u.upload_token, fitxer, { contentType: 'application/pdf' });
  if (error) throw new Error('No s\'ha pogut pujar el PDF');
  return invoca('portal-contracte-personal', {
    accio: 'registra_original', request_id: requestId, path: u.path, nom_fitxer: fitxer.name,
  });
};
