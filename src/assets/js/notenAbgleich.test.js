import { describe, it, expect } from 'vitest';
import {
    compareAbgleich,
    compareLyrics,
    engravingFromFingerprint,
    lyricsToMark,
    pitchName,
    readMusicXml,
} from '@/assets/js/notenAbgleich';
import { stavesFromLines } from '@/assets/js/notenFingerprint';

// Ein Fünfliniensystem 40–55.2 pt (Linienabstand 3.8): unterste Linie E4,
// jede halbe Linie eine Stufe höher.
const TOP = 40;
const BOTTOM = 55.2;
const HALF = 1.9;
const yOf = (steps) => BOTTOM - steps * HALF; // Stufen über E4

const G = {
    clef: 0xe050,
    flat: 0xe260,
    sharp: 0xe262,
    black: 0xe0a4,
    digit: (n) => 0xe080 + n,
};

// Fingerabdruck-Seite aus [code, x, y]-Tripeln.
function fpPage(glyphs, staves = [[TOP, BOTTOM]]) {
    return {
        seq: glyphs.map(([c]) => String.fromCodePoint(c)).join(''),
        x: glyphs.map(([, x]) => x),
        y: glyphs.map(([, , y]) => y),
        ...(staves ? { staves } : {}),
    };
}

// F-Dur, 3/4, Noten F4 G4 A4.
const F_DUR = [
    [G.clef, 10, yOf(2)],
    [G.flat, 20, yOf(4)],
    [G.digit(3), 30, yOf(6)],
    [G.digit(4), 30, yOf(2)],
    [G.black, 50, yOf(1)],
    [G.black, 60, yOf(2)],
    [G.black, 70, yOf(3)],
];

function musicXml({ fifths = -1, time = [3, 4], notes = ['F4', 'G4', 'A4'], extra = '' } = {}) {
    const body = notes
        .map(
            (n) =>
                `<note><pitch><step>${n[0]}</step><octave>${n.slice(1)}</octave></pitch>` +
                '<type>quarter</type></note>',
        )
        .join('');
    return (
        '<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1">' +
        `<measure number="1"><attributes><key><fifths>${fifths}</fifths></key>` +
        `<time><beats>${time[0]}</beats><beat-type>${time[1]}</beat-type></time>` +
        `<clef><sign>G</sign><line>2</line></clef></attributes>${body}${extra}</measure></part></score-partwise>`
    );
}

const check = (glyphs, xml, staves) =>
    compareAbgleich(
        engravingFromFingerprint({ pages: [fpPage(glyphs, staves)] }),
        readMusicXml(xml),
    );

describe('readMusicXml', () => {
    it('liest Tonart, Taktart und Tonhöhen', () => {
        const s = readMusicXml(musicXml());
        expect(s.key).toBe(-1);
        expect([...s.times]).toEqual(['3/4']);
        expect([...s.pitches].map(([p, n]) => `${pitchName(p)}:${n}`)).toEqual([
            'F4:1',
            'G4:1',
            'A4:1',
        ]);
        expect(s.otherClefs).toEqual([]);
    });
    it('zählt Pausen und Unsichtbares nicht, Auftakt-Taktarten auch nicht', () => {
        const extra =
            '<note><rest/><type>quarter</type></note>' +
            '<note print-object="no"><pitch><step>C</step><octave>5</octave></pitch></note>' +
            '<attributes><time><beats>43</beats><beat-type>2048</beat-type></time></attributes>';
        const s = readMusicXml(musicXml({ extra }));
        expect([...s.pitches.values()].reduce((a, b) => a + b, 0)).toBe(3);
        expect([...s.times]).toEqual(['3/4']);
    });
});

