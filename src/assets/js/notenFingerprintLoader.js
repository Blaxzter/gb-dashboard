// Woher der Notensatz-Fingerabdruck eines Liedes kommt.
//
// Regelfall: aus dem Feld `notentext_fingerprint`, das beim Hochladen des
// Notensatzes mitgeschrieben wird (NotentextUploadView). Der Druck-Check kommt
// dann ohne einen einzigen PDF-Download aus.
//
// Notfall: Fehlt der Wert oder gehört er noch zur vorherigen Datei (Notensatz
// im Directus-Admin ausgetauscht, Altbestand vor dem Backfill), wird er aus der
// PDF selbst gerechnet. Das kostet einen Download je Lied (~250 KB) und ist
// deshalb ausdrücklich der Ausnahmeweg – nicht der Normalbetrieb.

import { fingerprintNotenPdf, isFingerprintUsable } from '@/assets/js/notenFingerprint';

// Die Worker-Datei als URL einbinden (Vite kopiert sie und liefert den Pfad).
// NICHT `pdf.worker.entry.js` importieren: Das ist ein Webpack-Modul, das nur
// `window.pdfjsWorker` setzt und keine URL liefert. pdf.js prüft diesen Globals
// zuerst und schaltet dann auf seinen „fake worker" um – die PDFs würden also im
// Haupt-Thread geparst und die Oberfläche einfrieren (der Druck-Check liest im
// Notfall über 100 Noten-PDFs).
//
// Bewusst die NICHT-minifizierte `pdf.worker.js` (nicht `.min.js`): Im aktuellen
// pnpm-Install ist die Store-Verknüpfung der `.min.js`-Dateien dieses Pakets
// kaputt – `pdf.worker.min.js` enthält pdf.js 3.13.1, während der Haupt-Thread
// (`pdf.js`) 2.9.359 ist. Ein Worker mit anderer Major-Version spricht ein
// anderes Message-Protokoll: der 2.9.359-Main-Thread wirft beim Deserialisieren
// der Worker-Antwort `N.toString is not a function` – der Fehler landet im
// internen Message-Handler, NICHT in `getDocument().promise`, das Promise
// settlet nie und der Notentext-Upload hängt still (Spinner endlos). Die
// nicht-minifizierte Datei ist korrekt 2.9.359 und passt zum Main-Thread.
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.js?url';

// pdf.js liegt hier als eigene Abhängigkeit (vue-pdf-embed bündelt seine Kopie
// intern und exportiert sie nicht). Die Version ist bewusst auf die von
// vue-pdf-embed gebündelte 2.9.359 festgenagelt: Der Vergleich hält Druck-PDF
// (von vue-pdf-embed geladen) gegen Notensatz-PDF (hier geladen) auf 0.01 pt
// genau – das trägt nur, solange beide Seiten denselben Text-Layer sehen. Wird
// vue-pdf-embed aktualisiert, muss diese Version mitgezogen werden.
//
// Dynamisch geladen: pdf.js wiegt gebaut ~380 KB und wird nur hier gebraucht.
let pdfjsPromise = null;
async function getPdfjs() {
    if (!pdfjsPromise) {
        pdfjsPromise = (async () => {
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
            pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
            return pdfjs;
        })();
    }
    return pdfjsPromise;
}

// Schlägt der pdf.js-Worker fehl (z. B. Versions-Mismatch), kann der Fehler im
// internen Message-Handler landen statt `getDocument().promise` zu rejecten –
// dann würde das Promise nie settlen und der Aufrufer (Upload/Druck-Check) hinge
// still für immer. Deshalb ein harter Timeout: settlet die Analyse nicht, wird
// abgebrochen und der Aufrufer bekommt einen Fehler zum Fangen (der Upload läuft
// dann ohne Fingerabdruck weiter, der Druck-Check lädt die PDF eben nach).
const GET_DOCUMENT_TIMEOUT_MS = 20000;

// Fingerabdruck aus einer Notensatz-PDF (ArrayBuffer/Uint8Array) rechnen.
export async function fingerprintFromPdfBytes(bytes, fileId) {
    const pdfjs = await getPdfjs();
    const loadingTask = pdfjs.getDocument({
        data: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
        // Die Glyphen kommen aus dem Text-Layer; gerendert wird nichts. Ohne
        // diesen Schalter lädt pdf.js die eingebetteten Fonts unnötig.
        disableFontFace: true,
    });
    let timeoutId;
    let doc;
    try {
        doc = await Promise.race([
            loadingTask.promise,
            new Promise((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(new Error('pdf.js getDocument Timeout – Worker antwortet nicht')),
                    GET_DOCUMENT_TIMEOUT_MS,
                );
            }),
        ]);
    } catch (e) {
        clearTimeout(timeoutId);
        // Hängenden/laufenden Ladevorgang samt Worker abbrechen.
        loadingTask.destroy?.();
        throw e;
    }
    clearTimeout(timeoutId);
    try {
        return await fingerprintNotenPdf(doc, fileId);
    } finally {
        doc.destroy?.();
    }
}

// Fingerabdruck aus einer File/Blob (Upload-Ansicht).
export async function fingerprintFromFile(file, fileId) {
    return fingerprintFromPdfBytes(await file.arrayBuffer(), fileId);
}

/**
 * Loader für den Druck-Check. Nutzt das DB-Feld, wenn es zur aktuellen
 * Notensatz-Datei gehört, sonst lädt es die PDF nach.
 *
 * @param backendUrl  import.meta.env.VITE_BACKEND_URL
 * @param onFetch     optional – wird gerufen, wenn wirklich geladen werden muss
 *                    (für „x Notensätze werden nachgeladen …")
 */
export function createFingerprintLoader({ backendUrl, onFetch } = {}) {
    const cache = new Map();
    return async function loadFingerprint(lied) {
        if (cache.has(lied.id)) return cache.get(lied.id);

        const stored = lied.notentext_fingerprint;
        if (isFingerprintUsable(stored, lied.notentext)) {
            cache.set(lied.id, stored);
            return stored;
        }
        if (!lied.notentext) {
            cache.set(lied.id, null);
            return null;
        }

        onFetch?.(lied);
        let fp = null;
        try {
            const resp = await fetch(`${backendUrl}/assets/${lied.notentext}`);
            if (resp.ok) {
                const bytes = new Uint8Array(await resp.arrayBuffer());
                // Nur PDFs tragen den Notensatz als Text-Layer. Alte SVG-Einträge
                // im Feld liefern hier nichts – dann bleibt es bei „nicht prüfbar".
                if (String.fromCharCode(...bytes.slice(0, 4)) === '%PDF') {
                    fp = await fingerprintFromPdfBytes(bytes, lied.notentext);
                }
            }
        } catch (e) {
            console.warn('Notensatz konnte nicht geladen werden', lied.id, e);
        }
        cache.set(lied.id, fp);
        return fp;
    };
}
