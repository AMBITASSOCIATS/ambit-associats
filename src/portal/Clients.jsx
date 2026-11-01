// src/portal/Clients.jsx
// Clients del portal: llista, cerca, alta, referència (ABA-01, màx. 14 caràcters),
// creació de sol·licituds (autorització de càrrec, KYC i protecció de dades,
// comunicació de dades al pagador IRPF, contracte), fi de la relació (només OCIC),
// consentiment de comunicacions comercials i usuaris de l'àrea de client.
import React, { useEffect, useState } from 'react';
import { portal, VERSIO_PLANTILLA, dataCurta, invoca } from './portalApi';
import { Avis, Boto, Entrada, Selector, Targeta } from './ui';
import NouContracte from './contracte/NouContracte';
import UsuarisAreaClient from './UsuarisAreaClient';

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
        className="w-36 border border-[#C5D6D3] rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#007A7B]/40" />
      {canviat && <Boto onClick={desa} disabled={desant}>{desant ? '...' : 'Desar'}</Boto>}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
};

const avui = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });

// Comunicació de dades al pagador (IRPF): el client és el PAGADOR. Dades del
// pagador (apartat 2 i capçalera del PDF) i perceptor: un d'existent o un de nou.
const NovaIrpf = ({ client, onCreada, onCancel }) => {
  const [pagador, setPagador] = useState({ denominacio: client.nom_mostrat, nrt: '', domicili: '' });
  const [perceptors, setPerceptors] = useState([]);
  const [triat, setTriat] = useState('nou');
  const [nou, setNou] = useState({ nom: '', nrt: '', email: '', es_representant: false, inici_relacio: '', relacio_laboral: true });
  const [error, setError] = useState('');
  const [creant, setCreant] = useState(false);

  useEffect(() => {
    portal.from('irpf_pagadors').select('denominacio, nrt, domicili').eq('client_id', client.id).maybeSingle()
      .then(({ data }) => { if (data) setPagador(data); });
    portal.from('irpf_perceptors').select('id, nom, nrt, es_representant, data_fi_rendes').eq('client_id', client.id).order('nom')
      .then(({ data }) => setPerceptors(data || []));
  }, [client.id]);

  const crea = async (e) => {
    e.preventDefault();
    setError('');
    setCreant(true);
    const { data, error: err } = await portal.rpc('irpf_crea', {
      p_client_id: client.id,
      p_perceptor: triat === 'nou' ? { ...nou, nom: nou.nom.trim(), nrt: nou.nrt.trim(), email: nou.email.trim() } : { id: triat },
      p_pagador: { denominacio: pagador.denominacio.trim(), nrt: pagador.nrt.trim(), domicili: pagador.domicili.trim() },
    });
    setCreant(false);
    if (err) {
      setError(err.code === '23505' && /NRT|unique|duplicate/i.test(err.message) ? 'Aquest perceptor ja existeix per a aquest pagador' : err.message);
      return;
    }
    onCreada(data);
  };

  const pagadorComplet = pagador.denominacio.trim() && pagador.nrt.trim() && pagador.domicili.trim();
  const perceptorComplet = triat !== 'nou' || (nou.nom.trim() && nou.nrt.trim() && nou.inici_relacio && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(nou.email.trim()));
  return (
    <form onSubmit={crea} className="w-full border border-[#007A7B]/30 bg-[#007A7B]/5 rounded-lg p-4 space-y-3">
      <p className="text-xs font-bold text-[#007A7B]">Comunicació de dades al pagador (IRPF) · el client és el pagador</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Entrada etiqueta="Pagador: denominació social" required value={pagador.denominacio} onChange={(e) => setPagador({ ...pagador, denominacio: e.target.value })} />
        <Entrada etiqueta="NRT del pagador" required value={pagador.nrt} onChange={(e) => setPagador({ ...pagador, nrt: e.target.value })} />
        <Entrada etiqueta="Domicili del pagador" required value={pagador.domicili} onChange={(e) => setPagador({ ...pagador, domicili: e.target.value })} />
      </div>
      <Selector etiqueta="Perceptor" value={triat} onChange={(e) => setTriat(e.target.value)}>
        <option value="nou">+ Perceptor nou</option>
        {perceptors.map((x) => (
          <option key={x.id} value={x.id}>{x.nom} · {x.nrt}{x.data_fi_rendes ? ` · fi de les rendes ${dataCurta(x.data_fi_rendes)}` : ''}</option>
        ))}
      </Selector>
      {triat === 'nou' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Entrada etiqueta="Nom i cognoms del perceptor" required value={nou.nom} onChange={(e) => setNou({ ...nou, nom: e.target.value })} />
          <Entrada etiqueta="NRT del perceptor" required value={nou.nrt} onChange={(e) => setNou({ ...nou, nrt: e.target.value })} />
          <Entrada etiqueta="Correu del perceptor" type="email" required value={nou.email} onChange={(e) => setNou({ ...nou, email: e.target.value })} />
          <Entrada etiqueta={nou.relacio_laboral ? 'Inici de la relació laboral' : 'Data del primer pagament'} type="date" required value={nou.inici_relacio}
            onChange={(e) => setNou({ ...nou, inici_relacio: e.target.value })} ajuda="Termini de la comunicació inicial (arts. 31.a i 31.b)" />
          <label className="md:col-span-2 flex items-center gap-2 text-xs text-[#2B4644]">
            <input type="checkbox" checked={!nou.relacio_laboral} onChange={(e) => setNou({ ...nou, relacio_laboral: !e.target.checked })} className="accent-[#007A7B]" />
            Rendes que no són d'una relació laboral (s'indica la data del primer pagament)
          </label>
          <label className="md:col-span-3 flex items-start gap-2 text-xs text-[#2B4644]">
            <input type="checkbox" checked={nou.es_representant} onChange={(e) => setNou({ ...nou, es_representant: e.target.checked })} className="accent-[#007A7B] mt-0.5" />
            És el representant del pagador (p. ex. l'administrador únic): signarà també la recepció pel pagador, en la mateixa sessió.
          </label>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Boto type="submit" disabled={creant || !pagadorComplet || !perceptorComplet}>{creant ? 'Creant...' : 'Crear la comunicació'}</Boto>
        <Boto variant="secundari" onClick={onCancel}>Cancel·lar</Boto>
        <Avis>{error}</Avis>
      </div>
    </form>
  );
};

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
    <div className="w-full flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#4E6765] pl-1">
      <span>
        Comunicacions comercials:{' '}
        {client.consentiment_comercial == null ? '—'
          : client.consentiment_retirat_el ? `retirat el ${dataCurta(client.consentiment_retirat_el)}`
            : client.consentiment_comercial ? `sí (des del ${dataCurta(client.consentiment_comercial_at)})` : 'no'}
      </span>
      {vigent && !retirada && <button type="button" className="text-[#007A7B] hover:underline" onClick={() => setRetirada({ data: avui(), nota: '' })}>Anotar retirada</button>}
      {retirada && (
        <span className="flex flex-wrap items-center gap-2">
          <input type="date" value={retirada.data} max={avui()} onChange={(e) => setRetirada({ ...retirada, data: e.target.value })} className="border border-[#C5D6D3] rounded px-2 py-1" />
          <input value={retirada.nota} placeholder="Com ho ha comunicat (opcional)" maxLength={300} onChange={(e) => setRetirada({ ...retirada, nota: e.target.value })} className="border border-[#C5D6D3] rounded px-2 py-1 w-56" />
          <Boto onClick={desaRetirada}>Desar</Boto>
          <Boto variant="secundari" onClick={() => setRetirada(null)}>Cancel·lar</Boto>
        </span>
      )}
      {rol === 'ocic' ? (
        <span className="flex items-center gap-2">
          Fi de la relació:
          <input type="date" value={fi} max={avui()} onChange={(e) => setFi(e.target.value)} className="border border-[#C5D6D3] rounded px-2 py-1" />
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

  const [triaIrpf, setTriaIrpf] = useState(null);  // client per al qual es crea una comunicació IRPF
  const [triaContracte, setTriaContracte] = useState(null);  // client per al qual es crea un contracte
  const [areaClient, setAreaClient] = useState(null);  // client amb els usuaris de l'àrea de client oberts

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
          className="w-64 border border-[#C5D6D3] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#007A7B]/40" />}>
        {carregant ? (
          <p className="text-sm text-[#6B8280] py-6 text-center">Carregant...</p>
        ) : filtrats.length === 0 ? (
          <p className="text-sm text-[#6B8280] py-6 text-center">Cap client</p>
        ) : (
          <div className="divide-y divide-[#E4EEEC]">
            {filtrats.map((c) => (
              <div key={c.id} className="py-3 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-semibold text-[#12302F]">{c.nom_mostrat}</p>
                  <p className="text-xs text-[#6B8280]">
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
                {triaIrpf !== c.id && <Boto variant="secundari" onClick={() => setTriaIrpf(c.id)}>+ Comunicació IRPF</Boto>}
                {triaIrpf === c.id && <NovaIrpf client={c} onCancel={() => setTriaIrpf(null)} onCreada={(id) => { setTriaIrpf(null); onObreSolicitud(id); }} />}
                {triaContracte !== c.id && <Boto variant="secundari" onClick={() => setTriaContracte(c.id)}>+ Contracte</Boto>}
                {triaContracte === c.id && <NouContracte client={c} onCancel={() => setTriaContracte(null)} onCreat={(id) => { setTriaContracte(null); onObreSolicitud(id); }} />}
                <Boto variant="secundari" onClick={() => setAreaClient(areaClient === c.id ? null : c.id)}>
                  {areaClient === c.id ? 'Tancar l\'àrea de client' : 'Àrea de client'}
                </Boto>
                {areaClient === c.id && <UsuarisAreaClient client={c} />}
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
