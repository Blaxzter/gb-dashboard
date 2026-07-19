import { describe, it, expect } from 'vitest';
import { isGenommen, isRein } from '@/assets/js/gesangbuchChecks';

describe('isGenommen', () => {
    it('true nur bei status "accepted"', () => {
        expect(isGenommen({ status: 'accepted' })).toBe(true);
        expect(isGenommen({ status: 'draft' })).toBe(false);
        expect(isGenommen(null)).toBe(false);
    });
});

describe('isRein', () => {
    it('erkennt "Rein"-Bewertung unabhängig von Groß-/Kleinschreibung', () => {
        expect(isRein({ bewertung_kleiner_kreis: { bezeichner: 'Rein' } })).toBe(true);
        expect(isRein({ bewertung_kleiner_kreis: { bezeichner: 'sehr rein!' } })).toBe(true);
    });
    it('false ohne "Rein"-Bewertung', () => {
        expect(isRein({ bewertung_kleiner_kreis: { bezeichner: 'noch offen' } })).toBe(false);
        expect(isRein({})).toBe(false);
        expect(isRein(null)).toBe(false);
    });
});
