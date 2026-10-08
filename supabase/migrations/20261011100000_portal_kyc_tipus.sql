-- =============================================================================
-- Portal de signatura · KYC i protecció de dades (1 de 2)
-- Valors nous dels enums. Van en una migració a part perquè un valor afegit
-- amb ALTER TYPE ... ADD VALUE no es pot fer servir dins de la mateixa
-- transacció en què s'ha creat.
-- =============================================================================

-- Formulari d'identificació del client (persona física i jurídica) i
-- informació sobre protecció de dades
alter type portal.document_type add value if not exists 'kyc_pf';
alter type portal.document_type add value if not exists 'kyc_pj';
alter type portal.document_type add value if not exists 'pdp';

-- PDF final del KYC amb l'apartat d'ÀMBIT i la signatura de l'OCIC
alter type portal.doc_kind add value if not exists 'validat';
