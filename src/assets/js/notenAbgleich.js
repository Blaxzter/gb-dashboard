// PDF↔MusicXML-Abgleich – „beschreibt die MusicXML noch den Notensatz?"
//
// `notentext` (die Noten-PDF) und `notentext_mxml` werden getrennt hochgeladen.
// Wird nur die PDF ausgetauscht – „Bist zu uns wie ein Vater" wurde von E-Dur
// nach F-Dur umgesetzt, die MusicXML blieb in E-Dur –, arbeitet alles, was die
// beiden verbindet (Notenkarte des SVG, Wiedergabe in der App), stillschweigend
// an einem Lied, das es so nicht mehr gibt.
//
// Verglichen wird, was die PDF DRUCKT, mit dem, was die MusicXML SAGT:
//
//   1. Tonart – die Vorzeichen zwischen Schlüssel und Taktart im ersten System
//      gegen das erste `<fifths>`.
//   2. Taktart – jede gedruckte Taktart muss in der MusicXML vorkommen. Nur in
//      diese Richtung: musx2mxl schreibt Auftakte als 43/2048 u. ä., und Finale
//      druckt Wechseltakte als Paar (4/4 + 2/4).
//   3. Tonhöhen – jeder Notenkopf wird über seine Lage zu den Notenlinien zum
//      absoluten Ton und als MULTIMENGE mit den Tönen der MusicXML verglichen.
//      Bewusst ohne Reihenfolge: Stichnoten, die die MusicXML ans Taktende
//      schreibt, sind kein Unterschied, eine andere Melodie schon.
//
// Gleiche Regeln wie gb-scripts/app/utils/notenabgleich.py (dort sperrt ein
// Befund den SVG-Upload) – über den ganzen Bestand gegeneinander geprüft.
// Alle Lieder stehen im Violinschlüssel; nur das erste System trägt ihn als
// Glyphe, die späteren zeichnen ihn als Vektorgrafik. Er wird also dort gelesen
// und gilt für das ganze Lied.

const GCLEF = 0xe050;
const FLAT = 0xe260;
const SHARP = 0xe262;
const NOTEHEADS = new Set([0xe0a0, 0xe0a1, 0xe0a2, 0xe0a3, 0xe0a4]);
const TIME_DIGIT_MIN = 0xe080; // timeSig0 … timeSig9
const TIME_DIGIT_MAX = 0xe089;

// Die unterste Linie im Violinschlüssel ist E4 (Oktave * 7 + Stufe).
const GCLEF_BOTTOM_LINE = 4 * 7 + 2;

// Ein Notenkopf sitzt genau auf Linie oder Zwischenraum; weiter als ein Viertel
// eines halben Linienabstands daneben heißt: nicht lesbar.
const STEP_TOLERANCE = 0.25;

// Ohne Taktart endet die Tonart-Vorzeichnung dort, wo das Vorzeichen der ersten
// Note beginnen könnte (notenmap.py: ACCIDENTAL_GAP).
const ACCIDENTAL_GAP_MAX = 8;

// Ziffern, die näher beieinander stehen, gehören zu derselben Taktangabe. Die
// zwei Spalten eines Wechseltakts stehen 9 pt auseinander.
const TIME_COLUMN_GAP = 5;

// Nenner einer echten Taktart; 2048 & Co. sind Auftakte aus musx2mxl.
const REAL_BEAT_TYPES = new Set([1, 2, 4, 8, 16, 32]);

// Ohne gespeicherte Notenlinien (ältere Fingerabdrücke) wird das erste System
// aus dem Schlüssel geschätzt: Der Violinschlüssel sitzt auf der G-Linie, eine
// Linie über der untersten. Der Abstand ist im Bestand 3,78–3,81 pt.
const FALLBACK_LINE_GAP = 3.8;

const STEPS = 'CDEFGAB';

export function pitchName(diatonic) {
    return `${STEPS[((diatonic % 7) + 7) % 7]}${Math.floor(diatonic / 7)}`;
}

function countInto(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
}

// --- Notensatz (aus dem Fingerabdruck) -------------------------------------

