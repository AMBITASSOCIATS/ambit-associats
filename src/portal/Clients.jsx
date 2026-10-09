// src/portal/Clients.jsx
// Clients del portal: llista, cerca, alta, referència (ABA-01, màx. 14 caràcters),
// creació de sol·licituds (autorització de càrrec, KYC i protecció de dades),
// fi de la relació (només OCIC) i consentiment de comunicacions comercials.
import React, { useEffect, useState } from 'react';
import { portal, VERSIO_PLANTILLA, dataCurta, invoca } from './portalApi';
import { Avis, Boto, Entrada, Selector, Targeta } from './ui';

const Referencia = ({ client, onDesat }) => {
  const [valor, setValor] = useState(client.referencia_client || '');
  const [desant, setDesant] = useState(false);
  const [error, setError] = useState('');
  const canviat = valor.trim() !== (client.referencia_client || '');

  const desa = async () => {
    setError('');
    setDesant(true);
    const { error } = await portal.from('clients')
      .update({ referencia_client: valor.trim() || null }).eq('id', client.id);
    setDesant(false);
    if (error) setError(error.code === '23505' ? 'Referència ja assignada a un altre client' : error.message);
    else onDesat();
  };

  return (
    <div className="flex items-center gap-2">
      <input value={valor} maxLength={14} onChange={(e) => setValor(e.target.value)} placeholder="Sense referència"
        className="w-36 border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40" />
      {canviat && <Boto onClick={desa} disabled={desant}>{desant ? '...' : 'Desar'}</Boto>}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
};

const avui = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });

