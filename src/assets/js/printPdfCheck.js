// Sicherheitsnetz-Prüfung der fertigen Druck-PDF gegen die Datenbank.
//
// Hintergrund: Aus dem CSV-Export baut ein externer Prozess (InDesign) die
// druckfertige PDF. Dabei können sich menschliche Fehler einschleichen (falsche
// Liednummer, vertippte Strophe, fehlendes/ vertauschtes Lied, falsche Jahres-
// zahl in der Fußzeile …). Diese Datei liest den Text-Layer der PDF aus und
// vergleicht ihn mit dem, was der Export aus den aktuellen „genommenen" Liedern
// erzeugen würde.
//
// WICHTIG – was NICHT geprüft werden kann:
//   * Strophe 1 (und ggf. Strophe 2) stehen als Vektor-Grafik unter den Noten
//     (die Optima-Schrift wurde beim „Microsoft Print to PDF" in Pfade
//     umgewandelt) und haben KEINEN Text-Layer. Geprüft werden daher nur die
//     Liednummer, die Textstrophen 2..n und die Fußzeile.
//   * Die Noten selbst.
//
// Der Musiksatz liegt als Font mit Private-Use-Glyphen (SMuFL, U+E000–U+F8FF)
// vor – diese Items werden herausgefiltert, sodass nur echter Text (Optima)
// übrig bleibt: die große Liednummer oben, die hängenden Strophen-Nummern am
// linken Rand, die Strophentexte und die Fußzeile.

import { resolveLiednummer2026, similarity, status_mapping } from '@/assets/js/utils';
import { buildFooter } from '@/assets/js/authorFormat';
import { isGenommen } from '@/assets/js/gesangbuchChecks';
import { groupMusicPlacements, isMusicGlyphString } from '@/assets/js/notenFingerprint';

// --- Text-Normalisierung ---------------------------------------------------

// Vergleichsform eines Textes: typografische Zeichen vereinheitlichen, Silben-
// trenner/Soft-Hyphen entfernen, Whitespace zusammenfassen. Groß-/Kleinschrei-
// bung bleibt erhalten (ein Unterschied wird über similarity() als „geringfügig"
// eingestuft, nicht als harter Fehler).
export function canon(s) {
    return (s || '')
        .normalize('NFC')
        .replace(/[¬­]/g, '') // ¬ Silbentrenner, soft hyphen
        .replace(/[’‘‛]/g, "'")
        .replace(/[“”„‟]/g, '"')
        .replace(/[–—−]/g, '-')
        .replace(/[\p{Zs}\s]+/gu, ' ')
        .trim();
}

// Strophentext eines DB-Strophenobjekts (bevorzugt `strophe`, Fallback `text`).
function dbVerseText(strophe) {
    return strophe?.strophe ?? strophe?.text ?? '';
}

// Ein Item ist „Rauschen", wenn es (nach Entfernen von Whitespace) leer ist oder
// ausschließlich aus Private-Use-Glyphen besteht (Notensatz-Font).
function isNoise(str) {
    const s = (str || '').replace(/\s/g, '');
    if (!s) return true;
    for (const ch of s) {
        const c = ch.codePointAt(0);
        if (!(c >= 0xe000 && c <= 0xf8ff)) return false;
    }
    return true;
}

