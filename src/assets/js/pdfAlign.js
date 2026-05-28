// PDF-driven SVG lyric alignment.
//
// Finale exports lyric text as image stamps in the PDF (each syllable is its
// own raster patch with an explicit position), but as <text> elements in the
// SVG — and the SVG positions drift horizontally relative to the PDF. The PDF
// stamp positions are what the engraver actually intended, so we use them as
// the source of truth: project each stamp into SVG coords, match it to its
// SVG <text>, and rewrite the SVG x so the glyph center sits on the stamp
// center.
//
// Public API:
//   analyzePdfAlignment(svgString, pdfArrayBuffer) →
//     { corrections, report }
//
// `corrections` is a Map<lyricId, newX> compatible with
// lyricsAlign.applyCorrections.

import pako from 'pako';
import { analyzeLyrics } from '@/assets/js/lyricsAlign.js';

// -----------------------------------------------------------------------------
// PDF parsing
// -----------------------------------------------------------------------------

// We use pako rather than the browser's native DecompressionStream because
// Chrome rejects PDF FlateDecode streams with "incorrect data check" — it's
// strict about Adler-32 in a way that node's zlib (and pako) are lenient
// about. PDFs in the wild routinely trigger that, so DecompressionStream is
// effectively unusable here.

function extractDecodedStreams(pdfBytes) {
    // Decode the whole PDF as latin-1 so byte offsets == string indices and we
    // can use a regex to find each `... /Length N ... stream\n` pair. Then we
    // slice the original byte buffer (NOT the latin-1 string) so binary data
    // stays exactly intact for the inflater.
    const decoder = new TextDecoder('iso-8859-1');
    const text = decoder.decode(pdfBytes);
    const out = [];
    const streamKw = /stream(\r\n|\n)/g;
    let m;
    while ((m = streamKw.exec(text)) !== null) {
        // The stream length comes from the dictionary right before `stream`.
        // We prefer the explicit /Length N value (PDF spec mandates it) over
        // scanning for `\nendstream`, because compressed binary occasionally
        // contains the bytes for "endstream" by chance and a regex-based
        // approach overshoots into the next object.
        const lookback = text.slice(Math.max(0, m.index - 800), m.index);
        const lenMatches = [...lookback.matchAll(/\/Length\s+(\d+)(?!\s+\d+\s+R)/g)];
        if (lenMatches.length === 0) continue;
        const length = parseInt(lenMatches[lenMatches.length - 1][1], 10);
        const bodyStart = m.index + m[0].length;
        const bodyEnd = bodyStart + length;
        if (bodyEnd > pdfBytes.length) continue;
        const bodyBytes = pdfBytes.subarray(bodyStart, bodyEnd);
        try {
            const inflated = pako.inflate(bodyBytes);
            out.push(decoder.decode(inflated));
        } catch {
            // Not a FlateDecode stream, or genuinely corrupt. Skip silently;
            // the page content stream will still be among the ones that do
            // inflate.
        }
        // Skip past the stream body so the next `stream\n` we match is the
        // next real object, not a substring inside binary content.
        streamKw.lastIndex = bodyEnd;
    }
    return out;
}

function findPageStream(streams) {
    return streams.find((s) => s.includes(' cm') && s.includes(' Do'));
}

