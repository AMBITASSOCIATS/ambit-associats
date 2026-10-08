// src/portal/Personal.jsx
// Personal del portal (només OCIC): alta i baixa de gestors pel correu d'un
// usuari que ja tingui compte a la web. Ningú es pot gestionar a si mateix.
import React, { useCallback, useEffect, useState } from 'react';
import { dataCurta, invoca } from './portalApi';
import { Avis, Boto, Entrada, Targeta } from './ui';

const Personal = ({ usuariActual }) => {
  const [personal, setPersonal] = useState([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupat, setOcupat] = useState(false);

  const carrega = useCallback(async () => {
    try {
      const r = await invoca('portal-personal', { accio: 'llistar' });
      setPersonal(r.personal || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { carrega(); }, [carrega]);

  const fes = async (accio, correu) => {
    setError('');
    setOk('');
    setOcupat(true);
    try {
      await invoca('portal-personal', { accio, email: correu });
      setOk(accio === 'alta' ? `${correu} ja és gestor del portal.` : `${correu} ja no té accés al portal.`);
      if (accio === 'alta') setEmail('');
      await carrega();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupat(false);
    }
  };

  return (
    <div className="space-y-6">
      <Targeta titol="Donar d'alta un gestor">
        <form onSubmit={(e) => { e.preventDefault(); fes('alta', email.trim()); }} className="flex flex-wrap items-end gap-3">
          <Entrada etiqueta="Correu de l'usuari" type="email" required value={email} className="flex-1 min-w-[240px]"
            onChange={(e) => setEmail(e.target.value)}
            ajuda="Ha de tenir compte a la web d'ÀMBIT. Els OCIC només es donen d'alta per migració." />
          <Boto type="submit" disabled={ocupat || !email.trim()}>Donar d'alta</Boto>
        </form>
        <div className="mt-3 space-y-2">
          <Avis>{error}</Avis>
          <Avis tipus="ok">{ok}</Avis>
        </div>
      </Targeta>

      <Targeta titol={`Personal del portal (${personal.length})`}>
        <div className="divide-y divide-gray-100">
          {personal.map((p) => (
            <div key={p.user_id} className="py-3 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-semibold text-gray-800">
                  {p.email}
                  {p.user_id === usuariActual && <span className="ml-2 text-[#009B9C] text-xs">(Tu)</span>}
                </p>
                <p className="text-xs text-gray-400">
                  {p.role === 'ocic' ? 'OCIC' : 'Gestor'} · {p.actiu ? 'actiu' : 'de baixa'} · des del {dataCurta(p.created_at)}
                </p>
              </div>
              {p.role === 'gestor' && p.user_id !== usuariActual && (
                p.actiu
                  ? <Boto variant="perill" disabled={ocupat} onClick={() => fes('baixa', p.email)}>Donar de baixa</Boto>
                  : <Boto variant="secundari" disabled={ocupat} onClick={() => fes('alta', p.email)}>Reactivar</Boto>
              )}
            </div>
          ))}
        </div>
      </Targeta>
    </div>
  );
};

export default Personal;
