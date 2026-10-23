// src/portal/contracte/DetallContracte.jsx
// Detall d'un contracte: original (empremta i pàgines), signants (enllaç de
// cadascun, acceptació prèvia i signatura), signatura d'ÀMBIT, PDF final per
// descarregar i enviar a cada signant, i anul·lació (només OCIC, amb motiu,
// abans de signat). Les regles reals les aplica la base.
import React, { useCallback, useEffect, useState } from 'react';
import ModalMissatge from '../../auth/ModalMissatge';
import { dataCurta, dataHora, invoca, missatgeEnllacContracte, portal, urlDocument } from '../portalApi';
import { pujaOriginal } from './original';
import { Avis, Boto, Dada, Entrada, EtiquetaEstat, Targeta } from '../ui';

const NOM_DOC = {
  original: 'PDF original (sense modificar)',
  evidencies: 'Imatge de la firma d\'un signant',
  signat: 'PDF final signat per totes les parts',
};
const IDIOMES = { ca: 'Català', ca_en: 'Català i anglès' };
const utc = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : '—');

const DetallContracte = ({ id, onTorna, rol }) => {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [missatge, setMissatge] = useState(null);
  const [ocupat, setOcupat] = useState(false);
  const [motiu, setMotiu] = useState('');
  const [nouPdf, setNouPdf] = useState(null);

  const carrega = useCallback(async () => {
    const [req, k, orig, sig, cf, docs, enllacos, ambit] = await Promise.all([
      portal.from('requests')
        .select('id, status, template_version, created_at, enviat_at, signat_at, anullat_at, motiu_anullacio, clients(id, nom_mostrat, party_type, referencia_client, data_fi_relacio)')
        .eq('id', id).single(),
      portal.from('contractes').select('titol, idioma').eq('request_id', id).single(),
      portal.from('contracte_originals').select('nom_fitxer, pagines, sha256, mida_bytes, created_at').eq('request_id', id).maybeSingle(),
      portal.from('contracte_signants')
        .select('id, ordre, nom, email, qualitat, acceptat_at, lloc, signat_at, ip, user_agent, imatge_sha256, empremta_dades')
        .eq('request_id', id).order('ordre'),
      portal.from('contracte_contrafirmes').select('nom, carrec, signat_at, imatge_sha256, empremta_dades').eq('request_id', id).maybeSingle(),
      portal.from('documents').select('id, kind, storage_path, sha256, mida_bytes, created_at').eq('request_id', id).order('created_at'),
      portal.rpc('estat_enllacos_contracte', { p_request_id: id }),
      portal.rpc('es_signant_ambit'),
    ]);
    if (req.error || k.error) { setError((req.error || k.error).message); return; }
    setS({
      ...req.data, k: k.data, orig: orig.data, signants: sig.data || [], cf: cf.data, docs: docs.data || [],
      enllacos: Object.fromEntries((enllacos.data || []).map((e) => [e.signant_id, e])), soc: ambit.data === true,
    });
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

  const enllac = (sg) => accio(async () => {
    const r = await invoca('portal-contracte-personal', { accio: 'enllac', signant_id: sg.id });
    setMissatge(missatgeEnllacContracte({ nom: r.nom, titol: r.titol, enllac: r.enllac, expira: r.expira_at, idioma: r.idioma, email: r.email }));
  });

  const pujaNou = () => accio(async () => {
    if (!nouPdf) return;
    if (nouPdf.type !== 'application/pdf' || nouPdf.size > 20 * 1024 * 1024) throw new Error('Només PDF, màxim 20 MB');
    await pujaOriginal(id, nouPdf);
    setNouPdf(null);
  });

  const descarrega = (doc) => accio(async () => {
    const ref = s.clients.referencia_client || id.slice(0, 8);
    const nom = doc.kind === 'signat' ? `Contracte-signat-${ref}.pdf`
      : doc.kind === 'original' ? (s.orig?.nom_fitxer || `Contracte-original-${ref}.pdf`)
        : `${doc.kind}-${ref}.${doc.storage_path.split('.').pop()}`;
    window.open(await urlDocument(doc.storage_path, nom), '_blank', 'noopener');
  });

  const contrafirma = () => {
    if (!window.confirm(
      'Signaràs aquest contracte en nom de DEL SOTO – PALEARI & ASSOCIATS, SL, amb la teva firma registrada '
      + '(Martín Paleari · Administrador solidari), i es generarà el PDF final. No es pot desfer. Vols continuar?',
    )) return;
    accio(async () => {
      const r = await invoca('portal-contracte-personal', { accio: 'contrafirma', request_id: id });
      if (r.pdf_final?.url) window.open(r.pdf_final.url, '_blank', 'noopener');
    });
  };
  const pdfFinal = () => accio(async () => {
    const r = await invoca('portal-contracte-personal', { accio: 'pdf_final', request_id: id });
    if (r.pdf_final?.url) window.open(r.pdf_final.url, '_blank', 'noopener');
  });

  const anulla = () => {
    if (!window.confirm('Segur que vols anul·lar aquest contracte? No es pot desfer. Els enllaços pendents deixaran de funcionar.')) return;
    accio(async () => {
      const { error: e } = await portal.rpc('anulla_contracte', { p_request_id: id, p_motiu: motiu.trim() });
      if (e) throw e;
    });
  };

  if (!s) return <p className="text-sm text-gray-400">{error || 'Carregant...'}</p>;
  const potEnllac = ['esborrany', 'enviat', 'parcialment_signat'].includes(s.status) && !!s.orig;
  const potAnullar = rol === 'ocic' && ['esborrany', 'enviat', 'parcialment_signat', 'pendent_ambit'].includes(s.status);
  const pdfSignat = s.docs.find((d) => d.kind === 'signat');
  const signats = s.signants.filter((x) => x.signat_at).length;

  return (
    <div className="space-y-5">
      <button onClick={() => onTorna()} className="text-sm text-[#009B9C] hover:underline">← Totes les sol·licituds</button>

      <Targeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Contracte · pàgines afegides {s.template_version} · {IDIOMES[s.k.idioma]}</p>
            <h2 className="text-lg font-bold text-gray-800">{s.k.titol}</h2>
            <p className="text-xs text-gray-500">
              {s.clients.nom_mostrat} · {s.clients.party_type === 'pj' ? 'Persona jurídica' : 'Persona física'} · Referència:{' '}
              <span className="font-mono">{s.clients.referencia_client || 'sense assignar'}</span>
            </p>
          </div>
          <EtiquetaEstat estat={s.status} tipus="contracte" />
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5">
          <Dada etiqueta="Creat">{dataCurta(s.created_at)}</Dada>
          <Dada etiqueta="Enviat">{dataHora(s.enviat_at)}</Dada>
          <Dada etiqueta="Signants">{`${signats} de ${s.signants.length}`}</Dada>
          <Dada etiqueta="Signat per ÀMBIT">{dataHora(s.cf?.signat_at)}</Dada>
          <Dada etiqueta="Fi de la relació">{s.clients.data_fi_relacio ? dataCurta(s.clients.data_fi_relacio) : 'vigent'}</Dada>
          {s.anullat_at && <Dada etiqueta="Anul·lat">{dataHora(s.anullat_at)}</Dada>}
          {s.motiu_anullacio && <Dada etiqueta="Motiu de l'anul·lació">{s.motiu_anullacio}</Dada>}
        </dl>
      </Targeta>

      <Avis>{error}</Avis>

      {/* PDF original */}
      <Targeta titol="PDF original">
        {s.orig ? (
          <dl className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Dada etiqueta="Fitxer">{s.orig.nom_fitxer}</Dada>
            <Dada etiqueta="Pàgines">{s.orig.pagines}</Dada>
            <Dada etiqueta="Mida">{`${(s.orig.mida_bytes / 1024).toFixed(0)} KB`}</Dada>
            <Dada etiqueta="Empremta SHA-256"><span className="font-mono text-xs break-all">{s.orig.sha256}</span></Dada>
          </dl>
        ) : s.status === 'esborrany' ? (
          <div className="space-y-2">
            <Avis tipus="info">Aquest esborrany encara no té el PDF original. Puja'n un de vàlid (PDF sense contrasenya, màxim 20 MB) per poder enviar-lo.</Avis>
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" accept="application/pdf" onChange={(e) => setNouPdf(e.target.files?.[0] || null)} className="text-sm" />
              <Boto onClick={pujaNou} disabled={ocupat || !nouPdf}>{ocupat ? 'Comprovant...' : 'Pujar el PDF original'}</Boto>
            </div>
          </div>
        ) : <p className="text-sm text-gray-400">—</p>}
      </Targeta>

      {/* Signants */}
      <Targeta titol="Signants del client">
        <p className="text-xs text-gray-500 mb-3">
          Cada signant té el seu enllaç i pot signar en qualsevol ordre. L'enllaç caduca als 7 dies i només serveix una vegada;
          si se'n genera un de nou, l'anterior del mateix signant deixa de funcionar.
        </p>
        <div className="divide-y divide-gray-100">
          {s.signants.map((sg) => {
            const e = s.enllacos[sg.id];
            return (
              <div key={sg.id} className="py-3 flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-[240px]">
                  <p className="text-sm font-semibold text-gray-800">{sg.ordre}. {sg.nom}</p>
                  <p className="text-xs text-gray-500">{sg.qualitat} · {sg.email}</p>
                  <p className="text-xs mt-1">
                    {sg.signat_at
                      ? <span className="text-green-700">Signat el {dataHora(sg.signat_at)} a {sg.lloc}</span>
                      : sg.acceptat_at
                        ? <span className="text-amber-700">Ha acceptat la signatura electrònica ({dataHora(sg.acceptat_at)}); pendent de signar</span>
                        : <span className="text-gray-500">Pendent</span>}
                    {!sg.signat_at && e && <span className="text-gray-400"> · enllaç vigent fins al {dataHora(e.expira_at)}</span>}
                  </p>
                  {sg.signat_at && (
                    <p className="text-[11px] text-gray-400 font-mono break-all mt-1">
                      Acceptació {utc(sg.acceptat_at)} UTC · signatura {utc(sg.signat_at)} UTC · IP {sg.ip || '—'} · firma SHA-256 {sg.imatge_sha256}
                    </p>
                  )}
                </div>
                {potEnllac && !sg.signat_at && (
                  <Boto onClick={() => enllac(sg)} disabled={ocupat}>{e ? 'Regenerar enllaç' : 'Generar enllaç'}</Boto>
                )}
              </div>
            );
          })}
        </div>
      </Targeta>

      {/* Signatura d'ÀMBIT */}
      {s.status === 'pendent_ambit' && (
        <Targeta titol="Pendent de signatura d'ÀMBIT">
          <p className="text-xs text-gray-500 mb-3">
            Han signat tots els signants del client. Falta la signatura d'ÀMBIT (Martín Paleari · Administrador solidari), que només
            pot fer mpaleari@ambit.ad amb la seva sessió. En signar, es genera el PDF final.
          </p>
          {s.soc
            ? <Boto variant="exit" onClick={contrafirma} disabled={ocupat}>{ocupat ? 'Signant...' : 'Signar en nom d\'ÀMBIT'}</Boto>
            : <Avis tipus="info">Només mpaleari@ambit.ad pot signar en nom d'ÀMBIT.</Avis>}
        </Targeta>
      )}

      {s.status === 'signat' && (
        <Targeta titol="Contracte signat">
          {s.cf && (
            <p className="text-xs text-gray-500 mb-3">
              Signat per ÀMBIT ({s.cf.nom} · {s.cf.carrec}) el {dataHora(s.cf.signat_at)}.
              Descarrega el PDF final i envia'n una còpia a cada signant.
            </p>
          )}
          {pdfSignat ? (
            <div className="space-y-2">
              <Boto onClick={() => descarrega(pdfSignat)} disabled={ocupat}>Descarregar el PDF final</Boto>
              <p className="text-[11px] text-gray-400 font-mono break-all">SHA-256 {pdfSignat.sha256}</p>
            </div>
          ) : s.soc ? (
            <div className="space-y-2">
              <Avis tipus="info">El PDF final encara no s'ha generat.</Avis>
              <Boto onClick={pdfFinal} disabled={ocupat}>Generar el PDF final</Boto>
            </div>
          ) : <Avis tipus="info">El PDF final encara no s'ha generat. L'ha de generar mpaleari@ambit.ad.</Avis>}
        </Targeta>
      )}

      {potAnullar && (
        <Targeta titol="Anul·lar el contracte (només OCIC)">
          <p className="text-xs text-gray-500 mb-3">
            Per canviar el contracte, s'anul·la i se'n crea un altre. Les signatures fetes es conserven. Un cop signat per totes les parts, ja no es pot anul·lar.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Entrada etiqueta="Motiu (obligatori)" value={motiu} className="flex-1 min-w-[240px]" maxLength={500} onChange={(e) => setMotiu(e.target.value)} />
            <Boto variant="perill" onClick={anulla} disabled={ocupat || !motiu.trim()}>Anul·lar</Boto>
          </div>
        </Targeta>
      )}

      <Targeta titol="Conservació">
        <p className="text-xs text-gray-500">
          Mentre dura la relació amb el client i sis anys després (la fi de la relació la fixa l'OCIC a la pestanya Clients);
          després, bloqueig de tres anys i destrucció (pestanya Conservació).
        </p>
      </Targeta>

      {s.docs.length > 0 && (
        <Targeta titol="Documents">
          <div className="divide-y divide-gray-100">
            {s.docs.map((d) => (
              <div key={d.id} className="py-2.5 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm text-gray-800">{NOM_DOC[d.kind] || d.kind}</p>
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

export default DetallContracte;
