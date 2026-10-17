// Notensatz-Abgleich der Druck-PDF gegen die Datenbank.
//
// Ergänzt printPdfCheck.js um das, was dort ausdrücklich NICHT geprüft werden
// kann: den Notensatz selbst (samt Strophe 1, die als Bild-Stempel unter den
// Noten steht). Möglich wird das über den Fingerabdruck der Noten-Glyphen –
// warum das trägt, steht in notenFingerprint.js.
//
// Gemeldet werden drei Dinge:
//   * Im Druck steht nur der ANFANG des Notensatzes – die gedruckten Glyphen
//     sind ein echter Anfang der DB-Datei, hinten fehlt ein System. Der
//     Notensatz ist länger als eine Seite und seine zweite Seite (Fortsetzung)
//     fehlt im Druck.
//   * Es steht die FALSCHE FASSUNG auf der Seite – der Notensatz passt
//     geometrisch besser zu einer anderen DB-Fassung desselben Liedes (typisch:
//     die fremdsprachige statt der deutschen).
//   * Der Notensatz gehört zu KEINER DB-Datei – meist hängt der InDesign-Rahmen
//     noch an einem alten Export.
//   * Es liegen MEHRERE Notensätze übereinander (doppelt platzierter Rahmen,
//     alter Export unter dem neuen).

import { resolveLiednummer2026 } from '@/assets/js/utils';
import {
    GEOMETRY_TOLERANCE_PT,
    alignPlacement,
    diffGlyphMarks,
    isFingerprintUsable,
    pickBestCandidate,
    splitStackedPlacement,
} from '@/assets/js/notenFingerprint';

const CAT_NOTEN = 'Notensatz';

// Ab so vielen Notenzeichen zählt eine Seite der Notensatz-Datei als „echte"
// Notensatz-Seite, die im Druck stehen muss (eine leere Folgeseite oder ein
// einzelnes verirrtes Zeichen lösen keinen Befund aus).
const MIN_PAGE_GLYPHS = 8;
// Kleinster Rest einer nur teilweise gedruckten Datei-Seite, der noch als „das
// ist ein Stück dieser Seite" zählt (Lied 222: 6 von 21 Notenzeichen).
const MIN_PARTIAL_GLYPHS = 4;

// Vergleichsschlüssel einer Liednummer (wie in printPdfCheck.js).
function numKey(v) {
    const m = String(v ?? '').match(/^\s*0*(\d+)\s*([a-zA-Z]?)/);
    if (!m)
        return String(v ?? '')
            .trim()
            .toLowerCase();
    return `${m[1]}${(m[2] || '').toLowerCase()}`;
}

// Grober Kasten um eine Platzierung – als Anker fürs Overlay. Die Glyphen-Breite
// steht im Text-Layer nicht, deshalb ein großzügiger Rand um die Startpunkte.
function placementBox(placement) {
    const xs = placement.items.map((i) => i.x);
    const ys = placement.items.map((i) => i.yTop);
    if (!xs.length) return null;
    const PAD = 14;
    const x = Math.min(...xs) - 2;
    const y = Math.min(...ys) - PAD;
    return {
        page: placement.page,
        rect: {
            x,
            y,
            w: Math.max(...xs) - x + PAD,
            h: Math.max(...ys) - y + PAD,
        },
    };
}

