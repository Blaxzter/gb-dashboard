// Fingerabdruck eines Notensatzes – „steht im Druck wirklich der Notensatz aus
// der Datenbank?"
//
// Hintergrund: Der Notensatz wird als PDF (Finale-Export, Feld `notentext`) in
// InDesign platziert. Was dabei schiefgehen kann, sieht man der fertigen
// Druck-PDF nicht an:
//   * Es wird die falsche Fassung platziert – bei Liedern mit deutscher UND
//     fremdsprachiger Fassung steht dann der englische Notensatz auf der
//     deutschen Seite (gleiche Liednummer, gleiche Melodie – fällt nicht auf).
//   * Der Notensatz wird beim Platzieren unten abgeschnitten: Das letzte System
//     fehlt im Druck („die zweite Seite wurde vergessen").
//   * Der InDesign-Rahmen hängt noch an einem alten Export, obwohl die DB
//     inzwischen einen neuen Notensatz hat.
//
// Prüfbar ist das, weil der Musiksatz im Text-Layer steht: Die Noten sind
// Glyphen der Notenschrift im Private-Use-Bereich (SMuFL, U+E000–U+F8FF). Die
// Strophe-1-Texte unter den Noten sind dagegen Bild-Stempel ohne Text-Layer
// (siehe pdfAlign.js) – die Noten sind also alles, was wir haben, und sie
// genügen:
//
//   * Die Glyphen-FOLGE identifiziert die Datei. Sie allein reicht aber NICHT,
//     um die Sprachfassung zu erkennen: Bei 9 von 12 Liedern mit zwei Fassungen
//     ist sie identisch – dieselbe Melodie, dieselben Noten.
//   * Die Glyphen-POSITIONEN trennen die Fassungen. Englische Silben sind
//     anders breit, der Notensatz rückt die Noten entsprechend – gemessen bis zu
//     17 pt Unterschied in x (y bleibt gleich, die Systeme stehen ja fest).
//
// Platziert wird 1:1 (Maßstab 1.0, reine Verschiebung). Ein Vergleich gegen die
// DB-Datei ist deshalb kein Ähnlichkeitsmaß, sondern exakt: Über die 123
// Notenseiten der Test-Druck-PDF stimmten 116 auf < 0.01 pt, 119 auf < 0.5 pt.

// Musik-Glyphen liegen im Private-Use-Bereich der Notenschrift.
const PUA_MIN = 0xe000;
const PUA_MAX = 0xf8ff;

// Passt der Druck geometrisch zur DB-Datei? 0.5 pt trennt sauber: Die richtige
// Fassung liegt praktisch immer unter 0.01 pt, die falsche ab ~7 pt.
export const GEOMETRY_TOLERANCE_PT = 0.5;

// Version des gespeicherten Fingerabdrucks. Ändert sich das Format, laufen alte
// Werte nicht stillschweigend in einen Fehlalarm, sondern gelten als „fehlt".
export const FINGERPRINT_VERSION = 1;

// Ist dieser Text-Item-String reine Notenschrift (und nicht leer)?
export function isMusicGlyphString(str) {
    const s = (str || '').replace(/\s/g, '');
    if (!s) return false;
    for (const ch of s) {
        const c = ch.codePointAt(0);
        if (!(c >= PUA_MIN && c <= PUA_MAX)) return false;
    }
    return true;
}

