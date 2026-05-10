// src/auth/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregant, setCarregant] = useState(true);

  // Retorna les dades del perfil (no crida setPerfil directament)
  const fetchPerfil = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) return data;
      // Esperar 2 segons i tornar a intentar (pot ser un usuari nou)
      await new Promise(r => setTimeout(r, 2000));
      const { data: data2, error: error2 } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error2 && data2) return data2;
      console.warn('Perfil no trobat definitiu:', error2?.message);
      return null;
    } catch (e) {
      console.warn('Error carregant perfil:', e);
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
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Fase post-inicial: gestionar logout/login manuals
      if (settled) {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setPerfil(null);
        } else if (session?.user) {
          const profileData = await fetchPerfil(session.user.id);
          if (mounted) {
            setUser(session.user);
            setPerfil(profileData);
          }
        }
        return;
      }

      // Fase inicial (settled = false): resolve amb timeout actiu
      if (event === 'SIGNED_OUT') {
        settle(null, null);
        return;
      }

      if (session?.user) {
        const profileData = await fetchPerfil(session.user.id);
        if (!mounted) return;
        settle(session.user, profileData);
      } else {
        settle(null, null);
      }
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
    await supabase.auth.signOut();
    setUser(null);
    setPerfil(null);
  };

  const esMaestro = perfil?.rol === 'maestro';
  const esActiu = carregant || perfil?.estat === 'actiu';

  return (
    <AuthContext.Provider value={{
      user, perfil, carregant,
      login, logout,
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