function median(nums) {
    if (!nums.length) return 0;
    const s = [...nums].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Führende Ganzzahl (für Reihenfolge-Vergleich). "12a" -> 12, "" -> null.
function numInt(v) {
    const m = String(v ?? '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
}

// Vergleichsschlüssel einer Liednummer (führende Nullen weg, Suffix klein).
// "001" -> "1", "12a" -> "12a".
function numKey(v) {
    const m = String(v ?? '').match(/^\s*0*(\d+)\s*([a-zA-Z]?)/);
    if (!m)
        return String(v ?? '')
            .trim()
            .toLowerCase();
    return `${m[1]}${(m[2] || '').toLowerCase()}`;
}

function statusLabel(status) {
    return status_mapping[status] || status || '—';
}

function trunc(s, n = 90) {
    const t = canon(s);
    return t.length > n ? t.slice(0, n) + '…' : t;
}

// --- Fußzeilen-Vergleich ---------------------------------------------------

const FOOTER_LABEL =
    /^\s*(Text und Melodie|Melodie und Satz|Melodie und Rechte|Text|Melodie|Satz|Anmerkung|Übersetzung|Übertragung|Rechte|Quelle|Kanon)\s*:/i;
const FOOTER_COPYRIGHT = /^\s*©/;
// Fußzeilen-Labels, die buildFooter NICHT erzeugt und die daher nicht gegen die
// DB geprüft werden können (rein informativ).
const FOOTER_UNVERIFIABLE = /^\s*(Anmerkung|Quelle|Kanon)\s*:/i;
const FOOTER_LABEL_WORDS =
    /\b(text|melodie|satz|und|rechte|übersetzung|übertragung|quelle|kanon|anmerkung)\b/gi;

// Beginnt diese Zeile die Fußzeile eines Liedes („Text: …", „© …")?
function isFooterLine(line) {
    return FOOTER_LABEL.test(line.text) || FOOTER_COPYRIGHT.test(line.text);
}

// Signatur einer Fußzeile für den Vergleich: nur Buchstaben+Ziffern, ohne
// Label-Wörter, ohne Jahres-Dekoration (* + – ( )). Dadurch ist der Vergleich
// unabhängig davon, dass der Druck „(*1650 +1680)" statt „(1650–1680)" setzt und
// ob „Text und Melodie" zusammengefasst oder getrennt gedruckt wird.
export function footerSignature(footerText, { dropUnverifiable = true } = {}) {
    const lines = String(footerText || '').split('\n');
    const kept = dropUnverifiable ? lines.filter((l) => !FOOTER_UNVERIFIABLE.test(l)) : lines;
    return kept
        .join(' ')
        .normalize('NFC')
        .toLowerCase()
        .replace(FOOTER_LABEL_WORDS, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, '');
}

// "XX" (erste Hälfte == zweite Hälfte) zu "X" reduzieren. So gilt die gedruckte
// getrennte Form ("Text: X / Melodie: X") als gleichwertig zur zusammengefassten
// buildFooter-Form ("Text und Melodie: X"), wenn Text- und Melodie-Autor gleich
// sind – kein Fehlalarm für rein kosmetisches Zusammenfassen/Trennen.
function collapseHalf(sig) {
    if (sig && sig.length % 2 === 0) {
        const half = sig.length / 2;
        if (sig.slice(0, half) === sig.slice(half)) return sig.slice(0, half);
    }
    return sig;
}

// True, wenn die berechnete und die gedruckte Fußzeile fachlich übereinstimmen.
export function footerSignaturesMatch(expected, pdf) {
    const e = footerSignature(expected);
    const p = footerSignature(pdf);
    if (e === p) return true;
    return collapseHalf(e) === collapseHalf(p);
}

// --- PDF-Text extrahieren --------------------------------------------------

// Liest die Text-Items einer Seite (ohne Notensatz-Rauschen) und liefert sie mit
// Position (x, yTop von oben) und Schriftgröße zurück.
//
// Bewusst NICHT über die Position der Notensatz-Glyphen gehen: verschiedene
// pdf.js-Versionen melden für sie unterschiedliche Grundlinien (2.9 setzt sie an
// den Seitenkopf, 4.x an die Notenzeile). Der Seiten-Übergang in extractPdfSongs
// orientiert sich deshalb an der Liednummer, die in jeder Version dort sitzt, wo
// sie gedruckt ist.
async function extractPageItems(page) {
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = [];
    const offPage = [];
    const musicItems = []; // für den Notensatz-Abgleich (notenFingerprint.js)
    let musicCount = 0; // Notensatz-Glyphen AUF der Seite → hier beginnt ein Lied
    let musicTop = null;
    for (const it of content.items) {
        if (typeof it.str !== 'string') continue;
        const t = it.transform;
        const x = t[4];
        const yTop = viewport.height - t[5]; // von oben, damit Lesereihenfolge = aufsteigend
        const inPage = x >= 0 && x <= viewport.width && yTop >= 0 && yTop <= viewport.height;

        if (isNoise(it.str)) {
            // Der platzierte Notensatz ragt weit über seinen Rahmen hinaus (x von
            // −265 bis 556 auf einer 312 pt breiten Seite); InDesign beschneidet
            // ihn. Gezählt wird deshalb nur, was wirklich auf der Seite steht –
            // sonst „hätte" auch eine reine Textseite Noten (Seite 143).
            if (inPage && it.str.replace(/\s/g, '')) {
                musicCount++;
                if (musicTop == null || yTop < musicTop) musicTop = yTop;
            }
            // Reihenfolge des Content-Streams beibehalten: Sie ist die Reihenfolge,
            // in der auch die Notensatz-PDF ihre Glyphen schreibt, und damit die
            // Grundlage des Vergleichs.
            if (isMusicGlyphString(it.str)) {
                musicItems.push({
                    str: it.str.replace(/\s/g, ''),
                    x,
                    yTop,
                    font: it.fontName || '',
                });
            }
            continue;
        }

        const item = {
            str: it.str,
            x,
            yTop,
            width: it.width || 0,
            size: Math.abs(t[3]) || it.height || 0,
            font: it.fontName || '', // pdf.js-interne Id, je Seite eindeutig
        };
        // Text außerhalb der Seite wird nicht gedruckt und darf den Satz nicht
        // verfälschen. Der platzierte Notensatz ist breiter als sein Rahmen;
        // InDesign beschneidet ihn, im Text-Layer stehen die abgeschnittenen
        // Reste aber weiter drin – bei Lied 80 die Strophenzähler „1." / „2."
        // des Notensatzes bei x = 357 und 455 auf einer 312 pt breiten Seite.
        // Ungeprüft ignorieren wäre falsch: Genauso könnte hier eine Strophe
        // aus dem Rahmen gelaufen und damit aus dem Druck gefallen sein. Also
        // aussortieren UND melden (Check „Text außerhalb des Druckbereichs").
        if (inPage) items.push(item);
        else offPage.push(item);
    }
    return {
        items,
        offPage,
        musicItems,
        musicCount,
        musicTop,
        width: viewport.width,
        height: viewport.height,
    };
}

// Text, der zum Notensatz gehört, nicht zum Lied: Der platzierte Notensatz
// bringt eigene Beschriftungen mit, allen voran die Wiederholungs-Klammern
// („1." und „2." über dem Schlusstakt, Lied 81 / Seite 115). Sie stehen mitten
// auf der Seite und sind gedruckt – wegwerfen per Seitenrand geht also nicht.
// Ohne Filter liest splitVerses die Zeile „1. 2." als „Strophe 1 mit dem Text
// «2.»".
//
// Unterschieden wird über die Schrift: Strophen, Fußzeile und die hängenden
// Strophennummern stehen in der Textschrift, alles aus dem Notensatz in dessen
// eigener Schrift. Die Position hilft nicht – pdf.js 2.9 meldet für die
// Noten-Glyphen unbrauchbare Koordinaten (x von −265 bis 564 auf einer 312 pt
// breiten Seite), ein „liegt im Notenbild"-Test wäre also nicht verlässlich.
//
// Verworfen wird nur Text OHNE Buchstaben (Ziffern/Satzzeichen) in einer fremden
// Schrift – eine hängende Strophennummer steht in der Textschrift und bleibt
// damit erhalten. Findet sich gar keine Textschrift (Seite ohne Strophen), ist
// eine einzelne Zahl ohnehin keine Strophennummer und fliegt ebenfalls raus.
function dropNotationItems(items) {
    const hasLetter = (i) => /\p{L}/u.test(i.str);
    const counts = new Map();
    for (const i of items) {
        if (hasLetter(i)) counts.set(i.font, (counts.get(i.font) || 0) + 1);
    }
    let bodyFont = null;
    let best = 0;
    for (const [font, n] of counts) {
        if (n > best) {
            best = n;
            bodyFont = font;
        }
    }
    return items.filter((i) => hasLetter(i) || (bodyFont != null && i.font === bodyFont));
}

// Kasten für einen Befund, der (teilweise) außerhalb der Seite liegt: auf die
// Seite geklemmt, damit das Overlay ihn an der Kante zeigt, statt ins Leere zu
// zeichnen. Mindestgröße, falls der Kasten dabei auf null zusammenfällt.
function clampRectToPage(rect, width, height) {
    const MIN = 6;
    const x0 = Math.min(Math.max(rect.x, 0), width);
    const y0 = Math.min(Math.max(rect.y, 0), height);
    const w = Math.max(Math.min(Math.max(rect.x + rect.w, 0), width) - x0, MIN);
    const h = Math.max(Math.min(Math.max(rect.y + rect.h, 0), height) - y0, MIN);
    return { x: Math.min(x0, width - w), y: Math.min(y0, height - h), w, h };
}

// Erkennt die beiden Zahlen am oberen Außenrand einer Liedseite:
//   * die große obere Zahl  = gb2026-Liednummer
//   * die kleinere darunter = Choralbuchnummer (optional)
// Beide stehen in derselben (linken oder rechten) Randspalte über dem Notensatz;
// der Musiksatz selbst ist bereits als Rauschen herausgefiltert.
//
// Der Liedblock rutscht nach unten, wenn oben noch der Strophenrest des
// vorherigen Liedes steht (siehe extractPdfSongs) – ein enges Fenster am
// Seitenkopf würde die Nummern dann verlieren. Erkannt wird die Liednummer
// deshalb über ihren Schriftgrad: Sie ist deutlich größer gesetzt als der
// Fließtext. Die Choralbuchnummer hat dagegen fast Fließtextgröße und wird
// relativ zur Liednummer gesucht (gleiche Randspalte, direkt darunter).
function detectNumbers(items, pageHeight, sizeHint) {
    const nums = items.filter(
        (i) => i.yTop < pageHeight * 0.5 && /^\d{1,3}[a-zA-Z]?$/.test(i.str.trim()),
    );
    const numberItem = nums
        .filter((i) => i.size >= sizeHint * 1.4)
        .sort((a, b) => b.size - a.size || a.yTop - b.yTop)[0];
    if (!numberItem) return { numberItem: null, choralItem: null };
    const choralItem =
        nums.find(
            (i) =>
                i !== numberItem &&
                Math.abs(i.x - numberItem.x) < 40 &&
                i.yTop > numberItem.yTop &&
                i.yTop - numberItem.yTop < 60,
        ) || null;
    return { numberItem, choralItem };
}

// Items zu Zeilen gruppieren (nach yTop mit Toleranz), innerhalb der Zeile nach x
// sortieren und den Zeilentext rekonstruieren.
function groupLines(items, sizeHint) {
    const tol = Math.max(2.5, sizeHint * 0.6);
    const sorted = [...items].sort((a, b) => a.yTop - b.yTop || a.x - b.x);
    const lines = [];
    for (const it of sorted) {
        const last = lines[lines.length - 1];
        if (last && Math.abs(it.yTop - last.yTop) <= tol) {
            last.items.push(it);
        } else {
            lines.push({ yTop: it.yTop, items: [it] });
        }
    }
    for (const line of lines) {
        line.items.sort((a, b) => a.x - b.x);
        line.x = line.items[0].x;
        line.size = median(line.items.map((i) => i.size));
        line.text = buildLineText(line.items);
        // Linker Rand des sichtbaren Textes: InDesign schreibt Einrückungen teils
        // als führende Leerzeichen INNERHALB des Items, die x-Position der Zeile
        // bleibt dabei am Satzspiegel. Für „ist die Zeile eingerückt?" zählt aber
        // der erste sichtbare Buchstabe, deshalb hier die Leerzeichen mitrechnen.
        line.textX = line.x + leadingSpaceWidth(line.items[0]);
    }
    return lines.filter((l) => l.text.trim() !== '');
}

// Breite der führenden Leerzeichen eines Items (Näherung: Leerzeichen ≈ 0,25 em).
function leadingSpaceWidth(item) {
    const n = (String(item?.str || '').match(/^\s*/) || [''])[0].length;
    return n * (item?.size || 10) * 0.25;
}

// Zeilentext aus den Items zusammensetzen; Leerzeichen nur bei echter x-Lücke.
function buildLineText(items) {
    let out = '';
    let prev = null;
    for (const it of items) {
        if (prev) {
            const gap = it.x - (prev.x + prev.width);
            const needSpace =
                gap > (prev.size || 10) * 0.15 && !/\s$/.test(out) && !/^\s/.test(it.str);
            if (needSpace) out += ' ';
        }
        out += it.str;
        prev = it;
    }
    return out.replace(/[ \t]+/g, ' ').trim();
}

// Zeilen einer Verszeile am Zeilenende de-silbentrennen und zusammenfügen.
function joinDehyphen(lines) {
    let out = '';
    for (let i = 0; i < lines.length; i++) {
        const seg = lines[i].trim();
        if (i === 0) {
            out = seg;
        } else if (/[-­]$/.test(out)) {
            out = out.replace(/[-­]$/, '') + seg;
        } else {
            out = out + ' ' + seg;
        }
    }
    return out;
}

// Body-Zeilen in Strophen zerlegen. Eine Strophe beginnt mit einer hängenden
// 1–2-stelligen Nummer (am linken Rand). Vers 1 steht im Notensatz und taucht
// hier nicht auf – die Nummerierung startet daher üblicherweise bei 2 (oder 3,
// wenn zwei Strophen im Notensatz stehen). Strophen, vor denen im Satz die
// Nummer fehlt, bekommen `num: null`.
function splitVerses(bodyLines) {
    const verses = [];
    let cur = null;
    for (const line of bodyLines) {
        const withText = line.text.match(/^\s*(\d{1,2})[.)]?\s+(\S.*)$/);
        const onlyNum = line.text.match(/^\s*(\d{1,2})[.)]?\s*$/);
        if (withText || onlyNum) {
            // `textLines` läuft synchron zu `lines` (Zeilentext ohne die
            // hängende Nummer) – compareVerses schneidet daran, wenn an einer
            // Strophe eine unnummerierte Folgestrophe klebt.
            cur = {
                num: parseInt((withText || onlyNum)[1], 10),
                textLines: [withText ? withText[2] : ''],
                lines: [line],
            };
            verses.push(cur);
        } else if (cur) {
            cur.textLines.push(line.text);
            cur.lines.push(line);
        } else {
            // Textzeilen, vor denen keine hängende Nummer steht. Im Satz muss
            // jede Textstrophe eine bekommen (2., 3., …) – fehlt sie, landen die
            // Zeilen hier. Die Nummer bleibt offen; compareVerses() erschließt
            // sie (Position im Satz / Textähnlichkeit zur DB) und meldet die
            // fehlende Nummer als Fehler.
            cur = { num: null, textLines: [line.text], lines: [line] };
            verses.push(cur);
        }
    }
    for (const v of verses) {
        v.text = joinDehyphen(v.textLines);
        v.box = boxOfLines(v.lines);
    }
    // Leere „Strophen" (z. B. eine irrtümlich als Marker erkannte Kolumnenziffer)
    // wieder verwerfen.
    return verses.filter((v) => v.text.trim() !== '');
}

