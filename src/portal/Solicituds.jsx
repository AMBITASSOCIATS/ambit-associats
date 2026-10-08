// src/portal/Solicituds.jsx
// Sol·licituds d'autorització de càrrec: llista amb filtre per estat i detall
// amb les dades, l'IBAN emmascarat, la firma, les evidències, els documents i
// les accions que permet cada estat. Les regles reals les aplica la base.
import React, { useCallback, useEffect, useState } from 'react';
import ModalMissatge from '../auth/ModalMissatge';
import {
  ENTITATS, ESTATS, dataCurta, dataHora, ibanEmmascarat, invoca, missatgeEnllac, portal, urlDocument,
} from './portalApi';
import { Avis, Boto, Dada, Entrada, EtiquetaEstat, Selector, Targeta } from './ui';

const avui = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' }); // AAAA-MM-DD

const NOM_DOC = { signat: 'Autorització signada (PDF)', evidencies: 'Imatge de la firma', adjunt: 'Poder adjunt' };

// ─── Dades preomplertes pel personal (només en esborrany) ───────────────────
const Preomplir = ({ requestId, aut, onDesat }) => {
  const [d, setD] = useState({
    titular_nom: aut?.titular_nom || '',
    titular_adreca: aut?.titular_adreca || '',
    titular_cp_poblacio: aut?.titular_cp_poblacio || '',
    client_facturat_nom: aut?.client_facturat_nom || '',
  });
  const [estat, setEstat] = useState({ desant: false, error: '', ok: false });

  const desa = async (e) => {
    e.preventDefault();
    setEstat({ desant: true, error: '', ok: false });
    const fila = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.trim() || null]));
    const { error } = aut
      ? await portal.from('autoritzacions_carrec').update(fila).eq('request_id', requestId)
      : await portal.from('autoritzacions_carrec').insert({ request_id: requestId, ...fila });
    setEstat({ desant: false, error: error?.message || '', ok: !error });
    if (!error) onDesat();
  };

  return (
    <form onSubmit={desa} className="space-y-3">
      <p className="text-xs text-gray-500">
        Opcional. El client les veurà preomplertes i les podrà corregir. L'IBAN l'escriu sempre el client.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Entrada etiqueta="Titular: nom o raó social" value={d.titular_nom} onChange={(e) => setD({ ...d, titular_nom: e.target.value })} />
        <Entrada etiqueta="Adreça" value={d.titular_adreca} onChange={(e) => setD({ ...d, titular_adreca: e.target.value })} />
        <Entrada etiqueta="Codi postal i població" value={d.titular_cp_poblacio} onChange={(e) => setD({ ...d, titular_cp_poblacio: e.target.value })} />
        <Entrada etiqueta="Client facturat (si és diferent)" value={d.client_facturat_nom} onChange={(e) => setD({ ...d, client_facturat_nom: e.target.value })} />
      </div>
      <div className="flex items-center gap-3">
        <Boto type="submit" variant="secundari" disabled={estat.desant}>{estat.desant ? 'Desant...' : 'Desar dades'}</Boto>
        {estat.ok && <span className="text-xs text-green-600">Desat ✓</span>}
        <Avis>{estat.error}</Avis>
      </div>
    </form>
  );
};

