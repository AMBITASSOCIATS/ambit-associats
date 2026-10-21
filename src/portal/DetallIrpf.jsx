// src/portal/DetallIrpf.jsx
// Detall d'una comunicació de dades personals i familiars al pagador (IRPF):
// estat, enllaços (perceptor i representant del pagador), respostes, signatures,
// càlcul del percentatge de retenció (amb el full intern del PDF d'ÀMBIT),
// versions del perceptor (què s'aplicava en qualsevol data), revisió anual i
// fi de les rendes (conservació). Les regles reals les aplica la base.
import React, { useCallback, useEffect, useState } from 'react';
import ModalMissatge from '../auth/ModalMissatge';
import { dataCurta, dataHora, invoca, missatgeEnllacIrpf, nomEstat, portal, urlDocument } from './portalApi';
import { Avis, Boto, Dada, Entrada, EtiquetaEstat, Selector, Targeta } from './ui';
import { FormCtx } from './kyc/camps';
import { Tota } from './irpf/Seccions';
import { coneixementPerDefecte, euros, percent } from './irpf/irpf-calcul';

const avui = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });
const pc = (v) => (v === null || v === undefined ? '—' : percent(Math.round(Number(v) * 100)));
const NOM_DOC = {
  signat: 'Comunicació signada pel perceptor (PDF)',
  copia_client: 'Còpia per al perceptor amb la recepció pel pagador (PDF)',
  intern: 'PDF intern d\'ÀMBIT amb el càlcul (no es lliura al perceptor)',
  evidencies: 'Imatge de la firma',
};
const TIPUS = { inicial: 'Inicial', modificacio: 'Modificació' };
const NOM_MODE = { comunicacio: 'Comunicació rebuda pel pagador', sense_comunicacio: 'Sense comunicació (art. 24.4)' };
const dataAndorra = (d) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });

