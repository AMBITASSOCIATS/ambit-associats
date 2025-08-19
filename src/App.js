import React, { useState } from "react";
import { motion } from "framer-motion";
import izquierdaImg from './izquierda.png';
import derechaImg from './derecha.png';
import legalBottomLeftImg from './legal-bottom-left.png';
import legalBottomRightImg from './legal-bottom-right.png';


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

const App = () => {
  const [language, setLanguage] = useState("ca");
  const [currentService, setCurrentService] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [formSubmitted, setFormSubmitted] = useState(false);
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