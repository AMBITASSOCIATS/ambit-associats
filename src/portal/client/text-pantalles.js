// src/portal/client/text-pantalles.js
// Textos de les pantalles de l'àrea de client que no són al fitxer de textos
// (docs/textos-area-client.md): títols, etiquetes, botons i missatges.
// Català amb l'anglès a sota. Els textos de les condicions, dels correus i de
// l'avís són a text-area-client.json (generat del fitxer).

const P = {
  titol: { ca: 'Àrea de client', en: 'Client area' },

  // Accés
  entrar: { ca: 'Entrar', en: 'Log in' },
  correu: { ca: 'Correu electrònic', en: 'Email address' },
  contrasenya: { ca: 'Contrasenya', en: 'Password' },
  mostraContrasenya: { ca: 'Mostrar la contrasenya', en: 'Show password' },
  amagaContrasenya: { ca: 'Amagar la contrasenya', en: 'Hide password' },
  codi: { ca: 'Codi de l\'aplicació d\'autenticació', en: 'Authenticator app code' },
  codiAjuda: { ca: 'Introduïu el codi de 6 xifres que mostra la vostra aplicació d\'autenticació.', en: 'Enter the 6-digit code shown in your authenticator app.' },
  verificar: { ca: 'Verificar', en: 'Verify' },
  tornar: { ca: 'Tornar', en: 'Back' },
  sortir: { ca: 'Tancar la sessió', en: 'Log out' },
  sessioCaducada: { ca: 'La sessió s\'ha tancat per inactivitat. Torneu a entrar.', en: 'Your session was closed due to inactivity. Please log in again.' },
  noAcces: {
    ca: 'Si no teniu accés o heu perdut el segon factor, poseu-vos en contacte amb nosaltres a info@ambit.ad o al +376 655 382.',
    en: 'If you do not have access or have lost your second factor, please contact us at info@ambit.ad or on +376 655 382.',
  },

  // Activació
  activarTitol: { ca: 'Activació de l\'accés', en: 'Access activation' },
  restablirTitol: { ca: 'Restabliment de l\'accés', en: 'Access reset' },
  pas1: { ca: 'Pas 1 de 2 · Contrasenya i condicions d\'ús', en: 'Step 1 of 2 · Password and terms of use' },
  pas2: { ca: 'Pas 2 de 2 · Segon factor d\'autenticació', en: 'Step 2 of 2 · Second authentication factor' },
  novaContrasenya: { ca: 'Contrasenya nova', en: 'New password' },
  repeteix: { ca: 'Repetiu la contrasenya', en: 'Repeat the password' },
  contrasenyaAjuda: { ca: 'Mínim 12 caràcters.', en: 'At least 12 characters.' },
  noCoincideixen: { ca: 'Les contrasenyes no coincideixen.', en: 'The passwords do not match.' },
  curta: { ca: 'La contrasenya ha de tenir almenys 12 caràcters.', en: 'The password must be at least 12 characters long.' },
  continuar: { ca: 'Continuar', en: 'Continue' },
  totpInstruccions: {
    ca: 'Escanegeu aquest codi QR amb una aplicació d\'autenticació (per exemple, Google Authenticator o Microsoft Authenticator) i introduïu el codi de 6 xifres que us mostri.',
    en: 'Scan this QR code with an authenticator app (for example, Google Authenticator or Microsoft Authenticator) and enter the 6-digit code it shows.',
  },
  totpClau: { ca: 'Si no podeu escanejar el codi, introduïu aquesta clau a l\'aplicació:', en: 'If you cannot scan the code, enter this key in the app:' },
  activat: { ca: 'L\'accés ja està activat.', en: 'Your access is now active.' },
  anarArea: { ca: 'Anar a l\'àrea de client', en: 'Go to the client area' },

  // Condicions
  acceptar: { ca: 'Acceptar', en: 'Accept' },
  condicionsNoves: { ca: 'Les condicions d\'ús han canviat. Per continuar, cal que les llegiu i les accepteu.', en: 'The terms of use have changed. To continue, please read and accept them.' },
  condicionsEnllac: { ca: 'Condicions d\'ús', en: 'Terms of use' },
  pdpEnllac: { ca: 'Protecció de dades', en: 'Data protection' },
  pdpDocuments: { ca: 'Informació de protecció de dades signada', en: 'Signed data protection information' },
  pdpCap: { ca: 'Encara no hi ha cap document de protecció de dades signat per a aquest client.', en: 'There is no signed data protection document for this client yet.' },
  tancar: { ca: 'Tancar', en: 'Close' },

  // Inici
  client: { ca: 'Client', en: 'Client' },
  seccions: {
    enviar: { ca: 'Enviar documents', en: 'Send documents' },
    enviaments: { ca: 'Els meus enviaments', en: 'My submissions' },
    documents: { ca: 'Els meus documents', en: 'My documents' },
  },

  // Enviar documents
  destinatari: { ca: 'Destinatari', en: 'Recipient' },
  noDisponible: { ca: 'No disponible temporalment', en: 'Temporarily unavailable' },
  assumpte: { ca: 'Assumpte', en: 'Subject' },
  comentari: { ca: 'Comentari (opcional)', en: 'Comment (optional)' },
  fitxers: { ca: 'Fitxers', en: 'Files' },
  fitxersAjuda: {
    ca: 'PDF, JPG, PNG, XLSX, XLS, DOCX, DOC o CSV. Màxim 20 MB per fitxer i 100 MB per enviament.',
    en: 'PDF, JPG, PNG, XLSX, XLS, DOCX, DOC or CSV. Maximum 20 MB per file and 100 MB per submission.',
  },
  afegirFitxers: { ca: 'Afegir fitxers', en: 'Add files' },
  treure: { ca: 'Treure', en: 'Remove' },
  enviar: { ca: 'Enviar', en: 'Send' },
  enviant: { ca: 'Enviant…', en: 'Sending…' },
  enviat: { ca: 'Els documents s\'han enviat correctament.', en: 'The documents have been sent successfully.' },
  tipusNoAdmes: { ca: 'Tipus de fitxer no admès', en: 'File type not accepted' },
  massaGran: { ca: 'El fitxer supera els 20 MB', en: 'The file exceeds 20 MB' },
  massaTotal: { ca: 'L\'enviament supera els 100 MB.', en: 'The submission exceeds 100 MB.' },
  massaFitxers: { ca: 'Màxim 20 fitxers per enviament.', en: 'Maximum 20 files per submission.' },
  calDestinatari: { ca: 'Trieu un destinatari.', en: 'Please choose a recipient.' },
  calAssumpte: { ca: 'L\'assumpte és obligatori.', en: 'The subject is required.' },
  calFitxers: { ca: 'Afegiu almenys un fitxer.', en: 'Please add at least one file.' },

  // Els meus enviaments
  data: { ca: 'Data', en: 'Date' },
  nFitxers: { ca: 'Fitxers', en: 'Files' },
  estat: { ca: 'Estat', en: 'Status' },
  estatEnviat: { ca: 'Enviat', en: 'Sent' },
  estatRebut: { ca: 'Rebut per ÀMBIT', en: 'Received by ÀMBIT' },
  capEnviament: { ca: 'Encara no heu fet cap enviament.', en: 'You have not sent anything yet.' },

  // Els meus documents
  descarregar: { ca: 'Descarregar', en: 'Download' },
  capDocument: { ca: 'No hi ha cap document disponible.', en: 'There are no documents available.' },
  tipusDocument: {
    contracte: { ca: 'Contracte signat', en: 'Signed contract' },
    kyc_pf: { ca: 'Formulari d\'identificació (KYC) · còpia per al client', en: 'Identification form (KYC) · copy for the client' },
    kyc_pj: { ca: 'Formulari d\'identificació (KYC) · còpia per al client', en: 'Identification form (KYC) · copy for the client' },
    pdp: { ca: 'Informació de protecció de dades signada', en: 'Signed data protection information' },
    autoritzacio_carrec: { ca: 'Autorització de càrrec en compte signada', en: 'Signed bank debit authorisation' },
  },

  carregant: { ca: 'Carregant…', en: 'Loading…' },
};

export default P;
