import React, { useState } from "react";
import { motion } from "framer-motion";

// Logo – más grande
const Logo = () => (
  <img
    src="/ÀMBIT Associats.png"
    alt="ÀMBIT Associats"
    className="h-36 md:h-48 mx-auto mb-2"
  />
);

// Idiomas
const languages = [
  { code: "ca", name: "Català" },
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
];

// Traducciones
const translations = {
  ca: {
    tagline: "Assegurant el teu èxit empresarial",
    services: "Serveis que oferim",
    about: "Qui som",
    contact: "Contacta'ns",
    footer: "Tots els drets reservats © DEL SOTO-PALEARI & Associats, SL",
    contactInfo: "El millor mitjà de contacte és per correu electrònic a info@ambit.ad o bé al mòbil +376 650 042.",
    whatsapp: "Parla amb nosaltres per WhatsApp",
    legal: "Nota legal",
    legalTabs: {
      aviso: "Avís legal",
      privacidad: "Política de privacitat",
      cookies: "Política de cookies",
    },
    back: "Torna als serveis",
    form: {
      name: "Nom",
      email: "Correu electrònic",
      phone: "Telèfon",
      message: "Missatge",
      send: "Enviar missatge",
      success: "Missatge enviat. T'hi respondrem aviat.",
    },
  },
  es: {
    tagline: "Garantizando tu éxito empresarial",
    services: "Servicios que ofrecemos",
    about: "¿Quiénes somos?",
    contact: "Contáctanos",
    footer: "Todos los derechos reservados © DEL SOTO-PALEARI & Associats, SL",
    contactInfo: "La mejor forma de contactarnos es por correo electrónico a info@ambit.ad o por móvil +376 650 042.",
    whatsapp: "Habla con nosotros por WhatsApp",
    legal: "Nota legal",
    legalTabs: {
      aviso: "Aviso legal",
      privacidad: "Política de privacidad",
      cookies: "Política de cookies",
    },
    back: "Volver a servicios",
    form: {
      name: "Nombre",
      email: "Correo electrónico",
      phone: "Teléfono",
      message: "Mensaje",
      send: "Enviar mensaje",
      success: "Mensaje enviado. Te responderemos pronto.",
    },
  },
  en: {
    tagline: "Ensuring your business success",
    services: "Services we offer",
    about: "About Us",
    contact: "Contact Us",
    footer: "All rights reserved © DEL SOTO-PALEARI & Associats, SL",
    contactInfo: "The best way to reach us is by email at info@ambit.ad or by mobile +376 650 042.",
    whatsapp: "Chat with us on WhatsApp",
    legal: "Legal notice",
    legalTabs: {
      aviso: "Legal notice",
      privacidad: "Privacy policy",
      cookies: "Cookie policy",
    },
    back: "Back to services",
    form: {
      name: "Name",
      email: "Email",
      phone: "Phone",
      message: "Message",
      send: "Send message",
      success: "Message sent. We'll get back to you soon!",
    },
  },
  fr: {
    tagline: "Assurant votre succès entrepreneurial",
    services: "Services proposés",
    about: "Qui sommes-nous ?",
    contact: "Contactez-nous",
    footer: "Tous droits réservés © DEL SOTO-PALEARI & Associats, SL",
    contactInfo: "Le meilleur moyen de nous contacter est par email à info@ambit.ad ou par mobile +376 650 042.",
    whatsapp: "Parlez-nous sur WhatsApp",
    legal: "Note légale",
    legalTabs: {
      aviso: "Avis légal",
      privacidad: "Politique de confidentialité",
      cookies: "Politique de cookies",
    },
    back: "Retour aux services",
    form: {
      name: "Nom",
      email: "Email",
      phone: "Téléphone",
      message: "Message",
      send: "Envoyer le message",
      success: "Message envoyé. Nous vous répondrons bientôt !",
    },
  },
};

