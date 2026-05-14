import finaleMaestroUrl from '@/assets/font/FinaleMaestro.otf?url';
import optimaRomanUrl from '@/assets/font/lte500190.ttf?url';
import optimaBoldUrl from '@/assets/font/lte500210.ttf?url';
import optimaItalicUrl from '@/assets/font/lte524010.ttf?url';
import optimaBoldItalicUrl from '@/assets/font/lte543790.ttf?url';
import { bakeSvgString } from './svgBaker.js';

// Each bundled font registered under every plausible family name Finale may
// have used (e.g. `'Optima LT'`, `'Optima LT Std'`, etc.) so the SVG's
// font-family lookup hits us regardless of how the file declares the family.
const FONT_BUNDLE = [
    {
        url: finaleMaestroUrl,
        format: 'opentype',
        weight: 'normal',
        italic: false,
        families: ['Finale Maestro', 'FinaleMaestro', 'Maestro'],
    },
    {
        url: optimaRomanUrl,
        format: 'truetype',
        weight: 'normal',
        italic: false,
        families: ['Optima LT', 'Optima LT Std', 'OptimaLTStd', 'OptimaLT'],
    },
    {
        url: optimaBoldUrl,
        format: 'truetype',
        weight: 'bold',
        italic: false,
        families: ['Optima LT', 'Optima LT Std', 'OptimaLTStd', 'OptimaLT'],
    },
    {
        url: optimaItalicUrl,
        format: 'truetype',
        weight: 'normal',
        italic: true,
        families: ['Optima LT', 'Optima LT Std', 'OptimaLTStd', 'OptimaLT'],
    },
    {
        url: optimaBoldItalicUrl,
        format: 'truetype',
        weight: 'bold',
        italic: true,
        families: ['Optima LT', 'Optima LT Std', 'OptimaLTStd', 'OptimaLT'],
    },
];

const dataUrlCache = new Map();
async function fontDataUrl(url, format) {
    if (dataUrlCache.has(url)) return dataUrlCache.get(url);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Schrift konnte nicht geladen werden (${resp.status})`);
    const buf = await resp.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    const b64 = btoa(binary);
    const dataUrl = `data:font/${format};base64,${b64}`;
    dataUrlCache.set(url, dataUrl);
    return dataUrl;
}

let fontFaceCssPromise = null;
async function buildFontFaceCss() {
    if (fontFaceCssPromise) return fontFaceCssPromise;
    fontFaceCssPromise = (async () => {
        const rules = [];
        for (const variant of FONT_BUNDLE) {
            const src = await fontDataUrl(variant.url, variant.format);
            for (const family of variant.families) {
                rules.push(
                    `@font-face { font-family: "${family}"; ` +
                        `font-weight: ${variant.weight}; ` +
                        `font-style: ${variant.italic ? 'italic' : 'normal'}; ` +
                        `src: url(${src}) format("${variant.format}"); ` +
                        `font-display: block; }`,
                );
            }
        }
        return rules.join('\n');
    })();
    return fontFaceCssPromise;
}

// No-op: kept as a stable export so callers don't have to change.
export function ensureCompareFonts() {
    return Promise.resolve();
}

/**
 * Prepare the original SVG for rendering via <img src=blob:...>.
 *
 * A SVG inside <img> renders in an isolated context and can NOT see the host
 * document's @font-face / FontFace registry — so we inject a <style> block
 * INSIDE the SVG itself with @font-face declarations pointing at our bundled
 * Finale Maestro / Optima LT files (as data: URLs). This is the exact same
 * font the baker uses (opentype.js operates on the same files), so the
 * "Original" pane uses the same font the bake will produce paths from, which
 * is the comparison the user actually cares about.
 *
 * Note: we intentionally DON'T strip the SVG-1.1 <font>/<glyph> block — some
 * browsers (Safari) still use it, and our @font-face takes precedence.
 */
export async function prepareOriginalSvgForDom(svgString) {
    const stripped = svgString.replace(/<!DOCTYPE[^>]*>/i, '');
    const parser = new DOMParser();
    const doc = parser.parseFromString(stripped, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('SVG konnte nicht geparst werden');
    const svg = doc.documentElement;

    const css = await buildFontFaceCss();
    if (css) {
        const ns = 'http://www.w3.org/2000/svg';
        const style = doc.createElementNS(ns, 'style');
        style.setAttribute('type', 'text/css');
        style.textContent = css;
        svg.insertBefore(style, svg.firstChild);
    }
    return new XMLSerializer().serializeToString(svg);
}

// The baked SVG already contains paths (no font resolution needed) — pass through.
export function prepareBakedSvgForDom(svgString) {
    return svgString;
}

export function bakeSeverity(bakedCount, totalTexts) {
    if (totalTexts === 0) {
        return { level: 'ok', color: 'success', label: 'Keine Texte' };
    }
    if (bakedCount === totalTexts) {
        return { level: 'ok', color: 'success', label: 'Alle Texte gebacken' };
    }
    if (bakedCount === 0) {
        return { level: 'fail', color: 'error', label: 'Keine Texte gebacken' };
    }
    return { level: 'warn', color: 'warning', label: 'Texte teilweise gebacken' };
}

/**
 * Lightweight scan: bakes the SVG and reports coverage. No rasterization —
 * pixel-diff comparisons of SVG text vs opentype.js paths produce false
 * positives from font-engine vs path-generation rounding differences.
 */
export async function scanSvgBake(file) {
    const text = await file.text();
    const baked = await bakeSvgString(text);
    const coverage = baked.totalTexts > 0 ? baked.bakedCount / baked.totalTexts : 1;
    return {
        bakedCount: baked.bakedCount,
        totalTexts: baked.totalTexts,
        coverage,
        severity: bakeSeverity(baked.bakedCount, baked.totalTexts),
    };
}