// Was die PDF druckt, aus dem gespeicherten Notensatz-Fingerabdruck.
// `pitches` ist null, wenn der Fingerabdruck keine Notenlinien trägt.
export function engravingFromFingerprint(fp) {
    const out = {
        key: null,
        keyProblem: '',
        treble: false,
        times: new Set(),
        pitches: null,
        heads: 0,
        problems: [],
    };
    const pages = (fp?.pages || []).filter((p) => p?.seq);
    const withLines = pages.every((p) => Array.isArray(p.staves));
    if (withLines) out.pitches = new Map();

    pages.forEach((page, pageIndex) => {
        const glyphs = [...page.seq].map((ch, i) => ({
            code: ch.codePointAt(0),
            x: page.x[i],
            y: page.y[i],
        }));
        let staves = withLines
            ? page.staves.map(([top, bottom]) => ({ top, bottom, gap: (bottom - top) / 4 }))
            : [];
        let estimated = false;
        if (!staves.length) {
            if (withLines) out.problems.push(`Seite ${pageIndex + 1} ohne erkannte Notenzeilen`);
            if (pageIndex === 0) {
                staves = fallbackFirstStaff(glyphs);
                estimated = staves.length > 0;
            }
        }
        const onStaff = staves.map(() => []);
        for (const g of glyphs) {
            if (!staves.length) break;
            // Das geschätzte System ist das einzige bekannte – ohne Grenze fielen
            // ihm die Zeichen ALLER Systeme zu, und die Vorzeichen jeder Zeile
            // zählten zur Tonart.
            if (estimated && !withinStaff(g.y, staves[0])) continue;
            onStaff[nearestStaff(g.y, staves)].push(g);
        }

        staves.forEach((staff, staffIndex) => {
            const list = onStaff[staffIndex];
            if (pageIndex === 0 && staffIndex === 0) {
                out.treble = list.some((g) => g.code === GCLEF);
                const key = keySignature(list);
                out.key = key.key;
                out.keyProblem = key.problem;
            }
            // Ohne echte Notenlinien kennt man nur das erste System – dessen
            // Taktangabe ist dann alles, was sich lesen lässt.
            for (const t of timeSignatures(list, staff)) out.times.add(t);
            if (out.pitches) addPitches(out, list, staff, staffIndex);
        });
        out.heads += glyphs.filter((g) => NOTEHEADS.has(g.code)).length;
    });
    return out;
}

function fallbackFirstStaff(glyphs) {
    const clef = glyphs.find((g) => g.code === GCLEF);
    if (!clef) return [];
    const bottom = clef.y + FALLBACK_LINE_GAP;
    return [{ top: bottom - 4 * FALLBACK_LINE_GAP, bottom, gap: FALLBACK_LINE_GAP }];
}

// Liegt y im System oder knapp darüber/darunter (zwei Hilfslinien)?
function withinStaff(y, staff) {
    return y >= staff.top - 2 * staff.gap && y <= staff.bottom + 2 * staff.gap;
}

function nearestStaff(y, staves) {
    let best = 0;
    let bestDist = Infinity;
    staves.forEach((s, i) => {
        const d = Math.abs(y - (s.top + s.bottom) / 2);
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
    });
    return best;
}

function keySignature(glyphs) {
    const clefs = glyphs.filter((g) => g.code === GCLEF).map((g) => g.x);
    if (!clefs.length) return { key: null, problem: 'kein Violinschlüssel am Anfang' };
    const start = Math.min(...clefs);
    const digits = glyphs
        .filter((g) => g.code >= TIME_DIGIT_MIN && g.code <= TIME_DIGIT_MAX)
        .map((g) => g.x);
    const heads = glyphs.filter((g) => NOTEHEADS.has(g.code)).map((g) => g.x);
    const end = digits.length
        ? Math.min(...digits)
        : (heads.length ? Math.min(...heads) : Infinity) - ACCIDENTAL_GAP_MAX;
    const signs = glyphs.filter((g) => g.x > start && g.x < end).map((g) => g.code);
    const sharps = signs.filter((c) => c === SHARP).length;
    const flats = signs.filter((c) => c === FLAT).length;
    if (sharps && flats) {
        return { key: null, problem: `Vorzeichen gemischt (${sharps} ♯, ${flats} ♭)` };
    }
    return { key: sharps - flats, problem: '' };
}

// Jede gedruckte Taktangabe eines Systems als 'Zähler/Nenner'.
function timeSignatures(glyphs, staff) {
    const middle = (staff.top + staff.bottom) / 2;
    const digits = glyphs
        .filter((g) => g.code >= TIME_DIGIT_MIN && g.code <= TIME_DIGIT_MAX)
        .sort((a, b) => a.x - b.x);
    const columns = [];
    for (const d of digits) {
        const last = columns[columns.length - 1];
        if (last && d.x - last[0].x <= TIME_COLUMN_GAP) last.push(d);
        else columns.push([d]);
    }
    const out = [];
    for (const column of columns) {
        const digit = (g) => String(g.code - TIME_DIGIT_MIN);
        const top = column
            .filter((g) => g.y < middle)
            .map(digit)
            .join('');
        const bottom = column
            .filter((g) => g.y >= middle)
            .map(digit)
            .join('');
        if (top && bottom) out.push(`${Number(top)}/${Number(bottom)}`);
    }
    return out;
}

