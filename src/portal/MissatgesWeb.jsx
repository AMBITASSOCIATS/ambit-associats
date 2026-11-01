// src/portal/MissatgesWeb.jsx
// Missatges del formulari de contacte de la web (public.missatges_contacte).
// Els veu i els esborra el personal actiu del portal (RLS). Formspree només
// avisa que n'hi ha un de nou, amb l'enllaç /portal?pestanya=missatges.
// La purga diària els esborra als 12 mesos.
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { dataHora } from './portalApi';
import { Avis, Boto, Targeta } from './ui';

const IDIOMES = { ca: 'català', es: 'castellà', en: 'anglès', fr: 'francès' };

const MissatgesWeb = () => {
  const [missatges, setMissatges] = useState(null);
  const [error, setError] = useState('');

  const carrega = useCallback(async () => {
    const { data, error: e } = await supabase.from('missatges_contacte')
      .select('id, nom, email, telefon, missatge, idioma, creat_el')
      .order('creat_el', { ascending: false });
    if (e) setError(e.message);
    setMissatges(data || []);
  }, []);
  useEffect(() => { carrega(); }, [carrega]);

  const esborra = async (m) => {
    if (!window.confirm(`Vols esborrar el missatge de ${m.nom}? No es podrà recuperar.`)) return;
    setError('');
    const { error: e } = await supabase.from('missatges_contacte').delete().eq('id', m.id);
    if (e) setError(e.message);
    await carrega();
  };

  return (
    <Targeta titol="Missatges del formulari de contacte">
      <p className="text-xs text-[#6B8280] mb-3">
        Els missatges es desen només aquí, no s'envien per correu. S'esborren sols als 12 mesos;
        un cop atès, el podeu esborrar abans.
      </p>
      <Avis>{error}</Avis>
      {missatges === null ? (
        <p className="text-sm text-[#6B8280] py-6 text-center">Carregant...</p>
      ) : missatges.length === 0 ? (
        <p className="text-sm text-[#6B8280] py-6 text-center">Cap missatge</p>
      ) : (
        <div className="divide-y divide-[#E4EEEC]">
          {missatges.map((m) => (
            <div key={m.id} className="py-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <p className="text-sm font-semibold text-[#12302F]">{m.nom}</p>
                  <p className="text-xs text-[#6B8280]">
                    <a href={`mailto:${m.email}`} className="text-[#007A7B] underline underline-offset-2">{m.email}</a>
                    {m.telefon && <> · <a href={`tel:${m.telefon.replace(/[^\d+]/g, '')}`} className="text-[#007A7B] underline underline-offset-2">{m.telefon}</a></>}
                    {' · '}{dataHora(m.creat_el)}
                    {m.idioma && ` · ${IDIOMES[m.idioma] || m.idioma}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Boto onClick={() => window.location.assign(`mailto:${m.email}?subject=${encodeURIComponent('Re: el vostre missatge a ÀMBIT Associats')}`)}>
                    Respondre
                  </Boto>
                  <Boto variant="perill" onClick={() => esborra(m)}>Esborrar</Boto>
                </div>
              </div>
              <p className="text-sm text-[#2B4644] whitespace-pre-line [overflow-wrap:anywhere]">{m.missatge}</p>
            </div>
          ))}
        </div>
      )}
    </Targeta>
  );
};

export default MissatgesWeb;
