// v2-solicituds-2026-05-08
// src/auth/PaginaLogin.jsx
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { enviaFormulari } from '../formulariWeb';
import MarcAcces from './MarcAcces';
import CampContrasenya from './CampContrasenya';

const PaginaLogin = ({ onLoginOk, onBack }) => {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'registre'
  const [email, setEmail] = useState('');
  const [contrasenya, setContrasenya] = useState('');
  const [nom, setNom] = useState('');
  const [error, setError] = useState('');
  const [missatge, setMissatge] = useState('');
  const [carregant, setCarregant] = useState(false);
  const [consentiment, setConsentiment] = useState(false);
  const [eines, setEines] = useState([]);
  const toggleEina = (eina) => setEines(prev =>
    prev.includes(eina) ? prev.filter(e => e !== eina) : [...prev, eina]
  );

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setCarregant(true);
    try {
      await login(email, contrasenya);
      onLoginOk();
    } catch (err) {
      setError(err?.message || 'Credencials incorrectes. Verifica el teu email i contrasenya.');
    } finally {
      setCarregant(false);
    }
  };

  const handleRegistre = async (e) => {
    e.preventDefault();
    setError('');
    setCarregant(true);
    if (!nom?.trim() || !email?.trim()) {
      setError('Omple tots els camps obligatoris.');
      setCarregant(false);
      return;
    }
    if (eines.length === 0) {
      setError('Selecciona almenys una eina per sol·licitar accés.');
      setCarregant(false);
      return;
    }
    try {
      // Es desa a Supabase (web-formulari); ÀMBIT rep per Formspree un avís
      // sense cap dada i la revisa al Panell Maestro.
      await enviaFormulari({ tipus: 'solicitud', nom, email, eines });

      setMissatge('Sol·licitud enviada correctament. ÀMBIT Associats revisarà el teu accés i et contactarà per email amb les teves credencials (revisa Spam).');
      setMode('login');
      setEmail(''); setContrasenya(''); setNom(''); setEines([]);
    } catch (err) {
      setError(err?.message || 'No s\'ha pogut enviar la sol·licitud. Torna-ho a intentar.');
    } finally {
      setCarregant(false);
    }
  };

  return (
    <MarcAcces onBack={onBack}>
        {/* Capçalera */}
        <div className="mb-6">
          <h1 className="font-display font-medium text-[26px] leading-tight text-[#12302F]">Zona Professionals</h1>
          <p className="text-[15px] text-[#4E6765] mt-1">Eina Fiscal IRPF Andorra</p>
        </div>

        <div>
          {/* Selector mode */}
          <div className="flex rounded-full p-1 bg-[#EAF2F0] mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); setMissatge(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-full transition ${
                mode === 'login'
                  ? 'bg-white text-[#12302F] shadow-sm'
                  : 'text-[#4E6765] hover:text-[#12302F]'
              }`}
            >
              Iniciar sessió
            </button>
            <button
              onClick={() => { setMode('registre'); setError(''); setMissatge(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-full transition ${
                mode === 'registre'
                  ? 'bg-white text-[#12302F] shadow-sm'
                  : 'text-[#4E6765] hover:text-[#12302F]'
              }`}
            >
              Sol·licitar accés
            </button>
          </div>

          {/* Missatge d'èxit */}
          {missatge && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-sm text-green-700">
              {missatge}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Formulari login */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#2B4644] mb-1.5">
                  Correu electrònic
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="usuari@email.com"
                  className="w-full border border-[#C5D6D3] rounded-lg px-4 py-3 text-[15px]
                             focus:outline-none focus:ring-2 focus:ring-[#007A7B]/40 focus:border-[#007A7B]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#2B4644] mb-1.5">
                  Contrasenya
                </label>
                <CampContrasenya
                  value={contrasenya}
                  onChange={e => setContrasenya(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border border-[#C5D6D3] rounded-lg px-4 py-3 text-[15px]
                             focus:outline-none focus:ring-2 focus:ring-[#007A7B]/40 focus:border-[#007A7B]"
                />
              </div>
              <button
                type="submit"
                disabled={carregant}
                className="w-full bg-[#007A7B] hover:bg-[#00676A] text-white font-semibold
                           py-3 rounded-full transition disabled:opacity-50 text-sm mt-2"
              >
                {carregant ? 'Iniciant sessió...' : 'Iniciar sessió'}
              </button>
            </form>
          )}

          {/* Formulari sol·licitud d'accés */}
          {mode === 'registre' && (
            <form onSubmit={handleRegistre} className="space-y-4">
              <div className="bg-[#EEF6F6] border border-[#D6E4E2] rounded-lg p-3 text-[13px] text-[#00676A] mb-2">
                ÀMBIT Associats revisarà la teva sol·licitud i et crearà l'accés.
                Rebràs un email amb les teves credencials.
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#2B4644] mb-1.5">
                  Nom complet
                </label>
                <input
                  type="text"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  required
                  placeholder="El teu nom i cognoms"
                  className="w-full border border-[#C5D6D3] rounded-lg px-4 py-3 text-[15px]
                             focus:outline-none focus:ring-2 focus:ring-[#007A7B]/40 focus:border-[#007A7B]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#2B4644] mb-1.5">
                  Correu electrònic
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="usuari@email.com"
                  className="w-full border border-[#C5D6D3] rounded-lg px-4 py-3 text-[15px]
                             focus:outline-none focus:ring-2 focus:ring-[#007A7B]/40 focus:border-[#007A7B]"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[13px] font-semibold text-[#2B4644] mb-1">
                  Eines sol·licitades <span className="text-red-500">*</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-[#F4F8F7] transition">
                  <input
                    type="checkbox"
                    checked={eines.includes('irpf')}
                    onChange={() => toggleEina('irpf')}
                    className="accent-[#007A7B] w-4 h-4"
                  />
                  <span className="text-sm text-[#2B4644]">Eina Fiscal IRPF Andorra</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-[#F4F8F7] transition">
                  <input
                    type="checkbox"
                    checked={eines.includes('bretxa')}
                    onChange={() => toggleEina('bretxa')}
                    className="accent-[#007A7B] w-4 h-4"
                  />
                  <span className="text-sm text-[#2B4644]">Eina Bretxa de Gènere</span>
                </label>
              </div>

              <div className="bg-[#F4F8F7] border border-[#D6E4E2] rounded-lg p-3 text-xs text-[#4E6765]">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentiment}
                    onChange={e => setConsentiment(e.target.checked)}
                    className="mt-0.5 flex-shrink-0 accent-[#007A7B]"
                    required
                  />
                  <span>
                    He llegit i accepto el tractament de les meves dades personals per part de DEL SOTO – PALEARI & ASSOCIATS, S.L. (NRT L-720543-P), d'acord amb l'article 31 de la{' '}
                    <strong>Llei 29/2021, del 28 d'octubre, qualificada de protecció de dades personals del Principat d'Andorra</strong>.
                    Les dades es guardaran en servidors segurs de la UE (Supabase, certificat RGPD) i s'utilitzaran exclusivament per a la gestió fiscal. Podeu exercir els vostres drets a{' '}
                    <a href="mailto:info@ambit.ad" className="text-[#007A7B] underline">info@ambit.ad</a>.
                  </span>
                </label>
              </div>
              <button
                type="submit"
                disabled={carregant || !consentiment}
                className="w-full bg-[#007A7B] hover:bg-[#00676A] text-white font-semibold
                           py-3 rounded-full transition disabled:opacity-50 text-sm mt-2"
              >
                {carregant ? 'Enviant sol·licitud...' : 'Sol·licitar accés'}
              </button>
            </form>
          )}
        </div>

        {/* Peu */}
        <p className="mt-6 pt-4 border-t border-[#E4EEEC] text-center text-[13px] text-[#4E6765]">
          Eina d'ús exclusiu per a usuaris autoritzats
        </p>
    </MarcAcces>
  );
};

export default PaginaLogin;