function addPitches(out, glyphs, staff, staffIndex) {
    const halfSpace = staff.gap / 2;
    for (const g of glyphs) {
        if (!NOTEHEADS.has(g.code)) continue;
        const steps = (staff.bottom - g.y) / halfSpace;
        if (Math.abs(steps - Math.round(steps)) > STEP_TOLERANCE) {
            out.problems.push(
                `Notenkopf in System ${staffIndex + 1} steht zwischen Linie und ` +
                    `Zwischenraum (${steps.toFixed(2)} Halbabstände)`,
            );
            continue;
        }
        countInto(out.pitches, GCLEF_BOTTOM_LINE + Math.round(steps));
    }
}

// --- MusicXML ----------------------------------------------------------------

// Tonart, Taktarten und gedruckte Tonhöhen einer MusicXML (als Text).
//
// Bewusst ohne DOM: musx2mxl schreibt die Dateien maschinell und gleichförmig,
// und so läuft dieselbe Auswertung im Browser, in den Tests und im Abgleich
// gegen gb-scripts. Gezählt wird wie in notenmap.read_score: jede `<note>` mit
// Tonhöhe, außer Pausen und Unsichtbarem.
export function readMusicXml(text) {
    const pitches = new Map();
    const partRe = /<part(?:\s[^>]*)?>([\s\S]*?)<\/part>/g;
    const noteRe = /<note\b([^>]*)>([\s\S]*?)<\/note>/g;
    for (const part of text.matchAll(partRe)) {
        for (const note of part[1].matchAll(noteRe)) {
            const [, attrs, body] = note;
            if (/<rest\b/.test(body) || /print-object\s*=\s*"no"/.test(attrs)) continue;
            const pitch = /<pitch>([\s\S]*?)<\/pitch>/.exec(body);
            if (!pitch) continue;
            const step = /<step>\s*([A-G])\s*<\/step>/.exec(pitch[1])?.[1] || 'C';
            const octave = Number(/<octave>\s*(-?\d+)\s*<\/octave>/.exec(pitch[1])?.[1] ?? 4);
            countInto(pitches, octave * 7 + STEPS.indexOf(step));
        }
    }

    const fifths = /<key\b[^>]*>[\s\S]*?<fifths>\s*(-?\d+)\s*<\/fifths>/.exec(text);
    const times = new Set();
    for (const t of text.matchAll(/<time\b[^>]*>([\s\S]*?)<\/time>/g)) {
        const beats = /<beats>\s*(\d+)\s*<\/beats>/.exec(t[1])?.[1];
        const beatType = /<beat-type>\s*(\d+)\s*<\/beat-type>/.exec(t[1])?.[1];
        if (beats && beatType && REAL_BEAT_TYPES.has(Number(beatType))) {
            times.add(`${Number(beats)}/${Number(beatType)}`);
        }
    }
    const otherClefs = new Set();
    for (const c of text.matchAll(/<clef\b[^>]*>([\s\S]*?)<\/clef>/g)) {
        const sign = /<sign>\s*(\w+)\s*<\/sign>/.exec(c[1])?.[1] || '';
        const line = /<line>\s*(\d+)\s*<\/line>/.exec(c[1])?.[1] || '';
        const octave = /<clef-octave-change>\s*(-?\d+)\s*<\/clef-octave-change>/.exec(c[1])?.[1];
        if (sign !== 'G' || line !== '2' || (octave && octave !== '0')) {
            otherClefs.add(`${sign}${line}${octave ? ` ${octave}` : ''}`);
        }
    }
    return {
        key: fifths ? Number(fifths[1]) : null,
        times,
        pitches,
        otherClefs: [...otherClefs].sort(),
    };
}

// --- Vergleich ----------------------------------------------------------------

