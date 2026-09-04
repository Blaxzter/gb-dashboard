import { describe, it, expect } from 'vitest';
import { isGenommen, isRein, isReinWenn, runChecks } from '@/assets/js/gesangbuchChecks';

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

describe('isReinWenn (Issue #103)', () => {
    const bew = (bezeichner) => ({ bewertung_kleiner_kreis: { bezeichner } });
    it('erkennt „Rein, wenn“', () => {
        expect(isReinWenn(bew('Rein, wenn'))).toBe(true);
        expect(isReinWenn(bew('rein, wenn der Text überarbeitet ist'))).toBe(true);
        expect(isReinWenn(bew('Rein wenn'))).toBe(true);
    });
    it('false bei „Rein“ und anderen Bewertungen', () => {
        expect(isReinWenn(bew('Rein'))).toBe(false);
        expect(isReinWenn(bew('Rein (Tendenz)'))).toBe(false);
        expect(isReinWenn(bew('Raus'))).toBe(false);
        expect(isReinWenn({})).toBe(false);
        expect(isReinWenn(null)).toBe(false);
    });
});

describe('Check „Kein Rein, wenn bei Text oder Melodie“ (Issue #103)', () => {
    const run = (lieder) =>
        runChecks(lieder).find((c) => c.id === 'genommen-rein-wenn-text-melodie');
    const reinWenn = { bewertung_kleiner_kreis: { bezeichner: 'Rein, wenn' } };
    const rein = { bewertung_kleiner_kreis: { bezeichner: 'Rein' } };

    it('meldet Text und Melodie einzeln', () => {
        const r = run([
            { id: 1, titel: 'Nur Text', status: 'accepted', text: reinWenn, melodie: rein },
            { id: 2, titel: 'Nur Melodie', status: 'accepted', text: rein, melodie: reinWenn },
            { id: 3, titel: 'Beides', status: 'accepted', text: reinWenn, melodie: reinWenn },
        ]);
        expect(r.status).toBe('warning');
        expect(r.items.map((i) => i.detail)).toEqual([
            '„Rein, wenn“ bei: Text',
            '„Rein, wenn“ bei: Melodie',
            '„Rein, wenn“ bei: Text und Melodie',
        ]);
    });

    it('ignoriert nicht genommene Lieder', () => {
        const r = run([{ id: 1, titel: 'Entwurf', status: 'draft', text: reinWenn }]);
        expect(r.status).toBe('ok');
        expect(r.items).toEqual([]);
    });

    it('ok, wenn Text und Melodie „Rein“ sind', () => {
        const r = run([{ id: 1, titel: 'Sauber', status: 'accepted', text: rein, melodie: rein }]);
        expect(r.status).toBe('ok');
    });
});
