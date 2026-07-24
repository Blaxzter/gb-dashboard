import { describe, it, expect } from 'vitest';
import {
    canon,
    compareCopyrightScope,
    detectNumbers,
    footerSignature,
    footerSignaturesMatch,
} from '@/assets/js/printPdfCheck';

describe('canon (Vergleichsform)', () => {
    it('vereinheitlicht typografische Anführungszeichen', () => {
        expect(canon('„Bitte“')).toBe('"Bitte"');
        expect(canon('’')).toBe("'");
    });
    it('vereinheitlicht Gedankenstriche zu "-"', () => {
        expect(canon('1650–1680')).toBe('1650-1680');
    });
    it('entfernt Silbentrenner und Soft-Hyphen', () => {
        expect(canon('Sil­be')).toBe('Silbe');
        expect(canon('Sil¬be')).toBe('Silbe');
    });
    it('fasst Whitespace zusammen und trimmt', () => {
        expect(canon('  a   b\n c ')).toBe('a b c');
    });
});

describe('footerSignature', () => {
    it('entfernt Label-Wörter und Nicht-Alphanumerisches', () => {
        expect(footerSignature('Text: Jens Lehmann (1966)')).toBe('jenslehmann1966');
    });
    it('lässt unverifizierbare Zeilen (Anmerkung/Quelle/Kanon) standardmäßig weg', () => {
        expect(footerSignature('Anmerkung: foo\nText: Bar')).toBe('bar');
    });
    it('behält sie bei dropUnverifiable=false', () => {
        expect(footerSignature('Anmerkung: foo\nText: Bar', { dropUnverifiable: false })).toBe(
            'foobar',
        );
    });
});

describe('footerSignaturesMatch', () => {
    it('ist unabhängig von der Jahres-Schreibweise (*1685 +1750 vs 1685–1750)', () => {
        expect(
            footerSignaturesMatch('Melodie: Bach (1685–1750)', 'Melodie: Bach (*1685 +1750)'),
        ).toBe(true);
    });
    it('wertet getrennte und zusammengefasste Form als gleich (collapseHalf)', () => {
        expect(
            footerSignaturesMatch(
                'Text und Melodie: Paul Gerhardt',
                'Text: Paul Gerhardt\nMelodie: Paul Gerhardt',
            ),
        ).toBe(true);
    });
    it('erkennt echte Abweichungen', () => {
        expect(footerSignaturesMatch('Text: Bach', 'Text: Mozart')).toBe(false);
    });
});

describe('compareCopyrightScope (nur Melodie hat Copyright, Issue #78)', () => {
    // Lied mit Copyright ausschließlich an der Melodie.
    const lied = {
        id: 1,
        titel: 'Gottes Stern',
        copyright: '',
        text: { copyright: '' },
        melodie: { copyright: 'Bärenreiter-Verlag Karl Vötterle GmbH & Co. KG, Kassel' },
    };
    const run = (footerLines, footerLineX) => {
        const copyrightScope = [];
        compareCopyrightScope({ nummer: '220', footerLines, footerLineX }, lied, {
            copyrightScope,
        });
        return copyrightScope;
    };

    it('meldet nichts, wenn das © inline hinter der Melodie-Zeile steht', () => {
        expect(
            run(
                ['Text: Ulrike Gehde (1959)', 'Melodie: Christian Lahusen © Bärenreiter'],
                [27.6, 28.4],
            ),
        ).toEqual([]);
    });
    it('meldet nichts, wenn die ©-Zeile eingerückt unter der Melodie-Zeile steht', () => {
        // Werte aus test_input_4.pdf, Seite 72 (Nr. 220).
        expect(
            run(
                [
                    'Text: Ulrike Gehde (1959)',
                    'Melodie: Christian Lahusen (1886–1975) „Wisst ihr noch, wie es geschehen?"',
                    '© Bärenreiter-Verlag Karl Vötterle GmbH & Co. KG, Kassel',
                ],
                [27.6, 28.4, 54.6],
            ),
        ).toEqual([]);
    });
    it('warnt, wenn die ©-Zeile bündig am linken Rand steht', () => {
        const items = run(
            [
                'Text: Ulrike Gehde (1959)',
                'Melodie: Christian Lahusen (1886–1975)',
                '© Bärenreiter-Verlag Karl Vötterle GmbH & Co. KG, Kassel',
            ],
            [27.6, 28.4, 27.9],
        );
        expect(items).toHaveLength(1);
        expect(items[0].sev).toBe('warning');
    });
    it('meldet nichts, wenn auch der Text ein Copyright hat', () => {
        const copyrightScope = [];
        compareCopyrightScope(
            { nummer: '220', footerLines: ['Melodie: X', '© Verlag'], footerLineX: [27.6, 27.6] },
            { ...lied, text: { copyright: 'Verlag' } },
            { copyrightScope },
        );
        expect(copyrightScope).toEqual([]);
    });
});

describe('detectNumbers (Lied- und Choralbuchnummer)', () => {
    const PAGE_HEIGHT = 481.9;
    const SIZE_HINT = 10.8;
    // Kopfsteg wie im Druck: Liednummer 20 pt, Choralbuchnummer 11 pt darunter,
    // beide in derselben Schrift.
    const liednummer = { str: '275', x: 275.4, yTop: 48.7, width: 30, size: 20, font: 'f_num' };
    const choralnummer = { str: '168', x: 280.9, yTop: 70.4, width: 16.1, size: 11, font: 'f_num' };

    it('erkennt beide Nummern', () => {
        const { numberItem, choralItem } = detectNumbers(
            [liednummer, choralnummer],
            PAGE_HEIGHT,
            SIZE_HINT,
        );
        expect(numberItem?.str).toBe('275');
        expect(choralItem?.str).toBe('168');
    });

    it('hält Notensatz-Ziffern (Triole) aus der Choralbuchnummer heraus', () => {
        // Seite 150 / Lied 275: die Triolen-„3" steht in der Notensatz-Schrift
        // zwischen den beiden Nummern und stand vor pdf.js in der Item-Liste.
        const triole = { str: '3', x: 246.6, yTop: 80.6, width: 3.2, size: 6.36, font: 'f_music' };
        const { choralItem } = detectNumbers(
            [triole, liednummer, choralnummer],
            PAGE_HEIGHT,
            SIZE_HINT,
        );
        expect(choralItem?.str).toBe('168');
    });

    it('liefert keine Choralbuchnummer, wenn nur Notensatz-Ziffern darunter stehen', () => {
        const triole = { str: '3', x: 246.6, yTop: 80.6, width: 3.2, size: 6.36, font: 'f_music' };
        const { numberItem, choralItem } = detectNumbers(
            [liednummer, triole],
            PAGE_HEIGHT,
            SIZE_HINT,
        );
        expect(numberItem?.str).toBe('275');
        expect(choralItem).toBe(null);
    });

    it('liefert nichts ohne groß gesetzte Liednummer', () => {
        const { numberItem, choralItem } = detectNumbers([choralnummer], PAGE_HEIGHT, SIZE_HINT);
        expect(numberItem).toBe(null);
        expect(choralItem).toBe(null);
    });
});
