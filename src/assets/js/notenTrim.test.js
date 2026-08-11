import { describe, expect, it } from 'vitest';
import { inkBounds, isWorthTrimming } from './notenTrim.js';

// Ein weißes Blatt mit einem schwarzen Rechteck darin – so sieht ein gerendertes
// Notenbild im Kleinen aus: viel Papier, wenig Druck.
function page(width, height, ink = null, { transparent = false } = {}) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const o = i * 4;
        data[o] = 255;
        data[o + 1] = 255;
        data[o + 2] = 255;
        data[o + 3] = transparent ? 0 : 255;
    }
    if (ink) {
        for (let y = ink.y; y < ink.y + ink.h; y++) {
            for (let x = ink.x; x < ink.x + ink.w; x++) {
                const o = (y * width + x) * 4;
                data[o] = 0;
                data[o + 1] = 0;
                data[o + 2] = 0;
                data[o + 3] = 255;
            }
        }
    }
    return { data };
}

describe('inkBounds', () => {
    it('findet den bedruckten Bereich und lässt etwas Rand stehen', () => {
        // padRatio 0 -> der Kasten sitzt exakt auf dem Druck.
        const box = inkBounds(page(100, 200, { x: 20, y: 10, w: 30, h: 40 }), 100, 200, {
            padRatio: 0,
        });
        expect(box).toEqual({ x: 20, y: 10, w: 30, h: 40 });
    });

    it('legt den Rand um den Druck herum an', () => {
        const box = inkBounds(page(100, 200, { x: 20, y: 30, w: 30, h: 40 }), 100, 200, {
            padRatio: 0.05, // 5 Pixel bei 100 Breite
        });
        expect(box).toEqual({ x: 15, y: 25, w: 40, h: 50 });
    });

    it('schneidet den Rand nicht über die Bildkante hinaus', () => {
        const box = inkBounds(page(50, 50, { x: 0, y: 0, w: 50, h: 50 }), 50, 50, {
            padRatio: 0.1,
        });
        expect(box).toEqual({ x: 0, y: 0, w: 50, h: 50 });
    });

    it('wertet durchsichtige Flächen als Papier', () => {
        // pdf.js zeichnet auf eine leere Fläche – dort ist „weiß" durchsichtig.
        const box = inkBounds(
            page(60, 60, { x: 10, y: 10, w: 10, h: 10 }, { transparent: true }),
            60,
            60,
            { padRatio: 0 },
        );
        expect(box).toEqual({ x: 10, y: 10, w: 10, h: 10 });
    });

    it('meldet eine leere Seite als „nichts zuzuschneiden"', () => {
        expect(inkBounds(page(40, 40), 40, 40)).toBeNull();
    });

    it('kommt ohne Bilddaten klar', () => {
        expect(inkBounds(null, 10, 10)).toBeNull();
        expect(inkBounds(page(10, 10), 0, 0)).toBeNull();
    });
});

describe('isWorthTrimming', () => {
    it('lohnt sich bei einer Seite, die überwiegend leer ist', () => {
        // Der Regelfall: Notensatz oben, darunter drei Viertel leeres Blatt.
        expect(isWorthTrimming({ x: 0, y: 0, w: 100, h: 60 }, 100, 200)).toBe(true);
    });

    it('lohnt sich nicht, wenn der Druck die Seite ohnehin füllt', () => {
        expect(isWorthTrimming({ x: 0, y: 0, w: 100, h: 195 }, 100, 200)).toBe(false);
    });

    it('lohnt sich nicht ohne Kasten', () => {
        expect(isWorthTrimming(null, 100, 200)).toBe(false);
    });
});
