import { describe, it, expect } from 'vitest';
import {
    compareIvzPdf,
    detectColumns,
    detectPdfKind,
    extractIvzEntries,
    titleVariants,
    titleVerdict,
} from '@/assets/js/inhaltsverzeichnisPdfCheck';

// Maße der echten Inhaltsverzeichnis-PDF (quer, zwei Spalten je Seite).
const WIDTH = 640.63;
const HEIGHT = 498.9;
const SIZE = 10.8;
// Rechte Kante der beiden Nummernspalten (die Nummern stehen rechtsbündig).
const NUM_RIGHT = [73.1, 370.8];
const TITLE_X = [87.5, 385.6];
const ROW_STEP = 13; // Zeilenabstand im Satz

// Minimaler PDFDocumentProxy-Ersatz (wie in printPdfCheck.test.js).
function fakePdf(pages) {
    return {
        numPages: pages.length,
        getPage: async (p) => ({
            getViewport: () => ({ width: WIDTH, height: HEIGHT }),
            getTextContent: async () => ({
                items: pages[p - 1].map((it) => {
                    const size = it.size ?? SIZE;
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

// Eine Zeile „<nummer>  <titel>" in Spalte `col` (0/1), Zeile `row`.
function zeile(nummer, titel, { col = 0, row = 0 } = {}) {
    const yTop = 50.4 + row * ROW_STEP;
    const out = [];
    if (nummer != null) {
        const width = String(nummer).length * SIZE * 0.5;
        out.push({ str: String(nummer), x: NUM_RIGHT[col] - width, yTop, width });
    }
    if (titel != null) out.push({ str: titel, x: TITLE_X[col], yTop });
    return out;
}

// Eine ganze Spalte aus [nummer, titel]-Paaren; `null` als Nummer erzeugt eine
// Fortsetzungszeile (umbrochener Titel).
function spalte(paare, col = 0) {
    return paare.flatMap(([nummer, titel], row) => zeile(nummer, titel, { col, row }));
}

const lied = (id, nummer, titel, extra = {}) => ({
    id,
    titel,
    liednummer2026: nummer,
    status: 'accepted',
    deutscheLiedfassung: null,
    ...extra,
});

// Der Spaltenaufbau wird aus den Liednummern gelesen (rechtsbündige Kante) –
// dafür braucht eine Testseite ein paar Zeilen mehr als den eigentlichen
// Prüffall. Die Füllzeilen stehen auch in der Test-Datenbank und erzeugen
// deshalb keine Befunde.
const FUELL = ['A', 'B', 'C', 'D', 'E'].map((s, i) => [900 + i, `Füllzeile ${s}`]);
const fuellLieder = FUELL.map(([nummer, titel], i) => lied(900 + i, nummer, titel));

describe('detectColumns', () => {
    it('findet die Spalten an den rechten Kanten der Liednummern', () => {
        const items = [
            ...spalte(
                Array.from({ length: 6 }, (_, i) => [i + 1, `Titel ${i + 1}`]),
                0,
            ),
            ...spalte(
                Array.from({ length: 6 }, (_, i) => [i + 7, `Titel ${i + 7}`]),
                1,
            ),
        ].map((it) => ({ ...it, size: SIZE, width: it.width ?? it.str.length * SIZE * 0.5 }));
        const cols = detectColumns([items]);
        expect(cols).toHaveLength(2);
        expect(cols[0].right).toBeCloseTo(NUM_RIGHT[0], 1);
        expect(cols[1].right).toBeCloseTo(NUM_RIGHT[1], 1);
        // Die erste Spalte reicht bis zum Beginn der zweiten.
        expect(cols[0].end).toBeLessThan(TITLE_X[1]);
        expect(cols[0].end).toBeGreaterThan(TITLE_X[0]);
    });

    it('ignoriert vereinzelte Zahlen (Liedseiten tragen nur Lied-/Choralbuchnummer)', () => {
        const items = [
            { str: '265', x: 6.2, yTop: 48.7, width: 29.6, size: 20 },
            { str: '161', x: 12.7, yTop: 70.4, width: 15.1, size: 11 },
        ];
        expect(detectColumns([items])).toHaveLength(0);
    });
});

describe('detectPdfKind', () => {
    const ivzSeite = spalte(
        Array.from({ length: 8 }, (_, i) => [i + 1, `Titel ${i + 1}`]),
        0,
    );
    it('erkennt eine Inhaltsverzeichnis-PDF', async () => {
        expect(await detectPdfKind(fakePdf([ivzSeite]))).toBe('inhaltsverzeichnis');
    });
    it('hält eine Liedseite für den Liederteil', async () => {
        const liedseite = [
            { str: '265', x: 6.2, yTop: 48.7, width: 29.6, size: 20 },
            { str: '2. Der Herr ist mein Hirte', x: 28.1, yTop: 200 },
        ];
        expect(await detectPdfKind(fakePdf([liedseite]))).toBe('lieder');
    });
});

describe('extractIvzEntries', () => {
    it('liest Nummer und Titel spaltenweise in Lesereihenfolge', async () => {
        const links = Array.from({ length: 6 }, (_, i) => [i + 1, `Lied ${i + 1}`]);
        const rechts = Array.from({ length: 6 }, (_, i) => [i + 30, `Lied ${i + 30}`]);
        const seite = [...spalte(links, 0), ...spalte(rechts, 1)];
        const { entries } = await extractIvzEntries(fakePdf([seite]));
        // Erst die linke Spalte ganz, dann die rechte – wie gelesen wird.
        expect(entries.map((e) => `${e.nummer}|${e.titel}`)).toEqual(
            [...links, ...rechts].map(([n, t]) => `${n}|${t}`),
        );
    });

    it('fügt umbrochene Titel zusammen und löst die Silbentrennung auf', async () => {
        const seite = spalte(
            [
                [66, 'Der Herr hat wieder eingeladen, zum '],
                [null, 'Abendmahl geeint zu gehn'],
                [148, 'Einst leg ich ab den Wanderstab auf mei-'],
                [null, 'nem Weg zu dir'],
                [67, 'Der Herr ist Gott'],
                ...FUELL,
            ],
            0,
        );
        const { entries } = await extractIvzEntries(fakePdf([seite]));
        expect(entries.slice(0, 3).map((e) => e.titel)).toEqual([
            'Der Herr hat wieder eingeladen, zum Abendmahl geeint zu gehn',
            'Einst leg ich ab den Wanderstab auf meinem Weg zu dir',
            'Der Herr ist Gott',
        ]);
        // Zweite Lesart mit erhaltenem Bindestrich – für Titel, die am
        // Zeilenende wirklich einen Bindestrich tragen.
        expect(entries[1].titelHyphen).toBe(
            'Einst leg ich ab den Wanderstab auf mei-nem Weg zu dir',
        );
    });

    it('meldet Zeilen vor dem ersten Eintrag als übersprungen', async () => {
        const seiten = [
            [{ str: 'INHALTSVERZEICHNIS', x: 481.6, yTop: 50.4 }],
            [
                ...zeile('NR', 'ABC', { col: 0, row: 0 }),
                ...spalte([[null, null], [1, 'Abend wird es wieder'], ...FUELL], 0),
            ],
        ];
        const { entries, skipped } = await extractIvzEntries(fakePdf(seiten));
        expect(skipped.map((s) => s.text)).toEqual(['INHALTSVERZEICHNIS', 'NR ABC']);
        expect(entries[0].nummer).toBe('1');
    });
});

describe('titleVariants / titleVerdict', () => {
    it('lässt bei zweisprachigen Titeln jede Hälfte gelten', () => {
        expect(titleVariants('Nun danket alle Gott / Now Thank We All Our God')).toEqual([
            'Nun danket alle Gott / Now Thank We All Our God',
            'Nun danket alle Gott',
            'Now Thank We All Our God',
        ]);
    });

    const entry = (titel) => ({ titel, titelHyphen: titel });

    it('erkennt die gedruckte Titel-Hälfte als korrekt', () => {
        expect(
            titleVerdict(
                entry('Now Thank We All Our God'),
                'Nun danket alle Gott / Now Thank We All Our God',
            ),
        ).toBe('ok');
    });
    it('wertet typografische Varianten als gleich', () => {
        expect(
            titleVerdict(
                entry("Christen gibt's, die alles wagen"),
                'Christen gibt’s, die alles wagen',
            ),
        ).toBe('ok');
    });
    it('erkennt den fehlenden Klammerzusatz eigens', () => {
        expect(
            titleVerdict(
                entry('Bist zu uns wie ein Vater'),
                'Bist zu uns wie ein Vater (Unser Vater)',
            ),
        ).toBe('suffix');
    });
    it('meldet echte Abweichungen', () => {
        expect(
            titleVerdict(
                entry('Herr, mach uns stark im Mut, der dich bekennt'),
                'Herr, mach uns stark im Mut',
            ),
        ).toBe('diff');
    });
});

// --- compareIvzPdf ---------------------------------------------------------

// Eine Testseite aus [nummer, titel]-Paaren bauen (mit Füllzeilen, s. o.),
// prüfen lassen und die Befunde je Check zurückgeben.
async function run(paare, dbSongs) {
    const extracted = await extractIvzEntries(fakePdf([spalte([...paare, ...FUELL], 0)]));
    const checks = compareIvzPdf(extracted, [...dbSongs, ...fuellLieder]);
    return {
        checks,
        of: (id) => checks.find((c) => c.id === id),
        items: (id) => checks.find((c) => c.id === id)?.items ?? [],
    };
}

describe('compareIvzPdf', () => {
    it('meldet nichts, wenn Nummern und Titel stimmen', async () => {
        const seite = [
            [1, 'Abend wird es wieder'],
            [2, 'Ach, bleib mit deiner Gnade'],
        ];
        const db = [lied(1, 1, 'Abend wird es wieder'), lied(2, 2, 'Ach, bleib mit deiner Gnade')];
        const { checks } = await run(seite, db);
        expect(checks.filter((c) => c.status === 'error' || c.status === 'warning')).toEqual([]);
    });

    it('meldet abweichende Titel mit beiden Schreibweisen', async () => {
        const { items } = await run(
            [[1, 'Abend wird es wider']],
            [lied(1, 1, 'Abend wird es wieder')],
        );
        expect(items('ivz-title')).toHaveLength(1);
        expect(items('ivz-title')[0]).toMatchObject({
            sev: 'error',
            pdf: 'Abend wird es wider',
            expected: 'Abend wird es wieder',
        });
    });

    it('hält die fremdsprachige Fassung gegen ihren eigenen Titel', async () => {
        // Beide Fassungen tragen dieselbe Nummer; die Zuordnung darf die deutsche
        // Zeile nicht der Übersetzungs-Fassung zuschlagen (deren DB-Titel mit
        // genau demselben deutschen Titel beginnt).
        const seite = [
            [7, 'All unser Leben und Wandern'],
            [7, 'All Our Lives and Travels'],
        ];
        const db = [
            lied(1, 7, 'All unser Leben und Wandern'),
            lied(2, null, 'All unser Leben und Wandern / All Our Lives and Travels', {
                deutscheLiedfassung: 1,
            }),
        ];
        const { items } = await run(seite, db);
        expect(items('ivz-title')).toEqual([]);
        expect(items('ivz-missing')).toEqual([]);
        expect(items('ivz-duplicates')).toEqual([]);
    });

    it('meldet fehlende und überzählige Einträge', async () => {
        // Die Übersetzung von 75 ist im Druck als „76" nummeriert.
        const seite = [
            [75, 'Der Tag klingt aus'],
            [76, 'The Day is Drawing to a Close'],
            [76, 'Der uns heilge Engel sendet'],
        ];
        const db = [
            lied(1, 75, 'Der Tag klingt aus'),
            lied(2, null, 'Der Tag klingt aus / The Day is Drawing to a Close', {
                deutscheLiedfassung: 1,
            }),
            lied(3, 76, 'Der uns heilge Engel sendet'),
        ];
        const { items } = await run(seite, db);
        expect(items('ivz-missing').map((i) => i.nummer)).toEqual([75]);
        expect(items('ivz-duplicates').map((i) => i.nummer)).toEqual(['76']);
    });

    it('meldet nicht genommene und unbekannte Liednummern', async () => {
        const seite = [
            [1, 'Abend wird es wieder'],
            [2, 'Ein Entwurf'],
            [3, 'Gibt es gar nicht'],
        ];
        const db = [
            lied(1, 1, 'Abend wird es wieder'),
            lied(2, 2, 'Ein Entwurf', { status: 'draft' }),
        ];
        const { items } = await run(seite, db);
        expect(items('ivz-unknown').map((i) => [i.nummer, i.sev])).toEqual([
            ['2', 'warning'],
            ['3', 'error'],
        ]);
    });

    it('meldet Nummern, die nicht aufsteigen', async () => {
        const seite = [
            [1, 'Abend wird es wieder'],
            [3, 'Ach Herr, du meines Lebens Licht'],
            [2, 'Ach, bleib mit deiner Gnade'],
        ];
        const db = [
            lied(1, 1, 'Abend wird es wieder'),
            lied(2, 2, 'Ach, bleib mit deiner Gnade'),
            lied(3, 3, 'Ach Herr, du meines Lebens Licht'),
        ];
        const { items } = await run(seite, db);
        expect(items('ivz-order')).toHaveLength(1);
        expect(items('ivz-order')[0].nummer).toBe('2');
    });

    it('meldet eine auf die Fortsetzungszeile verrutschte Nummer als einen Befund', async () => {
        // Im Druck steht die 196 neben der zweiten Zeile von Lied 195.
        const seite = [
            [195, 'Gleich einem Baum, der gepflanzt an den '],
            [196, 'Bächen'],
            [null, 'Glocken läutet in den Landen'],
        ];
        const db = [
            lied(1, 195, 'Gleich einem Baum, der gepflanzt an den Bächen'),
            lied(2, 196, 'Glocken läutet in den Landen'),
        ];
        const { items } = await run(seite, db);
        expect(items('ivz-number-wrap')).toHaveLength(1);
        expect(items('ivz-number-wrap')[0].nummer).toBe('196');
        // Die beiden Titel gelten damit als geprüft – kein zweiter Befund.
        expect(items('ivz-title')).toEqual([]);
    });

    it('meldet einen weggelassenen Klammerzusatz nur als Warnung', async () => {
        const db = [lied(1, 40, 'Bist zu uns wie ein Vater (Unser Vater)')];
        const { items } = await run([[40, 'Bist zu uns wie ein Vater']], db);
        expect(items('ivz-title')).toEqual([]);
        expect(items('ivz-title-suffix')).toHaveLength(1);
        expect(items('ivz-title-suffix')[0].sev).toBe('warning');
    });

    it('gibt jedem Befund eine Fundstelle im PDF (für den Abgleich)', async () => {
        const { items } = await run(
            [[1, 'Abend wird es wider']],
            [lied(1, 1, 'Abend wird es wieder')],
        );
        const loc = items('ivz-title')[0].loc;
        expect(loc.page).toBe(1);
        expect(loc.rect.w).toBeGreaterThan(0);
    });
});