// Fi de la relació (només OCIC; fixa els terminis de conservació del KYC i de la
// protecció de dades) i consentiment comercial (el personal en pot anotar la retirada)
const RelacioIConsentiment = ({ client, rol, onDesat }) => {
  const [fi, setFi] = useState(client.data_fi_relacio || '');
  const [retirada, setRetirada] = useState(null);
  const [error, setError] = useState('');
  const desaFi = async () => {
    setError('');
    if (!window.confirm(fi ? `Fixar la fi de la relació el ${fi}? A partir d'aquesta data compten els terminis de conservació.` : 'Treure la data de fi de la relació?')) return;
    const { error: e } = await portal.rpc('fixa_fi_relacio', { p_client_id: client.id, p_data: fi || null });
    if (e) setError(e.message); else onDesat();
  };
  const desaRetirada = async () => {
    setError('');
    const { error: e } = await portal.rpc('anota_retirada_consentiment', { p_client_id: client.id, p_data: retirada.data, p_nota: retirada.nota });
    if (e) setError(e.message); else { setRetirada(null); onDesat(); }
  };
  const vigent = client.consentiment_comercial === true && !client.consentiment_retirat_el;
  return (
    <div className="w-full flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 pl-1">
      <span>
        Comunicacions comercials:{' '}
        {client.consentiment_comercial == null ? '—'
          : client.consentiment_retirat_el ? `retirat el ${dataCurta(client.consentiment_retirat_el)}`
            : client.consentiment_comercial ? `sí (des del ${dataCurta(client.consentiment_comercial_at)})` : 'no'}
      </span>
      {vigent && !retirada && <button type="button" className="text-[#009B9C] hover:underline" onClick={() => setRetirada({ data: avui(), nota: '' })}>Anotar retirada</button>}
      {retirada && (
        <span className="flex flex-wrap items-center gap-2">
          <input type="date" value={retirada.data} max={avui()} onChange={(e) => setRetirada({ ...retirada, data: e.target.value })} className="border border-gray-300 rounded px-2 py-1" />
          <input value={retirada.nota} placeholder="Com ho ha comunicat (opcional)" maxLength={300} onChange={(e) => setRetirada({ ...retirada, nota: e.target.value })} className="border border-gray-300 rounded px-2 py-1 w-56" />
          <Boto onClick={desaRetirada}>Desar</Boto>
          <Boto variant="secundari" onClick={() => setRetirada(null)}>Cancel·lar</Boto>
        </span>
      )}
      {rol === 'ocic' ? (
        <span className="flex items-center gap-2">
          Fi de la relació:
          <input type="date" value={fi} max={avui()} onChange={(e) => setFi(e.target.value)} className="border border-gray-300 rounded px-2 py-1" />
          {fi !== (client.data_fi_relacio || '') && <Boto onClick={desaFi}>Desar</Boto>}
        </span>
      ) : client.data_fi_relacio && <span>Fi de la relació: {dataCurta(client.data_fi_relacio)}</span>}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
};

const Clients = ({ onObreSolicitud, rol }) => {
  const [clients, setClients] = useState([]);
  const [carregant, setCarregant] = useState(true);
  const [cerca, setCerca] = useState('');
  const [nou, setNou] = useState({ nom: '', tipus: 'pf', referencia: '' });
  const [error, setError] = useState('');
  const [creant, setCreant] = useState(false);

  const carrega = async () => {
    const { data, error } = await portal.from('clients')
      .select('id, party_type, nom_mostrat, referencia_client, created_at, data_fi_relacio, consentiment_comercial, consentiment_comercial_at, consentiment_retirat_el, requests(id, status, document_type)')
      .order('created_at', { ascending: false });
    if (!error) setClients(data || []);
    setCarregant(false);
  };
  useEffect(() => { carrega(); }, []);

  const creaClient = async (e) => {
    e.preventDefault();
    setError('');
    setCreant(true);
    const { error } = await portal.from('clients').insert({
      nom_mostrat: nou.nom.trim(),
      party_type: nou.tipus,
      referencia_client: nou.referencia.trim() || null,
    });
    setCreant(false);
    if (error) {
      setError(error.code === '23505' ? 'Aquesta referència ja està assignada a un altre client' : error.message);
      return;
    }
    setNou({ nom: '', tipus: 'pf', referencia: '' });
    carrega();
  };

  const novaSolicitud = async (client) => {
    const { data, error } = await portal.from('requests').insert({
      client_id: client.id,
      document_type: 'autoritzacio_carrec',
      template_version: VERSIO_PLANTILLA,
      idioma: 'ca',
    }).select('id').single();
    if (error) { alert('No s\'ha pogut crear la sol·licitud: ' + error.message); return; }
    onObreSolicitud(data.id);
  };

  // KYC i protecció de dades: dues sol·licituds enllaçades i un sol enllaç
  const [triaKyc, setTriaKyc] = useState(null);  // client per al qual es tria la documentació
  const nouKyc = async (client, documentacio) => {
    setTriaKyc(null);
    try {
      const r = await invoca('portal-kyc-personal', { accio: 'crea', client_id: client.id, documentacio });
      onObreSolicitud(r.request_id);
    } catch (e) {
      alert('No s\'ha pogut crear el KYC: ' + e.message);
    }
  };

  const filtrats = clients.filter((c) => {
    if (!cerca) return true;
    const q = cerca.toLowerCase();
    return c.nom_mostrat.toLowerCase().includes(q) || (c.referencia_client || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <Targeta titol="Nou client">
        <form onSubmit={creaClient} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
          <Entrada etiqueta="Nom o raó social" required value={nou.nom} className="md:col-span-2"
            onChange={(e) => setNou({ ...nou, nom: e.target.value })} />
          <Selector etiqueta="Tipus" value={nou.tipus} onChange={(e) => setNou({ ...nou, tipus: e.target.value })}>
            <option value="pf">Persona física</option>
            <option value="pj">Persona jurídica</option>
          </Selector>
          <Entrada etiqueta="Referència (opcional)" maxLength={14} value={nou.referencia}
            onChange={(e) => setNou({ ...nou, referencia: e.target.value })} ajuda="Màxim 14 caràcters" />
          <div className="md:col-span-4 flex items-center gap-3">
            <Boto type="submit" disabled={creant || !nou.nom.trim()}>{creant ? 'Creant...' : '+ Crear client'}</Boto>
            <Avis>{error}</Avis>
          </div>
        </form>
      </Targeta>

      <Targeta titol={`Clients (${clients.length})`}
        accions={<input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cercar per nom o referència..."
          className="w-64 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40" />}>
        {carregant ? (
          <p className="text-sm text-gray-400 py-6 text-center">Carregant...</p>
        ) : filtrats.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Cap client</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtrats.map((c) => (
              <div key={c.id} className="py-3 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-semibold text-gray-800">{c.nom_mostrat}</p>
                  <p className="text-xs text-gray-400">
                    {c.party_type === 'pj' ? 'Persona jurídica' : 'Persona física'} · alta {dataCurta(c.created_at)}
                    {c.requests?.length > 0 && ` · ${c.requests.filter((r) => r.document_type !== 'pdp').length} sol·licitud${c.requests.filter((r) => r.document_type !== 'pdp').length > 1 ? 's' : ''}`}
                  </p>
                </div>
                <Referencia client={c} onDesat={carrega} />
                <Boto variant="secundari" onClick={() => novaSolicitud(c)}>+ Nova autorització</Boto>
                {triaKyc === c.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Boto onClick={() => nouKyc(c, 'client')}>Documentació: l'aporta el client</Boto>
                    <Boto onClick={() => nouKyc(c, 'ambit')}>Documentació: ja la té ÀMBIT</Boto>
                    <Boto variant="secundari" onClick={() => setTriaKyc(null)}>Cancel·lar</Boto>
                  </span>
                ) : (
                  <Boto variant="secundari" onClick={() => setTriaKyc(c.id)}>+ KYC i protecció de dades</Boto>
                )}
                <RelacioIConsentiment client={c} rol={rol} onDesat={carrega} />
              </div>
            ))}
          </div>
        )}
      </Targeta>
    </div>
  );
};

export default Clients;
