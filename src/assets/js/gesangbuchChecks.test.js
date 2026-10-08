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

describe('Check „Copyright-Angabe nur mit Häkchen“ (Issue #115)', () => {
    const run = (lieder) => runChecks(lieder).find((c) => c.id === 'copyright-ohne-haekchen');

    it('meldet gefüllte Copyright-Felder ohne gesetztes Häkchen', () => {
        const r = run([
            {
                id: 1,
                titel: 'Lied',
                status: 'accepted',
                copyright: 'Verlag',
                autor_oder_copyright_checken: false,
            },
            {
                id: 2,
                titel: 'Text+Melodie',
                status: 'accepted',
                text: { copyright: 'A' },
                melodie: { copyright: '©' },
                autor_oder_copyright_checken: null,
            },
            {
                id: 3,
                titel: 'Mit Häkchen',
                status: 'accepted',
                copyright: 'Verlag',
                autor_oder_copyright_checken: true,
            },
            {
                id: 4,
                titel: 'Leer',
                status: 'accepted',
                copyright: '  ',
                autor_oder_copyright_checken: false,
            },
        ]);
        expect(r.status).toBe('warning');
        expect(r.items.map((i) => [i.id, i.detail])).toEqual([
            [1, 'Copyright bei: Lied – Häkchen nicht gesetzt'],
            [2, 'Copyright bei: Text · Melodie – Häkchen leer'],
        ]);
    });
});

describe('Check „Copyright-Prüfungen abgeschlossen“ (Issue #116)', () => {
    const run = (lieder) => runChecks(lieder).find((c) => c.id === 'copyright-checks-offen');

    it('meldet Lieder mit Häkchen, aber ohne abgeschlossene Prüfung', () => {
        const r = run([
            {
                id: 1,
                titel: 'Offen',
                status: 'accepted',
                autor_oder_copyright_checken: true,
                coyprightChecksFinished: false,
            },
            {
                id: 2,
                titel: 'Null',
                status: 'accepted',
                autor_oder_copyright_checken: true,
                coyprightChecksFinished: null,
            },
            {
                id: 3,
                titel: 'Fertig',
                status: 'accepted',
                autor_oder_copyright_checken: true,
                coyprightChecksFinished: true,
            },
            {
                id: 4,
                titel: 'Kein Copyright',
                status: 'accepted',
                autor_oder_copyright_checken: false,
                coyprightChecksFinished: false,
            },
            {
                id: 5,
                titel: 'Entwurf',
                status: 'draft',
                autor_oder_copyright_checken: true,
                coyprightChecksFinished: false,
            },
        ]);
        expect(r.status).toBe('warning');
        expect(r.items.map((i) => i.id)).toEqual([1, 2]);
    });
});

describe('Check „Bearbeitete Texte mit Nach“ (Issue #117)', () => {
    const run = (lieder) => runChecks(lieder).find((c) => c.id === 'text-geaendert-ohne-nach');
    const autor = (autorPrefix) => ({ vorname: 'Anna', nachname: 'Muster', autorPrefix });

    it('meldet geänderte Texte ohne „Nach“ als Hinweis', () => {
        const r = run([
            {
                id: 1,
                titel: 'Ohne Nach',
                status: 'accepted',
                textGeaendert: true,
                text: { authors: [autor('Strophe 1')] },
            },
            {
                id: 2,
                titel: 'Mit Nach',
                status: 'accepted',
                textGeaendert: true,
                text: { authors: [autor('nach')] },
            },
            {
                id: 3,
                titel: 'Ohne Autor',
                status: 'accepted',
                textGeaendert: true,
                text: { authors: [] },
            },
            {
                id: 4,
                titel: 'Unverändert',
                status: 'accepted',
                textGeaendert: false,
                text: { authors: [autor(null)] },
            },
        ]);
        expect(r.status).toBe('info');
        expect(r.items.map((i) => [i.id, i.detail])).toEqual([
            [1, 'Textautor: Strophe 1 Anna Muster'],
            [3, 'Kein Textautor hinterlegt'],
        ]);
    });

    it('„Nach“ nur als ganzes Wort', () => {
        const r = run([
            {
                id: 1,
                titel: 'Nachdichtung',
                status: 'accepted',
                textGeaendert: true,
                text: { authors: [autor('Nachdichtung')] },
            },
        ]);
        expect(r.items.map((i) => i.id)).toEqual([1]);
    });
});

describe('Check „Autorennamen ohne Leerzeichen“ (Issue #118)', () => {
    const run = (authors) => runChecks([], authors).find((c) => c.id === 'autor-name-leerzeichen');

    it('meldet Vor- und Nachnamen mit Whitespace am Rand als Fehler', () => {
        const r = run([
            { id: 1, vorname: 'Anna ', nachname: 'Muster', status: 'published' },
            { id: 2, vorname: 'Bert', nachname: ' Beispiel ', status: 'uploaded' },
            { id: 3, vorname: 'Clara', nachname: 'Sauber', status: 'published' },
            { id: 4, vorname: null, nachname: 'unbekannt', status: 'published' },
        ]);
        expect(r.status).toBe('error');
        expect(r.items.map((i) => i.title)).toEqual(['Anna Muster', 'Bert Beispiel']);
        expect(r.items[0].detail).toContain('Vorname endet mit Leerzeichen');
        expect(r.items[1].detail).toContain('Nachname beginnt und endet mit Leerzeichen');
    });

    it('ok ohne Befund', () => {
        expect(run([{ id: 1, vorname: 'A', nachname: 'B' }]).status).toBe('ok');
    });
});

describe('Check „Nach Eberhard Köhler nur mit Text geändert“ (Issue #119)', () => {
    const run = (lieder) =>
        runChecks(lieder).find((c) => c.id === 'nach-koehler-ohne-text-geaendert');
    const koehler = (autorPrefix, autor_id = 28) => ({
        autor_id,
        vorname: 'Eberhard',
        nachname: 'Köhler',
        autorPrefix,
    });

    it('warnt bei „Nach Eberhard Köhler“ ohne gesetztes „Text geändert“', () => {
        const r = run([
            {
                id: 1,
                titel: 'Nicht gesetzt',
                status: 'accepted',
                textGeaendert: false,
                text: { authors: [koehler('Nach')] },
            },
            {
                id: 2,
                titel: 'Leer',
                status: 'accepted',
                textGeaendert: null,
                text: { authors: [koehler('nach')] },
            },
            {
                id: 3,
                titel: 'Gesetzt',
                status: 'accepted',
                textGeaendert: true,
                text: { authors: [koehler('Nach')] },
            },
            {
                id: 4,
                titel: 'Ohne Nach',
                status: 'accepted',
                textGeaendert: false,
                text: { authors: [koehler(null)] },
            },
            {
                id: 5,
                titel: 'Anderer Autor',
                status: 'accepted',
                textGeaendert: false,
                text: { authors: [koehler('Nach', 29)] },
            },
            {
                id: 6,
                titel: 'Entwurf',
                status: 'draft',
                textGeaendert: false,
                text: { authors: [koehler('Nach')] },
            },
        ]);
        expect(r.status).toBe('warning');
        expect(r.items.map((i) => [i.id, i.detail])).toEqual([
            [1, '„Text geändert“ nicht gesetzt'],
            [2, '„Text geändert“ leer'],
        ]);
    });

    it('ok ohne Befund', () => {
        expect(run([]).status).toBe('ok');
    });
});
