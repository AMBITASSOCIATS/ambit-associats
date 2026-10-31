// src/portal/ParametresIrpf.jsx
// Paràmetres del càlcul del percentatge de retenció de l'IRPF, per exercici
// (portal.irpf_parametres). Els edita el personal; cada canvi queda a
// l'auditoria i cada càlcul en desa una còpia dels que ha fet servir, de
// manera que editar-los no canvia cap càlcul ja fet.
import React, { useEffect, useState } from 'react';
import { dataHora, portal } from './portalApi';
import { Avis, Boto, Entrada, Targeta } from './ui';

const CAMPS = [
  ['minim_personal', 'Mínim personal (€)'],
  ['minim_incapacitat', 'Mínim per incapacitat (€)'],
  ['limit_conjuge', 'Límit conjunt amb cònjuge (€)'],
  ['reduccio_familiar', 'Reducció per descendent, ascendent o persona tutelada o acollida (€)'],
  ['coeficient_discapacitat', 'Coeficient per discapacitat o dependència'],
  ['max_matricules', 'Matrícules: màxim per descendent (€)'],
  ['salari_minim', 'Salari mínim interprofessional (€)'],
  ['habitatge_percentatge', 'Habitatge: percentatge (%)'],
  ['habitatge_maxim', 'Habitatge: màxim (€)'],
  ['plans_percentatge', 'Plans de pensions: % dels rendiments nets'],
  ['plans_maxim', 'Plans de pensions: màxim (€)'],
  ['tipus', 'Tipus de gravamen (%)'],
  ['bonificacio_percentatge', 'Bonificació (%)'],
  ['bonificacio_maxim', 'Bonificació: màxim (€)'],
  ['despeses_percentatge', 'Despeses del treball (%)'],
  ['despeses_maxim', 'Despeses del treball: màxim (€)'],
  ['edat_descendents', 'Descendents menors de (anys)'],
  ['edat_ascendents', 'Ascendents majors de (anys)'],
  ['regularitzacio_llindar', 'Regularització: variació mínima (punts)'],
  ['regularitzacio_maxim', 'Regularització: percentatge màxim (%)'],
];

const Exercici = ({ fila, onDesat }) => {
  const [v, setV] = useState(() => Object.fromEntries(CAMPS.map(([k]) => [k, String(fila[k])])));
  const [estat, setEstat] = useState({ desant: false, error: '', ok: false });
  const canviat = CAMPS.some(([k]) => String(fila[k]) !== v[k]);
  const desa = async () => {
    setEstat({ desant: true, error: '', ok: false });
    const canvis = Object.fromEntries(CAMPS.map(([k]) => [k, v[k].replace(',', '.').trim()]));
    const { error } = await portal.from('irpf_parametres').update(canvis).eq('exercici', fila.exercici);
    setEstat({ desant: false, error: error?.message || '', ok: !error });
    if (!error) onDesat();
  };
  return (
    <Targeta titol={`Exercici ${fila.exercici}`}
      accions={<span className="text-[11px] text-[#6B8280]">Darrer canvi {dataHora(fila.updated_at)}</span>}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {CAMPS.map(([k, nom]) => (
          <Entrada key={k} etiqueta={nom} inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3">
        {canviat && <Boto onClick={desa} disabled={estat.desant}>{estat.desant ? 'Desant...' : 'Desar els canvis'}</Boto>}
        {estat.ok && <span className="text-xs text-green-600">Desat ✓</span>}
        <Avis>{estat.error}</Avis>
      </div>
    </Targeta>
  );
};

const ParametresIrpf = () => {
  const [files, setFiles] = useState([]);
  const [nou, setNou] = useState('');
  const [error, setError] = useState('');

  const carrega = async () => {
    const { data } = await portal.from('irpf_parametres').select('*').order('exercici', { ascending: false });
    setFiles(data || []);
  };
  useEffect(() => { carrega(); }, []);

  // Exercici nou: es copia el més recent i després s'editen els valors que canviïn (p. ex. el salari mínim)
  const crea = async () => {
    setError('');
    const base = files[0];
    if (!base) { setError('No hi ha cap exercici del qual partir'); return; }
    const fila = Object.fromEntries(CAMPS.map(([k]) => [k, base[k]]));
    const { error: e } = await portal.from('irpf_parametres').insert({ ...fila, exercici: Number(nou) });
    if (e) { setError(e.code === '23505' ? 'Aquest exercici ja existeix' : e.message); return; }
    setNou('');
    carrega();
  };

  return (
    <div className="space-y-6">
      <Targeta titol="Paràmetres del càlcul de la retenció de l'IRPF">
        <p className="text-xs text-[#4E6765] mb-3">
          Rendes del treball no cotitzades (art. 24.1 del Reglament). Els paràmetres de cada exercici es fan servir per calcular el
          percentatge de les comunicacions amb data d'efectes d'aquell any. Cada càlcul en desa una còpia: editar-los no canvia els
          càlculs ja fets. Reviseu sobretot el salari mínim interprofessional de cada any.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Entrada etiqueta="Exercici nou (a partir del més recent)" inputMode="numeric" maxLength={4} value={nou} placeholder="AAAA"
            onChange={(e) => setNou(e.target.value.replace(/\D/g, ''))} />
          <Boto onClick={crea} disabled={nou.length !== 4}>+ Crear l'exercici</Boto>
          <Avis>{error}</Avis>
        </div>
      </Targeta>
      {files.map((f) => <Exercici key={`${f.exercici}-${f.updated_at}`} fila={f} onDesat={carrega} />)}
    </div>
  );
};

export default ParametresIrpf;
