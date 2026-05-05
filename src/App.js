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
    seoTitle: "Assessoria fiscal, comptable i mercantil a Andorra",
    nav: {
      serveis: "Serveis",
      calculadora: "Calculadora IRPF",
      professionals: "Zona Professionals",
      blog: "Blog",
      contacte: "Contacte",
    },
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
    seoTitle: "Asesoría fiscal, contable y mercantil en Andorra",
    nav: {
      serveis: "Servicios",
      calculadora: "Calculadora IRPF",
      professionals: "Zona Profesionales",
      blog: "Blog",
      contacte: "Contacto",
    },
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
    seoTitle: "Tax, accounting and corporate advisory in Andorra",
    nav: {
      serveis: "Services",
      calculadora: "IRPF Calculator",
      professionals: "Professional Area",
      blog: "Blog",
      contacte: "Contact",
    },
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
    seoTitle: "Conseil fiscal, comptable et commercial en Andorre",
    nav: {
      serveis: "Services",
      calculadora: "Calculatrice IRPF",
      professionals: "Espace Professionnels",
      blog: "Blog",
      contacte: "Contact",
    },
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

// ── Blog posts professionals — 5 articles de referència ──────────────────────
const blogPosts = {
  ca: [
    {
      slug: "constitucio-societats-andorra",
      title: "Constitució de societats a Andorra: guia comparativa",
      category: "Dret Mercantil",
      date: "Maig 2025",
      excerpt: "SL, SA, holding o societat patrimonial: quina estructura societària convé a cada projecte empresarial a Andorra? Anàlisi tècnic dels quatre vehicles jurídics principals, amb criteris de selecció per perfil d'inversor.",
      content: `<h2>Constitució de societats a Andorra: guia comparativa de les estructures jurídiques</h2><p>Andorra ofereix als inversors i empresaris un marc legal modern i una fiscalitat competitiva per establir el seu negoci o vehicular el seu patrimoni. No obstant, l'elecció de la forma jurídica adequada és una decisió estratègica que condiciona l'operativa, la fiscalitat i la planificació successòria a llarg termini. En aquest article analitzem les quatre estructures principals disponibles al Principat.</p><h3>1. Societat de Responsabilitat Limitada (SL)</h3><p>La SL és la forma jurídica més habitual per a pimes i autònoms que volen operar amb responsabilitat limitada. El capital mínim és de 3.000 euros, dividit en participacions socials no transmissibles lliurement. La responsabilitat dels socis queda limitada a la seva aportació. L'Impost de Societats aplicable és del 10% sobre el benefici net, amb possibles reduccions al 2-5% per a certs supòsits.</p><p>És l'estructura recomanada per a: noves activitats empresarials locals, professionals liberals que volen operar en societat, i petits inversors que inicien activitat a Andorra.</p><h3>2. Societat Anònima (SA)</h3><p>La SA requereix un capital mínim de 60.000 euros, dividit en accions lliurement transmissibles. Permet una estructura accionarial complexa, amb possibilitat d'emetre diferents classes d'accions. És la forma habitual per a grans corporacions i empreses que preveuen incorporar inversors externs o cotitzar en mercats regulats.</p><p>És l'estructura recomanada per a: empreses de gran volum, projectes que requeriran finançament extern, i grups empresarials que necessiten una societat matriu flexible.</p><h3>3. Societat Holding (règim STVE)</h3><p>Andorra preveu un règim fiscal especial per a les entitats de tinença de valors estrangers (règim STVE, articles 36-38 de la Llei de l'IS andorrana). Sota aquest règim, els dividends i les plusvàlues procedents de participacions en societats filials estan exempts de tributació al Principat, sempre que es compleixin determinats requisits de substància econòmica: l'holding ha de tenir oficina i personal propi a Andorra, i les filials han de tributar almenys al 4% en el seu país d'origen o residir en un país amb CDI amb Andorra.</p><p>A diferència del règim general d'exempció, el règim STVE no exigeix una participació mínima ni un període mínim de tinença. Quan el titular de l'holding és una persona física resident a Andorra, els dividends distribuïts per l'holding andorrà a aquesta persona no estan subjectes a retenció, resultant en una tributació efectiva propera al 0%.</p><p>És l'estructura recomanada per a: family offices, empresaris que gestionen diverses societats a nivell internacional, i grans patrimonis que volen centralitzar la gestió d'inversions i optimitzar la fiscalitat sobre dividends i plusvàlues.</p><h3>4. Societat Patrimonial</h3><p>Una societat patrimonial andorrana és una SL o SA la finalitat de la qual és exclusivament la tinença i gestió de béns immobles o actius financers dels seus socis, sense exercir cap activitat econòmica comercial. Si el 50% o més de l'actiu de la societat no està destinat a una activitat econòmica, la societat és classificada com a patrimonial a efectes fiscals.</p><p>Les societats patrimonials no poden tenir treballadors contractats — les tasques de gestió les realitzen els mateixos socis. En conseqüència, no requereixen substància econòmica demostrable, però les entitats bancàries andorranes poden exigir que almenys un soci sigui resident al Principat per obrir el compte bancari corresponent.</p><p>Les principals avantatges fiscals d'aquesta estructura a Andorra inclouen: tributació reduïda al 4% sobre rendes immobiliàries en determinats supòsits, absència d'impost sobre el patrimoni i sobre successions, i la possibilitat de transmetre participacions sense tributació sobre la transmissió. Aquesta última característica la fa especialment útil com a vehicle de planificació successòria familiar.</p><p>És l'estructura recomanada per a: propietaris d'immobles que volen separar el patrimoni personal de l'empresarial, famílies que volen organitzar la transmissió patrimonial entre generacions, i residents a Andorra que volen gestionar inversions financeres de forma ordenada.</p><h3>Quadre resum: criteris de selecció</h3><p>La selecció de l'estructura òptima depèn de múltiples factors: la naturalesa de l'activitat, el perfil dels socis (residents o no residents), el volum del patrimoni a gestionar, els objectius de planificació successòria i les jurisdiccions implicades. En ÀMBIT Associats analitzem cada cas de forma individualitzada per dissenyar l'estructura més eficient i sostenible a llarg termini.</p><p>Contacteu amb nosaltres per a una primera consulta sense compromís.</p>`
    },
    {
      slug: "holding-andorra-regim-stve",
      title: "Holding a Andorra: règim STVE, avantatges fiscals i requisits de substància",
      category: "Estructuració Societària",
      date: "Abril 2025",
      excerpt: "Règim STVE, exempció de dividends i plusvàlues, requisits de substància econòmica i comparativa internacional. Guia tècnica per a family offices i grans patrimonis.",
      content: `<h2>Holding a Andorra: règim STVE, avantatges fiscals i requisits de substància</h2><p>El holding andorrà s'ha consolidat com una de les estructures més eficients d'Europa per a la gestió de patrimonis empresarials i familiars d'entre 1 i 50 milions d'euros. Andorra combina una tributació efectiva que pot arribar al 0% per a determinades estructures, una conformitat plena amb els estàndards internacionals de transparència (OCDE, FATF) i una absència total d'impostos sobre el patrimoni, les successions i les donacions.</p><h3>El règim STVE: entitats de tinença de valors estrangers</h3><p>La Llei de l'Impost sobre Societats d'Andorra (articles 36-38) preveu un règim especial per a les entitats la finalitat exclusiva de les quals és la tinença i gestió de participacions en societats. Sota aquest règim, els dividends i les plusvàlues procedents de filials estan exempts de tributació a Andorra. A diferència d'altres jurisdiccions europees (Luxemburg, Països Baixos), el règim andorrà no exigeix una participació mínima ni un període mínim de tinença per gaudir de l'exempció.</p><h3>Requisits per acollir-se al règim STVE</h3><p>Per beneficiar-se del règim, la societat holding ha de complir els requisits de substància econòmica exigits per les autoritats andorranes: disposar d'una oficina física al Principat, comptar amb personal propi (almenys una persona qualificada) i demostrar una direcció efectiva des d'Andorra. Les filials han de tributar almenys al 4% en el seu país d'origen, o residir en un Estat que hagi signat un Conveni de Doble Imposició (CDI) amb Andorra.</p><h3>Fiscalitat sobre dividends: del holding al soci resident</h3><p>Quan el titular de l'holding és una persona física resident fiscal a Andorra, els dividends distribuïts per l'holding andorrà al soci persona física no estan subjectes a retenció. A efectes pràctics, si la filial ha tributat al seu país d'origen al 5% per IRNR (per exemple, en virtut del CDI entre Andorra i Espanya, article 10), i l'holding aplica una deducció per doble imposició internacional, la tributació efectiva sobre el cicle complet (benefici filial → dividend holding → distribució al soci) pot ser propera al 0%.</p><h3>Comparativa internacional</h3><p>Respecte als centres financers tradicionals, Andorra presenta avantatges diferencials: Suïssa ofereix major xarxa de CDIs però una càrrega fiscal superior (participació del 20-25% a nivell cantonal). Luxemburg permet estructures més complexes però requereix substància significativa i la càrrega regulatòria és major. El Principat, per la seva banda, combina eficiència fiscal, baixa complexitat operativa i conformitat internacional total.</p><h3>Per a qui és recomanable un holding andorrà?</h3><p>L'estructura és especialment rellevant per a: empresaris que posseeixen diverses societats operatives a Espanya, França o altres països i volen centralitzar la gestió i optimitzar la fiscalitat sobre dividends; family offices que busquen una jurisdicció eficient per a la gestió patrimonial intergeneracional; i residents a Andorra amb participacions significatives en societats estrangeres que volen estructurar la tinença a través d'un vehicle andorrà.</p><p>En ÀMBIT Associats assessorem en el disseny i la constitució d'estructures holding a Andorra, inclòs el compliment dels requisits de substància, la redacció d'estatuts, la coordinació amb notari i la gestió comptable i fiscal posterior.</p>`
    },
    {
      slug: "planificacio-patrimonial-successions-andorra",
      title: "Planificació patrimonial i successòria a Andorra: eines legals i avantatges fiscals",
      category: "Planificació Patrimonial",
      date: "Març 2025",
      excerpt: "Andorra no té impost sobre successions ni sobre el patrimoni. Analitzem les eines legals disponibles per a la planificació successòria: societats patrimonials, donació escalonada, pactes successoris i assegurances de vida.",
      content: `<h2>Planificació patrimonial i successòria a Andorra: eines legals i avantatges fiscals</h2><p>Un dels atractius fiscals més rellevants d'Andorra per a les famílies amb patrimoni és l'absència total d'impost sobre successions, d'impost sobre el patrimoni i d'impost sobre donacions. Aquesta circumstància crea un entorn únic a Europa per a la planificació successòria i la transmissió de patrimoni entre generacions.</p><h3>Absència d'impostos patrimonials: impacte real</h3><p>A Espanya, l'impost sobre successions pot assolir el 34% en certes comunitats autònomes per a herències de germans, oncles o persones sense vincle familiar. A França, el tipus màxim per a línies colaterals és del 60%. A Andorra, la transmissió per herència o donació no genera cap tributació addicional, ni a nivell d'impost de successions ni d'impost sobre el patrimoni. Les plusvàlues derivades de la transmissió d'accions de societats andorranes tampoc estan subjectes a tributació quan la participació supera el 25% i s'ha mantingut durant més de 10 anys.</p><h3>Eines legals per a la planificació successòria</h3><p><strong>1. Societat patrimonial com a vehicle de transmissió:</strong> La constitució d'una societat patrimonial que agrupi els immobles i actius financers del patrimoni familiar permet organitzar la transmissió futura no com una successió d'immobles (procediment complex, amb intervenció notarial i registral per a cada bé), sinó com una transmissió de participacions socials. Aquesta estructura ofereix major flexibilitat, confidencialitat i eficiència operativa.</p><p><strong>2. Donació escalonada d'accions:</strong> Els pares poden transferir progressivament les participacions de la societat patrimonial als fills, mantenint el control de gestió mitjançant usufructe o drets de vot diferenciats. Aquesta tècnica permet anticipar la transmissió patrimonial de forma ordenada, sense tributació per donació a Andorra.</p><p><strong>3. Pactes successoris:</strong> El dret civil andorrà permet la formalització de pactes successoris entre el causant i els hereus en vida, cosa que ofereix seguretat jurídica i evita conflictes familiars posteriors. Aquests pactes poden regular la distribució dels béns, el manteniment de la unitat patrimonial i els drets dels hereus forçosos.</p><p><strong>4. Assegurances de vida com a instrument patrimonial:</strong> La subscripció d'una pòlissa d'assegurança de vida vinculada a actius financers permet designar beneficiaris lliurement (sense restriccions de llegítima) i organitzar la distribució del patrimoni financer de forma ràpida i confidencial. A Andorra, les prestacions de les assegurances de vida no estan subjectes a tributació a mans del beneficiari.</p><h3>Planificació en context transfronterer</h3><p>Per a residents a Andorra amb béns o hereus a Espanya o França, la planificació successòria requereix un enfocament transfronterer que tingui en compte el Reglament Europeu de Successions (UE) 650/2012 (no aplicable directament a Andorra per no ser membre de la UE, però amb incidència en les herències transfrontereres), els CDIs signats per Andorra i la normativa de cada jurisdicció on es troben ubicats els béns o on resideixen els hereus.</p><p>En ÀMBIT Associats dissenyem plans patrimonials integrals que integren els aspectes civils, fiscals i familiars, coordinant-nos amb notaris andorrans i, quan és necessari, amb assessors legals de les jurisdiccions implicades.</p>`
    },
    {
      slug: "trasllat-residencia-andorra",
      title: "Trasllat de residència a Andorra: tipus de residència, requisits i planificació",
      category: "Residència",
      date: "Febrer 2025",
      excerpt: "Residència activa, passiva i per inversió: diferències, requisits i planificació prèvia al trasllat. Tot el que has de saber abans de canviar la residència fiscal a Andorra.",
      content: `<h2>Trasllat de residència a Andorra: tipus de residència, requisits i planificació</h2><p>Andorra és el quart país del món amb la renda per càpita més alta i un dels territoris europeus amb menor càrrega fiscal per a persones físiques. El trasllat de residència fiscal al Principat és una opció legalment vàlida i creixentment habitual entre empresaris, professionals de l'àmbit digital, esportistes d'elit i famílies amb patrimoni. No obstant, cal planificar adequadament el procés per garantir l'efectivitat del canvi de residència fiscal i evitar conflictes amb les autoritats tributàries del país d'origen.</p><h3>Tipus de residència a Andorra</h3><p><strong>Residència activa per compte propi:</strong> Per a empresaris i autònoms que volen crear o gestionar una activitat econòmica al Principat. Requereix constituir una societat andorrana o donar-se d'alta com a autònom, disposar d'un local o oficina, i demostrar una activitat econòmica real. El sol·licitant ha de residir efectivament a Andorra almenys 183 dies a l'any.</p><p><strong>Residència passiva:</strong> Per a persones que volen establir la seva residència fiscal a Andorra sense exercir una activitat econòmica al Principat. Requereix acreditar una inversió mínima de 600.000 euros en actius andorrans (immobles, dipòsits bancaris o participacions en societats andorranes) i demostrar que es disposa de rendes suficients per viure sense treballar a Andorra. La residència passiva no permet treballar al Principat.</p><p><strong>Residència per compte d'altri:</strong> Per a treballadors per compte d'altri que han obtingut un contracte laboral amb una empresa andorrana. La residència es vincula a la relació laboral i permet accedir al sistema de seguretat social andorrà (CASS) i als beneficis fiscals del Principat.</p><h3>Planificació prèvia al trasllat: aspectes clau</h3><p>El canvi de residència fiscal no és immediat i requereix planificació. Aspectes fonamentals a considerar: (1) L'exit tax a Espanya: els residents espanyols que traslladen la residència fora d'Espanya amb actius (accions, participacions) valorats en més de 4 milions d'euros, o amb guanys potencials superiors a 1 milió d'euros, poden estar subjectes a l'exit tax espanyol. Cal planificar la transmissió d'actius prèviament. (2) El CDI Andorra-Espanya: el Conveni de Doble Imposició signat el 2015 estableix els criteris de residència fiscal i la distribució de la potestat tributària sobre cada tipus de renda. Cal analitzar la situació personal del contribuent per determinar l'impacte real del canvi. (3) La substància real a Andorra: per ser efectiu el canvi de residència fiscal, el contribuent ha de demostrar que Andorra és el seu centre d'interessos vitals: residència efectiva, vida social, gestió dels negocis des del Principat.</p><p>En ÀMBIT Associats acompanyem tot el procés de trasllat de residència, des de l'anàlisi inicial de la situació fiscal fins als tràmits administratius i la gestió comptable i fiscal posterior a Andorra.</p>`
    },
    {
      slug: "cdi-andorra-espanya",
      title: "Conveni de Doble Imposició Andorra-Espanya: anàlisi tècnica per article",
      category: "Fiscalitat Internacional",
      date: "Gener 2025",
      excerpt: "El CDI signat el 2015 entre Andorra i Espanya estableix les regles de tributació sobre dividends, interessos, plusvàlues, salaris i pensions. Anàlisi tècnica per a residents i empreses que operen en tots dos països.",
      content: `<h2>Conveni de Doble Imposició Andorra-Espanya: anàlisi tècnica per article</h2><p>El Conveni per evitar la Doble Imposició (CDI) signat entre Andorra i Espanya el 8 de gener de 2015 (en vigor des del 26 de febrer de 2016) és un dels instruments legals més rellevants per a empresaris, inversors i particulars que mantenen relacions econòmiques entre tots dos països. El CDI distribueix la potestat tributària sobre cada tipus de renda entre els dos estats signataris, evitant que una mateixa renda tributi dues vegades.</p><h3>Residència fiscal: criteri de desempat (article 4)</h3><p>El CDI estableix els criteris per determinar la residència fiscal quan una persona pot ser considerada resident per ambdós estats: en primer lloc s'aplica el criteri de la llar permanent; en segon lloc, el centre d'interessos vitals (on es troben les relacions personals i econòmiques més estretes); en tercer lloc, el lloc d'estança habitual (183 dies); i finalment la nacionalitat. Per a les persones que traslladen la residència d'Espanya a Andorra, és fonamental acreditar que el centre d'interessos vitals s'ha desplaçat efectivament al Principat.</p><h3>Dividends (article 10)</h3><p>Els dividends pagats per una societat espanyola a un resident andorrà tributen a Espanya per IRNR al 5% quan el perceptor és una societat que posseeix almenys el 10% del capital de la societat pagadora, i al 15% en la resta de casos. A Andorra, el beneficiari pot aplicar la deducció per doble imposició internacional sobre l'impost pagat a Espanya, de manera que la tributació efectiva addicional a Andorra pot ser del 0%. Per als holdings andorrans acollits al règim STVE, els dividends rebuts estan exempts a Andorra, resultant en una tributació total del 5% (la retenció espanyola).</p><h3>Interessos (article 11)</h3><p>Els interessos pagats per un resident espanyol a un resident andorrà tributen a Espanya al 5% en concepte de IRNR. A Andorra, s'aplica la deducció per doble imposició, podent resultar en una tributació neta al Principat del 5-10% en funció de la situació fiscal del perceptor.</p><h3>Plusvàlues (article 13)</h3><p>Les plusvàlues derivades de la transmissió d'immobles situats a Espanya tributen a Espanya (generalment al 19-24% per a no residents). Les plusvàlues derivades de la transmissió d'accions o participacions en societats que el 50% dels actius siguin immobles espanyols, també tributen a Espanya. Per a la resta de guanys de capital (accions de societats no immobiliàries, fons d'inversió, etc.), la potestat tributària correspon exclusivament al país de residència del transmitent.</p><h3>Pensions i salaris (articles 15-18)</h3><p>Els salaris tributen al país on s'exerceix la feina, amb excepcions per a treballadors fronterers i determinades categories (treballadors del sector públic, estudiants, professors). Les pensions privades tributen al país de residència del perceptor. Les pensions de la seguretat social espanyola percebudes per residents andorrans tributen exclusivament a Espanya.</p><p>En ÀMBIT Associats analitzem la situació fiscal individual de cada client en el context del CDI per optimitzar la planificació fiscal transfronterera de forma rigorosa i conforme a la normativa vigent.</p>`
    },
  ],
  es: [
    {
      slug: "constitucio-societats-andorra",
      title: "Constitución de sociedades en Andorra: guía comparativa",
      category: "Derecho Mercantil",
      date: "Mayo 2025",
      excerpt: "SL, SA, holding o sociedad patrimonial: ¿qué estructura societaria conviene a cada proyecto empresarial en Andorra? Análisis técnico de los cuatro vehículos jurídicos principales, con criterios de selección por perfil de inversor.",
      content: `<h2>Constitución de sociedades en Andorra: guía comparativa de las estructuras jurídicas</h2><p>Andorra ofrece a inversores y empresarios un marco legal moderno y una fiscalidad competitiva para establecer su negocio o vehicular su patrimonio. Sin embargo, la elección de la forma jurídica adecuada es una decisión estratégica que condiciona la operativa, la fiscalidad y la planificación sucesoria a largo plazo. En este artículo analizamos las cuatro estructuras principales disponibles en el Principado.</p><h3>1. Sociedad de Responsabilidad Limitada (SL)</h3><p>La SL es la forma jurídica más habitual para pymes y autónomos que quieren operar con responsabilidad limitada. El capital mínimo es de 3.000 euros, dividido en participaciones sociales no transmisibles libremente. La responsabilidad de los socios queda limitada a su aportación. El Impuesto de Sociedades aplicable es del 10% sobre el beneficio neto, con posibles reducciones al 2-5% para ciertos supuestos.</p><p>Es la estructura recomendada para: nuevas actividades empresariales locales, profesionales liberales que quieren operar en sociedad, y pequeños inversores que inician actividad en Andorra.</p><h3>2. Sociedad Anónima (SA)</h3><p>La SA requiere un capital mínimo de 60.000 euros, dividido en acciones libremente transmisibles. Permite una estructura accionarial compleja, con posibilidad de emitir diferentes clases de acciones. Es la forma habitual para grandes corporaciones y empresas que prevén incorporar inversores externos o cotizar en mercados regulados.</p><p>Es la estructura recomendada para: empresas de gran volumen, proyectos que requerirán financiación externa, y grupos empresariales que necesitan una sociedad matriz flexible.</p><h3>3. Sociedad Holding (régimen STVE)</h3><p>Andorra prevé un régimen fiscal especial para las entidades de tenencia de valores extranjeros (régimen STVE, artículos 36-38 de la Ley del IS andorrano). Bajo este régimen, los dividendos y las plusvalías procedentes de participaciones en sociedades filiales están exentos de tributación en el Principado, siempre que se cumplan determinados requisitos de sustancia económica: el holding debe tener oficina y personal propio en Andorra, y las filiales deben tributar al menos al 4% en su país de origen o residir en un país con CDI con Andorra.</p><p>A diferencia del régimen general de exención, el régimen STVE no exige una participación mínima ni un período mínimo de tenencia. Cuando el titular del holding es una persona física residente en Andorra, los dividendos distribuidos por el holding andorrano a esta persona no están sujetos a retención, resultando en una tributación efectiva cercana al 0%.</p><p>Es la estructura recomendada para: family offices, empresarios que gestionan diversas sociedades a nivel internacional, y grandes patrimonios que quieren centralizar la gestión de inversiones y optimizar la fiscalidad sobre dividendos y plusvalías.</p><h3>4. Sociedad Patrimonial</h3><p>Una sociedad patrimonial andorrana es una SL o SA cuya finalidad es exclusivamente la tenencia y gestión de bienes inmuebles o activos financieros de sus socios, sin ejercer ninguna actividad económica comercial. Si el 50% o más del activo de la sociedad no está destinado a una actividad económica, la sociedad es clasificada como patrimonial a efectos fiscales.</p><p>Las sociedades patrimoniales no pueden tener trabajadores contratados — las tareas de gestión las realizan los mismos socios. En consecuencia, no requieren sustancia económica demostrable, pero las entidades bancarias andorranas pueden exigir que al menos un socio sea residente en el Principado para abrir la cuenta bancaria correspondiente.</p><p>Las principales ventajas fiscales de esta estructura en Andorra incluyen: tributación reducida al 4% sobre rentas inmobiliarias en determinados supuestos, ausencia de impuesto sobre el patrimonio y sobre sucesiones, y la posibilidad de transmitir participaciones sin tributación sobre la transmisión. Esta última característica la hace especialmente útil como vehículo de planificación sucesoria familiar.</p><p>Es la estructura recomendada para: propietarios de inmuebles que quieren separar el patrimonio personal del empresarial, familias que quieren organizar la transmisión patrimonial entre generaciones, y residentes en Andorra que quieren gestionar inversiones financieras de forma ordenada.</p><h3>Cuadro resumen: criterios de selección</h3><p>La selección de la estructura óptima depende de múltiples factores: la naturaleza de la actividad, el perfil de los socios (residentes o no residentes), el volumen del patrimonio a gestionar, los objetivos de planificación sucesoria y las jurisdicciones implicadas. En ÀMBIT Associats analizamos cada caso de forma individualizada para diseñar la estructura más eficiente y sostenible a largo plazo.</p><p>Contacte con nosotros para una primera consulta sin compromiso.</p>`
    },
    {
      slug: "holding-andorra-regim-stve",
      title: "Holding en Andorra: régimen STVE, ventajas fiscales y requisitos de sustancia",
      category: "Estructuración Societaria",
      date: "Abril 2025",
      excerpt: "Régimen STVE, exención de dividendos y plusvalías, requisitos de sustancia económica y comparativa internacional. Guía técnica para family offices y grandes patrimonios.",
      content: `<h2>Holding en Andorra: régimen STVE, ventajas fiscales y requisitos de sustancia</h2><p>El holding andorrano se ha consolidado como una de las estructuras más eficientes de Europa para la gestión de patrimonios empresariales y familiares de entre 1 y 50 millones de euros. Andorra combina una tributación efectiva que puede llegar al 0% para determinadas estructuras, una conformidad plena con los estándares internacionales de transparencia (OCDE, FATF) y una ausencia total de impuestos sobre el patrimonio, las sucesiones y las donaciones.</p><h3>El régimen STVE: entidades de tenencia de valores extranjeros</h3><p>La Ley del Impuesto sobre Sociedades de Andorra (artículos 36-38) prevé un régimen especial para las entidades cuya finalidad exclusiva es la tenencia y gestión de participaciones en sociedades. Bajo este régimen, los dividendos y las plusvalías procedentes de filiales están exentos de tributación en Andorra. A diferencia de otras jurisdicciones europeas (Luxemburgo, Países Bajos), el régimen andorrano no exige una participación mínima ni un período mínimo de tenencia para disfrutar de la exención.</p><h3>Requisitos para acogerse al régimen STVE</h3><p>Para beneficiarse del régimen, la sociedad holding debe cumplir los requisitos de sustancia económica exigidos por las autoridades andorranas: disponer de una oficina física en el Principado, contar con personal propio (al menos una persona cualificada) y demostrar una dirección efectiva desde Andorra. Las filiales deben tributar al menos al 4% en su país de origen, o residir en un Estado que haya firmado un Convenio de Doble Imposición (CDI) con Andorra.</p><h3>Fiscalidad sobre dividendos: del holding al socio residente</h3><p>Cuando el titular del holding es una persona física residente fiscal en Andorra, los dividendos distribuidos por el holding andorrano al socio persona física no están sujetos a retención. A efectos prácticos, si la filial ha tributado en su país de origen al 5% por IRNR (por ejemplo, en virtud del CDI entre Andorra y España, artículo 10), y el holding aplica una deducción por doble imposición internacional, la tributación efectiva sobre el ciclo completo (beneficio filial → dividendo holding → distribución al socio) puede ser cercana al 0%.</p><h3>Comparativa internacional</h3><p>Respecto a los centros financieros tradicionales, Andorra presenta ventajas diferenciales: Suiza ofrece mayor red de CDIs pero una carga fiscal superior (participación del 20-25% a nivel cantonal). Luxemburgo permite estructuras más complejas pero requiere sustancia significativa y la carga regulatoria es mayor. El Principado, por su parte, combina eficiencia fiscal, baja complejidad operativa y conformidad internacional total.</p><h3>¿Para quién es recomendable un holding andorrano?</h3><p>La estructura es especialmente relevante para: empresarios que poseen diversas sociedades operativas en España, Francia u otros países y quieren centralizar la gestión y optimizar la fiscalidad sobre dividendos; family offices que buscan una jurisdicción eficiente para la gestión patrimonial intergeneracional; y residentes en Andorra con participaciones significativas en sociedades extranjeras que quieren estructurar la tenencia a través de un vehículo andorrano.</p><p>En ÀMBIT Associats asesoramos en el diseño y la constitución de estructuras holding en Andorra, incluido el cumplimiento de los requisitos de sustancia, la redacción de estatutos, la coordinación con notario y la gestión contable y fiscal posterior.</p>`
    },
    {
      slug: "planificacio-patrimonial-successions-andorra",
      title: "Planificación patrimonial y sucesoria en Andorra: herramientas legales y ventajas fiscales",
      category: "Planificación Patrimonial",
      date: "Marzo 2025",
      excerpt: "Andorra no tiene impuesto sobre sucesiones ni sobre el patrimonio. Analizamos las herramientas legales disponibles para la planificación sucesoria: sociedades patrimoniales, donación escalonada, pactos sucesorios y seguros de vida.",
      content: `<h2>Planificación patrimonial y sucesoria en Andorra: herramientas legales y ventajas fiscales</h2><p>Uno de los atractivos fiscales más relevantes de Andorra para las familias con patrimonio es la ausencia total de impuesto sobre sucesiones, de impuesto sobre el patrimonio y de impuesto sobre donaciones. Esta circunstancia crea un entorno único en Europa para la planificación sucesoria y la transmisión de patrimonio entre generaciones.</p><h3>Ausencia de impuestos patrimoniales: impacto real</h3><p>En España, el impuesto sobre sucesiones puede alcanzar el 34% en ciertas comunidades autónomas para herencias de hermanos, tíos o personas sin vínculo familiar. En Francia, el tipo máximo para líneas colaterales es del 60%. En Andorra, la transmisión por herencia o donación no genera ninguna tributación adicional, ni a nivel de impuesto de sucesiones ni de impuesto sobre el patrimonio. Las plusvalías derivadas de la transmisión de acciones de sociedades andorranas tampoco están sujetas a tributación cuando la participación supera el 25% y se ha mantenido durante más de 10 años.</p><h3>Herramientas legales para la planificación sucesoria</h3><p><strong>1. Sociedad patrimonial como vehículo de transmisión:</strong> La constitución de una sociedad patrimonial que agrupe los inmuebles y activos financieros del patrimonio familiar permite organizar la transmisión futura no como una sucesión de inmuebles (procedimiento complejo, con intervención notarial y registral para cada bien), sino como una transmisión de participaciones sociales. Esta estructura ofrece mayor flexibilidad, confidencialidad y eficiencia operativa.</p><p><strong>2. Donación escalonada de acciones:</strong> Los padres pueden transferir progresivamente las participaciones de la sociedad patrimonial a los hijos, manteniendo el control de gestión mediante usufructo o derechos de voto diferenciados. Esta técnica permite anticipar la transmisión patrimonial de forma ordenada, sin tributación por donación en Andorra.</p><p><strong>3. Pactos sucesorios:</strong> El derecho civil andorrano permite la formalización de pactos sucesorios entre el causante y los herederos en vida, lo que ofrece seguridad jurídica y evita conflictos familiares posteriores. Estos pactos pueden regular la distribución de los bienes, el mantenimiento de la unidad patrimonial y los derechos de los herederos forzosos.</p><p><strong>4. Seguros de vida como instrumento patrimonial:</strong> La suscripción de una póliza de seguro de vida vinculada a activos financieros permite designar beneficiarios libremente (sin restricciones de legítima) y organizar la distribución del patrimonio financiero de forma rápida y confidencial. En Andorra, las prestaciones de los seguros de vida no están sujetas a tributación en manos del beneficiario.</p><h3>Planificación en contexto transfronterizo</h3><p>Para residentes en Andorra con bienes o herederos en España o Francia, la planificación sucesoria requiere un enfoque transfronterizo que tenga en cuenta el Reglamento Europeo de Sucesiones (UE) 650/2012 (no aplicable directamente a Andorra por no ser miembro de la UE, pero con incidencia en las herencias transfronterizas), los CDIs firmados por Andorra y la normativa de cada jurisdicción donde se encuentran ubicados los bienes o donde residen los herederos.</p><p>En ÀMBIT Associats diseñamos planes patrimoniales integrales que integran los aspectos civiles, fiscales y familiares, coordinándonos con notarios andorranos y, cuando es necesario, con asesores legales de las jurisdicciones implicadas.</p>`
    },
    {
      slug: "trasllat-residencia-andorra",
      title: "Traslado de residencia a Andorra: tipos de residencia, requisitos y planificación",
      category: "Residencia",
      date: "Febrero 2025",
      excerpt: "Residencia activa, pasiva y por inversión: diferencias, requisitos y planificación previa al traslado. Todo lo que debes saber antes de cambiar la residencia fiscal a Andorra.",
      content: `<h2>Traslado de residencia a Andorra: tipos de residencia, requisitos y planificación</h2><p>Andorra es el cuarto país del mundo con la renta per cápita más alta y uno de los territorios europeos con menor carga fiscal para personas físicas. El traslado de residencia fiscal al Principado es una opción legalmente válida y crecientemente habitual entre empresarios, profesionales del ámbito digital, deportistas de élite y familias con patrimonio. No obstante, es necesario planificar adecuadamente el proceso para garantizar la efectividad del cambio de residencia fiscal y evitar conflictos con las autoridades tributarias del país de origen.</p><h3>Tipos de residencia en Andorra</h3><p><strong>Residencia activa por cuenta propia:</strong> Para empresarios y autónomos que quieren crear o gestionar una actividad económica en el Principado. Requiere constituir una sociedad andorrana o darse de alta como autónomo, disponer de un local u oficina, y demostrar una actividad económica real. El solicitante debe residir efectivamente en Andorra al menos 183 días al año.</p><p><strong>Residencia pasiva:</strong> Para personas que quieren establecer su residencia fiscal en Andorra sin ejercer una actividad económica en el Principado. Requiere acreditar una inversión mínima de 600.000 euros en activos andorranos (inmuebles, depósitos bancarios o participaciones en sociedades andorranas) y demostrar que se dispone de rentas suficientes para vivir sin trabajar en Andorra. La residencia pasiva no permite trabajar en el Principado.</p><p><strong>Residencia por cuenta ajena:</strong> Para trabajadores por cuenta ajena que han obtenido un contrato laboral con una empresa andorrana. La residencia se vincula a la relación laboral y permite acceder al sistema de seguridad social andorrana (CASS) y a los beneficios fiscales del Principado.</p><h3>Planificación previa al traslado: aspectos clave</h3><p>El cambio de residencia fiscal no es inmediato y requiere planificación. Aspectos fundamentales a considerar: (1) El exit tax en España: los residentes españoles que trasladan la residencia fuera de España con activos (acciones, participaciones) valorados en más de 4 millones de euros, o con ganancias potenciales superiores a 1 millón de euros, pueden estar sujetos al exit tax español. Es necesario planificar la transmisión de activos previamente. (2) El CDI Andorra-España: el Convenio de Doble Imposición firmado en 2015 establece los criterios de residencia fiscal y la distribución de la potestad tributaria sobre cada tipo de renta. Es necesario analizar la situación personal del contribuyente para determinar el impacto real del cambio. (3) La sustancia real en Andorra: para ser efectivo el cambio de residencia fiscal, el contribuyente debe demostrar que Andorra es su centro de intereses vitales: residencia efectiva, vida social, gestión de los negocios desde el Principado.</p><p>En ÀMBIT Associats acompañamos todo el proceso de traslado de residencia, desde el análisis inicial de la situación fiscal hasta los trámites administrativos y la gestión contable y fiscal posterior en Andorra.</p>`
    },
    {
      slug: "cdi-andorra-espanya",
      title: "Convenio de Doble Imposición Andorra-España: análisis técnico por artículo",
      category: "Fiscalidad Internacional",
      date: "Enero 2025",
      excerpt: "El CDI firmado en 2015 entre Andorra y España establece las reglas de tributación sobre dividendos, intereses, plusvalías, salarios y pensiones. Análisis técnico para residentes y empresas que operan en ambos países.",
      content: `<h2>Convenio de Doble Imposición Andorra-España: análisis técnico por artículo</h2><p>El Convenio para evitar la Doble Imposición (CDI) firmado entre Andorra y España el 8 de enero de 2015 (en vigor desde el 26 de febrero de 2016) es uno de los instrumentos legales más relevantes para empresarios, inversores y particulares que mantienen relaciones económicas entre ambos países. El CDI distribuye la potestad tributaria sobre cada tipo de renta entre los dos estados signatarios, evitando que una misma renta tribute dos veces.</p><h3>Residencia fiscal: criterio de desempate (artículo 4)</h3><p>El CDI establece los criterios para determinar la residencia fiscal cuando una persona puede ser considerada residente por ambos estados: en primer lugar se aplica el criterio del hogar permanente; en segundo lugar, el centro de intereses vitales (donde se encuentran las relaciones personales y económicas más estrechas); en tercer lugar, el lugar de estancia habitual (183 días); y finalmente la nacionalidad. Para las personas que trasladan la residencia de España a Andorra, es fundamental acreditar que el centro de intereses vitales se ha desplazado efectivamente al Principado.</p><h3>Dividendos (artículo 10)</h3><p>Los dividendos pagados por una sociedad española a un residente andorrano tributan en España por IRNR al 5% cuando el perceptor es una sociedad que posee al menos el 10% del capital de la sociedad pagadora, y al 15% en el resto de casos. En Andorra, el beneficiario puede aplicar la deducción por doble imposición internacional sobre el impuesto pagado en España, de manera que la tributación efectiva adicional en Andorra puede ser del 0%. Para los holdings andorranos acogidos al régimen STVE, los dividendos recibidos están exentos en Andorra, resultando en una tributación total del 5% (la retención española).</p><h3>Intereses (artículo 11)</h3><p>Los intereses pagados por un residente español a un residente andorrano tributan en España al 5% en concepto de IRNR. En Andorra, se aplica la deducción por doble imposición, pudiendo resultar en una tributación neta en el Principado del 5-10% en función de la situación fiscal del perceptor.</p><h3>Plusvalías (artículo 13)</h3><p>Las plusvalías derivadas de la transmisión de inmuebles situados en España tributan en España (generalmente al 19-24% para no residentes). Las plusvalías derivadas de la transmisión de acciones o participaciones en sociedades que el 50% de los activos sean inmuebles españoles, también tributan en España. Para el resto de ganancias de capital (acciones de sociedades no inmobiliarias, fondos de inversión, etc.), la potestad tributaria corresponde exclusivamente al país de residencia del transmitente.</p><h3>Pensiones y salarios (artículos 15-18)</h3><p>Los salarios tributan en el país donde se ejerce el trabajo, con excepciones para trabajadores fronterizos y determinadas categorías (trabajadores del sector público, estudiantes, profesores). Las pensiones privadas tributan en el país de residencia del perceptor. Las pensiones de la seguridad social española percibidas por residentes andorranos tributan exclusivamente en España.</p><p>En ÀMBIT Associats analizamos la situación fiscal individual de cada cliente en el contexto del CDI para optimizar la planificación fiscal transfronterera de forma rigurosa y conforme a la normativa vigente.</p>`
    },
  ],
  en: [
    {
      slug: "constitucio-societats-andorra",
      title: "Company Incorporation in Andorra: Comparative Guide",
      category: "Corporate Law",
      date: "May 2025",
      excerpt: "Limited company, public limited company, holding or asset-holding company: which corporate structure suits each business project in Andorra? Technical analysis of the four main legal vehicles, with selection criteria by investor profile.",
      content: `<h2>Company Incorporation in Andorra: Comparative Guide to Legal Structures</h2><p>Andorra offers investors and entrepreneurs a modern legal framework and competitive taxation to establish their business or structure their assets. However, choosing the appropriate legal form is a strategic decision that conditions operations, taxation, and long-term succession planning. In this article, we analyse the four main structures available in the Principality.</p><h3>1. Limited Company (SL)</h3><p>The SL is the most common legal form for SMEs and self-employed individuals who wish to operate with limited liability. The minimum capital is €3,000, divided into non-freely transferable shares. The liability of shareholders is limited to their contribution. The applicable Corporation Tax is 10% on net profit, with possible reductions to 2-5% for certain cases.</p><p>This is the recommended structure for: new local business activities, liberal professionals wishing to operate through a company, and small investors starting an activity in Andorra.</p><h3>2. Public Limited Company (SA)</h3><p>The SA requires a minimum capital of €60,000, divided into freely transferable shares. It allows a complex shareholding structure, with the possibility of issuing different classes of shares. It is the standard form for large corporations and companies that plan to bring in external investors or list on regulated markets.</p><p>This is the recommended structure for: high-volume businesses, projects that will require external financing, and corporate groups that need a flexible parent company.</p><h3>3. Holding Company (STVE Regime)</h3><p>Andorra provides a special tax regime for entities holding foreign securities (the STVE regime, articles 36-38 of the Andorran Corporation Tax Act). Under this regime, dividends and capital gains from subsidiary shareholdings are exempt from taxation in the Principality, provided certain economic substance requirements are met: the holding must have its own office and staff in Andorra, and subsidiaries must pay at least 4% tax in their country of origin or reside in a country with a DTT with Andorra.</p><p>Unlike the general exemption regime, the STVE regime does not require a minimum shareholding or minimum holding period. When the holder of the holding is an individual resident in Andorra, the dividends distributed by the Andorran holding to that person are not subject to withholding, resulting in effective taxation close to 0%.</p><p>This is the recommended structure for: family offices, entrepreneurs managing several companies internationally, and large estates wishing to centralise investment management and optimise taxation on dividends and capital gains.</p><h3>4. Asset-Holding Company</h3><p>An Andorran asset-holding company is an SL or SA whose sole purpose is the holding and management of real property or financial assets of its shareholders, without carrying out any commercial economic activity. If 50% or more of the company's assets are not allocated to an economic activity, the company is classified as asset-holding for tax purposes.</p><p>Asset-holding companies cannot have contracted employees — management tasks are carried out by the shareholders themselves. Consequently, they do not require demonstrable economic substance, but Andorran banks may require that at least one shareholder is resident in the Principality to open the corresponding bank account.</p><p>The main tax advantages of this structure in Andorra include: reduced taxation at 4% on real estate income in certain cases, no wealth or inheritance tax, and the ability to transfer shares without taxation on the transfer. This last feature makes it particularly useful as a vehicle for family succession planning.</p><p>This is the recommended structure for: property owners wishing to separate personal from business assets, families wishing to organise the intergenerational transfer of assets, and residents of Andorra wishing to manage financial investments in an orderly manner.</p><h3>Summary table: selection criteria</h3><p>The selection of the optimal structure depends on multiple factors: the nature of the activity, the profile of the shareholders (residents or non-residents), the volume of assets to be managed, succession planning objectives, and the jurisdictions involved. At ÀMBIT Associats, we analyse each case individually to design the most efficient and sustainable long-term structure.</p><p>Contact us for an initial no-obligation consultation.</p>`
    },
    {
      slug: "holding-andorra-regim-stve",
      title: "Holding Company in Andorra: STVE Regime, Tax Benefits and Substance Requirements",
      category: "Corporate Structuring",
      date: "April 2025",
      excerpt: "STVE regime, exemption of dividends and capital gains, economic substance requirements and international comparison. Technical guide for family offices and large estates.",
      content: `<h2>Holding Company in Andorra: STVE Regime, Tax Benefits and Substance Requirements</h2><p>The Andorran holding company has established itself as one of the most efficient structures in Europe for managing business and family assets of between 1 and 50 million euros. Andorra combines effective taxation that can reach 0% for certain structures, full compliance with international transparency standards (OECD, FATF), and a total absence of taxes on wealth, inheritance, and gifts.</p><h3>The STVE Regime: Entities Holding Foreign Securities</h3><p>The Andorran Corporation Tax Act (articles 36-38) provides a special regime for entities whose sole purpose is the holding and management of shareholdings in companies. Under this regime, dividends and capital gains from subsidiaries are exempt from taxation in Andorra. Unlike other European jurisdictions (Luxembourg, Netherlands), the Andorran regime does not require a minimum shareholding or minimum holding period to enjoy the exemption.</p><h3>Requirements for the STVE Regime</h3><p>To benefit from the regime, the holding company must meet the economic substance requirements demanded by the Andorran authorities: have a physical office in the Principality, employ its own staff (at least one qualified person), and demonstrate effective management from Andorra. Subsidiaries must pay at least 4% tax in their country of origin, or reside in a State that has signed a Double Taxation Treaty (DTT) with Andorra.</p><h3>Taxation on Dividends: From the Holding to the Resident Shareholder</h3><p>When the holder of the holding is an individual tax resident in Andorra, the dividends distributed by the Andorran holding to the individual shareholder are not subject to withholding. In practice, if the subsidiary has paid 5% NRIT in its country of origin (for example, under the DTT between Andorra and Spain, article 10), and the holding applies a double taxation relief, the effective taxation over the complete cycle (subsidiary profit → holding dividend → distribution to shareholder) can be close to 0%.</p><h3>International Comparison</h3><p>Compared to traditional financial centres, Andorra offers differential advantages: Switzerland offers a wider DTT network but higher tax burden (20-25% at cantonal level). Luxembourg allows more complex structures but requires significant substance and the regulatory burden is higher. The Principality, for its part, combines tax efficiency, low operational complexity, and full international compliance.</p><h3>Who is an Andorran Holding Suitable For?</h3><p>This structure is particularly relevant for: entrepreneurs who own several operating companies in Spain, France, or other countries and wish to centralise management and optimise taxation on dividends; family offices seeking an efficient jurisdiction for intergenerational wealth management; and residents of Andorra with significant shareholdings in foreign companies who wish to structure their holdings through an Andorran vehicle.</p><p>At ÀMBIT Associats, we advise on the design and incorporation of holding structures in Andorra, including compliance with substance requirements, drafting of articles of association, coordination with notaries, and subsequent accounting and tax management.</p>`
    },
    {
      slug: "planificacio-patrimonial-successions-andorra",
      title: "Estate and Succession Planning in Andorra: Legal Tools and Tax Advantages",
      category: "Estate Planning",
      date: "March 2025",
      excerpt: "Andorra has no inheritance or wealth tax. We analyse the legal tools available for succession planning: asset-holding companies, staggered gifting, succession agreements and life insurance.",
      content: `<h2>Estate and Succession Planning in Andorra: Legal Tools and Tax Advantages</h2><p>One of the most relevant tax attractions of Andorra for families with assets is the total absence of inheritance tax, wealth tax, and gift tax. This circumstance creates a unique environment in Europe for succession planning and the transfer of wealth between generations.</p><h3>Absence of Wealth Taxes: Real Impact</h3><p>In Spain, inheritance tax can reach 34% in certain autonomous communities for inheritances between siblings, uncles/aunts, or unrelated persons. In France, the maximum rate for collateral lines is 60%. In Andorra, the transfer by inheritance or gift does not generate any additional taxation, neither at the level of inheritance tax nor wealth tax. Capital gains from the transfer of shares in Andorran companies are also not subject to taxation when the shareholding exceeds 25% and has been held for more than 10 years.</p><h3>Legal Tools for Succession Planning</h3><p><strong>1. Asset-holding company as a transfer vehicle:</strong> The incorporation of an asset-holding company that groups the real estate and financial assets of the family estate allows the organisation of future transfers not as a succession of real estate (a complex procedure requiring notarial and registry intervention for each asset), but as a transfer of shares. This structure offers greater flexibility, confidentiality, and operational efficiency.</p><p><strong>2. Staggered gifting of shares:</strong> Parents can progressively transfer the shareholdings of the asset-holding company to their children, maintaining management control through usufruct or differentiated voting rights. This technique allows the anticipation of asset transfers in an orderly manner, without gift taxation in Andorra.</p><p><strong>3. Succession agreements:</strong> Andorran civil law allows the formalisation of succession agreements between the testator and heirs during their lifetime, which provides legal certainty and avoids subsequent family conflicts. These agreements can regulate the distribution of assets, the maintenance of the estate's unity, and the rights of forced heirs.</p><p><strong>4. Life insurance as an estate instrument:</strong> The subscription of a life insurance policy linked to financial assets allows the free designation of beneficiaries (without legitimate portion restrictions) and the rapid and confidential organisation of the distribution of financial assets. In Andorra, life insurance payments are not subject to taxation in the hands of the beneficiary.</p><h3>Cross-Border Planning</h3><p>For residents of Andorra with assets or heirs in Spain or France, succession planning requires a cross-border approach that takes into account the European Succession Regulation (EU) 650/2012 (not directly applicable to Andorra as it is not an EU member, but with impact on cross-border inheritances), the DTTs signed by Andorra, and the legislation of each jurisdiction where the assets are located or where the heirs reside.</p><p>At ÀMBIT Associats, we design comprehensive estate plans that integrate civil, tax, and family aspects, coordinating with Andorran notaries and, when necessary, with legal advisors from the jurisdictions involved.</p>`
    },
    {
      slug: "trasllat-residencia-andorra",
      title: "Relocation of Residence to Andorra: Types of Residence, Requirements and Planning",
      category: "Residence",
      date: "February 2025",
      excerpt: "Active, passive and investment residence: differences, requirements and pre-move planning. Everything you need to know before changing your tax residence to Andorra.",
      content: `<h2>Relocation of Residence to Andorra: Types of Residence, Requirements and Planning</h2><p>Andorra is the fourth country in the world with the highest per capita income and one of the European territories with the lowest tax burden for individuals. The transfer of tax residence to the Principality is a legally valid and increasingly common option among entrepreneurs, digital professionals, elite athletes, and families with assets. However, the process must be adequately planned to guarantee the effectiveness of the change of tax residence and avoid conflicts with the tax authorities of the country of origin.</p><h3>Types of Residence in Andorra</h3><p><strong>Active residence on own account:</strong> For entrepreneurs and self-employed individuals who wish to create or manage an economic activity in the Principality. It requires the incorporation of an Andorran company or registration as self-employed, having a premises or office, and demonstrating real economic activity. The applicant must effectively reside in Andorra for at least 183 days per year.</p><p><strong>Passive residence:</strong> For individuals who wish to establish their tax residence in Andorra without carrying out an economic activity in the Principality. It requires proof of a minimum investment of €600,000 in Andorran assets (real estate, bank deposits, or shareholdings in Andorran companies) and proof of sufficient income to live without working in Andorra. Passive residence does not allow working in the Principality.</p><p><strong>Residence for third party:</strong> For employees who have obtained an employment contract with an Andorran company. Residence is linked to the employment relationship and provides access to the Andorran social security system (CASS) and the Principality's tax benefits.</p><h3>Pre-Move Planning: Key Aspects</h3><p>The change of tax residence is not immediate and requires planning. Fundamental aspects to consider: (1) Exit tax in Spain: Spanish residents who transfer their residence outside Spain with assets (shares, holdings) valued at more than 4 million euros, or with potential gains exceeding 1 million euros, may be subject to Spanish exit tax. Prior asset transfers must be planned. (2) The Andorra-Spain DTT: the Double Taxation Treaty signed in 2015 establishes the criteria for tax residence and the distribution of taxing powers over each type of income. The taxpayer's personal situation must be analysed to determine the real impact of the change. (3) Real substance in Andorra: for the change of tax residence to be effective, the taxpayer must demonstrate that Andorra is their centre of vital interests: effective residence, social life, management of business from the Principality.</p><p>At ÀMBIT Associats, we accompany the entire residence transfer process, from the initial analysis of the tax situation to administrative procedures and subsequent accounting and tax management in Andorra.</p>`
    },
    {
      slug: "cdi-andorra-espanya",
      title: "Andorra-Spain Double Taxation Treaty: Technical Analysis by Article",
      category: "International Taxation",
      date: "January 2025",
      excerpt: "The DTT signed in 2015 between Andorra and Spain establishes the rules of taxation on dividends, interest, capital gains, salaries and pensions. Technical analysis for residents and companies operating in both countries.",
      content: `<h2>Andorra-Spain Double Taxation Treaty: Technical Analysis by Article</h2><p>The Convention for the Avoidance of Double Taxation (DTT) signed between Andorra and Spain on 8 January 2015 (in force since 26 February 2016) is one of the most relevant legal instruments for entrepreneurs, investors, and individuals who maintain economic relations between both countries. The DTT distributes the taxing powers over each type of income between the two signatory states, preventing the same income from being taxed twice.</p><h3>Tax Residence: Tie-Breaker Rule (Article 4)</h3><p>The DTT establishes the criteria for determining tax residence when a person could be considered resident by both states: first, the permanent home criterion applies; second, the centre of vital interests (where the closest personal and economic relationships are located); third, the habitual place of abode (183 days); and finally nationality. For individuals transferring residence from Spain to Andorra, it is essential to prove that the centre of vital interests has effectively moved to the Principality.</p><h3>Dividends (Article 10)</h3><p>Dividends paid by a Spanish company to an Andorran resident are taxed in Spain at 5% NRIT when the recipient is a company that owns at least 10% of the paying company's capital, and at 15% in all other cases. In Andorra, the beneficiary can apply the double taxation relief on the tax paid in Spain, so that the additional effective taxation in Andorra can be 0%. For Andorran holdings under the STVE regime, the dividends received are exempt in Andorra, resulting in total taxation of 5% (the Spanish withholding).</p><h3>Interest (Article 11)</h3><p>Interest paid by a Spanish resident to an Andorran resident is taxed in Spain at 5% as NRIT. In Andorra, double taxation relief applies, potentially resulting in net taxation in the Principality of 5-10% depending on the recipient's tax situation.</p><h3>Capital Gains (Article 13)</h3><p>Capital gains from the transfer of real estate located in Spain are taxed in Spain (generally at 19-24% for non-residents). Capital gains from the transfer of shares or interests in companies where 50% of the assets are Spanish real estate are also taxed in Spain. For all other capital gains (shares of non-real estate companies, investment funds, etc.), the taxing power corresponds exclusively to the country of residence of the transferor.</p><h3>Pensions and Salaries (Articles 15-18)</h3><p>Salaries are taxed in the country where the work is performed, with exceptions for frontier workers and certain categories (public sector workers, students, teachers). Private pensions are taxed in the country of residence of the recipient. Spanish social security pensions received by Andorran residents are taxed exclusively in Spain.</p><p>At ÀMBIT Associats, we analyse each client's individual tax situation in the context of the DTT to optimise cross-border tax planning rigorously and in accordance with current regulations.</p>`
    },
  ],
  fr: [
    {
      slug: "constitucio-societats-andorra",
      title: "Constitution de sociétés en Andorre : guide comparatif",
      category: "Droit Commercial",
      date: "Mai 2025",
      excerpt: "SARL, SA, holding ou société patrimoniale : quelle structure sociétaire convient à chaque projet entrepreneurial en Andorre ? Analyse technique des quatre véhicules juridiques principaux, avec critères de sélection par profil d'investisseur.",
      content: `<h2>Constitution de sociétés en Andorre : guide comparatif des structures juridiques</h2><p>L'Andorre offre aux investisseurs et entrepreneurs un cadre juridique moderne et une fiscalité compétitive pour établir leur entreprise ou véhiculer leur patrimoine. Cependant, le choix de la forme juridique adéquate est une décision stratégique qui conditionne l'exploitation, la fiscalité et la planification successorale à long terme. Dans cet article, nous analysons les quatre structures principales disponibles dans la Principauté.</p><h3>1. Société à Responsabilité Limitée (SARL)</h3><p>La SARL est la forme juridique la plus courante pour les PME et les travailleurs indépendants souhaitant opérer avec une responsabilité limitée. Le capital minimum est de 3.000 euros, divisé en parts sociales non librement transmissibles. La responsabilité des associés est limitée à leur apport. L'impôt sur les sociétés applicable est de 10% sur le bénéfice net, avec des réductions possibles à 2-5% pour certains cas.</p><p>C'est la structure recommandée pour : les nouvelles activités commerciales locales, les professionnels libéraux souhaitant opérer en société, et les petits investisseurs débutant une activité en Andorre.</p><h3>2. Société Anonyme (SA)</h3><p>La SA exige un capital minimum de 60.000 euros, divisé en actions librement transmissibles. Elle permet une structure actionnariale complexe, avec la possibilité d'émettre différentes classes d'actions. C'est la forme habituelle pour les grandes corporations et les entreprises qui prévoient d'accueillir des investisseurs externes ou de coter sur des marchés réglementés.</p><p>C'est la structure recommandée pour : les entreprises de grand volume, les projets nécessitant un financement externe, et les groupes d'entreprises nécessitant une société mère flexible.</p><h3>3. Société Holding (régime STVE)</h3><p>L'Andorre prévoit un régime fiscal spécial pour les entités de détention de valeurs étrangères (régime STVE, articles 36-38 de la Loi de l'IS andorrane). Selon ce régime, les dividendes et les plus-values provenant de participations dans des sociétés filiales sont exemptés de taxation dans la Principauté, à condition que certains critères de substance économique soient remplis : le holding doit disposer d'un bureau et d'un personnel propre en Andorre, et les filiales doivent payer au moins 4% d'impôts dans leur pays d'origine ou résider dans un pays ayant signé un CDI avec l'Andorre.</p><p>Contrairement au régime général d'exemption, le régime STVE n'exige pas une participation minimum ni une période minimum de détention. Lorsque le titulaire du holding est une personne physique résidente en Andorre, les dividendes distribués par le holding andorran à cette personne ne sont pas soumis à retenue à la source, ce qui se traduit par une fiscalité effective proche de 0%.</p><p>C'est la structure recommandée pour : les family offices, les entrepreneurs gérant plusieurs sociétés à l'échelle internationale, et les grands patrimoines souhaitant centraliser la gestion des investissements et optimiser la fiscalité sur dividendes et plus-values.</p><h3>4. Société Patrimoniale</h3><p>Une société patrimoniale andorrane est une SARL ou SA dont la finalité exclusive est la détention et la gestion de biens immobiliers ou d'actifs financiers de ses associés, sans exercer aucune activité économique commerciale. Si 50% ou plus de l'actif de la société n'est pas destiné à une activité économique, la société est classée comme patrimoniale à des fins fiscales.</p><p>Les sociétés patrimoniales ne peuvent pas avoir de travailleurs sous contrat — les tâches de gestion sont réalisées par les associés eux-mêmes. Par conséquent, elles ne nécessitent pas de substance économique démontrable, mais les entités bancaires andorranes peuvent exiger qu'au moins un associé soit résident dans la Principauté pour ouvrir le compte bancaire correspondant.</p><p>Les principaux avantages fiscaux de cette structure en Andorre incluent : une taxation réduite à 4% sur les revenus immobiliers dans certains cas, l'absence d'impôt sur la fortune et sur les successions, et la possibilité de transmettre des participations sans taxation sur la transmission. Cette dernière caractéristique la rend particulièrement utile comme véhicule de planification successorale familiale.</p><p>C'est la structure recommandée pour : les propriétaires d'immeubles souhaitant séparer le patrimoine personnel de celui de l'entreprise, les familles souhaitant organiser la transmission patrimoniale entre générations, et les résidents en Andorre souhaitant gérer des investissements financiers de manière ordonnée.</p><h3>Tableau récapitulatif : critères de sélection</h3><p>La sélection de la structure optimale dépend de multiples facteurs : la nature de l'activité, le profil des associés (résidents ou non résidents), le volume du patrimoine à gérer, les objectifs de planification successorale et les juridictions impliquées. Chez ÀMBIT Associats, nous analysons chaque cas de manière individualisée pour concevoir la structure la plus efficiente et durable à long terme.</p><p>Contactez-nous pour une première consultation sans engagement.</p>`
    },
    {
      slug: "holding-andorra-regim-stve",
      title: "Holding en Andorre : régime STVE, avantages fiscaux et exigences de substance",
      category: "Structuration Sociétaire",
      date: "Avril 2025",
      excerpt: "Régime STVE, exemption de dividendes et plus-values, exigences de substance économique et comparatif international. Guide technique pour family offices et grands patrimoines.",
      content: `<h2>Holding en Andorre : régime STVE, avantages fiscaux et exigences de substance</h2><p>Le holding andorran s'est imposé comme l'une des structures les plus efficientes d'Europe pour la gestion de patrimoines entrepreneuriaux et familiaux de 1 à 50 millions d'euros. L'Andorre combine une fiscalité effective pouvant atteindre 0% pour certaines structures, une conformité totale aux normes internationales de transparence (OCDE, GAFI) et une absence totale d'impôts sur la fortune, les successions et les donations.</p><h3>Le régime STVE : entités de détention de valeurs étrangères</h3><p>La Loi de l'Impôt sur les Sociétés d'Andorre (articles 36-38) prévoit un régime spécial pour les entités dont la finalité exclusive est la détention et la gestion de participations dans des sociétés. Selon ce régime, les dividendes et les plus-values provenant de filiales sont exemptés de taxation en Andorre. Contrairement à d'autres juridictions européennes (Luxembourg, Pays-Bas), le régime andorran n'exige pas une participation minimum ni une période minimum de détention pour bénéficier de l'exemption.</p><h3>Exigences pour bénéficier du régime STVE</h3><p>Pour bénéficier du régime, la société holding doit remplir les exigences de substance économique exigées par les autorités andorranes : disposer d'un bureau physique dans la Principauté, employer du personnel propre (au moins une personne qualifiée) et démontrer une direction effective depuis l'Andorre. Les filiales doivent payer au moins 4% d'impôts dans leur pays d'origine, ou résider dans un État ayant signé une Convention de Double Imposition (CDI) avec l'Andorre.</p><h3>Fiscalité sur les dividendes : du holding à l'associé résident</h3><p>Lorsque le titulaire du holding est une personne physique résidente fiscale en Andorre, les dividendes distribués par le holding andorran à l'associé personne physique ne sont pas soumis à retenue à la source. En pratique, si la filiale a payé 5% d'IRNR dans son pays d'origine (par exemple, en vertu du CDI entre l'Andorre et l'Espagne, article 10), et que le holding applique une déduction pour double imposition internationale, la fiscalité effective sur le cycle complet (bénéfice filiale → dividende holding → distribution à l'associé) peut être proche de 0%.</p><h3>Comparatif international</h3><p>Par rapport aux centres financiers traditionnels, l'Andorre présente des avantages différentiels : la Suisse offre un réseau plus étendu de CDIs mais une charge fiscale supérieure (participation de 20-25% au niveau cantonal). Le Luxembourg permet des structures plus complexes mais exige une substance significative et la charge réglementaire est plus lourde. La Principauté, quant à elle, combine l'efficacité fiscale, une faible complexité opérationnelle et une conformité internationale totale.</p><h3>Pour qui un holding andorran est-il recommandé ?</h3><p>Cette structure est particulièrement pertinente pour : les entrepreneurs possédant plusieurs sociétés opérationnelles en Espagne, en France ou dans d'autres pays et souhaitant centraliser la gestion et optimiser la fiscalité sur les dividendes ; les family offices recherchant une juridiction efficiente pour la gestion patrimoniale intergénérationnelle ; et les résidents en Andorre détenant des participations significatives dans des sociétés étrangères qui souhaitent structurer la détention par le biais d'un véhicule andorran.</p><p>Chez ÀMBIT Associats, nous conseillons pour la conception et la constitution de structures holding en Andorre, y compris le respect des exigences de substance, la rédaction de statuts, la coordination avec le notaire et la gestion comptable et fiscale ultérieure.</p>`
    },
    {
      slug: "planificacio-patrimonial-successions-andorra",
      title: "Planification patrimoniale et successorale en Andorre : outils juridiques et avantages fiscaux",
      category: "Planification Patrimoniale",
      date: "Mars 2025",
      excerpt: "L'Andorre n'a pas d'impôt sur les successions ni sur la fortune. Nous analysons les outils juridiques disponibles pour la planification successorale : sociétés patrimoniales, donation échelonnée, pactes successoraux et assurances-vie.",
      content: `<h2>Planification patrimoniale et successorale en Andorre : outils juridiques et avantages fiscaux</h2><p>L'un des attraits fiscaux les plus pertinents de l'Andorre pour les familles fortunées est l'absence totale d'impôt sur les successions, d'impôt sur la fortune et d'impôt sur les donations. Cette circonstance crée un environnement unique en Europe pour la planification successorale et la transmission de patrimoine entre générations.</p><h3>Absence d'impôts patrimoniaux : impact réel</h3><p>En Espagne, l'impôt sur les successions peut atteindre 34% dans certaines communautés autonomes pour les héritages entre frères, oncles ou personnes sans lien familial. En France, le taux maximum pour les lignes collatérales est de 60%. En Andorre, la transmission par héritage ou donation ne génère aucune taxation supplémentaire, ni au niveau de l'impôt sur les successions ni de l'impôt sur la fortune. Les plus-values découlant de la transmission d'actions de sociétés andorranes ne sont pas non plus soumises à taxation lorsque la participation dépasse 25% et a été détenue pendant plus de 10 ans.</p><h3>Outils juridiques pour la planification successorale</h3><p><strong>1. Société patrimoniale comme véhicule de transmission :</strong> La constitution d'une société patrimoniale qui regroupe les biens immobiliers et actifs financiers du patrimoine familial permet d'organiser la transmission future non pas comme une succession de biens immobiliers (procédure complexe, avec intervention notariale et registrale pour chaque bien), mais comme une transmission de parts sociales. Cette structure offre une plus grande flexibilité, confidentialité et efficacité opérationnelle.</p><p><strong>2. Donation échelonnée d'actions :</strong> Les parents peuvent transférer progressivement les participations de la société patrimoniale aux enfants, en conservant le contrôle de gestion par usufruit ou droits de vote différenciés. Cette technique permet d'anticiper la transmission patrimoniale de manière ordonnée, sans taxation pour donation en Andorre.</p><p><strong>3. Pactes successoraux :</strong> Le droit civil andorran permet la formalisation de pactes successoraux entre le défunt et les héritiers de son vivant, ce qui offre une sécurité juridique et évite les conflits familiaux ultérieurs. Ces pactes peuvent réguler la distribution des biens, le maintien de l'unité patrimoniale et les droits des héritiers réservataires.</p><p><strong>4. Assurances-vie comme instrument patrimonial :</strong> La souscription d'une police d'assurance-vie liée à des actifs financiers permet de désigner librement des bénéficiaires (sans restrictions de réserve héréditaire) et d'organiser la distribution du patrimoine financier de manière rapide et confidentielle. En Andorre, les prestations des assurances-vie ne sont pas soumises à taxation entre les mains du bénéficiaire.</p><h3>Planification en contexte transfrontalier</h3><p>Pour les résidents en Andorre ayant des biens ou héritiers en Espagne ou en France, la planification successorale nécessite une approche transfrontalière qui prend en compte le Règlement européen sur les successions (UE) 650/2012 (non directement applicable à l'Andorre car non membre de l'UE, mais avec incidence sur les successions transfrontalières), les CDI signés par l'Andorre et la législation de chaque juridiction où se trouvent les biens ou résident les héritiers.</p><p>Chez ÀMBIT Associats, nous concevons des plans patrimoniaux intégraux qui intègrent les aspects civils, fiscaux et familiaux, en coordonnant avec les notaires andorrans et, lorsque c'est nécessaire, avec les conseillers juridiques des juridictions impliquées.</p>`
    },
    {
      slug: "trasllat-residencia-andorra",
      title: "Transfert de résidence en Andorre : types de résidence, exigences et planification",
      category: "Résidence",
      date: "Février 2025",
      excerpt: "Résidence active, passive et par investissement : différences, exigences et planification préalable au transfert. Tout ce que vous devez savoir avant de changer votre résidence fiscale pour l'Andorre.",
      content: `<h2>Transfert de résidence en Andorre : types de résidence, exigences et planification</h2><p>L'Andorre est le quatrième pays du monde avec le revenu par habitant le plus élevé et l'un des territoires européens avec la charge fiscale la plus faible pour les personnes physiques. Le transfert de résidence fiscale dans la Principauté est une option légalement valide et de plus en plus courante parmi les entrepreneurs, les professionnels du numérique, les sportifs d'élite et les familles fortunées. Cependant, il est nécessaire de planifier adéquatement le processus pour garantir l'effectivité du changement de résidence fiscale et éviter les conflits avec les autorités fiscales du pays d'origine.</p><h3>Types de résidence en Andorre</h3><p><strong>Résidence active pour compte propre :</strong> Pour les entrepreneurs et travailleurs indépendants souhaitant créer ou gérer une activité économique dans la Principauté. Elle nécessite la constitution d'une société andorrane ou l'inscription comme travailleur indépendant, la disposition d'un local ou bureau, et la démonstration d'une activité économique réelle. Le demandeur doit résider effectivement en Andorre au moins 183 jours par an.</p><p><strong>Résidence passive :</strong> Pour les personnes souhaitant établir leur résidence fiscale en Andorre sans exercer une activité économique dans la Principauté. Elle nécessite d'accréditer un investissement minimum de 600.000 euros dans des actifs andorrans (biens immobiliers, dépôts bancaires ou participations dans des sociétés andorranes) et de démontrer disposer de revenus suffisants pour vivre sans travailler en Andorre. La résidence passive ne permet pas de travailler dans la Principauté.</p><p><strong>Résidence pour compte d'autrui :</strong> Pour les salariés ayant obtenu un contrat de travail avec une entreprise andorrane. La résidence est liée à la relation de travail et permet d'accéder au système de sécurité sociale andorran (CASS) et aux avantages fiscaux de la Principauté.</p><h3>Planification préalable au transfert : aspects clés</h3><p>Le changement de résidence fiscale n'est pas immédiat et nécessite une planification. Aspects fondamentaux à considérer : (1) L'exit tax en Espagne : les résidents espagnols qui transfèrent leur résidence hors d'Espagne avec des actifs (actions, participations) évalués à plus de 4 millions d'euros, ou avec des gains potentiels supérieurs à 1 million d'euros, peuvent être soumis à l'exit tax espagnole. Il est nécessaire de planifier le transfert d'actifs préalablement. (2) Le CDI Andorre-Espagne : la Convention de Double Imposition signée en 2015 établit les critères de résidence fiscale et la répartition de la compétence fiscale sur chaque type de revenu. Il est nécessaire d'analyser la situation personnelle du contribuable pour déterminer l'impact réel du changement. (3) La substance réelle en Andorre : pour que le changement de résidence fiscale soit effectif, le contribuable doit démontrer que l'Andorre est son centre d'intérêts vitaux : résidence effective, vie sociale, gestion des affaires depuis la Principauté.</p><p>Chez ÀMBIT Associats, nous accompagnons l'ensemble du processus de transfert de résidence, depuis l'analyse initiale de la situation fiscale jusqu'aux démarches administratives et à la gestion comptable et fiscale ultérieure en Andorre.</p>`
    },
    {
      slug: "cdi-andorra-espanya",
      title: "Convention de Double Imposition Andorre-Espagne : analyse technique par article",
      category: "Fiscalité Internationale",
      date: "Janvier 2025",
      excerpt: "Le CDI signé en 2015 entre l'Andorre et l'Espagne établit les règles de taxation sur les dividendes, intérêts, plus-values, salaires et pensions. Analyse technique pour les résidents et entreprises opérant dans les deux pays.",
      content: `<h2>Convention de Double Imposition Andorre-Espagne : analyse technique par article</h2><p>La Convention pour éviter la Double Imposition (CDI) signée entre l'Andorre et l'Espagne le 8 janvier 2015 (en vigueur depuis le 26 février 2016) est l'un des instruments juridiques les plus pertinents pour les entrepreneurs, investisseurs et particuliers qui maintiennent des relations économiques entre les deux pays. Le CDI répartit la compétence fiscale sur chaque type de revenu entre les deux États signataires, évitant qu'un même revenu soit taxé deux fois.</p><h3>Résidence fiscale : critère de départage (article 4)</h3><p>Le CDI établit les critères pour déterminer la résidence fiscale lorsqu'une personne peut être considérée comme résidente par les deux États : en premier lieu s'applique le critère du foyer permanent ; en second lieu, le centre d'intérêts vitaux (où se trouvent les relations personnelles et économiques les plus étroites) ; en troisième lieu, le lieu de séjour habituel (183 jours) ; et enfin la nationalité. Pour les personnes qui transfèrent leur résidence d'Espagne vers l'Andorre, il est fondamental d'accréditer que le centre d'intérêts vitaux s'est effectivement déplacé dans la Principauté.</p><h3>Dividendes (article 10)</h3><p>Les dividendes payés par une société espagnole à un résident andorran sont taxés en Espagne à 5% en IRNR lorsque le bénéficiaire est une société détenant au moins 10% du capital de la société payeuse, et à 15% dans les autres cas. En Andorre, le bénéficiaire peut appliquer la déduction pour double imposition internationale sur l'impôt payé en Espagne, de sorte que la fiscalité effective additionnelle en Andorre peut être de 0%. Pour les holdings andorrans bénéficiant du régime STVE, les dividendes reçus sont exemptés en Andorre, résultant en une fiscalité totale de 5% (la retenue espagnole).</p><h3>Intérêts (article 11)</h3><p>Les intérêts payés par un résident espagnol à un résident andorran sont taxés en Espagne à 5% au titre de l'IRNR. En Andorre, la déduction pour double imposition s'applique, pouvant résulter en une fiscalité nette dans la Principauté de 5-10% en fonction de la situation fiscale du bénéficiaire.</p><h3>Plus-values (article 13)</h3><p>Les plus-values découlant de la transmission de biens immobiliers situés en Espagne sont taxées en Espagne (généralement à 19-24% pour les non-résidents). Les plus-values découlant de la transmission d'actions ou participations dans des sociétés dont 50% des actifs sont des biens immobiliers espagnols, sont également taxées en Espagne. Pour le reste des gains en capital (actions de sociétés non immobilières, fonds d'investissement, etc.), la compétence fiscale correspond exclusivement au pays de résidence du cédant.</p><h3>Pensions et salaires (articles 15-18)</h3><p>Les salaires sont taxés dans le pays où le travail est exercé, avec des exceptions pour les travailleurs frontaliers et certaines catégories (travailleurs du secteur public, étudiants, enseignants). Les pensions privées sont taxées dans le pays de résidence du bénéficiaire. Les pensions de la sécurité sociale espagnole perçues par des résidents andorrans sont taxées exclusivement en Espagne.</p><p>Chez ÀMBIT Associats, nous analysons la situation fiscale individuelle de chaque client dans le contexte du CDI pour optimiser la planification fiscale transfrontalière de manière rigoureuse et conforme à la réglementation en vigueur.</p>`
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesDropdown, setServicesDropdown] = useState(false);
  const t = translations[language];
  const services = mainServices[language];
  const details = serviceDetails[language];

  const handleLanguageChange = (langCode) => {
    setLanguage(langCode);
    setCurrentService(null);
    setCurrentBlogPost(null);
    setShowIrpf(false);
    setMenuOpen(false);
    setServicesDropdown(false);
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

          {/* Menú de navegació */}
          <nav className="mt-4 relative">
            {/* Desktop */}
            <div className="hidden md:flex items-center justify-center gap-6 text-sm text-white/90">
              <div
                className="relative"
                onMouseEnter={() => setServicesDropdown(true)}
                onMouseLeave={() => setServicesDropdown(false)}
              >
                <button className="hover:text-white flex items-center gap-1">
                  {t.nav?.serveis} <span className="text-xs">▾</span>
                </button>
                {servicesDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-[#009B9C]/20 z-50 py-2">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { openService(s.id); setServicesDropdown(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-[#009B9C]/10 hover:text-[#009B9C] transition"
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setShowIrpf(true)} className="hover:text-white hover:underline">
                {t.nav?.calculadora}
              </button>
              <button onClick={() => document.getElementById("professionals")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white hover:underline">
                {t.nav?.professionals}
              </button>
              <button onClick={() => document.getElementById("blog")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white hover:underline">
                {t.nav?.blog}
              </button>
              <button onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })} className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full font-semibold transition">
                {t.nav?.contacte}
              </button>
            </div>
            {/* Mòbil: hamburguesa */}
            <div className="md:hidden flex justify-center mt-2">
              <button onClick={() => setMenuOpen(!menuOpen)} className="text-white text-2xl px-3 py-1">
                ≡
              </button>
              {menuOpen && (
                <div className="absolute top-full left-0 right-0 bg-[#007A7B] z-50 py-3 flex flex-col items-center gap-3 text-white text-sm">
                  <div className="relative w-full text-center">
                    <button onClick={() => setServicesDropdown(!servicesDropdown)} className="hover:text-white font-medium">
                      {t.nav?.serveis} <span className="text-xs">▾</span>
                    </button>
                    {servicesDropdown && (
                      <div className="w-full bg-white/10 py-2 flex flex-col items-center gap-2 mt-1">
                        {services.map((s) => (
                          <button key={s.id} onClick={() => { openService(s.id); setMenuOpen(false); }} className="text-xs text-white/90 hover:text-white py-1">
                            {s.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setShowIrpf(true); setMenuOpen(false); }} className="hover:underline">{t.nav?.calculadora}</button>
                  <button onClick={() => { document.getElementById("professionals")?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }} className="hover:underline">{t.nav?.professionals}</button>
                  <button onClick={() => { document.getElementById("blog")?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }} className="hover:underline">{t.nav?.blog}</button>
                  <button onClick={() => { document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }} className="bg-white/20 px-4 py-1.5 rounded-full font-semibold">{t.nav?.contacte}</button>
                </div>
              )}
            </div>
          </nav>
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
          <section id="professionals" className="py-20 bg-gradient-to-r from-[#009B9C] to-[#007A7B] text-white">
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
          <section id="blog" className="py-16 bg-gray-50">
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