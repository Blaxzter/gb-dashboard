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
    if (!m) return String(v ?? '').trim().toLowerCase();
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

// Signatur einer Fußzeile für den Vergleich: nur Buchstaben+Ziffern, ohne
// Label-Wörter, ohne Jahres-Dekoration (* + – ( )). Dadurch ist der Vergleich
// unabhängig davon, dass der Druck „(*1650 +1680)" statt „(1650–1680)" setzt und
// ob „Text und Melodie" zusammengefasst oder getrennt gedruckt wird.
export function footerSignature(footerText, { dropUnverifiable = true } = {}) {
    const lines = String(footerText || '').split('\n');
    const kept = dropUnverifiable
        ? lines.filter((l) => !FOOTER_UNVERIFIABLE.test(l))
        : lines;
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
async function extractPageItems(page) {
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = [];
    for (const it of content.items) {
        if (typeof it.str !== 'string' || isNoise(it.str)) continue;
        const t = it.transform;
        const size = Math.abs(t[3]) || it.height || 0;
        items.push({
            str: it.str,
            x: t[4],
            yTop: viewport.height - t[5], // von oben, damit Lesereihenfolge = aufsteigend
            width: it.width || 0,
            size,
        });
    }
    return { items, width: viewport.width, height: viewport.height };
}

// Erkennt die beiden Zahlen am oberen Außenrand einer Liedseite:
//   * die große obere Zahl  = gb2026-Liednummer
//   * die kleinere darunter = Choralbuchnummer (optional)
// Beide stehen in derselben (linken oder rechten) Randspalte im oberen Seiten-
// viertel; der Musiksatz darunter ist bereits als Rauschen herausgefiltert.
function detectNumbers(items, pageHeight) {
    const top = items.filter(
        (i) => i.yTop < pageHeight * 0.25 && /^\d{1,3}[a-zA-Z]?$/.test(i.str.trim()),
    );
    if (!top.length) return { numberItem: null, choralItem: null };
    const sorted = [...top].sort((a, b) => b.size - a.size || a.yTop - b.yTop);
    const numberItem = sorted[0];
    const rest = sorted.slice(1);
    const choralItem =
        rest.find((i) => Math.abs(i.x - numberItem.x) < 40 && i.yTop >= numberItem.yTop - 2) ||
        rest[0] ||
        null;
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
    }
    return lines.filter((l) => l.text.trim() !== '');
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
// wenn zwei Strophen im Notensatz stehen).
function splitVerses(bodyLines) {
    const verses = [];
    let cur = null;
    for (const line of bodyLines) {
        const withText = line.text.match(/^\s*(\d{1,2})[.)]?\s+(\S.*)$/);
        const onlyNum = line.text.match(/^\s*(\d{1,2})[.)]?\s*$/);
        if (withText || onlyNum) {
            cur = { num: parseInt((withText || onlyNum)[1], 10), textLines: [], lines: [line] };
            verses.push(cur);
            if (withText && withText[2]) cur.textLines.push(withText[2]);
        } else if (cur) {
            cur.textLines.push(line.text);
            cur.lines.push(line);
        } else {
            // Text vor der ersten nummerierten Strophe (unerwartet).
            cur = { num: null, stray: true, textLines: [line.text], lines: [line] };
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
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
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

// Eine ganze PDF (PDFDocumentProxy von vue-pdf-embed/pdf.js) in Lieder zerlegen.
// Rückgabe: { songs, pageCount, blankPages, introPages, warnings }.
export async function extractPdfSongs(pdfDoc) {
    const pageCount = pdfDoc.numPages;
    const songs = [];
    const blankPages = [];
    const introPages = [];
    const pageSizes = {};
    let cur = null;

    for (let p = 1; p <= pageCount; p++) {
        const page = await pdfDoc.getPage(p);
        const { items, width, height } = await extractPageItems(page);
        pageSizes[p] = { width, height };

        if (!items.length) {
            blankPages.push(p);
            continue;
        }

        const sizeHint =
            median(items.filter((i) => /\p{L}/u.test(i.str)).map((i) => i.size)) ||
            median(items.map((i) => i.size));

        // Liednummer (groß) und Choralbuchnummer (kleiner, darunter).
        const { numberItem, choralItem } = detectNumbers(items, height);

        const remove = new Set([numberItem, choralItem].filter(Boolean));
        const bodyItems = remove.size ? items.filter((i) => !remove.has(i)) : items;
        const lines = groupLines(bodyItems, sizeHint);
        for (const l of lines) l.page = p;

        if (numberItem) {
            cur = {
                nummer: numberItem.str.trim(),
                choralnummer: choralItem ? choralItem.str.trim() : '',
                numberBox: { page: p, rect: bboxOfItems([numberItem]) },
                choralBox: choralItem ? { page: p, rect: bboxOfItems([choralItem]) } : null,
                pages: [p],
                lines: [...lines],
            };
            songs.push(cur);
        } else if (cur) {
            // Fortsetzungsseite eines mehrseitigen Liedes.
            cur.pages.push(p);
            cur.lines.push(...lines);
        } else {
            // Text vor dem ersten Lied → Vorspann/Deckblatt.
            introPages.push(p);
        }
    }

    // Pro Lied: Fußzeile abtrennen und Strophen zerlegen.
    for (const song of songs) {
        const footerStart = song.lines.findIndex(
            (l) => FOOTER_LABEL.test(l.text) || FOOTER_COPYRIGHT.test(l.text),
        );
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
        song.footerText = song.footerLines.join('\n');
        song.footerAnmerkung = song.footerLines.filter((l) => FOOTER_UNVERIFIABLE.test(l));
        song.footerBox = boxOfLines(footerLineObjs);
        delete song.lines;
    }

    return { songs, pageCount, blankPages, introPages, pageSizes, warnings: [] };
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
function makeCheck(id, category, title, description, items, { forceStatus, okSummary, problemSummary }) {
    const forced = forceStatus || null;
    const status = deriveStatus(items, forced);
    const summary =
        status === 'ok'
            ? okSummary
            : (problemSummary ? problemSummary(items) : `${items.length} Auffälligkeit(en)`);
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
            summary = c.problemSummary ? c.problemSummary(active) : `${active.length} Auffälligkeit(en)`;
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
    const { songs: pdfSongs, pageCount, blankPages, introPages } = extracted;

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
    const choral = [];
    const verseText = [];
    const verseCount = [];
    const footer = [];
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
    // kann mehrere DB-Fassungen haben (z. B. deutsch + Übersetzung).
    const pdfByNum = new Map();
    for (const ps of pdfSongs) {
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
            compareFooter(ps, lied, { footer });
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
            'Anzahl und Nummerierung der Textstrophen müssen zur Datenbank passen (keine fehlenden, doppelten oder überzähligen Strophen).',
            verseCount,
            {
                okSummary: 'Strophen-Anzahl und -Nummerierung stimmen',
                problemSummary: (i) => `${i.length} Auffälligkeit(en) bei den Strophen`,
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

    // Jedem Befund-Item einen stabilen Fingerprint geben (für „Bestätigt").
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
    const pdfV = canon(
        ps.verses
            .filter((v) => v.num != null)
            .map((v) => v.text)
            .join(' '),
    );
    const strophen = lied.text?.strophenEinzeln || [];
    const dbV = canon(strophen.slice(1).map((s) => dbVerseText(s)).join(' '));
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
        choral.push({ ...base, sev: 'error', detail: `Choralbuchnummer PDF ${pdfChoral} ≠ DB ${dbChoral}` });
    } else if (pdfHas) {
        choral.push({ ...base, sev: 'warning', detail: `PDF hat Choralbuchnummer ${pdfChoral}, DB hat keine` });
    } else {
        choral.push({ ...base, sev: 'warning', detail: `DB-Choralbuchnummer ${dbChoral} fehlt im PDF` });
    }
}

function compareVerses(ps, lied, { verseText, verseCount, allUnderNotes }) {
    const strophen = lied.text?.strophenEinzeln || [];
    const N = strophen.length; // inkl. Strophe 1 (im Notensatz)
    const numbered = ps.verses.filter((v) => v.num != null);
    const stray = ps.verses.filter((v) => v.num == null);
    const title = lied.titel || `Lied ${ps.nummer}`;
    // Kasten-Anker: die Box der genannten Strophe, sonst die Liednummer.
    const boxFor = (num) => numbered.find((v) => v.num === num)?.box || ps.numberBox;
    const vc = (sev, detail, loc) =>
        verseCount.push({ sev, id: lied.id, nummer: ps.nummer, title, detail, loc: loc || ps.numberBox });

    if (stray.length) {
        vc('warning', 'Text vor der ersten nummerierten Strophe (evtl. Strophe 1 als Text?)', stray[0].box);
    }

    if (!numbered.length) {
        if (N > 2) {
            vc('warning', `DB hat ${N} Strophen, aber im PDF keine Textstrophe gefunden – bitte prüfen`);
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

    for (let v = minM; v <= maxM; v++) {
        if (!markers.includes(v)) vc('error', `Strophe ${v} fehlt (Lücke in der Nummerierung)`);
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
        vc('warning', `Text erst ab Strophe ${minM} – ungewöhnlich viele Strophen im Notensatz?`, boxFor(minM));
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