// Walk the content stream pulling out image placements and stroked lines.
// We only handle the operators we need; everything else just resets the
// operand stack.
function parseContentStream(stream) {
    const stamps = [];
    const hLines = [];
    let stack = [];
    let lastCm = null;
    let pendingLine = null;
    let lastM = null;

    const tokens = stream.split(/\s+/);
    for (const tok of tokens) {
        if (!tok) continue;
        if (/^-?\d+(\.\d+)?$/.test(tok) || /^-?\.\d+$/.test(tok)) {
            stack.push(parseFloat(tok));
            continue;
        }
        switch (tok) {
            case 'cm':
                if (stack.length >= 6) {
                    const [a, b, c, d, e, f] = stack.slice(-6);
                    lastCm = { a, b, c, d, e, f };
                }
                stack = [];
                break;
            case 'Do':
                if (lastCm) {
                    // Image cm is `w 0 0 -h x y` in a top-down content frame
                    // (the master `0.75 0 0 -0.75 0 612 cm` flips PDF native
                    // bottom-up Y). Under that, image-local (0,0) maps to
                    // (x, y) (bottom of stamp) and (0, 1) to (x, y - h)
                    // (top). So the stamp rect spans top = y - h to bottom
                    // = y. We store the top edge so consumers can do center =
                    // y + h/2.
                    stamps.push({
                        x: lastCm.e,
                        y: lastCm.f - -lastCm.d, // top edge in top-down coords
                        w: lastCm.a,
                        h: -lastCm.d,
                    });
                }
                stack = [];
                lastCm = null;
                break;
            case 'm':
                if (stack.length >= 2) {
                    lastM = [stack[stack.length - 2], stack[stack.length - 1]];
                }
                stack = [];
                break;
            case 'l':
                if (lastM && stack.length >= 2) {
                    const x1 = lastM[0];
                    const y1 = lastM[1];
                    const x2 = stack[stack.length - 2];
                    const y2 = stack[stack.length - 1];
                    pendingLine = { x1, y1, x2, y2 };
                    lastM = [x2, y2];
                }
                stack = [];
                break;
            case 'S':
            case 's':
                if (pendingLine) {
                    const { x1, y1, x2, y2 } = pendingLine;
                    if (Math.abs(y1 - y2) < 0.01 && Math.abs(x1 - x2) > 0.5) {
                        hLines.push({
                            x1: Math.min(x1, x2),
                            x2: Math.max(x1, x2),
                            y: y1,
                        });
                    }
                }
                pendingLine = null;
                stack = [];
                break;
            case 'W':
            case 'W*':
            case 'n':
            case 'h':
                pendingLine = null;
                stack = [];
                break;
            default:
                stack = [];
        }
    }
    return { stamps, hLines };
}

// -----------------------------------------------------------------------------
// SVG side — staff lines only (lyric extraction is delegated to analyzeLyrics)
// -----------------------------------------------------------------------------

function extractSvgHLines(svgString) {
    const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    if (doc.querySelector('parsererror')) {
        throw new Error('SVG konnte nicht geparst werden');
    }
    const out = [];
    for (const el of doc.querySelectorAll('line')) {
        const x1 = parseFloat(el.getAttribute('x1'));
        const y1 = parseFloat(el.getAttribute('y1'));
        const x2 = parseFloat(el.getAttribute('x2'));
        const y2 = parseFloat(el.getAttribute('y2'));
        if ([x1, y1, x2, y2].some((v) => !Number.isFinite(v))) continue;
        if (Math.abs(y1 - y2) < 0.01 && Math.abs(x1 - x2) > 0.5) {
            out.push({ x1: Math.min(x1, x2), x2: Math.max(x1, x2), y: y1 });
        }
    }
    return out;
}

// -----------------------------------------------------------------------------
// Calibration: fit PDF-coords → SVG-coords from horizontal staff lines.
// -----------------------------------------------------------------------------

function fitLinear(pts) {
    const n = pts.length;
    const sumX = pts.reduce((a, [x]) => a + x, 0);
    const sumY = pts.reduce((a, [, y]) => a + y, 0);
    const sumXX = pts.reduce((a, [x]) => a + x * x, 0);
    const sumXY = pts.reduce((a, [x, y]) => a + x * y, 0);
    const denom = n * sumXX - sumX * sumX;
    const s = (n * sumXY - sumX * sumY) / denom;
    const t = (sumY - s * sumX) / n;
    return { s, t };
}

