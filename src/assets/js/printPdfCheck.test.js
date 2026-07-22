import { describe, it, expect } from 'vitest';
import {
    canon,
    compareCopyrightScope,
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
