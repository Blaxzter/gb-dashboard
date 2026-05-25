import * as opentype from 'opentype.js';
import finaleMaestroUrl from '@/assets/font/FinaleMaestro.otf?url';
import optimaRomanUrl from '@/assets/font/lte500190.ttf?url';

// SMuFL noteheads we treat as "anchor a syllable to"
// E0A0..E0A4 covers double whole, whole, half, quarter, and the "quarter alt"
const NOTEHEAD_GLYPHS = new Set([
    '\uE0A0', // double whole
    '\uE0A1', // whole
    '\uE0A2', // half (alt)
    '\uE0A3', // half
    '\uE0A4', // quarter/filled (most common Finale lyric anchor)
]);

// Finale consistently leaves a ~1.4-unit optical offset on many syllables we
// don't want to "fix" (capital-letter optical alignment quirks). 1.5 leaves
// those alone and only catches real misalignments (~3+ units).
const MISALIGN_THRESHOLD = 1.5;

// Two notes are part of the same staff/system if their y values are within
// this distance. Within one Finale staff a note's translate-y varies by the
// pitch range (~10 user units between top and bottom line + some).
const SYSTEM_Y_TOLERANCE = 12;

// Lyrics that are pure punctuation (especially hyphens between syllables) are
// not anchored to a notehead by Finale — they sit between syllables. We must
// not try to "center" them on a note.
function isStructuralPunctuation(text) {
    const t = text.trim();
    if (!t) return true;
    return /^[-‐‑‒–—_.\s]+$/.test(t);
}

