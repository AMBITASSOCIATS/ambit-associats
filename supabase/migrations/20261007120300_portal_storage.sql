-- =============================================================================
-- Portal de signatura de clients ÀMBIT · Fase 1 · Pas F
-- Bucket privat portal-docs. Només el personal actiu hi llegeix i hi puja fitxers;
-- el client hi accedirà amb URL signades de curta durada (fase 3).
--
-- NOTA PER A LA FASE 3: service_role té accés total a Storage (se salta l'RLS
-- de storage.objects), i això no es pot limitar des d'aquí. Les funcions que
-- l'utilitzin NO han de sobreescriure (upsert) ni esborrar mai cap fitxer de
-- portal-docs: sempre camins nous. La integritat de cada fitxer es verifica
-- comparant-ne el SHA-256 amb portal.documents.sha256.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-docs', 'portal-docs', false, 20971520,  -- 20 MB
        array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy portal_docs_personal_select on storage.objects
  for select to authenticated
  using (bucket_id = 'portal-docs' and portal.is_staff());

create policy portal_docs_personal_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'portal-docs' and portal.is_staff());

-- Sense polítiques d'UPDATE ni de DELETE: els fitxers no se sobreescriuen ni s'esborren.