describe('compareAbgleich', () => {
    it('keine Befunde, wenn PDF und MusicXML zusammenpassen', () => {
        expect(check(F_DUR, musicXml())).toEqual([]);
    });

    it('meldet andere Tonart und Transposition als Sperrgrund', () => {
        // „Bist zu uns wie ein Vater": MusicXML noch in E-Dur, eine Stufe tiefer.
        const befunde = check(F_DUR, musicXml({ fifths: 4, notes: ['E4', 'F4', 'G4'] }));
        expect(befunde.map((b) => b.sperrt)).toEqual([true, true]);
        expect(befunde[0].text).toBe('Tonart: PDF 1 ♭, MusicXML 4 ♯');
        expect(befunde[1].text).toContain('1 Stufe(n) höher (anders transponiert)');
    });

    it('eine glatte Oktave ist nur ein Hinweis', () => {
        const befunde = check(F_DUR, musicXml({ notes: ['F3', 'G3', 'A3'] }));
        expect(befunde).toHaveLength(1);
        expect(befunde[0].sperrt).toBe(false);
        expect(befunde[0].text).toContain('eine Oktave höher');
    });

    it('geänderte Noten sperren', () => {
        const befunde = check(F_DUR, musicXml({ notes: ['F4', 'G4', 'C5'] }));
        expect(befunde).toEqual([
            {
                text: 'Tonhöhen: PDF 3 Noten, MusicXML 3 — nur im PDF: 1× A4; nur in MusicXML: 1× C5',
                sperrt: true,
            },
        ]);
    });

    it('meldet gedruckte Taktarten, die der MusicXML fehlen', () => {
        const befunde = check(F_DUR, musicXml({ time: [4, 4] }));
        expect(befunde[0]).toEqual({
            text: 'Taktart: PDF zeigt 3/4, MusicXML hat 4/4',
            sperrt: true,
        });
    });

    it('ohne Notenlinien zählen die Vorzeichen späterer Systeme nicht zur Tonart', () => {
        // Zweites System 40 pt tiefer: wiederholt das ♭ am Zeilenanfang, ohne
        // Schlüssel-Glyphe (die ist dort Vektorgrafik).
        const zweitesSystem = [
            [G.flat, 20, yOf(4) + 40],
            [G.black, 50, yOf(1) + 40],
        ];
        const befunde = check(
            [...F_DUR, ...zweitesSystem],
            musicXml({ notes: ['F4', 'G4', 'A4', 'F4'] }),
            null,
        );
        expect(befunde.filter((b) => b.sperrt)).toEqual([]);
    });

    it('ohne Notenlinien: Tonart und Notenzahl, Tonhöhen nur als Hinweis', () => {
        const ok = check(F_DUR, musicXml(), null);
        expect(ok).toHaveLength(1);
        expect(ok[0].sperrt).toBe(false);

        const befunde = check(F_DUR, musicXml({ notes: ['F4', 'G4'] }), null);
        expect(befunde[0]).toEqual({
            text: 'Notenzahl: PDF 3 Notenköpfe, MusicXML 2 Noten',
            sperrt: true,
        });
    });
});

describe('Liedtext', () => {
    const lyric = (text, syllabic = 'single', number = 1) =>
        `<note><pitch><step>C</step><octave>5</octave></pitch><lyric number="${number}">` +
        `<syllabic>${syllabic}</syllabic><text>${text}</text></lyric></note>`;

    it('setzt die Wörter aus den Silben zusammen, je Lyric-Nummer', () => {
        const extra =
            lyric('Hal', 'begin') +
            lyric('le', 'middle', 1) +
            lyric('Wie', 'single', 2) +
            lyric('lu', 'middle') +
            lyric('ja!', 'end') +
            lyric('Seit&apos;');
        expect(readMusicXml(musicXml({ notes: [], extra })).words).toEqual([
            'Wie',
            'Halleluja!',
            "Seit'",
        ]);
    });

    it('vergleicht nur Buchstaben, ohne Reihenfolge', () => {
        expect(
            compareLyrics('Seit an Sei - te, Hal - le - lu - ja!', [
                'Halleluja',
                "Seit'",
                'an',
                'Seite',
            ]),
        ).toEqual({ onlyPdf: [], onlyXml: [] });
    });

    it('meldet geänderte Wörter und Großschreibung', () => {
        expect(compareLyrics('Lass uns Dein Lob', ['Laß', 'uns', 'dein', 'Lob'])).toEqual({
            onlyPdf: ['Dein', 'Lass'],
            onlyXml: ['dein', 'Laß'],
        });
    });

    it('ein über den Umbruch geteiltes Wort ist kein Unterschied', () => {
        expect(compareLyrics('bit ten er schie - nen', ['bitten', 'erschienen'])).toEqual({
            onlyPdf: [],
            onlyXml: [],
        });
        expect(compareLyrics('wir bitten', ['wir', 'bit', 'ten'])).toEqual({
            onlyPdf: [],
            onlyXml: [],
        });
    });
});

describe('lyricsToMark', () => {
    it('markiert nur das abweichende Vorkommen, nicht jedes gleiche Wort', () => {
        const xml = ['wo', 'dein', 'Werk', 'hin', 'und', 'dein', 'Werk', 'lebt'];
        expect(lyricsToMark('wo dein Werk hin und Dein Werk lebt', xml, ['dein'])).toEqual([5]);
    });

    it('ohne Abweichung nichts', () => {
        expect(lyricsToMark('wir bit - ten', ['wir', 'bitten'], [])).toEqual([]);
    });
});

describe('stavesFromLines', () => {
    const line = (y, x0 = 40, x1 = 280) => ({ y, x0, x1 });
    it('gruppiert gleichmäßig gestapelte Linien zu Systemen', () => {
        const lines = [48.6, 52.44, 56.16, 60, 63.84, 91.56, 95.4, 99.24, 102.96, 106.8].map((y) =>
            line(y),
        );
        expect(stavesFromLines(lines)).toEqual([
            { top: 48.6, bottom: 63.84 },
            { top: 91.56, bottom: 106.8 },
        ]);
    });
    it('eine Volta-Klammer über dem System kostet das System nicht', () => {
        const lines = [44, 48.6, 52.44, 56.16, 60, 63.84].map((y) => line(y));
        lines[0] = line(40.5);
        expect(stavesFromLines(lines)).toEqual([{ top: 48.6, bottom: 63.84 }]);
    });
});
