// Welche Art Noten-PDF ist das? (Issue #108)
//
// In den Notentext-Upload landen zwei Sorten PDF, die beide aus Finale über
// „Microsoft: Print To PDF" kommen und beide als PDF-Titel „<Titel>.musx"
// tragen – an Metadaten sind sie also nicht zu unterscheiden, und Text liefern
// sie auch keinen (die Glyphen haben kein brauchbares Unicode-Mapping):
//
//   • Gesangbuchsatz  – das Notenbild fürs Gesangbuch, eine Buchseite im
//                       Hochformat, 120 × 176 mm (340,2 × 498,8 pt).
//                       Ziel: gesangbuchlied.notentext / notentext_seite2.
//   • Choralbuchsatz  – der vierstimmige Klaviersatz (Vorspiel + Choral) für
//                       die Musiker, A4 quer, oben links die Choralbuchnummer.
//                       Ziel: melodie.choralbuchNoten.
//
// Was sie sicher trennt, ist das Seitenformat. Liegt ein PDF auf keinem der
// beiden, wird nach der Ausrichtung geraten und das als „vermutet" markiert,
// damit es in der Oberfläche auffällt.

export const PDF_KIND_GESANGBUCH = 'gesangbuch';
export const PDF_KIND_CHORALBUCH = 'choralbuch';

const PT_TO_MM = 25.4 / 72;
// Finale/Print-To-PDF runden etwas; echte Fremdformate (A5, Letter …) liegen
// deutlich weiter weg.
const FORMAT_TOLERANCE_MM = 4;

const FORMATS = [
    { kind: PDF_KIND_GESANGBUCH, label: 'Gesangbuchseite 120 × 176 mm', w: 120, h: 176 },
    { kind: PDF_KIND_CHORALBUCH, label: 'A4 quer', w: 297, h: 210 },
];

export function pdfKindLabel(kind) {
    return kind === PDF_KIND_CHORALBUCH ? 'Choralbuchsatz' : 'Gesangbuchsatz';
}

function round(mm) {
    return Math.round(mm);
}

/**
 * @param {object} info
 * @param {Array<{width:number,height:number}>} info.pages  Seitengrößen in pt,
 *        Drehung bereits eingerechnet (wie pdf.js `getViewport({scale:1})`).
 * @param {string} [info.title]     PDF-Metadatum Title
 * @param {string} [info.producer]  PDF-Metadatum Producer
 * @returns {{kind:string, confidence:'sicher'|'vermutet', format:string,
 *            reasons:string[], warnings:string[]}}
 */
export function classifyNotenPdf({ pages = [], title = '', producer = '' } = {}) {
    const reasons = [];
    const warnings = [];
    const first = pages[0];
    if (!first) {
        return {
            kind: PDF_KIND_GESANGBUCH,
            confidence: 'vermutet',
            format: 'unbekannt',
            reasons: ['Keine Seite gefunden'],
            warnings: ['PDF enthält keine lesbare Seite'],
        };
    }

    const wMm = first.width * PT_TO_MM;
    const hMm = first.height * PT_TO_MM;
    const landscape = wMm > hMm;
    const format = `${round(wMm)} × ${round(hMm)} mm, ${landscape ? 'quer' : 'hoch'}`;

    const known = FORMATS.find(
        (f) =>
            Math.abs(wMm - f.w) <= FORMAT_TOLERANCE_MM &&
            Math.abs(hMm - f.h) <= FORMAT_TOLERANCE_MM,
    );

    let kind;
    let confidence;
    if (known) {
        kind = known.kind;
        confidence = 'sicher';
        reasons.push(`Format ${format} = ${known.label}`);
    } else {
        kind = landscape ? PDF_KIND_CHORALBUCH : PDF_KIND_GESANGBUCH;
        confidence = 'vermutet';
        reasons.push(
            `Format ${format} passt weder zur Gesangbuchseite (120 × 176 mm) noch zu A4 quer`,
        );
        reasons.push(
            landscape
                ? 'Querformat → vermutlich Choralbuchsatz'
                : 'Hochformat → vermutlich Gesangbuchsatz',
        );
    }

    reasons.push(`${pages.length} Seite${pages.length === 1 ? '' : 'n'}`);
    if (title) reasons.push(`PDF-Titel „${title}"`);
    if (producer) reasons.push(`Erzeugt mit ${producer}`);

    if (pages.length > 1) {
        const differing = pages.some(
            (p) =>
                Math.abs(p.width - first.width) > 1 || Math.abs(p.height - first.height) > 1,
        );
        if (differing) warnings.push('Seiten haben unterschiedliche Formate');
        if (kind === PDF_KIND_GESANGBUCH) {
            // Konvention: notentext ist einseitig, Seite 2 gehört als eigene
            // Datei in notentext_seite2 – sonst fehlt sie im Druck.
            warnings.push(
                `${pages.length} Seiten – im Gesangbuch wird nur Seite 1 gedruckt. ` +
                    'Seite 2 bitte als eigene Datei (…_seite2.pdf) hochladen.',
            );
        } else {
            warnings.push(`${pages.length} Seiten – ein Choralbuchsatz hat normalerweise eine`);
        }
    }

    return { kind, confidence, format, reasons, warnings };
}
