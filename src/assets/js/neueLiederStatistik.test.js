import { describe, expect, it } from 'vitest';
import {
    anteil,
    berechneStatistik,
    bestandAus2000,
    melodieVermerk,
    melodienAus2000,
    textVermerk,
    texteAus2000,
} from './neueLiederStatistik.js';

// Kurzschreibweise für ein Gesangbuchlied, wie es der Store liefert.
function lied({
    id,
    nr2000 = null,
    text = null,
    melodie = null,
    textGeaendert = false,
    melodieGeaendert = false,
    bewertung = 'Rein',
}) {
    return {
        id,
        liednummer2000: nr2000,
        text: text == null ? null : { id: text },
        melodie: melodie == null ? null : { id: melodie },
        textGeaendert,
        melodieGeaendert,
        bewertung_kleiner_kreis: bewertung == null ? null : { bezeichner: bewertung },
    };
}

describe('melodienAus2000', () => {
    it('zählt eine überarbeitete Melodie weiterhin zum Altbestand', () => {
        // "Melodie geändert" heißt überarbeitet (z. B. Taktung vereinheitlicht),
        // nicht "andere Melodie" – die Melodie selbst stand schon 2000 im Buch.
        const lieder = [lied({ id: 1, nr2000: 20, melodie: 100, melodieGeaendert: true })];
        expect(melodienAus2000(lieder).has(100)).toBe(true);
    });

    it('zählt die Melodie eines aussortierten 2000er-Lieds zum Altbestand', () => {
        // Das Lied fliegt raus, die Melodie stand trotzdem im Gesangbuch 2000 –
        // ein neues Lied auf dieser Melodie ist für die Gemeinde nichts Neues.
        const lieder = [lied({ id: 1, nr2000: 55, melodie: 100, bewertung: 'Raus' })];
        expect(melodienAus2000(lieder).has(100)).toBe(true);
    });

    it('nimmt Melodien ohne Liednummer 2000 nicht auf', () => {
        expect(melodienAus2000([lied({ id: 1, melodie: 100 })]).has(100)).toBe(false);
    });
});

describe('texteAus2000', () => {
    it('nimmt einen überarbeiteten Text nicht in den Altbestand', () => {
        // Anders als bei der Melodie ist das Häkchen hier belastbar: ein
        // überarbeiteter Text ist auch wirklich ein anderer Text.
        const lieder = [lied({ id: 1, nr2000: 20, text: 200, textGeaendert: true })];
        expect(texteAus2000(lieder).has(200)).toBe(false);
    });

    it('zählt den Text eines aussortierten 2000er-Lieds zum Altbestand', () => {
        const lieder = [lied({ id: 1, nr2000: 55, text: 200, bewertung: 'Raus' })];
        expect(texteAus2000(lieder).has(200)).toBe(true);
    });
});

describe('berechneStatistik', () => {
    it('rechnet nur über angenommene Lieder', () => {
        const lieder = [
            lied({ id: 1, melodie: 1, text: 1 }),
            lied({ id: 2, melodie: 2, text: 2, bewertung: 'Raus' }),
            lied({ id: 3, melodie: 3, text: 3, bewertung: 'parking' }),
        ];
        expect(berechneStatistik(lieder).lieder.total).toBe(1);
    });

    it('weist Melodien pro Lied aus, nicht pro Melodie-Datensatz', () => {
        // Eine bekannte Melodie trägt drei Lieder, eine neue nur eins. Pro
        // Datensatz wären das 50 % neu, pro Lied sind es 25 %.
        const lieder = [
            lied({ id: 1, nr2000: 10, melodie: 100, text: 1 }),
            lied({ id: 2, melodie: 100, text: 2 }),
            lied({ id: 3, melodie: 100, text: 3 }),
            lied({ id: 4, melodie: 200, text: 4 }),
        ];
        const stat = berechneStatistik(lieder);
        expect(stat.melodien).toEqual({ neu: 1, total: 4 });
        expect(anteil(stat.melodien)).toBe(25);
        expect(stat.melodienDatensaetze).toEqual({ neu: 1, total: 2 });
        expect(anteil(stat.melodienDatensaetze)).toBe(50);
    });

    it('zählt ein neues Lied auf einer überarbeiteten 2000er-Melodie nicht als neue Melodie', () => {
        // Der Fall, der die Zahl nach oben getrieben hat: Lied 1 trägt das
        // Melodie-Häkchen, Lied 2 ist neu und nutzt dieselbe Melodie.
        const lieder = [
            lied({ id: 1, nr2000: 20, melodie: 100, text: 1, melodieGeaendert: true }),
            lied({ id: 2, melodie: 100, text: 2 }),
        ];
        expect(berechneStatistik(lieder).melodien).toEqual({ neu: 0, total: 2 });
    });

    it('trennt komplett neue von überarbeiteten Liedern', () => {
        const lieder = [
            lied({ id: 1, melodie: 1, text: 1 }),
            lied({ id: 2, nr2000: 30, melodie: 2, text: 2, textGeaendert: true }),
            lied({ id: 3, nr2000: 31, melodie: 3, text: 3, melodieGeaendert: true }),
            lied({ id: 4, nr2000: 32, melodie: 4, text: 4 }),
        ];
        const stat = berechneStatistik(lieder);
        expect(stat.komposition).toEqual({
            komplettNeu: 1,
            ueberarbeitet: 2,
            uebernommen: 1,
            total: 4,
        });
        expect(stat.lieder).toEqual({ neu: 3, total: 4 });
    });

    it('zählt einen überarbeiteten 2000er-Text als neuen Text', () => {
        const lieder = [lied({ id: 1, nr2000: 40, melodie: 1, text: 1, textGeaendert: true })];
        expect(berechneStatistik(lieder).texte).toEqual({ neu: 1, total: 1 });
    });

    it('kommt mit Liedern ohne Text- oder Melodieverknüpfung klar', () => {
        const lieder = [lied({ id: 1 }), lied({ id: 2, melodie: 1 })];
        const stat = berechneStatistik(lieder);
        expect(stat.lieder).toEqual({ neu: 2, total: 2 });
        expect(stat.texte).toEqual({ neu: 0, total: 0 });
        expect(stat.melodien).toEqual({ neu: 1, total: 2 });
    });

    it('liefert für eine leere Liste Nullwerte statt NaN', () => {
        const stat = berechneStatistik([]);
        expect(stat.lieder).toEqual({ neu: 0, total: 0 });
        expect(anteil(stat.lieder)).toBe(0);
        expect(anteil(stat.melodienDatensaetze)).toBe(0);
    });
});

