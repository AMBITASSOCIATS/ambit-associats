// src/portal/contracte/NouContracte.jsx
// Nou contracte des d'un client: PDF original (només PDF, màxim 20 MB),
// títol, idioma ("Català" o "Català i anglès") i un o més signants del client
// (nom i cognoms, correu i qualitat). El servidor comprova que el PDF és vàlid
// i que no està xifrat ni protegit amb contrasenya.
import React, { useState } from 'react';
import { invoca } from '../portalApi';
import { pujaOriginal } from './original';
import { Avis, Boto, Entrada, Selector } from '../ui';

const MAX = 20 * 1024 * 1024;
const CORREU = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const buit = () => ({ nom: '', email: '', qualitat: '' });

const NouContracte = ({ client, onCreat, onCancel }) => {
  const [titol, setTitol] = useState('');
  const [idioma, setIdioma] = useState('ca');
  const [fitxer, setFitxer] = useState(null);
  const [signants, setSignants] = useState([buit()]);
  const [error, setError] = useState('');
  const [creant, setCreant] = useState(false);

  const canvia = (i, camp, valor) => setSignants(signants.map((s, k) => (k === i ? { ...s, [camp]: valor } : s)));
  const triaFitxer = (f) => {
    setError('');
    if (!f) { setFitxer(null); return; }
    if (f.type !== 'application/pdf') { setError('Només s\'admeten fitxers PDF.'); setFitxer(null); return; }
    if (f.size > MAX) { setError('El PDF no pot superar els 20 MB.'); setFitxer(null); return; }
    setFitxer(f);
  };

  const signantsOk = signants.every((s) => s.nom.trim() && CORREU.test(s.email.trim()) && s.qualitat.trim());
  const complet = titol.trim() && fitxer && signantsOk;

  const crea = async (e) => {
    e.preventDefault();
    setError('');
    setCreant(true);
    let id = null;
    try {
      const r = await invoca('portal-contracte-personal', {
        accio: 'crea', client_id: client.id, titol: titol.trim(), idioma,
        signants: signants.map((s) => ({ nom: s.nom.trim(), email: s.email.trim(), qualitat: s.qualitat.trim() })),
      });
      id = r.request_id;
      await pujaOriginal(id, fitxer);
      onCreat(id);
    } catch (err) {
      // Si el PDF no és vàlid, l'esborrany ja existeix: s'hi pot pujar un altre PDF des del detall
      setError(id ? `${err.message}. El contracte ha quedat en esborrany: obre'l per pujar-hi un altre PDF.` : err.message);
      if (id) setTimeout(() => onCreat(id), 2500);
    } finally {
      setCreant(false);
    }
  };

  return (
    <form onSubmit={crea} className="w-full border border-[#007A7B]/30 bg-[#007A7B]/5 rounded-lg p-4 space-y-3">
      <p className="text-xs font-bold text-[#007A7B]">Nou contracte per signar</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Entrada etiqueta="Títol del contracte" required maxLength={300} value={titol} className="md:col-span-2"
          onChange={(e) => setTitol(e.target.value)} />
        <Selector etiqueta="Idioma" value={idioma} onChange={(e) => setIdioma(e.target.value)}>
          <option value="ca">Català</option>
          <option value="ca_en">Català i anglès</option>
        </Selector>
      </div>
      <label className="block">
        <span className="block text-xs font-semibold text-[#4E6765] mb-1">Contracte en PDF (màxim 20 MB, sense contrasenya)</span>
        <input type="file" accept="application/pdf" onChange={(e) => triaFitxer(e.target.files?.[0] || null)}
          className="block w-full text-sm text-[#2B4644] file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#007A7B] file:text-white file:text-xs file:font-semibold" />
        <span className="block text-[11px] text-[#6B8280] mt-1">
          L'original es desa sense modificar. No es pot substituir: si cal canviar-lo, s'anul·la el contracte i se'n crea un altre.
        </span>
      </label>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#4E6765]">Signants del client</p>
        {signants.map((s, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <Entrada etiqueta={`${i + 1}. Nom i cognoms`} required value={s.nom} maxLength={200} className="md:col-span-3"
              onChange={(e) => canvia(i, 'nom', e.target.value)} />
            <Entrada etiqueta="Correu" type="email" required value={s.email} maxLength={200} className="md:col-span-3"
              onChange={(e) => canvia(i, 'email', e.target.value)} />
            <Entrada etiqueta="Qualitat" required value={s.qualitat} maxLength={300} className="md:col-span-5"
              placeholder="En nom propi · En nom i representació de [societat], com a administrador"
              onChange={(e) => canvia(i, 'qualitat', e.target.value)} />
            <div className="md:col-span-1">
              {signants.length > 1 && (
                <Boto variant="secundari" onClick={() => setSignants(signants.filter((_, k) => k !== i))}>Treure</Boto>
              )}
            </div>
          </div>
        ))}
        {signants.length < 20 && (
          <button type="button" className="text-xs text-[#007A7B] hover:underline" onClick={() => setSignants([...signants, buit()])}>
            + Afegir un altre signant
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Boto type="submit" disabled={creant || !complet}>{creant ? 'Creant i comprovant el PDF...' : 'Crear el contracte'}</Boto>
        <Boto variant="secundari" onClick={onCancel} disabled={creant}>Cancel·lar</Boto>
        <Avis>{error}</Avis>
      </div>
    </form>
  );
};

export default NouContracte;
