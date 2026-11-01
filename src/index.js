// build: 2026-05-08
import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
// Fonts allotjades a la mateixa web (llicència SIL Open Font License 1.1), sense
// cap petició a Google Fonts.
import '@fontsource/red-hat-display/400.css';
import '@fontsource/red-hat-display/500.css';
import '@fontsource/red-hat-display/600.css';
import '@fontsource/red-hat-text/400.css';
import '@fontsource/red-hat-text/500.css';
import '@fontsource/red-hat-text/600.css';
import '@fontsource/red-hat-text/700.css';
import './index.css';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import reportWebVitals from './reportWebVitals';

// Portal de signatura: /portal (personal d'ÀMBIT), /signar#<token> (autorització
// de càrrec), /kyc#<token> (KYC i protecció de dades), per al client, i
// /irpf#<token> (comunicació de dades al pagador), per al perceptor i el
// representant del pagador, i /contracte#<token>, per a cada signant d'un contracte.
// Els enllaços antics (/kyc/<token>…) també s'obren (src/portal/enllac.js).
// Àrea de client: /client (i /client/activar#<token>), amb una sessió pròpia.
// Es carreguen a part perquè no pesin a la web.
const PortalApp = lazy(() => import('./portal/PortalApp'));
const PaginaSignar = lazy(() => import('./portal/signar/PaginaSignar'));
const PaginaKyc = lazy(() => import('./portal/kyc/PaginaKyc'));
const PaginaIrpf = lazy(() => import('./portal/irpf/PaginaIrpf'));
const PaginaContracte = lazy(() => import('./portal/contracte/PaginaContracte'));
const ClientApp = lazy(() => import('./portal/client/ClientApp'));

const ruta = window.location.pathname;
const es = (cami) => ruta === cami || ruta.startsWith(`${cami}/`);
const contingut = es('/portal')
  ? <AuthProvider><PortalApp /></AuthProvider>
  : es('/signar')
    ? <PaginaSignar />
    : es('/kyc')
      ? <PaginaKyc />
      : es('/irpf')
        ? <PaginaIrpf />
        : es('/contracte')
          ? <PaginaContracte />
          : ruta === '/client' || ruta.startsWith('/client/')
            ? <ClientApp />
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

 
