import { describe, it, expect } from 'vitest';
import {
    status_mapping,
    resolveLiednummer2026,
    formatStrophenForExport,
    similarity,
} from '@/assets/js/utils';

describe('status_mapping', () => {
    it('mappt bekannte Status auf deutsche Labels', () => {
        expect(status_mapping.accepted).toBe('Bewertet und genommen');
        expect(status_mapping.draft).toBe('Entwurf');
    });
});

describe('resolveLiednummer2026', () => {
    it('nutzt die eigene Nummer', () => {
        expect(resolveLiednummer2026({ liednummer2026: '42' })).toBe('42');
    });
    it('fällt auf die deutsche Liedfassung zurück (Objekt)', () => {
        expect(resolveLiednummer2026({ deutscheLiedfassung: { id: 5 } }, { 5: '77' })).toBe('77');
    });
    it('fällt auf die deutsche Liedfassung zurück (nur ID)', () => {
        expect(resolveLiednummer2026({ deutscheLiedfassung: 5 }, { 5: '77' })).toBe('77');
    });
    it('ignoriert liednummer2000 (Legacy) und liefert sonst ""', () => {
        expect(resolveLiednummer2026({ liednummer2000: '99' })).toBe('');
        expect(resolveLiednummer2026(null)).toBe('');
    });
});

describe('formatStrophenForExport', () => {
    it('überspringt Strophe 1, entfernt ¬ und fasst Whitespace zusammen', () => {
        const strophen = [
            { strophe: 'Strophe eins' },
            { strophe: 'Zwei¬mal\n  drei' },
            { strophe: 'vier' },
        ];
        expect(formatStrophenForExport(strophen)).toBe('Zweimal drei\nvier');
    });
    it('leer bei höchstens einer Strophe', () => {
        expect(formatStrophenForExport([{ strophe: 'nur eine' }])).toBe('');
        expect(formatStrophenForExport([])).toBe('');
        expect(formatStrophenForExport(null)).toBe('');
    });
});

describe('similarity', () => {
    it('identische Strings -> 1', () => {
        expect(similarity('abc', 'abc')).toBe(1);
    });
    it('ist case-insensitiv', () => {
        expect(similarity('ABC', 'abc')).toBe(1);
    });
    it('ein Zeichen anders -> (n-1)/n', () => {
        expect(similarity('abc', 'abx')).toBeCloseTo(2 / 3, 5);
    });
    it('zwei leere Strings -> 1', () => {
        expect(similarity('', '')).toBe(1);
    });
});
