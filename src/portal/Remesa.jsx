// src/portal/Remesa.jsx
// Autoritzacions actives i exportació CSV per preparar la remesa. L'IBAN
// complet només el desxifra el servidor en exportar, i cada exportació queda
// al registre d'auditoria.
import React, { useEffect, useState } from 'react';
import { ENTITATS, dataCurta, ibanEmmascarat, invoca, portal } from './portalApi';
import { Avis, Boto, Targeta } from './ui';

const Remesa = ({ onObreSolicitud }) => {
  const [files, setFiles] = useState([]);
  const [carregant, setCarregant] = useState(true);
  const [exportant, setExportant] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    portal.from('requests')
      .select('id, activat_at, clients(nom_mostrat, referencia_client), autoritzacions_carrec(titular_nom, entitat, iban_ultims4, data_alta)')
      .eq('status', 'actiu')
      .eq('document_type', 'autoritzacio_carrec')
      .then(({ data }) => {
        const ordenades = (data || []).sort((a, b) =>
          (a.clients.referencia_client || '').localeCompare(b.clients.referencia_client || ''));
        setFiles(ordenades);
        setCarregant(false);
      });
  }, []);

  const exporta = async () => {
    setError('');
    setOk('');
    setExportant(true);
    try {
      const r = await invoca('portal-remesa', {});
      const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.nom_fitxer;
      a.click();
      URL.revokeObjectURL(url);
      setOk(`Exportades ${r.files} autoritzacions. L'exportació queda registrada.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setExportant(false);
    }
  };

  return (
    <Targeta titol={`Autoritzacions actives (${files.length})`}
      accions={<Boto onClick={exporta} disabled={exportant || files.length === 0}>{exportant ? 'Exportant...' : 'Exportar CSV'}</Boto>}>
      <p className="text-xs text-gray-500 mb-4">
        El fitxer CSV conté la referència, el titular, l'entitat i l'IBAN complet. Guarda'l en un lloc segur i
        esborra'l quan ja no el necessitis.
      </p>
      <div className="space-y-2 mb-4">
        <Avis>{error}</Avis>
        <Avis tipus="ok">{ok}</Avis>
      </div>
      {carregant ? (
        <p className="text-sm text-gray-400 py-6 text-center">Carregant...</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Cap autorització activa</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4">Referència</th>
                <th className="py-2 pr-4">Titular</th>
                <th className="py-2 pr-4">Entitat</th>
                <th className="py-2 pr-4">IBAN</th>
                <th className="py-2">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {files.map((f) => {
                const a = f.autoritzacions_carrec?.[0] || f.autoritzacions_carrec || {};
                return (
                  <tr key={f.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onObreSolicitud(f.id)}>
                    <td className="py-2 pr-4 font-mono text-xs">{f.clients.referencia_client}</td>
                    <td className="py-2 pr-4">{a.titular_nom}</td>
                    <td className="py-2 pr-4">{ENTITATS[a.entitat]}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{ibanEmmascarat(a.iban_ultims4)}</td>
                    <td className="py-2">{dataCurta(a.data_alta)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Targeta>
  );
};

export default Remesa;
