-- =============================================================================
-- Portal de signatura · Comunicació de dades personals i familiars al pagador
-- (IRPF) (1 de 2)
-- Valors nous dels enums. Van en una migració a part perquè un valor afegit
-- amb ALTER TYPE ... ADD VALUE no es pot fer servir dins de la mateixa
-- transacció en què s'ha creat.
-- =============================================================================

-- Comunicació de dades al pagador de rendes del treball (art. 28.5 del Reglament de l'IRPF)
alter type portal.document_type add value if not exists 'irpf_comunicacio';

-- PDF d'ÀMBIT amb el full intern del càlcul del percentatge (mai per al perceptor)
alter type portal.doc_kind add value if not exists 'intern';
