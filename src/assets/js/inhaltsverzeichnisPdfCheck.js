// Sicherheitsnetz-Prüfung der Inhaltsverzeichnis-PDF gegen die Datenbank.
//
// Neben dem Liederteil geht auch das alphabetische Inhaltsverzeichnis („ABC")
// als eigene PDF in den Druck. Es besteht nur aus zwei Angaben je Zeile:
//
//     NR   ABC
//      1   Abend wird es wieder
//      7   All unser Leben und Wandern
//      7   All Our Lives and Travels        ← fremdsprachige Fassung
//
// Geprüft wird deshalb genau das, was dort steht:
//   * die Schreibweise der Titel gegen den Titel in der Datenbank und
//   * die Reihenfolge/Vollständigkeit (jedes genommene Lied genau einmal,
//     Liednummern aufsteigend in der Lesereihenfolge).
//
// Die Nummern wurden in der alphabetischen Titel-Reihenfolge des Gesangbuchs
// vergeben (siehe Nummerngenerierung) – aufsteigende Nummern sind damit
// gleichbedeutend mit der korrekten ABC-Sortierung. Die deutschen Sonder-
// regeln der Sortierung müssen hier also nicht nachgebaut werden.
//
// Der Aufbau der Seite wird nicht fest verdrahtet, sondern aus dem Satz
// gelesen: Die Liednummern stehen rechtsbündig in ihrer Spalte, ihre rechte
// Kante ist damit über alle Seiten hinweg konstant. Aus den geclusterten
// rechten Kanten ergeben sich die Spalten (aktuell zwei je Seite).

import { resolveLiednummer2026, similarity } from '@/assets/js/utils';
import { isGenommen } from '@/assets/js/gesangbuchChecks';
import {
    assignItemFingerprints,
    bboxOfItems,
    canon,
    makeCheck,
    numInt,
    numKey,
} from '@/assets/js/printPdfCheck';

// Eine Liednummer im Inhaltsverzeichnis: reine Zahl, optional mit Buchstaben-
// Suffix (12a). Mehr steht in der Nummernspalte nicht.
const NUM_RE = /^\d{1,4}[a-zA-Z]?$/;

// Toleranz, mit der zwei rechte Kanten als „dieselbe Spalte" gelten (pt).
const COL_TOL = 3;
// Wie weit links der Nummernspalte eine Spalte beginnt. Die Nummern sind
// rechtsbündig; eine dreistellige Zahl ragt rund 17 pt nach links.
const COL_LEFT_PAD = 40;
// Mindestzahl an Nummern, ab der ein x-Cluster als Spalte gilt. Eine Liedseite
// des Liederteils trägt höchstens zwei Zahlen (Lied- und Choralbuchnummer) –
// so bleiben die beiden PDF-Sorten sicher auseinanderzuhalten.
const COL_MIN_NUMBERS = 5;

// --- Extraktion ------------------------------------------------------------

// Text-Items einer Seite mit Position (x, yTop von oben) und Schriftgrad.
async function pageItems(page) {
    const viewport = page.getViewport({ scale: 1 });
    const items = [];
    const content = await page.getTextContent();
    for (const it of content.items) {
        if (typeof it.str !== 'string' || !it.str.trim()) continue;
        const t = it.transform;
        items.push({
            str: it.str,
            x: t[4],
            yTop: viewport.height - t[5], // von oben: Lesereihenfolge = aufsteigend
            width: it.width || 0,
            size: Math.abs(t[3]) || it.height || 0,
            font: it.fontName || '',
        });
    }
    return { items, width: viewport.width, height: viewport.height };
}

