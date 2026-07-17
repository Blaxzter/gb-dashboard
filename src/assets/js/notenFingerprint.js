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

// Ab dieser Glyphen-Ähnlichkeit gilt der Druck als DIESELBE Gravur wie die
// DB-Datei (nur mit ein paar abweichenden Zeichen). Getrennt wird damit sauber:
// dieselbe Gravur liegt ≥ 0.90, eine ganz andere Datei bei ~0.75.
export const SEQ_MATCH_MIN = 0.85;
// Ein echter Anfang (abgeschnittener Notensatz): der Druck trifft den DB-Anfang
// so gut, und hinten fehlen mindestens so viele Glyphen. Der Mindestschwanz
// verhindert, dass ein einzelnes fehlendes Zeichen als „zweite Seite fehlt" gilt.
const PREFIX_HEAD_MIN = 0.9;
const PREFIX_MIN_TAIL = 8;

// Levenshtein-Distanz (begrenzte Länge – Notensätze haben ~30–220 Glyphen).
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let cur = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
        cur[0] = i;
        for (let j = 1; j <= n; j++) {
            cur[j] = Math.min(
                prev[j] + 1,
                cur[j - 1] + 1,
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
        [prev, cur] = [cur, prev];
    }
    return prev[n];
}

export function seqSimilarity(a, b) {
    if (!a && !b) return 1;
    return 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);
}

function percentile(nums, p) {
    if (!nums.length) return 0;
    const s = [...nums].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

// Eine Platzierung gegen eine Fingerabdruck-Seite halten.
//
// Verglichen werden Item-ANFÄNGE: Item i der Platzierung beginnt bei Glyphe
// `off`, also muss es auf DB-Glyphe `off` liegen. Alle Paare müssen dieselbe
// Verschiebung ergeben – der Notensatz wird unskaliert platziert.
//
// Ergebnis:
//   match: 'exact'  – Folge identisch
//          'fuzzy'  – dieselbe Gravur, aber einzelne Glyphen weichen ab
//                     (im Satz ersetztes/fehlendes Zeichen, z. B. eine Pause)
//          'prefix' – Druck ist ein echter Anfang der DB-Datei: hinten fehlt ein
//                     System (abgeschnittener Notensatz)
//          'none'   – andere Datei
//   dx/dy    – Verschiebung (Median)
//   residual – 75. Perzentil der Abweichung von der Verschiebung. Perzentil statt
//              Maximum: ein paar ersetzte Glyphen sollen die Geometrie nicht
//              sprengen (sonst sähe die richtige Fassung „verschoben" aus).
//   sim/edits – Glyphen-Ähnlichkeit bzw. -Distanz zur DB-Datei
//   missing   – Anzahl im Druck fehlender Glyphen (nur bei 'prefix')
export function alignPlacement(placement, fpPage) {
    const ps = placement.seq;
    const ds = fpPage?.seq || '';
    if (!ps || !ds) return { match: 'none', residual: Infinity, missing: 0, sim: 0, edits: 0 };

    const dxs = [];
    const dys = [];
    for (const it of placement.items) {
        if (it.off >= fpPage.x.length) continue;
        dxs.push(it.x - fpPage.x[it.off]);
        dys.push(it.yTop - fpPage.y[it.off]);
    }
    const dx = median(dxs);
    const dy = median(dys);
    const devs = dxs.map((v, i) => Math.max(Math.abs(v - dx), Math.abs(dys[i] - dy)));
    const residual = devs.length ? percentile(devs, 0.75) : Infinity;

    const edits = levenshtein(ps, ds);
    const sim = 1 - edits / Math.max(ps.length, ds.length, 1);
    const missing = ds.length - ps.length;
    let match;
    if (ps === ds) match = 'exact';
    else if (
        missing >= PREFIX_MIN_TAIL &&
        seqSimilarity(ps, ds.slice(0, ps.length)) >= PREFIX_HEAD_MIN
    )
        match = 'prefix';
    else if (sim >= SEQ_MATCH_MIN) match = 'fuzzy';
    else return { match: 'none', residual: Infinity, missing: 0, sim, edits };

    return { match, dx, dy, residual, sim, edits, missing: match === 'prefix' ? missing : 0 };
}

// DB-Glyphen-Indizes, die im Druck FEHLEN oder ERSETZT wurden. Grundlage ist ein
// Alignment (Needleman-Wunsch) der beiden Glyphen-Folgen: gesammelt werden die
// DB-Glyphen ohne gleiches Gegenstück im Druck.
function mismatchDbIndices(a, b) {
    const m = a.length;
    const n = b.length;
    if (!m || !n) return [];
    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    const idx = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        if (dp[i][j] === dp[i - 1][j - 1] + cost) {
            if (cost) idx.push(j - 1);
            i--;
            j--;
        } else if (dp[i][j] === dp[i][j - 1] + 1) {
            idx.push(j - 1);
            j--;
        } else {
            i--;
        }
    }
    while (j > 0) {
        idx.push(j - 1);
        j--;
    }
    return idx.sort((p, q) => p - q);
}

// Benachbarte DB-Glyphen zu einer Fundstelle zusammenfassen. Ein ersetztes
// Zeichen (etwa eine Pause) reißt im Alignment oft die Nachbarn mit (eine
// vertauschte Halbe daneben) – ohne Bündelung stünden dort zwei, drei Kästchen
// statt eines. Zusammengefasst wird, was in derselben Notenzeile (ähnliches y)
// dicht beieinander liegt.
function clusterIndices(fpPage, idxs) {
    const items = idxs
        .map((k) => ({ k, x: fpPage.x[k], y: fpPage.y[k] }))
        .sort((a, b) => a.y - b.y || a.x - b.x);
    const clusters = [];
    for (const it of items) {
        const c = clusters.find(
            (cl) =>
                it.y >= cl.yMin - 14 &&
                it.y <= cl.yMax + 14 &&
                it.x >= cl.xMin - 26 &&
                it.x <= cl.xMax + 26,
        );
        if (c) {
            c.ks.push(it.k);
            c.xMin = Math.min(c.xMin, it.x);
            c.xMax = Math.max(c.xMax, it.x);
            c.yMin = Math.min(c.yMin, it.y);
            c.yMax = Math.max(c.yMax, it.y);
        } else {
            clusters.push({ ks: [it.k], xMin: it.x, xMax: it.x, yMin: it.y, yMax: it.y });
        }
    }
    return clusters;
}

// Die abweichenden Stellen als Kästen – je Fundstelle einer, auf BEIDEN Seiten:
//   print    – in Druck-Koordinaten (DB-Position + Verschiebung), mit Seitennr.
//   original – in Koordinaten der DB-Notensatz-PDF (für den Vergleichs-Dialog).
// So markieren beide Overlays dieselbe Stelle.
export function diffGlyphMarks(placement, fpPage, dx, dy, page) {
    const clusters = clusterIndices(fpPage, mismatchDbIndices(placement.seq, fpPage.seq));
    const PAD = 8;
    const TOP = 15;
    const BOT = 6;
    const rect = (c, ox, oy) => ({
        x: c.xMin + ox - PAD,
        y: c.yMin + oy - TOP,
        w: c.xMax - c.xMin + 2 * PAD,
        h: c.yMax - c.yMin + TOP + BOT,
    });
    return {
        print: clusters.map((c) => ({ page, rect: rect(c, dx, dy) })),
        original: clusters.map((c) => ({ rect: rect(c, 0, 0) })),
    };
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