// Bounding-Box (in PDF-Punkten, Ursprung oben-links) einer Item-Liste. Die
// Glyphen reichen von der Grundlinie um ~0.8·Größe nach oben und ~0.25 nach unten.
function bboxOfItems(items) {
    let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
    for (const it of items) {
        const asc = it.size * 0.9;
        const desc = it.size * 0.3;
        if (it.x < x0) x0 = it.x;
        if (it.x + it.width > x1) x1 = it.x + it.width;
        if (it.yTop - asc < y0) y0 = it.yTop - asc;
        if (it.yTop + desc > y1) y1 = it.yTop + desc;
    }
    if (!Number.isFinite(x0)) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Box (mit Seitennummer) über die Items mehrerer Zeilen; nutzt die Seite der
// ersten Zeile (mehrseitige Strophen sind selten – dann Kasten auf Seite 1).
function boxOfLines(lines) {
    if (!lines || !lines.length) return null;
    const page = lines[0].page;
    const items = lines.filter((l) => l.page === page).flatMap((l) => l.items);
    const rect = bboxOfItems(items);
    return rect ? { page, rect } : null;
}

// Kasten dort, wo die Liednummer stehen müsste (Kopfsteg außen: gerade Seiten
// links, ungerade rechts) – als Anker für den Befund „Liednummer fehlt".
function expectedNumberRect(page, width) {
    const w = 40;
    return { x: page % 2 === 0 ? 6 : width - w - 6, y: 30, w, h: 34 };
}

// Eine ganze PDF (PDFDocumentProxy von vue-pdf-embed/pdf.js) in Lieder zerlegen.
// Rückgabe: { songs, pageCount, blankPages, introPages, clipped, warnings }.
export async function extractPdfSongs(pdfDoc) {
    const pageCount = pdfDoc.numPages;
    const songs = [];
    const blankPages = [];
    const introPages = [];
    const clipped = []; // Text außerhalb der Seite – je Seite ein Eintrag.
    const pageSizes = {};
    let cur = null;

    for (let p = 1; p <= pageCount; p++) {
        const page = await pdfDoc.getPage(p);
        const { items, offPage, musicItems, musicCount, musicTop, width, height } =
            await extractPageItems(page);
        pageSizes[p] = { width, height };
        // Platzierte Notensätze der Seite (für den Abgleich gegen die DB-Datei).
        const placements = groupMusicPlacements(musicItems, width, height).map((pl) => ({
            ...pl,
            page: p,
        }));

        if (offPage.length) {
            clipped.push({
                page: p,
                texts: offPage.map((i) => i.str.trim()).filter(Boolean),
                box: { page: p, rect: clampRectToPage(bboxOfItems(offPage), width, height) },
            });
        }

        // Leer ist eine Seite nur ohne Text UND ohne Noten (eine reine Notenseite
        // ohne Fußzeile wäre sonst „leer" und das Lied verschwunden).
        if (!items.length && !musicCount) {
            blankPages.push(p);
            continue;
        }

        const sizeHint =
            median(items.filter((i) => /\p{L}/u.test(i.str)).map((i) => i.size)) ||
            median(items.map((i) => i.size));

        // Liednummer (groß) und Choralbuchnummer (kleiner, darunter).
        const { numberItem, choralItem } = detectNumbers(items, height, sizeHint);

        // Lied- und Choralbuchnummer sind erkannt (und sind selbst reine Zahlen in
        // eigener Schrift) – erst danach den Notensatz-Text aussortieren.
        const remove = new Set([numberItem, choralItem].filter(Boolean));
        const bodyItems = dropNotationItems(
            remove.size ? items.filter((i) => !remove.has(i)) : items,
        );
        let lines = groupLines(bodyItems, sizeHint);
        for (const l of lines) l.page = p;

        // Ein Lied beginnt dort, wo sein Notensatz steht – nicht dort, wo eine
        // Liednummer steht. Beides fällt fast immer zusammen (in beiden Test-PDFs
        // 1:1), aber eben nicht immer: Auf Seite 144 fehlt die Liednummer im
        // Druck. Hinge die Zerlegung allein an der Nummer, würde die ganze Seite
        // samt Fußzeile dem vorherigen Lied zugeschlagen (dessen Fußzeile dann
        // doppelt erscheint) – und der Satzfehler bliebe unbemerkt.
        const startsSong = !!numberItem || musicCount > 0;

        if (startsSong) {
            // Läuft der Strophenblock des vorherigen Liedes über, stehen seine
            // restlichen Zeilen samt Fußzeile über dem Block des neuen Liedes –
            // der rutscht dann nach unten (Seite 42: Nummer bei y=110 statt wie
            // sonst bei y=49). Alles oberhalb des neuen Liedblocks gehört also
            // noch zum vorherigen Lied; sonst fehlt dort das Strophenende samt
            // Fußzeile, und das neue Lied bekommt fremden Text untergeschoben.
            // Anker ist die Liednummer, ersatzweise (wenn sie fehlt) die
            // Oberkante des Notensatzes.
            const blockTop = numberItem ? numberItem.yTop : musicTop;
            if (cur && blockTop != null && !cur.lines.some(isFooterLine)) {
                const spill = lines.filter((l) => l.yTop < blockTop);
                if (spill.length) {
                    cur.pages.push(p);
                    cur.lines.push(...spill); // Reihenfolge bleibt Lesereihenfolge
                    lines = lines.filter((l) => l.yTop >= blockTop);
                }
            }
            cur = {
                nummer: numberItem ? numberItem.str.trim() : null,
                choralnummer: choralItem ? choralItem.str.trim() : '',
                numberBox: numberItem
                    ? { page: p, rect: bboxOfItems([numberItem]) }
                    : { page: p, rect: expectedNumberRect(p, width) },
                choralBox: choralItem ? { page: p, rect: bboxOfItems([choralItem]) } : null,
                pages: [p],
                lines: [...lines],
                placements: [...placements],
            };
            songs.push(cur);
        } else if (cur) {
            // Fortsetzungsseite eines mehrseitigen Liedes (kein Notensatz).
            cur.pages.push(p);
            cur.lines.push(...lines);
            cur.placements.push(...placements);
        } else {
            // Text vor dem ersten Lied → Vorspann/Deckblatt.
            introPages.push(p);
        }
    }

    // Pro Lied: Fußzeile abtrennen und Strophen zerlegen.
    for (const song of songs) {
        const footerStart = song.lines.findIndex(isFooterLine);
        // Fußzeile endet vor der nächsten Strophe („2. …") oder einer nackten
        // Zahl (angefangene Folgeliednummer) – verhindert, dass bei zwei Liedern
        // auf einer Seite die Fußzeile den Rest verschluckt.
        let footerEnd = song.lines.length;
        if (footerStart !== -1) {
            for (let i = footerStart + 1; i < song.lines.length; i++) {
                const t = song.lines[i].text;
                if (/^\s*\d{1,2}[.)]\s/.test(t) || /^\s*\d{1,3}\s*$/.test(t)) {
                    footerEnd = i;
                    break;
                }
            }
        }
        const bodyLines = footerStart === -1 ? song.lines : song.lines.slice(0, footerStart);
        const footerLineObjs = footerStart === -1 ? [] : song.lines.slice(footerStart, footerEnd);

        song.verses = splitVerses(bodyLines);
        song.footerLines = footerLineObjs.map((l) => l.text);
        // Linker Rand jeder Fußzeile (inkl. führender Leerzeichen) – nötig, um
        // eingerückte Fortsetzungszeilen zu erkennen (siehe compareCopyrightScope).
        song.footerLineX = footerLineObjs.map((l) => l.textX);
        song.footerText = song.footerLines.join('\n');
        song.footerAnmerkung = song.footerLines.filter((l) => FOOTER_UNVERIFIABLE.test(l));
        song.footerBox = boxOfLines(footerLineObjs);
        delete song.lines;
    }

    return { songs, pageCount, blankPages, introPages, clipped, pageSizes, warnings: [] };
}

// --- Vergleich PDF ↔ DB ----------------------------------------------------

// Status eines Checks aus seinen (aktiven) Items ableiten. `forced` überschreibt
// (z. B. Übersichts-/Info-Checks bleiben immer „info").
function deriveStatus(items, forced) {
    if (forced) return forced;
    if (items.some((i) => i.sev === 'error')) return 'error';
    if (items.some((i) => i.sev === 'warning')) return 'warning';
    if (items.length) return 'warning';
    return 'ok';
}

// Ein „Check" im Format, das CheckCategory.vue erwartet:
//   { id, category, title, description, status, summary, items, count }
// Zusätzlich werden `forced`, `okSummary` und `problemSummary` mitgeführt, damit
// applyAcks() den Status neu berechnen kann, wenn einzelne Items bestätigt
// (ausgeblendet) werden.
export function makeCheck(
    id,
    category,
    title,
    description,
    items,
    { forceStatus, okSummary, problemSummary },
) {
    const forced = forceStatus || null;
    const status = deriveStatus(items, forced);
    const summary =
        status === 'ok'
            ? okSummary
            : problemSummary
              ? problemSummary(items)
              : `${items.length} Auffälligkeit(en)`;
    return {
        id,
        category,
        title,
        description,
        status,
        summary,
        items,
        count: items.length,
        forced,
        okSummary,
        problemSummary: problemSummary || null,
    };
}