// Textos legals actualitzats amb Llei 29/2021 i Llei 35/2014
const legalTexts = {
  ca: {
    aviso: `
      <h3>Avís legal</h3>
      <p>Aquest lloc web és propietat de DEL SOTO-PALEARI & Associats, SL, amb domicili a Av. Fiter i Rossell, núm. 78, 2n B, Edifici Carlemany, AD700 Andorra i NRT L-720543-P. L'ús d'aquest lloc web implica l'acceptació de les condicions generals d'ús. Tots els drets reservats.</p>
    `,
    privacidad: `
      <h3>Política de Privacitat</h3>
      <p><em>(Actualitzada segons la Llei qualificada 29/2021, del 28 d’octubre, de protecció de dades personals del Principat d’Andorra)</em></p>
      <p>En compliment de la Llei qualificada 29/2021, del 28 d’octubre, de protecció de dades personals i de la Llei 35/2014, del 27 de novembre, de serveis de confiança electrònica, DEL SOTO-PALEARI & Associats, S.L. informa als usuaris del lloc web <strong>www.ambit.ad</strong> sobre el tractament de les seves dades de caràcter personal.</p>

      <h4>1. Responsable del tractament</h4>
      <p><strong>Identitat:</strong> DEL SOTO-PALEARI & Associats, S.L.<br>
      <strong>Domicili:</strong> Avinguda Fiter i Rossell, número 78, Edifici Carlemany, 2n B, AD500 Andorra la Vella, Principat d’Andorra<br>
      <strong>NRT:</strong> L-720543-P<br>
      <strong>Correu electrònic de contacte:</strong> <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a></p>

      <h4>2. Finalitats del tractament i bases legals</h4>
      <p>Les dades de caràcter personal facilitades pels usuaris (per exemple, a través del formulari de contacte o correu electrònic) es tracten amb les següents finalitats:</p>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Gestionar i respondre a consultes o sol·licituds d’informació</strong> enviades a través del lloc web.<br><em>Base legal:</em> Consentiment del titular (article 6.1.a del RGPD / article 6.1.a de la Llei 29/2021).</li>
        <li><strong>Mantenir una relació professional</strong> amb clients, col·laboradors o interessats.<br><em>Base legal:</em> Interès legítim del responsable (article 6.1.f del RGPD / article 6.1.f de la Llei 29/2021).</li>
        <li><strong>Enviar informació comercial o institucional</strong> (només si s’ha obtingut el consentiment explícit i revocable del titular).<br><em>Base legal:</em> Consentiment del titular.</li>
      </ul>

      <h4>3. Legitimació i consentiment</h4>
      <p>Conformement amb l’article 6 de la Llei 29/2021, el tractament de dades es realitza sempre amb una base legal vàlida. En el cas del consentiment, aquest és lliure, específic, informat i inequívoc, i pot ser retirat en qualsevol moment sense que afecti la legalitat del tractament realitzat amb anterioritat.</p>

      <h4>4. Destinataris de les dades</h4>
      <p>Les dades no es cediran a tercers, llevat dels següents supòsits:</p>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Encarregats del tractament:</strong> Proveïdors de serveis externs (hosting, gestió de correu, còpia de seguretat, etc.) que actuen en nom i per compte de DEL SOTO-PALEARI & Associats, S.L. Aquests estan subjectes a contracte segons l’article 28 del RGPD o equivalent segons la Llei 29/2021.</li>
        <li><strong>Obligació legal:</strong> Quan una autoritat judicial, administrativa o reguladora competent exigeixi la comunicació de dades.</li>
      </ul>
      <p>Si es fan transferències internacionals de dades, es garantirà un nivell adequat de protecció mitjançant clàusules contractals estàndard o altres mesures de seguretat reconegudes.</p>

      <h4>5. Drets de les persones interessades</h4>
      <p>D’acord amb la Llei 29/2021, les persones interessades tenen els següents drets:</p>
      <ul class="list-disc list-inside space-y-2">
        <li>Accés a les seves dades tractades.</li>
        <li>Rectificació de dades inexactes o incompletes.</li>
        <li>Supressió ("dret a l’oblit") en determinades circumstàncies.</li>
        <li>Limitació del tractament en casos concrets.</li>
        <li>Oposició al tractament, especialment amb finalitats de màrqueting directe.</li>
        <li>Portabilitat de les dades, quan el tractament es basi en el consentiment o en l’execució d’un contracte.</li>
      </ul>
      <p>Per exercir aquests drets, cal enviar una sol·licitud per escrit o per correu electrònic a <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a>, acreditant la vostra identitat.</p>
      <p>També teniu dret a presentar una reclamació davant de l’Autoritat de Protecció de Dades personals del Principat d’Andorra si considereu que el tractament de les vostres dades vulnera la Llei 29/2021.</p>

      <h4>6. Mesures de seguretat</h4>
      <p>DEL SOTO-PALEARI & Associats, S.L. ha adoptat les mesures tècniques i organitzatives apropiades per garantir un nivell de seguretat adequat al risc, tal com exigeix l’article 32 de la Llei 29/2021. Això inclou protecció contra la destrucció, pèrdua, alteració, divulgació o accés no autoritzat a les dades.</p>

      <h4>7. Període de conservació de les dades</h4>
      <p>Les dades es conservaran durant el temps estrictament necessari per a les finalitats per a les quals van ser recollides, i en tot cas, durant els terminis legalment establerts (per exemple, per complir amb obligacions fiscals, civils o administratives). Un cop es compleixi aquest termini, les dades s’esborraran de forma segura.</p>

      <h4>8. Canvis en aquesta política</h4>
      <p>Aquesta Política de Privacitat pot ser modificada per adaptar-se a futurs canvis legislatius, jurisprudencials o tècnics. Es recomana revisar-la periòdicament a través del lloc web <a href="https://www.ambit.ad" style="color:#009B9C">www.ambit.ad</a>.</p>
      <p><strong>Data de la darrera actualització:</strong> 5 d’abril de 2025</p>
    `,
    cookies: `
      <h3>🍪 Avis de Cookies</h3>
      <p><em>(Adaptat a la Llei 35/2014 i a la Llei 29/2021 sobre protecció de dades)</em></p>

      <h4>1. Què són les cookies?</h4>
      <p>Les cookies són petits fitxers que es desen al dispositiu de l’usuari (ordinador, mòbil, tauleta) quan visita un lloc web. Tenen com a finalitat millorar l’experiència d’usuari, facilitar la navegació, analitzar el comportament dels usuaris i oferir continguts adaptats.</p>
      <p>Aquest lloc web, <strong>www.ambit.ad</strong>, utilitza cookies d’acord amb la Llei 35/2014, del 27 de novembre, de serveis de confiança electrònica, i amb els principis de transparència i consentiment de la Llei 29/2021.</p>

      <h4>2. Tipus de cookies utilitzades</h4>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Cookies tècniques</strong><br>
        Necessàries per al funcionament bàsic del lloc web.<br>
        Gestió de sessió, compatibilitat, accés.</li>
        <li><strong>Cookies d’anàlisi</strong><br>
        Mesuren i analitzen l’ús del lloc web per millorar-ne el rendiment.<br>
        Google Analytics (en mode anònim, sense emmagatzemar IP completa).</li>
        <li><strong>Cookies de tercers</strong><br>
        Integrades per serveis externs (xarxes socials, mapes, etc.).<br>
        Botons d’"emprar" o "compartir" de xarxes socials.</li>
      </ul>
      <p><strong>⚠️ Nota:</strong> En aquest moment, no s’utilitzen cookies de perfilatge ni de publicitat comportamental.</p>

      <h4>3. Consentiment de l’usuari</h4>
      <p>Conformement amb la Llei 35/2014 i la jurisprudència del TJUE, el lloc web mostra un bàner informatiu de cookies que permet a l’usuari donar el seu consentiment informat, lliure i revocable abans que es desin una cookie no essencial.</p>
      <p>En continuar navegant per aquest lloc web, l’usuari accepta expressament l’ús de cookies. El consentiment pot retirar-se en qualsevol moment a través de la configuració del navegador o posant-se en contacte amb nosaltres.</p>

      <h4>4. Gestió de cookies</h4>
      <p>L’usuari pot gestionar, bloquejar o eliminar les cookies mitjançant les opcions del seu navegador:</p>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Google Chrome:</strong> Configuració > Privacitat i seguretat > Cookies</li>
        <li><strong>Mozilla Firefox:</strong> Opcions > Privacitat i seguretat > Cookies i dades de llocs</li>
        <li><strong>Safari:</strong> Preferències > Privacitat > Bloquejar cookies de tercers</li>
        <li><strong>Microsoft Edge:</strong> Configuració > Cookies i permisos del lloc</li>
      </ul>
      <p>També podeu desactivar les cookies analítiques de Google Analytics des de: <a href="https://tools.google.com/dlpage/gaoptout" style="color:#009B9C">https://tools.google.com/dlpage/gaoptout</a></p>

      <h4>5. Actualitzacions</h4>
      <p>Aquest Avis de Cookies pot actualitzar-se per adaptar-se a canvis en les eines utilitzades o en la normativa vigent.</p>
      <p><strong>Data de la darrera actualització:</strong> 5 d’abril de 2025</p>
    `
  },
  es: {
    aviso: `
      <h3>Aviso legal</h3>
      <p>Este sitio web es propiedad de DEL SOTO-PALEARI & Associats, SL, con domicilio en Av. Fiter i Rossel, núm. 78, 2n B, Edifici Carlemany, AD700 Andorra y NRT L-720543-P. El uso de este sitio web implica la aceptación de las condiciones generales de uso. Todos los derechos reservados.</p>
    `,
    privacidad: `
      <h3>Política de Privacidad</h3>
      <p><em>(Actualizada según la Ley calificada 29/2021, del 28 de octubre, de protección de datos personales del Principado de Andorra)</em></p>
      <p>En cumplimiento de la Ley calificada 29/2021, del 28 de octubre, de protección de datos personales y de la Ley 35/2014, del 27 de noviembre, de servicios de confianza electrónica, DEL SOTO-PALEARI & Associats, S.L. informa a los usuarios del sitio web <strong>www.ambit.ad</strong> sobre el tratamiento de sus datos de carácter personal.</p>

      <h4>1. Responsable del tratamiento</h4>
      <p><strong>Identidad:</strong> DEL SOTO-PALEARI & Associats, S.L.<br>
      <strong>Domicilio:</strong> Avenida Fiter i Rossell, número 78, Edificio Carlemany, 2n B, AD500 Andorra la Vella, Principado de Andorra<br>
      <strong>NRT:</strong> L-720543-P<br>
      <strong>Correo electrónico de contacto:</strong> <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a></p>

      <h4>2. Finalidades del tratamiento y bases legales</h4>
      <p>Los datos de carácter personal facilitados por los usuarios (por ejemplo, a través del formulario de contacto o correo electrónico) se tratan con las siguientes finalidades:</p>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Gestionar y responder a consultas o solicitudes de información</strong> enviadas a través del sitio web.<br><em>Base legal:</em> Consentimiento del titular (artículo 6.1.a del RGPD / artículo 6.1.a de la Ley 29/2021).</li>
        <li><strong>Mantener una relación profesional</strong> con clientes, colaboradores o interesados.<br><em>Base legal:</em> Interés legítimo del responsable (artículo 6.1.f del RGPD / artículo 6.1.f de la Ley 29/2021).</li>
        <li><strong>Enviar información comercial o institucional</strong> (solo si se ha obtenido el consentimiento explícito y revocable del titular).<br><em>Base legal:</em> Consentimiento del titular.</li>
      </ul>

      <h4>3. Legitimación y consentimiento</h4>
      <p>Conforme al artículo 6 de la Ley 29/2021, el tratamiento de datos se realiza siempre con una base legal válida. En caso de consentimiento, este es libre, específico, informado e inequívoco, y puede retirarse en cualquier momento sin que afecte a la legalidad del tratamiento realizado con anterioridad.</p>

      <h4>4. Destinatarios de los datos</h4>
      <p>Los datos no se cederán a terceros, salvo en los siguientes supuestos:</p>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Encargados del tratamiento:</strong> Proveedores de servicios externos (alojamiento, gestión de correo, copia de seguridad, etc.) que actúan en nombre y por cuenta de DEL SOTO-PALEARI & Associats, S.L. Están sujetos a contrato según el artículo 28 del RGPD o equivalente según la Ley 29/2021.</li>
        <li><strong>Obligación legal:</strong> Cuando una autoridad judicial, administrativa o reguladora competente exija la comunicación de datos.</li>
      </ul>
      <p>Si se realizan transferencias internacionales de datos, se garantizará un nivel adecuado de protección mediante cláusulas contractuales estándar u otras medidas de seguridad reconocidas.</p>

      <h4>5. Derechos de las personas interesadas</h4>
      <p>De acuerdo con la Ley 29/2021, las personas interesadas tienen los siguientes derechos:</p>
      <ul class="list-disc list-inside space-y-2">
        <li>Acceso a sus datos tratados.</li>
        <li>Rectificación de datos inexactos o incompletos.</li>
        <li>Supresión ("derecho al olvido") en determinadas circunstancias.</li>
        <li>Limitación del tratamiento en casos concretos.</li>
        <li>Oposición al tratamiento, especialmente con fines de marketing directo.</li>
        <li>Portabilidad de los datos, cuando el tratamiento se base en el consentimiento o en la ejecución de un contrato.</li>
      </ul>
      <p>Para ejercer estos derechos, debe enviarse una solicitud por escrito o por correo electrónico a <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a>, acreditando su identidad.</p>
      <p>También tiene derecho a presentar una reclamación ante la Autoridad de Protección de Datos personales del Principado de Andorra si considera que el tratamiento de sus datos vulnera la Ley 29/2021.</p>

      <h4>6. Medidas de seguridad</h4>
      <p>DEL SOTO-PALEARI & Associats, S.L. ha adoptado las medidas técnicas y organizativas apropiadas para garantizar un nivel de seguridad adecuado al riesgo, tal como exige el artículo 32 de la Ley 29/2021. Esto incluye protección contra la destrucción, pérdida, alteración, divulgación o acceso no autorizado a los datos.</p>

      <h4>7. Periodo de conservación de los datos</h4>
      <p>Los datos se conservarán durante el tiempo estrictamente necesario para las finalidades para las que fueron recopilados, y en todo caso, durante los plazos legalmente establecidos (por ejemplo, para cumplir con obligaciones fiscales, civiles o administrativas). Una vez transcurrido este plazo, los datos se eliminarán de forma segura.</p>

      <h4>8. Cambios en esta política</h4>
      <p>Esta Política de Privacidad puede modificarse para adaptarse a futuros cambios legislativos, jurisprudenciales o técnicos. Se recomienda revisarla periódicamente a través del sitio web <a href="https://www.ambit.ad" style="color:#009B9C">www.ambit.ad</a>.</p>
      <p><strong>Fecha de la última actualización:</strong> 5 de abril de 2025</p>
    `,
    cookies: `
      <h3>🍪 Aviso de Cookies</h3>
      <p><em>(Adaptado a la Ley 35/2014 y a la Ley 29/2021 sobre protección de datos)</em></p>

      <h4>1. ¿Qué son las cookies?</h4>
      <p>Las cookies son pequeños archivos que se almacenan en el dispositivo del usuario (ordenador, móvil, tableta) cuando visita un sitio web. Tienen como finalidad mejorar la experiencia de usuario, facilitar la navegación, analizar el comportamiento de los usuarios y ofrecer contenidos adaptados.</p>
      <p>Este sitio web, <strong>www.ambit.ad</strong>, utiliza cookies de acuerdo con la Ley 35/2014, del 27 de noviembre, de servicios de confianza electrónica, y con los principios de transparencia y consentimiento de la Ley 29/2021.</p>

      <h4>2. Tipos de cookies utilizadas</h4>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Cookies técnicas</strong><br>
        Necesarias para el funcionamiento básico del sitio web.<br>
        Gestión de sesión, compatibilidad, acceso.</li>
        <li><strong>Cookies de análisis</strong><br>
        Miden y analizan el uso del sitio web para mejorar su rendimiento.<br>
        Google Analytics (en modo anónimo, sin almacenar IP completa).</li>
        <li><strong>Cookies de terceros</strong><br>
        Integradas por servicios externos (redes sociales, mapas, etc.).<br>
        Botones de "Me gusta" o "Compartir" de redes sociales.</li>
      </ul>
      <p><strong>⚠️ Nota:</strong> En este momento, no se utilizan cookies de perfilado ni de publicidad conductual.</p>

      <h4>3. Consentimiento del usuario</h4>
      <p>Conforme a la Ley 35/2014 y la jurisprudencia del TJUE, el sitio web muestra un banner informativo de cookies que permite al usuario dar su consentimiento informado, libre y revocable antes de que se almacene una cookie no esencial.</p>
      <p>Al continuar navegando por este sitio web, el usuario acepta expresamente el uso de cookies. El consentimiento puede retirarse en cualquier momento a través de la configuración del navegador o poniéndose en contacto con nosotros.</p>

      <h4>4. Gestión de cookies</h4>
      <p>El usuario puede gestionar, bloquear o eliminar las cookies mediante las opciones de su navegador:</p>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Google Chrome:</strong> Configuración > Privacidad y seguridad > Cookies</li>
        <li><strong>Mozilla Firefox:</strong> Opciones > Privacidad y seguridad > Cookies y datos de sitios</li>
        <li><strong>Safari:</strong> Preferencias > Privacidad > Bloquear cookies de terceros</li>
        <li><strong>Microsoft Edge:</strong> Configuración > Cookies y permisos del sitio</li>
      </ul>
      <p>También puede desactivar las cookies analíticas de Google Analytics desde: <a href="https://tools.google.com/dlpage/gaoptout" style="color:#009B9C">https://tools.google.com/dlpage/gaoptout</a></p>

      <h4>5. Actualizaciones</h4>
      <p>Este Aviso de Cookies puede actualizarse para adaptarse a cambios en las herramientas utilizadas o en la normativa vigente.</p>
      <p><strong>Fecha de la última actualización:</strong> 5 de abril de 2025</p>
    `
  },
  en: {
    aviso: `
      <h3>Legal notice</h3>
      <p>This website is owned by DEL SOTO-PALEARI & Associats, SL, with address at Av. Fiter i Rossel, 78, 2n B, Edifici Carlemany, AD700 Andorra and NRT L-720543-P. Use of this website implies acceptance of the general terms of use. All rights reserved.</p>
    `,
    privacidad: `
      <h3>Privacy Policy</h3>
      <p><em>(Updated according to Qualified Law 29/2021, of 28 October, on personal data protection of the Principality of Andorra)</em></p>
      <p>In compliance with Qualified Law 29/2021, of 28 October, on personal data protection, and Law 35/2014, of 27 November, on electronic trust services, DEL SOTO-PALEARI & Associats, S.L. informs users of the website <strong>www.ambit.ad</strong> about the processing of their personal data.</p>

      <h4>1. Data Controller</h4>
      <p><strong>Identity:</strong> DEL SOTO-PALEARI & Associats, S.L.<br>
      <strong>Address:</strong> Avinguda Fiter i Rossell, 78, Edifici Carlemany, 2n B, AD500 Andorra la Vella, Principality of Andorra<br>
      <strong>NRT:</strong> L-720543-P<br>
      <strong>Contact email:</strong> <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a></p>

      <h4>2. Purposes of Processing and Legal Basis</h4>
      <p>Personal data provided by users (e.g., via contact form or email) are processed for the following purposes:</p>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Manage and respond to inquiries or information requests</strong> sent via the website.<br><em>Legal basis:</em> Consent of the data subject (Article 6.1.a GDPR / Article 6.1.a Law 29/2021).</li>
        <li><strong>Maintain a professional relationship</strong> with clients, collaborators or interested parties.<br><em>Legal basis:</em> Legitimate interest of the controller (Article 6.1.f GDPR / Article 6.1.f Law 29/2021).</li>
        <li><strong>Send commercial or institutional information</strong> (only if explicit and revocable consent has been obtained).<br><em>Legal basis:</em> Consent of the data subject.</li>
      </ul>

      <h4>3. Legal Basis and Consent</h4>
      <p>In accordance with Article 6 of Law 29/2021, data processing is always based on a valid legal ground. Where consent is the basis, it is freely given, specific, informed, and unambiguous, and may be withdrawn at any time without affecting the lawfulness of processing carried out previously.</p>

      <h4>4. Recipients of the Data</h4>
      <p>Data will not be disclosed to third parties except in the following cases:</p>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Processors:</strong> External service providers (hosting, email management, backup, etc.) acting on behalf and for DEL SOTO-PALEARI & Associats, S.L. These are bound by contract under Article 28 GDPR or equivalent under Law 29/2021.</li>
        <li><strong>Legal obligation:</strong> When a competent judicial, administrative, or regulatory authority requires data disclosure.</li>
      </ul>
      <p>If international data transfers occur, an adequate level of protection will be ensured through standard contractual clauses or other recognized security measures.</p>

      <h4>5. Data Subject Rights</h4>
      <p>Under Law 29/2021, data subjects have the following rights:</p>
      <ul class="list-disc list-inside space-y-2">
        <li>Access to their processed data.</li>
        <li>Rectification of inaccurate or incomplete data.</li>
        <li>Erasure ("right to be forgotten") under certain circumstances.</li>
        <li>Restriction of processing in specific cases.</li>
        <li>Objection to processing, especially for direct marketing purposes.</li>
        <li>Data portability, where processing is based on consent or contract performance.</li>
      </ul>
      <p>To exercise these rights, please send a written request or email to <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a>, verifying your identity.</p>
      <p>You also have the right to lodge a complaint with the Personal Data Protection Authority of the Principality of Andorra if you believe your data processing violates Law 29/2021.</p>

      <h4>6. Security Measures</h4>
      <p>DEL SOTO-PALEARI & Associats, S.L. has implemented appropriate technical and organizational measures to ensure a level of security appropriate to the risk, as required by Article 32 of Law 29/2021. This includes protection against destruction, loss, alteration, disclosure, or unauthorized access to data.</p>

      <h4>7. Data Retention Period</h4>
      <p>Data will be retained only for as long as necessary for the purposes for which it was collected, and in any case, for the legally established periods (e.g., to comply with tax, civil, or administrative obligations). After this period, data will be securely deleted.</p>

      <h4>8. Changes to this Policy</h4>
      <p>This Privacy Policy may be updated to adapt to future legislative, judicial, or technical changes. We recommend reviewing it periodically on the website <a href="https://www.ambit.ad" style="color:#009B9C">www.ambit.ad</a>.</p>
      <p><strong>Last updated:</strong> April 5, 2025</p>
    `,
    cookies: `
      <h3>🍪 Cookie Notice</h3>
      <p><em>(Adapted to Law 35/2014 and Law 29/2021 on data protection)</em></p>

      <h4>1. What are cookies?</h4>
      <p>Cookies are small files stored on the user’s device (computer, mobile, tablet) when visiting a website. They aim to improve user experience, facilitate navigation, analyze user behavior, and provide tailored content.</p>
      <p>This website, <strong>www.ambit.ad</strong>, uses cookies in accordance with Law 35/2014, of November 27, on electronic trust services, and the transparency and consent principles of Law 29/2021.</p>

      <h4>2. Types of cookies used</h4>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Technical cookies</strong><br>
        Necessary for basic website functionality.<br>
        Session management, compatibility, access.</li>
        <li><strong>Analytical cookies</strong><br>
        Measure and analyze website usage to improve performance.<br>
        Google Analytics (in anonymous mode, without storing full IP).</li>
        <li><strong>Third-party cookies</strong><br>
        Integrated from external services (social networks, maps, etc.).<br>
        "Like" or "Share" buttons from social networks.</li>
      </ul>
      <p><strong>⚠️ Note:</strong> Currently, no profiling or behavioral advertising cookies are used.</p>

      <h4>3. User Consent</h4>
      <p>In compliance with Law 35/2014 and CJEU jurisprudence, the website displays an informative cookie banner allowing users to give informed, free, and revocable consent before non-essential cookies are stored.</p>
      <p>By continuing to browse this website, you expressly accept the use of cookies. Consent can be withdrawn at any time via browser settings or by contacting us.</p>

      <h4>4. Managing Cookies</h4>
      <p>You can manage, block, or delete cookies via your browser settings:</p>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Google Chrome:</strong> Settings > Privacy and Security > Cookies</li>
        <li><strong>Mozilla Firefox:</strong> Options > Privacy & Security > Cookies and Site Data</li>
        <li><strong>Safari:</strong> Preferences > Privacy > Block third-party cookies</li>
        <li><strong>Microsoft Edge:</strong> Settings > Cookies and site permissions</li>
      </ul>
      <p>You can also disable Google Analytics cookies at: <a href="https://tools.google.com/dlpage/gaoptout" style="color:#009B9C">https://tools.google.com/dlpage/gaoptout</a></p>

      <h4>5. Updates</h4>
      <p>This Cookie Notice may be updated to reflect changes in tools used or applicable regulations.</p>
      <p><strong>Last updated:</strong> April 5, 2025</p>
    `
  },
  fr: {
    aviso: `
      <h3>Avis légal</h3>
      <p>Ce site web appartient à DEL SOTO-PALEARI & Associats, SL, dont le siège est situé à l’Av. Fiter i Rossel, 78, 2n B, Edifici Carlemany, AD700 Andorre, NRT L-720543-P. L’utilisation de ce site implique l’acceptation des conditions générales d’utilisation. Tous droits réservés.</p>
    `,
    privacidad: `
      <h3>Politique de confidentialité</h3>
      <p><em>(Mise à jour conformément à la loi qualifiée 29/2021, du 28 octobre, relative à la protection des données à caractère personnel du Principauté d’Andorre)</em></p>
      <p>Conformément à la loi qualifiée 29/2021, du 28 octobre, relative à la protection des données à caractère personnel, et à la loi 35/2014, du 27 novembre, relative aux services de confiance électronique, DEL SOTO-PALEARI & Associats, S.L. informe les utilisateurs du site web <strong>www.ambit.ad</strong> sur le traitement de leurs données à caractère personnel.</p>

      <h4>1. Responsable du traitement</h4>
      <p><strong>Identité :</strong> DEL SOTO-PALEARI & Associats, S.L.<br>
      <strong>Adresse :</strong> Avinguda Fiter i Rossell, 78, Edifici Carlemany, 2n B, AD500 Andorre-la-Vieille, Principauté d’Andorre<br>
      <strong>NRT :</strong> L-720543-P<br>
      <strong>Adresse e-mail de contact :</strong> <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a></p>

      <h4>2. Finalités du traitement et bases juridiques</h4>
      <p>Les données à caractère personnel fournies par les utilisateurs (par exemple via le formulaire de contact ou un courriel) sont traitées aux fins suivantes :</p>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Gérer et répondre aux demandes d’informations</strong> envoyées via le site web.<br><em>Base juridique :</em> Consentement du titulaire (article 6.1.a du RGPD / article 6.1.a de la loi 29/2021).</li>
        <li><strong>Maintenir une relation professionnelle</strong> avec les clients, collaborateurs ou intéressés.<br><em>Base juridique :</em> Intérêt légitime du responsable (article 6.1.f du RGPD / article 6.1.f de la loi 29/2021).</li>
        <li><strong>Envoyer des informations commerciales ou institutionnelles</strong> (uniquement si le consentement explicite et révocable du titulaire a été obtenu).<br><em>Base juridique :</em> Consentement du titulaire.</li>
      </ul>

      <h4>3. Légitimation et consentement</h4>
      <p>Conformément à l’article 6 de la loi 29/2021, le traitement des données s’effectue toujours sur une base juridique valide. En cas de consentement, celui-ci est libre, spécifique, informé et sans équivoque, et peut être retiré à tout moment sans affecter la licéité du traitement effectué antérieurement.</p>

      <h4>4. Destinataires des données</h4>
      <p>Les données ne seront pas cédées à des tiers, sauf dans les cas suivants :</p>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Sous-traitants :</strong> Prestataires de services externes (hébergement, gestion de courrier, sauvegarde, etc.) agissant pour le compte de DEL SOTO-PALEARI & Associats, S.L. Ils sont soumis à contrat conformément à l’article 28 du RGPD ou équivalent selon la loi 29/2021.</li>
        <li><strong>Obligation légale :</strong> Lorsqu’une autorité judiciaire, administrative ou réglementaire compétente exige la communication des données.</li>
      </ul>
      <p>En cas de transferts internationaux de données, un niveau adéquat de protection sera garanti par des clauses contractuelles types ou d'autres mesures de sécurité reconnues.</p>

      <h4>5. Droits des personnes concernées</h4>
      <p>Conformément à la loi 29/2021, les personnes concernées disposent des droits suivants :</p>
      <ul class="list-disc list-inside space-y-2">
        <li>Accès à leurs données traitées.</li>
        <li>Rectification des données inexactes ou incomplètes.</li>
        <li>Suppression (« droit à l’oubli ») dans certaines circonstances.</li>
        <li>Limitation du traitement dans des cas spécifiques.</li>
        <li>Opposition au traitement, notamment à des fins de marketing direct.</li>
        <li>Portabilité des données, lorsque le traitement repose sur le consentement ou sur l’exécution d’un contrat.</li>
      </ul>
      <p>Pour exercer ces droits, veuillez envoyer une demande écrite ou par courriel à <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a>, en justifiant votre identité.</p>
      <p>Vous avez également le droit d’introduire une réclamation auprès de l’Autorité de protection des données à caractère personnel du Principauté d’Andorre si vous estimez que le traitement de vos données viole la loi 29/2021.</p>

      <h4>6. Mesures de sécurité</h4>
      <p>DEL SOTO-PALEARI & Associats, S.L. a adopté des mesures techniques et organisationnelles appropriées pour garantir un niveau de sécurité adapté au risque, conformément à l’article 32 de la loi 29/2021. Cela inclut la protection contre la destruction, la perte, l’altération, la divulgation ou l’accès non autorisé aux données.</p>

      <h4>7. Durée de conservation des données</h4>
      <p>Les données sont conservées pendant le temps strictement nécessaire aux finalités pour lesquelles elles ont été collectées, et en tout état de cause, pendant les délais légalement prévus (par exemple, pour respecter les obligations fiscales, civiles ou administratives). Une fois ce délai expiré, les données sont supprimées de manière sécurisée.</p>

      <h4>8. Modifications de cette politique</h4>
      <p>La présente Politique de confidentialité peut être modifiée afin de s’adapter à d’éventuels changements législatifs, jurisprudentiels ou techniques. Nous vous recommandons de la consulter périodiquement sur le site web <a href="https://www.ambit.ad" style="color:#009B9C">www.ambit.ad</a>.</p>
      <p><strong>Date de la dernière mise à jour :</strong> 5 avril 2025</p>
    `,
    cookies: `
      <h3>🍪 Politique de cookies</h3>
      <p><em>(Adaptée à la loi 35/2014 et à la loi 29/2021 sur la protection des données)</em></p>

      <h4>1. Qu’est-ce qu’un cookie ?</h4>
      <p>Les cookies sont de petits fichiers stockés sur le dispositif de l’utilisateur (ordinateur, téléphone, tablette) lorsqu’il visite un site web. Ils ont pour but d’améliorer l’expérience utilisateur, de faciliter la navigation, d’analyser le comportement des utilisateurs et d’offrir des contenus adaptés.</p>
      <p>Ce site web, <strong>www.ambit.ad</strong>, utilise des cookies conformément à la loi 35/2014, du 27 novembre, relative aux services de confiance électronique, et aux principes de transparence et de consentement de la loi 29/2021.</p>

      <h4>2. Types de cookies utilisés</h4>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Cookies techniques</strong><br>
        Nécessaires au fonctionnement de base du site web.<br>
        Gestion de session, compatibilité, accès.</li>
        <li><strong>Cookies d’analyse</strong><br>
        Mesurent et analysent l’utilisation du site pour en améliorer les performances.<br>
        Google Analytics (en mode anonyme, sans enregistrement complet de l’IP).</li>
        <li><strong>Cookies de tiers</strong><br>
        Intégrés par des services externes (réseaux sociaux, cartes, etc.).<br>
        Boutons « J’aime » ou « Partager » de réseaux sociaux.</li>
      </ul>
      <p><strong>⚠️ Remarque :</strong> Actuellement, aucun cookie de profilage ou de publicité comportementale n’est utilisé.</p>

      <h4>3. Consentement de l’utilisateur</h4>
      <p>Conformément à la loi 35/2014 et à la jurisprudence de la CJUE, le site affiche une bannière informative sur les cookies permettant à l’utilisateur de donner son consentement éclairé, libre et révocable avant le dépôt d’un cookie non essentiel.</p>
      <p>En continuant à naviguer sur ce site, vous acceptez expressément l’utilisation des cookies. Le consentement peut être retiré à tout moment via les paramètres du navigateur ou en nous contactant.</p>

      <h4>4. Gestion des cookies</h4>
      <p>Vous pouvez gérer, bloquer ou supprimer les cookies via les options de votre navigateur :</p>
      <ul class="list-disc list-inside space-y-2">
        <li><strong>Google Chrome :</strong> Paramètres > Confidentialité et sécurité > Cookies</li>
        <li><strong>Mozilla Firefox :</strong> Options > Confidentialité et sécurité > Cookies et données de sites</li>
        <li><strong>Safari :</strong> Préférences > Confidentialité > Bloquer les cookies de tiers</li>
        <li><strong>Microsoft Edge :</strong> Paramètres > Cookies et autorisations des sites</li>
      </ul>
      <p>Vous pouvez également désactiver les cookies analytiques de Google Analytics depuis : <a href="https://tools.google.com/dlpage/gaoptout" style="color:#009B9C">https://tools.google.com/dlpage/gaoptout</a></p>

      <h4>5. Mises à jour</h4>
      <p>La présente Politique de cookies peut être mise à jour pour s’adapter aux changements d’outils utilisés ou à la réglementation en vigueur.</p>
      <p><strong>Date de la dernière mise à jour :</strong> 5 avril 2025</p>
    `
  }
};