describe('bestandAus2000', () => {
    it('nimmt Melodie und Text jedes 2000er-Lieds auf – auch überarbeitete', () => {
        const bestand = bestandAus2000([
            lied({ id: 1, nr2000: 20, text: 200, melodie: 100, textGeaendert: true }),
        ]);
        expect(bestand.melodien.has(100)).toBe(true);
        // Anders als texteAus2000: für den Änderungsvermerk zählt der reine
        // Bestand, damit „geändert" von „neu" unterschieden werden kann.
        expect(bestand.texte.has(200)).toBe(true);
        expect(
            texteAus2000([lied({ id: 1, nr2000: 20, text: 200, textGeaendert: true })]).has(200),
        ).toBe(false);
    });

    it('nimmt Lieder ohne Liednummer 2000 nicht auf', () => {
        const bestand = bestandAus2000([lied({ id: 1, text: 200, melodie: 100 })]);
        expect(bestand.melodien.size).toBe(0);
        expect(bestand.texte.size).toBe(0);
    });
});

describe('textVermerk / melodieVermerk (Issue #106)', () => {
    // Ein 2000er-Lied bildet den Altbestand, ein neues Lied greift darauf zu.
    const altesLied = lied({ id: 1, nr2000: 20, text: 200, melodie: 100 });

    it('neues Lied auf bekannter Melodie: Melodie ist nicht neu', () => {
        const neuesLied = lied({ id: 2, text: 201, melodie: 100 });
        const bestand = bestandAus2000([altesLied, neuesLied]);
        expect(textVermerk(neuesLied, bestand)).toBe('neu');
        expect(melodieVermerk(neuesLied, bestand)).toBe('');
    });

    it('komplett neues Lied: Text und Melodie neu', () => {
        const neuesLied = lied({ id: 2, text: 201, melodie: 101 });
        const bestand = bestandAus2000([altesLied, neuesLied]);
        expect(textVermerk(neuesLied, bestand)).toBe('neu');
        expect(melodieVermerk(neuesLied, bestand)).toBe('neu');
    });

    it('2000er-Lied mit Häkchen: geaendert statt neu', () => {
        const geaendert = lied({
            id: 1,
            nr2000: 20,
            text: 200,
            melodie: 100,
            textGeaendert: true,
            melodieGeaendert: true,
        });
        const bestand = bestandAus2000([geaendert]);
        expect(textVermerk(geaendert, bestand)).toBe('geaendert');
        expect(melodieVermerk(geaendert, bestand)).toBe('geaendert');
    });

    it('unverändert übernommenes 2000er-Lied: kein Vermerk', () => {
        const bestand = bestandAus2000([altesLied]);
        expect(textVermerk(altesLied, bestand)).toBe('');
        expect(melodieVermerk(altesLied, bestand)).toBe('');
    });

    it('ohne Text-/Melodie-Verknüpfung greift nur das Häkchen', () => {
        const ohne = lied({ id: 3, nr2000: 30, textGeaendert: true });
        const bestand = bestandAus2000([ohne]);
        expect(textVermerk(ohne, bestand)).toBe('geaendert');
        expect(melodieVermerk(ohne, bestand)).toBe('');
    });
});