// Stabiler Fingerprint (FNV-1a → base36) zur Wiedererkennung eines Befunds über
// mehrere PDF-Läufe hinweg – Grundlage der lokalen „Bestätigt"-Speicherung.
function hashFp(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
}

// Inhaltsbasierter Fingerprint eines Befund-Items. Bei Vergleichs-Items (pdf/
// expected) über den kanonisierten Inhalt beider Seiten – so bleibt die
// Bestätigung erhalten, solange sich weder PDF noch DB ändern.
function itemFingerprint(checkId, it) {
    const num = it.nummer ?? '';
    if (it.pdf != null || it.expected != null) {
        return hashFp(`${checkId}|${num}|${canon(it.pdf || '')}⇔${canon(it.expected || '')}`);
    }
    return hashFp(`${checkId}|${num}|${it.title ?? ''}|${it.detail ?? ''}`);
}

// Bestätigte (abgehakte) Items ausblenden und Status/Anzahl/Zusammenfassung neu
// berechnen. `isAcked(fp)` entscheidet je Item. Bestätigte Items bleiben als
// `ackedItems` erhalten (zum erneuten Einblenden/Zurücknehmen).
export function applyAcks(checks, isAcked) {
    return checks.map((c) => {
        const acked = c.items.filter((it) => isAcked(it.fp));
        if (!acked.length) return { ...c, ackedItems: [] };
        const active = c.items.filter((it) => !isAcked(it.fp));
        const status = deriveStatus(active, c.forced);
        let summary;
        if (active.length) {
            summary = c.problemSummary
                ? c.problemSummary(active)
                : `${active.length} Auffälligkeit(en)`;
        } else {
            summary = `${acked.length} bestätigt · keine offenen Befunde`;
        }
        return { ...c, status, summary, items: active, count: active.length, ackedItems: acked };
    });
}

const CAT_COMPLETE = 'Vollständigkeit & Reihenfolge';
const CAT_VERSE = 'Strophen';
const CAT_FOOTER = 'Fußzeile / Autoren';
const CAT_INFO = 'Hinweise (nicht geprüft)';
const CAT_OVERVIEW = 'Übersicht';

