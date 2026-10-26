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

describe('Check „Noten-PDF und MusicXML passen zusammen“', () => {
    // Ein System 40–55.2 pt, Violinschlüssel, ein ♭, Noten F4 G4 (Stufen über E4).
    const y = (steps) => 55.2 - steps * 1.9;
    const codes = [0xe050, 0xe260, 0xe0a4, 0xe0a4];
    const fingerprint = {
        v: 1,
        file: 'pdf-1',
        pages: [
            {
                seq: codes.map((c) => String.fromCodePoint(c)).join(''),
                x: [10, 20, 50, 60],
                y: [y(2), y(4), y(1), y(2)],
                staves: [[40, 55.2]],
            },
        ],
    };
    const score = (fifths) => ({
        key: fifths,
        times: new Set(),
        pitches: new Map([
            [31, 1], // F4
            [32, 1], // G4
        ]),
        otherClefs: [],
    });
    const lied = (id, extra = {}) => ({
        id,
        titel: `Lied ${id}`,
        status: 'accepted',
        notentext: 'pdf-1',
        notentext_mxml: `mxml-${id}`,
        notentext_fingerprint: fingerprint,
        ...extra,
    });
    const run = (lieder, scores) => {
        const musicxml = { scores, done: scores.size, total: scores.size };
        const results = runChecks(lieder, [], { musicxml });
        return {
            fehler: results.find((c) => c.id === 'notentext-mxml-abgleich'),
            hinweise: results.find((c) => c.id === 'notentext-mxml-abgleich-hinweise'),
        };
    };

    it('meldet eine MusicXML in anderer Tonart als Fehler', () => {
        const scores = new Map([
            [1, { fileId: 'mxml-1', score: score(-1) }],
            [2, { fileId: 'mxml-2', score: score(4) }],
        ]);
        const { fehler, hinweise } = run([lied(1), lied(2)], scores);
        expect(fehler.status).toBe('error');
        expect(fehler.items.map((i) => [i.id, i.detail])).toEqual([
            [2, 'Tonart: PDF 1 ♭, MusicXML 4 ♯'],
        ]);
        expect(hinweise.status).toBe('ok');
    });

    it('ohne aktuellen Fingerabdruck nur ein Hinweis', () => {
        const { fehler, hinweise } = run([lied(1, { notentext: 'pdf-neu' })], new Map());
        expect(fehler.status).toBe('ok');
        expect(hinweise.items.map((i) => i.detail)).toEqual([
            'Kein aktueller Notensatz-Fingerabdruck – nicht geprüft',
        ]);
    });

    it('zeigt den Ladestand, solange MusicXML-Dateien fehlen', () => {
        const pending = runChecks([lied(1)], [], { musicxml: null }).find(
            (c) => c.id === 'notentext-mxml-abgleich',
        );
        expect(pending.status).toBe('info');
        expect(pending.summary).toContain('werden geladen');
    });
});

