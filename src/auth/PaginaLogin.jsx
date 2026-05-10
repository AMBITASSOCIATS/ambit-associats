// v2-solicituds-2026-05-08
// src/auth/PaginaLogin.jsx
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';

const PaginaLogin = ({ onLoginOk }) => {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'registre'
  const [email, setEmail] = useState('');
  const [contrasenya, setContrasenya] = useState('');
  const [nom, setNom] = useState('');
  const [error, setError] = useState('');
  const [missatge, setMissatge] = useState('');
  const [carregant, setCarregant] = useState(false);
  const [consentiment, setConsentiment] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setCarregant(true);
    try {
      await login(email, contrasenya);
      onLoginOk();
    } catch (err) {
      setError('Credencials incorrectes. Verifica el teu email i contrasenya.');
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
    try {
      const { error } = await supabase
        .from('solicituds')
        .insert({ nom, email, estat: 'pendent', creat_el: new Date().toISOString() });

      if (error) throw error;

      setMissatge('Sol·licitud enviada correctament. ÀMBIT Associats revisarà el teu accés i et contactarà per email amb les teves credencials (revisa Spam).');
      setMode('login');
      setEmail(''); setContrasenya(''); setNom('');
    } catch (err) {
      setError('Error: ' + (err?.message || err?.details || JSON.stringify(err) || 'Torna-ho a intentar.'));
    } finally {
      setCarregant(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#007A7B] to-[#009B9C] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Capçalera */}
        <div className="bg-gradient-to-r from-[#007A7B] to-[#009B9C] px-8 py-8 text-white text-center">
          <div className="text-2xl font-bold mb-1">ÀMBIT Associats</div>
          <div className="text-white/75 text-sm">Eina Fiscal IRPF Andorra</div>
        </div>

        <div className="px-8 py-8">
          {/* Selector mode */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); setMissatge(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-[#009B9C] text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              Iniciar sessió
            </button>
            <button
              onClick={() => { setMode('registre'); setError(''); setMissatge(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold transition ${
                mode === 'registre'
                  ? 'bg-[#009B9C] text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              Sol·licitar accés
            </button>
          </div>

          {/* Missatge d'èxit */}
          {missatge && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-sm text-green-700">
              ✅ {missatge}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}

          {/* Formulari login */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Correu electrònic
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="usuari@email.com"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40 focus:border-[#009B9C]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Contrasenya
                </label>
                <input
                  type="password"
                  value={contrasenya}
                  onChange={e => setContrasenya(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40 focus:border-[#009B9C]"
                />
              </div>
              <button
                type="submit"
                disabled={carregant}
                className="w-full bg-[#009B9C] hover:bg-[#007A7B] text-white font-bold
                           py-3 rounded-xl transition disabled:opacity-50 text-sm mt-2"
              >
                {carregant ? 'Iniciant sessió...' : 'Iniciar sessió →'}
              </button>
            </form>
          )}

          {/* Formulari sol·licitud d'accés */}
          {mode === 'registre' && (
            <form onSubmit={handleRegistre} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 mb-2">
                ℹ️ ÀMBIT Associats revisarà la teva sol·licitud i et crearà l'accés.
                Rebràs un email amb les teves credencials.
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Nom complet
                </label>
                <input
                  type="text"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  required
                  placeholder="El teu nom i cognoms"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40 focus:border-[#009B9C]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Correu electrònic
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="usuari@email.com"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40 focus:border-[#009B9C]"
                />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentiment}
                    onChange={e => setConsentiment(e.target.checked)}
                    className="mt-0.5 flex-shrink-0 accent-[#009B9C]"
                    required
                  />
                  <span>
                    He llegit i accepto el tractament de les meves dades personals per part de DEL SOTO – PALEARI & ASSOCIATS, S.L. (NRT L-720543-P), d'acord amb l'article 31 de la{' '}
                    <strong>Llei 29/2021, del 28 d'octubre, qualificada de protecció de dades personals del Principat d'Andorra</strong>.
                    Les dades es guardaran en servidors segurs de la UE (Supabase, certificat RGPD) i s'utilitzaran exclusivament per a la gestió fiscal. Podeu exercir els vostres drets a{' '}
                    <a href="mailto:info@ambit.ad" className="text-[#009B9C] underline">info@ambit.ad</a>.
                  </span>
                </label>
              </div>
              <button
                type="submit"
                disabled={carregant || !consentiment}
                className="w-full bg-[#009B9C] hover:bg-[#007A7B] text-white font-bold
                           py-3 rounded-xl transition disabled:opacity-50 text-sm mt-2"
              >
                {carregant ? 'Enviant sol·licitud...' : 'Sol·licitar accés →'}
              </button>
            </form>
          )}
        </div>

        {/* Peu */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center text-xs text-gray-400">
          ÀMBIT Associats · Eina d'ús exclusiu per a usuaris autoritzats
        </div>
      </div>
    </div>
  );
};

export default PaginaLogin;
