import React, { useState } from "react";
import { motion } from "framer-motion";
import izquierdaImg from './izquierda.png';
import derechaImg from './derecha.png';
import legalBottomLeftImg from './legal-bottom-left.png';
import legalBottomRightImg from './legal-bottom-right.png';
import IrpfCalculadora from './irpf/IrpfCalculadora';


// Logo – més gran i centrat
const Logo = () => (
  <img
  src="/ÀMBIT Associats.png"
  alt="ÀMBIT Associats"
  className="h-32 md:h-40 mx-auto mb-2 rounded-xl"
/>
);

// Selector d'idiomes
const languages = [
  { code: "ca", name: "Català" },
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
];

// Traduccions
const translations = {
  // Actualització manual per forçar desplegament a Vercel
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
    irpfBanner: {
      badge: "Eina gratuïta",
      title: "Calculadora IRPF Andorra 2025",
      desc: "Calcula la teva quota de l'Impost sobre la Renda de les Persones Físiques d'Andorra de forma ràpida i precisa, seguint la Llei 5/2014 i la Guia pràctica 2025.",
      features: ["Tipus únic del 10%", "Mínim personal i familiar", "Informe 300-L"],
      cta: "Obrir la calculadora",
    },
    form: {
      name: "Nom",
      email: "Correu electrònic",
      phone: "Telèfon",
      message: "Missatge",
      send: "Enviar missatge",
      success: "Missatge enviat. T'hi respondrem aviat.",
    },
    blogTitle: "Recursos i articles",
    seoTitle: "Assessoria fiscal i IRPF a Andorra",
    professionals: {
      badge: "Accés exclusiu",
      title: "Zona Professionals",
      subtitle: "Eines avançades per a professionals de la gestió empresarial a Andorra",
      bretxaTitle: "Bretxa Professional de Gènere",
      bretxaDesc: "Calcula i genera l'informe de la bretxa salarial de gènere de la teva empresa segons la Llei 6/2022 d'Andorra.",
      bretxaCta: "Accedir a l'eina",
      fiscalTitle: "Eina Fiscal Empresarial",
      fiscalDesc: "Gestió d'obligacions fiscals, liquidacions d'IGI i Impost de Societats per a empreses andorranes.",
      fiscalCta: "Pròximament",
      available: "Disponible",
      comingSoon: "Pròximament",
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
    irpfBanner: {
      badge: "Herramienta gratuita",
      title: "Calculadora IRPF Andorra 2025",
      desc: "Calcula tu cuota del Impuesto sobre la Renta de las Personas Físicas de Andorra de forma rápida y precisa, siguiendo la Ley 5/2014 y la Guía práctica 2025.",
      features: ["Tipo único del 10%", "Mínimo personal y familiar", "Informe 300-L"],
      cta: "Abrir la calculadora",
    },
    form: {
      name: "Nombre",
      email: "Correo electrónico",
      phone: "Teléfono",
      message: "Mensaje",
      send: "Enviar mensaje",
      success: "Mensaje enviado. Te responderemos pronto.",
    },
    blogTitle: "Recursos y artículos",
    seoTitle: "Asesoría fiscal e IRPF en Andorra",
    professionals: {
      badge: "Acceso exclusivo",
      title: "Zona Profesionales",
      subtitle: "Herramientas avanzadas para profesionales de la gestión empresarial en Andorra",
      bretxaTitle: "Brecha Profesional de Género",
      bretxaDesc: "Calcula y genera el informe de la brecha salarial de género de tu empresa según la Ley 6/2022 de Andorra.",
      bretxaCta: "Acceder a la herramienta",
      fiscalTitle: "Herramienta Fiscal Empresarial",
      fiscalDesc: "Gestión de obligaciones fiscales, liquidaciones de IGI e Impuesto de Sociedades para empresas andorranas.",
      fiscalCta: "Próximamente",
      available: "Disponible",
      comingSoon: "Próximamente",
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
    irpfBanner: {
      badge: "Free tool",
      title: "Andorra IRPF Calculator 2025",
      desc: "Calculate your Andorran personal income tax liability quickly and accurately, following Law 5/2014 and the 2025 Practical Guide.",
      features: ["Flat rate of 10%", "Personal & family allowances", "Form 300-L report"],
      cta: "Open the calculator",
    },
    form: {
      name: "Name",
      email: "Email",
      phone: "Phone",
      message: "Message",
      send: "Send message",
      success: "Message sent. We'll get back to you soon!",
    },
    blogTitle: "Resources and articles",
    seoTitle: "Tax advisory and IRPF in Andorra",
    professionals: {
      badge: "Exclusive access",
      title: "Professional Area",
      subtitle: "Advanced tools for business management professionals in Andorra",
      bretxaTitle: "Gender Pay Gap Tool",
      bretxaDesc: "Calculate and generate the gender pay gap report for your company according to Andorra's Law 6/2022.",
      bretxaCta: "Access the tool",
      fiscalTitle: "Business Tax Tool",
      fiscalDesc: "Management of tax obligations, IGI settlements and Corporation Tax for Andorran companies.",
      fiscalCta: "Coming soon",
      available: "Available",
      comingSoon: "Coming soon",
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
    irpfBanner: {
      badge: "Outil gratuit",
      title: "Calculatrice IRPF Andorre 2025",
      desc: "Calculez votre impôt sur le revenu des personnes physiques en Andorre rapidement et avec précision, selon la Loi 5/2014 et le Guide pratique 2025.",
      features: ["Taux unique de 10%", "Minimum personnel et familial", "Rapport 300-L"],
      cta: "Ouvrir la calculatrice",
    },
    form: {
      name: "Nom",
      email: "Email",
      phone: "Téléphone",
      message: "Message",
      send: "Envoyer le message",
      success: "Message envoyé. Nous vous répondrons bientôt !",
    },
    blogTitle: "Ressources et articles",
    seoTitle: "Conseil fiscal et IRPF en Andorre",
    professionals: {
      badge: "Accès exclusif",
      title: "Espace Professionnels",
      subtitle: "Outils avancés pour les professionnels de la gestion d'entreprise en Andorre",
      bretxaTitle: "Écart de rémunération Femmes-Hommes",
      bretxaDesc: "Calculez et générez le rapport sur l'écart de rémunération de votre entreprise selon la Loi 6/2022 d'Andorre.",
      bretxaCta: "Accéder à l'outil",
      fiscalTitle: "Outil Fiscal Entreprises",
      fiscalDesc: "Gestion des obligations fiscales, liquidations IGI et Impôt sur les sociétés pour les entreprises andorranes.",
      fiscalCta: "Prochainement",
      available: "Disponible",
      comingSoon: "Prochainement",
    },
  },
};

// Contingut legal actualitzat amb Llei 29/2021 i Llei 35/2014
const legalContent = {
  ca: {
    aviso: `
      <h3>Avís legal</h3>
      <p>En compliment del que disposa la <strong>Llei 35/2014, de 27 de novembre, de certificació i confiança electrònica del Principat d’Andorra</strong>, així com la normativa europea aplicable en matèria de protecció de dades i comerç electrònic, es posa a disposició dels usuaris la següent informació legal corresponent al titular del lloc web:</p>

      <h4>Dades identificatives del titular</h4>
      <p><strong>Nom o raó social:</strong> DEL SOTO – PALEARI & Associats, S.L.</p>
      <p><strong>NRT:</strong> L-720543-P</p>
      <p><strong>Domicili social:</strong> Av. Fiter i Rossell, núm. 78, Edifici Carlemany, 2n B, Escaldes-Engordany (Principat d’Andorra)</p>
      <p><strong>Telèfon de contacte:</strong> +376 650 042</p>
      <p><strong>Correu electrònic de contacte:</strong> <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a></p>
      <p><strong>Nom de domini:</strong> www.ambit.ad</p>

      <h4>Condicions d’ús</h4>
      <p>L’accés i ús del lloc web www.ambit.ad atribueix la condició d’usuari i implica l’acceptació plena i sense reserves de les presents condicions d’ús, sense perjudici de les condicions particulars que poguessin aplicar-se a determinats serveis concrets.</p>
      <p>L’usuari es compromet a fer un ús adequat dels continguts i serveis del lloc web, abstenint-se de realitzar activitats il·lícites o contràries a la bona fe, a l’ordre públic o als drets de tercers.</p>
      <p>DEL SOTO – PALEARI & Associats, S.L. es reserva el dret de modificar en qualsevol moment i sense previ avís la present informació legal, així com la configuració, presentació i contingut del lloc web.</p>

      <h4>Propietat intel·lectual i industrial</h4>
      <p>Tots els continguts d’aquest lloc web (textos, imatges, logotips, marques, estructures, dissenys, etc.) són titularitat de DEL SOTO – PALEARI & Associats, S.L. o de tercers que n’han autoritzat l’ús, i estan protegits per la normativa andorrana i internacional sobre propietat intel·lectual i industrial.</p>
      <p>Queda prohibida la reproducció, distribució, comunicació pública o transformació d’aquests continguts sense l’autorització expressa i per escrit del titular.</p>

      <h4>Protecció de dades personals</h4>
      <p>Les dades personals recollides a través d’aquest lloc web seran tractades d’acord amb la <strong>Llei 29/2021, del 28 d’octubre, qualificada de protecció de dades personals del Principat d’Andorra</strong>, i en compliment del <strong>Reglament (UE) 2016/679</strong> del Parlament Europeu i del Consell (RGPD).</p>
      <p>Per a més informació sobre el tractament de dades, els drets dels usuaris i les finalitats concretes, podeu consultar la Política de privacitat.</p>

      <h4>Exclusió de responsabilitat</h4>
      <p>DEL SOTO – PALEARI & Associats, S.L. no es responsabilitza dels danys o perjudicis que es puguin derivar de l’accés, ús o mala utilització dels continguts del lloc web, ni tampoc dels errors o omissions que poguessin existir.</p>
      <p>Aquest lloc web pot contenir enllaços a pàgines externes sobre les quals no es té cap control, i per tant DEL SOTO – PALEARI & Associats, S.L. no assumeix cap responsabilitat sobre el seu contingut, funcionament o disponibilitat.</p>

      <h4>Legislació i jurisdicció aplicables</h4>
      <p>Aquest lloc web, les seves condicions d’ús i les relacions entre l’usuari i el titular es regeixen per la legislació vigent del Principat d’Andorra.</p>
      <p>Per a qualsevol controvèrsia que pogués sorgir en relació amb l’accés o ús d’aquest lloc web, ambdues parts se sotmeten expressament a la jurisdicció dels tribunals andorrans, amb renúncia a qualsevol altre fur que els pogués correspondre.</p>
    `,
    privacidad: `
      <h3>Política de privacitat</h3>
      <p>En compliment de la <strong>Llei 29/2021</strong>, del 28 d’octubre, qualificada de protecció de dades personals del Principat d’Andorra, i en virtut del <strong>Reglament (UE) 2016/679</strong> (RGPD), informem que les dades personals recollides a través d’aquest lloc web es tractaran amb la finalitat de gestionar la seva consulta, mantenir una relació professional i, si escau, enviar informació sobre serveis relacionats.</p>
      <p>El fundamento del tractament és el consentiment del titular. Les dades es conservaran durant el temps necessari per atendre la sol·licitud i, posteriorment, durant els terminis exigits per la normativa fiscal, comptable i administrativa.</p>
      <p>Podeu exercir els drets d'accés, rectificació, supressió, limitació del tractament, oposició i portabilitat enviant un correu electrònic a <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a>.</p>
      <p>Les dades no es cediran a tercers fora del Principat d’Andorra, llevat de col·laboradors professionals amb els quals es manté un acord de confidencialitat i necessaris per al correcte desenvolupament del servei.</p>
      <p>Implementem mesures tècniques i organitzatives per garantir la seguretat de les dades i prevenir el seu tractament il·lícit, pèrdua, alteració, divulgació o accés no autoritzat.</p>
    `,
    cookies: `
      <h3>Política de cookies</h3>
      <p>En virtut de la <strong>Llei 29/2021</strong>, de 23 de desembre, de serveis de la societat de la informació i comerç electrònic, informem que aquest lloc web utilitza <strong>cookies tècniques</strong> necessàries per al correcte funcionament del lloc (com ara gestió de sessió i preferències).</p>
      <p>No utilitzem cookies de rastreig, publicitàries ni de tercers. Les cookies són fitxers petits que el navegador emmagatzema per millorar l'experiència d'usuari.</p>
      <p>Podeu gestionar o desactivar les cookies des del vostre navegador en qualsevol moment. La negació de cookies tècniques pot afectar el correcte funcionament de la web.</p>
    `,
  },
  es: {
    aviso: `
      <h3>Aviso legal</h3>
      <p>En cumplimiento de lo dispuesto por la <strong>Ley 35/2014, de 27 de noviembre, de certificación y confianza electrónica del Principado de Andorra</strong>, así como la normativa europea aplicable en materia de protección de datos y comercio electrónico, se pone a disposición de los usuarios la siguiente información legal correspondiente al titular del sitio web:</p>

      <h4>Datos identificativos del titular</h4>
      <p><strong>Nombre o razón social:</strong> DEL SOTO – PALEARI & Associats, S.L.</p>
      <p><strong>NRT:</strong> L-720543-P</p>
      <p><strong>Domicilio social:</strong> Av. Fiter i Rossell, núm. 78, Edificio Carlemany, 2n B, Escaldes-Engordany (Principado de Andorra)</p>
      <p><strong>Teléfono de contacto:</strong> +376 650 042</p>
      <p><strong>Correo electrónico de contacto:</strong> <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a></p>
      <p><strong>Nombre de dominio:</strong> www.ambit.ad</p>

      <h4>Condiciones de uso</h4>
      <p>El acceso y uso del sitio web www.ambit.ad atribuye la condición de usuario e implica la aceptación plena y sin reservas de las presentes condiciones de uso, sin perjuicio de las condiciones particulares que pudieran aplicarse a determinados servicios concretos.</p>
      <p>El usuario se compromete a hacer un uso adecuado de los contenidos y servicios del sitio web, absteniéndose de realizar actividades ilícitas o contrarias a la buena fe, al orden público o a los derechos de terceros.</p>
      <p>DEL SOTO – PALEARI & Associats, S.L. se reserva el derecho de modificar en cualquier momento y sin previo aviso la presente información legal, así como la configuración, presentación y contenido del sitio web.</p>

      <h4>Propiedad intelectual e industrial</h4>
      <p>Todos los contenidos de este sitio web (textos, imágenes, logotipos, marcas, estructuras, diseños, etc.) son titularidad de DEL SOTO – PALEARI & Associats, S.L. o de terceros que han autorizado su uso, y están protegidos por la normativa andorrana e internacional sobre propiedad intelectual e industrial.</p>
      <p>Queda prohibida la reproducción, distribución, comunicación pública o transformación de estos contenidos sin la autorización expresa y por escrito del titular.</p>

      <h4>Protección de datos personales</h4>
      <p>Los datos personales recogidos a través de este sitio web serán tratados de acuerdo con la <strong>Ley 29/2021, del 28 de octubre, calificada de protección de datos personales del Principado de Andorra</strong>, y en cumplimiento del <strong>Reglamento (UE) 2016/679</strong> del Parlamento Europeo y del Consejo (RGPD).</p>
      <p>Para más información sobre el tratamiento de datos, los derechos de los usuarios y las finalidades concretas, puede consultar la Política de privacidad.</p>

      <h4>Exclusión de responsabilidad</h4>
      <p>DEL SOTO – PALEARI & Associats, S.L. no se responsabiliza de los daños o perjuicios que puedan derivarse del acceso, uso o mala utilización de los contenidos del sitio web, ni tampoco de los errores u omisiones que pudieran existir.</p>
      <p>Este sitio web puede contener enlaces a páginas externas sobre las que no se tiene ningún control, y por tanto DEL SOTO – PALEARI & Associats, S.L. no asume ninguna responsabilidad sobre su contenido, funcionamiento o disponibilidad.</p>

      <h4>Legislación y jurisdicción aplicables</h4>
      <p>Este sitio web, sus condiciones de uso y las relaciones entre el usuario y el titular se rigen por la legislación vigente del Principado de Andorra.</p>
      <p>Para cualquier controversia que pudiera surgir en relación con el acceso o uso de este sitio web, ambas partes se someten expresamente a la jurisdicción de los tribunales andorranos, con renuncia a cualquier otro fuero que les pudiera corresponder.</p>
    `,
    privacidad: `
      <h3>Política de privacidad</h3>
      <p>En cumplimiento de la <strong>Ley 29/2021</strong>, del 28 de octubre, calificada de protección de datos personales del Principado de Andorra, y en virtud del <strong>Reglamento (UE) 2016/679</strong> (RGPD), informamos que los datos personales recogidos a través de este sitio web se tratarán con la finalidad de gestionar su consulta, mantener una relación profesional y, en su caso, enviar información sobre servicios relacionados.</p>
      <p>El fundamento del tratamiento es el consentimiento del titular. Los datos se conservarán durante el tiempo necesario para atender la solicitud y, posteriormente, durante los plazos exigidos por la normativa fiscal, contable y administrativa.</p>
      <p>Puede ejercer los derechos de acceso, rectificación, supresión, limitación del tratamiento, oposición y portabilidad enviando un correo electrónico a <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a>.</p>
      <p>Los datos no se cederán a terceros fuera del Principado de Andorra, salvo colaboradores profesionales con los que se mantiene un acuerdo de confidencialidad y necesarios para el correcto desarrollo del servicio.</p>
      <p>Implementamos medidas técnicas y organizativas para garantizar la seguridad de los datos y prevenir su tratamiento ilícito, pérdida, alteración, divulgación o acceso no autorizado.</p>
    `,
    cookies: `
      <h3>Política de cookies</h3>
      <p>En virtud de la <strong>Ley 29/2021</strong>, de 23 de diciembre, de servicios de la sociedad de la información y comercio electrónico, informamos que este sitio web utiliza <strong>cookies técnicas</strong> necesarias para el correcto funcionamiento del sitio (como gestión de sesión y preferencias).</p>
      <p>No utilizamos cookies de seguimiento, publicitarias ni de terceros. Las cookies son archivos pequeños que el navegador almacena para mejorar la experiencia de usuario.</p>
      <p>Puede gestionar o desactivar las cookies desde su navegador en cualquier momento. La negación de cookies técnicas puede afectar al correcto funcionamiento de la web.</p>
    `,
  },
  en: {
    aviso: `
      <h3>Legal notice</h3>
      <p>In compliance with <strong>Law 35/2014, of 27 November, on electronic certification and trust in the Principality of Andorra</strong>, as well as applicable European regulations on data protection and electronic commerce, the following legal information regarding the website owner is provided to users:</p>

      <h4>Identifying details of the owner</h4>
      <p><strong>Name or legal entity:</strong> DEL SOTO – PALEARI & Associats, S.L.</p>
      <p><strong>NRT:</strong> L-720543-P</p>
      <p><strong>Registered office:</strong> Av. Fiter i Rossell, No. 78, Edifici Carlemany, 2n B, Escaldes-Engordany (Principality of Andorra)</p>
      <p><strong>Contact phone:</strong> +376 650 042</p>
      <p><strong>Contact email:</strong> <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a></p>
      <p><strong>Domain name:</strong> www.ambit.ad</p>

      <h4>Terms of use</h4>
      <p>Accessing and using the website www.ambit.ad grants you the status of user and implies full and unconditional acceptance of these terms of use, without prejudice to specific conditions that may apply to particular services.</p>
      <p>The user agrees to use the website's contents and services appropriately, refraining from carrying out illegal activities or those contrary to good faith, public order, or third-party rights.</p>
      <p>DEL SOTO – PALEARI & Associats, S.L. reserves the right to modify this legal information, as well as the website's configuration, presentation, and content, at any time and without prior notice.</p>

      <h4>Intellectual and industrial property</h4>
      <p>All content on this website (texts, images, logos, trademarks, structures, designs, etc.) is owned by DEL SOTO – PALEARI & Associats, S.L. or third parties who have authorized its use, and is protected by Andorran and international intellectual and industrial property laws.</p>
      <p>Reproduction, distribution, public communication, or transformation of this content is prohibited without the express written authorization of the owner.</p>

      <h4>Personal data protection</h4>
      <p>Personal data collected through this website will be processed in accordance with <strong>Law 29/2021, of 28 October, on personal data protection in the Principality of Andorra</strong>, and in compliance with the <strong>General Data Protection Regulation (GDPR) (EU) 2016/679</strong>.</p>
      <p>For more information on data processing, user rights, and specific purposes, please consult the Privacy Policy.</p>

      <h4>Liability disclaimer</h4>
      <p>DEL SOTO – PALEARI & Associats, S.L. is not liable for any damages or losses arising from access, use, or misuse of the website's content, nor for any errors or omissions that may exist.</p>
      <p>This website may contain links to external pages over which no control is exercised, and therefore DEL SOTO – PALEARI & Associats, S.L. assumes no responsibility for their content, operation, or availability.</p>

      <h4>Governing law and jurisdiction</h4>
      <p>This website, its terms of use, and the relationship between the user and the owner are governed by the laws of the Principality of Andorra.</p>
      <p>Any dispute arising in connection with access or use of this website shall be subject to the jurisdiction of the Andorran courts, with express waiver of any other jurisdiction that may apply.</p>
    `,
    privacidad: `
      <h3>Privacy policy</h3>
      <p>In compliance with <strong>Law 29/2021</strong>, of 28 October, on personal data protection in the Principality of Andorra, and under the <strong>General Data Protection Regulation (GDPR) (EU) 2016/679</strong>, we inform you that personal data collected through this website will be processed to manage your inquiry, maintain a professional relationship, and, if applicable, send information about related services.</p>
      <p>The legal basis for processing is your consent. Data will be kept for the time necessary to address your request and subsequently for the periods required by tax, accounting, and administrative regulations.</p>
      <p>You may exercise your rights of access, rectification, erasure, restriction of processing, objection, and data portability by sending an email to <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a>.</p>
      <p>Data will not be shared with third parties outside the Principality of Andorra, except with professional collaborators bound by confidentiality agreements and necessary for service delivery.</p>
      <p>We implement technical and organizational measures to ensure data security and prevent unlawful processing, loss, alteration, disclosure, or unauthorized access.</p>
    `,
    cookies: `
      <h3>Cookie policy</h3>
      <p>In accordance with <strong>Law 29/2021</strong>, of 23 December, on information society services and electronic commerce, we inform you that this website uses <strong>technical cookies</strong> essential for its proper functioning (such as session management and preferences).</p>
      <p>We do not use tracking, advertising, or third-party cookies. Cookies are small files stored by your browser to enhance user experience.</p>
      <p>You can manage or disable cookies through your browser settings at any time. Disabling technical cookies may affect the website's functionality.</p>
    `,
  },
  fr: {
    aviso: `
      <h3>Avis légal</h3>
      <p>Conformément à la <strong>Loi 35/2014, du 27 novembre, relative à la certification et à la confiance électroniques au sein du Principauté d’Andorre</strong>, ainsi qu'à la réglementation européenne applicable en matière de protection des données et de commerce électronique, les informations juridiques suivantes concernant le propriétaire du site web sont mises à disposition des utilisateurs :</p>

      <h4>Coordonnées du propriétaire</h4>
      <p><strong>Nom ou raison sociale :</strong> DEL SOTO – PALEARI & Associats, S.L.</p>
      <p><strong>NRT :</strong> L-720543-P</p>
      <p><strong>Siège social :</strong> Av. Fiter i Rossell, n° 78, Édifice Carlemany, 2e B, Escaldes-Engordany (Principauté d’Andorre)</p>
      <p><strong>Téléphone de contact :</strong> +376 650 042</p>
      <p><strong>Adresse e-mail :</strong> <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a></p>
      <p><strong>Nom de domaine :</strong> www.ambit.ad</p>

      <h4>Conditions d'utilisation</h4>
      <p>L'accès et l'utilisation du site web www.ambit.ad attribuent la qualité d'utilisateur et impliquent l'acceptation pleine et entière des présentes conditions d'utilisation, sans préjudice des conditions particulières pouvant s'appliquer à certains services spécifiques.</p>
      <p>L'utilisateur s'engage à faire un usage adéquat des contenus et services du site web, en s'abstenant de toute activité illégale ou contraire à la bonne foi, à l'ordre public ou aux droits de tiers.</p>
      <p>DEL SOTO – PALEARI & Associats, S.L. se réserve le droit de modifier à tout moment et sans préavis la présente information juridique, ainsi que la configuration, la présentation et le contenu du site web.</p>

      <h4>Propriété intellectuelle et industrielle</h4>
      <p>Tous les contenus de ce site web (textes, images, logos, marques, structures, designs, etc.) sont la propriété de DEL SOTO – PALEARI & Associats, S.L. ou de tiers ayant autorisé leur utilisation, et sont protégés par la législation andorrane et internationale en matière de propriété intellectuelle et industrielle.</p>
      <p>Toute reproduction, distribution, communication publique ou transformation de ces contenus est interdite sans l'autorisation expresse et écrite du titulaire.</p>

      <h4>Protection des données personnelles</h4>
      <p>Les données personnelles collectées via ce site web seront traitées conformément à la <strong>Loi 29/2021, du 28 octobre, relative à la protection des données à caractère personnel au sein du Principauté d’Andorre</strong>, et en application du <strong>Règlement (UE) 2016/679</strong> du Parlement européen et du Conseil (RGPD).</p>
      <p>Pour plus d'informations sur le traitement des données, les droits des utilisateurs et les finalités spécifiques, veuillez consulter la Politique de confidentialité.</p>

      <h4>Exclusion de responsabilité</h4>
      <p>DEL SOTO – PALEARI & Associats, S.L. n'est pas responsable des dommages ou préjudices pouvant découler de l'accès, de l'utilisation ou d'une mauvaise utilisation des contenus du site web, ni des erreurs ou omissions éventuelles.</p>
      <p>Ce site web peut contenir des liens vers des pages externes sur lesquelles aucun contrôle n'est exercé, et par conséquent DEL SOTO – PALEARI & Associats, S.L. n'assume aucune responsabilité quant à leur contenu, leur fonctionnement ou leur disponibilité.</p>

      <h4>Droit applicable et juridiction</h4>
      <p>Le présent site web, ses conditions d'utilisation et les relations entre l'utilisateur et le propriétaire sont régis par la législation en vigueur au sein du Principauté d’Andorre.</p>
      <p>Toute contestation relative à l'accès ou à l'utilisation de ce site web sera soumise à la juridiction exclusive des tribunaux andorrans, avec renonciation expresse à tout autre droit de juridiction.</p>
    `,
    privacidad: `
      <h3>Politique de confidentialité</h3>
      <p>Conformément à la <strong>Loi 29/2021</strong>, du 28 octobre, relative à la protection des données à caractère personnel au sein du Principauté d’Andorre, et en vertu du <strong>Règlement (UE) 2016/679</strong> (RGPD), nous informons que les données personnelles collectées via ce site web seront traitées afin de gérer votre demande, maintenir une relation professionnelle et, le cas échéant, vous envoyer des informations sur des services connexes.</p>
      <p>La base légale du traitement est votre consentement. Les données seront conservées pendant la durée nécessaire à l’analyse de votre demande, puis conformément aux délais imposés par la réglementation fiscale, comptable et administrative.</p>
      <p>Vous pouvez exercer vos droits d'accès, de rectification, d'effacement, de limitation du traitement, d'opposition et de portabilité en envoyant un e-mail à <a href="mailto:info@ambit.ad" style="color:#009B9C">info@ambit.ad</a>.</p>
      <p>Les données ne seront pas transférées à des tiers en dehors du Principauté d’Andorre, sauf aux collaborateurs professionnels liés par un accord de confidentialité et nécessaires à la prestation du service.</p>
      <p>Nous mettons en œuvre des mesures techniques et organisationnelles pour garantir la sécurité des données et prévenir tout traitement illicite, perte, altération, divulgation ou accès non autorisé.</p>
    `,
    cookies: `
      <h3>Politique de cookies</h3>
      <p>Conformément à la <strong>Loi 29/2021</strong>, du 23 décembre, relative aux services de la société de l'information et au commerce électronique, nous informons que ce site web utilise des <strong>cookies techniques</strong> nécessaires à son bon fonctionnement (gestion de session, préférences, etc.).</p>
      <p>Nous n'utilisons pas de cookies de suivi, publicitaires ou de tiers. Les cookies sont de petits fichiers stockés par votre navigateur pour améliorer votre expérience utilisateur.</p>
      <p>Vous pouvez gérer ou désactiver les cookies via les paramètres de votre navigateur à tout moment. Le refus des cookies techniques peut affecter le bon fonctionnement du site.</p>
    `,
  }
};

// Serveis
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

// ── Blog posts (SEO) ─────────────────────────────────────────────────────────
const blogPosts = {
  es: [
    {
      slug: "irpf-andorra-2025",
      title: "Guía completa del IRPF en Andorra 2025",
      category: "IRPF",
      date: "Mayo 2025",
      excerpt: "Todo lo que necesitas saber sobre el impuesto sobre la renta en Andorra: tramos, plazos, reducciones y cómo presentar la declaración.",
      content: `<h2>El IRPF en Andorra: guía completa 2025</h2><p>El Impuesto sobre la Renta de las Personas Físicas (IRPF) en Andorra grava los ingresos obtenidos por los residentes fiscales en el Principado. Con un tipo máximo del <strong>10%</strong>, es uno de los más bajos de Europa.</p><h3>¿Quién tiene que declarar?</h3><p>Están obligados a presentar la declaración del IRPF en Andorra las personas físicas que hayan residido en Andorra más de 183 días durante el año natural, o que tengan en Andorra el núcleo principal de sus actividades económicas o intereses patrimoniales.</p><h3>Tramos y tipos impositivos</h3><p>El IRPF andorrano aplica un sistema progresivo: los primeros 24.000 € están exentos (tipo 0%), de 24.001 € a 40.000 € se aplica el 5% efectivo, y a partir de 40.000 € el tipo es del 10%. Además, existe una bonificación del Art. 46 de hasta 800 € anuales.</p><h3>Plazos de presentación</h3><p>La declaración del IRPF correspondiente al ejercicio 2025 debe presentarse entre el <strong>1 de abril y el 30 de septiembre de 2026</strong> telemáticamente en <a href="https://www.e-tramits.ad" target="_blank" rel="noopener noreferrer">e-tramits.ad</a>.</p><h3>Principales reducciones</h3><p>El mínimo personal exento es de 24.000 € (40.000 € si el cónyuge está a cargo y 30.000 € con discapacidad reconocida). Adicionalmente, existen reducciones familiares de 1.000 € por descendiente, reducción del 50% de las cuotas hipotecarias (máx. 5.000 €/año) y aportaciones a planes de pensiones (máx. 5.000 €/año).</p><p>En <strong>ÀMBIT Associats</strong> te ayudamos a preparar tu declaración del IRPF en Andorra con total seguridad y sin errores. Contacta con nosotros.</p>`
    },
    {
      slug: "autonomos-irpf-andorra",
      title: "Autónomos e IRPF en Andorra: actividades económicas y deducciones",
      category: "Autónomos",
      date: "Abril 2025",
      excerpt: "Si eres autónomo en Andorra, descubre cómo tributan tus actividades económicas en el IRPF: gastos deducibles, métodos de determinación y el formulario 300-C.",
      content: `<h2>Autónomos e IRPF en Andorra</h2><p>Los autónomos y profesionales que ejercen actividades económicas en Andorra deben declarar sus rentas empresariales o profesionales en el IRPF. La renta neta se calcula como ingresos menos gastos fiscalmente deducibles.</p><h3>Gastos deducibles para autónomos en Andorra</h3><p>Los principales gastos deducibles incluyen: consumo de mercaderías y materiales, gastos de personal, amortizaciones, arrendamientos y cánones, suministros, servicios exteriores (asesoría, publicidad) y gastos financieros directamente vinculados a la actividad.</p><h3>Métodos de determinación</h3><p>El método habitual es la <strong>determinación directa</strong>: ingresos reales menos gastos reales justificados con factura. También existe la estimación objetiva para ciertas actividades, donde la renta se determina por módulos.</p><h3>Pagament fraccionat</h3><p>Los autónomos y empresarios deben efectuar un <strong>pago fraccionado en septiembre</strong> equivalente al 50% de la cuota de liquidación del ejercicio anterior.</p><p>En <strong>ÀMBIT Associats</strong> gestionamos la contabilidad y la declaración del IRPF de autónomos y empresarios en Andorra. Contacta con nosotros.</p>`
    },
    {
      slug: "declaracion-irpf-andorra-2026",
      title: "Cómo hacer la declaración del IRPF en Andorra 2026: guía paso a paso",
      category: "Declaración",
      date: "Marzo 2025",
      excerpt: "Guía práctica para presentar la declaración del IRPF 2025 en el Portal Tributario de Andorra. Plazos, formularios y errores más comunes.",
      content: `<h2>Declaración del IRPF en Andorra 2026</h2><p>La campaña del IRPF correspondiente al ejercicio fiscal 2025 se desarrolla entre el <strong>1 de abril y el 30 de septiembre de 2026</strong>. Se presenta obligatoriamente de forma telemática en el Portal Tributario del Gobierno de Andorra (<a href="https://www.e-tramits.ad" target="_blank" rel="noopener noreferrer">e-tramits.ad</a>).</p><h3>Formularios necesarios</h3><p>El formulario principal es el <strong>300 (declaración general) y el 300-L (liquidació)</strong>. Según tu situación, puede ser necesario también: 300-A (situación personal y familiar), 300-B (rentas del trabajo e inmobiliarias), 300-C (actividades económicas), 300-D (capital mobiliario) y 300-E (ganancias y pérdidas de capital).</p><h3>Errores más comunes</h3><p>Los errores más frecuentes son: no aplicar correctamente el mínimo personal cuando el cónyuge está a cargo (40.000 € en lugar de 24.000 €), olvidar la deducción del impuesto comunal sobre arrendamientos (Art. 47), y no incluir las reducciones por hijos u otros dependientes a cargo.</p><p>En <strong>ÀMBIT Associats</strong> preparamos y presentamos tu declaración del IRPF en Andorra garantizando el máximo ahorro fiscal dentro de la legalidad. Contacta con nosotros.</p>`
    },
  ],
  ca: [
    {
      slug: "irpf-andorra-2025",
      title: "Guia completa de l'IRPF a Andorra 2025",
      category: "IRPF",
      date: "Maig 2025",
      excerpt: "Tot el que has de saber sobre l'impost sobre la renda a Andorra: trams, terminis, reduccions i com presentar la declaració.",
      content: `<h2>L'IRPF a Andorra: guia completa 2025</h2><p>L'Impost sobre la Renda de les Persones Físiques (IRPF) a Andorra grava les rendes obtingudes pels residents fiscals al Principat. Amb un tipus màxim del <strong>10%</strong>, és un dels més baixos d'Europa.</p><h3>Qui ha de declarar?</h3><p>Estan obligades a presentar la declaració de l'IRPF a Andorra les persones físiques que hagin residit al Principat més de 183 dies durant l'any natural, o que tinguin a Andorra el nucli principal de les seves activitats econòmiques o interessos patrimonials.</p><h3>Trams i tipus impositius</h3><p>L'IRPF andorrà aplica un sistema progressiu: els primers 24.000 € estan exempts (tipus 0%), de 24.001 € a 40.000 € s'aplica el 5% efectiu, i a partir de 40.000 € el tipus és del 10%. A més, existeix una bonificació de l'Art. 46 de fins a 800 € anuals.</p><h3>Terminis de presentació</h3><p>La declaració de l'IRPF corresponent a l'exercici 2025 s'ha de presentar entre l'<strong>1 d'abril i el 30 de setembre del 2026</strong> telemàticament a <a href="https://www.e-tramits.ad" target="_blank" rel="noopener noreferrer">e-tramits.ad</a>.</p><h3>Principals reduccions</h3><p>El mínim personal exempt és de 24.000 € (40.000 € si el cònjuge és a càrrec i 30.000 € amb discapacitat reconeguda). A més, hi ha reduccions familiars de 1.000 € per descendent, reducció del 50% de les quotes hipotecàries (màx. 5.000 €/any) i aportacions a plans de pensions (màx. 5.000 €/any).</p><p>A <strong>ÀMBIT Associats</strong> t'ajudem a preparar la teva declaració de l'IRPF a Andorra amb total seguretat i sense errors. Contacta'ns.</p>`
    },
    {
      slug: "autonomos-irpf-andorra",
      title: "Autònoms i IRPF a Andorra: activitats econòmiques i deduccions",
      category: "Autònoms",
      date: "Abril 2025",
      excerpt: "Si ets autònom a Andorra, descobreix com tributen les teves activitats econòmiques a l'IRPF: despeses deduïbles, mètodes de determinació i el formulari 300-C.",
      content: `<h2>Autònoms i IRPF a Andorra</h2><p>Els autònoms i professionals que exerceixen activitats econòmiques a Andorra han de declarar les seves rendes empresarials o professionals a l'IRPF. La renda neta es calcula com a ingressos menys despeses fiscalment deduïbles.</p><h3>Despeses deduïbles per a autònoms a Andorra</h3><p>Les principals despeses deduïbles inclouen: consum de mercaderies i materials, despeses de personal, amortitzacions, arrendaments i cànons, subministraments, serveis exteriors (assessoria, publicitat) i despeses financeres directament vinculades a l'activitat.</p><h3>Mètodes de determinació</h3><p>El mètode habitual és la <strong>determinació directa</strong>: ingressos reals menys despeses reals justificades amb factura. També existeix l'estimació objectiva per a certes activitats, on la renda es determina per mòduls.</p><h3>Pagament fraccionat</h3><p>Els autònoms i empresaris han d'efectuar un <strong>pagament fraccionat al setembre</strong> equivalent al 50% de la quota de liquidació de l'exercici anterior.</p><p>A <strong>ÀMBIT Associats</strong> gestionem la comptabilitat i la declaració de l'IRPF d'autònoms i empresaris a Andorra. Contacta'ns.</p>`
    },
    {
      slug: "declaracion-irpf-andorra-2026",
      title: "Com fer la declaració de l'IRPF a Andorra 2026: guia pas a pas",
      category: "Declaració",
      date: "Març 2025",
      excerpt: "Guia pràctica per presentar la declaració de l'IRPF 2025 al Portal Tributari d'Andorra. Terminis, formularis i errors més comuns.",
      content: `<h2>Declaració de l'IRPF a Andorra 2026</h2><p>La campanya de l'IRPF corresponent a l'exercici fiscal 2025 es desenvolupa entre l'<strong>1 d'abril i el 30 de setembre del 2026</strong>. Es presenta obligatòriament de forma telemàtica al Portal Tributari del Govern d'Andorra (<a href="https://www.e-tramits.ad" target="_blank" rel="noopener noreferrer">e-tramits.ad</a>).</p><h3>Formularis necessaris</h3><p>El formulari principal és el <strong>300 (declaració general) i el 300-L (liquidació)</strong>. Segons la teva situació, pot ser necessari també: 300-A (situació personal i familiar), 300-B (rendes del treball i immobiliàries), 300-C (activitats econòmiques), 300-D (capital mobiliari) i 300-E (guanys i pèrdues de capital).</p><h3>Errors més comuns</h3><p>Els errors més freqüents són: no aplicar correctament el mínim personal quan el cònjuge és a càrrec (40.000 € en lloc de 24.000 €), oblidar la deducció de l'impost comunal sobre arrendaments (Art. 47), i no incloure les reduccions per fills o altres dependents a càrrec.</p><p>A <strong>ÀMBIT Associats</strong> preparem i presentem la teva declaració de l'IRPF a Andorra garantint el màxim estalvi fiscal dins de la legalitat. Contacta'ns.</p>`
    },
  ],
  en: [
    {
      slug: "irpf-andorra-2025",
      title: "Complete guide to IRPF in Andorra 2025",
      category: "IRPF",
      date: "May 2025",
      excerpt: "Everything you need to know about personal income tax in Andorra: brackets, deadlines, deductions and how to file your return.",
      content: `<h2>IRPF in Andorra: complete guide 2025</h2><p>The Personal Income Tax (IRPF) in Andorra taxes income obtained by fiscal residents in the Principality. With a maximum rate of <strong>10%</strong>, it is one of the lowest in Europe.</p><h3>Who must file?</h3><p>Individuals who have resided in Andorra for more than 183 days during the calendar year, or whose main economic activities or assets are based in Andorra, are required to file an IRPF return.</p><h3>Tax brackets</h3><p>Andorra's IRPF uses a progressive system: the first €24,000 are exempt (0%), from €24,001 to €40,000 the effective rate is 5%, and above €40,000 the rate is 10%. Additionally, there is an Art. 46 allowance of up to €800 per year.</p><h3>Filing deadlines</h3><p>The IRPF return for fiscal year 2025 must be filed between <strong>1 April and 30 September 2026</strong> electronically at <a href="https://www.e-tramits.ad" target="_blank" rel="noopener noreferrer">e-tramits.ad</a>.</p><h3>Main deductions</h3><p>The personal allowance is €24,000 (€40,000 if the spouse is a dependent, €30,000 with recognised disability). Additional deductions: €1,000 per dependent child, 50% of mortgage payments (max. €5,000/year) and pension contributions (max. €5,000/year).</p><p><strong>ÀMBIT Associats</strong> helps you prepare your Andorra IRPF return accurately and safely. Contact us.</p>`
    },
    {
      slug: "autonomos-irpf-andorra",
      title: "Self-employed and IRPF in Andorra: economic activities and deductions",
      category: "Self-employed",
      date: "April 2025",
      excerpt: "If you are self-employed in Andorra, find out how your economic activities are taxed under IRPF: deductible expenses, calculation methods and form 300-C.",
      content: `<h2>Self-employed and IRPF in Andorra</h2><p>Self-employed individuals and professionals carrying out economic activities in Andorra must declare their business or professional income under IRPF. Net income is calculated as revenue minus fiscally deductible expenses.</p><h3>Deductible expenses for self-employed in Andorra</h3><p>Main deductible expenses include: goods and materials consumed, staff costs, depreciation, rent and royalties, utilities, external services (advisory, advertising) and financial expenses directly linked to the activity.</p><h3>Calculation methods</h3><p>The standard method is <strong>direct assessment</strong>: actual income minus actual expenses evidenced by invoices. Objective estimation based on modules is also available for certain activities.</p><h3>Advance payment</h3><p>Self-employed and business owners must make an <strong>advance payment in September</strong> equal to 50% of the previous year's settlement quota.</p><p><strong>ÀMBIT Associats</strong> manages accounting and IRPF returns for self-employed and entrepreneurs in Andorra. Contact us.</p>`
    },
    {
      slug: "declaracion-irpf-andorra-2026",
      title: "How to file your Andorra IRPF return in 2026: step-by-step guide",
      category: "Tax return",
      date: "March 2025",
      excerpt: "Practical guide to filing the 2025 IRPF return through Andorra's Tax Portal. Deadlines, forms and most common mistakes.",
      content: `<h2>Andorra IRPF return 2026</h2><p>The IRPF campaign for fiscal year 2025 runs from <strong>1 April to 30 September 2026</strong>. Filing is mandatory electronically via the Andorran Government's Tax Portal (<a href="https://www.e-tramits.ad" target="_blank" rel="noopener noreferrer">e-tramits.ad</a>).</p><h3>Required forms</h3><p>The main form is <strong>300 (general declaration) and 300-L (settlement)</strong>. Depending on your situation, you may also need: 300-A (personal and family situation), 300-B (employment and property income), 300-C (economic activities), 300-D (capital income) and 300-E (capital gains and losses).</p><h3>Most common mistakes</h3><p>The most frequent errors are: not correctly applying the personal allowance when a spouse is a dependent (€40,000 instead of €24,000), missing the deduction for the communal rental tax (Art. 47), and omitting reductions for children or other dependents.</p><p><strong>ÀMBIT Associats</strong> prepares and files your Andorra IRPF return, ensuring maximum legal tax savings. Contact us.</p>`
    },
  ],
  fr: [
    {
      slug: "irpf-andorra-2025",
      title: "Guide complet de l'IRPF en Andorre 2025",
      category: "IRPF",
      date: "Mai 2025",
      excerpt: "Tout ce que vous devez savoir sur l'impôt sur le revenu en Andorre : tranches, délais, réductions et comment déposer votre déclaration.",
      content: `<h2>L'IRPF en Andorre : guide complet 2025</h2><p>L'Impôt sur le Revenu des Personnes Physiques (IRPF) en Andorre impose les revenus obtenus par les résidents fiscaux en Principauté. Avec un taux maximum de <strong>10%</strong>, c'est l'un des plus bas d'Europe.</p><h3>Qui doit déclarer ?</h3><p>Les personnes physiques ayant résidé en Andorre plus de 183 jours pendant l'année civile, ou dont le centre principal d'activités économiques ou d'intérêts patrimoniaux est situé en Andorre, sont tenues de déposer une déclaration IRPF.</p><h3>Tranches et taux d'imposition</h3><p>L'IRPF andorran applique un système progressif : les premiers 24 000 € sont exonérés (taux 0 %), de 24 001 € à 40 000 € le taux effectif est de 5 %, et au-delà de 40 000 € le taux est de 10 %. Il existe également une bonification de l'Art. 46 allant jusqu'à 800 € par an.</p><h3>Délais de dépôt</h3><p>La déclaration IRPF de l'exercice 2025 doit être déposée entre le <strong>1er avril et le 30 septembre 2026</strong> par voie électronique sur <a href="https://www.e-tramits.ad" target="_blank" rel="noopener noreferrer">e-tramits.ad</a>.</p><h3>Principales réductions</h3><p>Le minimum personnel exonéré est de 24 000 € (40 000 € si le conjoint est à charge et 30 000 € avec handicap reconnu). Il existe également des réductions familiales de 1 000 € par descendant, une réduction de 50 % des mensualités hypothécaires (max. 5 000 €/an) et les cotisations aux plans de retraite (max. 5 000 €/an).</p><p><strong>ÀMBIT Associats</strong> vous aide à préparer votre déclaration IRPF en Andorre en toute sécurité et sans erreurs. Contactez-nous.</p>`
    },
    {
      slug: "autonomos-irpf-andorra",
      title: "Indépendants et IRPF en Andorre : activités économiques et déductions",
      category: "Indépendants",
      date: "Avril 2025",
      excerpt: "Si vous êtes indépendant en Andorre, découvrez comment vos activités économiques sont imposées à l'IRPF : charges déductibles, méthodes de calcul et formulaire 300-C.",
      content: `<h2>Indépendants et IRPF en Andorre</h2><p>Les travailleurs indépendants et professionnels exerçant des activités économiques en Andorre doivent déclarer leurs revenus professionnels à l'IRPF. Le revenu net est calculé comme les recettes moins les charges fiscalement déductibles.</p><h3>Charges déductibles pour les indépendants en Andorre</h3><p>Les principales charges déductibles comprennent : consommation de marchandises et matériaux, charges de personnel, amortissements, loyers et redevances, charges d'exploitation, services externes (conseil, publicité) et charges financières directement liées à l'activité.</p><h3>Méthodes de détermination</h3><p>La méthode habituelle est la <strong>détermination directe</strong> : recettes réelles moins charges réelles justifiées par factures. L'estimation objective par modules est également disponible pour certaines activités.</p><h3>Versement anticipé</h3><p>Les indépendants et entrepreneurs doivent effectuer un <strong>versement anticipé en septembre</strong> équivalant à 50 % du quota de liquidation de l'exercice précédent.</p><p><strong>ÀMBIT Associats</strong> gère la comptabilité et les déclarations IRPF des indépendants et entrepreneurs en Andorre. Contactez-nous.</p>`
    },
    {
      slug: "declaracion-irpf-andorra-2026",
      title: "Comment faire sa déclaration IRPF en Andorre 2026 : guide étape par étape",
      category: "Déclaration",
      date: "Mars 2025",
      excerpt: "Guide pratique pour déposer la déclaration IRPF 2025 sur le Portail Tributaire d'Andorre. Délais, formulaires et erreurs les plus fréquentes.",
      content: `<h2>Déclaration IRPF en Andorre 2026</h2><p>La campagne IRPF correspondant à l'exercice fiscal 2025 se déroule du <strong>1er avril au 30 septembre 2026</strong>. Le dépôt est obligatoirement effectué par voie électronique sur le Portail Tributaire du Gouvernement d'Andorre (<a href="https://www.e-tramits.ad" target="_blank" rel="noopener noreferrer">e-tramits.ad</a>).</p><h3>Formulaires nécessaires</h3><p>Le formulaire principal est le <strong>300 (déclaration générale) et le 300-L (liquidation)</strong>. Selon votre situation, il peut également être nécessaire : 300-A (situation personnelle et familiale), 300-B (revenus du travail et immobiliers), 300-C (activités économiques), 300-D (capital mobilier) et 300-E (plus et moins-values de capital).</p><h3>Erreurs les plus fréquentes</h3><p>Les erreurs les plus courantes sont : ne pas appliquer correctement le minimum personnel lorsque le conjoint est à charge (40 000 € au lieu de 24 000 €), oublier la déduction de l'impôt communal sur les locations (Art. 47), et ne pas inclure les réductions pour enfants ou autres personnes à charge.</p><p><strong>ÀMBIT Associats</strong> prépare et dépose votre déclaration IRPF en Andorre en garantissant l'économie fiscale maximale dans la légalité. Contactez-nous.</p>`
    },
  ],
};

const App = () => {
  const [language, setLanguage] = useState("ca");
  const [currentService, setCurrentService] = useState(null);
  const [currentBlogPost, setCurrentBlogPost] = useState(null);
  const [showIrpf, setShowIrpf] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useState(() => {
    const savedConsent = localStorage.getItem('cookieConsent');
    return savedConsent === null;
  });
  const t = translations[language];
  const services = mainServices[language];
  const details = serviceDetails[language];

  const handleLanguageChange = (langCode) => {
    setLanguage(langCode);
    setCurrentService(null);
    setCurrentBlogPost(null);
    setShowIrpf(false);
  };

  const openService = (id) => {
    setCurrentService(id);
  };

  const goBack = () => {
    setCurrentService(null);
  };

  if (showIrpf) {
    return <IrpfCalculadora onBack={() => setShowIrpf(false)} />;
  }

  return (
    <div className="bg-white text-gray-800 min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#009B9C] text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex justify-end items-center mb-4">
            <div className="flex space-x-4">
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
          </div>
          <div className="flex flex-col items-center">
            <Logo />
            <p className="text-center text-lg opacity-90">{t.tagline}</p>
          </div>
        </div>
      </header>

      {!currentService && !currentBlogPost ? (
        <>
          {/* Banner IRPF — entre logo i serveis */}
          <section className="py-16 bg-gradient-to-r from-[#009B9C] to-[#007A7B] text-white">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-10">
                <div className="flex-1">
                  <span className="inline-block bg-white bg-opacity-20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
                    {t.irpfBanner.badge}
                  </span>
                  <h2 className="text-3xl font-bold mb-3">{t.irpfBanner.title}</h2>
                  <p className="text-white text-opacity-90 mb-5 leading-relaxed">{t.irpfBanner.desc}</p>
                  <ul className="space-y-1 mb-7">
                    {t.irpfBanner.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white opacity-80 flex-shrink-0">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setShowIrpf(true)}
                    className="bg-white text-[#007A7B] font-bold px-6 py-3 rounded-xl hover:bg-[#e6f7f7] transition shadow-md"
                  >
                    {t.irpfBanner.cta} →
                  </button>
                </div>
                <div className="flex-shrink-0 w-64 bg-white bg-opacity-10 border border-white border-opacity-30 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
                  <div className="text-xs font-semibold opacity-70 uppercase tracking-wide mb-3">Exemple de càlcul</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="opacity-80">Salari brut</span>
                      <span className="font-semibold">48.000 €</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-80">Mínim personal</span>
                      <span className="font-semibold">24.000 €</span>
                    </div>
                    <div className="border-t border-white border-opacity-30 pt-2 flex justify-between">
                      <span className="opacity-80">BLG</span>
                      <span className="font-semibold">~22.560 €</span>
                    </div>
                    <div className="flex justify-between text-base">
                      <span className="font-bold">Quota final</span>
                      <span className="font-bold text-yellow-300">~1.456 €</span>
                    </div>
                    <div className="flex justify-between text-xs opacity-70">
                      <span>Tipus efectiu</span>
                      <span>~3,0%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

{/* Serveis */}
<section id="services" className="py-16 bg-white border border-white relative overflow-hidden">
  {/* Imatge esquerra (triangle) */}
  <div className="absolute top-0 left-0 w-1/5 h-full pointer-events-none z-0 flex items-start">
    <img
      src={izquierdaImg}
      alt="Triangle esquerre decoratiu"
      className="max-h-full max-w-full object-contain object-left opacity-100"
    />
  </div>

  {/* Imatge dreta (línies) */}
  <div className="absolute top-0 right-0 w-1/4 h-full pointer-events-none z-0 flex items-start">
    <img
      src={derechaImg}
      alt="Línies diagonals dreta"
      className="max-h-full max-w-full object-contain object-right opacity-100"
    />
  </div>

  {/* Contingut principal */}
  <div className="container mx-auto px-4 relative z-10">
    <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">{t.services}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {services.map((service) => (
        <motion.button
          key={service.id}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-left border border-gray-100"
          onClick={() => openService(service.id)}
        >
          <h3 className="text-xl font-bold mb-3 text-[#009B9C]">{service.title}</h3>
          <p className="text-gray-600">Clica per veure tots els serveis</p>
        </motion.button>
      ))}
    </div>
  </div>
</section>

          {/* Zona Professionals */}
          <section className="py-20 bg-gray-900 text-white">
            <div className="container mx-auto px-4">
              <div className="text-center mb-12">
                <span className="inline-block bg-[#009B9C] text-white text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
                  {t.professionals.badge}
                </span>
                <h2 className="text-3xl font-bold mb-3">{t.professionals.title}</h2>
                <p className="text-gray-400 max-w-xl mx-auto">{t.professionals.subtitle}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Eina Bretxa — activa */}
                <a
                  href="https://bretxa-genere.onrender.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-800 rounded-2xl p-7 border border-gray-700 hover:border-[#009B9C] hover:bg-gray-750 transition-all duration-300 group flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-[#009B9C] rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <span className="bg-green-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">{t.professionals.available}</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2 group-hover:text-[#009B9C] transition-colors">{t.professionals.bretxaTitle}</h3>
                  <p className="text-gray-400 text-sm flex-1 mb-5">{t.professionals.bretxaDesc}</p>
                  <span className="inline-flex items-center gap-2 text-[#009B9C] font-semibold text-sm">
                    {t.professionals.bretxaCta}
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </a>

                {/* Eina Fiscal — pròximament */}
                <div className="bg-gray-800 rounded-2xl p-7 border border-gray-700 opacity-50 flex flex-col cursor-not-allowed">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-gray-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="bg-gray-600 text-gray-300 text-xs font-semibold px-2.5 py-1 rounded-full">{t.professionals.comingSoon}</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-gray-300">{t.professionals.fiscalTitle}</h3>
                  <p className="text-gray-500 text-sm flex-1 mb-5">{t.professionals.fiscalDesc}</p>
                  <span className="inline-flex items-center gap-2 text-gray-500 font-semibold text-sm">
                    {t.professionals.fiscalCta}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Blog / Articles SEO */}
          <section className="py-16 bg-gray-50">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold text-center mb-10 text-gray-800">{t.blogTitle}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {(blogPosts[language] || blogPosts.ca).map((post) => (
                  <article
                    key={post.slug}
                    className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition"
                    onClick={() => setCurrentBlogPost(post)}
                  >
                    <div className="p-6 flex flex-col flex-1">
                      <span className="text-xs font-semibold text-[#009B9C] uppercase tracking-wide mb-2">{post.category}</span>
                      <h3 className="text-lg font-bold text-gray-800 mb-3 leading-snug">{post.title}</h3>
                      <p className="text-sm text-gray-600 flex-1 mb-4">{post.excerpt}</p>
                      <span className="text-xs text-gray-400">{post.date}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* Secció SEO — text estàtic indexable per Google */}
          <section className="py-16 bg-white">
            <div className="container mx-auto px-4 max-w-4xl">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">{t.seoTitle}</h2>
              {language === "ca" && (
                <>
                  <p className="text-gray-600 mb-4">ÀMBIT Associats és l'assessoria fiscal i comptable de referència al Principat d'Andorra. Oferim serveis especialitzats en declaració de l'IRPF andorrà, comptabilitat d'empreses, IGI (Impost General Indirecte), constitució de societats i obtenció de la residència a Andorra.</p>
                  <p className="text-gray-600 mb-6">Amb seu a Escaldes-Engordany, el nostre equip d'experts fiscalistes andorrans acompanya tant als particulars com a les empreses en totes les seves obligacions tributàries, garantint el màxim estalvi fiscal dins del marc legal vigent.</p>
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">Trams de l'IRPF a Andorra 2025</h3>
                </>
              )}
              {language === "es" && (
                <>
                  <p className="text-gray-600 mb-4">ÀMBIT Associats es la asesoría fiscal y contable de referencia en el Principado de Andorra. Ofrecemos servicios especializados en declaración del IRPF andorrano, contabilidad de empresas, IGI (Impuesto General Indirecto), constitución de sociedades y obtención de la residencia en Andorra.</p>
                  <p className="text-gray-600 mb-6">Con sede en Escaldes-Engordany, nuestro equipo de expertos fiscalistas andorranos acompaña tanto a particulares como a empresas en todas sus obligaciones tributarias, garantizando el máximo ahorro fiscal dentro del marco legal vigente.</p>
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">Tramos del IRPF en Andorra 2025</h3>
                </>
              )}
              {language === "en" && (
                <>
                  <p className="text-gray-600 mb-4">ÀMBIT Associats is the leading tax and accounting advisory firm in the Principality of Andorra. We provide specialist services in Andorran IRPF tax returns, company accounting, IGI (indirect tax), company formation and obtaining Andorran residence.</p>
                  <p className="text-gray-600 mb-6">Based in Escaldes-Engordany, our team of Andorran tax experts supports both individuals and companies with all their tax obligations, ensuring maximum legal tax savings.</p>
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">Andorra IRPF 2025 tax brackets</h3>
                </>
              )}
              {language === "fr" && (
                <>
                  <p className="text-gray-600 mb-4">ÀMBIT Associats est le cabinet de conseil fiscal et comptable de référence en Principauté d'Andorre. Nous proposons des services spécialisés en déclaration IRPF andorrane, comptabilité des entreprises, IGI (taxe indirecte générale), constitution de sociétés et obtention de la résidence en Andorre.</p>
                  <p className="text-gray-600 mb-6">Basé à Escaldes-Engordany, notre équipe d'experts fiscalistes andorrans accompagne particuliers et entreprises dans toutes leurs obligations fiscales, en garantissant l'économie fiscale maximale dans le cadre légal en vigueur.</p>
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">Tranches IRPF Andorre 2025</h3>
                </>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#009B9C] text-white">
                      <th className="p-3 text-left">{language === "en" ? "Taxable base" : language === "fr" ? "Base imposable" : "Base liquidable"}</th>
                      <th className="p-3 text-left">{language === "en" ? "Rate" : language === "fr" ? "Taux" : "Tipus"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b"><td className="p-3">{language === "en" ? "€0 – €24,000" : language === "fr" ? "0 – 24 000 €" : "0 – 24.000 €"}</td><td className="p-3">0%</td></tr>
                    <tr className="border-b bg-gray-50"><td className="p-3">{language === "en" ? "€24,001 – €40,000" : language === "fr" ? "24 001 – 40 000 €" : "24.001 – 40.000 €"}</td><td className="p-3">5%</td></tr>
                    <tr className="border-b"><td className="p-3">{language === "en" ? "Above €40,000" : language === "fr" ? "Plus de 40 000 €" : language === "es" ? "Más de 40.000 €" : "Més de 40.000 €"}</td><td className="p-3">10%</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Contacte */}
          <section id="contact" className="py-20 bg-[#009B9C] text-white">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold text-center mb-8">{t.contact}</h2>
              <p className="text-center text-lg mb-10">{t.contactInfo}</p>
              <div className="max-w-lg mx-auto space-y-4">
                <form action="https://formspree.io/f/mdkdrkze" method="POST" className="space-y-4">
  <input
    type="text"
    name="name"
    placeholder={t.form.name}
    className="w-full p-3 rounded bg-white text-gray-800"
    required
  />
  <input
    type="email"
    name="email"
    placeholder={t.form.email}
    className="w-full p-3 rounded bg-white text-gray-800"
    required
  />
  <input
    type="tel"
    name="phone"
    placeholder={t.form.phone}
    className="w-full p-3 rounded bg-white text-gray-800"
  />
  <textarea
    name="message"
    placeholder={t.form.message}
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
    className="block w-full bg-[#00C8C9] hover:bg-[#00A8A9] text-white py-3 rounded-lg text-center font-semibold transition"
  >
    {t.whatsapp}
  </a>
</form>
                
              </div>
            </div>
          </section>

         {/* Nota Legal */}
<section id="legal" className="py-20 bg-white relative">
  {/* Imatge inferior esquerra */}
  <div className="absolute bottom-0 left-0 w-1/3 h-260 pointer-events-none z-0 flex items-end justify-start">
    <img
      src={legalBottomLeftImg}
      alt="Decoració inferior esquerra"
      className="max-h-full max-w-full object-contain opacity-100"
    />
  </div>

  {/* Imatge inferior dreta */}
  <div className="absolute bottom-0 right-0 w-1/3 h-180 pointer-events-none z-0 flex items-end justify-end">
    <img
      src={legalBottomRightImg}
      alt="Decoració inferior dreta"
      className="max-h-full max-w-full object-contain opacity-100"
    />
  </div>

  <div className="container mx-auto px-4 relative z-10">
    <h2 className="text-3xl font-bold text-center mb-8">{t.legal}</h2>
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
                  ${legalContent[language][key]}
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
      ) : currentBlogPost ? (
        /* Vista detallada d'un article del blog */
        <section className="py-16 flex-1">
          <div className="container mx-auto px-4 max-w-3xl">
            <button
              onClick={() => setCurrentBlogPost(null)}
              className="mb-6 text-[#009B9C] hover:underline flex items-center"
            >
              ← {t.back}
            </button>
            <span className="text-xs font-semibold text-[#009B9C] uppercase tracking-wide">{currentBlogPost.category}</span>
            <h1 className="text-3xl font-bold mb-2 mt-1 text-gray-800">{currentBlogPost.title}</h1>
            <p className="text-sm text-gray-500 mb-8">{currentBlogPost.date}</p>
            <div
              className="text-gray-700 leading-relaxed space-y-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-800 [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:mt-5 [&_h3]:mb-2 [&_a]:text-[#009B9C] [&_a]:underline [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: currentBlogPost.content }}
            />
            <div className="mt-10 p-6 bg-[#e6f7f7] rounded-xl border border-[#009B9C] border-opacity-30">
              <p className="font-semibold text-[#009B9C] mb-1">ÀMBIT Associats</p>
              <p className="text-sm text-gray-700">
                <a href="mailto:info@ambit.ad" className="text-[#009B9C] underline">info@ambit.ad</a>
                {" · "}
                <a href="tel:+376650042" className="text-[#009B9C] underline">+376 650 042</a>
              </p>
            </div>
          </div>
        </section>
      ) : (
        /* Vista detallada del servei */
        <section className="py-20 flex-1">
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
{/* Cookie Consent Banner */}
{showCookieBanner && (
  <div className="fixed bottom-0 left-0 right-0 bg-white text-gray-800 p-4 shadow-lg border-t border-gray-200 z-50">
    <div className="container mx-auto px-4 text-center">
      <p className="mb-3 text-sm">
        Aquesta web utilitza cookies per millorar l'experiència d'usuari. En continuar navegant, acceptes el seu ús.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={() => {
            localStorage.setItem('cookieConsent', 'rejected');
            setShowCookieBanner(false);
          }}
          className="text-[#009B9C] hover:underline text-sm font-medium"
        >
          Rebutjar
        </button>
        <button
          onClick={() => {
            localStorage.setItem('cookieConsent', 'accepted');
            setShowCookieBanner(false);
          }}
          className="bg-[#009B9C] text-white px-5 py-1 rounded-lg text-sm font-semibold hover:bg-[#006667] transition"
        >
          Acceptar
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        <a
          href="#legal"
          onClick={() => setShowCookieBanner(false)}
          className="hover:underline"
        >
          Més informació a Política de cookies
        </a>
      </p>
    </div>
  </div>
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