describe('Check „Liedtext im Notenbild und in der MusicXML gleich“', () => {
    const lied = (id, extra = {}) => ({
        id,
        titel: `Lied ${id}`,
        status: 'accepted',
        notentext: `pdf-${id}`,
        notentext_mxml: `mxml-${id}`,
        ...extra,
    });
    const entry = (id, text, extra = {}) => ({
        song_id: String(id),
        strophe_1_notenbild: text,
        notentext_file_id: `pdf-${id}`,
        notentext_seite2_file_id: null,
        exakt_gelesen: true,
        ...extra,
    });
    const score = (words) => ({
        key: 0,
        times: new Set(),
        pitches: new Map(),
        otherClefs: [],
        words,
    });
    const run = (lieder, entries, scores) => {
        const notenbildText = { bySongId: new Map(entries.map((e) => [e.song_id, e])) };
        const musicxml = { scores, done: scores.size, total: scores.size };
        const results = runChecks(lieder, [], { musicxml, notenbildText });
        return {
            text: results.find((c) => c.id === 'notentext-mxml-liedtext'),
            hinweise: results.find((c) => c.id === 'notentext-mxml-abgleich-hinweise'),
        };
    };

    it('meldet ein nur im Notenbild korrigiertes Wort', () => {
        const scores = new Map([
            [1, { fileId: 'mxml-1', score: score(['O', 'komm', 'herein']) }],
            [2, { fileId: 'mxml-2', score: score(['Halleluja']) }],
        ]);
        const { text } = run(
            [lied(1), lied(2)],
            [entry(1, 'Oh komm her - ein'), entry(2, 'Hal - le - lu - ja!')],
            scores,
        );
        expect(text.status).toBe('warning');
        expect(text.items.map((i) => [i.id, i.detail])).toEqual([
            [1, 'nur im Notenbild: „Oh“ · nur in MusicXML: „O“'],
        ]);
    });

    it('prüft nur exakt gelesenen Text der aktuellen Noten-PDF', () => {
        const scores = new Map([
            [1, { fileId: 'mxml-1', score: score(['anders']) }],
            [2, { fileId: 'mxml-2', score: score(['anders']) }],
        ]);
        const { text, hinweise } = run(
            [lied(1, { notentext: 'pdf-neu' }), lied(2)],
            [entry(1, 'Text'), entry(2, 'Text', { exakt_gelesen: false })],
            scores,
        );
        expect(text.status).toBe('ok');
        expect(hinweise.items.map((i) => i.detail)).toEqual([
            'Kein aktueller Notensatz-Fingerabdruck – nicht geprüft · Liedtext nicht geprüft: Text unter den Noten fehlt oder stammt aus einer älteren Noten-PDF',
            'Kein aktueller Notensatz-Fingerabdruck – nicht geprüft · Liedtext nicht geprüft: Text unter den Noten nur per OCR gelesen',
        ]);
    });
});

describe('Check „Titel stimmt mit dem Anfang der 1. Strophe überein“ (Issue #121)', () => {
    const run = (lieder) => runChecks(lieder).find((c) => c.id === 'lied-titel-erste-strophe');
    const lied = (id, titel, strophe) => ({
        id,
        titel,
        status: 'accepted',
        text: { strophenEinzeln: [{ strophe }] },
    });

    it('überspringt die „Refrain“-Zeile am Strophenanfang', () => {
        const r = run([
            lied(1, 'Herr, rede du zu uns', 'Refrain\nHerr, rede du zu uns.\nLass Herz …'),
            lied(2, 'Komm, Heilger Geist', 'Refrain\n|: Komm, Heilger Geist, mit Kraft :|'),
        ]);
        expect(r.items).toEqual([]);
    });

    it('ignoriert den Originaltitel in Klammern', () => {
        const r = run([
            lied(1, 'Ich bin in guten Händen (In guten Händen)', 'Ich bin in guten Händen. Mein …'),
        ]);
        expect(r.items).toEqual([]);
    });

    it('akzeptiert bei „Deutsch / Englisch“ jeden der beiden Teile', () => {
        const r = run([
            lied(1, 'Lobe den Herren / Praise to the Lord', 'Praise to the Lord, the Almighty'),
            lied(2, 'Lobsingt, ihr Völker / Laudate omnes gentes', 'Lobsingt, ihr Völker alle'),
            lied(3, 'Eins / We are One (They’ll Know)', 'We are one in the Spirit'),
        ]);
        expect(r.items).toEqual([]);
    });

    it('meldet weiterhin echte Abweichungen', () => {
        const r = run([
            lied(1, 'Lobe den Herren / Praise to the Lord', 'Refrain\nGanz anderer Anfang'),
            lied(2, 'Richtiger Titel (Original)', 'Original'),
        ]);
        expect(r.items.map((i) => i.id)).toEqual([1, 2]);
    });
});
