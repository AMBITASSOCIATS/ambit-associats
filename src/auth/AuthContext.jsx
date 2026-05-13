// src/auth/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregant, setCarregant] = useState(true);

  // Retorna les dades del perfil usant fetch() directe amb AbortSignal.
  // accessToken es passa des de fora per evitar cridar getSession() dins d'un
  // callback onAuthStateChange (causaria deadlock a supabase-js v2).
  const fetchPerfil = async (userId, accessToken = null) => {
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      console.log('fetchPerfil START:', userId);

      const token = accessToken || supabaseKey;
      const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*&limit=1`;
      const response = await fetch(url, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      console.log('fetchPerfil HTTP status:', response.status);
      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        console.warn('fetchPerfil HTTP error:', response.status, txt.substring(0, 200));
        return null;
      }
      const data = await response.json();
      console.log('fetchPerfil RESULT:', { count: data?.length, ok: !!data?.[0] });
      return data?.[0] || null;
    } catch (e) {
      console.warn('fetchPerfil ERROR:', e.message);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    let settled = false; // true quan l'estat inicial ja s'ha resolt

    // settle() és idempotent: només resol una vegada
    const settle = (userData, perfilData) => {
      if (!mounted || settled) return;
      settled = true;
      clearTimeout(timeout);
      setUser(userData);
      setPerfil(perfilData);
      setCarregant(false);
    };

    // Timeout de seguretat: si fetchPerfil es penja o onAuthStateChange no dispara
    // en 5s, netejem l'estat local i mostrem el login.
    // NO fem signOut() aquí — podria bloquejar un signIn posterior.
    const timeout = setTimeout(() => {
      if (!settled && mounted) {
        console.warn('Auth timeout: netejant estat local i mostrant login');
        settle(null, null);
      }
    }, 8000);

    // IMPORTANT: el callback NO és async perquè supabase-js v2 fa await de tots
    // els subscribers abans de retornar signInWithPassword. Si el callback és async
    // i fetchPerfil penja, signInWithPassword mai retorna (botó penjat).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      // Fase post-inicial: gestionar logout/login manuals
      if (settled) {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setPerfil(null);
        } else if (event === 'SIGNED_IN' && session?.user) {
          const userData = session.user;
          setUser(userData);
          // fetchPerfil en segon pla — passem access_token per evitar deadlock
          fetchPerfil(userData.id, session.access_token).then(profileData => {
            if (mounted) setPerfil(profileData);
          }).catch(() => {});
        }
        return;
      }

      // Fase inicial (settled = false): resolve amb timeout actiu
      if (event === 'SIGNED_OUT' || !session?.user) {
        settle(null, null);
        return;
      }

      // Té sessió: settle immediatament i carrega perfil en segon pla
      const userData = session.user;
      fetchPerfil(userData.id, session.access_token).then(profileData => {
        if (mounted) settle(userData, profileData);
      }).catch(() => {
        if (mounted) settle(userData, null);
      });
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, contrasenya) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: contrasenya,
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Error al signOut:', e);
    } finally {
      setUser(null);
      setPerfil(null);
    }
  };

  // Refresca el perfil des de Supabase (útil després de desar canvis al perfil)
  const refreshPerfil = async () => {
    if (!user?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const data = await fetchPerfil(user.id, session?.access_token);
    if (data) setPerfil(data);
  };

  const esMaestro = perfil?.rol === 'maestro';
  const esActiu = carregant || perfil?.estat === 'actiu';

  return (
    <AuthContext.Provider value={{
      user, perfil, carregant,
      login, logout, refreshPerfil,
      esMaestro, esActiu,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
