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
      console.warn('Perfil no trobat per userId:', userId, error?.message);
      return null;
    } catch (e) {
      console.warn('Error carregant perfil:', e);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Única font de veritat: onAuthStateChange (inclou INITIAL_SESSION en càrrega)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setPerfil(null);
        setCarregant(false);
        return;
      }

      if (session?.user) {
        const profileData = await fetchPerfil(session.user.id);
        if (!mounted) return;
        // Actualitzar user + perfil + carregant en el mateix tick per evitar flashes
        setUser(session.user);
        setPerfil(profileData);
        setCarregant(false);
      } else {
        setUser(null);
        setPerfil(null);
        setCarregant(false);
      }
    });

    return () => {
      mounted = false;
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