// Avís del 15 de desembre: sempre visible; destacat a partir del 15 d'octubre
const AvisRevisio = () => {
  const d = avui().slice(5);
  const proper = d >= '10-15' && d <= '12-15';
  return (
    <div className={`border rounded-lg p-3 text-xs ${proper ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
      <strong>Revisió anual.</strong> La situació del cònjuge s'ha de comunicar cada any abans del 15 de desembre de l'any anterior
      (arts. 28.3 i 31.d del Reglament de l'IRPF); si no, no es té en compte. Envieu la revisió anual abans d'aquesta data, no al gener.
    </div>
  );
};

// ─── Càlcul del percentatge ─────────────────────────────────────────────────
const Calcul = ({ id, s, calculs, onFet }) => {
  const [f, setF] = useState({
    // Per defecte, la data d'efectes de la comunicació
    data_efectes: s.com.data_efectes || `${avui().slice(0, 4)}-01-01`,
    mode: s.status === 'actiu' ? 'comunicacio' : 'sense_comunicacio',
    retribucions: '', cotitzacions: '0', retribucions_satisfetes: '', retencions_practicades: '', data_coneixement: null,
  });
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [ocupat, setOcupat] = useState(false);
  const [exercicis, setExercicis] = useState(null);  // exercicis amb paràmetres creats
  // Quan canvia l'estat (p. ex. la comunicació passa a rebuda mentre la fitxa és
  // oberta), el mode i la data d'efectes tornen als que corresponen: amb la
  // comunicació rebuda, la comunicació i la seva data d'efectes
  const efectesComunicacio = s.com.data_efectes;
  useEffect(() => {
    setF((x) => ({
      ...x,
      mode: s.status === 'actiu' ? 'comunicacio' : 'sense_comunicacio',
      data_efectes: efectesComunicacio || x.data_efectes,
    }));
  }, [s.status, efectesComunicacio]);
  useEffect(() => {
    portal.from('irpf_parametres').select('exercici').then(({ data }) => setExercicis((data || []).map((x) => x.exercici)));
  }, []);
  const exercici = Number((f.data_efectes || '').slice(0, 4));
  // Sense els paràmetres de l'exercici no es pot calcular cap retenció
  const senseParametres = exercicis !== null && exercici > 0 && !exercicis.includes(exercici);
  const anterior = calculs
    .filter((c) => c.exercici === exercici && c.data_efectes <= f.data_efectes)
    .sort((a, b) => (a.data_efectes === b.data_efectes ? b.created_at.localeCompare(a.created_at) : b.data_efectes.localeCompare(a.data_efectes)))[0];
  // Data de coneixement: la indicada o, si no se n'ha indicat cap, la de recepció
  // de la comunicació quan el càlcul anterior no la va fer servir (com al servidor)
  const coneixementDefecte = coneixementPerDefecte({
    mode: f.mode, requestId: id, anterior, rebudaEl: s.rec?.signat_at ? dataAndorra(s.rec.signat_at) : null,
  });
  const coneixement = f.data_coneixement ?? coneixementDefecte ?? '';
  const senseLaComunicacio = s.status === 'actiu' && f.mode === 'sense_comunicacio';

  const crida = async (previsualitza) => {
    setError('');
    setOcupat(true);
    try {
      const r = await invoca('portal-irpf-personal', { accio: 'calcula', request_id: id, previsualitza, ...f, data_coneixement: anterior ? coneixement : '' });
      setRes(r);
      if (!previsualitza) {
        if (r.pdf_intern?.url) window.open(r.pdf_intern.url, '_blank', 'noopener');
        onFet();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupat(false);
    }
  };

  return (
    <Targeta titol="Càlcul del percentatge de retenció (ús intern)">
      <p className="text-xs text-gray-500 mb-3">
        Art. 24.1 del Reglament, amb els paràmetres de l'exercici de la data d'efectes (pestanya Paràmetres IRPF). El detall de cada pas
        es desa amb la comunicació i va a un full intern del PDF d'ÀMBIT; mai a la còpia del perceptor.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Entrada etiqueta="Data d'efectes del percentatge" type="date" value={f.data_efectes} onChange={(e) => setF({ ...f, data_efectes: e.target.value })}
          ajuda={exercici ? `Exercici ${exercici}` : ''} />
        <Selector etiqueta="Dades" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
          <option value="comunicacio" disabled={s.status !== 'actiu'}>Comunicació rebuda pel pagador</option>
          <option value="sense_comunicacio">Sense comunicació (art. 24.4)</option>
        </Selector>
        <Entrada etiqueta="Retribucions anuals estimades (€)" inputMode="decimal" value={f.retribucions} placeholder="Fixes i variables"
          onChange={(e) => setF({ ...f, retribucions: e.target.value })} />
        <Entrada etiqueta="Cotitzacions a càrrec del perceptor (€)" inputMode="decimal" value={f.cotitzacions}
          onChange={(e) => setF({ ...f, cotitzacions: e.target.value })} ajuda="A un sistema públic de seguretat social, si n'hi ha" />
      </div>
      {senseLaComunicacio && (
        <div className="mt-3"><Avis tipus="info">Hi ha una comunicació rebuda pel pagador i aquest càlcul no la farà servir (sense comunicació, art. 24.4).</Avis></div>
      )}
      {anterior && (
        <div className="mt-3 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-2">
            Hi ha un càlcul anterior de l'exercici {exercici} (efectes {dataCurta(anterior.data_efectes)}: {pc(anterior.percentatge)}, aplicat {pc(anterior.percentatge_aplicat)}).
            Si la variació supera un punt, es regularitza sobre la resta del període (art. 25): cal indicar el que ja s'ha satisfet i retingut.
          </p>
          <p className="text-xs text-gray-600 mb-2">
            Una variació s'aplica des del mes següent a aquell en què el pagador la coneix (art. 27.1.b): la data d'efectes ha de ser posterior.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Entrada etiqueta="Data en què el pagador coneix la variació" type="date" value={coneixement} max={avui()}
              onChange={(e) => setF({ ...f, data_coneixement: e.target.value })}
              ajuda={coneixementDefecte ? 'Per defecte, la de recepció de la comunicació pel pagador' : 'No pot ser futura'} />
            <Entrada etiqueta="Retribucions ja satisfetes de l'exercici (€)" inputMode="decimal" value={f.retribucions_satisfetes}
              onChange={(e) => setF({ ...f, retribucions_satisfetes: e.target.value })} />
            <Entrada etiqueta="Retencions ja practicades de l'exercici (€)" inputMode="decimal" value={f.retencions_practicades}
              onChange={(e) => setF({ ...f, retencions_practicades: e.target.value })} />
          </div>
        </div>
      )}
      {senseParametres && (
        <div className="mt-3"><Avis>Cal crear els paràmetres de l'exercici {exercici} (pestanya Paràmetres IRPF).</Avis></div>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        <Boto variant="secundari" onClick={() => crida(true)} disabled={ocupat || !f.retribucions || senseParametres || exercicis === null}>Previsualitzar</Boto>
        <Boto onClick={() => crida(false)} disabled={ocupat || !f.retribucions || senseParametres || exercicis === null}>{ocupat ? 'Calculant...' : 'Desar el càlcul i generar el PDF intern'}</Boto>
      </div>
      <div className="mt-3"><Avis>{error}</Avis></div>
      {res && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-6 items-baseline">
            <p className="text-sm">Percentatge calculat: <strong className="text-lg">{pc(res.percentatge)}</strong></p>
            <p className="text-sm">Percentatge aplicat: <strong className="text-lg text-[#007A7B]">{pc(res.percentatge_aplicat)}</strong></p>
            {res.detall?.regularitzacio && (
              <p className="text-xs text-gray-500">
                {res.detall.regularitzacio.aplica ? 'Regularitzat (variació de més d\'un punt)' : `Sense regularització (variació de ${percent(res.detall.regularitzacio.variacio)})`}
              </p>
            )}
            {res.calcul_id && <span className="text-xs text-green-700">Desat ✓</span>}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Dades: <strong>{NOM_MODE[res.mode]}</strong>
            {res.detall?.mode && res.detall.mode !== res.mode && <> · aplicades: <strong>{NOM_MODE[res.detall.mode]}</strong></>}
          </p>
          {(res.detall?.avisos || []).map((a, i) => <div key={i} className="mt-2"><Avis tipus="info">{a.ca}</Avis></div>)}
          <table className="w-full text-xs mt-3">
            <thead><tr className="text-left text-gray-500 border-b"><th className="py-1 pr-2">Pas</th><th className="pr-2">Concepte</th><th className="pr-2">Fórmula</th><th className="text-right">Import</th></tr></thead>
            <tbody>
              {res.detall.passos.map((p, i) => (
                <tr key={i} className="border-b border-gray-100 align-top">
                  <td className="py-1 pr-2 font-mono">{p.num}</td><td className="pr-2">{p.ca}</td>
                  <td className="pr-2 text-gray-600">{p.formula}</td>
                  <td className="text-right whitespace-nowrap">{typeof p.valor === 'number' ? euros(p.valor) : p.valor || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {res.detall.persones?.length > 0 && (
            <ul className="mt-3 text-xs text-gray-700 list-disc pl-5">
              {res.detall.persones.map((p, i) => <li key={i}><strong>{p.nom}</strong>{p.edat !== null ? ` (${p.edat} anys a 31/12)` : ''}: {p.formula}</li>)}
            </ul>
          )}
        </div>
      )}
    </Targeta>
  );
};

// ─── Versions del perceptor ─────────────────────────────────────────────────
const Versions = ({ s, comunicacions, calculs, onObre, onRevisio, ocupat }) => {
  const [data, setData] = useState(avui());
  const [vigent, setVigent] = useState(null);
  const [error, setError] = useState('');
  const consulta = async () => {
    setError('');
    const { data: v, error: e } = await portal.rpc('irpf_vigent', { p_perceptor_id: s.com.perceptor_id, p_data: data });
    if (e) setError(e.message); else setVigent(v);
  };
  const teRebuda = comunicacions.some((c) => c.requests?.status === 'actiu');
  return (
    <Targeta titol={`Versions de ${s.com.irpf_perceptors.nom}`}
      accions={teRebuda && <Boto onClick={onRevisio} disabled={ocupat}>Enviar revisió anual</Boto>}>
      <p className="text-xs text-gray-500 mb-2">Cada comunicació substitueix l'anterior des de la seva data d'efectes, sense esborrar-la.</p>
      <table className="w-full text-xs">
        <thead><tr className="text-left text-gray-500 border-b"><th className="py-1">Efectes</th><th>Tipus</th><th>Estat</th><th>Signada</th><th /></tr></thead>
        <tbody>
          {comunicacions.map((c) => (
            <tr key={c.request_id} className={`border-b border-gray-100 ${c.request_id === s.id ? 'bg-[#009B9C]/5 font-semibold' : ''}`}>
              <td className="py-1">{c.data_efectes ? dataCurta(c.data_efectes) : '—'}</td>
              <td>{TIPUS[c.comunicacio?.tipus] || '—'}</td>
              <td>{nomEstat(c.requests?.status, 'irpf_comunicacio')}</td>
              <td>{c.requests?.signat_at ? dataCurta(c.requests.signat_at) : '—'}</td>
              <td className="text-right">{c.request_id !== s.id && <button type="button" className="text-[#009B9C] hover:underline" onClick={() => onObre(c.request_id)}>Obrir</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {calculs.length > 0 && (
        <table className="w-full text-xs mt-4">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-1">Exercici</th><th>Efectes</th><th>Dades</th><th>Calculat</th><th>Aplicat</th><th>Fet el</th></tr></thead>
          <tbody>
            {calculs.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="py-1">{c.exercici}</td><td>{dataCurta(c.data_efectes)}</td>
                <td>{c.mode === 'comunicacio' ? 'Comunicació' : 'Sense comunicació (art. 24.4)'}{c.mode_aplicat && c.mode_aplicat !== c.mode ? ' (encara no aplicada)' : ''}</td>
                <td>{pc(c.percentatge)}</td><td className="font-semibold">{pc(c.percentatge_aplicat)}{c.regularitzat ? ' (regularitzat)' : ''}</td>
                <td>{dataHora(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex flex-wrap items-end gap-3 mt-4">
        <Entrada etiqueta="Què s'aplicava el dia…" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <Boto variant="secundari" onClick={consulta} disabled={!data}>Consultar</Boto>
        <Avis>{error}</Avis>
      </div>
      {vigent && (
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
          <Dada etiqueta={`Comunicació vigent el ${dataCurta(vigent.data)}`}>
            {vigent.comunicacio ? `${TIPUS[vigent.comunicacio.tipus] || ''} amb efectes del ${dataCurta(vigent.comunicacio.data_efectes)}` : 'Cap (art. 24.4: sense comunicació)'}
          </Dada>
          <Dada etiqueta="Estat civil comunicat">{vigent.comunicacio?.dades?.estat_civil?.estat || '—'}</Dada>
          <Dada etiqueta="Percentatge aplicat">
            {vigent.calcul ? `${pc(vigent.calcul.percentatge_aplicat)} (exercici ${vigent.calcul.exercici}, efectes ${dataCurta(vigent.calcul.data_efectes)})` : 'Cap càlcul'}
          </Dada>
        </dl>
      )}
    </Targeta>
  );
};

// ─── Relació amb el pagador: termini de la comunicació inicial (arts. 31.a i 31.b)
const Relacio = ({ p, onDesat }) => {
  const [inici, setInici] = useState(p.inici_relacio || '');
  const [laboral, setLaboral] = useState(p.relacio_laboral !== false);
  const [error, setError] = useState('');
  const canviat = inici !== (p.inici_relacio || '') || laboral !== (p.relacio_laboral !== false);
  const desa = async () => {
    setError('');
    const { error: e } = await portal.from('irpf_perceptors').update({ inici_relacio: inici || null, relacio_laboral: laboral }).eq('id', p.id);
    if (e) setError(e.message); else onDesat();
  };
  return (
    <Targeta titol="Relació amb el pagador">
      <p className="text-xs text-gray-500 mb-3">
        La comunicació inicial compta des de la seva data d'efectes si el pagador la rep dins dels 10 dies següents a l'inici de la relació
        laboral (art. 31.a) o, si no és laboral, com a molt tard el dia anterior al primer pagament (art. 31.b). Si no, és una variació: des del mes següent a rebre-la.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Entrada etiqueta={laboral ? 'Inici de la relació laboral' : 'Data del primer pagament'} type="date" value={inici} onChange={(e) => setInici(e.target.value)} />
        <label className="flex items-center gap-2 text-xs text-gray-700 pb-2">
          <input type="checkbox" checked={!laboral} onChange={(e) => setLaboral(!e.target.checked)} className="accent-[#009B9C]" />
          Rendes que no són d'una relació laboral
        </label>
        {canviat && <Boto onClick={desa}>Desar</Boto>}
        <Avis>{error}</Avis>
      </div>
    </Targeta>
  );
};

// ─── Detall ─────────────────────────────────────────────────────────────────
const DetallIrpf = ({ id, onTorna, rol }) => {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [missatge, setMissatge] = useState(null);
  const [ocupat, setOcupat] = useState(false);
  const [motiu, setMotiu] = useState('');
  const [fiRendes, setFiRendes] = useState('');
  const [revisio, setRevisio] = useState(null);

  const carrega = useCallback(async () => {
    const [req, com, sig, rec, docs, enllac] = await Promise.all([
      portal.from('requests')
        .select('id, status, template_version, created_at, enviat_at, signat_at, activat_at, anullat_at, motiu_anullacio, clients(id, nom_mostrat, party_type, referencia_client)')
        .eq('id', id).single(),
      portal.from('irpf_comunicacions')
        .select('id, perceptor_id, revisio_de, doble_signatura, pagador, dades, desat_at, data_efectes, irpf_perceptors(id, nom, nrt, email, es_representant, data_fi_rendes, inici_relacio, relacio_laboral)')
        .eq('request_id', id).single(),
      portal.from('signatures').select('signatari_nom, lloc, signat_at, ip, user_agent, empremta_dades').eq('request_id', id).maybeSingle(),
      portal.from('irpf_recepcions').select('representant_nom, representant_carrec, signat_at, ip, user_agent, empremta_dades, mateixa_sessio').eq('request_id', id).maybeSingle(),
      portal.from('documents').select('id, kind, storage_path, sha256, mida_bytes, created_at').eq('request_id', id).order('created_at'),
      portal.rpc('estat_enllac', { p_request_id: id }),
    ]);
    if (req.error || com.error) { setError((req.error || com.error).message); return; }
    const pid = com.data.perceptor_id;
    const [coms, calcs] = await Promise.all([
      portal.from('irpf_comunicacions').select('request_id, data_efectes, comunicacio:dades->comunicacio, requests(status, signat_at, created_at)')
        .eq('perceptor_id', pid),
      portal.from('irpf_calculs').select('id, request_id, exercici, data_efectes, mode, mode_aplicat:detall->>mode, percentatge, percentatge_aplicat, regularitzat, created_at')
        .eq('perceptor_id', pid).order('data_efectes', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    const comunicacions = (coms.data || []).sort((a, b) => (b.data_efectes || '9999').localeCompare(a.data_efectes || '9999')
      || (b.requests?.created_at || '').localeCompare(a.requests?.created_at || ''));
    setS({ ...req.data, com: com.data, sig: sig.data, rec: rec.data, docs: docs.data || [], enllac: enllac.data?.[0] || null, comunicacions, calculs: calcs.data || [] });
    setFiRendes(com.data.irpf_perceptors?.data_fi_rendes || '');
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
    setMissatge(missatgeEnllacIrpf({
      nom: s.com.irpf_perceptors.nom, perceptor: s.sig?.signatari_nom || s.com.irpf_perceptors.nom,
      pagador: s.com.pagador.denominacio, enllac: r.enllac, expira: r.expira_at, destinatari: r.destinatari,
      email: r.destinatari === 'perceptor' ? s.com.irpf_perceptors.email : '',
    }));
  });

  const anulla = (signada) => {
    if (!window.confirm('Segur que vols anul·lar aquesta comunicació? No es pot desfer.')) return;
    accio(async () => {
      const { error: e } = await portal.from('requests')
        .update(signada ? { status: 'anullat', motiu_anullacio: motiu.trim() } : { status: 'anullat' }).eq('id', id);
      if (e) throw e;
    });
  };

  const desaFiRendes = () => {
    if (!window.confirm(fiRendes ? `Fixar la fi de les rendes el ${fiRendes}? Des d'aquesta data compten els sis anys de conservació.` : 'Treure la data de fi de les rendes?')) return;
    accio(async () => {
      const { error: e } = await portal.rpc('irpf_fixa_fi_rendes', { p_perceptor_id: s.com.perceptor_id, p_data: fiRendes || null });
      if (e) throw e;
    });
  };

  const enviaRevisio = () => {
    if (!window.confirm('Crear la revisió anual (preomplerta amb la comunicació vigent) i generar-ne l\'enllaç per al perceptor?')) return;
    accio(async () => {
      const { data: nou, error: e } = await portal.rpc('irpf_revisio_anual', { p_perceptor_id: s.com.perceptor_id });
      if (e) throw e;
      const r = await invoca('portal-enllac', { request_id: nou });
      setRevisio(nou);
      setMissatge(missatgeEnllacIrpf({
        nom: s.com.irpf_perceptors.nom, pagador: s.com.pagador.denominacio, enllac: r.enllac, expira: r.expira_at, destinatari: 'perceptor',
        email: s.com.irpf_perceptors.email,
      }));
    });
  };

  const descarrega = (doc) => accio(async () => {
    const ext = doc.storage_path.split('.').pop();
    const url = await urlDocument(doc.storage_path, `IRPF-${doc.kind}-${s.clients.referencia_client || id.slice(0, 8)}.${ext}`);
    window.open(url, '_blank', 'noopener');
  });

  if (!s) return <p className="text-sm text-gray-400">{error || 'Carregant...'}</p>;
  const p = s.com.irpf_perceptors;
  const potEnllac = ['esborrany', 'enviat', 'en_curs'].includes(s.status);
  const pendentRecepcio = s.status === 'signat' && !s.rec;

  return (
    <div className="space-y-5">
      <button onClick={() => onTorna()} className="text-sm text-[#009B9C] hover:underline">← Totes les sol·licituds</button>

      <Targeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Comunicació de dades al pagador (IRPF) · {s.template_version}</p>
            <h2 className="text-lg font-bold text-gray-800">{p.nom}</h2>
            <p className="text-xs text-gray-500">
              Perceptor · NRT {p.nrt} · {p.email}{s.com.doble_signatura ? ' · representant del pagador (doble signatura)' : ''}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Pagador: <strong>{s.com.pagador.denominacio}</strong> · NRT {s.com.pagador.nrt} · client{' '}
              <span className="font-mono">{s.clients.referencia_client || 'sense referència'}</span>
            </p>
          </div>
          <EtiquetaEstat estat={s.status} tipus="irpf_comunicacio" />
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5">
          <Dada etiqueta="Creada">{dataCurta(s.created_at)}</Dada>
          <Dada etiqueta="Enviada">{dataHora(s.enviat_at)}</Dada>
          <Dada etiqueta="Signada pel perceptor">{dataHora(s.signat_at)}</Dada>
          <Dada etiqueta="Rebuda pel pagador">{dataHora(s.rec?.signat_at)}</Dada>
          <Dada etiqueta="Data d'efectes">{s.com.data_efectes ? dataCurta(s.com.data_efectes) : '—'}</Dada>
          {s.anullat_at && <Dada etiqueta="Anul·lada">{dataHora(s.anullat_at)}</Dada>}
          {s.motiu_anullacio && <Dada etiqueta="Motiu de l'anul·lació">{s.motiu_anullacio}</Dada>}
        </dl>
      </Targeta>

      <AvisRevisio />
      <Avis>{error}</Avis>

      {potEnllac && (
        <Targeta titol="Enllaç per al perceptor">
          <p className="text-xs text-gray-500 mb-3">
            {s.enllac
              ? `Hi ha un enllaç vigent fins al ${dataHora(s.enllac.expira_at)}. Si el generes de nou, l'anterior deixarà de funcionar.`
              : 'Genera l\'enllaç i envia\'l al perceptor des del teu correu. Caduca als 7 dies i només serveix una vegada.'}
            {s.com.doble_signatura && ' El perceptor és el representant del pagador: signarà també la recepció en la mateixa sessió.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Boto onClick={generaEnllac} disabled={ocupat}>{s.enllac || s.status !== 'esborrany' ? 'Regenerar enllaç' : 'Generar enllaç'}</Boto>
            <Boto variant="perill" onClick={() => anulla(false)} disabled={ocupat}>Anul·lar la comunicació</Boto>
          </div>
        </Targeta>
      )}

      {pendentRecepcio && (
        <Targeta titol="Recepció pel pagador (apartat 12)">
          <p className="text-xs text-gray-500 mb-3">
            El perceptor ja ha signat. Genera l'enllaç perquè el representant del pagador en signi la recepció.
            {s.enllac && ` Hi ha un enllaç vigent fins al ${dataHora(s.enllac.expira_at)}.`}
          </p>
          <Boto onClick={generaEnllac} disabled={ocupat}>{s.enllac ? 'Regenerar l\'enllaç del representant' : 'Generar l\'enllaç del representant'}</Boto>
          {rol === 'ocic' && (
            <div className="flex flex-wrap items-end gap-3 mt-4 pt-3 border-t border-gray-100">
              <Entrada etiqueta="Anul·lar la comunicació signada (només OCIC) · motiu" value={motiu} className="flex-1 min-w-[240px]" maxLength={500}
                onChange={(e) => setMotiu(e.target.value)} />
              <Boto variant="perill" onClick={() => anulla(true)} disabled={ocupat || !motiu.trim()}>Anul·lar</Boto>
            </div>
          )}
        </Targeta>
      )}

      {revisio && (
        <Avis tipus="ok">
          S'ha creat la revisió anual.{' '}
          <button type="button" className="underline font-semibold" onClick={() => onTorna(revisio)}>Obrir la revisió</button>
        </Avis>
      )}

      {s.status !== 'anullat' && <Calcul id={id} s={s} calculs={s.calculs} onFet={carrega} />}

      <Versions s={s} comunicacions={s.comunicacions} calculs={s.calculs} onObre={(r) => onTorna(r)} onRevisio={enviaRevisio} ocupat={ocupat} />

      <Relacio p={p} onDesat={carrega} />

      <Targeta titol="Conservació">
        <p className="text-xs text-gray-500 mb-3">
          Mentre el perceptor rep rendes del pagador i sis anys després; després, bloqueig de tres anys i destrucció (pestanya Conservació).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Entrada etiqueta="Fi de les rendes del pagador" type="date" value={fiRendes} max={avui()} onChange={(e) => setFiRendes(e.target.value)} />
          {fiRendes !== (p.data_fi_rendes || '') && <Boto onClick={desaFiRendes} disabled={ocupat}>Desar</Boto>}
          {p.data_fi_rendes && (
            <span className="text-xs text-gray-500">Conservació fins al {dataCurta(`${Number(p.data_fi_rendes.slice(0, 4)) + 6}${p.data_fi_rendes.slice(4)}`)}</span>
          )}
        </div>
      </Targeta>

      <Targeta titol="Respostes de la comunicació">
        {s.status === 'esborrany' && !s.com.desat_at ? (
          <p className="text-sm text-gray-400">El perceptor encara no ha omplert el formulari.</p>
        ) : (
          <FormCtx.Provider value={{ dades: s.com.dades || {}, posa: () => {}, err: () => false, llegir: true }}>
            <fieldset disabled className="opacity-95"><Tota pagador={s.com.pagador} /></fieldset>
          </FormCtx.Provider>
        )}
      </Targeta>

      {(s.sig || s.rec) && (
        <Targeta titol="Signatures i evidències">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {s.sig && (
              <>
                <Dada etiqueta="Perceptor (apartat 11)">{`${s.sig.signatari_nom} · ${s.sig.lloc}`}</Dada>
                <Dada etiqueta="Data i hora (UTC)">{new Date(s.sig.signat_at).toISOString().replace('T', ' ').slice(0, 19)}</Dada>
                <Dada etiqueta="Adreça IP">{s.sig.ip}</Dada>
                <Dada etiqueta="Empremta de les dades (SHA-256)"><span className="font-mono text-xs">{s.sig.empremta_dades}</span></Dada>
              </>
            )}
            {s.rec && (
              <>
                <Dada etiqueta="Recepció pel pagador (apartat 12)">
                  {`${s.rec.representant_nom} · ${s.rec.representant_carrec}${s.rec.mateixa_sessio ? ' · en la mateixa sessió' : ''}`}
                </Dada>
                <Dada etiqueta="Data i hora (UTC)">{new Date(s.rec.signat_at).toISOString().replace('T', ' ').slice(0, 19)}</Dada>
                <Dada etiqueta="Empremta de la recepció (SHA-256)"><span className="font-mono text-xs">{s.rec.empremta_dades}</span></Dada>
              </>
            )}
          </dl>
        </Targeta>
      )}

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

export default DetallIrpf;
