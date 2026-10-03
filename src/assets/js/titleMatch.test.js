import { describe, expect, it } from 'vitest';
import { matchChoralbuchMelodie, normalize, rankMelodienForChoralbuch } from './titleMatch.js';

// Ausschnitt aus den echten Daten (Stand Issue #108).
const MELODIEN = [
    { id: 289, titel: 'Ich will beten, Gott wird hören (ungenutzt)', choralbuchNummer: 177 },
    { id: 982, titel: 'Als mir der Taufe Segen (ungenutzt)', choralbuchNummer: null },
    { id: 1138, titel: 'Nun ruhen alle Wälder', choralbuchNummer: 252 },
    { id: 351, titel: 'Nun ruhen alle Wälder (alternative Melodie)', choralbuchNummer: null },
    { id: 252, titel: 'Sei Lob und Ehr dem höchsten Gut', choralbuchNummer: null },
    { id: 1368, titel: 'Gebt Gott die Ehre', choralbuchNummer: 112 },
    { id: 1001, titel: 'Christen der Welt', choralbuchNummer: 33 },
];
const LIEDER = [
    { id: 1622, titel: 'Herr, zur Taufe schenke Segen', melodieId: 289 },
    { id: 1298, titel: 'Als mir der Taufe Segen', melodieId: 982 },
];

function parsed(base, liednummer = null) {
    return { normalizedBase: normalize(base), liednummer };
}

describe('rankMelodienForChoralbuch', () => {
    it('findet die Melodie über den Titel eines Liedes, das auf ihr gesungen wird', () => {
        const [top] = rankMelodienForChoralbuch(
            parsed('Herr, zur Taufe schenke Segen'),
            MELODIEN,
            LIEDER,
        );
        expect(top.melodie.id).toBe(289);
        expect(top.reason).toContain('Herr, zur Taufe schenke Segen');
    });

    it('zieht bei gleichem Titel die Melodie mit Choralbuchnummer vor', () => {
        const [top, second] = rankMelodienForChoralbuch(
            parsed('Nun ruhen alle Wälder'),
            MELODIEN,
            LIEDER,
        );
        expect(top.melodie.id).toBe(1138);
        expect(second.melodie.id).toBe(351);
        expect(top.score).toBeGreaterThan(second.score);
    });

    it('liest eine führende Zahl als Choralbuchnummer, nicht als Melodie-Id', () => {
        const [top] = rankMelodienForChoralbuch(
            parsed('Nun ruhen alle Wälder', '252'),
            MELODIEN,
            LIEDER,
        );
        expect(top.melodie.id).toBe(1138);
        expect(top.reason).toContain('Choralbuch-Nr. = 252');
    });
});

describe('matchChoralbuchMelodie', () => {
    it('entscheidet über die Nummer, auch wenn der Titel auf zwei Melodien passt', () => {
        const title = 'Gebt Gott die Ehre, ihr Christen der Welt';
        // Ohne Nummer: zu knapp, keine automatische Zuordnung.
        const ohne = matchChoralbuchMelodie(parsed(title), MELODIEN, LIEDER);
        expect(ohne.melodie).toBeNull();
        expect(ohne.warnings[0]).toContain('Keine Choralbuchnummer');
        // Mit Nummer: eindeutig.
        const mit112 = matchChoralbuchMelodie(parsed(title, '112'), MELODIEN, LIEDER);
        expect(mit112.melodie.id).toBe(1368);
        expect(mit112.warnings).toEqual([]);
        const mit33 = matchChoralbuchMelodie(parsed(title, '33'), MELODIEN, LIEDER);
        expect(mit33.melodie.id).toBe(1001);
    });

    it('nimmt die Nummer, warnt aber, wenn der Titel nicht dazu passt', () => {
        const r = matchChoralbuchMelodie(parsed('O du fröhliche', '252'), MELODIEN, LIEDER);
        expect(r.melodie.id).toBe(1138);
        expect(r.warnings[0]).toContain('passt nicht zu Choralbuch-Nr. 252');
    });

    it('ordnet bei unbekannter Nummer nicht zu', () => {
        const r = matchChoralbuchMelodie(parsed('Nun ruhen alle Wälder', '999'), MELODIEN, LIEDER);
        expect(r.melodie).toBeNull();
        expect(r.warnings[0]).toContain('Keine Melodie mit Choralbuch-Nr. 999');
        // Vorschläge gibt es trotzdem – über den Titel.
        expect(r.suggestions[0].melodie.id).toBe(1138);
    });

    it('findet den Taufe-Satz über Nummer und Liedtitel ohne Warnung', () => {
        const r = matchChoralbuchMelodie(
            parsed('Herr, zur Taufe schenke Segen', '177'),
            MELODIEN,
            LIEDER,
        );
        expect(r.melodie.id).toBe(289);
        expect(r.warnings).toEqual([]);
    });
});
