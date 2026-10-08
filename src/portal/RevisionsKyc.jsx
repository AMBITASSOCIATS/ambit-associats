// src/portal/RevisionsKyc.jsx
// Revisions KYC (només OCIC, CT-01/2023): darrer KYC validat de cada client
// amb la relació vigent, vençut o que venç en els propers 90 dies. Crear la
// revisió obre una sol·licitud nova preomplerta amb les dades validades.
import React, { useCallback, useEffect, useState } from 'react';
import { NIVELLS, dataCurta, invoca, nomEstat, portal } from './portalApi';
import { Avis, Boto, Targeta } from './ui';

const RevisionsKyc = ({ onObreSolicitud }) => {
  const [files, setFiles] = useState(null);
  const [error, setError] = useState('');
  const [ocupat, setOcupat] = useState(null);

  const carrega = useCallback(async () => {
    const { data, error: e } = await portal.rpc('revisions_kyc', { p_dies: 90 });
    if (e) setError(e.message);
    setFiles(data || []);
  }, []);
  useEffect(() => { carrega(); }, [carrega]);

  const crea = async (f) => {
    setError('');
    setOcupat(f.request_id);
    try {
      const r = await invoca('portal-kyc-personal', { accio: 'crea', client_id: f.client_id, revisio_de: f.request_id, motiu: 'Revisió periòdica' });
      onObreSolicitud(r.request_id);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupat(null);
    }
  };

  const vencudes = (files || []).filter((f) => f.vencuda);
  const properes = (files || []).filter((f) => !f.vencuda);

  const Taula = ({ llista, buit }) => (
    llista.length === 0 ? <p className="text-sm text-gray-400 py-4 text-center">{buit}</p> : (
      <div className="divide-y divide-gray-100">
        {llista.map((f) => (
          <div key={f.request_id} className="py-3 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-semibold text-gray-800">{f.nom_mostrat}</p>
              <p className="text-xs text-gray-400">
                <span className="font-mono">{f.referencia_client || 'sense referència'}</span> · diligència {NIVELLS[f.nivell]?.toLowerCase()} ·
                validat {dataCurta(f.validat_at)} · revisió <strong className={f.vencuda ? 'text-red-600' : 'text-amber-600'}>{dataCurta(f.propera_revisio)}</strong>
              </p>
            </div>
            {f.revisio_en_curs ? (
              <button type="button" onClick={() => onObreSolicitud(f.revisio_en_curs)} className="text-xs text-[#009B9C] hover:underline">
                Revisió en curs ({nomEstat(f.revisio_estat, 'kyc_pf')}) →
              </button>
            ) : (
              <Boto onClick={() => crea(f)} disabled={ocupat === f.request_id}>{ocupat === f.request_id ? 'Creant…' : 'Crear revisió'}</Boto>
            )}
            <button type="button" onClick={() => onObreSolicitud(f.request_id)} className="text-xs text-gray-500 hover:underline">KYC validat</button>
          </div>
        ))}
      </div>
    )
  );

  if (!files) return <p className="text-sm text-gray-400">{error || 'Carregant...'}</p>;
  return (
    <div className="space-y-6">
      <Avis>{error}</Avis>
      <Targeta titol={`Revisions vençudes (${vencudes.length})`}>
        <Taula llista={vencudes} buit="Cap revisió vençuda" />
      </Targeta>
      <Targeta titol={`Revisions dels propers 90 dies (${properes.length})`}>
        <Taula llista={properes} buit="Cap revisió en els propers 90 dies" />
      </Targeta>
      <p className="text-xs text-gray-400">
        Termini segons el risc (CT-01/2023): reduït 5 anys, normal 3 anys, alt 1 any (paràmetre a portal.config_kyc).
        Per un fet rellevant, crea la revisió des del detall del KYC validat. Els clients amb la relació finalitzada no hi surten.
      </p>
    </div>
  );
};

export default RevisionsKyc;