// Umschließender Kasten mehrerer Diff-Kästen – Ziel für die Verbindungslinie und
// das Scrollen, während die einzelnen kleinen Kästen die genauen Stellen zeigen.
function boundingBox(boxes) {
    if (!boxes.length) return null;
    const x0 = Math.min(...boxes.map((b) => b.rect.x));
    const y0 = Math.min(...boxes.map((b) => b.rect.y));
    const x1 = Math.max(...boxes.map((b) => b.rect.x + b.rect.w));
    const y1 = Math.max(...boxes.map((b) => b.rect.y + b.rect.h));
    return { page: boxes[0].page, rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}

// Die größte Platzierung einer Seite ist der Notensatz des Liedes; kleinere sind
// Reste fremder Rahmen (siehe „Text außerhalb des Druckbereichs").
function mainPlacement(ps) {
    const list = (ps.placements || []).filter((p) => p.seq.length);
    if (!list.length) return null;
    return list.reduce((a, b) => (b.seq.length > a.seq.length ? b : a));
}

// Liegen zwei Platzierungen übereinander? Bringt jeder Rahmen seine eigene
// Kopie der Notenschrift mit, sind es getrennte Platzierungen derselben Seite –
// übereinander liegen sie, wenn sich ihre Kästen größtenteils decken. (Lied 260,
// Seite 82: zwei Notensätze untereinander auf einer Seite, die sich nicht
// überschneiden – kein Befund.)
function overlaps(a, b) {
    const A = placementBox(a)?.rect;
    const B = placementBox(b)?.rect;
    if (!A || !B) return false;
    const w = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
    const h = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
    if (w <= 0 || h <= 0) return false;
    return w * h >= 0.5 * Math.min(A.w * A.h, B.w * B.h);
}

// Ebenen eines Notensatzes von unten nach oben ([{ placement, best }]) – oder
// null, wenn auf der Seite nur EIN Notensatz liegt. Zwei Wege führen dahin:
// eine Platzierung, deren Folge mehrere Dateien hintereinander enthält (eine
// gemeinsame Kopie der Notenschrift, splitStackedPlacement), und weitere
// Platzierungen derselben Seite, die sich mit ihr decken. Die Reihenfolge der
// Platzierungen ist die Zeichenreihenfolge: Die letzte liegt obenauf.
function stackedLayers(ps, placement, best, usable) {
    const others = (ps.placements || []).filter(
        (p) =>
            p !== placement && p.page === placement.page && p.seq.length && overlaps(p, placement),
    );
    const own = best ? null : splitStackedPlacement(placement, usable);
    if (!own && !others.length) return null;
    const layers = [];
    for (const p of ps.placements) {
        if (p === placement) layers.push(...(own || [{ placement, best }]));
        else if (others.includes(p))
            layers.push({ placement: p, best: pickBestCandidate(p, usable).best });
    }
    return layers;
}

// Eine untere Ebene in Worten – relativ zur obersten.
function describeLayer(layer, top) {
    const b = layer.best;
    if (!b)
        return `ein Notensatz ohne passende DB-Datei (${layer.placement.seq.length} Notenzeichen, vermutlich ein alter Export)`;
    if (top.best && b.lied.id === top.best.lied.id && b.fpPage === top.best.fpPage) {
        const off = layerOffset(layer, top);
        return off <= GEOMETRY_TOLERANCE_PT
            ? 'noch einmal dieselbe Datei, deckungsgleich'
            : `noch einmal dieselbe Datei, um ${off.toFixed(1)} pt versetzt`;
    }
    return `der Notensatz von „${b.lied.titel || b.lied.id}"`;
}

// Versatz einer Ebene gegenüber der obersten (beide müssen getroffen sein).
function layerOffset(layer, top) {
    return Math.max(Math.abs(layer.best.dx - top.best.dx), Math.abs(layer.best.dy - top.best.dy));
}

// Führende Ganzzahl einer Liednummer ("12a" -> 12).
function numInt(v) {
    const m = String(v ?? '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
}

// Welche Liednummern kommen für ein Lied OHNE gedruckte Nummer in Frage?
//
// printPdfCheck ordnet ein solches Lied über seinen Text zu – das scheitert
// aber genau dann, wenn es gar keinen Textblock gibt (alle Strophen im
// Notensatz) und die Fußzeile sich nicht berechnen lässt: Seite 144 (Lied 100)
// ist genau dieser Fall. Der Notensatz kann die Zuordnung trotzdem leisten, und
// die Kandidaten dafür sind eng begrenzt: Die Liednummern stehen aufsteigend
// (eigener Check), die gesuchte Nummer liegt also zwischen der des vorherigen
// und der des nächsten gedruckten Liedes.
function numbersBetweenNeighbours(pdfSongs, index) {
    let prev = null;
    for (let i = index - 1; i >= 0; i--) {
        const n = numInt(pdfSongs[i].nummer);
        if (n != null) {
            prev = n;
            break;
        }
    }
    let next = null;
    for (let i = index + 1; i < pdfSongs.length; i++) {
        const n = numInt(pdfSongs[i].nummer);
        if (n != null) {
            next = n;
            break;
        }
    }
    const from = prev != null ? prev + 1 : next != null ? Math.max(1, next - 1) : null;
    const to = next != null ? next - 1 : prev != null ? prev + 1 : null;
    if (from == null || to == null || to < from) return [];
    // Eng halten: Sonst würde aus einer Lücke im Satz ein Download-Marathon.
    const MAX_SPAN = 5;
    if (to - from + 1 > MAX_SPAN) return [];
    const out = [];
    for (let n = from; n <= to; n++) out.push(n);
    return out;
}

/**
 * Notensatz-Abgleich.
 *
 * @param extracted   Ergebnis von extractPdfSongs()
 * @param dbSongs     alle DB-Lieder (store.gesangbuchlieder)
 * @param loadFingerprint  async (lied) => Fingerabdruck | null. Kapselt, woher
 *                    er kommt (DB-Feld oder notfalls die PDF selbst).
 * @param onProgress  optional (done, total) für die Fortschrittsanzeige
 */
export async function checkPrintNotensatz(
    extracted,
    dbSongs,
    { loadFingerprint, onProgress } = {},
) {
    const { songs: pdfSongs } = extracted;

    const byId = {};
    for (const l of dbSongs) byId[l.id] = l.liednummer2026;
    const liedById = new Map(dbSongs.map((l) => [l.id, l]));

    // Fassungen je Liednummer – daraus kommen die Kandidaten, gegen die eine
    // Platzierung gehalten wird (deutsch + Übersetzung teilen sich die Nummer).
    const byNum = new Map();
    for (const l of dbSongs) {
        const num = resolveLiednummer2026(l, byId) || l.liednummer2026;
        if (!num) continue;
        const k = numKey(num);
        if (!byNum.has(k)) byNum.set(k, []);
        byNum.get(k).push(l);
    }

    // Zu prüfen ist jedes PDF-Lied mit Notensatz. `lied` ist die von
    // printPdfCheck zugeordnete DB-Fassung – fehlt sie (Lied ohne gedruckte
    // Nummer und ohne Textblock), wird sie hier über den Notensatz erschlossen.
    const jobs = [];
    for (let i = 0; i < pdfSongs.length; i++) {
        const ps = pdfSongs[i];
        const placement = mainPlacement(ps);
        if (!placement) continue;
        const lied = ps.liedId != null ? liedById.get(ps.liedId) : null;

        let cands;
        if (lied) {
            cands = (byNum.get(numKey(resolveLiednummer2026(lied, byId))) || []).filter(
                (l) => l.notentext,
            );
            if (!cands.some((c) => c.id === lied.id) && lied.notentext) cands.push(lied);
        } else {
            cands = numbersBetweenNeighbours(pdfSongs, i)
                .flatMap((n) => byNum.get(numKey(n)) || [])
                .filter((l) => l.notentext);
        }
        if (!cands.length) continue;
        jobs.push({ ps, placement, lied, cands });
    }

    // Fingerabdrücke einsammeln (je Lied nur einmal).
    const needed = new Map();
    for (const j of jobs) for (const c of j.cands) needed.set(c.id, c);
    const fps = new Map();
    let done = 0;
    for (const [id, lied] of needed) {
        try {
            fps.set(id, await loadFingerprint(lied));
        } catch (e) {
            console.warn('Fingerabdruck nicht ladbar für Lied', id, e);
            fps.set(id, null);
        }
        onProgress?.(++done, needed.size);
    }

    // Alle Platzierungen der ganzen Druck-PDF: Geprüft wird je PDF-Lied nur die
    // größte Platzierung (mainPlacement) – ob eine Datei-Seite überhaupt
    // irgendwo gedruckt ist, muss deshalb über das ganze Dokument laufen. Die
    // zweite Seite eines langen Notensatzes steht auf der Folgeseite (Lied 265,
    // Seiten 378/379) und damit zwar im selben PDF-Lied, aber nicht in dessen
    // geprüfter Platzierung.
    const allPlacements = pdfSongs.flatMap((s) => (s.placements || []).filter((p) => p.seq.length));

    const truncated = [];
    const wrongVersion = [];
    const deviation = [];
    const unknownSource = [];
    const drift = [];
    const stacked = [];
    const notCheckable = [];
    // Je (Lied, Datei-Seite) nur ein Befund „Seite fehlt im Druck" – auch wenn
    // mehrere Platzierungen desselben Liedes geprüft werden.
    const reportedMissingPages = new Set();

    for (const { ps, lied, cands, ...job } of jobs) {
        let placement = job.placement;
        const page = placement.page;

        // Kandidaten mit brauchbarem Fingerabdruck.
        const usable = [];
        for (const c of cands) {
            const fp = fps.get(c.id);
            if (!isFingerprintUsable(fp, c.notentext)) continue;
            for (const fpPage of fp.pages) usable.push({ lied: c, fpPage });
        }
        if (!usable.length) {
            const stale = lied && fps.get(lied.id);
            notCheckable.push({
                id: lied?.id ?? null,
                nummer: ps.nummer,
                title: lied?.titel || `Seite ${page}`,
                detail: stale
                    ? 'Fingerabdruck gehört zu einer anderen Notensatz-Datei (veraltet) – bitte neu berechnen'
                    : 'Kein Notensatz-Fingerabdruck hinterlegt',
                loc: placementBox(placement),
            });
            continue;
        }

        let { best } = pickBestCandidate(placement, usable);

        // Mehrere Notensätze übereinander: Sichtbar ist der oberste – er wird wie
        // gewohnt weitergeprüft, die darunter liegenden werden gemeldet.
        const layers = stackedLayers(ps, placement, best, usable);
        if (layers) {
            const top = layers[layers.length - 1];
            const lower = layers.slice(0, -1).reverse(); // von oben nach unten
            const lowerText = lower.map((l) => describeLayer(l, top)).join('; ');
            const title = lied?.titel || top.best?.lied.titel || `Seite ${page}`;
            if (!top.best) {
                unknownSource.push({
                    id: lied?.id ?? null,
                    nummer: ps.nummer,
                    title,
                    sev: 'error',
                    detail:
                        `Auf Seite ${page} liegen ${layers.length} Notensätze übereinander. Der oberste ` +
                        `(sichtbare, ${top.placement.seq.length} Notenzeichen) stimmt mit keiner ` +
                        `Notensatz-Datei ${lied ? 'dieses Liedes' : `für Seite ${page}`} überein – ` +
                        `vermutlich ein alter Export. Darunter (verdeckt): ${lowerText}.`,
                    loc: placementBox(top.placement),
                });
                continue;
            }
            const harmless = lower.every(
                (l) =>
                    l.best?.lied.id === top.best.lied.id &&
                    l.best.fpPage === top.best.fpPage &&
                    layerOffset(l, top) <= GEOMETRY_TOLERANCE_PT,
            );
            stacked.push({
                id: (lied || top.best.lied).id,
                nummer: ps.nummer ?? resolveLiednummer2026(top.best.lied, byId),
                title,
                notentextId: top.best.lied.notentext || null,
                // Immer nur eine Warnung: Der sichtbare (oberste) Notensatz wird
                // unten ganz normal geprüft – steht dort der falsche, meldet das
                // der jeweilige Check als Fehler.
                sev: 'warning',
                detail:
                    `Auf Seite ${page} liegen ${layers.length} Notensätze übereinander. Obenauf ` +
                    `(sichtbar) liegt ${
                        !lied || top.best.lied.id === lied.id
                            ? 'die Notensatz-Datei aus der Datenbank'
                            : `der Notensatz von „${top.best.lied.titel || top.best.lied.id}"`
                    }, darunter: ${lowerText}. ` +
                    (harmless
                        ? 'Das Druckbild stimmt – im Satz sollte der doppelte Rahmen trotzdem gelöscht werden.'
                        : 'Der untere Notensatz kann im Druck durchscheinen – bitte im Druckbild prüfen und im Satz löschen.'),
                loc: placementBox(top.placement),
            });
            placement = top.placement;
            best = top.best;
        }

        if (!best) {
            unknownSource.push({
                id: lied?.id ?? null,
                nummer: ps.nummer,
                title: lied?.titel || `Seite ${page}`,
                sev: 'error',
                detail:
                    `Der gedruckte Notensatz (${placement.seq.length} Notenzeichen) stimmt mit keiner ` +
                    `Notensatz-Datei ${lied ? 'dieses Liedes' : `für Seite ${page}`} überein – ` +
                    `vermutlich ist im Satz noch ein alter Export verknüpft`,
                loc: placementBox(placement),
            });
            continue;
        }

        // Der Notensatz identifiziert das Lied – auch dann, wenn printPdfCheck es
        // nicht zuordnen konnte (Seite ohne Liednummer und ohne Textblock).
        const ist = best.lied;
        const title = (lied || ist).titel || `Lied ${ps.nummer ?? ist.liednummer2026}`;
        // Datei-Id der zugeordneten DB-Fassung – für den „Original ansehen"-Knopf.
        const notentextId = ist.notentext || null;
        const base = {
            id: (lied || ist).id,
            nummer: ps.nummer ?? resolveLiednummer2026(ist, byId),
            title,
            notentextId,
        };
        const viaNoten = lied
            ? ''
            : ` (Seite ${page} trägt keine Liednummer – über den Notensatz als Lied ${resolveLiednummer2026(ist, byId) || ist.id} erkannt)`;

        // Falsche Fassung: Der Notensatz passt zu einer ANDEREN Fassung derselben
        // Liednummer. Bei gleicher Melodie ist die Notenfolge identisch – erkannt
        // wird das allein an der Geometrie (andere Silbenbreiten, andere
        // Notenabstände). Nur melden, wenn der Sieger sauber passt.
        if (lied && ist.id !== lied.id && best.residual <= GEOMETRY_TOLERANCE_PT) {
            const own = usable.find((u) => u.lied.id === lied.id);
            const ownRes = own ? alignPlacement(placement, own.fpPage).residual : Infinity;
            wrongVersion.push({
                ...base,
                sev: 'error',
                detail:
                    `Auf Seite ${page} steht der Notensatz von „${ist.titel || ist.id}" ` +
                    `(Lied-Id ${ist.id})${
                        ist.deutscheLiedfassung ? ' – der fremdsprachigen Fassung' : ''
                    }, erwartet war der von „${lied.titel || lied.id}"` +
                    (Number.isFinite(ownRes)
                        ? ` (die eigene Fassung weicht um ${ownRes.toFixed(1)} pt ab)`
                        : ''),
                loc: placementBox(placement),
            });
            continue;
        }

        // Fehlende Datei-Seite: Die Notensatz-Datei hat WEITERE Seiten mit
        // Notenzeichen, die nirgends im Druck platziert sind. Der Treffer oben
        // sagt nur „die gedruckte Seite stimmt" – er sagt nicht, dass die Datei
        // vollständig gedruckt ist. Typische Ursache ist eine mehrseitige PDF im
        // Feld `notentext` (Seite 2 gehört als eigene Datei in
        // `notentext_seite2`): InDesign platziert nur EINE Seite der Datei, die
        // restlichen Systeme fehlen dann stillschweigend (Lied 356, Seite 262
        // der Test-PDF 171–356). Nur eine Warnung, weil der eigentliche Fehler
        // der falsche Upload ist – den meldet der Gesangbuch-Check
        // „notentext-mehrseitig" als Fehler.
        const istFp = fps.get(ist.id);
        if (istFp?.pages?.length > 1) {
            const bestIdx = istFp.pages.indexOf(best.fpPage);
            istFp.pages.forEach((fpPage, idx) => {
                if (fpPage === best.fpPage) return;
                if (!fpPage.seq || fpPage.seq.length < MIN_PAGE_GLYPHS) return;
                const key = `${ist.id}:${idx}`;
                if (reportedMissingPages.has(key)) return;
                const covered = allPlacements.some(
                    (pl) => alignPlacement(pl, fpPage).match !== 'none',
                );
                if (covered) return;
                reportedMissingPages.add(key);
                // Teilweise gedruckt: Die Seite IST platziert, aber verschoben – ein
                // Teil ihrer Systeme liegt neben der Seite und fällt weg. Lied 222,
                // Seite 28: Datei-Seite 2 hat zwei Systeme, das erste („Wir stehn
                // staunend …") liegt bei y < 0 über dem Seitenrand, gedruckt wird
                // nur „unser Vater". Auf der Seite bleibt ein Stück aus der Mitte
                // oder vom Ende der Datei-Seite übrig.
                const partial = (ps.placements || []).find(
                    (pl) =>
                        pl.seq.length >= MIN_PARTIAL_GLYPHS &&
                        pl.seq.length < fpPage.seq.length &&
                        fpPage.seq.includes(pl.seq),
                );
                if (partial) {
                    truncated.push({
                        ...base,
                        sev: 'error',
                        detail:
                            `Von Seite ${idx + 1} der Notensatz-Datei stehen auf Seite ${partial.page} nur ` +
                            `${partial.seq.length} von ${fpPage.seq.length} Notenzeichen im Druck – der Rest ` +
                            `liegt außerhalb der Seite und wird nicht gedruckt. Der Notensatz ist im Satz ` +
                            `verschoben oder sein Rahmen zu klein; es fehlt mindestens ein System.` +
                            viaNoten,
                        loc: placementBox(partial),
                        pdf: `${partial.seq.length} von ${fpPage.seq.length} Notenzeichen von Datei-Seite ${idx + 1} gedruckt`,
                        expected: `Datei-Seite ${idx + 1} vollständig (${fpPage.seq.length} Notenzeichen)`,
                    });
                    return;
                }
                truncated.push({
                    ...base,
                    sev: 'warning',
                    detail:
                        `Die Notensatz-Datei hat ${istFp.pages.length} Seiten, im Druck platziert ist nur ` +
                        `Seite ${bestIdx + 1} (${placement.seq.length} Notenzeichen). Die ${fpPage.seq.length} ` +
                        `Notenzeichen von Seite ${idx + 1} stehen nirgends im Druck – vermutlich liegt eine ` +
                        `mehrseitige PDF im Feld „notentext" (Seite 2 gehört als eigene Datei in ` +
                        `„notentext_seite2"), und beim Satz wurde nur eine Seite platziert.` +
                        viaNoten,
                    loc: placementBox(placement),
                    pdf: `Nur Seite ${bestIdx + 1} der Notensatz-Datei ist im Druck platziert`,
                    expected: `Seite ${idx + 1} der Notensatz-Datei (${fpPage.seq.length} Notenzeichen) muss ebenfalls gedruckt werden`,
                });
            });
        }

        // Nur der Anfang gedruckt: Die gedruckten Glyphen sind ein echter ANFANG
        // der DB-Datei, der Schluss fehlt. Fachlich heißt das fast immer, dass
        // der Notensatz länger als eine Seite ist und im Satz seine Fortsetzung
        // fehlt (die zweite Notensatz-Seite dieses Liedes wurde nicht platziert)
        // – NICHT, dass eine PDF beschnitten wurde. Anker ist der sichtbare
        // Notensatz selbst; der fehlende Teil steht ja gerade nicht auf der Seite.
        if (best.match === 'prefix') {
            truncated.push({
                ...base,
                sev: 'error',
                detail:
                    `Im Druck steht nur der Anfang des Notensatzes – ${placement.seq.length} von ` +
                    `${best.fpPage.seq.length} Notenzeichen. Das letzte System (${best.missing} ` +
                    `Notenzeichen) fehlt: Der Notensatz ist länger als eine Seite, und im Druck ` +
                    `fehlt seine zweite Seite. Bitte prüfen, ob hier eine zweite Notensatz-Seite ` +
                    `(Fortsetzung) im Satz platziert werden muss.` +
                    viaNoten,
                loc: placementBox(placement),
                pdf: `${placement.seq.length} von ${best.fpPage.seq.length} Notenzeichen gedruckt`,
                expected:
                    `${best.fpPage.seq.length} Notenzeichen in der Datenbank – die zweite Seite ` +
                    `(letzte ${best.missing} Notenzeichen) fehlt im Druck`,
            });
            continue;
        }

        // Dieselbe Gravur, aber einzelne Zeichen weichen ab: Beim Platzieren wurde
        // ein Glyph ersetzt oder fehlt im Satz-Font (typisch eine Pause – ein
        // echter Satzfehler, das gedruckte Zeichen stimmt dann nicht). Statt „kein
        // Treffer" zu melden, werden die abweichenden Stellen einzeln markiert, mit
        // Knopf zum Original.
        if (best.match === 'fuzzy') {
            const marks = diffGlyphMarks(placement, best.fpPage, best.dx, best.dy, page);
            const n = marks.print.length || best.edits;
            deviation.push({
                ...base,
                sev: 'error',
                detail:
                    `Der gedruckte Notensatz weicht an ${n} Stelle${n === 1 ? '' : 'n'} von der ` +
                    `Notensatz-Datei ab (${best.edits} Notenzeichen unterschiedlich). Vermutlich ` +
                    `wurde beim Platzieren ein Zeichen ersetzt oder fehlt im Satz-Font (z. B. eine ` +
                    `Pause). Die abweichenden Stellen sind markiert – „Vergleich öffnen" zeigt Druck ` +
                    `und Original nebeneinander.` +
                    viaNoten,
                loc: boundingBox(marks.print) || placementBox(placement),
                locs: marks.print.length ? marks.print : null,
                // Dieselben Stellen in Koordinaten der DB-PDF – fürs Overlay im
                // Vergleichs-Dialog auf der Original-Seite.
                originalLocs: marks.original.length ? marks.original : null,
            });
            continue;
        }

        // Richtige Datei, exakt gleiche Zeichen, aber verschoben. Kein harter
        // Fehler: meist ein neuer Export mit minimal anderem Satz.
        if (best.match === 'exact' && best.residual > GEOMETRY_TOLERANCE_PT) {
            drift.push({
                ...base,
                sev: 'warning',
                detail:
                    `Notensatz weicht um ${best.residual.toFixed(1)} pt von der ` +
                    `Notensatz-Datei ab (die Notenfolge stimmt). Vermutlich wurde die Datei nach dem ` +
                    `Satz neu exportiert – bitte prüfen, ob im Satz die aktuelle Fassung liegt.` +
                    viaNoten,
                loc: placementBox(placement),
            });
        }
    }

    return {
        truncated,
        wrongVersion,
        deviation,
        unknownSource,
        drift,
        stacked,
        notCheckable,
        checked: jobs.length,
    };
}

// Die Befunde als Checks im Format von CheckCategory.vue. `makeCheck` kommt aus
// printPdfCheck.js, damit „Bestätigt"-Fingerprints und Status-Neuberechnung
// identisch funktionieren.
export function notensatzChecks(result, makeCheck) {
    const checks = [];
    checks.push(
        makeCheck(
            'noten-truncated',
            CAT_NOTEN,
            'Notensatz vollständig gedruckt',
            'Der gedruckte Notensatz muss alle Notenzeichen der Notensatz-Datei enthalten. Steht im Druck nur der Anfang, ist der Notensatz länger als eine Seite und seine Fortsetzung fehlt – die zweite Notensatz-Seite dieses Liedes wurde nicht in den Satz übernommen. Hat die Notensatz-Datei selbst mehrere Seiten, muss jede davon im Druck platziert sein; fehlt eine komplett, liegt vermutlich eine mehrseitige PDF im Feld „notentext" (Seite 2 gehört als eigene Datei in „notentext_seite2“) – das wird als Warnung gemeldet, den falschen Upload selbst meldet der Gesangbuch-Check „Notentext-PDF hat genau eine Seite“.',
            result.truncated,
            {
                okSummary: 'Alle Notensätze sind vollständig gedruckt',
                problemSummary: (i) =>
                    `${i.length} Notensatz/Notensätze, bei denen die zweite Seite im Druck fehlt`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'noten-version',
            CAT_NOTEN,
            'Richtige Fassung des Notensatzes',
            'Bei Liedern mit mehreren Fassungen (deutsch + fremdsprachig) teilen sich alle dieselbe Liednummer und meist dieselbe Melodie – die Notenfolge ist dann identisch. Unterschieden werden sie an den Notenabständen: Andere Silbenbreiten ergeben einen anders gesetzten Notensatz.',
            result.wrongVersion,
            {
                okSummary: 'Jede Seite trägt den Notensatz ihrer eigenen Fassung',
                problemSummary: (i) =>
                    `${i.length} Seite(n) mit dem Notensatz einer anderen Fassung`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'noten-abweichung',
            CAT_NOTEN,
            'Notenzeichen unverändert übernommen',
            'Der gedruckte Notensatz ist dieselbe Gravur wie in der Datenbank, aber einzelne Notenzeichen weichen ab – beim Platzieren wurde ein Glyph ersetzt oder fehlt im Satz-Font (typisch eine Pause). Die abweichenden Stellen sind im PDF-Abgleich einzeln markiert; über „Original ansehen" lässt sich die Notensatz-Datei zum Vergleich öffnen.',
            result.deviation,
            {
                okSummary: 'Alle Notenzeichen stimmen mit der Datenbank überein',
                problemSummary: (i) =>
                    `${i.length} Notensatz/Notensätze mit abweichenden Notenzeichen`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'noten-quelle',
            CAT_NOTEN,
            'Notensatz stammt aus der Datenbank',
            'Jeder gedruckte Notensatz muss einer Notensatz-Datei aus der Datenbank entsprechen. Passt er zu keiner, ist im Satz vermutlich noch ein alter Export verknüpft.',
            result.unknownSource,
            {
                okSummary: 'Alle Notensätze stammen aus der Datenbank',
                problemSummary: (i) => `${i.length} Notensatz/Notensätze ohne passende DB-Datei`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'noten-drift',
            CAT_NOTEN,
            'Notensatz unverändert übernommen',
            'Der Notensatz wird unskaliert platziert – die Noten müssen also exakt dort stehen wie in der Notensatz-Datei. Weichen sie ab, liegt im Satz vermutlich ein älterer Export.',
            result.drift,
            {
                okSummary: 'Alle Notensätze stehen exakt wie in der Datenbank',
                problemSummary: (i) => `${i.length} Notensatz/Notensätze mit Abweichung`,
            },
        ),
    );
    checks.push(
        makeCheck(
            'noten-gestapelt',
            CAT_NOTEN,
            'Notensatz nur einmal platziert',
            'Auf jeder Seite darf genau ein Notensatz liegen. Liegen mehrere übereinander – ein doppelt platzierter Rahmen oder ein alter Export unter dem aktuellen –, zählt für die übrigen Notensatz-Checks der oberste (sichtbare). Gemeldet wird das als Warnung: Ob der sichtbare Notensatz stimmt, prüfen die übrigen Checks. Eine andere oder versetzte Datei darunter kann aber durchscheinen und sollte im Satz gelöscht werden.',
            result.stacked,
            {
                okSummary: 'Kein Notensatz liegt mehrfach übereinander',
                problemSummary: (i) => `${i.length} Seite(n) mit übereinanderliegenden Notensätzen`,
            },
        ),
    );
    if (result.notCheckable.length) {
        checks.push(
            makeCheck(
                'noten-fingerprint-fehlt',
                'Hinweise (nicht geprüft)',
                'Notensatz nicht prüfbar',
                'Für diese Lieder liegt kein (aktueller) Notensatz-Fingerabdruck vor – ihr Notensatz konnte nicht gegen die Datenbank geprüft werden.',
                result.notCheckable,
                { forceStatus: 'info', okSummary: '' },
            ),
        );
    }
    return checks;
}