// Spalten aus den rechten Kanten der reinen Zahl-Items ableiten (siehe Kopf).
// Rückgabe: nach x sortierte Spalten mit `right` (Kante der Nummernspalte),
// `left` (Beginn der Spalte) und `count` (gefundene Nummern).
export function detectColumns(pagesItems) {
    const edges = [];
    for (const items of pagesItems) {
        for (const it of items) {
            if (NUM_RE.test(it.str.trim())) edges.push(it.x + it.width);
        }
    }
    edges.sort((a, b) => a - b);

    const clusters = [];
    for (const e of edges) {
        const last = clusters[clusters.length - 1];
        if (last && e - last[last.length - 1] <= COL_TOL) last.push(e);
        else clusters.push([e]);
    }

    const cols = clusters
        .filter((c) => c.length >= COL_MIN_NUMBERS)
        .map((c) => ({ right: c[Math.floor(c.length / 2)], count: c.length }));

    return cols.map((c, i) => ({
        ...c,
        left: c.right - COL_LEFT_PAD,
        // Bis zum Beginn der nächsten Spalte; die letzte läuft bis zum Rand.
        end: i + 1 < cols.length ? cols[i + 1].right - COL_LEFT_PAD : Infinity,
    }));
}

// Items einer Spalte zu Zeilen gruppieren (nach yTop mit Toleranz).
function groupRows(items) {
    const sorted = [...items].sort((a, b) => a.yTop - b.yTop || a.x - b.x);
    const rows = [];
    for (const it of sorted) {
        const last = rows[rows.length - 1];
        const tol = Math.max(2.5, (it.size || 10) * 0.4);
        if (last && Math.abs(it.yTop - last.yTop) <= tol) last.items.push(it);
        else rows.push({ yTop: it.yTop, items: [it] });
    }
    for (const row of rows) row.items.sort((a, b) => a.x - b.x);
    return rows;
}

// Zeilentext aus den Items zusammensetzen; Leerzeichen nur bei echter x-Lücke.
function rowText(items) {
    let out = '';
    let prev = null;
    for (const it of items) {
        if (prev) {
            const gap = it.x - (prev.x + prev.width);
            if (gap > (prev.size || 10) * 0.15 && !/\s$/.test(out) && !/^\s/.test(it.str)) {
                out += ' ';
            }
        }
        out += it.str;
        prev = it;
    }
    return out.replace(/[ \t]+/g, ' ').trim();
}

// Umbrochene Titelzeilen zusammenfügen. `dehyphen` löst die Silbentrennung am
// Zeilenende auf („mei-" + „nem" -> „meinem"); ohne sie bleibt der Bindestrich
// stehen („Halleluja-" + „Lied" -> „Halleluja-Lied"). Beide Lesarten werden
// geführt, weil dem Satz nicht anzusehen ist, ob der Bindestrich am Zeilenende
// ein Trennstrich ist oder zum Titel gehört.
function joinRows(texts, { dehyphen }) {
    let out = '';
    for (let i = 0; i < texts.length; i++) {
        const seg = texts[i].trim();
        if (i === 0) {
            out = seg;
        } else if (/[-­]$/.test(out)) {
            out = (dehyphen ? out.replace(/[-­]$/, '') : out) + seg;
        } else {
            out = out + ' ' + seg;
        }
    }
    return out;
}