function calibrate(pdfHLines, svgHLines) {
    const pdfSorted = [...pdfHLines].sort((a, b) => a.y - b.y || a.x1 - b.x1);
    const svgSorted = [...svgHLines].sort((a, b) => a.y - b.y || a.x1 - b.x1);
    if (pdfSorted.length === 0 || svgSorted.length === 0) {
        throw new Error('Keine Notenlinien für die Kalibrierung gefunden');
    }
    const pairs = [];
    if (pdfSorted.length === svgSorted.length) {
        for (let i = 0; i < pdfSorted.length; i++) pairs.push([pdfSorted[i], svgSorted[i]]);
    } else {
        // Fallback: use the longest line in each as the single anchor.
        const longestPdf = pdfSorted.reduce((a, b) => (b.x2 - b.x1 > a.x2 - a.x1 ? b : a));
        const longestSvg = svgSorted.reduce((a, b) => (b.x2 - b.x1 > a.x2 - a.x1 ? b : a));
        pairs.push([longestPdf, longestSvg]);
    }
    const X = [];
    const Y = [];
    for (const [p, s] of pairs) {
        X.push([p.x1, s.x1], [p.x2, s.x2]);
        Y.push([p.y, s.y]);
    }
    const { s: sx, t: tx } = fitLinear(X);
    const { s: sy, t: ty } = fitLinear(Y);
    return {
        sx,
        tx,
        sy,
        ty,
        pdfHCount: pdfHLines.length,
        svgHCount: svgHLines.length,
        pairCount: pairs.length,
        project: (x, y) => ({ x: sx * x + tx, y: sy * y + ty }),
    };
}

// -----------------------------------------------------------------------------
// Matching: cluster rows by y on both sides, pair rows by sorted index, then
// within each row pair stamps to lyrics by sorted x. Row-by-row matching is
// robust against close-neighbour swaps that a single-pass nearest-neighbour
// matcher would make.
// -----------------------------------------------------------------------------

const ROW_TOL = 3; // SVG units — well under the typical row spacing (~11)

function clusterRows(items, getY) {
    const sorted = [...items].sort((a, b) => getY(a) - getY(b));
    const rows = [];
    for (const it of sorted) {
        const y = getY(it);
        const last = rows[rows.length - 1];
        if (last && Math.abs(y - last.meanY) <= ROW_TOL) {
            last.items.push(it);
            last.meanY = (last.meanY * (last.items.length - 1) + y) / last.items.length;
        } else {
            rows.push({ meanY: y, items: [it] });
        }
    }
    return rows;
}

function matchRows(stamps, lyrics, transform) {
    // We need an `advance` per lyric to compute its bbox center; the
    // analyzeLyrics output gives us that.
    const projected = stamps.map((s) => {
        const center = transform.project(s.x + s.w / 2, s.y + s.h / 2);
        return { ...s, projCx: center.x, projCy: center.y };
    });
    const stampRows = clusterRows(projected, (p) => p.projCy);
    const lyricRows = clusterRows(lyrics, (l) => l.y);

    const rowPairs = [];
    if (stampRows.length === lyricRows.length) {
        for (let i = 0; i < stampRows.length; i++) {
            rowPairs.push({
                stampRow: stampRows[i],
                lyricRow: lyricRows[i],
                dy: stampRows[i].meanY - lyricRows[i].meanY,
            });
        }
    } else {
        // Fallback: greedy by smallest |dy|. Less reliable; we surface a
        // warning so the upload UI can flag it.
        const cands = [];
        for (let li = 0; li < lyricRows.length; li++)
            for (let si = 0; si < stampRows.length; si++)
                cands.push({ li, si, dy: stampRows[si].meanY - lyricRows[li].meanY });
        cands.sort((a, b) => Math.abs(a.dy) - Math.abs(b.dy));
        const usedL = new Set(), usedS = new Set();
        for (const c of cands) {
            if (usedL.has(c.li) || usedS.has(c.si)) continue;
            if (Math.abs(c.dy) > 8) continue;
            usedL.add(c.li);
            usedS.add(c.si);
            rowPairs.push({ stampRow: stampRows[c.si], lyricRow: lyricRows[c.li], dy: c.dy });
        }
    }

    const matches = [];
    const usedStamp = new Set();
    const usedLyric = new Set();
    for (const { stampRow, lyricRow, dy } of rowPairs) {
        const sx = [...stampRow.items].sort((a, b) => a.projCx - b.projCx);
        const lx = [...lyricRow.items].sort((a, b) => a.x + a.advance / 2 - (b.x + b.advance / 2));
        if (sx.length === lx.length) {
            for (let k = 0; k < sx.length; k++) {
                matches.push({
                    stamp: sx[k],
                    lyric: lx[k],
                    dx: sx[k].projCx - (lx[k].x + lx[k].advance / 2),
                    dy,
                });
                usedStamp.add(sx[k]);
                usedLyric.add(lx[k]);
            }
        } else {
            // Counts differ — pair by smallest |dx|, with a tight cutoff so we
            // don't fabricate matches across positions Finale never engraved.
            const cands = [];
            for (const s of sx)
                for (const l of lx) {
                    const dx = s.projCx - (l.x + l.advance / 2);
                    cands.push({ s, l, dx });
                }
            cands.sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx));
            for (const c of cands) {
                if (usedStamp.has(c.s) || usedLyric.has(c.l)) continue;
                if (Math.abs(c.dx) > 15) continue;
                matches.push({ stamp: c.s, lyric: c.l, dx: c.dx, dy });
                usedStamp.add(c.s);
                usedLyric.add(c.l);
            }
        }
    }
    return { matches, rowPairs };
}

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

