// src/portal/Conservacio.jsx
// Conservació, bloqueig i destrucció (només OCIC). Art. 30 i 70.1 Llei 29/2021.
// - Propers venciments (90 dies) i simulació del procés diari.
// - Expedients bloquejats: només referència i dates. L'única manera de veure'n
//   les dades és l'accés per requeriment d'autoritat, que queda registrat.
// - Retencions per reclamació o procediment i historial de destruccions.
import React, { useCallback, useEffect, useState } from 'react';
import { ENTITATS, ESTATS, dataCurta, dataHora, ibanEmmascarat, invoca, portal } from './portalApi';
import { Avis, Boto, Dada, Entrada, EtiquetaEstat, Targeta } from './ui';

const curt = (id) => id?.slice(0, 8);

// ─── Finestra per demanar un motiu (retenció) o motiu + autoritat (requeriment) ──
const Formulari = ({ titol, explicacio, ambAutoritat, boto, onEnvia, onTanca }) => {
  const [motiu, setMotiu] = useState('');
  const [autoritat, setAutoritat] = useState('');
  const [error, setError] = useState('');
  const [enviant, setEnviant] = useState(false);

  const envia = async (e) => {
    e.preventDefault();
    setError('');
    setEnviant(true);
    try {
      await onEnvia({ motiu: motiu.trim(), autoritat: autoritat.trim() });
    } catch (err) {
      setError(err.message);
      setEnviant(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={envia} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-800">{titol}</h3>
        <p className="text-xs text-gray-500">{explicacio}</p>
        {ambAutoritat && (
          <Entrada etiqueta="Autoritat requeridora" required value={autoritat} maxLength={200}
            onChange={(e) => setAutoritat(e.target.value)} placeholder="p. ex. Batllia d'Andorra" />
        )}
        <Entrada etiqueta="Motiu" required value={motiu} maxLength={500}
          onChange={(e) => setMotiu(e.target.value)} placeholder={ambAutoritat ? 'p. ex. Diligències prèvies 12/2026' : ''} />
        <Avis>{error}</Avis>
        <div className="flex gap-3">
          <Boto type="submit" disabled={enviant || !motiu.trim() || (ambAutoritat && !autoritat.trim())}>{boto}</Boto>
          <Boto variant="secundari" onClick={onTanca}>Cancel·lar</Boto>
        </div>
      </form>
    </div>
  );
};

// ─── Dades lliurades per requeriment ────────────────────────────────────────
const DadesRequeriment = ({ dades, onTanca }) => {
  const { request: r, client: c, autoritzacio: a, signatura: s, documents } = dades;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto space-y-4">
        <h3 className="text-lg font-bold text-gray-800">Dades per requeriment d'autoritat</h3>
        <Avis tipus="info">
          Aquest accés ha quedat registrat a l'auditoria. Lliura només el que demana l'autoritat i no en guardis còpies.
          Els enllaços de descàrrega caduquen en 60 segons.
        </Avis>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Dada etiqueta="Client">{c?.nom_mostrat} {c?.referencia_client && `(${c.referencia_client})`}</Dada>
          <Dada etiqueta="Estat">{ESTATS[r?.status]?.nom}</Dada>
          <Dada etiqueta="Titular">{a?.titular_nom}</Dada>
          <Dada etiqueta="Adreça">{[a?.titular_adreca, a?.titular_cp_poblacio].filter(Boolean).join(' · ')}</Dada>
          <Dada etiqueta="Entitat">{ENTITATS[a?.entitat]}</Dada>
          <Dada etiqueta="IBAN"><span className="font-mono">{ibanEmmascarat(a?.iban_ultims4)}</span> (complet al PDF)</Dada>
          <Dada etiqueta="Alta / retirada">{`${dataCurta(a?.data_alta)} · ${dataCurta(a?.data_retirada)}`}</Dada>
          <Dada etiqueta="Signant">{s ? `${s.signatari_nom} · ${s.lloc} · ${dataHora(s.signat_at)}` : '—'}</Dada>
          <Dada etiqueta="IP i navegador"><span className="text-xs">{s ? `${s.ip || '—'} · ${s.user_agent || '—'}` : '—'}</span></Dada>
          <Dada etiqueta="Empremta de les dades"><span className="font-mono text-xs">{s?.empremta_dades}</span></Dada>
        </dl>
        {documents?.length > 0 && (
          <div className="divide-y divide-gray-100 border-t border-gray-100">
            {documents.map((d) => (
              <div key={d.id} className="py-2 flex items-center gap-3">
                <span className="flex-1 text-xs text-gray-600 font-mono break-all">{d.kind} · SHA-256 {d.sha256}</span>
                {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#009B9C] underline">Descarregar</a>}
              </div>
            ))}
          </div>
        )}
        <Boto variant="secundari" onClick={onTanca}>Tancar</Boto>
      </div>
    </div>
  );
};

const Conservacio = () => {
  const [propers, setPropers] = useState([]);
  const [bloquejades, setBloquejades] = useState([]);
  const [destruccions, setDestruccions] = useState([]);
  const [simulacio, setSimulacio] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [finestra, setFinestra] = useState(null);   // { tipus, fila }
  const [dadesReq, setDadesReq] = useState(null);

  const carrega = useCallback(async () => {
    const [p, b, d] = await Promise.all([
      portal.rpc('propers_venciments', { p_dies: 90 }),
      portal.rpc('llista_bloquejades'),
      portal.from('audit_log').select('id, at, entitat_id, detalls').eq('accio', 'DESTRUCCIO').order('at', { ascending: false }).limit(100),
    ]);
    const err = p.error || b.error || d.error;
    if (err) setError(err.message);
    setPropers(p.data || []);
    setBloquejades(b.data || []);
    setDestruccions(d.data || []);
  }, []);
  useEffect(() => { carrega(); }, [carrega]);

  const simula = async () => {
    setError('');
    const { data, error } = await portal.rpc('simula_conservacio');
    if (error) setError(error.message); else setSimulacio(data);
  };

  const retencio = async ({ motiu }) => {
    const activa = finestra.tipus === 'activa';
    const { error } = await portal.rpc(activa ? 'activa_retencio' : 'retira_retencio', {
      p_request_id: finestra.fila.request_id, p_motiu: motiu,
    });
    if (error) throw error;
    setOk(activa ? 'Retenció activada: aquest expedient no es destruirà mentre estigui activa.' : 'Retenció retirada.');
    setFinestra(null);
    carrega();
  };

  const requeriment = async ({ motiu, autoritat }) => {
    const r = await invoca('portal-requeriment', { request_id: finestra.fila.request_id, motiu, autoritat });
    setFinestra(null);
    setDadesReq(r.dades);
  };

  const retingudes = bloquejades.filter((b) => b.retencio);
  const ara = new Date();

  return (
    <div className="space-y-6">
      <Avis>{error}</Avis>
      <Avis tipus="ok">{ok}</Avis>

      <Targeta titol="Simulació del procés diari"
        accions={<Boto onClick={simula}>Simular ara</Boto>}>
        <p className="text-xs text-gray-500">
          Cada dia, a les 03:30 UTC, es bloquegen els expedients vençuts i es destrueixen els que han acabat el termini de
          bloqueig i no tenen cap retenció. La simulació mostra què passaria ara sense canviar res.
        </p>
        {simulacio && (
          <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
            <div>
              <p className="font-semibold text-gray-700 mb-1">Es bloquejarien ({simulacio.a_bloquejar.length})</p>
              {simulacio.a_bloquejar.map((x) => (
                <p key={x.request_id} className="text-xs text-gray-600">
                  <span className="font-mono">{x.referencia || curt(x.request_id)}</span> · {x.causa} · venç {dataCurta(x.vencut_el)}
                </p>
              ))}
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Es destruirien ({simulacio.a_destruir.length})</p>
              {simulacio.a_destruir.map((x) => (
                <p key={x.request_id} className="text-xs text-gray-600">
                  <span className="font-mono">{x.referencia || curt(x.request_id)}</span> · bloquejat {dataCurta(x.bloquejat_at)}
                </p>
              ))}
            </div>
          </div>
        )}
      </Targeta>

      <Targeta titol={`Propers venciments, 90 dies (${propers.length})`}>
        {propers.length === 0 ? <p className="text-sm text-gray-400">Cap venciment proper.</p> : (
          <div className="divide-y divide-gray-100">
            {propers.map((p) => (
              <div key={p.request_id} className="py-2.5 flex flex-wrap items-center gap-3 text-sm">
                <span className="flex-1 min-w-[200px]">
                  {p.nom_mostrat} <span className="text-xs text-gray-400 font-mono">{p.referencia_client}</span>
                </span>
                <EtiquetaEstat estat={p.status} />
                <span className="text-xs text-gray-500 w-40">{p.causa}</span>
                <span className={`text-xs w-44 ${new Date(p.vencut_el) <= ara ? 'text-amber-700 font-semibold' : 'text-gray-600'}`}>
                  {new Date(p.vencut_el) <= ara ? `Vençut el ${dataCurta(p.vencut_el)} (es bloqueja aquesta nit)` : `Venç el ${dataCurta(p.vencut_el)}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </Targeta>

      <Targeta titol={`Expedients bloquejats (${bloquejades.length})`}>
        <p className="text-xs text-gray-500 mb-3">
          Dades bloquejades: ningú les veu des del panell. Només es poden consultar per requeriment d'una autoritat.
        </p>
        {bloquejades.length === 0 ? <p className="text-sm text-gray-400">Cap expedient bloquejat.</p> : (
          <div className="divide-y divide-gray-100">
            {bloquejades.map((b) => (
              <div key={b.request_id} className="py-2.5 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-mono text-xs w-32">{b.referencia_client || curt(b.request_id)}</span>
                <EtiquetaEstat estat={b.status} />
                <span className="text-xs text-gray-500 flex-1 min-w-[220px]">
                  Bloquejat {dataCurta(b.bloquejat_at)} · es destruirà a partir del {dataCurta(b.destruir_despres_de)}
                  {b.retencio && <span className="ml-2 text-purple-700 font-semibold">Retingut</span>}
                </span>
                <Boto variant="secundari" onClick={() => setFinestra({ tipus: 'requeriment', fila: b })}>Accés per requeriment</Boto>
                {b.retencio
                  ? <Boto variant="secundari" onClick={() => setFinestra({ tipus: 'retira', fila: b })}>Retirar retenció</Boto>
                  : <Boto variant="secundari" onClick={() => setFinestra({ tipus: 'activa', fila: b })}>Activar retenció</Boto>}
              </div>
            ))}
          </div>
        )}
      </Targeta>

      <Targeta titol={`Retencions actives (${retingudes.length})`}>
        {retingudes.length === 0 ? <p className="text-sm text-gray-400">Cap retenció activa.</p> : (
          <div className="divide-y divide-gray-100">
            {retingudes.map((b) => (
              <div key={b.request_id} className="py-2 text-sm">
                <span className="font-mono text-xs">{b.referencia_client || curt(b.request_id)}</span>
                <span className="text-xs text-gray-500"> · des del {dataCurta(b.retencio.activada_at)} · {b.retencio.motiu}</span>
              </div>
            ))}
          </div>
        )}
      </Targeta>

      <Targeta titol={`Historial de destruccions (${destruccions.length})`}>
        {destruccions.length === 0 ? <p className="text-sm text-gray-400">Encara no s'ha destruït cap expedient.</p> : (
          <div className="divide-y divide-gray-100">
            {destruccions.map((d) => (
              <div key={d.id} className="py-2 text-xs text-gray-600 flex flex-wrap gap-3">
                <span className="w-32">{dataHora(d.at)}</span>
                <span className="font-mono">{curt(d.entitat_id)}</span>
                <span>bloquejat {dataCurta(d.detalls.bloquejat_at)}</span>
                <span>{d.detalls.fitxers_destruits} fitxers · {Object.values(d.detalls.files_esborrades || {}).reduce((s, n) => s + n, 0)} files</span>
              </div>
            ))}
          </div>
        )}
      </Targeta>

      {finestra?.tipus === 'requeriment' && (
        <Formulari titol="Accés per requeriment d'autoritat" ambAutoritat boto="Accedir"
          explicacio="Només per atendre un requeriment d'una autoritat (jutjat, Batllia, APDA...). L'accés, el motiu i l'autoritat queden registrats."
          onEnvia={requeriment} onTanca={() => setFinestra(null)} />
      )}
      {(finestra?.tipus === 'activa' || finestra?.tipus === 'retira') && (
        <Formulari titol={finestra.tipus === 'activa' ? 'Activar retenció' : 'Retirar retenció'}
          boto={finestra.tipus === 'activa' ? 'Activar' : 'Retirar'}
          explicacio={finestra.tipus === 'activa'
            ? 'Mentre hi hagi una reclamació o un procediment obert, aquest expedient no es destruirà.'
            : 'Un cop retirada, l\'expedient es destruirà quan toqui (si ja ha passat el termini, aquesta mateixa nit).'}
          onEnvia={retencio} onTanca={() => setFinestra(null)} />
      )}
      {dadesReq && <DadesRequeriment dades={dadesReq} onTanca={() => setDadesReq(null)} />}
    </div>
  );
};

export default Conservacio;
