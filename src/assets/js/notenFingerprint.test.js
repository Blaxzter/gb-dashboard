import { describe, it, expect } from 'vitest';
import { isMusicGlyphString } from '@/assets/js/notenFingerprint';

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