// Serveis principals
const mainServices = {
  ca: [
    { id: "comptable", title: "Comptabilitat i Fiscalitat" },
    { id: "laboral", title: "Àrea Laboral" },
    { id: "mercantil", title: "Mercantil i Jurídic-Administrativa" },
    { id: "residencia", title: "Residència i Gestoria" },
    { id: "altres", title: "Altres Serveis Professionals" },
  ],
  es: [
    { id: "comptable", title: "Contabilidad y Fiscalidad" },
    { id: "laboral", title: "Área Laboral" },
    { id: "mercantil", title: "Mercantil y Jurídico-Administrativa" },
    { id: "residencia", title: "Residencia y Gestoría" },
    { id: "altres", title: "Otros Servicios Profesionales" },
  ],
  en: [
    { id: "comptable", title: "Accounting and Tax" },
    { id: "laboral", title: "Labor" },
    { id: "mercantil", title: "Corporate and Legal-Administrative" },
    { id: "residencia", title: "Residency and Administration" },
    { id: "altres", title: "Other Professional Services" },
  ],
  fr: [
    { id: "comptable", title: "Comptabilité et Fiscalité" },
    { id: "laboral", title: "Domaine du travail" },
    { id: "mercantil", title: "Méritime et Juridique-Administratif" },
    { id: "residencia", title: "Résidence et Gestion" },
    { id: "altres", title: "Autres Services Professionnels" },
  ],
};

