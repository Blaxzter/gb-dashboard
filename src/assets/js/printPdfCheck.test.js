import { describe, it, expect } from 'vitest';
import {
    canon,
    compareCopyrightScope,
    detectNumbers,
    extractPdfSongs,
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

describe('detectNumbers (Lied- und Choralbuchnummer)', () => {
    const PAGE_HEIGHT = 481.9;
    const SIZE_HINT = 10.8;
    // Kopfsteg wie im Druck: Liednummer 20 pt, Choralbuchnummer 11 pt darunter,
    // beide in derselben Schrift.
    const liednummer = { str: '275', x: 275.4, yTop: 48.7, width: 30, size: 20, font: 'f_num' };
    const choralnummer = { str: '168', x: 280.9, yTop: 70.4, width: 16.1, size: 11, font: 'f_num' };

    it('erkennt beide Nummern', () => {
        const { numberItem, choralItem } = detectNumbers(
            [liednummer, choralnummer],
            PAGE_HEIGHT,
            SIZE_HINT,
        );
        expect(numberItem?.str).toBe('275');
        expect(choralItem?.str).toBe('168');
    });

    it('hält Notensatz-Ziffern (Triole) aus der Choralbuchnummer heraus', () => {
        // Seite 150 / Lied 275: die Triolen-„3" steht in der Notensatz-Schrift
        // zwischen den beiden Nummern und stand vor pdf.js in der Item-Liste.
        const triole = { str: '3', x: 246.6, yTop: 80.6, width: 3.2, size: 6.36, font: 'f_music' };
        const { choralItem } = detectNumbers(
            [triole, liednummer, choralnummer],
            PAGE_HEIGHT,
            SIZE_HINT,
        );
        expect(choralItem?.str).toBe('168');
    });

    it('liefert keine Choralbuchnummer, wenn nur Notensatz-Ziffern darunter stehen', () => {
        const triole = { str: '3', x: 246.6, yTop: 80.6, width: 3.2, size: 6.36, font: 'f_music' };
        const { numberItem, choralItem } = detectNumbers(
            [liednummer, triole],
            PAGE_HEIGHT,
            SIZE_HINT,
        );
        expect(numberItem?.str).toBe('275');
        expect(choralItem).toBe(null);
    });

    it('liefert nichts ohne groß gesetzte Liednummer', () => {
        const { numberItem, choralItem } = detectNumbers([choralnummer], PAGE_HEIGHT, SIZE_HINT);
        expect(numberItem).toBe(null);
        expect(choralItem).toBe(null);
    });
});

// --- extractPdfSongs: Seitenzerlegung -------------------------------------

const WIDTH = 311.811;
const HEIGHT = 481.89;
// Eine Glyphe aus dem Private-Use-Bereich = platzierter Notensatz. Bewusst als
// Escape geschrieben: Das Zeichen selbst ist im Editor unsichtbar.
const MUSIC = '\ue050';

// Minimaler PDFDocumentProxy-Ersatz: je Seite eine Item-Liste in der Form, die
// pdf.js liefert (transform[3] = Schriftgrad, transform[5] = Grundlinie von
// unten).
function fakePdf(pages) {
    return {
        numPages: pages.length,
        getPage: async (p) => ({
            getViewport: () => ({ width: WIDTH, height: HEIGHT }),
            getTextContent: async () => ({
                items: pages[p - 1].map((it) => {
                    const size = it.size ?? 10.8;
                    return {
                        str: it.str,
                        width: it.width ?? it.str.length * size * 0.5,
                        height: size,
                        transform: [size, 0, 0, size, it.x, HEIGHT - it.yTop],
                        fontName: it.font ?? 'f_text',
                    };
                }),
            }),
        }),
    };
}

// Kopfsteg einer Liedseite: Liednummer 20 pt, Choralbuchnummer 11 pt darunter.
const kopf = (nummer, choral) => [
    { str: nummer, x: 6.2, yTop: 48.7, width: 29.6, size: 20, font: 'f_num' },
    { str: choral, x: 12.7, yTop: 70.4, width: 15.1, size: 11, font: 'f_num' },
];
const noten = (yTop = 120) => ({ str: MUSIC, x: 100, yTop, size: 15.12, font: 'f_music' });
const strophe = (str, yTop) => ({ str, x: 28.1, yTop, size: 10.8 });
const fusszeile = (str, yTop = 263.1) => ({ str, x: 28.1, yTop, size: 7 });

describe('extractPdfSongs (Seiten ohne Fließtext)', () => {
    const nurNummern = [...kopf('265', '161'), noten()];

    it('erkennt die Liednummer auch ohne Fließtext auf der Seite', async () => {
        // Seite 378 im Druck: Strophe 1 und Fußzeile stecken komplett im
        // platzierten Notensatz, im Text-Layer stehen nur „265" (20 pt) und
        // „161" (11 pt). Seitenlokal gemessen wären die Nummern ihre eigene
        // Größenreferenz und fielen durch den Test – der Fließtext-Grad der
        // vorherigen Seiten muss deshalb weitergelten.
        const textseite = [
            ...kopf('264', '160'),
            noten(),
            strophe('2. Der Herr ist mein Hirte', 200),
            fusszeile('Text: Jens Lehmann (1966)'),
        ];
        const { songs } = await extractPdfSongs(fakePdf([textseite, nurNummern]));
        expect(songs.map((s) => s.nummer)).toEqual(['264', '265']);
        expect(songs[1].choralnummer).toBe('161');
    });

    it('fällt auf die Seitenmessung zurück, wenn noch kein Fließtext kam', async () => {
        // Notlösung für den Fall, dass die erste Liedseite überhaupt keinen
        // Fließtext hat: Dann bleibt nur der seitenlokale Median – die Nummer
        // wird nicht erkannt, die Seite gilt als Lied ohne Nummer (statt zu
        // verschwinden).
        const { songs } = await extractPdfSongs(fakePdf([nurNummern]));
        expect(songs).toHaveLength(1);
        expect(songs[0].nummer).toBe(null);
    });
});

describe('extractPdfSongs (mehrseitiger Notensatz vs. fehlende Liednummer)', () => {
    // Erste Seite eines Liedes, dessen Notensatz länger als eine Seite ist:
    // Nummern und Noten, aber weder Strophen noch Fußzeile (Seite 378).
    const angefangen = [...kopf('265', '161'), noten()];
    // Fortsetzungsseite: weiter Notensatz, keine Liednummer, darunter der
    // Strophenrest und die Fußzeile (Seite 379).
    const fortsetzung = [
        noten(),
        strophe('2. Ich darf auch traurig sein', 173.9),
        fusszeile('Text und Melodie: Betty Noack (1993)', 271.2),
    ];

    it('schlägt die Fortsetzungsseite dem angefangenen Lied zu', async () => {
        const vorher = [
            ...kopf('264', '160'),
            noten(),
            strophe('2. Der Herr ist mein Hirte', 200),
            fusszeile('Text: Jens Lehmann (1966)'),
        ];
        const { songs } = await extractPdfSongs(fakePdf([vorher, angefangen, fortsetzung]));
        expect(songs.map((s) => s.nummer)).toEqual(['264', '265']);
        const lied = songs[1];
        expect(lied.pages).toEqual([2, 3]);
        expect(lied.verses.map((v) => v.text)).toEqual(['Ich darf auch traurig sein']);
        expect(lied.footerText).toBe('Text und Melodie: Betty Noack (1993)');
        // Beide Notensatz-Platzierungen gehören dem Lied.
        expect(lied.placements.map((pl) => pl.page)).toEqual([2, 3]);
    });

    it('meldet weiterhin ein Lied, dessen Liednummer im Druck fehlt', async () => {
        // Seite 144: Das vorherige Lied ist mit seiner Fußzeile abgeschlossen,
        // die nummernlose Notenseite ist also ein NEUES Lied ohne Nummer – ein
        // Satzfehler, der ein Befund bleiben muss.
        const abgeschlossen = [
            ...kopf('99', '60'),
            noten(),
            strophe('2. Der Herr ist mein Hirte', 200),
            fusszeile('Text: Jens Lehmann (1966)'),
        ];
        const ohneNummer = [
            noten(),
            strophe('2. Eine ganz andere Strophe', 173.9),
            fusszeile('Text: Wer auch immer (1900)', 271.2),
        ];
        const { songs } = await extractPdfSongs(fakePdf([abgeschlossen, ohneNummer]));
        expect(songs).toHaveLength(2);
        expect(songs.map((s) => s.nummer)).toEqual(['99', null]);
        expect(songs[1].pages).toEqual([2]);
    });
});