// ─── Detall ─────────────────────────────────────────────────────────────────
const Detall = ({ id, onTorna, rol }) => {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [missatge, setMissatge] = useState(null);
  const [ocupat, setOcupat] = useState(false);
  const [dataAlta, setDataAlta] = useState(avui());
  const [retirada, setRetirada] = useState({ data: avui(), motiu: '' });
  const [motiuAnullacio, setMotiuAnullacio] = useState('');

  const carrega = useCallback(async () => {
    const [req, aut, sig, docs, enllac] = await Promise.all([
      portal.from('requests')
        .select('id, status, template_version, created_at, enviat_at, signat_at, activat_at, anullat_at, motiu_anullacio, clients(id, nom_mostrat, party_type, referencia_client)')
        .eq('id', id).single(),
      portal.from('autoritzacions_carrec')
        .select('id, titular_nom, titular_adreca, titular_cp_poblacio, entitat, iban_ultims4, client_facturat_nom, signant_es_administrador, data_alta, data_retirada, motiu_retirada, darrer_carrec, conservar_fins')
        .eq('request_id', id).maybeSingle(),
      portal.from('signatures')
        .select('signatari_nom, signatari_carrec, lloc, signat_at, ip, user_agent, empremta_dades')
        .eq('request_id', id).maybeSingle(),
      portal.from('documents').select('id, kind, storage_path, sha256, mida_bytes, created_at').eq('request_id', id).order('created_at'),
      portal.rpc('estat_enllac', { p_request_id: id }),
    ]);
    if (req.error) { setError(req.error.message); return; }
    setS({ ...req.data, aut: aut.data, sig: sig.data, docs: docs.data || [], enllac: enllac.data?.[0] || null });
  }, [id]);
  useEffect(() => { carrega(); }, [carrega]);

  const accio = async (fn) => {
    setError('');
    setOcupat(true);
    try {
      await fn();
      await carrega();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupat(false);
    }
  };

  const generaEnllac = () => accio(async () => {
    const r = await invoca('portal-enllac', { request_id: id });
    setMissatge(missatgeEnllac({ nom: s.clients.nom_mostrat, enllac: r.enllac, expira: r.expira_at }));
  });

  const anulla = () => {
    if (!window.confirm('Segur que vols anul·lar aquesta sol·licitud? No es pot desfer.')) return;
    accio(async () => {
      const { error } = await portal.from('requests').update({ status: 'anullat' }).eq('id', id);
      if (error) throw error;
    });
  };

  // Autorització signada que no s'activarà: només l'OCIC, amb motiu (queda a l'auditoria)
  const anullaSignada = () => {
    if (!window.confirm('Segur que vols anul·lar aquesta autorització signada? No es pot desfer.')) return;
    accio(async () => {
      const { error } = await portal.from('requests')
        .update({ status: 'anullat', motiu_anullacio: motiuAnullacio.trim() }).eq('id', id);
      if (error) throw error;
    });
  };

  const activa = () => accio(async () => {
    const { error } = await portal.rpc('activa_autoritzacio', { p_request_id: id, p_data_alta: dataAlta });
    if (error) throw error;
  });

  const retira = () => {
    if (!window.confirm('Segur que vols retirar aquesta autorització?')) return;
    accio(async () => {
      const { error } = await portal.rpc('retira_autoritzacio', {
        p_request_id: id, p_data_retirada: retirada.data, p_motiu: retirada.motiu.trim() || null,
      });
      if (error) throw error;
    });
  };

  const descarrega = (doc) => accio(async () => {
    const ext = doc.storage_path.split('.').pop();
    const url = await urlDocument(doc.storage_path, `${doc.kind}-${s.clients.referencia_client || id.slice(0, 8)}.${ext}`);
    window.open(url, '_blank', 'noopener');
  });

  if (!s) return <p className="text-sm text-gray-400">{error || 'Carregant...'}</p>;
  const { aut, sig, clients: client } = s;
  const potEnllac = ['esborrany', 'enviat', 'en_curs'].includes(s.status);

  return (
    <div className="space-y-5">
      <button onClick={onTorna} className="text-sm text-[#009B9C] hover:underline">← Totes les sol·licituds</button>

      <Targeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Autorització de càrrec en compte · {s.template_version}</p>
            <h2 className="text-lg font-bold text-gray-800">{client.nom_mostrat}</h2>
            <p className="text-xs text-gray-500">
              {client.party_type === 'pj' ? 'Persona jurídica' : 'Persona física'} · Referència:{' '}
              <span className="font-mono">{client.referencia_client || 'sense assignar'}</span>
            </p>
          </div>
          <EtiquetaEstat estat={s.status} />
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <Dada etiqueta="Creada">{dataCurta(s.created_at)}</Dada>
          <Dada etiqueta="Enviada">{dataHora(s.enviat_at)}</Dada>
          <Dada etiqueta="Signada">{dataHora(s.signat_at)}</Dada>
          <Dada etiqueta="Activada">{dataHora(s.activat_at)}</Dada>
          {s.anullat_at && <Dada etiqueta="Anul·lada">{dataHora(s.anullat_at)}</Dada>}
          {s.motiu_anullacio && <Dada etiqueta="Motiu de l'anul·lació">{s.motiu_anullacio}</Dada>}
        </dl>
      </Targeta>

      <Avis>{error}</Avis>

      {/* Accions segons l'estat */}
      {potEnllac && (
        <Targeta titol="Enllaç per al client">
          <p className="text-xs text-gray-500 mb-3">
            {s.enllac
              ? `Hi ha un enllaç vigent fins al ${dataHora(s.enllac.expira_at)}. Si el generes de nou, l'anterior deixarà de funcionar.`
              : 'Genera l\'enllaç i envia\'l al client des del teu correu. Caduca als 7 dies i només serveix una vegada.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Boto onClick={generaEnllac} disabled={ocupat}>{s.enllac || s.status !== 'esborrany' ? 'Regenerar enllaç' : 'Generar enllaç'}</Boto>
            <Boto variant="perill" onClick={anulla} disabled={ocupat}>Anul·lar sol·licitud</Boto>
          </div>
        </Targeta>
      )}

      {s.status === 'signat' && (
        <Targeta titol="Activar l'autorització">
          {!client.referencia_client && (
            <div className="mb-3"><Avis tipus="info">Abans d'activar-la cal assignar la referència del client (pestanya Clients).</Avis></div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <Entrada etiqueta="Data d'alta" type="date" value={dataAlta} onChange={(e) => setDataAlta(e.target.value)} />
            <Boto variant="exit" onClick={activa} disabled={ocupat || !dataAlta || !client.referencia_client}>Activar</Boto>
          </div>
        </Targeta>
      )}

      {s.status === 'signat' && rol === 'ocic' && (
        <Targeta titol="Anul·lar l'autorització signada (només OCIC)">
          <p className="text-xs text-gray-500 mb-3">
            Per a autoritzacions signades que no s'activaran (el client se n'ha fet enrere, dades de prova...). El document
            signat no es modifica; l'expedient seguirà els terminis de conservació de les anul·lades.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Entrada etiqueta="Motiu (obligatori)" value={motiuAnullacio} className="flex-1 min-w-[240px]" maxLength={500}
              onChange={(e) => setMotiuAnullacio(e.target.value)} />
            <Boto variant="perill" onClick={anullaSignada} disabled={ocupat || !motiuAnullacio.trim()}>Anul·lar</Boto>
          </div>
        </Targeta>
      )}

      {s.status === 'actiu' && (
        <Targeta titol="Retirar l'autorització">
          <div className="flex flex-wrap items-end gap-3">
            <Entrada etiqueta="Data de retirada" type="date" value={retirada.data} onChange={(e) => setRetirada({ ...retirada, data: e.target.value })} />
            <Entrada etiqueta="Motiu (opcional)" value={retirada.motiu} className="flex-1 min-w-[200px]"
              onChange={(e) => setRetirada({ ...retirada, motiu: e.target.value })} />
            <Boto variant="perill" onClick={retira} disabled={ocupat || !retirada.data}>Retirar</Boto>
          </div>
        </Targeta>
      )}

      {/* Dades */}
      <Targeta titol="Dades de l'autorització">
        {s.status === 'esborrany' ? (
          <Preomplir requestId={id} aut={aut} onDesat={carrega} />
        ) : !aut ? (
          <p className="text-sm text-gray-400">El client encara no ha omplert el formulari.</p>
        ) : (
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Dada etiqueta="Titular">{aut.titular_nom}</Dada>
            <Dada etiqueta="Adreça">{[aut.titular_adreca, aut.titular_cp_poblacio].filter(Boolean).join(' · ')}</Dada>
            <Dada etiqueta="Entitat">{ENTITATS[aut.entitat]}</Dada>
            <Dada etiqueta="IBAN"><span className="font-mono">{ibanEmmascarat(aut.iban_ultims4)}</span></Dada>
            <Dada etiqueta="Client facturat">{aut.client_facturat_nom}</Dada>
            {client.party_type === 'pj' && (
              <Dada etiqueta="Signant administrador">
                {aut.signant_es_administrador == null ? '—' : aut.signant_es_administrador ? 'Sí' : 'No (amb poder)'}
              </Dada>
            )}
            <Dada etiqueta="Data d'alta">{dataCurta(aut.data_alta)}</Dada>
            {aut.data_retirada && <Dada etiqueta="Retirada">{`${dataCurta(aut.data_retirada)}${aut.motiu_retirada ? ` · ${aut.motiu_retirada}` : ''}`}</Dada>}
            {aut.conservar_fins && <Dada etiqueta="Conservar fins">{dataCurta(aut.conservar_fins)}</Dada>}
          </dl>
        )}
      </Targeta>

      {sig && (
        <Targeta titol="Signatura i evidències">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Dada etiqueta="Signant">{[sig.signatari_nom, sig.signatari_carrec].filter(Boolean).join(' · ')}</Dada>
            <Dada etiqueta="Localitat">{sig.lloc}</Dada>
            <Dada etiqueta="Data i hora (UTC)">{new Date(sig.signat_at).toISOString().replace('T', ' ').slice(0, 19)}</Dada>
            <Dada etiqueta="Adreça IP">{sig.ip}</Dada>
            <Dada etiqueta="Navegador"><span className="text-xs">{sig.user_agent}</span></Dada>
            <Dada etiqueta="Empremta de les dades (SHA-256)"><span className="font-mono text-xs">{sig.empremta_dades}</span></Dada>
          </dl>
        </Targeta>
      )}

      {s.docs.length > 0 && (
        <Targeta titol="Documents">
          <div className="divide-y divide-gray-100">
            {s.docs.map((d) => (
              <div key={d.id} className="py-2.5 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm text-gray-800">{NOM_DOC[d.kind]}</p>
                  <p className="text-[11px] text-gray-400 font-mono break-all">
                    SHA-256 {d.sha256} · {(d.mida_bytes / 1024).toFixed(0)} KB · {dataHora(d.created_at)}
                  </p>
                </div>
                <Boto variant="secundari" onClick={() => descarrega(d)} disabled={ocupat}>Descarregar</Boto>
              </div>
            ))}
          </div>
        </Targeta>
      )}

      {missatge && <ModalMissatge missatge={missatge} onTancar={() => setMissatge(null)} />}
    </div>
  );
};

// ─── Llista ─────────────────────────────────────────────────────────────────
const Solicituds = ({ oberta, onObre, rol }) => {
  const [llista, setLlista] = useState([]);
  const [carregant, setCarregant] = useState(true);
  const [filtre, setFiltre] = useState('totes');
  const [cerca, setCerca] = useState('');

  useEffect(() => {
    if (oberta) return;
    setCarregant(true);
    portal.from('requests')
      .select('id, status, created_at, enviat_at, signat_at, clients(nom_mostrat, referencia_client, party_type)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setLlista(data || []); setCarregant(false); });
  }, [oberta]);

  if (oberta) return <Detall id={oberta} onTorna={() => onObre(null)} rol={rol} />;

  const filtrades = llista.filter((s) => {
    if (filtre !== 'totes' && s.status !== filtre) return false;
    if (!cerca) return true;
    const q = cerca.toLowerCase();
    return s.clients.nom_mostrat.toLowerCase().includes(q) || (s.clients.referencia_client || '').toLowerCase().includes(q);
  });
  const recompte = (e) => llista.filter((s) => s.status === e).length;

  return (
    <Targeta titol="Sol·licituds"
      accions={
        <div className="flex gap-2">
          <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cercar client..."
            className="w-48 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40" />
          <Selector value={filtre} onChange={(e) => setFiltre(e.target.value)}>
            <option value="totes">Tots els estats ({llista.length})</option>
            {Object.entries(ESTATS).map(([k, v]) => <option key={k} value={k}>{v.nom} ({recompte(k)})</option>)}
          </Selector>
        </div>
      }>
      {carregant ? (
        <p className="text-sm text-gray-400 py-6 text-center">Carregant...</p>
      ) : filtrades.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          Cap sol·licitud. Crea'n una des de la pestanya Clients.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtrades.map((s) => (
            <button key={s.id} onClick={() => onObre(s.id)}
              className="w-full text-left py-3 flex flex-wrap items-center gap-4 hover:bg-gray-50 px-2 -mx-2 rounded-lg">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-semibold text-gray-800">{s.clients.nom_mostrat}</p>
                <p className="text-xs text-gray-400">
                  <span className="font-mono">{s.clients.referencia_client || 'sense referència'}</span> · creada {dataCurta(s.created_at)}
                  {s.signat_at && ` · signada ${dataCurta(s.signat_at)}`}
                </p>
              </div>
              <EtiquetaEstat estat={s.status} />
            </button>
          ))}
        </div>
      )}
    </Targeta>
  );
};

export default Solicituds;
