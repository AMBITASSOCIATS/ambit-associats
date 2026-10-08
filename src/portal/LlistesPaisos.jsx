// src/portal/LlistesPaisos.jsx
// Llistes de països de risc dels comunicats tècnics de la UIFAND (només OCIC):
// CT UE i CT GAFI. Versionades: treure un país en registra la baixa (no
// s'esborra mai) i cada canvi queda a l'auditoria. Les marques dels KYC es
// calculen sempre amb la llista vigent; cada validació en desa les referències.
import React, { useCallback, useEffect, useState } from 'react';
import PAISOS from './kyc/paisos.json';
import { dataCurta, portal } from './portalApi';
import { Avis, Boto, Entrada, Selector, Targeta } from './ui';

const LlistesPaisos = () => {
  const [files, setFiles] = useState([]);
  const [historic, setHistoric] = useState(false);
  const [nou, setNou] = useState({ llista: 'UE', referencia: '', pais: '', nom: '', categoria: 'risc' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const carrega = useCallback(async () => {
    const { data, error: e } = await portal.from('paisos_risc')
      .select('id, llista, referencia, pais, nom, categoria, alta_at, baixa_at, motiu_baixa')
      .order('llista').order('categoria', { ascending: false }).order('nom');
    if (e) setError(e.message);
    setFiles(data || []);
  }, []);
  useEffect(() => { carrega(); }, [carrega]);

  const afegeix = async (e) => {
    e.preventDefault();
    setError(''); setOk('');
    const { error: er } = await portal.rpc('afegeix_pais_risc', {
      p_llista: nou.llista, p_referencia: nou.referencia, p_pais: nou.pais, p_nom: nou.nom, p_categoria: nou.categoria,
    });
    if (er) { setError(er.code === '23505' ? 'Aquest país ja és a la llista vigent' : er.message); return; }
    setOk('País afegit');
    setNou({ ...nou, pais: '', nom: '' });
    carrega();
  };

  const treu = async (f) => {
    const motiu = window.prompt(`Motiu per treure ${f.nom} de la llista ${f.llista} (p. ex. "Comunicat CT-0X/2026")`);
    if (!motiu?.trim()) return;
    setError(''); setOk('');
    const { error: er } = await portal.rpc('treu_pais_risc', { p_id: f.id, p_motiu: motiu.trim() });
    if (er) setError(er.message); else { setOk('País tret (en queda constància)'); carrega(); }
  };

  const vigents = files.filter((f) => !f.baixa_at);
  const Llista = ({ llista, titol }) => {
    const meves = vigents.filter((f) => f.llista === llista);
    const refs = [...new Set(meves.map((f) => f.referencia))].join(', ');
    return (
      <Targeta titol={`${titol} · ${refs || '—'} (${meves.length})`}>
        <div className="flex flex-wrap gap-2">
          {meves.map((f) => (
            <span key={f.id} className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${f.categoria === 'prohibicio_total' ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-800 border-red-200'}`}>
              {f.pais} · {f.nom}{f.categoria === 'prohibicio_total' ? ' · prohibició total' : ''}
              <button type="button" onClick={() => treu(f)} className="font-bold opacity-70 hover:opacity-100" aria-label={`Treure ${f.nom}`}>×</button>
            </span>
          ))}
        </div>
      </Targeta>
    );
  };

  return (
    <div className="space-y-6">
      <Avis tipus="ok">{ok}</Avis>
      <Avis>{error}</Avis>
      <Llista llista="UE" titol="Països de risc segons la Unió Europea" />
      <Llista llista="GAFI" titol="Països de risc segons el GAFI" />

      <Targeta titol="Afegir un país">
        <form onSubmit={afegeix} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <Selector etiqueta="Llista" value={nou.llista} onChange={(e) => setNou({ ...nou, llista: e.target.value, categoria: e.target.value === 'UE' ? 'risc' : nou.categoria })}>
            <option value="UE">Unió Europea</option>
            <option value="GAFI">GAFI</option>
          </Selector>
          <Entrada etiqueta="Comunicat (referència)" required value={nou.referencia} placeholder="CT-01/2026" maxLength={60}
            onChange={(e) => setNou({ ...nou, referencia: e.target.value })} />
          <Selector etiqueta="País" value={nou.pais} onChange={(e) => {
            const p = PAISOS.find((x) => x.codi === e.target.value);
            setNou({ ...nou, pais: e.target.value, nom: nou.nom || p?.ca || '' });
          }}>
            <option value="">—</option>
            {PAISOS.map((p) => <option key={p.codi} value={p.codi}>{p.ca} ({p.codi})</option>)}
          </Selector>
          <Entrada etiqueta="Nom tal com surt al comunicat" required value={nou.nom} maxLength={120} onChange={(e) => setNou({ ...nou, nom: e.target.value })} />
          <Selector etiqueta="Categoria" value={nou.categoria} onChange={(e) => setNou({ ...nou, categoria: e.target.value })}>
            <option value="risc">Risc (diligència reforçada)</option>
            {nou.llista === 'GAFI' && <option value="prohibicio_total">Prohibició total</option>}
          </Selector>
          <div className="md:col-span-5"><Boto type="submit" disabled={!nou.pais || !nou.referencia.trim() || !nou.nom.trim()}>Afegir</Boto></div>
        </form>
      </Targeta>

      <Targeta titol="Historial de canvis" accions={<Boto variant="secundari" onClick={() => setHistoric(!historic)}>{historic ? 'Amagar' : 'Mostrar'}</Boto>}>
        {historic && (
          <div className="divide-y divide-gray-100 text-xs">
            {files.filter((f) => f.baixa_at).map((f) => (
              <p key={f.id} className="py-1.5 text-gray-600">
                {f.llista} · {f.referencia} · {f.pais} {f.nom} · alta {dataCurta(f.alta_at)} · baixa {dataCurta(f.baixa_at)} ({f.motiu_baixa})
              </p>
            ))}
            {files.every((f) => !f.baixa_at) && <p className="py-2 text-gray-400">Cap baixa registrada</p>}
          </div>
        )}
      </Targeta>
    </div>
  );
};

export default LlistesPaisos;