// Detalls dels serveis
const serviceDetails = {
  ca: {
    comptable: {
      title: "Comptabilitat i Fiscalitat",
      items: [
        "Comptabilitat bàsica, estàndard i avançada segons volum d’activitat.",
        "Gestió d’IGI trimestral i liquidacions.",
        "Presentació de l’Impost de Societats.",
        "Declaracions d’IRPF per a persones físiques.",
        "Assessorament fiscal continuat per a optimització i compliment normatiu."
      ]
    },
    laboral: {
      title: "Àrea Laboral",
      items: [
        "Altes i baixes de treballadors.",
        "Confecció de nòmines fins a 3 treballadors.",
        "Redacció de contractes laborals i modificacions.",
        "Liquidacions mensuals CASS (incloses en el servei).",
        "Comunicacions de vacances, baixes mèdiques, etc."
      ]
    },
    mercantil: {
      title: "Mercantil i Jurídic-Administrativa",
      items: [
        "Constitució de societats (SL o SA).",
        "Redacció d’estatuts i assessorament inicial.",
        "Modificació d’estatuts (ampliació de capital, canvi de domicili, etc.).",
        "Nomenaments i cessaments d’administradors.",
        "Emissió i inscripció de certificats oficials.",
        "Redacció i dipòsit de comptes anuals.",
        "Suport en actes notarials i protocols."
      ]
    },
    residencia: {
      title: "Residència i Gestoria",
      items: [
        "Sol·licitud de residència per compte propi o inversió.",
        "Residència per compte d’altre (via contracte laboral).",
        "Renovacions de residència.",
        "Alta i inscripció a la CASS.",
        "Alta a l’Agència Tributària i registre d’empreses.",
        "Inscripcions als Comuns (activitat, tenença d’animals, etc.).",
        "Obtenció de certificats de residència, empadronament, etc.",
        "Sol·licitud de NIE/NIA."
      ]
    },
    altres: {
      title: "Altres Serveis Professionals",
      items: [
        "Assessorament puntual en matèria comptable, fiscal o laboral.",
        "Redacció de contractes mercantils o laborals complexos.",
        "Representació davant l’Administració andorrana.",
        "Elaboració d’informes personalitzats o dictàmens.",
        "Desplaçaments per realitzar tràmits fora del despatx (Escaldes, Andorra la Vella i altres municipis)."
      ]
    }
  },
  es: {
    comptable: {
      title: "Contabilidad y Fiscalidad",
      items: [
        "Contabilidad básica, estándar y avanzada según volumen de actividad.",
        "Gestión de IGI trimestral y liquidaciones.",
        "Presentación del Impuesto de Sociedades.",
        "Declaraciones de IRPF para personas físicas.",
        "Asesoramiento fiscal continuado para optimización y cumplimiento normativo."
      ]
    },
    laboral: {
      title: "Área Laboral",
      items: [
        "Altas y bajas de trabajadores.",
        "Confección de nóminas hasta 3 trabajadores.",
        "Redacción de contratos laborales y modificaciones.",
        "Liquidaciones mensuales CASS (incluidas en el servicio).",
        "Comunicaciones de vacaciones, bajas médicas, etc."
      ]
    },
    mercantil: {
      title: "Mercantil y Jurídico-Administrativa",
      items: [
        "Constitución de sociedades (SL o SA).",
        "Redacción de estatutos y asesoramiento inicial.",
        "Modificación de estatutos (ampliación de capital, cambio de domicilio, etc.).",
        "Nombramientos y ceses de administradores.",
        "Emisión e inscripción de certificados oficiales.",
        "Redacción y depósito de cuentas anuales.",
        "Soporte en actos notariales y protocolos."
      ]
    },
    residencia: {
      title: "Residencia y Gestoría",
      items: [
        "Solicitud de residencia por cuenta propia o inversión.",
        "Residencia por cuenta ajena (mediante contrato laboral).",
        "Renovaciones de residencia.",
        "Alta e inscripción en la CASS.",
        "Alta en la Agencia Tributaria y registro de empresas.",
        "Inscripciones en los Comunes (actividad, tenencia de animales, etc.).",
        "Obtención de certificados de residencia, empadronamiento, etc.",
        "Solicitud de NIE/NIA."
      ]
    },
    altres: {
      title: "Otros Servicios Profesionales",
      items: [
        "Asesoramiento puntual en materia contable, fiscal o laboral.",
        "Redacción de contratos mercantiles o laborales complejos.",
        "Representación ante la Administración andorrana.",
        "Elaboración de informes personalizados o dictámenes.",
        "Desplazamientos para realizar trámites fuera de la oficina (Escaldes, Andorra la Vella y otros municipios)."
      ]
    }
  },
  en: {
    comptable: {
      title: "Accounting and Tax",
      items: [
        "Basic, standard, and advanced accounting based on activity volume.",
        "Quarterly IGI management and settlements.",
        "Corporate Tax filing.",
        "Personal income tax (IRPF) declarations.",
        "Ongoing tax advisory for optimization and compliance."
      ]
    },
    laboral: {
      title: "Labor",
      items: [
        "Employee hires and terminations.",
        "Payroll processing for up to 3 employees.",
        "Drafting employment contracts and amendments.",
        "Monthly CASS settlements (included).",
        "Communications for vacations, sick leave, etc."
      ]
    },
    mercantil: {
      title: "Corporate and Legal-Administrative",
      items: [
        "Company incorporation (SL or SA).",
        "Bylaws drafting and initial advisory.",
        "Bylaws amendments (capital increase, address change, etc.).",
        "Appointment and resignation of directors.",
        "Issuance and registration of official certificates.",
        "Annual accounts preparation and filing.",
        "Support during notarial acts and protocols."
      ]
    },
    residencia: {
      title: "Residency and Administration",
      items: [
        "Residency application for own account or investment.",
        "Residency for third party (employment contract).",
        "Residency renewals.",
        "CASS registration and enrollment.",
        "Tax Agency and business registry registration.",
        "Comuns registrations (activity, pet ownership, etc.).",
        "Residence, registration, and other certificates.",
        "NIE/NIA application."
      ]
    },
    altres: {
      title: "Other Professional Services",
      items: [
        "On-demand advisory in accounting, tax, or labor matters.",
        "Drafting complex commercial or employment contracts.",
        "Representation before Andorran authorities.",
        "Custom reports and expert opinions.",
        "On-site visits for procedures (Escaldes, Andorra la Vella, and other parishes)."
      ]
    }
  },
  fr: {
    comptable: {
      title: "Comptabilité et Fiscalité",
      items: [
        "Comptabilité basique, standard et avancée selon le volume d’activité.",
        "Gestion trimestrielle de l’IGI et liquidations.",
        "Déclaration de l’impôt sur les sociétés.",
        "Déclarations IRPF pour personnes physiques.",
        "Conseil fiscal continu pour l’optimisation et la conformité."
      ]
    },
    laboral: {
      title: "Domaine du travail",
      items: [
        "Embauches et licenciements de travailleurs.",
        "Établissement de salaires jusqu’à 3 travailleurs.",
        "Rédaction de contrats de travail et modifications.",
        "Liquidations mensuelles CASS (incluses).",
        "Communications de congés, arrêts maladie, etc."
      ]
    },
    mercantil: {
      title: "Méritime et Juridique-Administratif",
      items: [
        "Création de sociétés (SL ou SA).",
        "Rédaction des statuts et conseil initial.",
        "Modification des statuts (augmentation de capital, changement d’adresse, etc.).",
        "Nomination et démission d’administrateurs.",
        "Émission et inscription de certificats officiels.",
        "Établissement et dépôt des comptes annuels.",
        "Soutien lors d’actes notariés et protocoles."
      ]
    },
    residencia: {
      title: "Résidence et Gestion",
      items: [
        "Demande de résidence pour compte propre ou investissement.",
        "Résidence pour compte tiers (contrat de travail).",
        "Renouvellements de résidence.",
        "Inscription à la CASS.",
        "Inscription à l’Agence des Impôts et registre des entreprises.",
        "Inscriptions aux Comuns (activité, détention d’animaux, etc.).",
        "Certificats de résidence, d’inscription, etc.",
        "Demande de NIE/NIA."
      ]
    },
    altres: {
      title: "Autres Services Professionnels",
      items: [
        "Conseil ponctuel en matière comptable, fiscale ou sociale.",
        "Rédaction de contrats commerciaux ou de travail complexes.",
        "Représentation devant l’Administration andorrane.",
        "Élaboration de rapports personnalisés ou d’avis.",
        "Déplacements pour effectuer des démarches (Escaldes, Andorre-la-Vieille, autres paroisses)."
      ]
    }
  }
};

