import { describe, it, expect } from 'vitest';
import { canon, footerSignature, footerSignaturesMatch } from '@/assets/js/printPdfCheck';

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
