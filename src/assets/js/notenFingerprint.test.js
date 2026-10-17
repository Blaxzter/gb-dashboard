import { describe, it, expect } from 'vitest';
import { isMusicGlyphString, splitStackedPlacement } from '@/assets/js/notenFingerprint';

// U+E000..U+F8FF = Private Use Area (dort liegt der Notensatz-Font). Wir
// erzeugen die Glyphen über Codepoints, um keine unsichtbaren PUA-Zeichen im
// Quelltext zu haben.
const glyph = (cp) => String.fromCodePoint(cp);
const G1 = glyph(0xe000);
const G2 = glyph(0xf123);

describe('isMusicGlyphString', () => {
    it('true wenn alle Zeichen im Private-Use-Bereich liegen', () => {
        expect(isMusicGlyphString(G1 + G2)).toBe(true);
    });
    it('ignoriert Whitespace zwischen den Glyphen', () => {
        expect(isMusicGlyphString(G1 + ' ' + G2)).toBe(true);
    });
    it('false bei normalem Text oder Mischung mit Nicht-PUA', () => {
        expect(isMusicGlyphString('abc')).toBe(false);
        expect(isMusicGlyphString(G1 + 'x')).toBe(false);
    });
    it('false bei leer oder nur Whitespace', () => {
        expect(isMusicGlyphString('')).toBe(false);
        expect(isMusicGlyphString('   ')).toBe(false);
        expect(isMusicGlyphString(null)).toBe(false);
    });
});

describe('splitStackedPlacement', () => {
    // Fingerabdruck-Seite aus n verschiedenen Glyphen an festen Positionen.
    const fpPage = (n, base = 0xe100, x0 = 40) => {
        const chars = Array.from({ length: n }, (_, i) => glyph(base + i));
        return {
            seq: chars.join(''),
            x: chars.map((_, i) => x0 + i * 10),
            y: chars.map((_, i) => 50 + (i % 5) * 4),
        };
    };
    // Platzierung so, wie die Druck-PDF sie liefert: ein Item je Glyphe,
    // gegenüber der DB-Datei um (dx, dy) verschoben.
    const layer = (fp, dx = 0, dy = -14) =>
        [...fp.seq].map((ch, i) => ({ ch, x: fp.x[i] + dx, yTop: fp.y[i] + dy }));
    const placementOf = (...layers) => {
        const glyphs = layers.flat();
        return {
            font: 'f1',
            page: 81,
            seq: glyphs.map((g) => g.ch).join(''),
            items: glyphs.map((g, off) => ({ off, x: g.x, yTop: g.yTop })),
        };
    };
    const dbFile = fpPage(44);
    const cands = [{ lied: { id: 1137 }, fpPage: dbFile }];

    it('erkennt dieselbe Datei zweimal deckungsgleich (Seite 81, Lied 259)', () => {
        const layers = splitStackedPlacement(placementOf(layer(dbFile), layer(dbFile)), cands);
        expect(layers).toHaveLength(2);
        for (const l of layers) {
            expect(l.best.match).toBe('exact');
            expect(l.best.residual).toBeLessThan(0.01);
            expect(l.placement.seq).toBe(dbFile.seq);
        }
    });

    it('trennt einen alten Export unter der aktuellen Datei ab', () => {
        const alt = fpPage(30, 0xe300);
        const layers = splitStackedPlacement(placementOf(layer(alt), layer(dbFile)), cands);
        expect(layers).toHaveLength(2);
        expect(layers[0].best).toBe(null);
        expect(layers[0].placement.seq).toBe(alt.seq);
        expect(layers[1].best.match).toBe('exact');
    });

    it('liefert null, wenn nichts zu einer Datei passt', () => {
        const fremd = placementOf(layer(fpPage(60, 0xe500)));
        expect(splitStackedPlacement(fremd, cands)).toBe(null);
    });
});
