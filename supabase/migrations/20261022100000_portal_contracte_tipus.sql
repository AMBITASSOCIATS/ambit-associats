-- =============================================================================
-- Portal de signatura · Contractes (1 de 2)
-- Valors nous dels enums. Van en una migració a part perquè un valor afegit
-- amb ALTER TYPE ... ADD VALUE no es pot fer servir dins de la mateixa
-- transacció en què s'ha creat.
-- =============================================================================

-- Contracte que puja el personal i signen un o més signants del client i ÀMBIT
alter type portal.document_type add value if not exists 'contracte';

-- Estats propis del contracte: alguns signants del client han signat, i tots
-- han signat i falta la signatura d'ÀMBIT
alter type portal.request_status add value if not exists 'parcialment_signat' after 'en_curs';
alter type portal.request_status add value if not exists 'pendent_ambit' after 'parcialment_signat';

-- PDF original del contracte, tal com l'ha pujat el personal (no es modifica mai)
alter type portal.doc_kind add value if not exists 'original';
