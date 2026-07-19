import { describe, it, expect } from 'vitest';
import {
    formatYearRange,
    appendSuffix,
    formatAuthorEntry,
    buildFooter,
} from '@/assets/js/authorFormat';

describe('formatYearRange (Issue #18)', () => {
    it('Geburts- und Sterbejahr', () => {
        expect(formatYearRange(1798, 1874)).toBe('(1798–1874)');
    });
    it('nur Geburtsjahr', () => {
        expect(formatYearRange(1989, null)).toBe('(1989)');
    });
    it('nur Sterbejahr', () => {
        expect(formatYearRange(null, 1874)).toBe('(–1874)');
    });
    it('keine Jahre -> leer', () => {
        expect(formatYearRange(null, null)).toBe('');
    });
});

describe('appendSuffix (Issue #76)', () => {
    it('Suffix mit ";" -> kein Leerzeichen davor', () => {
        expect(appendSuffix('unbekannt', '; aus dem Liederschatz')).toBe(
            'unbekannt; aus dem Liederschatz',
        );
    });
    it('Suffix mit "," -> kein Leerzeichen davor', () => {
        expect(appendSuffix('unbekannt', ', weitere Angabe')).toBe('unbekannt, weitere Angabe');
    });
    it('normaler Suffix -> Leerzeichen davor', () => {
        expect(appendSuffix('Lehmann (1932–2025)', '„Bitte Gott allezeit“')).toBe(
            'Lehmann (1932–2025) „Bitte Gott allezeit“',
        );
    });
    it('führendes Leerzeichen vor Interpunktion wird getrimmt', () => {
        expect(appendSuffix('Name', '  ; mit fuehrendem Space')).toBe('Name; mit fuehrendem Space');
    });
    it('leerer/nuller Suffix lässt base unverändert', () => {
        expect(appendSuffix('Name', null)).toBe('Name');
        expect(appendSuffix('Name', '')).toBe('Name');
    });
    it('leere base -> nur Suffix (ohne führende Leerzeichen)', () => {
        expect(appendSuffix('', '; nur Suffix')).toBe('; nur Suffix');
    });
});

describe('formatAuthorEntry', () => {
    it('Name + Jahr', () => {
        expect(formatAuthorEntry({ vorname: 'Jens', nachname: 'Lehmann', geburtsjahr: 1966 })).toBe(
            'Jens Lehmann (1966)',
        );
    });
    it('Interpunktions-Suffix nach den Jahren (Issue #76)', () => {
        expect(
            formatAuthorEntry({
                nachname: 'unbekannt',
                autorSuffix: '; aus dem Liederschatz von Albert Knapp',
                geburtsjahr: 1798,
                sterbejahr: 1864,
            }),
        ).toBe('unbekannt (1798–1864); aus dem Liederschatz von Albert Knapp');
    });
    it('Prefix + Ursprungsautor', () => {
        expect(
            formatAuthorEntry({
                autorPrefix: 'nach',
                vorname: 'Max',
                nachname: 'Mustermann',
                ursprungsAutorObj: { nachname: 'Bach', geburtsjahr: 1685, sterbejahr: 1750 },
            }),
        ).toBe('nach Max Mustermann Bach (1685–1750)');
    });
});

describe('buildFooter', () => {
    it('Lied 216: melodieAutorExtraSuffix pro Lied (Issue #77)', () => {
        const lied = {
            copyright: 'Verlag Merseburger Berlin GmbH, Kassel',
            text: {
                authors: [
                    {
                        vorname: 'Eberhard',
                        nachname: 'Köhler',
                        geburtsjahr: 1927,
                        sterbejahr: 2014,
                    },
                ],
            },
            melodie: {
                authors: [
                    {
                        vorname: 'Siegfried',
                        nachname: 'Lehmann',
                        geburtsjahr: 1932,
                        sterbejahr: 2025,
                    },
                ],
            },
            melodieAutorExtraSuffix: '„Bitte Gott allezeit“',
        };
        expect(buildFooter(lied)).toBe(
            'Text: Eberhard Köhler (1927–2014)\n' +
                'Melodie: Siegfried Lehmann (1932–2025) „Bitte Gott allezeit“\n' +
                '© Verlag Merseburger Berlin GmbH, Kassel',
        );
    });

    it('ohne Extra-Suffix erscheint der Zusatz nicht (Original-Lied desselben Autors)', () => {
        const lied = {
            melodie: {
                authors: [
                    {
                        vorname: 'Siegfried',
                        nachname: 'Lehmann',
                        geburtsjahr: 1932,
                        sterbejahr: 2025,
                    },
                ],
            },
        };
        expect(buildFooter(lied)).toBe('Melodie: Siegfried Lehmann (1932–2025)');
    });

    it('Lied 102: Interpunktions-Suffix ohne führendes Leerzeichen (Issue #76)', () => {
        const lied = {
            text: {
                authors: [
                    {
                        nachname: 'unbekannt',
                        autorSuffix: '; aus dem Liederschatz von Albert Knapp (1798–1864)',
                    },
                ],
            },
            melodie: {
                authors: [{ vorname: 'Jens', nachname: 'Lehmann', geburtsjahr: 1966 }],
            },
        };
        expect(buildFooter(lied)).toBe(
            'Text: unbekannt; aus dem Liederschatz von Albert Knapp (1798–1864)\n' +
                'Melodie: Jens Lehmann (1966)',
        );
    });

    it('gleicher Text- und Melodie-Autor -> "Text und Melodie:"', () => {
        const author = {
            vorname: 'Paul',
            nachname: 'Gerhardt',
            geburtsjahr: 1607,
            sterbejahr: 1676,
        };
        const lied = { text: { authors: [author] }, melodie: { authors: [author] } };
        expect(buildFooter(lied)).toBe('Text und Melodie: Paul Gerhardt (1607–1676)');
    });
});