const App = () => {
  const [language, setLanguage] = useState("ca");
  const [currentService, setCurrentService] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const t = translations[language];
  const services = mainServices[language];
  const details = serviceDetails[language];

  const handleLanguageChange = (langCode) => {
    setLanguage(langCode);
    setCurrentService(null);
    setFormSubmitted(false);
  };

  const openService = (id) => {
    setCurrentService(id);
  };

  const goBack = () => {
    setCurrentService(null);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormSubmitted(true);
    setFormData({ name: "", email: "", phone: "", message: "" });
    setTimeout(() => setFormSubmitted(false), 3000);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="bg-white text-gray-800 min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#009B9C] text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex justify-end mb-4 space-x-4">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`px-3 py-1 rounded-md text-sm ${
                  lang.code === language
                    ? "bg-white text-[#009B9C] font-semibold"
                    : "bg-opacity-20 hover:bg-white"
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center">
            <Logo />
            <p className="text-center text-lg opacity-90">{t.tagline}</p>
          </div>
        </div>
      </header>

      {!currentService ? (
        <>
          {/* Serveis */}
          <section id="services" className="py-16 bg-gray-50">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">{t.services}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {services.map((service) => (
                  <motion.button
                    key={service.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-white p-6 rounded-xl shadow-lg text-left"
                    onClick={() => openService(service.id)}
                  >
                    <h3 className="text-xl font-bold mb-3 text-[#009B9C]">{service.title}</h3>
                    <p className="text-gray-600">Clica per veure tots els serveis</p>
                  </motion.button>
                ))}
              </div>
            </div>
          </section>

          {/* Qui som */}
          <section id="about" className="py-16">
            <div className="container mx-auto px-4 max-w-3xl text-center">
              <h2 className="text-3xl font-bold mb-6">{t.about}</h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                ÀMBIT Associats és una entitat professional formada per experts amb àmplia experiència en àrees fiscal, comptable, laboral i mercantil al Principat d’Andorra. El nostre compromís és oferir un assessorament personalitzat, rigorós i eficient per a particulars i empreses.
              </p>
            </div>
          </section>

          {/* Contacte */}
          <section id="contact" className="py-16 bg-[#009B9C] text-white">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold text-center mb-8">{t.contact}</h2>
              <p className="text-center text-lg mb-10">{t.contactInfo}</p>
              <div className="max-w-lg mx-auto space-y-4">
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <input
                    type="text"
                    name="name"
                    placeholder={t.form.name}
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full p-3 rounded bg-white text-gray-800"
                    required
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder={t.form.email}
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full p-3 rounded bg-white text-gray-800"
                    required
                  />
                  <input
                    type="tel"
                    name="phone"
                    placeholder={t.form.phone}
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full p-3 rounded bg-white text-gray-800"
                  />
                  <textarea
                    name="message"
                    placeholder={t.form.message}
                    value={formData.message}
                    onChange={handleInputChange}
                    className="w-full p-3 rounded bg-white text-gray-800"
                    rows="4"
                    required
                  ></textarea>
                  <button
                    type="submit"
                    className="w-full bg-[#006667] text-white py-3 rounded-lg hover:bg-white hover:text-[#006667] transition"
                  >
                    {t.form.send}
                  </button>
                  <a
                    href="https://wa.me/376650042"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg text-center font-semibold transition"
                  >
                    {t.whatsapp}
                  </a>
                </form>
                {formSubmitted && (
                  <p className="text-green-200 font-semibold text-center">{t.form.success}</p>
                )}
              </div>
            </div>
          </section>

          {/* Nota Legal */}
          <section id="legal" className="py-16 bg-gray-100">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-3xl font-bold mb-8">{t.legal}</h2>
              <div className="flex flex-wrap justify-center gap-6">
                {Object.keys(t.legalTabs).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      const win = window.open("", "_blank");
                      win.document.write(`
                        <!DOCTYPE html>
                        <html lang="${language}">
                        <head>
                          <meta charset="UTF-8" />
                          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                          <title>${t.legalTabs[key]} - ÀMBIT Associats</title>
                          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                          <style>
                            body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; padding: 2rem; }
                            h3, h4 { color: #009B9C; }
                            a { color: #009B9C; text-decoration: underline; }
                            .container { max-width: 900px; margin: 0 auto; }
                          </style>
                        </head>
                        <body>
                          <div class="container">
                            ${legalTexts[language][key]}
                            <p><br><a href="javascript:window.close()" style="color:#006667">Tancar aquesta finestra</a></p>
                          </div>
                        </body>
                        </html>
                      `);
                      win.document.close();
                    }}
                    className="text-[#009B9C] hover:underline text-lg font-medium"
                  >
                    {t.legalTabs[key]}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : (
        /* Vista detallada del servei */
        <section className="py-16 flex-1">
          <div className="container mx-auto px-4">
            <button
              onClick={goBack}
              className="mb-6 text-[#009B9C] hover:underline flex items-center"
            >
              ← {t.back}
            </button>
            <h2 className="text-3xl font-bold mb-8 text-[#009B9C]">{details[currentService].title}</h2>
            <ul className="space-y-3">
              {details[currentService].items.map((item, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-[#009B9C] mr-2">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-6 text-center text-sm">
        <div className="container mx-auto px-4">
          <p>{t.footer}</p>
        </div>
      </footer>
    </div>
  );
};

export default App;