function median(nums) {
    if (!nums.length) return 0;
    const s = [...nums].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Auf 2 Nachkommastellen runden: Die PDF-Koordinaten selbst sind nicht feiner,
// und der gespeicherte Fingerabdruck bleibt so ~1 KB pro Lied statt ~3 KB.
const r2 = (n) => Math.round(n * 100) / 100;

// --- Fingerabdruck aus einer Notensatz-PDF ---------------------------------

// Musik-Glyphen einer Seite in Content-Stream-Reihenfolge, ein Eintrag je
// GLYPHE. Bewusst je Glyphe und nicht je Item: Wie viele Glyphen ein Text-Item
// enthält, ist keine Eigenschaft des Notensatzes, sondern des PDF-Erzeugers –
// Finale schreibt jede Glyphe einzeln, InDesign fasst sie zu Gruppen zusammen
// („e050 e260 e084" in EINEM Item). Auf Glyphen-Ebene sind beide vergleichbar,
// auf Item-Ebene nicht.
//
// Die x/y eines Items gelten dabei für dessen ERSTE Glyphe; die folgenden Glyphen
// des Items bekommen sie ebenfalls, ihre echte Position ist aus dem Text-Layer
// nicht ablesbar. Für den Vergleich ist das ohne Belang: Verglichen werden nur
// Item-Anfänge (siehe alignPlacement).
export async function pageMusicGlyphs(page) {
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const glyphs = [];
    for (const it of content.items) {
        if (typeof it.str !== 'string' || !isMusicGlyphString(it.str)) continue;
        const s = it.str.replace(/\s/g, '');
        const x = it.transform[4];
        const yTop = viewport.height - it.transform[5]; // von oben, wie in printPdfCheck
        for (const ch of s) glyphs.push({ ch, x, yTop });
    }
    return glyphs;
}

// Fingerabdruck einer ganzen Notensatz-PDF (PDFDocumentProxy).
// `fileId` wandert mit in den Wert: Wird `notentext` ausgetauscht, ohne den
// Fingerabdruck neu zu rechnen, ist der alte Wert erkennbar veraltet und wird
// verworfen, statt einen Fehlalarm auszulösen.
export async function fingerprintNotenPdf(pdfDoc, fileId) {
    const pages = [];
    for (let p = 1; p <= pdfDoc.numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const glyphs = await pageMusicGlyphs(page);
        pages.push({
            seq: glyphs.map((g) => g.ch).join(''),
            x: glyphs.map((g) => r2(g.x)),
            y: glyphs.map((g) => r2(g.yTop)),
        });
    }
    return { v: FINGERPRINT_VERSION, file: fileId ?? null, pages };
}

// Ist der gespeicherte Wert benutzbar – und gehört er noch zur aktuellen Datei?
export function isFingerprintUsable(fp, fileId) {
    if (!fp || fp.v !== FINGERPRINT_VERSION || !Array.isArray(fp.pages)) return false;
    if (!fp.pages.length || !fp.pages.some((p) => p?.seq)) return false;
    // Ohne `file` lässt sich Veralten nicht ausschließen -> nicht vertrauen.
    return !!fp.file && !!fileId && fp.file === fileId;
}

// --- Platzierungen in der Druck-PDF ---------------------------------------

// Die Musik-Glyphen EINER Seite der Druck-PDF zu Platzierungen gruppieren.
//
// Eine Seite kann mehrere platzierte Notensätze enthalten: Auf Seite 15 der
// Test-PDF steht neben dem eigenen Notensatz noch ein zweiter komplett neben der
// Seite (x = −265 … −44). Unterschieden werden sie über die Schrift-Id, die
// pdf.js je eingebettetem Font vergibt – zwei platzierte PDFs bringen jeweils
// ihre eigene Kopie der Notenschrift mit.
//
// Gewertet wird nur, was AUF der Seite steht: Nur das wird gedruckt, und nur
// dafür ist der Vergleich mit der DB eine Aussage über das gedruckte Buch.
// (Text neben der Seite meldet ohnehin schon der Check „Text außerhalb des
// Druckbereichs".)
export function groupMusicPlacements(musicItems, width, height) {
    const byFont = new Map();
    for (const it of musicItems) {
        const inPage = it.x >= 0 && it.x <= width && it.yTop >= 0 && it.yTop <= height;
        if (!inPage) continue;
        if (!byFont.has(it.font)) byFont.set(it.font, { font: it.font, seq: '', items: [] });
        const g = byFont.get(it.font);
        // `off` = Glyphen-Index des Item-ANFANGS in der Folge. Darüber läuft
        // später die Zuordnung zur DB-Glyphe, unabhängig davon, wie der Erzeuger
        // die Glyphen zu Items zusammengefasst hat.
        g.items.push({ off: g.seq.length, x: it.x, yTop: it.yTop });
        g.seq += it.str;
    }
    return [...byFont.values()];
}

// --- Vergleich Druck ↔ DB --------------------------------------------------

// Eine Platzierung gegen eine Fingerabdruck-Seite halten.
//
// Verglichen werden Item-ANFÄNGE: Item i der Platzierung beginnt bei Glyphe
// `off`, also muss es auf DB-Glyphe `off` liegen. Alle Paare müssen dieselbe
// Verschiebung ergeben – der Notensatz wird unskaliert platziert.
//
// Ergebnis:
//   match: 'exact'  – Folge identisch
//          'prefix' – Druck ist ein echter Anfang der DB-Datei: hinten fehlt
//                     etwas (abgeschnittener Notensatz)
//          'none'   – andere Datei
//   dx/dy/residual – Verschiebung und größte Abweichung davon (in pt)
//   missing        – Anzahl der im Druck fehlenden Glyphen (nur bei 'prefix')
export function alignPlacement(placement, fpPage) {
    const ps = placement.seq;
    const ds = fpPage?.seq || '';
    if (!ps || !ds) return { match: 'none', residual: Infinity, missing: 0 };

    let match = 'none';
    if (ps === ds) match = 'exact';
    else if (ds.length > ps.length && ds.startsWith(ps)) match = 'prefix';
    else return { match: 'none', residual: Infinity, missing: 0 };

    const dxs = [];
    const dys = [];
    for (const it of placement.items) {
        dxs.push(it.x - fpPage.x[it.off]);
        dys.push(it.yTop - fpPage.y[it.off]);
    }
    // Median statt Mittelwert: ein einzelner Ausreißer soll die Verschiebung
    // nicht verziehen, sondern als Abweichung sichtbar werden.
    const dx = median(dxs);
    const dy = median(dys);
    let residual = 0;
    for (let i = 0; i < dxs.length; i++) {
        residual = Math.max(residual, Math.abs(dxs[i] - dx), Math.abs(dys[i] - dy));
    }
    return { match, dx, dy, residual, missing: match === 'prefix' ? ds.length - ps.length : 0 };
}

// Wo steht in der DB-Datei das, was im Druck fehlt? Für die Meldung („das letzte
// System fehlt") und um zu erkennen, dass es der SCHLUSS ist, nicht die Mitte.
export function missingTailExtent(fpPage, fromIndex) {
    const ys = fpPage.y.slice(fromIndex);
    if (!ys.length) return null;
    return { yMin: Math.min(...ys), yMax: Math.max(...ys), count: ys.length };
}

// Beste DB-Fassung zu einer Platzierung suchen.
//
// `candidates`: [{ lied, fpPage }] – alle in Frage kommenden DB-Fassungen (bei
// einer Liednummer mit Übersetzung sind das mehrere). Entschieden wird über die
// Geometrie: Die richtige Fassung liegt praktisch bei 0, die falsche bei ~7–17 pt.
// Genau das trennt „deutscher Notensatz" von „englischem Notensatz".
export function pickBestCandidate(placement, candidates) {
    const scored = [];
    for (const c of candidates) {
        const a = alignPlacement(placement, c.fpPage);
        if (a.match === 'none') continue;
        scored.push({ ...c, ...a });
    }
    if (!scored.length) return { best: null, runnerUp: null };
    // Exakte Folge schlägt Anfangs-Treffer; danach entscheidet die Geometrie.
    scored.sort(
        (a, b) =>
            (a.match === 'exact' ? 0 : 1) - (b.match === 'exact' ? 0 : 1) ||
            a.residual - b.residual,
    );
    return { best: scored[0], runnerUp: scored[1] || null };
}
