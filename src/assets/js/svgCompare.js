import finaleMaestroUrl from '@/assets/font/FinaleMaestro.otf?url';
import optimaRomanUrl from '@/assets/font/lte500190.ttf?url';
import optimaBoldUrl from '@/assets/font/lte500210.ttf?url';
import optimaItalicUrl from '@/assets/font/lte524010.ttf?url';
import optimaBoldItalicUrl from '@/assets/font/lte543790.ttf?url';
import { bakeSvgString } from './svgBaker.js';

const FONT_VARIANTS = [
    { family: /finale|maestro/i, weight: 'normal', italic: false, url: finaleMaestroUrl, format: 'opentype' },
    { family: /optima/i, weight: 'normal', italic: false, url: optimaRomanUrl, format: 'truetype' },
    { family: /optima/i, weight: 'bold', italic: false, url: optimaBoldUrl, format: 'truetype' },
    { family: /optima/i, weight: 'normal', italic: true, url: optimaItalicUrl, format: 'truetype' },
    { family: /optima/i, weight: 'bold', italic: true, url: optimaBoldItalicUrl, format: 'truetype' },
];

const ALWAYS_AVAILABLE_FAMILIES = [
    'Finale Maestro',
    'FinaleMaestro',
    'Maestro',
    'Optima LT',
    'Optima LT Std',
    'OptimaLTStd',
    'Optima',
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

function collectFontFamilies(svg) {
    const names = new Set();
    const visit = (el) => {
        if (el.nodeType !== 1) return;
        const ff = el.getAttribute && el.getAttribute('font-family');
        if (ff) names.add(ff.trim().replace(/^["']|["']$/g, ''));
        const styleAttr = el.getAttribute && el.getAttribute('style');
        if (styleAttr) {
            const m = styleAttr.match(/font-family\s*:\s*([^;]+)/i);
            if (m) names.add(m[1].trim().replace(/^["']|["']$/g, ''));
        }
        el.childNodes && el.childNodes.forEach(visit);
    };
    visit(svg);
    return Array.from(names);
}

// Common local install names per font family, tried before the bundled OTF
// data URL. This makes the dialog render the original SVG using whatever
// the user has installed on their machine (matching the standalone browser
// view), and only fall back to our bundled font if it's missing.
const LOCAL_FONT_NAMES = {
    finale: ['Finale Maestro', 'FinaleMaestro', 'Maestro'],
    optima: ['Optima LT Std', 'OptimaLTStd', 'Optima LT', 'Optima'],
    optima_bold: ['Optima LT Std Bold', 'Optima Bold', 'Optima LT Bold'],
    optima_italic: ['Optima LT Std Italic', 'Optima Italic', 'Optima LT Italic'],
    optima_bold_italic: [
        'Optima LT Std Bold Italic',
        'Optima Bold Italic',
        'Optima LT Bold Italic',
    ],
};

function localNamesFor(variant) {
    const isFinale = variant.family.test('finale');
    if (isFinale) return LOCAL_FONT_NAMES.finale;
    const bold = variant.weight === 'bold';
    const italic = !!variant.italic;
    if (bold && italic) return LOCAL_FONT_NAMES.optima_bold_italic;
    if (bold) return LOCAL_FONT_NAMES.optima_bold;
    if (italic) return LOCAL_FONT_NAMES.optima_italic;
    return LOCAL_FONT_NAMES.optima;
}

async function buildFontFaceCss(familyNames) {
    const rules = [];
    const seen = new Set();
    const candidates = new Set([...familyNames, ...ALWAYS_AVAILABLE_FAMILIES]);
    for (const family of candidates) {
        for (const v of FONT_VARIANTS) {
            if (!v.family.test(family)) continue;
            const key = `${family}|${v.weight}|${v.italic}|${v.url}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const src = await fontDataUrl(v.url, v.format);
            const localSrcs = localNamesFor(v)
                .map((n) => `local("${n}")`)
                .join(', ');
            rules.push(
                `@font-face { font-family: "${family.replace(/"/g, '\\"')}"; ` +
                    `font-weight: ${v.weight}; font-style: ${v.italic ? 'italic' : 'normal'}; ` +
                    `src: ${localSrcs}, url(${src}) format("${v.format}"); ` +
                    `font-display: block; }`,
            );
        }
    }
    return rules.join('\n');
}

function stripSvgFonts(svg) {
    const SVG_FONT_TAGS = ['font', 'font-face', 'font-face-src', 'font-face-uri', 'font-face-name', 'font-face-format', 'missing-glyph', 'glyph', 'hkern', 'vkern'];
    SVG_FONT_TAGS.forEach((tag) => {
        const nodes = svg.getElementsByTagName(tag);
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            if (n.parentNode) n.parentNode.removeChild(n);
        }
    });
}

/**
 * Finale exports its SVGs with `style="position:absolute; top:0; left:0;"` on the
 * root <svg>. That layout instruction is meant for Finale's own viewer; when we
 * inline the SVG into the dialog it breaks out of normal flow and stacks both
 * panes on top of each other. Strip positional properties from the root style.
 */
function normalizeRootSvgStyle(svg) {
    const style = svg.getAttribute('style');
    if (!style) return;
    const filtered = style
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s && !/^(position|top|left|right|bottom)\s*:/i.test(s))
        .join('; ');
    if (filtered) {
        svg.setAttribute('style', filtered);
    } else {
        svg.removeAttribute('style');
    }
}

let documentFontsPromise = null;
export async function ensureCompareFonts() {
    if (typeof document === 'undefined' || !document.fonts) return;
    if (!documentFontsPromise) {
        documentFontsPromise = (async () => {
            for (const v of FONT_VARIANTS) {
                const src = await fontDataUrl(v.url, v.format);
                const localSrcs = localNamesFor(v)
                    .map((n) => `local("${n}")`)
                    .join(', ');
                for (const family of ALWAYS_AVAILABLE_FAMILIES) {
                    if (!v.family.test(family)) continue;
                    try {
                        const face = new FontFace(
                            family,
                            `${localSrcs}, url(${src})`,
                            {
                                weight: v.weight,
                                style: v.italic ? 'italic' : 'normal',
                                display: 'block',
                            },
                        );
                        await face.load();
                        document.fonts.add(face);
                    } catch (e) {
                        /* best-effort */
                    }
                }
            }
            try {
                await document.fonts.ready;
            } catch (e) {
                /* noop */
            }
        })();
    }
    return documentFontsPromise;
}

/**
 * Prepare the original (unbaked) SVG for inline DOM rendering:
 *  - strip DOCTYPE (W3C DTD lookup can stall the parser)
 *  - strip SVG-1.1 <font>/<glyph> elements (deprecated, can shadow @font-face)
 *  - normalize the root style (Finale's position:absolute would break layout)
 *  - inject @font-face declarations for all known font name variants so the SVG
 *    renders correctly regardless of which families the file references.
 */
export async function prepareOriginalSvgForDom(svgString) {
    const stripped = svgString.replace(/<!DOCTYPE[^>]*>/i, '');
    const parser = new DOMParser();
    const doc = parser.parseFromString(stripped, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('SVG konnte nicht geparst werden');
    const svg = doc.documentElement;
    stripSvgFonts(svg);
    normalizeRootSvgStyle(svg);

    const families = collectFontFamilies(svg);
    const css = await buildFontFaceCss(families);
    if (css) {
        const ns = 'http://www.w3.org/2000/svg';
        const style = doc.createElementNS(ns, 'style');
        style.setAttribute('type', 'text/css');
        style.textContent = css;
        svg.insertBefore(style, svg.firstChild);
    }
    return new XMLSerializer().serializeToString(svg);
}

/**
 * Prepare the baked SVG for inline DOM rendering. Same root-style normalization
 * as the original — the baker preserves Finale's inline position:absolute style.
 */
export function prepareBakedSvgForDom(svgString) {
    const stripped = svgString.replace(/<!DOCTYPE[^>]*>/i, '');
    const parser = new DOMParser();
    const doc = parser.parseFromString(stripped, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('SVG konnte nicht geparst werden');
    const svg = doc.documentElement;
    normalizeRootSvgStyle(svg);
    return new XMLSerializer().serializeToString(svg);
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
