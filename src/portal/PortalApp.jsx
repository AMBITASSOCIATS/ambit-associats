// src/portal/PortalApp.jsx
// Portal de signatura · panell del personal d'ÀMBIT (/portal).
// Només hi entra el personal actiu de portal.staff_profiles; la resta veu
// "Accés no autoritzat" encara que tingui compte a la web. L'accés real el
// controla la base (RLS); aquí només es tria què es mostra.
import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import MarcAcces from '../auth/MarcAcces';
import CapcaleraEina, { botoCapcalera } from '../auth/CapcaleraEina';
import { portal } from './portalApi';
import Solicituds from './Solicituds';
import Clients from './Clients';
import Remesa from './Remesa';
import Personal from './Personal';
import Registre from './Registre';
import Conservacio from './Conservacio';
import RevisionsKyc from './RevisionsKyc';
import LlistesPaisos from './LlistesPaisos';
import ParametresIrpf from './ParametresIrpf';
import DocumentsRebuts from './DocumentsRebuts';

const PESTANYES = [
  { id: 'solicituds', nom: 'Sol·licituds' },
  { id: 'clients', nom: 'Clients' },
  { id: 'rebuts', nom: 'Documents rebuts' },
  { id: 'remesa', nom: 'Remesa' },
  { id: 'parametres_irpf', nom: 'Paràmetres IRPF' },
  { id: 'personal', nom: 'Personal', ocic: true },
  { id: 'registre', nom: 'Registre', ocic: true },
  { id: 'revisions', nom: 'Revisions KYC', ocic: true },
  { id: 'llistes', nom: 'Llistes de països', ocic: true },
  { id: 'conservacio', nom: 'Conservació', ocic: true },
];

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [contrasenya, setContrasenya] = useState('');
  const [error, setError] = useState('');
  const [carregant, setCarregant] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError('');
    setCarregant(true);
    try {
      await login(email, contrasenya);
    } catch {
      setError('Credencials incorrectes.');
    } finally {
      setCarregant(false);
    }
  };

  return (
    <MarcAcces>
      <h1 className="font-display font-medium text-[26px] leading-tight text-[#12302F]">Portal de signatura</h1>
      <p className="text-[15px] text-[#4E6765] mt-1 mb-6">Accés per al personal d'ÀMBIT Associats</p>
      <form onSubmit={entrar} className="space-y-4">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Correu electrònic" autoComplete="username"
          className="w-full border border-[#C5D6D3] rounded-lg px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#4DB6B7]/50 focus:border-[#007A7B]" />
        <input type="password" required value={contrasenya} onChange={(e) => setContrasenya(e.target.value)}
          placeholder="Contrasenya" autoComplete="current-password"
          className="w-full border border-[#C5D6D3] rounded-lg px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#4DB6B7]/50 focus:border-[#007A7B]" />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={carregant}
          className="w-full bg-[#007A7B] hover:bg-[#00676A] text-white font-semibold py-3 rounded-full transition disabled:opacity-50 text-[15px]">
          {carregant ? 'Entrant...' : 'Entrar'}
        </button>
      </form>
    </MarcAcces>
  );
};

const PortalApp = () => {
  const { user, carregant, logout } = useAuth();
  const [rol, setRol] = useState(undefined); // undefined = comprovant, null = no és personal
  const [pestanya, setPestanya] = useState('solicituds');
  const [solicitudOberta, setSolicitudOberta] = useState(null);

  useEffect(() => {
    document.title = 'Portal de signatura · ÀMBIT Associats';
  }, []);

  useEffect(() => {
    if (!user) { setRol(undefined); return; }
    let viu = true;
    portal.rpc('el_meu_rol').then(({ data, error }) => {
      if (viu) setRol(error ? null : data);
    });
    return () => { viu = false; };
  }, [user]);

  if (carregant || (user && rol === undefined)) {
    return <div className="min-h-screen flex items-center justify-center text-[#6B8280] text-sm">Carregant...</div>;
  }
  if (!user) return <Login />;
  if (!rol) {
    return (
      <MarcAcces>
        <h2 className="font-display font-medium text-[24px] leading-tight text-[#12302F] mb-3">Accés no autoritzat</h2>
        <p className="text-[15px] leading-relaxed text-[#2B4644] mb-6">
          Aquest portal és només per al personal d'ÀMBIT Associats.
        </p>
        <button onClick={logout} className="text-sm font-semibold text-[#007A7B] hover:underline underline-offset-4">Tancar sessió</button>
      </MarcAcces>
    );
  }

  const obreSolicitud = (id) => { setSolicitudOberta(id); setPestanya('solicituds'); };

  return (
    <div className="min-h-screen bg-[#F4F8F7] text-[#12302F]">
      <CapcaleraEina
        titol="Portal de signatura"
        subtitol={`Autoritzacions de càrrec · KYC i protecció de dades · Comunicacions IRPF · Contractes · Àrea de client · ${user.email} · ${rol === 'ocic' ? 'OCIC' : 'Gestor'}`}
        accions={<button onClick={logout} className={botoCapcalera}>Tancar sessió</button>}
      />

      <nav className="bg-white border-b border-[#D6E4E2]">
        <div className="max-w-6xl mx-auto px-5 md:px-10 flex gap-1 overflow-x-auto">
          {PESTANYES.filter((p) => !p.ocic || rol === 'ocic').map((p) => (
            <button key={p.id}
              onClick={() => { setPestanya(p.id); if (p.id !== 'solicituds') setSolicitudOberta(null); }}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                pestanya === p.id ? 'border-[#007A7B] text-[#007A7B]' : 'border-transparent text-[#4E6765] hover:text-[#12302F]'}`}>
              {p.nom}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-5 md:px-10 py-8">
        {pestanya === 'solicituds' && (
          <Solicituds oberta={solicitudOberta} onObre={setSolicitudOberta} rol={rol} />
        )}
        {pestanya === 'clients' && <Clients onObreSolicitud={obreSolicitud} rol={rol} />}
        {pestanya === 'rebuts' && <DocumentsRebuts rol={rol} />}
        {pestanya === 'remesa' && <Remesa onObreSolicitud={obreSolicitud} />}
        {pestanya === 'parametres_irpf' && <ParametresIrpf />}
        {pestanya === 'personal' && rol === 'ocic' && <Personal usuariActual={user.id} />}
        {pestanya === 'registre' && rol === 'ocic' && <Registre />}
        {pestanya === 'revisions' && rol === 'ocic' && <RevisionsKyc onObreSolicitud={obreSolicitud} />}
        {pestanya === 'llistes' && rol === 'ocic' && <LlistesPaisos />}
        {pestanya === 'conservacio' && rol === 'ocic' && <Conservacio />}
      </main>
    </div>
  );
};

export default PortalApp;