// Vergleicht das aus der PDF extrahierte Ergebnis mit den DB-Liedern und liefert
// die flache Liste von Checks (nach Kategorie gruppiert die View selbst).
export function comparePrintPdf(extracted, dbSongs) {
    const { songs: pdfSongs, pageCount, blankPages, introPages, clipped = [] } = extracted;

    const byId = {};
    for (const l of dbSongs) byId[l.id] = l.liednummer2026;

    // DB-Nachschlagewerke.
    const genommenByNum = new Map();
    for (const l of dbSongs.filter(isGenommen)) {
        const num = resolveLiednummer2026(l, byId);
        if (!num) continue;
        const k = numKey(num);
        if (!genommenByNum.has(k)) genommenByNum.set(k, []);
        genommenByNum.get(k).push(l);
    }
    const anyByNum = new Map();
    for (const l of dbSongs) {
        const num = resolveLiednummer2026(l, byId) || l.liednummer2026;
        if (!num) continue;
        const k = numKey(num);
        if (!anyByNum.has(k)) anyByNum.set(k, []);
        anyByNum.get(k).push(l);
    }

    const recognized = [];
    const missing = [];
    const unknown = [];
    const duplicates = [];
    const order = [];
    const songNumber = []; // Lieder, deren Liednummer im Druck fehlt
    const choral = [];
    const verseText = [];
    const verseCount = [];
    const verseSpacing = [];
    const footer = [];
    const copyrightScope = []; // Issue #78: Melodie-Copyright unklar der Melodie zugeordnet
    const allUnderNotes = [];
    const anmerkung = [];

    // Reihenfolge (Nummern müssen aufsteigen). Dieselbe Nummer mehrfach (Lied +
    // fremdsprachige Fassung) gilt NICHT als Rückwärtssprung (curr < prev).
    for (let i = 1; i < pdfSongs.length; i++) {
        const prev = numInt(pdfSongs[i - 1].nummer);
        const curr = numInt(pdfSongs[i].nummer);
        if (prev != null && curr != null && curr < prev) {
            order.push({
                sev: 'error',
                nummer: pdfSongs[i].nummer,
                title: `Lied ${pdfSongs[i].nummer} steht nach ${pdfSongs[i - 1].nummer}`,
                detail: 'Reihenfolge nicht aufsteigend',
                loc: pdfSongs[i].numberBox,
            });
        }
    }

    // PDF-Vorkommen nach Nummer gruppieren (Reihenfolge erhalten). Eine Nummer
    // kann mehrere DB-Fassungen haben (z. B. deutsch + Übersetzung). Lieder ohne
    // gedruckte Nummer lassen sich so natürlich nicht zuordnen – die kommen
    // weiter unten über den Text dran.
    const numberless = pdfSongs.filter((ps) => !ps.nummer);
    const pdfByNum = new Map();
    for (const ps of pdfSongs) {
        if (!ps.nummer) continue;
        const k = numKey(ps.nummer);
        if (!pdfByNum.has(k)) pdfByNum.set(k, []);
        pdfByNum.get(k).push(ps);
    }

    const matchedDbIds = new Set();

    for (const [k, occs] of pdfByNum) {
        const dbCands = genommenByNum.get(k) || [];

        if (!dbCands.length) {
            const anyList = anyByNum.get(k) || [];
            for (const ps of occs) {
                if (anyList.length) {
                    const l = anyList[0];
                    unknown.push({
                        sev: 'warning',
                        id: l.id,
                        nummer: ps.nummer,
                        title: l.titel || `Lied ${ps.nummer}`,
                        detail: `Lied existiert, ist aber nicht „genommen" (Status: ${statusLabel(l.status)})`,
                        loc: ps.numberBox,
                    });
                } else {
                    unknown.push({
                        sev: 'error',
                        id: null,
                        nummer: ps.nummer,
                        title: `Lied ${ps.nummer}`,
                        detail: 'Keine passende Liednummer in der Datenbank',
                        loc: ps.numberBox,
                    });
                }
                recognized.push({
                    nummer: ps.nummer,
                    choralnummer: ps.choralnummer,
                    title: '—',
                    pages: ps.pages,
                    loc: ps.numberBox,
                });
            }
            continue;
        }

        // Jedes Vorkommen der besten DB-Fassung zuordnen (Strophen-/Fußzeilen-
        // Ähnlichkeit) – so wird die englische Seite mit der englischen Fassung
        // verglichen, nicht mit der deutschen.
        const { pairs, extraPdf } = assignVersions(occs, dbCands);
        for (const { ps, lied } of pairs) {
            matchedDbIds.add(lied.id);
            // Zuordnung festhalten: Der Notensatz-Abgleich (printNotenCheck.js)
            // prüft den platzierten Notensatz gegen genau diese DB-Fassung.
            ps.liedId = lied.id;
            recognized.push({
                id: lied.id,
                nummer: ps.nummer,
                choralnummer: ps.choralnummer,
                title: lied.titel,
                pages: ps.pages,
                loc: ps.numberBox,
            });
            compareChoral(ps, lied, { choral });
            compareVerses(ps, lied, { verseText, verseCount, allUnderNotes });
            checkVerseSpacing(ps, lied, { verseSpacing });
            compareFooter(ps, lied, { footer });
            compareCopyrightScope(ps, lied, { copyrightScope });
            for (const line of ps.footerAnmerkung) {
                anmerkung.push({
                    id: lied.id,
                    nummer: ps.nummer,
                    title: lied.titel,
                    detail: line,
                    loc: ps.footerBox || ps.numberBox,
                });
            }
        }
        for (const ps of extraPdf) {
            duplicates.push({
                sev: 'error',
                nummer: ps.nummer,
                title: `Liednummer ${ps.nummer} kommt öfter vor als in der DB`,
                detail: `${occs.length}× im PDF, aber nur ${dbCands.length} genommene Fassung(en) in der DB`,
                loc: ps.numberBox,
            });
            recognized.push({
                nummer: ps.nummer,
                choralnummer: ps.choralnummer,
                title: '—',
                pages: ps.pages,
                loc: ps.numberBox,
            });
        }
    }

    // Lieder ohne gedruckte Liednummer (Seite 144). Ohne Nummer gibt es keinen
    // Schlüssel zur DB – zugeordnet wird deshalb über den Text (Strophen bzw.
    // Fußzeile). Klappt das, läuft das Lied ganz normal durch alle Prüfungen und
    // taucht nicht zusätzlich als „fehlt im PDF" auf: ein Satzfehler, ein Befund.
    for (const ps of numberless) {
        const cands = [...genommenByNum.values()].flat().filter((l) => !matchedDbIds.has(l.id));
        let best = null;
        for (const lied of cands) {
            const score = versionScore(ps, lied);
            if (!best || score > best.score) best = { lied, score };
        }
        const page = ps.pages[0];
        if (!best || best.score < 0.6) {
            songNumber.push({
                sev: 'error',
                id: null,
                nummer: null,
                title: `Seite ${page}`,
                detail: `Lied ohne Liednummer im Druck (Seite ${page}) – keiner DB-Fassung zuzuordnen`,
                loc: ps.numberBox,
            });
            recognized.push({
                nummer: '—',
                choralnummer: ps.choralnummer,
                title: '—',
                pages: ps.pages,
                loc: ps.numberBox,
            });
            continue;
        }

        const lied = best.lied;
        matchedDbIds.add(lied.id);
        ps.liedId = lied.id;
        songNumber.push({
            sev: 'error',
            id: lied.id,
            nummer: resolveLiednummer2026(lied, byId),
            title: lied.titel || `Seite ${page}`,
            detail: `Liednummer fehlt im Druck (Seite ${page}) – erwartet: ${resolveLiednummer2026(lied, byId) || '—'}${lied.melodie?.choralbuchNummer ? ` (Choralbuchnummer ${lied.melodie.choralbuchNummer})` : ''}`,
            loc: ps.numberBox,
        });
        recognized.push({
            id: lied.id,
            nummer: resolveLiednummer2026(lied, byId),
            choralnummer: ps.choralnummer,
            title: lied.titel,
            pages: ps.pages,
            loc: ps.numberBox,
        });
        // Choralbuchnummer NICHT prüfen: Sie fehlt zwangsläufig mit der Nummer –
        // das steht schon im Befund oben und wäre nur ein zweiter für denselben
        // Satzfehler. Strophen und Fußzeile werden ganz normal geprüft.
        compareVerses(ps, lied, { verseText, verseCount, allUnderNotes });
        checkVerseSpacing(ps, lied, { verseSpacing });
        compareFooter(ps, lied, { footer });
        compareCopyrightScope(ps, lied, { copyrightScope });
    }

    // Fehlende Lieder: genommen + Nummer, aber keine zugeordnete PDF-Fassung.
    for (const [, list] of genommenByNum) {
        for (const l of list) {
            if (matchedDbIds.has(l.id)) continue;
            missing.push({
                sev: 'error',
                id: l.id,
                nummer: resolveLiednummer2026(l, byId),
                title: l.titel || '—',
                detail: l.notentext
                    ? 'Im Druck-PDF nicht gefunden'
                    : 'Im Druck-PDF nicht gefunden (kein Notenbild hinterlegt)',
            });
        }
    }
    missing.sort((a, b) => (numInt(a.nummer) ?? 0) - (numInt(b.nummer) ?? 0));
    recognized.sort((a, b) => (a.pages?.[0] ?? 0) - (b.pages?.[0] ?? 0));

    const checks = [];

    checks.push(
        makeCheck(
            'overview',
            CAT_OVERVIEW,
            'Erkannte Lieder',
            'Aus dem Text-Layer der PDF erkannte Lieder. Leerseiten und Vorspann-Seiten werden übersprungen.',
            recognized.map((r) => ({
                id: r.id,
                nummer: r.nummer,
                title: r.title,
                detail:
                    `Seite${r.pages.length > 1 ? 'n' : ''} ${r.pages.join('–')}` +
                    (r.choralnummer ? ` · Choral ${r.choralnummer}` : ''),
                loc: r.loc,
            })),
            {
                forceStatus: 'info',
                okSummary: `${recognized.length} Lieder erkannt`,
                problemSummary: () =>
                    `${recognized.length} Lieder · ${pageCount} Seiten` +
                    ` (${blankPages.length} Leerseiten, ${introPages.length} Vorspann-Seiten)`,
            },
        ),
    );

    checks.push(
        makeCheck(
            'missing',
            CAT_COMPLETE,
            'Fehlende Lieder',
            'Jedes „genommene" Lied mit Liednummer muss im Druck-PDF vorkommen. Fehlt eines, wurde es beim Export vergessen.',
            missing,
            {
                okSummary: 'Alle genommenen Lieder sind im PDF vorhanden',
                problemSummary: (i) => `${i.length} genommene Lieder fehlen im PDF`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'unknown',
            CAT_COMPLETE,
            'Unbekannte / nicht genommene Lieder',
            'Jede Liednummer im PDF muss zu einem „genommenen" Lied gehören.',
            unknown,
            {
                okSummary: 'Alle Lieder im PDF sind bekannt und genommen',
                problemSummary: (i) => `${i.length} Lieder im PDF ohne passendes genommenes Lied`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'duplicates',
            CAT_COMPLETE,
            'Doppelte / überzählige Liednummern',
            'Eine Liednummer darf nur so oft im PDF vorkommen, wie es genommene Fassungen (inkl. Übersetzungen) in der Datenbank gibt.',
            duplicates,
            {
                okSummary: 'Keine überzähligen Liednummern',
                problemSummary: (i) => `${i.length} überzählige(s) Vorkommen`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'order',
            CAT_COMPLETE,
            'Reihenfolge',
            'Die Liednummern müssen im PDF aufsteigend sortiert sein.',
            order,
            {
                okSummary: 'Liednummern sind aufsteigend sortiert',
                problemSummary: (i) => `${i.length} Reihenfolge-Sprung/Sprünge`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'choral',
            CAT_COMPLETE,
            'Choralbuchnummer',
            'Die kleinere Nummer unter der Liednummer (Choralbuchnummer) muss zur Melodie in der Datenbank passen.',
            choral,
            {
                okSummary: 'Alle geprüften Choralbuchnummern stimmen überein',
                problemSummary: (i) => `${i.length} abweichende Choralbuchnummer(n)`,
            },
        ),
    );

    checks.push(
        makeCheck(
            'verse-text',
            CAT_VERSE,
            'Strophentext',
            'Der Text der Strophen 2..n im PDF muss exakt dem der Datenbank entsprechen (Strophe 1 steht im Notensatz und wird nicht geprüft).',
            verseText,
            {
                okSummary: 'Alle geprüften Strophentexte stimmen überein',
                problemSummary: (i) => `${i.length} abweichende Strophe(n)`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'verse-count',
            CAT_VERSE,
            'Strophen-Vollständigkeit',
            'Anzahl und Nummerierung der Textstrophen müssen zur Datenbank passen (keine fehlenden, doppelten oder überzähligen Strophen). Jede Textstrophe muss ihre hängende Nummer tragen, und die Nummern müssen im Satz aufsteigend und lückenlos stehen (2 → 3 → 4 …).',
            verseCount,
            {
                okSummary: 'Strophen-Anzahl und -Nummerierung stimmen',
                problemSummary: (i) => `${i.length} Auffälligkeit(en) bei den Strophen`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'verse-spacing',
            CAT_VERSE,
            'Strophen-Abstand',
            'Zwischen den Textstrophen muss ein fester Absatzabstand von genau 9 pt stehen (zusätzlich zum normalen Zeilenabstand). Gemessen wird der Grundlinien-Abstand über den Strophenumbruch abzüglich des Durchschusses des Liedes – nur zwischen zwei nummerierten Strophen auf derselben Seite messbar.',
            verseSpacing,
            {
                okSummary: 'Alle geprüften Strophenabstände betragen 9 pt',
                problemSummary: (i) => `${i.length} abweichende(r) Strophenabstand/-abstände`,
            },
        ),
    );

    checks.push(
        makeCheck(
            'footer',
            CAT_FOOTER,
            'Fußzeile / Autorenangabe',
            'Autoren, Copyright und Jahreszahlen der Fußzeile werden mit der berechneten Fußzeile (buildFooter) verglichen – unabhängig von der Jahres-Schreibweise (*1650 +1680 vs. 1650–1680).',
            footer,
            {
                okSummary: 'Alle geprüften Fußzeilen stimmen überein',
                problemSummary: (i) => `${i.length} abweichende Fußzeile(n)`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'copyright-scope',
            CAT_FOOTER,
            'Copyright-Zuordnung (nur Melodie)',
            'Ist im Redaktionssystem ein Copyright nur für die Melodie hinterlegt (nicht für den Text und nicht für das ganze Lied), muss im Druck erkennbar bleiben, dass es zur Melodie gehört: entweder direkt hinter der „Melodie: …"-Zeile oder in einer eingerückten Zeile darunter. Steht die „© …"-Angabe dagegen bündig am linken Rand in einer eigenen Zeile, sieht sie aus wie ein Copyright für das ganze Lied – dann ist die Zuordnung nicht mehr eindeutig (Issue #78).',
            copyrightScope,
            {
                okSummary: 'Melodie-Copyrights sind eindeutig der Melodie zugeordnet',
                problemSummary: (i) =>
                    `${i.length} Lied(er) mit mehrdeutig gesetztem Melodie-Copyright`,
            },
        ),
    );

    checks.push(
        makeCheck(
            'song-number',
            CAT_COMPLETE,
            'Liednummer im Druck',
            'Jedes Lied muss seine Liednummer im Kopfsteg tragen. Erkannt wird ein Lied am Notensatz – fehlt dort die Nummer, ist das ein Satzfehler (und die Seite würde sonst dem Lied davor zugeschlagen).',
            songNumber,
            {
                okSummary: 'Alle Lieder haben eine Liednummer',
                problemSummary: (i) => `${i.length} Lied(er) ohne Liednummer`,
            },
        ),
    );

    // Text außerhalb der Seite. Meist harmlos (der platzierte Notensatz ist
    // breiter als sein Rahmen und bringt seine eigenen Strophenzähler mit), aber
    // eine aus dem Rahmen gelaufene Strophe sähe genauso aus – und die stünde
    // dann nicht im gedruckten Buch. Deshalb sichtbar melden statt still
    // verwerfen. Zuordnung zum Lied der Seite, damit der Befund in dessen Gruppe
    // landet.
    checks.push(
        makeCheck(
            'clipped',
            CAT_COMPLETE,
            'Text außerhalb des Druckbereichs',
            'Text, der im PDF außerhalb der Seite liegt und deshalb nicht gedruckt wird (er wird auch nicht gegen die DB geprüft). Meist sind es die Strophenzähler des platzierten Notensatzes; es kann aber auch Text sein, der aus seinem Rahmen gelaufen und damit aus dem Druck gefallen ist.',
            clipped.map((c) => {
                const ps = pdfSongs.find((s) => s.pages.includes(c.page));
                const rec = ps ? recognized.find((r) => r.nummer === ps.nummer) : null;
                return {
                    sev: 'warning',
                    id: rec?.id ?? null,
                    nummer: ps?.nummer,
                    title: rec?.title || (ps ? `Lied ${ps.nummer}` : `Seite ${c.page}`),
                    detail: `Seite ${c.page}: ${c.texts.map((t) => `„${trunc(t, 40)}"`).join(' ')} liegt außerhalb der Seite und wird nicht gedruckt`,
                    loc: c.box,
                };
            }),
            {
                okSummary: 'Kein Text außerhalb des Druckbereichs',
                problemSummary: (i) => `${i.length} Seite(n) mit Text außerhalb des Druckbereichs`,
            },
        ),
    );

    if (allUnderNotes.length) {
        checks.push(
            makeCheck(
                'all-under-notes',
                CAT_INFO,
                'Lieder ohne Textstrophen',
                'Bei diesen Liedern stehen alle Strophen im Notensatz – es gibt keinen Strophen-Textblock, der geprüft werden könnte.',
                allUnderNotes,
                { forceStatus: 'info', okSummary: '' },
            ),
        );
    }
    if (anmerkung.length) {
        checks.push(
            makeCheck(
                'anmerkung',
                CAT_INFO,
                'Anmerkungs-Zeilen (nicht geprüft)',
                'Zeilen wie „Anmerkung:" / „Quelle:" erzeugt der Export nicht automatisch und können daher nicht gegen die DB geprüft werden – bitte manuell prüfen.',
                anmerkung.map((a) => ({ ...a, detail: a.detail })),
                { forceStatus: 'info', okSummary: '' },
            ),
        );
    }

    assignItemFingerprints(checks);

    return checks;
}

// Jedem Befund-Item einen stabilen Fingerprint geben (für „Bestätigt"). Auch von
// printNotenCheck.js genutzt, dessen Checks später dazukommen.
export function assignItemFingerprints(checks) {
    for (const c of checks) {
        for (const it of c.items) it.fp = itemFingerprint(c.id, it);
    }
    return checks;
}

// Ordnet PDF-Vorkommen einer Nummer den DB-Fassungen zu – die ähnlichsten Paare
// zuerst (greedy). Übrige PDF-Vorkommen (mehr als DB-Fassungen) sind „extra".
function assignVersions(occs, dbCands) {
    if (occs.length === 1 && dbCands.length === 1) {
        return { pairs: [{ ps: occs[0], lied: dbCands[0] }], extraPdf: [] };
    }
    const scored = [];
    for (const ps of occs) {
        for (const lied of dbCands) scored.push({ ps, lied, score: versionScore(ps, lied) });
    }
    scored.sort((a, b) => b.score - a.score);
    const usedPs = new Set();
    const usedDb = new Set();
    const pairs = [];
    for (const s of scored) {
        if (usedPs.has(s.ps) || usedDb.has(s.lied)) continue;
        usedPs.add(s.ps);
        usedDb.add(s.lied);
        pairs.push({ ps: s.ps, lied: s.lied });
    }
    return { pairs, extraPdf: occs.filter((ps) => !usedPs.has(ps)) };
}

// Ähnlichkeit eines PDF-Vorkommens zu einer DB-Fassung – primär über die
// Strophentexte, ersatzweise über die Fußzeile.
function versionScore(ps, lied) {
    // Auch Strophen ohne gedruckte Nummer zählen mit – sonst stünde ein Lied,
    // dessen Strophennummer im Satz fehlt, hier ohne Vergleichstext da.
    const pdfV = canon(ps.verses.map((v) => v.text).join(' '));
    const strophen = lied.text?.strophenEinzeln || [];
    const dbV = canon(
        strophen
            .slice(1)
            .map((s) => dbVerseText(s))
            .join(' '),
    );
    if (pdfV && dbV) return similarity(pdfV, dbV);
    const fp = footerSignature(ps.footerText);
    const fe = footerSignature(buildFooter(lied));
    if (fp && fe) return similarity(fp, fe);
    return 0.5;
}

function compareChoral(ps, lied, { choral }) {
    const dbChoral = lied.melodie?.choralbuchNummer;
    const pdfChoral = ps.choralnummer;
    const dbHas = dbChoral != null && String(dbChoral).trim() !== '';
    const pdfHas = pdfChoral != null && String(pdfChoral).trim() !== '';
    if (!dbHas && !pdfHas) return;

    const base = {
        id: lied.id,
        nummer: ps.nummer,
        title: lied.titel || `Lied ${ps.nummer}`,
        loc: ps.choralBox || ps.numberBox,
    };
    if (dbHas && pdfHas) {
        if (numKey(pdfChoral) === numKey(dbChoral)) return;
        choral.push({
            ...base,
            sev: 'error',
            detail: `Choralbuchnummer PDF ${pdfChoral} ≠ DB ${dbChoral}`,
        });
    } else if (pdfHas) {
        choral.push({
            ...base,
            sev: 'warning',
            detail: `PDF hat Choralbuchnummer ${pdfChoral}, DB hat keine`,
        });
    } else {
        choral.push({
            ...base,
            sev: 'warning',
            detail: `DB-Choralbuchnummer ${dbChoral} fehlt im PDF`,
        });
    }
}

// Einen Textblock ohne gedruckte Strophennummern den erwarteten DB-Strophen
// zuordnen. Ohne Nummern fehlt die Trennung zwischen den Strophen – der Block
// kann also mehrere Strophen am Stück enthalten (Lied 56). Deshalb wird er der
// Reihe nach an den erwarteten DB-Strophen „abgeschnitten": passt der Anfang zur
// nächsten erwarteten Strophe, wird er als diese Strophe übernommen und der Rest
// weiter zerlegt.
//
// Ergebnis: [{ num, text, … }] oder null, wenn schon die erste Strophe nicht
// passt (dann ist der Block nichts Zuordenbares und wird als solcher gemeldet).
// Die Strophen bekommen `numInferred`, werden danach aber ganz normal gegen die
// DB geprüft – eine fehlende Nummer soll keinen Textfehler verdecken.
// Die DB-Strophe, der ein Textblock am ehesten entspricht (oder null).
function bestVerseMatch(text, strophen) {
    const a = canon(text);
    let best = null;
    for (let i = 0; i < strophen.length; i++) {
        const sim = similarity(a, canon(dbVerseText(strophen[i])));
        if (!best || sim > best.sim) best = { num: i + 1, sim };
    }
    return best && best.sim >= 0.6 ? best : null;
}

function alignStrophen(verse, expectedNums, strophen) {
    // Geschnitten wird an den Zeilen des Blocks, nicht am Fließtext: Nur so
    // bekommt jede Teil-Strophe ihre eigenen Zeilen und damit ihren eigenen
    // Kasten im PDF. (Bei Lied 56 stehen die beiden Strophen sogar auf
    // verschiedenen Seiten – ein gemeinsamer Kasten zeigte auf die falsche.)
    const lines = verse.lines || [];
    const texts = verse.textLines || [];
    if (!lines.length || lines.length !== texts.length) return null;

    const parts = [];
    let i = 0;
    for (const num of expectedNums) {
        if (i >= lines.length) break;
        const db = canon(dbVerseText(strophen[num - 1]));
        if (!db) break;
        // Zeilen aufnehmen, solange sie die Länge der DB-Strophe besser treffen.
        const taken = [];
        const takenTexts = [];
        let text = '';
        while (i < lines.length) {
            const grown = joinDehyphen([...takenTexts, texts[i]]);
            const better =
                !taken.length ||
                Math.abs(canon(grown).length - db.length) <=
                    Math.abs(canon(text).length - db.length);
            if (!better) break;
            taken.push(lines[i]);
            takenTexts.push(texts[i]);
            text = grown;
            i++;
        }
        if (similarity(canon(text), db) < 0.6) break;
        parts.push({
            num,
            text,
            lines: taken,
            textLines: takenTexts,
            box: boxOfLines(taken) || verse.box,
            numInferred: true,
        });
    }
    if (!parts.length) return null;

    // Übrige Zeilen gehören zur letzten Strophe – eine Abweichung fällt dann im
    // Textvergleich auf, statt hier stillschweigend zu verschwinden.
    if (i < lines.length) {
        const last = parts[parts.length - 1];
        last.lines = [...last.lines, ...lines.slice(i)];
        last.textLines = [...last.textLines, ...texts.slice(i)];
        last.text = joinDehyphen(last.textLines);
        last.box = boxOfLines(last.lines) || last.box;
    }
    return parts;
}

function compareVerses(ps, lied, { verseText, verseCount, allUnderNotes }) {
    const strophen = lied.text?.strophenEinzeln || [];
    const N = strophen.length; // inkl. Strophe 1 (im Notensatz)
    const title = lied.titel || `Lied ${ps.nummer}`;
    const vc = (sev, detail, loc) =>
        verseCount.push({
            sev,
            id: lied.id,
            nummer: ps.nummer,
            title,
            detail,
            loc: loc || ps.numberBox,
        });

    // Strophen mit gedruckter Nummer …
    const printed = ps.verses.filter((v) => v.num != null);

    // … die vorher noch auf eine falsche Nummer geprüft werden. Trägt eine
    // Strophe im Satz die falsche Nummer (Lied 24 druckt „1." über den Text von
    // Strophe 2), ist das EIN Satzfehler – ohne diese Korrektur zerfällt er in
    // drei Folgebefunde: der Text wird gegen die falsche DB-Strophe verglichen,
    // die echte Nummer fehlt scheinbar („Lücke in der Nummerierung") und eine
    // Strophe 1 steht scheinbar im Textblock. Maßgeblich ist der Text: Passt er
    // eindeutig besser zu einer anderen DB-Strophe, ist die Nummer falsch.
    for (const v of printed) {
        const own =
            v.num >= 1 && v.num <= N
                ? similarity(canon(v.text), canon(dbVerseText(strophen[v.num - 1])))
                : 0;
        const hit = bestVerseMatch(v.text, strophen);
        if (!hit || hit.num === v.num || hit.sim <= own + 0.15) continue;
        // Nicht auf eine Nummer umbiegen, die eine andere Strophe zu Recht trägt.
        const taken = printed.some(
            (w) =>
                w !== v &&
                w.num === hit.num &&
                similarity(canon(w.text), canon(dbVerseText(strophen[hit.num - 1]))) >= 0.8,
        );
        if (taken) continue;
        vc(
            'error',
            `Strophe ${hit.num} ist im Satz als „${v.num}." nummeriert${v.num === 1 ? ' (Strophe 1 steht im Notensatz)' : ''}`,
            v.box,
        );
        v.num = hit.num;
        v.numFixed = true;
    }

    // Die Nummern, die vor der ersten gedruckten stehen müssten (Strophe 1 steht
    // im Notensatz). Genau diese Strophen kann ein Textblock ohne Nummer enthalten.
    const firstPrinted = printed.length ? Math.min(...printed.map((v) => v.num)) : N + 1;
    const expectedNums = [];
    for (let k = 2; k < firstPrinted && k <= N; k++) expectedNums.push(k);

    // Eine Textstrophe ohne Nummer ist ein Satzfehler (jede Strophe im Textblock
    // muss ihre Nummer tragen). Lässt sie sich einer DB-Strophe zuordnen, wird
    // sie danach trotzdem ganz normal mitgeprüft.
    const verses = [];
    for (const v of ps.verses) {
        if (v.num != null) {
            // Fehlt einer FOLGE-Strophe die Nummer, klebt ihr Text hinten an der
            // Strophe davor (Lied 92: Strophe 4 hängt an der gedruckten „3."),
            // denn splitVerses kann sie nicht von einer über die Seite laufenden
            // Fortsetzung unterscheiden (Lied 29). Die DB kann es: Passt nur der
            // Anfang zur eigenen Strophe und der Rest zur nächsten, sind es zwei
            // – die zweite ohne Nummer. Ein Befund statt dreien (Textfehler +
            // fehlende Strophe + Lücke).
            const tail = [];
            for (let k = v.num; k <= N; k++) tail.push(k);
            const split = tail.length > 1 ? alignStrophen(v, tail, strophen) : null;
            if (split && split.length > 1) {
                split[0].numInferred = false; // deren Nummer steht ja im Satz
                verses.push(split[0]);
                for (const part of split.slice(1)) {
                    vc(
                        'error',
                        `Strophennummer „${part.num}." fehlt im Satz vor „${trunc(part.text, 50)}" – Strophe ist unnummeriert gedruckt`,
                        part.box,
                    );
                    verses.push(part);
                }
                continue;
            }
            verses.push(v);
            continue;
        }
        const parts = expectedNums.length ? alignStrophen(v, expectedNums, strophen) : null;
        if (!parts) {
            // Nicht an der erwarteten Stelle zuzuordnen. Der Text verrät aber
            // meist trotzdem, um welche Strophe es geht – das ist der Hinweis,
            // den der Satz braucht (z. B. Strophe 2 ohne Nummer, während die
            // folgende Strophe fälschlich die 2 trägt).
            const hit = bestVerseMatch(v.text, strophen);
            let hint = '– keiner DB-Strophe zuzuordnen';
            if (hit && hit.num === 1) {
                hint =
                    '– entspricht DB-Strophe 1; die gehört in den Notensatz, nicht in den Textblock';
            } else if (hit) {
                hint = `– entspricht DB-Strophe ${hit.num}; Nummerierung im Satz prüfen`;
            }
            vc('error', `Textblock ohne Strophennummer: „${trunc(v.text, 60)}" ${hint}`, v.box);
            verses.push(v);
            continue;
        }
        for (const part of parts) {
            vc(
                'error',
                `Strophennummer „${part.num}." fehlt im Satz vor „${trunc(part.text, 50)}" – Strophe ist unnummeriert gedruckt`,
                part.box,
            );
            verses.push(part);
        }
    }
    ps.verses = verses;

    // Reihenfolge = Reihenfolge im Satz (inkl. der erschlossenen Nummern).
    const numbered = verses.filter((v) => v.num != null);
    // Kasten-Anker: die Box der genannten Strophe, sonst die Liednummer.
    const boxFor = (num) => numbered.find((v) => v.num === num)?.box || ps.numberBox;

    if (!numbered.length) {
        if (verses.length) return; // nicht zuordenbarer Textblock – schon gemeldet
        if (N > 2) {
            vc(
                'warning',
                `DB hat ${N} Strophen, aber im PDF keine Textstrophe gefunden – bitte prüfen`,
            );
        } else {
            allUnderNotes.push({
                id: lied.id,
                nummer: ps.nummer,
                title,
                detail: `${N || '—'} Strophe(n) – alle im Notensatz`,
                loc: ps.numberBox,
            });
        }
        return;
    }

    const markers = numbered.map((v) => v.num);
    const minM = Math.min(...markers);
    const maxM = Math.max(...markers);

    // Die Nummern müssen im Satz aufsteigend stehen (2 → 3 → 4 …), jede genau
    // einmal und ohne Lücke dazwischen.
    for (let i = 1; i < markers.length; i++) {
        if (markers[i] < markers[i - 1]) {
            vc(
                'error',
                `Strophen nicht aufsteigend nummeriert: Strophe ${markers[i]} steht im Satz nach Strophe ${markers[i - 1]}`,
                boxFor(markers[i]),
            );
        }
    }
    const seen = new Map();
    for (const m of markers) seen.set(m, (seen.get(m) || 0) + 1);
    for (const [num, count] of seen) {
        if (count > 1)
            vc(
                'error',
                `Strophe ${num} kommt ${count}× vor (doppelte Strophennummer)`,
                boxFor(num),
            );
    }
    for (let v = minM; v <= maxM; v++) {
        if (!seen.has(v)) {
            vc(
                'error',
                `Strophe ${v} fehlt (Lücke in der Nummerierung ${minM}…${maxM})`,
                boxFor(v - 1),
            );
        }
    }
    if (maxM < N) {
        vc(
            'error',
            `Strophe${maxM + 1 === N ? '' : 'n'} ${maxM + 1}${maxM + 1 === N ? '' : '–' + N} fehlt im PDF (DB hat ${N} Strophen)`,
            boxFor(maxM),
        );
    }
    if (maxM > N) vc('error', `PDF zeigt Strophe ${maxM}, DB hat nur ${N} Strophen`, boxFor(maxM));
    if (minM === 1) {
        vc('warning', 'Strophe 1 erscheint als Textblock (sollte im Notensatz stehen)', boxFor(1));
    } else if (minM > 3) {
        vc(
            'warning',
            `Text erst ab Strophe ${minM} – ungewöhnlich viele Strophen im Notensatz?`,
            boxFor(minM),
        );
    }

    // Text-Vergleich je Strophe.
    for (const v of numbered) {
        if (v.num < 1 || v.num > N) continue; // Bereich schon oben gemeldet
        const dbText = dbVerseText(strophen[v.num - 1]);
        const a = canon(v.text);
        const b = canon(dbText);
        if (a === b) continue;
        // Jede Abweichung ist ein Fehler. Gewollte Abweichungen kann der Nutzer
        // im PDF-Abgleich abhaken (lokal gespeichert), statt sie automatisch als
        // „geringfügig" zu entschärfen.
        verseText.push({
            sev: 'error',
            id: lied.id,
            nummer: ps.nummer,
            title: `Lied ${ps.nummer} · Strophe ${v.num}`,
            detail: `PDF: „${trunc(v.text)}" | DB: „${trunc(dbText)}"`,
            pdf: v.text,
            expected: dbText,
            loc: v.box || ps.numberBox,
        });
    }
}

// --- Strophen-Abstand (Layout) ---------------------------------------------
//
// Der Satz setzt zwischen die Textstrophen einen festen Absatzabstand (im
// InDesign-Absatzformat „Abstand davor/danach"). Sollwert: genau 9 pt. Gemessen
// wird der ZUSÄTZLICHE Abstand zwischen dem Ende einer Strophe und dem Beginn der
// nächsten – also der Grundlinien-Abstand über den Strophenumbruch abzüglich des
// normalen Zeilenabstands (Durchschuss) des Liedes. Dadurch ist die Prüfung
// unabhängig von der Schriftgröße.
//
// Grenzen: messbar nur zwischen zwei nummerierten Textstrophen auf DERSELBEN
// Seite (über einen Seitenumbruch hinweg gibt es keinen Abstand zu messen). Den
// Durchschuss erschließt die Funktion aus den Zeilenabständen innerhalb der
// Strophen (Median); fehlt er (lauter einzeilige Strophen), lässt sich der
// Absatzabstand nicht bestimmen und die Prüfung entfällt still. Aus einem
// zusammenhängenden Textblock „herausgelöste" Folgestrophen (Nummer fehlt im
// Satz, `numInferred`) werden übersprungen – zwischen ihnen steht gerade KEIN
// echter Absatzumbruch, und der Satzfehler ist bereits über die Strophen-
// Vollständigkeit gemeldet.

const VERSE_SPACING_PT = 9; // Sollwert des Absatzabstands
const VERSE_SPACING_TOL = 0.1; // erlaubte Abweichung (PDF-Extraktions-Rauschen)

// Grundlinien-Abstände innerhalb der Strophen – Stichprobe für den Durchschuss.
function intraLineGaps(verses) {
    const gaps = [];
    for (const v of verses) {
        const ls = v.lines || [];
        for (let i = 1; i < ls.length; i++) {
            if (ls[i].page === ls[i - 1].page) {
                const d = ls[i].yTop - ls[i - 1].yTop;
                if (d > 0) gaps.push(d);
            }
        }
    }
    return gaps;
}

// Kasten über den Zwischenraum zweier Strophen (für das PDF-Overlay). Bewusst der
// Zwischenraum SELBST: von der Unterkante der letzten Zeile von a (Grundlinie +
// Unterlänge) bis zur Oberkante der ersten Zeile von b (Grundlinie − Oberlänge) –
// NICHT Grundlinie→Grundlinie, sonst läge die erste Zeile von b mit im Kasten und
// es sähe aus wie „Unterkante a → Unterkante b". Breite = über beide Strophen, als
// Grundlinie für die Grenzlinien im Overlay.
function spacingBox(a, b, page) {
    const aLast = a.lines[a.lines.length - 1];
    const bFirst = b.lines[0];
    const items = [...a.lines, ...b.lines].filter((l) => l.page === page).flatMap((l) => l.items);
    const rect = bboxOfItems(items);
    const gapTop = aLast.yTop + aLast.size * 0.3;
    const gapBottom = bFirst.yTop - bFirst.size * 0.9;
    return {
        page,
        rect: {
            x: rect ? rect.x : 40,
            y: gapTop,
            w: rect ? rect.w : 200,
            h: Math.max(gapBottom - gapTop, 3),
        },
    };
}

const fmtPt = (n) => n.toFixed(1).replace('.', ',');

// Absatzabstand aller nummerierten Textstrophen eines Liedes prüfen (Soll 9 pt).
function checkVerseSpacing(ps, lied, { verseSpacing }) {
    // Textstrophen in Satz-Reihenfolge (von oben nach unten, seitenweise).
    const verses = (ps.verses || [])
        .filter((v) => v.lines && v.lines.length)
        .map((v) => ({ v, page: v.lines[0].page, y: v.lines[0].yTop }))
        .sort((A, B) => A.page - B.page || A.y - B.y)
        .map((x) => x.v);
    if (verses.length < 2) return;

    const leadingGaps = intraLineGaps(verses);
    if (!leadingGaps.length) return; // Durchschuss nicht bestimmbar → still übergehen
    const leading = median(leadingGaps);

    for (let i = 1; i < verses.length; i++) {
        const a = verses[i - 1];
        const b = verses[i];
        // Nur echte Absatzumbrüche zwischen zwei nummerierten Strophen; aus einem
        // Block herausgelöste (unnummerierte) Folgestrophen überspringen.
        if (a.num == null || b.num == null || b.numInferred) continue;
        const aLast = a.lines[a.lines.length - 1];
        const bFirst = b.lines[0];
        if (aLast.page !== bFirst.page) continue; // Seitenumbruch – nicht messbar
        const baselineGap = bFirst.yTop - aLast.yTop;
        if (baselineGap <= 0) continue;
        const spacing = baselineGap - leading;
        if (Math.abs(spacing - VERSE_SPACING_PT) <= VERSE_SPACING_TOL) continue;
        verseSpacing.push({
            sev: 'warning',
            id: lied.id,
            nummer: ps.nummer,
            title: `Lied ${ps.nummer} · Strophen ${a.num}–${b.num}`,
            detail: `Absatzabstand Strophe ${a.num}→${b.num}: ${fmtPt(spacing)} pt statt ${VERSE_SPACING_PT} pt`,
            // `dim` markiert den Befund fürs Overlay als Maß-Annotation (Doppelpfeil
            // statt Kasten); `pt` ist der gemessene Absatzabstand.
            dim: { pt: spacing },
            loc: spacingBox(a, b, aLast.page),
        });
    }
}

// Issue #78: Gilt laut Redaktionssystem NUR die Melodie ein Copyright (kein Text-
// und kein Lied-Copyright), muss im Druck erkennbar bleiben, dass sich das „© …"
// auf die Melodie-Zeile bezieht und nicht auf das ganze Lied. Zwei Schreibweisen
// sind dafür zulässig:
//   1. inline direkt hinter der „Melodie: …"-Zeile, oder
//   2. in einer eigenen Zeile darunter, die gegenüber dem linken Rand der
//      Fußzeile EINGERÜCKT ist (Fortsetzungszeile, siehe Bild in Issue #78).
// Nur wenn das „©" bündig am linken Rand in einer eigenen Zeile steht, sieht es
// aus wie ein Copyright für das ganze Lied – dann Hinweis.
//
// Warum eine allein stehende „©"-Zeile hier eindeutig das umbrochene Melodie-
// Copyright ist: buildFooter setzt das Melodie-Copyright inline an die Melodie-
// Zeile; allein stellt es nur das Lied-Copyright (lied.copyright) – und das ist
// bei „nur Melodie" per Voraussetzung leer. Eine „©"-Zeile für sich kann also
// nur die umgebrochene Melodie-Rechteangabe sein.

// Ab wie viel Vorsprung zum linken Fußzeilenrand eine Zeile als eingerückt gilt.
// Der Satz rückt die Fortsetzungszeile deutlich ein (Beispiel Nr. 220: ~26 pt);
// kleine Werte entstehen dagegen aus Extraktions-Rauschen (< 1 pt).
const FOOTER_INDENT_MIN_PT = 4;

export function compareCopyrightScope(ps, lied, { copyrightScope }) {
    const trimmed = (v) => (v == null ? '' : String(v).trim());
    const melodyCr = trimmed(lied?.melodie?.copyright);
    const textCr = trimmed(lied?.text?.copyright);
    const liedCr = trimmed(lied?.copyright);
    // Nur relevant, wenn ausschließlich die Melodie ein Copyright hat.
    if (!melodyCr || textCr || liedCr) return;

    const lines = ps.footerLines || [];
    // Trägt die Melodie-Zeile das „©" bereits inline (auch „Melodie und Rechte:" /
    // „Melodie und Satz:" / „Text und Melodie:"), ist die Zuordnung eindeutig.
    const melodyLine = lines.find((l) =>
        /^\s*(text und melodie|melodie und satz|melodie und rechte|melodie)\s*:/i.test(l),
    );
    if (melodyLine && /©/.test(melodyLine)) return;

    // Steht das „©" in einer eigenen Zeile: nur bündig am linken Rand mehrdeutig.
    const crIdx = lines.findIndex((l) => FOOTER_COPYRIGHT.test(l));
    if (crIdx === -1) return;
    const xs = ps.footerLineX || [];
    const left = Math.min(...xs.filter((x) => Number.isFinite(x)));
    const crX = xs[crIdx];
    if (Number.isFinite(crX) && Number.isFinite(left) && crX - left >= FOOTER_INDENT_MIN_PT) {
        return; // eingerückte Fortsetzungszeile → Zuordnung bleibt erkennbar
    }

    copyrightScope.push({
        sev: 'warning',
        id: lied.id,
        nummer: ps.nummer,
        title: lied.titel || `Lied ${ps.nummer}`,
        detail: 'Copyright gilt laut Redaktionssystem nur für die Melodie, steht im Druck aber bündig in einer eigenen Zeile unter „Melodie: …" – dadurch wirkt es wie ein Copyright für das ganze Lied. Bitte direkt hinter die Melodie-Zeile setzen oder die Zeile einrücken.',
        loc: ps.footerBox || ps.numberBox,
    });
}

function compareFooter(ps, lied, { footer }) {
    const expected = buildFooter(lied);
    const pdfFooter = ps.footerText;
    const eSig = footerSignature(expected);
    const pSig = footerSignature(pdfFooter);

    if (footerSignaturesMatch(expected, pdfFooter)) return;
    if (!eSig && !pSig) return;

    // Beide Seiten vorhanden und abweichend → Fehler. Fehlt eine Seite ganz
    // (keine Autordaten), bleibt es eine Warnung (nichts zu vergleichen).
    const sev = eSig && pSig ? 'error' : 'warning';
    const flat = (s) => s.replace(/\s*\n\s*/g, ' ').trim();

    footer.push({
        sev,
        id: lied.id,
        nummer: ps.nummer,
        title: lied.titel || `Lied ${ps.nummer}`,
        detail: `PDF: „${flat(pdfFooter) || '(leer)'}" | Erwartet: „${flat(expected) || '(leer – keine Autordaten in DB)'}"`,
        pdf: pdfFooter,
        expected,
        loc: ps.footerBox || ps.numberBox,
    });
}
