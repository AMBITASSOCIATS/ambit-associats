// src/auth/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregant, setCarregant] = useState(true);

  const carregarPerfil = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setPerfil(data);
      } else {
        console.warn('Perfil no trobat o error RLS:', error?.message);
        setPerfil(null);
      }
    } catch (e) {
      console.warn('Error carregant perfil:', e);
      setPerfil(null);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCarregant(false);
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await carregarPerfil(session.user.id);
      }
      clearTimeout(timeout);
      setCarregant(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await carregarPerfil(session.user.id);
      } else {
        setPerfil(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
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

  const registrar = async (email, contrasenya, nom) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: contrasenya,
      options: { data: { nom } },
    });
    if (error) throw error;

    // Crear perfil pendent
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        nom,
        rol: 'individual',
        estat: 'pendent',
      });

      // Notificar al Maestro per email
      try {
        await fetch('https://formspree.io/f/mdkdrkze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Sistema ÀMBIT Eina Fiscal',
            email: 'sistema@ambit.ad',
            message: `NOU USUARI PENDENT D'APROVACIÓ\n\nNom: ${nom}\nEmail: ${email}\n\nAccedeix al panel d'administració per aprovar o rebutjar l'accés:\nhttps://www.ambit.ad`,
          }),
        });
      } catch(e) {
        // No bloquejar el registre si falla la notificació
        console.warn('No s\'ha pogut enviar la notificació al Maestro:', e);
      }
    }
    return data;
  };

  const logout = () => {
    supabase.auth.signOut(); // fire and forget — no await per evitar bloqueig
    setUser(null);
    setPerfil(null);
  };

  const esMaestro = perfil?.rol === 'maestro';
  const esActiu = carregant || perfil?.estat === 'actiu';

  return (
    <AuthContext.Provider value={{
      user, perfil, carregant,
      login, registrar, logout,
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