// Die Unterschiede zwischen PDF und MusicXML als [{ text, sperrt }], leer wenn
// sie zusammenpassen. `sperrt`: Die MusicXML beschreibt einen anderen Notensatz.
// Was nur „nicht prüfbar" oder „gleiche Melodie, andere Oktave" sagt, sperrt
// nicht.
export function compareAbgleich(engraving, score) {
    const out = [];
    const befund = (text, sperrt = true) => out.push({ text, sperrt });

    if (engraving.keyProblem) befund(`Tonart im PDF nicht lesbar: ${engraving.keyProblem}`, false);
    else if (score.key === null) befund('MusicXML hat keine Tonart');
    else if (engraving.key !== score.key) {
        befund(`Tonart: PDF ${keyName(engraving.key)}, MusicXML ${keyName(score.key)}`);
    }

    const missing = sortTimes([...engraving.times].filter((t) => !score.times.has(t)));
    if (missing.length) {
        befund(
            `Taktart: PDF zeigt ${missing.join(', ')}, MusicXML hat ` +
                (sortTimes([...score.times]).join(', ') || 'keine'),
        );
    }

    for (const p of engraving.problems) befund(p, false);
    const scoreTotal = total(score.pitches);
    if (!engraving.pitches) {
        // Ohne Notenlinien bleibt die Zahl der Notenköpfe als Prüfung.
        if (engraving.heads !== scoreTotal) {
            befund(`Notenzahl: PDF ${engraving.heads} Notenköpfe, MusicXML ${scoreTotal} Noten`);
        }
        befund(
            'Tonhöhen nicht geprüft: Der Notensatz-Fingerabdruck hat noch keine ' +
                'Notenlinien (unter „Notensatz-Fingerabdrücke" neu berechnen)',
            false,
        );
    } else if (!engraving.treble) {
        befund('Tonhöhen nicht prüfbar: PDF beginnt nicht mit Violinschlüssel', false);
    } else if (score.otherClefs.length) {
        befund(`Tonhöhen nicht prüfbar: MusicXML nutzt ${score.otherClefs.join(', ')}`, false);
    } else if (!sameCounts(engraving.pitches, score.pitches)) {
        out.push(pitchDifference(engraving.pitches, score.pitches));
    }
    return out;
}

// '3/4' vor '4/4' vor '12/8' – nach Zahlen, nicht nach Text.
function sortTimes(times) {
    const parts = (t) => t.split('/').map(Number);
    return times.sort((a, b) => {
        const [ab, at] = parts(a);
        const [bb, bt] = parts(b);
        return ab - bb || at - bt;
    });
}

function keyName(fifths) {
    if (!fifths) return 'ohne Vorzeichen';
    return `${Math.abs(fifths)} ${fifths > 0 ? '♯' : '♭'}`;
}

function total(map) {
    let n = 0;
    for (const v of map.values()) n += v;
    return n;
}

function sameCounts(a, b) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (b.get(k) !== v) return false;
    return true;
}

function shifted(map, by) {
    return new Map([...map].map(([k, v]) => [k + by, v]));
}

function pitchDifference(engraved, score) {
    const totalPdf = total(engraved);
    const totalXml = total(score);
    const head = `Tonhöhen: PDF ${totalPdf} Noten, MusicXML ${totalXml}`;

    // Dieselbe Melodie ein paar Stufen höher/tiefer verdient einen Namen. Eine
    // glatte Oktave erzeugt app/31 bei manchen Finale-Dateien – die Melodie
    // stimmt, die Notenkarte auch, also kein Sperrgrund. Jede andere
    // Verschiebung ist ein Notensatz in anderer Tonart.
    if (totalPdf === totalXml) {
        for (let by = -7; by <= 7; by++) {
            if (!by || !sameCounts(shifted(score, by), engraved)) continue;
            const richtung = by > 0 ? 'höher' : 'tiefer';
            if (Math.abs(by) === 7) {
                return {
                    text: `${head} — das PDF steht durchgehend eine Oktave ${richtung}, die Melodie ist gleich`,
                    sperrt: false,
                };
            }
            return {
                text: `${head} — das PDF steht durchgehend ${Math.abs(by)} Stufe(n) ${richtung} (anders transponiert)`,
                sperrt: true,
            };
        }
    }

    const detail = [];
    const more = difference(engraved, score);
    const less = difference(score, engraved);
    if (more.size) detail.push(`nur im PDF: ${pitchList(more)}`);
    if (less.size) detail.push(`nur in MusicXML: ${pitchList(less)}`);
    return { text: `${head} — ${detail.join('; ')}`, sperrt: true };
}

function difference(a, b) {
    const out = new Map();
    for (const [k, v] of a) {
        const d = v - (b.get(k) || 0);
        if (d > 0) out.set(k, d);
    }
    return out;
}

function pitchList(map, limit = 6) {
    const items = [...map].sort((a, b) => a[0] - b[0]);
    let text = items
        .slice(0, limit)
        .map(([p, n]) => `${n}× ${pitchName(p)}`)
        .join(', ');
    if (items.length > limit) text += ` (+${items.length - limit} weitere)`;
    return text;
}