/**
 * Compute PDF-derived lyric x corrections for a Finale SVG / PDF pair.
 *
 * @param {string} svgString
 * @param {ArrayBuffer | Uint8Array} pdfBytes
 * @returns {Promise<{
 *   corrections: Map<string, number>,    // lyricId → new translate-x
 *   report: {
 *     transform: { sx, tx, sy, ty },
 *     stampCount, lyricCount, matchCount,
 *     rowMismatches: number,             // row-pairs where counts disagreed
 *     unmatchedLyrics: string[],         // lyric ids without a stamp
 *     changedCount: number,              // entries in corrections
 *     maxAbsDelta: number,
 *     details: Array<{ lyricId, text, oldX, newX, delta }>,
 *   },
 * }>}
 */
export async function analyzePdfAlignment(svgString, pdfBytes) {
    const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
    const streams = extractDecodedStreams(bytes);
    const pageStream = findPageStream(streams);
    if (!pageStream) throw new Error('Keine Seiten-Inhalt-Datenstrom im PDF gefunden');

    const { stamps, hLines: pdfHLines } = parseContentStream(pageStream);
    const svgHLines = extractSvgHLines(svgString);
    const transform = calibrate(pdfHLines, svgHLines);

    const { lyrics } = await analyzeLyrics(svgString);
    // Filter out structural punctuation / verse markers — Finale doesn't
    // stamp those in the PDF as separate images that align to noteheads.
    // Hyphens DO get stamped though, so we keep them; only true verse-number
    // markers are dropped.
    const matchableLyrics = lyrics.filter((l) => !l.isVerseMarker);

    const { matches, rowPairs } = matchRows(stamps, matchableLyrics, transform);

    const corrections = new Map();
    const details = [];
    let maxAbsDelta = 0;
    for (const m of matches) {
        const newX = m.stamp.projCx - m.lyric.advance / 2;
        const delta = newX - m.lyric.x;
        // Sub-pixel deltas are font-metric noise; skip those.
        if (Math.abs(delta) < 0.05) continue;
        corrections.set(m.lyric.id, newX);
        details.push({
            lyricId: m.lyric.id,
            text: m.lyric.text,
            oldX: m.lyric.x,
            newX,
            delta,
        });
        if (Math.abs(delta) > maxAbsDelta) maxAbsDelta = Math.abs(delta);
    }

    const matchedLyricIds = new Set(matches.map((m) => m.lyric.id));
    const unmatchedLyrics = matchableLyrics
        .filter((l) => !matchedLyricIds.has(l.id))
        .map((l) => l.id);

    const rowMismatches = rowPairs.filter(
        (r) => r.stampRow.items.length !== r.lyricRow.items.length,
    ).length;

    return {
        corrections,
        report: {
            transform: {
                sx: transform.sx,
                tx: transform.tx,
                sy: transform.sy,
                ty: transform.ty,
            },
            stampCount: stamps.length,
            lyricCount: lyrics.length,
            matchableLyricCount: matchableLyrics.length,
            matchCount: matches.length,
            rowMismatches,
            unmatchedLyrics,
            changedCount: corrections.size,
            maxAbsDelta,
            details,
        },
    };
}
