// MusicXML-Dateien (`notentext_mxml`) für den PDF↔MusicXML-Abgleich laden.
//
// Directus liefert sie meist als komprimiertes .mxl (ein ZIP), seltener als
// reine .musicxml. Ausgewertet wird nur, was der Abgleich braucht (Tonart,
// Taktarten, Tonhöhen, die Wörter des Liedtexts – siehe notenAbgleich.js); die
// Datei selbst wird nicht aufgehoben.

import JSZip from 'jszip';
import { readMusicXml } from '@/assets/js/notenAbgleich';

// Text einer MusicXML aus den Datei-Bytes (.mxl oder .musicxml).
export async function musicXmlText(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (data[0] !== 0x50 || data[1] !== 0x4b) return new TextDecoder('utf-8').decode(data);
    const zip = await JSZip.loadAsync(data);
    const name = Object.keys(zip.files).find(
        (n) => /\.(musicxml|xml)$/i.test(n) && !n.startsWith('META-INF'),
    );
    if (!name) throw new Error('Kein MusicXML im .mxl-Archiv gefunden');
    return zip.file(name).async('string');
}

// Loader mit Cache je Datei-Id: Jede MusicXML wird pro Sitzung nur einmal
// geladen, auch wenn die Checks mehrfach neu laufen.
export function createMusicXmlLoader({ backendUrl }) {
    const cache = new Map();
    return function loadScore(fileId) {
        if (!cache.has(fileId)) {
            const pending = (async () => {
                const resp = await fetch(`${backendUrl}/assets/${fileId}`);
                if (!resp.ok) throw new Error(`Download fehlgeschlagen (${resp.status})`);
                return readMusicXml(await musicXmlText(await resp.arrayBuffer()));
            })();
            // Fehlschläge nicht festhalten – beim nächsten Versuch neu laden.
            pending.catch(() => cache.delete(fileId));
            cache.set(fileId, pending);
        }
        return cache.get(fileId);
    };
}