// Eine Inhaltsverzeichnis-PDF in Einträge zerlegen.
// Rückgabe: { entries, columns, skipped, pageCount, pageSizes }.
//
// Ein Eintrag beginnt mit einer Nummer in der Nummernspalte; eine Zeile ohne
// Nummer ist die Fortsetzung des zuletzt begonnenen Eintrags (umbrochener
// Titel). Zeilen vor dem ersten Eintrag (Deckblatt, Spaltenkopf „NR ABC")
// werden als `skipped` gemeldet, statt still zu verschwinden.
export async function extractIvzEntries(pdfDoc) {
    const pageCount = pdfDoc.numPages;
    const pageSizes = {};
    const perPage = [];
    for (let p = 1; p <= pageCount; p++) {
        const page = await pdfDoc.getPage(p);
        const { items, width, height } = await pageItems(page);
        pageSizes[p] = { width, height };
        perPage.push(items);
    }

    const columns = detectColumns(perPage);
    const entries = [];
    const skipped = [];
    let cur = null;

    for (let p = 1; p <= pageCount; p++) {
        // Was links der ersten Spalte steht, gehört zu keinem Eintrag (Kolumnen-
        // ziffer, Marginalie). Nicht still verwerfen: Es könnte auch eine aus
        // dem Rahmen gelaufene Zeile sein.
        const firstCol = columns[0];
        if (firstCol) {
            const outside = perPage[p - 1].filter((i) => i.x < firstCol.left);
            for (const row of groupRows(outside)) {
                skipped.push({ page: p, text: rowText(row.items) });
            }
        }
        // Lesereihenfolge: erst die linke Spalte ganz, dann die rechte.
        for (const col of columns) {
            const colItems = perPage[p - 1].filter((i) => i.x >= col.left && i.x < col.end);
            for (const row of groupRows(colItems)) {
                const first = row.items[0];
                // Steht das erste Item rechtsbündig in der Nummernspalte, ist es
                // die Liednummer – sonst beginnt die Zeile erst im Titelfeld.
                const inNumberSlot = Math.abs(first.x + first.width - col.right) <= COL_TOL;
                const isNumber = inNumberSlot && NUM_RE.test(first.str.trim());

                if (isNumber && row.items.length > 1) {
                    cur = {
                        nummer: first.str.trim(),
                        page: p,
                        numberBox: { page: p, rect: bboxOfItems([first]) },
                        rows: [{ page: p, text: rowText(row.items.slice(1)), items: row.items }],
                        titleItems: row.items.slice(1),
                    };
                    entries.push(cur);
                } else if (!isNumber && !inNumberSlot && cur) {
                    // Fortsetzungszeile eines umbrochenen Titels.
                    cur.rows.push({ page: p, text: rowText(row.items), items: row.items });
                    cur.titleItems.push(...row.items);
                } else {
                    skipped.push({ page: p, text: rowText(row.items) });
                }
            }
        }
    }

    entries.forEach((e, i) => {
        e.index = i; // Lesereihenfolge, für den Reihenfolge- und Umbruch-Vergleich
        const texts = e.rows.map((r) => r.text);
        e.titel = joinRows(texts, { dehyphen: true });
        // Zweite Lesart mit erhaltenem Bindestrich (siehe joinRows).
        e.titelHyphen = joinRows(texts, { dehyphen: false });
        e.titleBox = boxOfRows(e.rows);
        // Anker für Befunde: Nummer und Titel der ersten Zeile zusammen.
        e.box = boxOfRows([e.rows[0]]) || e.numberBox;
    });

    return { entries, columns, skipped, pageCount, pageSizes };
}

// Kasten über die Items mehrerer Zeilen (Seite der ersten Zeile).
function boxOfRows(rows) {
    if (!rows || !rows.length) return null;
    const page = rows[0].page;
    const items = rows.filter((r) => r.page === page).flatMap((r) => r.items);
    const rect = bboxOfItems(items);
    return rect ? { page, rect } : null;
}

// Welche Sorte Druck-PDF liegt vor? Das Inhaltsverzeichnis trägt pro Seite
// dutzende rechtsbündige Liednummern in festen Spalten, eine Liedseite des
// Liederteils höchstens zwei Zahlen (Lied- und Choralbuchnummer). Geprüft
// werden nur die ersten Seiten – der Liederteil hat mehrere hundert.
export async function detectPdfKind(pdfDoc, { maxPages = 4 } = {}) {
    const pages = [];
    const n = Math.min(pdfDoc.numPages, maxPages);
    for (let p = 1; p <= n; p++) {
        const page = await pdfDoc.getPage(p);
        pages.push((await pageItems(page)).items);
    }
    return detectColumns(pages).length ? 'inhaltsverzeichnis' : 'lieder';
}

// --- Vergleich PDF ↔ DB ----------------------------------------------------

// Vergleichsformen eines DB-Titels. Zweisprachige Lieder tragen in der Daten-
// bank beide Titel in einem Feld („Nun danket alle Gott / Now Thank We All Our
// God"); im Inhaltsverzeichnis steht die Übersetzung dagegen als eigener
// Eintrag mit nur ihrem Titel. Deshalb gilt neben dem ganzen Titel auch jede
// durch „/" getrennte Hälfte als gültige Schreibweise.
export function titleVariants(titel) {
    const full = canon(titel);
    const parts = String(titel || '')
        .split('/')
        .map((p) => canon(p))
        .filter(Boolean);
    return parts.length > 1 ? [full, ...parts] : [full];
}

