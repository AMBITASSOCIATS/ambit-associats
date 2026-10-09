-- =============================================================================
-- Portal · KYC, correccions (1 de 2)
-- Valor nou de l'enum (migració a part: un valor afegit amb ADD VALUE no es pot
-- fer servir dins de la mateixa transacció).
-- =============================================================================

-- Còpia per al client del KYC validat: el KYC signat sense l'apartat reservat
-- a ÀMBIT i amb el bloc de recepció signat per l'OCIC
alter type portal.doc_kind add value if not exists 'copia_client';
