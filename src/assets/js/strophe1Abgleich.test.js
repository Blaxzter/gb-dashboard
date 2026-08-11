import { describe, expect, it } from 'vitest';
import {
    abgleichKey,
    hasNotenbild,
    hasStrophe1,
    notenbildPages,
    strophe1Flow,
    strophe1Lines,
    strophe1Raw,
} from './strophe1Abgleich.js';

function lied(overrides = {}) {
    return {
        id: 7,
        titel: 'Befiehl du deine Wege',
        text: {
            strophenEinzeln: [
                { strophe: 'Befiehl du deine Wege\nund was dein Herze kränkt' },
                { strophe: 'Dem Herren musst du trauen' },
            ],
        },
        ...overrides,
    };
}

describe('strophe1Lines / strophe1Flow', () => {
    it('liefert die Zeilen der ersten Strophe, nicht der folgenden', () => {
        expect(strophe1Lines(lied())).toEqual([
            'Befiehl du deine Wege',
            'und was dein Herze kränkt',
        ]);
    });

    it('fasst den Text fortlaufend zusammen – so, wie er unter den Noten läuft', () => {
        expect(strophe1Flow(lied())).toBe('Befiehl du deine Wege und was dein Herze kränkt');
    });

    it('entfernt Silbentrennzeichen aus Altbeständen', () => {
        const l = lied({ text: { strophenEinzeln: [{ strophe: 'Be¬fiehl du dei¬ne We¬ge' }] } });
        expect(strophe1Raw(l)).toBe('Befiehl du deine Wege');
    });

    it('wirft Leerzeilen und Mehrfach-Leerzeichen weg', () => {
        const l = lied({ text: { strophenEinzeln: [{ strophe: ' A  B \n\n\n C\t D \n' }] } });
        expect(strophe1Lines(l)).toEqual(['A B', 'C D']);
    });

    it('kommt mit fehlendem Text klar', () => {
        expect(strophe1Lines({ id: 1 })).toEqual([]);
        expect(strophe1Flow({ id: 1 })).toBe('');
        expect(hasStrophe1({ id: 1 })).toBe(false);
        expect(hasStrophe1(lied())).toBe(true);
    });
});

describe('notenbildPages', () => {
    it('nimmt Notensatz-PDF und Seite 2 in Druckreihenfolge', () => {
        const pages = notenbildPages(lied({ notentext: 'a', notentext_seite2: 'b' }));
        expect(pages.map((p) => p.id)).toEqual(['a', 'b']);
        expect(pages.every((p) => p.kind === 'pdf')).toBe(true);
    });

    it('fällt nur ohne PDF auf die SVG zurück', () => {
        expect(
            notenbildPages(lied({ notentext: 'a', notentext_svg: 's' })).map((p) => p.id),
        ).toEqual(['a']);
        const nurSvg = notenbildPages(lied({ notentext_svg: 's' }));
        expect(nurSvg).toHaveLength(1);
        expect(nurSvg[0].kind).toBe('image');
    });

    it('richtet sich nach dem Medientyp der Datei, nicht nach dem Feld', () => {
        // Ein Bild im notentext-Feld durch den PDF-Betrachter zu schicken ergäbe
        // nur eine leere Fläche.
        const alsBild = notenbildPages(
            lied({ notentext: 'a', notentext_file: { type: 'image/png' } }),
        );
        expect(alsBild[0].kind).toBe('image');

        const alsPdf = notenbildPages(
            lied({ notentext_svg: 's', notentext_svg_file: { type: 'application/pdf' } }),
        );
        expect(alsPdf[0].kind).toBe('pdf');
    });

    it('nimmt ohne bekannten Medientyp die Feld-Konvention an', () => {
        expect(notenbildPages(lied({ notentext: 'a' }))[0].kind).toBe('pdf');
        expect(
            notenbildPages(lied({ notentext: 'a', notentext_file: { type: 'text/plain' } }))[0]
                .kind,
        ).toBe('pdf');
    });

    it('meldet fehlendes Notenbild', () => {
        expect(hasNotenbild(lied())).toBe(false);
        expect(hasNotenbild(lied({ notentext: 'a' }))).toBe(true);
    });
});

describe('abgleichKey', () => {
    it('ist für denselben Stand stabil', () => {
        expect(abgleichKey(lied({ notentext: 'a' }))).toBe(abgleichKey(lied({ notentext: 'a' })));
    });

    it('ändert sich, wenn ein neues Notenbild hinterlegt wurde', () => {
        expect(abgleichKey(lied({ notentext: 'a' }))).not.toBe(
            abgleichKey(lied({ notentext: 'b' })),
        );
    });

    it('ändert sich, wenn die 1. Strophe korrigiert wurde', () => {
        const geaendert = lied({
            notentext: 'a',
            text: {
                strophenEinzeln: [{ strophe: 'Befiehl du deine Wege\nund was dein Herz kränkt' }],
            },
        });
        expect(abgleichKey(geaendert)).not.toBe(abgleichKey(lied({ notentext: 'a' })));
    });

    it('bleibt leer, wenn kein Lied dahintersteht', () => {
        expect(abgleichKey(null)).toBe('');
        expect(abgleichKey({})).toBe('');
    });
});
