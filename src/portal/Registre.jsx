// src/portal/Registre.jsx
// Visor del registre d'auditoria (només OCIC; la base ho limita amb RLS).
import React, { useCallback, useEffect, useState } from 'react';
import { dataHora, invoca, portal } from './portalApi';
import { Boto, Entrada, Selector, Targeta } from './ui';

const ENTITATS = ['clients', 'requests', 'autoritzacions_carrec', 'access_tokens', 'signatures', 'documents', 'staff_profiles', 'remesa'];
const ACCIONS = ['INSERT', 'UPDATE', 'DELETE', 'EXPORT'];
const PAGINA = 100;

const Registre = () => {
  const [files, setFiles] = useState([]);
  const [filtres, setFiltres] = useState({ entitat: '', accio: '', actor: '', des: '', fins: '', id: '' });
  const [personal, setPersonal] = useState({});
  const [hiHaMes, setHiHaMes] = useState(false);
  const [obert, setObert] = useState(null);
  const [carregant, setCarregant] = useState(false);

  useEffect(() => {
    invoca('portal-personal', { accio: 'llistar' })
      .then((r) => setPersonal(Object.fromEntries((r.personal || []).map((p) => [p.user_id, p.email]))))
      .catch(() => {});
  }, []);

  const carrega = useCallback(async (desDe = 0) => {
    setCarregant(true);
    let q = portal.from('audit_log')
      .select('id, at, actor, accio, entitat, entitat_id, ip, user_agent, detalls')
      .order('at', { ascending: false })
      .range(desDe, desDe + PAGINA - 1);
    if (filtres.entitat) q = q.eq('entitat', filtres.entitat);
    if (filtres.accio) q = q.eq('accio', filtres.accio);
    if (filtres.actor) q = q.eq('actor', filtres.actor);
    if (filtres.des) q = q.gte('at', new Date(`${filtres.des}T00:00:00`).toISOString());
    if (filtres.fins) q = q.lte('at', new Date(`${filtres.fins}T23:59:59`).toISOString());
    if (/^[0-9a-f-]{36}$/i.test(filtres.id.trim())) q = q.eq('entitat_id', filtres.id.trim());
    const { data } = await q;
    setFiles((prev) => (desDe ? [...prev, ...(data || [])] : data || []));
    setHiHaMes((data || []).length === PAGINA);
    setCarregant(false);
  }, [filtres]);

  useEffect(() => { carrega(0); }, [carrega]);

  const f = (k) => (e) => setFiltres({ ...filtres, [k]: e.target.value });

  return (
    <Targeta titol="Registre d'auditoria">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        <Selector etiqueta="Taula" value={filtres.entitat} onChange={f('entitat')}>
          <option value="">Totes</option>
          {ENTITATS.map((e) => <option key={e} value={e}>{e}</option>)}
        </Selector>
        <Selector etiqueta="Acció" value={filtres.accio} onChange={f('accio')}>
          <option value="">Totes</option>
          {ACCIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </Selector>
        <Selector etiqueta="Qui" value={filtres.actor} onChange={f('actor')}>
          <option value="">Tothom</option>
          {Object.entries(personal).map(([id, email]) => <option key={id} value={id}>{email}</option>)}
        </Selector>
        <Entrada etiqueta="Des de" type="date" value={filtres.des} onChange={f('des')} />
        <Entrada etiqueta="Fins a" type="date" value={filtres.fins} onChange={f('fins')} />
        <Entrada etiqueta="Identificador" value={filtres.id} onChange={f('id')} placeholder="uuid" />
      </div>

      <div className="divide-y divide-gray-100">
        {files.map((r) => (
          <div key={r.id} className="py-2">
            <button className="w-full text-left flex flex-wrap items-center gap-3 text-xs" onClick={() => setObert(obert === r.id ? null : r.id)}>
              <span className="text-gray-500 w-32">{dataHora(r.at)}</span>
              <span className="font-semibold w-16">{r.accio}</span>
              <span className="w-40">{r.entitat}</span>
              <span className="flex-1 text-gray-500 truncate">
                {r.actor ? personal[r.actor] || r.actor : 'client / sistema'}
                {r.ip && ` · ${r.ip}`}
              </span>
              <span className="text-[#009B9C]">{obert === r.id ? '▲' : '▼'}</span>
            </button>
            {obert === r.id && (
              <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify({ entitat_id: r.entitat_id, user_agent: r.user_agent, ...r.detalls }, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
      {!carregant && files.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">Cap registre</p>}
      {hiHaMes && (
        <div className="mt-4 text-center">
          <Boto variant="secundari" disabled={carregant} onClick={() => carrega(files.length)}>Carregar-ne més</Boto>
        </div>
      )}
    </Targeta>
  );
};

export default Registre;