// Abschließender Klammerzusatz eines Titels („… (Unser Vater)"). In der Daten-
// bank steht dort der geläufige Zweitname; im Druck wird er weggelassen.
function stripSuffix(s) {
    return s.replace(/\s*\([^()]*\)\s*$/u, '').trim();
}

// Die beiden Lesarten des gedruckten Titels (mit/ohne aufgelöste Silbentrennung).
function pdfForms(entry) {
    const a = canon(entry.titel);
    const b = canon(entry.titelHyphen);
    return a === b ? [a] : [a, b];
}

// Bewertung eines gedruckten Titels gegen eine DB-Fassung:
//   'ok'     – Schreibweise stimmt (ganzer Titel oder eine Titel-Hälfte)
//   'suffix' – stimmt bis auf den fehlenden Klammerzusatz der Datenbank
//   'diff'   – abweichende Schreibweise
export function titleVerdict(entry, titel) {
    const forms = pdfForms(entry);
    const variants = titleVariants(titel);
    if (variants.some((v) => forms.includes(v))) return 'ok';
    if (variants.map(stripSuffix).some((v) => v && forms.includes(v))) return 'suffix';
    return 'diff';
}

// Ähnlichkeit eines gedruckten Eintrags zu einer DB-Fassung (0..1) – Grundlage
// der Zuordnung, wenn eine Liednummer mehrere Fassungen hat (Lied +
// Übersetzung). Der ganze Titel schlägt die Titel-Hälfte: Sonst könnte die
// deutsche Zeile ebenso gut der Übersetzungs-Fassung zugeschlagen werden,
// deren Titel mit genau demselben deutschen Titel beginnt.
function versionScore(entry, lied) {
    const forms = pdfForms(entry);
    const variants = titleVariants(lied.titel);
    if (forms.includes(variants[0])) return 1;
    if (variants.slice(1).some((v) => forms.includes(v))) return 0.95;
    let best = 0;
    for (const v of variants) {
        for (const f of forms) best = Math.max(best, similarity(v, f));
    }
    return Math.min(best, 0.9);
}

// Vorkommen einer Liednummer den DB-Fassungen zuordnen – die ähnlichsten Paare
// zuerst (greedy), analog zum Liederteil. Übrige Vorkommen sind „extra".
function assignVersions(occs, dbCands) {
    if (occs.length === 1 && dbCands.length === 1) {
        return { pairs: [{ entry: occs[0], lied: dbCands[0] }], extra: [] };
    }
    const scored = [];
    for (const entry of occs) {
        for (const lied of dbCands) scored.push({ entry, lied, score: versionScore(entry, lied) });
    }
    scored.sort((a, b) => b.score - a.score);
    const usedEntry = new Set();
    const usedLied = new Set();
    const pairs = [];
    for (const s of scored) {
        if (usedEntry.has(s.entry) || usedLied.has(s.lied)) continue;
        usedEntry.add(s.entry);
        usedLied.add(s.lied);
        pairs.push({ entry: s.entry, lied: s.lied });
    }
    return { pairs, extra: occs.filter((e) => !usedEntry.has(e)) };
}

// Die DB-Schreibweise, gegen die der gedruckte Titel gehalten wird: bei zwei-
// sprachigen Titeln die Hälfte, die im Druck steht – sonst der ganze Titel.
function expectedTitle(entry, titel) {
    const forms = pdfForms(entry);
    const raw = String(titel || '').split('/');
    if (raw.length > 1) {
        const hit = raw.find((p) => {
            const c = canon(p);
            return forms.includes(c) || forms.includes(stripSuffix(c));
        });
        if (hit) return hit.trim();
        // Keine Hälfte getroffen: die dem Druck ähnlichste nehmen, damit der
        // Vergleich die deutsche Zeile nicht gegen die englische hält.
        let best = null;
        for (const p of raw) {
            const c = canon(p);
            const score = Math.max(...forms.map((f) => similarity(c, f)));
            if (!best || score > best.score) best = { text: p.trim(), score };
        }
        if (best && best.score >= 0.5) return best.text;
    }
    return String(titel || '').trim();
}

