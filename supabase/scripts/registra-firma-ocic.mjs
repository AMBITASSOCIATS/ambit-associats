// Registra la firma manuscrita d'un OCIC al portal: puja la imatge al bucket
// privat portal-firmes (només hi accedeix el servei) i la vincula a l'usuari
// a portal.firmes_ocic. La firma només s'estampa quan aquest OCIC valida un
// KYC amb la seva sessió.
//
// Ús:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node supabase/scripts/registra-firma-ocic.mjs <imatge.png|jpg> <correu-ocic> "<Nom i cognoms>"
//
// Les claus es llegeixen de l'entorn i no s'imprimeixen mai. Si l'OCIC ja
// tenia una firma, se'n registra una de nova (camí nou); l'anterior no
// s'esborra i el canvi queda a audit_log.

import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const [, , ruta, email, nom] = process.argv;
const URL = process.env.SUPABASE_URL;
const CLAU = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ruta || !email || !nom) {
  console.error('Ús: node supabase/scripts/registra-firma-ocic.mjs <imatge.png|jpg> <correu-ocic> "<Nom i cognoms>"');
  process.exit(2);
}
if (!URL || !CLAU) {
  console.error('Falten SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY a l\'entorn');
  process.exit(2);
}

const bytes = fs.readFileSync(ruta);
const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
if (!png && !jpg) { console.error('La imatge ha de ser PNG o JPG'); process.exit(1); }
if (bytes.length > 1024 * 1024) { console.error('La imatge no pot superar 1 MB'); process.exit(1); }

const admin = createClient(URL, CLAU, { auth: { persistSession: false } });

// Usuari i rol OCIC actiu
let usuari = null;
for (let pagina = 1; !usuari && pagina <= 50; pagina++) {
  const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
  if (error) { console.error('No s\'han pogut llegir els usuaris'); process.exit(1); }
  usuari = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  if (data.users.length < 200) break;
}
if (!usuari) { console.error('No existeix cap usuari amb aquest correu'); process.exit(1); }
const { data: staff } = await admin.schema('portal').from('staff_profiles').select('role, actiu').eq('user_id', usuari.id).maybeSingle();
if (!staff?.actiu || staff.role !== 'ocic') { console.error('Aquest usuari no és OCIC actiu del portal'); process.exit(1); }

const sha256 = createHash('sha256').update(bytes).digest('hex');
const cami = `ocic/${usuari.id}/${randomUUID()}.${png ? 'png' : 'jpg'}`;
const { error: errPuja } = await admin.storage.from('portal-firmes')
  .upload(cami, bytes, { contentType: png ? 'image/png' : 'image/jpeg', upsert: false });
if (errPuja) { console.error('No s\'ha pogut pujar la imatge:', errPuja.message); process.exit(1); }

const { error: errReg } = await admin.schema('portal').from('firmes_ocic')
  .upsert({ user_id: usuari.id, nom: nom.trim(), imatge_path: cami, sha256 }, { onConflict: 'user_id' });
if (errReg) { console.error('No s\'ha pogut registrar la firma:', errReg.message); process.exit(1); }

console.log(`Firma registrada per a ${email} (${nom.trim()})`);
console.log(`Bucket portal-firmes · ${cami}`);
console.log(`SHA-256 ${sha256}`);
