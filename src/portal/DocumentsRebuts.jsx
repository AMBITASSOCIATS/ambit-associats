// src/portal/DocumentsRebuts.jsx
// Documents rebuts per l'àrea de client. Cada enviament només el veuen el seu
// destinatari i l'OCIC (RLS). Descàrrega amb URL signada de curta durada i
// botó "Descarregat i arxivat" (el client el veu com "Rebut per ÀMBIT").
// L'OCIC hi configura també els destinataris.
import React, { useCallback, useEffect, useState } from 'react';
import { portal, dataHora, invoca } from './portalApi';
import { Avis, Boto, Entrada, Targeta } from './ui';

const mida = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} kB`);

const Destinataris = () => {
  const [llista, setLlista] = useState([]);
  const [correus, setCorreus] = useState({});
  const [error, setError] = useState('');
  const carrega = useCallback(async () => {
    const { data } = await portal.from('client_destinataris').select('id, email, nom, actiu, user_id').order('ordre');
    setLlista(data || []);
  }, []);
  useEffect(() => { carrega(); }, [carrega]);

  const desa = async (d, actiu) => {
    setError('');
    const { error: e } = await portal.rpc('client_destinatari_actualitza', {
      p_id: d.id, p_actiu: actiu, p_email_personal: correus[d.id]?.trim() || null,
    });
    if (e) setError(e.message);
    await carrega();
  };

  return (
    <Targeta titol="Destinataris (només OCIC)">
      <div className="divide-y divide-[#E4EEEC]">
        {llista.map((d) => (
          <div key={d.id} className="py-2 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-semibold">{d.email}</p>
              <p className="text-xs text-[#6B8280]">{d.actiu ? 'Actiu' : 'Inactiu (el client el veu com «No disponible temporalment»)'} · {d.user_id ? 'amb usuari al portal' : 'sense usuari al portal'}</p>
            </div>
            {!d.user_id && (
              <Entrada etiqueta="Correu de l'usuari del portal" value={correus[d.id] || ''} className="w-64"
                onChange={(e) => setCorreus({ ...correus, [d.id]: e.target.value })} />
            )}
            {d.actiu
              ? <Boto variant="secundari" onClick={() => desa(d, false)}>Desactivar</Boto>
              : <Boto onClick={() => desa(d, true)}>Activar</Boto>}
          </div>
        ))}
      </div>
      <div className="mt-2"><Avis>{error}</Avis></div>
    </Targeta>
  );
};

const DocumentsRebuts = ({ rol }) => {
  const [enviaments, setEnviaments] = useState(null);
  const [filtre, setFiltre] = useState('enviat');
  const [error, setError] = useState('');

  const carrega = useCallback(async () => {
    const { data, error: e } = await portal.from('client_enviaments')
      .select('id, estat, assumpte, comentari, n_fitxers, mida_total, enviat_at, arxivat_at, clients(nom_mostrat), client_usuaris(nom, email), client_destinataris(email), client_enviament_fitxers(id, ordre, nom_fitxer, mida_bytes, sha256)')
      .eq('estat', filtre)
      .order('enviat_at', { ascending: false });
    if (e) setError(e.message);
    setEnviaments(data || []);
  }, [filtre]);
  useEffect(() => { carrega(); }, [carrega]);

  const descarrega = async (f) => {
    setError('');
    try {
      const r = await invoca('portal-client-personal', { accio: 'descarrega', fitxer_id: f.id });
      window.location.assign(r.url);
    } catch (e) {
      setError(e.message);
    }
  };
  const arxiva = async (e) => {
    setError('');
    const { error: err } = await portal.rpc('client_enviament_arxiva', { p_enviament_id: e.id });
    if (err) setError(err.message);
    await carrega();
  };

  return (
    <div className="space-y-6">
      <Targeta titol="Documents rebuts a l'àrea de client"
        accions={(
          <div className="flex gap-1">
            {[['enviat', 'Pendents d\'arxivar'], ['arxivat', 'Arxivats']].map(([k, n]) => (
              <Boto key={k} variant={filtre === k ? 'primari' : 'secundari'} onClick={() => setFiltre(k)}>{n}</Boto>
            ))}
          </div>
        )}>
        <p className="text-xs text-[#6B8280] mb-3">
          Només hi surten els enviaments dirigits a tu{rol === 'ocic' ? ' i, com a OCIC, tots els altres' : ''}.
          Els fitxers es destrueixen 30 dies després d'arxivar-los i, en tot cas, 90 dies després de rebre'ls.
        </p>
        <Avis>{error}</Avis>
        {enviaments === null ? (
          <p className="text-sm text-[#6B8280] py-6 text-center">Carregant...</p>
        ) : enviaments.length === 0 ? (
          <p className="text-sm text-[#6B8280] py-6 text-center">Cap enviament</p>
        ) : (
          <div className="divide-y divide-[#E4EEEC]">
            {enviaments.map((e) => (
              <div key={e.id} className="py-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    <p className="text-sm font-semibold text-[#12302F]">{e.assumpte}</p>
                    <p className="text-xs text-[#6B8280]">
                      {e.clients?.nom_mostrat} · {e.client_usuaris?.nom} ({e.client_usuaris?.email}) · per a {e.client_destinataris?.email} · {dataHora(e.enviat_at)}
                      {e.arxivat_at && ` · arxivat ${dataHora(e.arxivat_at)}`}
                    </p>
                    {e.comentari && <p className="text-sm text-[#2B4644] mt-1 whitespace-pre-line">{e.comentari}</p>}
                  </div>
                  {e.estat === 'enviat' && <Boto variant="exit" onClick={() => arxiva(e)}>Descarregat i arxivat</Boto>}
                </div>
                <ul className="flex flex-wrap gap-2">
                  {[...e.client_enviament_fitxers].sort((a, b) => a.ordre - b.ordre).map((f) => (
                    <li key={f.id}>
                      <Boto variant="secundari" title={`SHA-256 ${f.sha256}`} onClick={() => descarrega(f)}>
                        ⬇ {f.nom_fitxer} · {mida(f.mida_bytes)}
                      </Boto>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Targeta>
      {rol === 'ocic' && <Destinataris />}
    </div>
  );
};

export default DocumentsRebuts;
