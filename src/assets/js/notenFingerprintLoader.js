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
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';

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

// Fingerabdruck aus einer Notensatz-PDF (ArrayBuffer/Uint8Array) rechnen.
export async function fingerprintFromPdfBytes(bytes, fileId) {
    const pdfjs = await getPdfjs();
    const doc = await pdfjs.getDocument({
        data: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
        // Die Glyphen kommen aus dem Text-Layer; gerendert wird nichts. Ohne
        // diesen Schalter lädt pdf.js die eingebetteten Fonts unnötig.
        disableFontFace: true,
    }).promise;
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
