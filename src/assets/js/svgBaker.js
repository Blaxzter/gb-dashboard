import * as opentype from 'opentype.js';
import finaleMaestroUrl from '@/assets/font/FinaleMaestro.otf?url';
import optimaRomanUrl from '@/assets/font/lte500190.ttf?url';
import optimaBoldUrl from '@/assets/font/lte500210.ttf?url';
import optimaItalicUrl from '@/assets/font/lte524010.ttf?url';
import optimaBoldItalicUrl from '@/assets/font/lte543790.ttf?url';

const fontCache = {};

const FONTS = [
    { key: 'finale', family: /finale|maestro/i, url: finaleMaestroUrl },
    { key: 'optima', family: /optima/i, weight: 'normal', italic: false, url: optimaRomanUrl },
    { key: 'optima_bold', family: /optima/i, weight: 'bold', italic: false, url: optimaBoldUrl },
    { key: 'optima_italic', family: /optima/i, weight: 'normal', italic: true, url: optimaItalicUrl },
    {
        key: 'optima_bold_italic',
        family: /optima/i,
        weight: 'bold',
        italic: true,
        url: optimaBoldItalicUrl,
    },
];

async function loadFont(key, url) {
    if (fontCache[key]) return fontCache[key];
    const resp = await fetch(url);
    if (!resp.ok)
        throw new Error(`Schriftart "${key}" konnte nicht geladen werden (${resp.status})`);
    const buf = await resp.arrayBuffer();
    fontCache[key] = opentype.parse(buf);
    return fontCache[key];
}

export async function ensureAllFonts() {
    await Promise.all(FONTS.map((f) => loadFont(f.key, f.url)));
}

function isBoldWeight(weight) {
    if (!weight) return false;
    const s = String(weight).toLowerCase();
    if (/bold|heavy|black/.test(s)) return true;
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 600;
}

function pickFont(family, weight, style) {
    const bold = isBoldWeight(weight);
    const italic = /italic|oblique/i.test(style || '');
    let match = FONTS.find(
        (f) =>
            f.family.test(family || '') &&
            f.weight !== undefined &&
            (f.weight === 'bold') === bold &&
            (f.italic ?? false) === italic,
    );
    if (match) return fontCache[match.key];
    match = FONTS.find((f) => f.family.test(family || ''));
    return match ? fontCache[match.key] : null;
}

function isKnownFamily(family) {
    if (!family) return false;
    return FONTS.some((f) => f.family.test(family));
}

function readStyleProp(styleStr, prop) {
    if (!styleStr) return null;
    const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
    const m = styleStr.match(re);
    return m ? m[1].trim() : null;
}

function getInheritedAttr(el, attr) {
    let cur = el;
    while (cur && cur.nodeType === 1) {
        if (cur.getAttribute) {
            const v = cur.getAttribute(attr);
            if (v) return v;
            const fromStyle = readStyleProp(cur.getAttribute('style'), attr);
            if (fromStyle) return fromStyle;
        }
        cur = cur.parentNode;
    }
    return null;
}

function bakeTextElement(textEl, svgDoc) {
    const family = getInheritedAttr(textEl, 'font-family');
    if (!isKnownFamily(family)) return false;
    const weight = getInheritedAttr(textEl, 'font-weight');
    const style = getInheritedAttr(textEl, 'font-style');
    const font = pickFont(family, weight, style);
    if (!font) return false;

    const fontSizeRaw = getInheritedAttr(textEl, 'font-size') || '16';
    const fontSize = parseFloat(fontSizeRaw) || 16;
    const fill = getInheritedAttr(textEl, 'fill') || '#000';
    const anchor = getInheritedAttr(textEl, 'text-anchor') || 'start';

    const ns = 'http://www.w3.org/2000/svg';
    const replacement = svgDoc.createElementNS(ns, 'g');

    const transform = textEl.getAttribute('transform');
    if (transform) replacement.setAttribute('transform', transform);

    const tspans = textEl.querySelectorAll('tspan');
    const segments = [];
    if (tspans.length > 0) {
        tspans.forEach((ts) => {
            segments.push({
                text: ts.textContent || '',
                x: parseFloat(ts.getAttribute('x') ?? textEl.getAttribute('x') ?? '0') || 0,
                y: parseFloat(ts.getAttribute('y') ?? textEl.getAttribute('y') ?? '0') || 0,
            });
        });
    } else {
        segments.push({
            text: textEl.textContent || '',
            x: parseFloat(textEl.getAttribute('x') || '0') || 0,
            y: parseFloat(textEl.getAttribute('y') || '0') || 0,
        });
    }

    segments.forEach((seg) => {
        if (!seg.text) return;
        let drawX = seg.x;
        if (anchor === 'middle' || anchor === 'end') {
            const advance = font.getAdvanceWidth(seg.text, fontSize);
            drawX = anchor === 'middle' ? seg.x - advance / 2 : seg.x - advance;
        }
        const path = font.getPath(seg.text, drawX, seg.y, fontSize);
        const d = path.toPathData(3);
        if (!d) return;
        const pathEl = svgDoc.createElementNS(ns, 'path');
        pathEl.setAttribute('d', d);
        pathEl.setAttribute('fill', fill);
        replacement.appendChild(pathEl);
    });

    textEl.parentNode.replaceChild(replacement, textEl);
    return true;
}

export function bakeSvg(svgString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) throw new Error('SVG konnte nicht geparst werden');

    const svg = doc.documentElement;
    const texts = Array.from(svg.querySelectorAll('text'));
    let baked = 0;
    texts.forEach((t) => {
        try {
            if (bakeTextElement(t, doc)) baked++;
        } catch (e) {
            console.warn('Text element konnte nicht umgewandelt werden', e);
        }
    });

    return { svg, doc, bakedCount: baked, totalTexts: texts.length };
}

export function serializeSvg(svgEl) {
    return new XMLSerializer().serializeToString(svgEl);
}

export async function bakeSvgString(svgString) {
    await ensureAllFonts();
    const { svg, bakedCount, totalTexts } = bakeSvg(svgString);
    return { svgString: serializeSvg(svg), svgEl: svg, bakedCount, totalTexts };
}
