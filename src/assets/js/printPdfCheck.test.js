import { describe, it, expect } from 'vitest';
import {
    canon,
    checkToTsv,
    compareCopyrightScope,
    comparePrintPdf,
    detectNumbers,
    extractPdfSongs,
    footerSignature,
    footerSignaturesMatch,
    isEnglishSong,
    makeCheck,
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

    it('nimmt bei übereinanderliegenden Nummern die obenauf gezeichnete', () => {
        // Seite 106 / Lied 74: Die korrigierte „225" liegt über der alten
        // „226"; beide stehen im Text-Layer, die alte zuerst.
        const alt = [
            { ...liednummer, str: '74', yTop: 48.7 },
            { ...choralnummer, str: '226', yTop: 70.4 },
        ];
        const neu = [
            { ...liednummer, str: '74', x: liednummer.x + 0.1, yTop: 48.9 },
            { ...choralnummer, str: '225', x: choralnummer.x - 0.1, yTop: 70.6 },
        ];
        const { numberItem, choralItem, covered } = detectNumbers(
            [...alt, ...neu],
            PAGE_HEIGHT,
            SIZE_HINT,
        );
        expect(numberItem).toBe(neu[0]);
        expect(choralItem?.str).toBe('225');
        expect(covered).toEqual([
            { item: alt[0], by: neu[0] },
            { item: alt[1], by: neu[1] },
        ]);
    });

    it('findet die Choralbuchnummer auch knapp unter der Seitenmitte', () => {
        // Seite 107 / Lied 279: Der Strophenüberhang von Lied 278 schiebt den
        // Liedblock nach unten – die Liednummer steht gerade noch in der oberen
        // Hälfte (y=228), die Choralbuchnummer schon darunter (y=249).
        const { numberItem, choralItem } = detectNumbers(
            [
                { ...liednummer, str: '279', x: 5.7, yTop: 227.7 },
                { ...choralnummer, str: '141', x: 12.6, yTop: 249.4 },
            ],
            PAGE_HEIGHT,
            SIZE_HINT,
        );
        expect(numberItem?.str).toBe('279');
        expect(choralItem?.str).toBe('141');
    });

    it('erkennt einen Liedblock auch ganz in der unteren Seitenhälfte', () => {
        // Langer Strophenüberhang des vorherigen Liedes: Beide Nummern rutschen
        // unter die Seitenmitte.
        const { numberItem, choralItem } = detectNumbers(
            [
                { ...liednummer, yTop: PAGE_HEIGHT * 0.5 + 30 },
                { ...choralnummer, yTop: PAGE_HEIGHT * 0.5 + 52 },
            ],
            PAGE_HEIGHT,
            SIZE_HINT,
        );
        expect(numberItem?.str).toBe('275');
        expect(choralItem?.str).toBe('168');
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

describe('extractPdfSongs (verdeckte Nummern)', () => {
    // Seite 106 / Lied 74: Die Korrektur „225" wurde über die alte „226" gelegt.
    const seite = [
        ...kopf('74', '226'),
        noten(),
        strophe('2. Die Hand des Herrn ist überall', 200),
        fusszeile('Text: Ulrike Gehde (1959)'),
        ...kopf('74', '225'),
    ];

    it('liest die sichtbare Nummer und meldet die verdeckte', async () => {
        const extracted = await extractPdfSongs(fakePdf([seite]));
        expect(extracted.songs[0].choralnummer).toBe('225');
        expect(extracted.coveredNumbers).toEqual([
            expect.objectContaining({
                page: 1,
                pairs: [
                    { hidden: '74', visible: '74' },
                    { hidden: '226', visible: '225' },
                ],
            }),
        ]);
        const check = comparePrintPdf(extracted, []).find((c) => c.id === 'covered-numbers');
        expect(check.items).toHaveLength(1);
        expect(check.items[0].sev).toBe('warning');
        expect(check.items[0].detail).toBe(
            'Seite 1: „74" liegt doppelt übereinander, unter „225" liegt verdeckt „226"',
        );
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

describe('comparePrintPdf (Refrain-Blöcke)', () => {
    const R = 'Herr, wir bitten: Komm und segne uns.';
    const lied = (strophen) => ({
        id: 1,
        liednummer2026: 250,
        status: 'accepted',
        titel: 'Herr, wir bitten',
        text: { strophenEinzeln: strophen.map((strophe) => ({ strophe })) },
    });
    const run = async (zeilen, strophen) => {
        const seite = [...kopf('250', '151'), noten(), ...zeilen];
        const checks = comparePrintPdf(await extractPdfSongs(fakePdf([seite])), [lied(strophen)]);
        const items = (id) => checks.find((c) => c.id === id).items;
        return {
            text: items('verse-text'),
            count: items('verse-count'),
            spacing: items('verse-spacing'),
        };
    };

    it('ordnet einen Refrain vor Strophe 2 dem Anfang von Strophe 2 zu (Lied 250)', async () => {
        // Die DB trägt den Refrain vorn in Strophe 2, der Satz druckt ihn als
        // eigenen Block direkt unter dem Notensatz.
        const { text, count } = await run(
            [
                strophe('Refrain', 200),
                strophe(R, 213),
                strophe('2. In die Schuld der Welt hast du uns gestellt.', 235),
                strophe('3. In den Streit der Welt hast du uns gestellt.', 257),
            ],
            [
                `Refrain\n${R}\n\nIn die Nacht der Welt`,
                `Refrain\n${R}\n\nIn die Schuld der Welt hast du uns gestellt.`,
                'In den Streit der Welt hast du uns gestellt.',
            ],
        );
        expect(count).toEqual([]);
        expect(text).toEqual([]);
    });

    it('verschiebt Refrains hinter den Strophen an den Anfang der nächsten (Lied 135)', async () => {
        // DB: jede Strophe beginnt mit dem Refrain, die letzte hat ihn auch
        // hinten. Der Satz druckt ihn hinter jede Strophe – dieselbe Folge.
        const { text, count } = await run(
            [
                strophe('Refrain', 200),
                strophe(R, 213),
                strophe('2. Noch ist alles um mich still.', 235),
                strophe('Refrain', 257),
                strophe(R, 270),
                strophe('3. Was mir Angst und Sorgen schafft.', 292),
                strophe('Refrain', 314),
                strophe(R, 327),
            ],
            [
                `Refrain\n${R}\n\nWarst die ganze Nacht mir nah.`,
                `Refrain\n${R}\n\nNoch ist alles um mich still.`,
                `Refrain\n${R}\n\nWas mir Angst und Sorgen schafft.\n\nRefrain\n${R}`,
            ],
        );
        expect(count).toEqual([]);
        expect(text).toEqual([]);
    });

    it('meldet einen Refrain, der in der DB fehlt, weiterhin', async () => {
        const { text } = await run(
            [
                strophe('2. Noch ist alles um mich still.', 200),
                strophe('Refrain', 222),
                strophe(R, 235),
            ],
            ['Warst die ganze Nacht mir nah.', 'Noch ist alles um mich still.'],
        );
        expect(text).toHaveLength(1);
    });

    it('meldet einen nummerierten Refrain als EINEN Befund (Lied 286)', async () => {
        const F = 'Freude, immer wieder Freude uns das Werk des Schöpfers schenkt!';
        const { text, count, spacing } = await run(
            [
                strophe('2. Ein Grünen und Blühen, so weit wie ich schau,', 200),
                strophe('am Himmel kein Wölkchen im leuchtenden Blau!', 213),
                strophe('Refrain', 235),
                strophe(F, 248),
                strophe('3. Mein Herz ist erfüllt, und so kann ich nicht ruhn,', 270),
                strophe('es treibt mich die Liebe, ein Gutes zu tun.', 283),
                strophe('Refrain', 305),
                strophe(`4. ${F}`, 318),
            ],
            [
                `Ich wandre durch Täler\n\nRefrain\n${F}`,
                `Ein Grünen und Blühen, so weit wie ich schau, am Himmel kein Wölkchen im leuchtenden Blau!\n\nRefrain\n${F}`,
                `Mein Herz ist erfüllt, und so kann ich nicht ruhn, es treibt mich die Liebe, ein Gutes zu tun.\n\nRefrain\n${F}`,
            ],
        );
        expect(count.map((i) => i.detail)).toEqual([
            'Refrain nach Strophe 3 ist im Satz als „4." nummeriert – der Refrain trägt keine Strophennummer',
        ]);
        expect(text).toEqual([]);
        expect(spacing).toEqual([]);
    });
});

describe('isEnglishSong', () => {
    const lied = (titel, s1, extra = {}) => ({
        titel,
        text: { strophenEinzeln: [{ strophe: s1 }] },
        ...extra,
    });

    it('erkennt englische Lieder auch ohne deutsche Fassung (Lied 344)', () => {
        expect(
            isEnglishSong(
                lied(
                    'Let the Words of the Lord',
                    'Let the words of the Lord Jesus Christ dwell in you.',
                ),
            ),
        ).toBe(true);
    });

    it('nimmt bei Übersetzungen die zweite Titel-Hälfte (Lied 230)', () => {
        expect(
            isEnglishSong(
                lied(
                    'Herbei, all ihr Gläubigen / O Come, All Ye Faithful',
                    'O come, all ye faithful',
                    {
                        deutscheLiedfassung: 1,
                    },
                ),
            ),
        ).toBe(true);
    });

    it('lässt mehrsprachige Lieder mit deutscher erster Strophe deutsch (Lied 353)', () => {
        expect(
            isEnglishSong(
                lied(
                    'Lobsingt, ihr Völker alle, lobsingt und preist den Herrn / Laudate omnes gentes',
                    'Lobsingt, ihr Völker alle, lobsingt und preist den Herrn',
                ),
            ),
        ).toBe(false);
    });
});

describe('comparePrintPdf (Sprach-Kennzeichnung)', () => {
    const deutsch = {
        id: 1,
        liednummer2026: 230,
        status: 'accepted',
        titel: 'Herbei, all ihr Gläubigen',
        text: {
            strophenEinzeln: [
                { strophe: 'Herbei, o ihr Gläub’gen, fröhlich triumphieret' },
                { strophe: 'Du König der Ehren, Herrscher der Heerscharen' },
            ],
        },
    };
    const englisch = {
        id: 2,
        liednummer2026: null,
        deutscheLiedfassung: 1,
        status: 'accepted',
        titel: 'Herbei, all ihr Gläubigen / O Come, All Ye Faithful',
        text: {
            strophenEinzeln: [
                { strophe: 'O come, all ye faithful, joyful and triumphant' },
                { strophe: 'Sing, choirs of angels, sing in exultation' },
            ],
        },
    };
    const label = (str, size = 7) => ({ str, x: 42.6, yTop: 19.3, size });
    const run = async (seiteDe, seiteEn) => {
        const checks = comparePrintPdf(await extractPdfSongs(fakePdf([seiteDe, seiteEn])), [
            deutsch,
            englisch,
        ]);
        return checks.find((c) => c.id === 'language-label').items;
    };
    // Je eine Textstrophe, damit die beiden Seiten ihren Fassungen zugeordnet
    // werden (Zuordnung über den Strophentext).
    const de = (...extra) => [
        ...extra,
        ...kopf('230', '139'),
        noten(),
        strophe('2. Du König der Ehren, Herrscher der Heerscharen', 200),
    ];
    const en = (...extra) => [
        ...extra,
        ...kopf('230', '139'),
        noten(),
        strophe('2. Sing, choirs of angels, sing in exultation', 200),
    ];

    it('meldet nichts bei „ENGLISCH" in 7 pt über der Übersetzung', async () => {
        expect(await run(de(), en(label('ENGLISCH')))).toEqual([]);
    });

    it('meldet die fehlende Kennzeichnung (Seite 41)', async () => {
        const items = await run(de(), en());
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ sev: 'error', id: 2, nummer: '230' });
        expect(items[0].loc.page).toBe(2);
    });

    it('meldet falschen Schriftgrad, Kleinschreibung und falsche Sprache', async () => {
        expect((await run(de(), en(label('ENGLISCH', 8)))).map((i) => i.detail)).toEqual([
            expect.stringContaining('8 pt statt 7 pt'),
        ]);
        expect((await run(de(), en(label('Englisch')))).map((i) => i.detail)).toEqual([
            expect.stringContaining('nicht in Versalien'),
        ]);
        expect((await run(de(), en(label('FRANZÖSISCH')))).map((i) => i.detail)).toEqual([
            expect.stringContaining('erwartet „ENGLISCH"'),
        ]);
    });

    it('warnt bei einer Kennzeichnung über dem deutschen Lied', async () => {
        const items = await run(de(label('ENGLISCH')), en(label('ENGLISCH')));
        expect(items.map((i) => [i.sev, i.id])).toEqual([['warning', 1]]);
    });
});

describe('checkToTsv (Befunde kopieren, Issue #120)', () => {
    const copyTable = {
        header: ['PDF', 'DB', 'Lied', 'Titel'],
        row: (it) => [it.pdfChoral, it.dbChoral, it.nummer, it.title],
    };
    it('liefert Kopfzeile + eine Tab-getrennte Zeile je Befund', () => {
        const check = makeCheck(
            'choral',
            'x',
            'Choralbuchnummer',
            '',
            [
                {
                    sev: 'error',
                    pdfChoral: '316',
                    dbChoral: '315',
                    nummer: 22,
                    title: 'Auf, bleibet treu',
                },
                {
                    sev: 'warning',
                    pdfChoral: '',
                    dbChoral: '7',
                    nummer: 30,
                    title: 'Tab\tim\nTitel',
                },
            ],
            { copyTable },
        );
        expect(checkToTsv(check)).toBe(
            'PDF\tDB\tLied\tTitel\n316\t315\t22\tAuf, bleibet treu\n\t7\t30\tTab im Titel',
        );
    });
    it('ohne copyTable leer', () => {
        expect(checkToTsv(makeCheck('a', 'x', 'A', '', [], {}))).toBe('');
    });
});