// Satzfehler „Liednummer steht auf der Fortsetzungszeile": Läuft ein Titel über
// zwei Zeilen und rutscht die Nummer des nächsten Liedes auf die zweite Zeile,
// erscheint der Rest des ersten Titels als Anfang des nächsten Eintrags:
//
//     195  Gleich einem Baum, der gepflanzt an den
//     196  Bächen
//          Glocken läutet in den Landen
//
// Beide Einträge sind dann falsch – aber es ist EIN Satzfehler. Erkannt wird er
// daran, dass der gedruckte Titel genau den Anfang seines DB-Titels trägt und
// der fehlende Rest den nächsten Eintrag anführt. Beide Titel gelten danach als
// geprüft, gemeldet wird nur die verrutschte Nummer.
function foldWrappedNumbers(matches, wrapped) {
    for (let i = 0; i + 1 < matches.length; i++) {
        const a = matches[i];
        const b = matches[i + 1];
        if (a.titleOk || b.titleOk) continue;
        const dbA = canon(expectedTitle(a.entry, a.lied.titel));
        const pdfA = canon(a.entry.titel);
        if (!dbA.startsWith(pdfA + ' ')) continue;
        const rest = dbA.slice(pdfA.length + 1);
        const dbB = canon(expectedTitle(b.entry, b.lied.titel));
        if (canon(b.entry.titel) !== `${rest} ${dbB}`) continue;

        wrapped.push({
            sev: 'error',
            id: b.lied.id,
            nummer: b.entry.nummer,
            title: `Liednummer ${b.entry.nummer} steht auf der Fortsetzungszeile`,
            detail:
                `Der Titel von Lied ${a.entry.nummer} ist umbrochen („${rest}" steht in der` +
                ` zweiten Zeile), die Liednummer ${b.entry.nummer} steht aber neben dieser` +
                ` Fortsetzung statt neben „${dbB}".`,
            loc: b.entry.numberBox || b.entry.box,
        });
        a.titleOk = true;
        b.titleOk = true;
        i++; // beide Einträge sind abgehandelt
    }
}

const CAT_COMPLETE = 'Vollständigkeit & Reihenfolge';
const CAT_TITLE = 'Titel / Schreibweise';
const CAT_INFO = 'Hinweise (nicht geprüft)';
const CAT_OVERVIEW = 'Übersicht';

