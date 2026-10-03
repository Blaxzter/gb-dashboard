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
// Bewusst die NICHT-minifizierte `pdf.worker.js` (nicht `.min.js`): In einem
// früheren Install enthielt `pdf.worker.min.js` pdf.js 3.13.1, während der
// Haupt-Thread (`pdf.js`) 2.9.359 war. Ein Worker mit anderer Major-Version
// spricht ein anderes Message-Protokoll: der Main-Thread wirft dann beim
// Deserialisieren der Worker-Antwort `N.toString is not a function` – der
// Fehler landet im internen Message-Handler, NICHT in `getDocument().promise`,
// das Promise settlet nie und der Notentext-Upload hängt still. Die
// nicht-minifizierte Datei ist verlässlich 2.9.359 und passt zum Main-Thread.
// (Dieselbe Fehlermeldung kann auch aus dem Fake-Worker kommen – siehe
// `getDocumentWithOwnWorker` weiter unten.)
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

// `vue3-pdf-app` (steckt in MediaComponent) bringt eine eigene, minifizierte
// pdf.js 2.4.456 mit und legt deren Worker-Code beim Laden des Chunks als
// `window.pdfjsWorker` global ab. Genau diesen Globals prüft unsere pdf.js in
// `PDFWorker._initialize()`: ist er gesetzt, baut sie gar keinen eigenen
// Web-Worker mehr, sondern einen „fake worker", der über `LoopbackPort` mit dem
// fremden 2.4.456-Handler redet. Das fliegt auf, sobald von dort ein Fehler
// zurückkommt: `LoopbackPort` klont Objekte per `Object.create(null)`, und weil
// die minifizierten Exception-Klassen einen unbekannten `name` tragen, landet
// `wrapReason()` im default-Zweig und ruft `reason.toString()` auf einem Objekt
// ohne Prototyp – `N.toString is not a function`, geworfen im Message-Handler
// statt im Promise. `getDocument()` settlet dann nie, jeder Fingerabdruck läuft
// in den Timeout unten, und der Upload schreibt kein `notentext_fingerprint`
// mehr. Es genügt, irgendwann in derselben SPA-Sitzung eine Liedansicht mit
// MediaComponent geöffnet zu haben – der Globals bleibt danach gesetzt.
//
// `_initialize()` läuft synchron in `getDocument()`, deshalb reicht es, den
// fremden Globals für genau diesen Aufruf auszublenden. vue3-pdf-app braucht
// ihn danach unverändert weiter (es hat keine eigene Worker-Datei und rendert
// bewusst im Haupt-Thread), und vue-pdf-embed bringt seinen eigenen Worker mit.
function getDocumentWithOwnWorker(pdfjs, params) {
    const foreign = globalThis.pdfjsWorker;
    globalThis.pdfjsWorker = undefined;
    try {
        return pdfjs.getDocument(params);
    } finally {
        globalThis.pdfjsWorker = foreign;
    }
}

// Schlägt der pdf.js-Worker fehl (z. B. Versions-Mismatch), kann der Fehler im
// internen Message-Handler landen statt `getDocument().promise` zu rejecten –
// dann würde das Promise nie settlen und der Aufrufer (Upload/Druck-Check) hinge
// still für immer. Deshalb ein harter Timeout: settlet die Analyse nicht, wird
// abgebrochen und der Aufrufer bekommt einen Fehler zum Fangen (der Upload läuft
// dann ohne Fingerabdruck weiter, der Druck-Check lädt die PDF eben nach).
const GET_DOCUMENT_TIMEOUT_MS = 20000;

// Lädt ein PDF mit unserem eigenen Worker und hartem Timeout (s. o.).
async function loadPdfDocument(bytes, params = {}) {
    const pdfjs = await getPdfjs();
    const loadingTask = getDocumentWithOwnWorker(pdfjs, {
        data: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
        ...params,
    });
    let timeoutId;
    try {
        return await Promise.race([
            loadingTask.promise,
            new Promise((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(new Error('pdf.js getDocument Timeout – Worker antwortet nicht')),
                    GET_DOCUMENT_TIMEOUT_MS,
                );
            }),
        ]);
    } catch (e) {
        // Hängenden/laufenden Ladevorgang samt Worker abbrechen.
        loadingTask.destroy?.();
        throw e;
    } finally {
        clearTimeout(timeoutId);
    }
}

// Fingerabdruck aus einer Notensatz-PDF (ArrayBuffer/Uint8Array) rechnen.
export async function fingerprintFromPdfBytes(bytes, fileId) {
    // Die Glyphen kommen aus dem Text-Layer; gerendert wird nichts. Ohne
    // disableFontFace lädt pdf.js die eingebetteten Fonts unnötig.
    const doc = await loadPdfDocument(bytes, { disableFontFace: true });
    try {
        return await fingerprintNotenPdf(doc, fileId);
    } finally {
        doc.destroy?.();
    }
}

// Breite des Vorschaubilds in px. Reicht, um im Choralbuchsatz oben links die
// Choralbuchnummer zu lesen, und bleibt bei ein paar hundert PDFs klein.
const PREVIEW_WIDTH_PX = 900;

/**
 * Was der Upload über ein Noten-PDF wissen muss, um es einzuordnen
 * (Gesangbuchsatz oder Choralbuchsatz, Issue #108): Seitengrößen in pt (mit
 * Drehung), Metadaten und ein Vorschaubild der ersten Seite als JPEG-Data-URL.
 */
export async function inspectNotenPdfFile(file) {
    const doc = await loadPdfDocument(await file.arrayBuffer());
    try {
        const pages = [];
        let firstPage = null;
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const { width, height } = page.getViewport({ scale: 1 });
            pages.push({ width, height });
            if (i === 1) firstPage = page;
        }
        let title = '';
        let producer = '';
        try {
            const meta = await doc.getMetadata();
            title = meta?.info?.Title || '';
            producer = meta?.info?.Producer || '';
        } catch {
            // Metadaten sind nur Beiwerk für die Begründung.
        }
        let previewUrl = null;
        if (firstPage && typeof document !== 'undefined') {
            try {
                const base = firstPage.getViewport({ scale: 1 });
                const viewport = firstPage.getViewport({ scale: PREVIEW_WIDTH_PX / base.width });
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await firstPage.render({ canvasContext: ctx, viewport }).promise;
                previewUrl = canvas.toDataURL('image/jpeg', 0.8);
            } catch (e) {
                console.warn('PDF-Vorschau konnte nicht gerendert werden', file?.name, e);
            }
        }
        return { pages, title, producer, previewUrl };
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
