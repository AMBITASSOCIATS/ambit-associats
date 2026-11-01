// src/portal/UsuarisAreaClient.jsx
// Fitxa del client · usuaris de l'àrea de client: alta (nom i correu), vincle
// d'un usuari existent, invitació i restabliment (enllaç d'un sol ús de 7 dies
// i finestra "Copiar / Obrir correu"), suspensió, reactivació, revocació i
// desvinculació. Tot passa per l'Edge Function portal-client-personal.
import React, { useCallback, useEffect, useState } from 'react';
import ModalMissatge from '../auth/ModalMissatge';
import { dataCurta, dataHora, invoca, missatgeAreaClient } from './portalApi';
import { Avis, Boto, Entrada } from './ui';

const ESTAT = {
  pendent: { nom: 'Pendent d\'activació', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  actiu: { nom: 'Actiu', color: 'bg-green-100 text-green-700 border-green-200' },
  suspes: { nom: 'Suspès', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  revocat: { nom: 'Revocat', color: 'bg-red-100 text-red-700 border-red-200' },
};

const UsuarisAreaClient = ({ client }) => {
  const [usuaris, setUsuaris] = useState(null);
  const [nou, setNou] = useState({ nom: '', email: '' });
  const [error, setError] = useState('');
  const [ocupat, setOcupat] = useState(false);
  const [missatge, setMissatge] = useState(null);

  const carrega = useCallback(async () => {
    try {
      const r = await invoca('portal-client-personal', { accio: 'llista', client_id: client.id });
      setUsuaris(r.usuaris || []);
    } catch (e) {
      setError(e.message);
    }
  }, [client.id]);
  useEffect(() => { carrega(); }, [carrega]);

  const fes = async (cos, confirmacio) => {
    if (confirmacio && !window.confirm(confirmacio)) return null;
    setError('');
    setOcupat(true);
    try {
      const r = await invoca('portal-client-personal', cos);
      await carrega();
      return r;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setOcupat(false);
    }
  };

  const afegeix = async (e) => {
    e.preventDefault();
    const r = await fes({ accio: 'afegeix', client_id: client.id, nom: nou.nom.trim(), email: nou.email.trim() });
    if (r) setNou({ nom: '', email: '' });
  };

  const enllac = async (u, tipus) => {
    const r = await fes({ accio: tipus === 'invitacio' ? 'convida' : 'restableix', usuari_id: u.usuari_id });
    if (r) setMissatge(missatgeAreaClient({ tipus, nom: r.nom, enllac: r.enllac, expira: r.expira_at, email: r.email }));
  };

  return (
    <div className="w-full border border-[#007A7B]/30 bg-[#007A7B]/5 rounded-lg p-4 space-y-3">
      <p className="text-xs font-bold text-[#007A7B]">Àrea de client · usuaris de {client.nom_mostrat}</p>
      {usuaris === null ? (
        <p className="text-xs text-[#6B8280]">Carregant...</p>
      ) : usuaris.length === 0 ? (
        <p className="text-xs text-[#6B8280]">Cap usuari</p>
      ) : (
        <div className="divide-y divide-[#D6E4E2] bg-white rounded-lg border border-[#D6E4E2]">
          {usuaris.map((u) => (
            <div key={u.usuari_id} className="px-3 py-2 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <p className="text-sm font-semibold text-[#12302F]">{u.nom} <span className="font-normal text-[#4E6765]">· {u.email}</span></p>
                <p className="text-[11px] text-[#6B8280]">
                  {u.activat_at ? `Activat ${dataCurta(u.activat_at)}` : 'Encara no s\'ha activat'}
                  {u.darrer_acces && ` · darrer accés ${dataHora(u.darrer_acces)}`}
                  {u.altres_clients > 0 && ` · vinculat a ${u.altres_clients} client${u.altres_clients > 1 ? 's' : ''} més`}
                  {u.enllac && ` · enllaç de ${u.enllac.motiu === 'invitacio' ? 'invitació' : 'restabliment'} vigent fins al ${dataCurta(u.enllac.expira_at)}`}
                  {u.bloquejat_fins && new Date(u.bloquejat_fins) > new Date() && ` · bloquejat per intents fallits fins a les ${dataHora(u.bloquejat_fins)}`}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ESTAT[u.estat]?.color}`}>{ESTAT[u.estat]?.nom}</span>
              {u.estat === 'pendent' && !u.activat_at && <Boto disabled={ocupat} onClick={() => enllac(u, 'invitacio')}>Convidar</Boto>}
              {u.activat_at && ['actiu', 'pendent'].includes(u.estat) && (
                <Boto variant="secundari" disabled={ocupat} onClick={() => enllac(u, 'restabliment')}>Restablir l'accés</Boto>
              )}
              {['actiu', 'pendent'].includes(u.estat) && (
                <Boto variant="secundari" disabled={ocupat}
                  onClick={() => fes({ accio: 'suspen', usuari_id: u.usuari_id }, `Suspendre l'accés de ${u.nom}? No podrà entrar fins que el reactiveu.`)}>
                  Suspendre
                </Boto>
              )}
              {u.estat === 'suspes' && <Boto variant="secundari" disabled={ocupat} onClick={() => fes({ accio: 'reactiva', usuari_id: u.usuari_id })}>Reactivar</Boto>}
              {u.estat !== 'revocat' && (
                <Boto variant="secundari" disabled={ocupat}
                  onClick={() => fes({ accio: 'desvincula', usuari_id: u.usuari_id, client_id: client.id }, `Treure ${u.nom} d'aquest client? Si està vinculat a altres clients, hi continuarà tenint accés.`)}>
                  Desvincular
                </Boto>
              )}
              {u.estat !== 'revocat' && (
                <Boto variant="perill" disabled={ocupat}
                  onClick={() => fes({ accio: 'revoca', usuari_id: u.usuari_id }, `Revocar definitivament l'accés de ${u.nom} a tots els clients? No es pot desfer.`)}>
                  Revocar
                </Boto>
              )}
            </div>
          ))}
        </div>
      )}
      <form onSubmit={afegeix} className="flex flex-wrap items-end gap-3">
        <Entrada etiqueta="Nom de l'usuari" required value={nou.nom} className="flex-1 min-w-[180px]" onChange={(e) => setNou({ ...nou, nom: e.target.value })} />
        <Entrada etiqueta="Correu" type="email" required value={nou.email} className="flex-1 min-w-[220px]" onChange={(e) => setNou({ ...nou, email: e.target.value })}
          ajuda="Un correu que ja té compte a la web o al portal no es pot fer servir." />
        <Boto type="submit" disabled={ocupat || !nou.nom.trim() || !nou.email.trim()}>+ Afegir usuari</Boto>
      </form>
      <Avis>{error}</Avis>
      {missatge && <ModalMissatge missatge={missatge} onTancar={() => setMissatge(null)} />}
    </div>
  );
};

export default UsuarisAreaClient;