// Vergleicht die aus der Inhaltsverzeichnis-PDF gelesenen Einträge mit den
// „genommenen" Liedern der Datenbank und liefert die flache Liste von Checks.
export function compareIvzPdf(extracted, dbSongs) {
    const { entries, pageCount, skipped = [] } = extracted;

    const byId = {};
    for (const l of dbSongs) byId[l.id] = l.liednummer2026;

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
    const titleDiff = [];
    const titleSuffix = [];
    const wrapped = [];

    // Reihenfolge: Die Nummern müssen in der Lesereihenfolge (Spalte für Spalte,
    // Seite für Seite) aufsteigen. Dieselbe Nummer darf mehrfach vorkommen
    // (deutsche Fassung + Übersetzung stehen untereinander).
    for (let i = 1; i < entries.length; i++) {
        const prev = numInt(entries[i - 1].nummer);
        const curr = numInt(entries[i].nummer);
        if (prev != null && curr != null && curr < prev) {
            order.push({
                sev: 'error',
                nummer: entries[i].nummer,
                title: `Nr. ${entries[i].nummer} steht nach Nr. ${entries[i - 1].nummer}`,
                detail: `„${entries[i].titel}" steht im Inhaltsverzeichnis nicht an der richtigen Stelle – die Liednummern müssen aufsteigen.`,
                loc: entries[i].box,
            });
        }
    }

    // Einträge nach Nummer gruppieren (Reihenfolge erhalten).
    const byNum = new Map();
    for (const e of entries) {
        const k = numKey(e.nummer);
        if (!byNum.has(k)) byNum.set(k, []);
        byNum.get(k).push(e);
    }

    const matchedDbIds = new Set();
    const matches = [];

    for (const [k, occs] of byNum) {
        const dbCands = genommenByNum.get(k) || [];

        if (!dbCands.length) {
            const anyList = anyByNum.get(k) || [];
            for (const e of occs) {
                const l = anyList[0];
                unknown.push({
                    sev: l ? 'warning' : 'error',
                    id: l?.id ?? null,
                    nummer: e.nummer,
                    title: e.titel || `Nr. ${e.nummer}`,
                    detail: l
                        ? `Lied existiert, ist aber nicht „genommen" – es gehört nicht ins Inhaltsverzeichnis.`
                        : 'Keine passende Liednummer in der Datenbank',
                    loc: e.box,
                });
                recognized.push({ entry: e });
            }
            continue;
        }

        const { pairs, extra } = assignVersions(occs, dbCands);
        for (const { entry, lied } of pairs) {
            matchedDbIds.add(lied.id);
            matches.push({ entry, lied, titleOk: null });
            recognized.push({ entry, id: lied.id });
        }
        for (const e of extra) {
            duplicates.push({
                sev: 'error',
                nummer: e.nummer,
                title: `Nr. ${e.nummer} kommt öfter vor als in der Datenbank`,
                detail: `„${e.titel}" – ${occs.length}× im Inhaltsverzeichnis, aber nur ${dbCands.length} genommene Fassung(en) in der Datenbank`,
                loc: e.box,
            });
            recognized.push({ entry: e });
        }
    }
    // Übersicht in Lesereihenfolge – gruppiert wurde nach Nummer.
    recognized.sort((a, b) => a.entry.index - b.entry.index);

    // Einträge in Lesereihenfolge – der verrutschte Zeilenumbruch ist nur an
    // zwei aufeinanderfolgenden Einträgen zu erkennen.
    matches.sort((a, b) => (a.entry.index ?? 0) - (b.entry.index ?? 0));
    foldWrappedNumbers(matches, wrapped);

    for (const m of matches) {
        if (m.titleOk) continue;
        const verdict = titleVerdict(m.entry, m.lied.titel);
        if (verdict === 'ok') continue;
        const expected = expectedTitle(m.entry, m.lied.titel);
        if (verdict === 'suffix') {
            titleSuffix.push({
                sev: 'warning',
                id: m.lied.id,
                nummer: m.entry.nummer,
                title: `Nr. ${m.entry.nummer} · ${m.entry.titel}`,
                detail: `Der Klammerzusatz der Datenbank fehlt im Druck – DB: „${expected}"`,
                pdf: m.entry.titel,
                expected,
                loc: m.entry.titleBox || m.entry.box,
            });
            continue;
        }
        titleDiff.push({
            sev: 'error',
            id: m.lied.id,
            nummer: m.entry.nummer,
            title: `Nr. ${m.entry.nummer} · ${expected}`,
            detail: `PDF: „${m.entry.titel}" | DB: „${expected}"`,
            pdf: m.entry.titel,
            expected,
            loc: m.entry.titleBox || m.entry.box,
        });
    }

    // Fehlende Einträge: genommen + Nummer, aber im Inhaltsverzeichnis nicht da.
    for (const [, list] of genommenByNum) {
        for (const l of list) {
            if (matchedDbIds.has(l.id)) continue;
            missing.push({
                sev: 'error',
                id: l.id,
                nummer: resolveLiednummer2026(l, byId),
                title: l.titel || '—',
                detail: 'Im Inhaltsverzeichnis nicht gefunden',
            });
        }
    }
    missing.sort((a, b) => (numInt(a.nummer) ?? 0) - (numInt(b.nummer) ?? 0));

    const checks = [];

    checks.push(
        makeCheck(
            'ivz-overview',
            CAT_OVERVIEW,
            'Erkannte Einträge',
            'Aus dem Text-Layer der PDF erkannte Zeilen des Inhaltsverzeichnisses (Liednummer + Titel, umbrochene Titel zusammengefügt).',
            recognized.map((r) => ({
                id: r.id ?? null,
                nummer: r.entry.nummer,
                title: r.entry.titel,
                detail: `Seite ${r.entry.page}`,
                loc: r.entry.box,
            })),
            {
                forceStatus: 'info',
                okSummary: `${recognized.length} Einträge erkannt`,
                problemSummary: () => `${recognized.length} Einträge · ${pageCount} Seiten`,
            },
        ),
    );

    checks.push(
        makeCheck(
            'ivz-missing',
            CAT_COMPLETE,
            'Fehlende Einträge',
            'Jedes „genommene" Lied mit Liednummer muss im Inhaltsverzeichnis stehen – auch jede fremdsprachige Fassung mit eigenem Titel.',
            missing,
            {
                okSummary: 'Alle genommenen Lieder stehen im Inhaltsverzeichnis',
                problemSummary: (i) => `${i.length} genommene Lieder fehlen`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'ivz-unknown',
            CAT_COMPLETE,
            'Unbekannte / nicht genommene Einträge',
            'Jede Liednummer im Inhaltsverzeichnis muss zu einem „genommenen" Lied gehören.',
            unknown,
            {
                okSummary: 'Alle Einträge gehören zu genommenen Liedern',
                problemSummary: (i) => `${i.length} Einträge ohne passendes genommenes Lied`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'ivz-duplicates',
            CAT_COMPLETE,
            'Doppelte / überzählige Liednummern',
            'Eine Liednummer darf nur so oft im Inhaltsverzeichnis vorkommen, wie es genommene Fassungen (inkl. Übersetzungen) in der Datenbank gibt.',
            duplicates,
            {
                okSummary: 'Keine überzähligen Einträge',
                problemSummary: (i) => `${i.length} überzählige(r) Eintrag/Einträge`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'ivz-order',
            CAT_COMPLETE,
            'Reihenfolge',
            'Die Liednummern müssen in der Lesereihenfolge (Spalte für Spalte, Seite für Seite) aufsteigen. Da die Nummern in der alphabetischen Titel-Reihenfolge vergeben wurden, ist das gleichbedeutend mit der korrekten ABC-Sortierung.',
            order,
            {
                okSummary: 'Die Einträge stehen in aufsteigender Reihenfolge',
                problemSummary: (i) => `${i.length} Reihenfolge-Sprung/Sprünge`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'ivz-number-wrap',
            CAT_COMPLETE,
            'Liednummer auf der Fortsetzungszeile',
            'Läuft ein Titel über zwei Zeilen, muss die Nummer des nächsten Liedes neben dessen Titel stehen – nicht neben der Fortsetzung des vorherigen Titels.',
            wrapped,
            {
                okSummary: 'Alle Liednummern stehen neben ihrem Titel',
                problemSummary: (i) => `${i.length} verrutschte Liednummer(n)`,
            },
        ),
    );

    checks.push(
        makeCheck(
            'ivz-title',
            CAT_TITLE,
            'Titel-Schreibweise',
            'Der gedruckte Titel muss Zeichen für Zeichen dem Titel in der Datenbank entsprechen. Bei zweisprachigen Liedern zählt die im Druck stehende Titel-Hälfte („Deutsch / English").',
            titleDiff,
            {
                okSummary: 'Alle Titel stimmen mit der Datenbank überein',
                problemSummary: (i) => `${i.length} abweichende(r) Titel`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'ivz-title-suffix',
            CAT_TITLE,
            'Fehlender Klammerzusatz',
            'In der Datenbank trägt der Titel einen abschließenden Klammerzusatz (geläufiger Zweitname), im Inhaltsverzeichnis steht er nicht. Meist so gewollt – bitte einmal bestätigen.',
            titleSuffix,
            {
                okSummary: 'Keine weggelassenen Klammerzusätze',
                problemSummary: (i) => `${i.length} Titel ohne den Klammerzusatz der Datenbank`,
            },
        ),
    );

    if (skipped.length) {
        checks.push(
            makeCheck(
                'ivz-skipped',
                CAT_INFO,
                'Übersprungene Zeilen',
                'Zeilen ohne Liednummer vor dem ersten Eintrag – Deckblatt und Spaltenköpfe („NR ABC"). Sie werden nicht gegen die Datenbank geprüft.',
                skipped.map((s) => ({
                    nummer: null,
                    title: `Seite ${s.page}`,
                    detail: s.text,
                })),
                { forceStatus: 'info', okSummary: '' },
            ),
        );
    }

    assignItemFingerprints(checks);

    return checks;
}