// Trailing/leading punctuation we strip when computing where a syllable's
// optical center is. "Stadt," should center "Stadt" under the note — the
// comma hangs off to the right. Same for "Licht.", "all:", "Stall!" etc.
const TRAILING_PUNCT_RE = /[.,;:!?…„"'»«()\]\}]+$/;
const LEADING_PUNCT_RE = /^[.,;:!?…„"'»«()\[\{]+/;

function getOpticalSpan(text, fontSize, font) {
    const fullAdvance = font.getAdvanceWidth(text, fontSize);
    const leading = text.match(LEADING_PUNCT_RE)?.[0] || '';
    const trimmedLead = text.slice(leading.length);
    const trailing = trimmedLead.match(TRAILING_PUNCT_RE)?.[0] || '';
    const core = trimmedLead.slice(0, trimmedLead.length - trailing.length);
    if (!core) return { fullAdvance, leadingAdvance: 0, coreAdvance: fullAdvance };
    const leadingAdvance = leading ? font.getAdvanceWidth(leading, fontSize) : 0;
    const coreAdvance = font.getAdvanceWidth(core, fontSize);
    return { fullAdvance, leadingAdvance, coreAdvance };
}

let optimaPromise = null;
let finalePromise = null;
async function loadOptima() {
    if (!optimaPromise) {
        optimaPromise = fetch(optimaRomanUrl)
            .then((r) => r.arrayBuffer())
            .then((b) => opentype.parse(b));
    }
    return optimaPromise;
}
async function loadFinale() {
    if (!finalePromise) {
        finalePromise = fetch(finaleMaestroUrl)
            .then((r) => r.arrayBuffer())
            .then((b) => opentype.parse(b));
    }
    return finalePromise;
}

function parseTranslate(attr) {
    if (!attr) return null;
    const m = attr.match(/translate\s*\(\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)\s*\)/);
    if (!m) return null;
    return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

function familyMatches(family, re) {
    return !!family && re.test(family);
}

function readNumberAttr(el, name, fallback = 0) {
    const v = el.getAttribute(name);
    if (v === null || v === undefined || v === '') return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse the SVG and return notes + lyrics with computed alignment data.
 *
 * For each Optima LT text element, we find the nearest Finale Maestro notehead
 * directly above (smaller y) within a reasonable horizontal window. The lyric's
 * expectedX is what its `transform translate x` *should be* so the text's
 * center sits under the notehead's center.
 */
export async function analyzeLyrics(svgString) {
    const [optima, finale] = await Promise.all([loadOptima(), loadFinale()]);
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    if (doc.querySelector('parsererror')) {
        throw new Error('SVG konnte nicht geparst werden');
    }

    const texts = Array.from(doc.querySelectorAll('text'));
    const notes = [];
    const lyrics = [];
    let idCounter = 0;

    for (const t of texts) {
        const family = t.getAttribute('font-family') || '';
        const fontSize = readNumberAttr(t, 'font-size', 16);
        const trans = parseTranslate(t.getAttribute('transform')) || { x: 0, y: 0 };
        const x = trans.x + readNumberAttr(t, 'x', 0);
        const y = trans.y + readNumberAttr(t, 'y', 0);
        const text = t.textContent || '';

        if (familyMatches(family, /finale|maestro/i)) {
            if (text.length === 1 && NOTEHEAD_GLYPHS.has(text)) {
                const advance = finale.getAdvanceWidth(text, fontSize);
                notes.push({
                    id: `n${idCounter++}`,
                    el: t,
                    x,
                    y,
                    fontSize,
                    advance,
                    centerX: x + advance / 2,
                });
            }
        } else if (familyMatches(family, /optima/i)) {
            if (!text.trim()) continue;
            const { fullAdvance, leadingAdvance, coreAdvance } = getOpticalSpan(
                text,
                fontSize,
                optima,
            );
            lyrics.push({
                id: `l${idCounter++}`,
                el: t,
                text,
                x,
                y,
                fontSize,
                advance: fullAdvance,
                leadingAdvance,
                coreAdvance,
                centerX: x + fullAdvance / 2,
                isPunctuation: isStructuralPunctuation(text),
            });
        }
    }

    // Cluster notes by y into "systems" (one staff line each). Then for each
    // lyric, pick the system whose bottom is closest above the lyric, and
    // within that system find the note with the closest centerX.
    const sortedByY = [...notes].sort((a, b) => a.y - b.y);
    const systems = [];
    for (const n of sortedByY) {
        const last = systems[systems.length - 1];
        if (last && Math.abs(n.y - last.maxY) <= SYSTEM_Y_TOLERANCE) {
            last.notes.push(n);
            last.minY = Math.min(last.minY, n.y);
            last.maxY = Math.max(last.maxY, n.y);
        } else {
            systems.push({ notes: [n], minY: n.y, maxY: n.y });
        }
    }

    for (const l of lyrics) {
        // Punctuation (mostly hyphens between syllables) keeps its Finale
        // position untouched — Finale lays these out between notes, not on top
        // of them.
        if (l.isPunctuation) {
            l.noteId = null;
            l.expectedX = l.x;
            l.deviation = 0;
            l.misaligned = false;
            continue;
        }
        // Find the closest note in 2D, weighted heavier on the vertical axis
        // so we don't accidentally jump to a faraway system whose x lines up.
        // Pick the system whose bottom edge is closest *above* the lyric.
        let sys = null;
        let bestSysDy = Infinity;
        for (const s of systems) {
            if (s.maxY >= l.y) continue;
            const dy = l.y - s.maxY;
            if (dy < bestSysDy) {
                bestSysDy = dy;
                sys = s;
            }
        }
        let best = null;
        if (sys) {
            let bestDx = Infinity;
            for (const n of sys.notes) {
                const dx = Math.abs(n.centerX - l.centerX);
                if (dx < bestDx) {
                    bestDx = dx;
                    best = n;
                }
            }
        }
        if (!best) {
            l.noteId = null;
            l.expectedX = l.x;
            l.deviation = 0;
            l.misaligned = false;
            continue;
        }
        l.noteId = best.id;
        l.noteCenterX = best.centerX;
        // Center the "core" (alphabetic part, excluding trailing/leading
        // punctuation) under the notehead, not the full advance — so "Stadt,"
        // centers "Stadt" with the comma hanging off, not the whole "Stadt,".
        l.expectedX = best.centerX - l.leadingAdvance - l.coreAdvance / 2;
        l.deviation = l.x - l.expectedX;
        l.misaligned = Math.abs(l.deviation) > MISALIGN_THRESHOLD;
    }

    // Strip DOM refs before returning so the result is serializable.
    const cleanLyrics = lyrics.map((l) => ({
        id: l.id,
        text: l.text,
        x: l.x,
        y: l.y,
        fontSize: l.fontSize,
        advance: l.advance,
        centerX: l.centerX,
        noteId: l.noteId,
        noteCenterX: l.noteCenterX,
        expectedX: l.expectedX,
        deviation: l.deviation,
        misaligned: l.misaligned,
        isPunctuation: l.isPunctuation,
    }));
    const cleanNotes = notes.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        fontSize: n.fontSize,
        advance: n.advance,
        centerX: n.centerX,
    }));

    return {
        lyrics: cleanLyrics,
        notes: cleanNotes,
        misalignedCount: cleanLyrics.filter((l) => l.misaligned).length,
        totalLyrics: cleanLyrics.length,
    };
}

/**
 * Apply x corrections to the SVG. `corrections` is a Map (or object) of
 * lyricId → newX. We re-walk the SVG in the same order as analyzeLyrics so
 * IDs match. Returns the new SVG string.
 */
export async function applyCorrections(svgString, corrections) {
    const correctionsMap =
        corrections instanceof Map ? corrections : new Map(Object.entries(corrections));
    if (correctionsMap.size === 0) return svgString;

    await Promise.all([loadOptima(), loadFinale()]);
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    if (doc.querySelector('parsererror')) {
        throw new Error('SVG konnte nicht geparst werden');
    }

    const texts = Array.from(doc.querySelectorAll('text'));
    let idCounter = 0;

    for (const t of texts) {
        const family = t.getAttribute('font-family') || '';
        if (familyMatches(family, /finale|maestro/i)) {
            const text = t.textContent || '';
            if (text.length === 1 && NOTEHEAD_GLYPHS.has(text)) {
                idCounter++; // notes consume ids too
            }
            continue;
        }
        if (!familyMatches(family, /optima/i)) continue;
        const text = t.textContent || '';
        if (!text.trim()) continue;
        const id = `l${idCounter++}`;
        if (!correctionsMap.has(id)) continue;

        const newX = correctionsMap.get(id);
        const trans = parseTranslate(t.getAttribute('transform'));
        if (!trans) continue;
        t.setAttribute('transform', `translate(${newX.toFixed(3)},${trans.y})`);
    }

    return new XMLSerializer().serializeToString(doc);
}
