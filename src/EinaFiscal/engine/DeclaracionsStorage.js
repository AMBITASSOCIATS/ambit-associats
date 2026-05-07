// engine/DeclaracionsStorage.js
// Capa de persistència de declaracions via localStorage
// Clau: 'ambit_declaracions' → array de declaracions

const STORAGE_KEY = 'ambit_declaracions';
const VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNS
// ─────────────────────────────────────────────────────────────────────────────

function llegir() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function escriure(declaracions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(declaracions));
    return true;
  } catch (e) {
    // localStorage ple o no disponible
    console.error('Error desant declaracions:', e);
    return false;
  }
}

function ara() {
  return new Date().toISOString();
}


// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna totes les declaracions, ordenades per data de modificació (més recent primer)
 */
export function llistarDeclaracions() {
  return llegir().sort((a, b) =>
    new Date(b.modificatEn) - new Date(a.modificatEn)
  );
}

/**
 * Retorna una declaració per ID, o null si no existeix
 */
export function obtenirDeclaracio(id) {
  return llegir().find(d => d.id === id) || null;
}

/**
 * Crea una nova declaració buida i la desa
 * Retorna la declaració creada
 */
export function novaDeclaracio(clientNom = '', clientNRT = '', exercici = 2025) {
  const declaracio = {
    id: `decl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    versio: VERSION,
    clientNom,
    clientNRT,
    exercici,
    estat: 'esborrany',
    creatEn: ara(),
    modificatEn: ara(),
    dades: {},
  };
  const declaracions = llegir();
  declaracions.push(declaracio);
  escriure(declaracions);
  return declaracio;
}

/**
 * Desa (actualitza) una declaració existent.
 * Si l'ID no existeix, la crea.
 * Retorna true si OK, false si error.
 */
export function desarDeclaracio(id, { clientNom, clientNRT, exercici, dades, estat }) {
  const declaracions = llegir();
  const idx = declaracions.findIndex(d => d.id === id);

  if (idx === -1) {
    // No existeix: crear-la
    declaracions.push({
      id,
      versio: VERSION,
      clientNom: clientNom || '',
      clientNRT: clientNRT || '',
      exercici: exercici || 2025,
      estat: estat || 'esborrany',
      creatEn: ara(),
      modificatEn: ara(),
      dades: dades || {},
    });
  } else {
    // Actualitzar existent
    declaracions[idx] = {
      ...declaracions[idx],
      clientNom: clientNom ?? declaracions[idx].clientNom,
      clientNRT: clientNRT ?? declaracions[idx].clientNRT,
      exercici: exercici ?? declaracions[idx].exercici,
      estat: estat ?? declaracions[idx].estat,
      dades: dades ?? declaracions[idx].dades,
      modificatEn: ara(),
    };
  }

  return escriure(declaracions);
}

/**
 * Duplica una declaració amb un nou ID
 * Retorna la nova declaració, o null si l'original no existeix
 */
export function duplicarDeclaracio(id) {
  const original = obtenirDeclaracio(id);
  if (!original) return null;

  const nova = {
    ...original,
    id: `decl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    clientNom: `${original.clientNom} (còpia)`,
    estat: 'esborrany',
    creatEn: ara(),
    modificatEn: ara(),
  };

  const declaracions = llegir();
  declaracions.push(nova);
  escriure(declaracions);
  return nova;
}

/**
 * Elimina una declaració per ID
 * Retorna true si OK, false si no existia
 */
export function eliminarDeclaracio(id) {
  const declaracions = llegir();
  const filtrades = declaracions.filter(d => d.id !== id);
  if (filtrades.length === declaracions.length) return false;
  return escriure(filtrades);
}

/**
 * Marca una declaració com a finalitzada
 */
export function finalitzarDeclaracio(id) {
  return desarDeclaracio(id, { estat: 'finalitzada' });
}

/**
 * Retorna el tamany aproximat del localStorage usat (en KB)
 */
export function tamanyEmmagatzemat() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '';
    return (raw.length * 2 / 1024).toFixed(1); // aproximació en KB
  } catch {
    return '0';
  }
}
