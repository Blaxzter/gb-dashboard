// Weißen Rand um ein gerendertes Notenbild wegschneiden (Issue #99).
//
// Die Notensatz-PDFs sind ganze Seiten: Der Satz steht oben, darunter kommt
// nichts mehr. Wird so eine Seite auf ein Korrekturblatt skaliert, bestimmt die
// leere Seitenhöhe die Größe – das Notenbild schrumpft auf einen Briefmarken-
// Abdruck, während drei Viertel des Blattes weiß bleiben. Genau der Text unter
// den Noten, um den es beim Abgleich geht, wird dabei unleserlich.
//
// Deshalb: nach dem Rendern die Pixel abtasten, den tatsächlich bedruckten
// Bereich bestimmen und nur den zeigen. Über Pixel statt über den PDF-Inhalt,
// weil die Dateien uneinheitlich sind – mal steht der Text als Bild-Stempel in
// der Seite, mal als Vektor-Umriss (siehe notenFingerprint.js/pdfAlign.js). Was
// gedruckt wird, sieht man nur dem fertigen Bild an.

// Ab welcher Helligkeit ein Pixel als „bedruckt" gilt. Notensatz ist schwarz auf
// weiß; 240 lässt die Kantenglättung am Papierrand außen vor, fängt aber graue
// Hilfslinien noch ein.
const INK_MAX = 240;
// Rand um den bedruckten Bereich, als Anteil der Bildbreite. Ohne ihn klebte der
// Zuschnitt auf den äußersten Notenlinien.
const PAD_RATIO = 0.015;

/**
 * Der bedruckte Bereich eines gerenderten Bildes.
 *
 * @param {{data: Uint8ClampedArray}} imageData Ergebnis von getImageData
 * @param {number} width  Breite in Pixeln
 * @param {number} height Höhe in Pixeln
 * @returns {{x: number, y: number, w: number, h: number} | null}
 *          null, wenn die Seite leer ist – dann gibt es nichts zuzuschneiden.
 */
export function inkBounds(imageData, width, height, options = {}) {
    const inkMax = options.inkMax ?? INK_MAX;
    const padRatio = options.padRatio ?? PAD_RATIO;
    const data = imageData?.data;
    if (!data || !width || !height) return null;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
        const row = y * width * 4;
        for (let x = 0; x < width; x++) {
            const i = row + x * 4;
            // Durchsichtig ist Papier: pdf.js zeichnet auf eine leere Fläche,
            // nicht auf ein weißes Blatt.
            if (data[i + 3] < 16) continue;
            if (data[i] > inkMax && data[i + 1] > inkMax && data[i + 2] > inkMax) continue;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    if (maxX < 0) return null;

    const pad = Math.round(width * padRatio);
    const x = Math.max(0, minX - pad);
    const y = Math.max(0, minY - pad);
    return {
        x,
        y,
        w: Math.min(width, maxX + 1 + pad) - x,
        h: Math.min(height, maxY + 1 + pad) - y,
    };
}

// Lohnt der Zuschnitt überhaupt? Schneidet er kaum etwas weg, bleibt lieber die
// ganze Seite stehen – dann stimmt die Darstellung mit der Datei überein, statt
// sich um ein paar Pixel von ihr zu unterscheiden.
export function isWorthTrimming(box, width, height) {
    if (!box) return false;
    return box.w * box.h < width * height * 0.9;
}
