// src/portal/enllac.js
// Codi dels enllaços de signatura (/signar, /kyc, /irpf, /contracte). Va
// després de «#» (/kyc#<codi>): el navegador no l'envia mai al servidor web.
// Un enllaç antic (/kyc/<codi>) es passa al format nou dins del mateix
// navegador (history.replaceState), sense cap petició.
export const codiEnllac = (cami) => {
  const antic = window.location.pathname.match(new RegExp(`^/${cami}/([^/]+)/*$`));
  if (antic) {
    window.history.replaceState(null, '', `/${cami}#${antic[1]}`);
    return antic[1];
  }
  return window.location.hash.replace(/^#/, '');
};
