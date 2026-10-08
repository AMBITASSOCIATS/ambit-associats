// build: 2026-05-08
import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import reportWebVitals from './reportWebVitals';

// Portal de signatura: /portal (personal d'ÀMBIT) i /signar/<token> (client).
// Es carreguen a part perquè no pesin a la web.
const PortalApp = lazy(() => import('./portal/PortalApp'));
const PaginaSignar = lazy(() => import('./portal/signar/PaginaSignar'));

const ruta = window.location.pathname;
const contingut = ruta === '/portal' || ruta.startsWith('/portal/')
  ? <AuthProvider><PortalApp /></AuthProvider>
  : ruta.startsWith('/signar/')
    ? <PaginaSignar />
    : <AuthProvider><App /></AuthProvider>;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Suspense fallback={<div className="min-h-screen" />}>
      {contingut}
    </Suspense>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

 
