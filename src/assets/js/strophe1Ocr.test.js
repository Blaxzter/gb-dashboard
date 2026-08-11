import { describe, expect, it } from 'vitest';
import {
    artLabel,
    formalLabel,
    OCR_SCHEMA,
    parseOcrData,
    VERDICT_ORDER,
    verdictMeta,
} from './strophe1Ocr.js';

// Aufbau wie in notenbild_strophe1_dashboard.json (gb-scripts,
// app/26-ocr-notenbild-strophe1.py).
function datei(overrides = {}) {
    return {
        schema: OCR_SCHEMA,
        erzeugt: '2026-08-10',
        quelle: 'app/26-ocr-notenbild-strophe1.py',
        ocr: { engine: 'tesseract', dpi: 300 },
        zusammenfassung: { identisch: 1, kleine_abweichung: 1 },
        lieder: [
            {
                song_id: '1371',
                text_id: '944',
                liednummer2026: 1,
                titel: 'Abend wird es wieder',
                bewertung: 'identisch',
                aehnlichkeit: 1.0,
                befunde: 0,
                abweichungen: [],
                gewichte_formal: {},
                hinweise: [],
            },
            {
                song_id: '127',
                bewertung: 'kleine_abweichung',
                aehnlichkeit: 0.9825,
                befunde: 1,
                abweichungen: [
                    {
                        art: 'geaendert',
                        redaktionssystem: 'alle',
                        notenbild: 'ale',
                        position: 19,
                    },
                ],
                gewichte_formal: { gross_klein: 1 },
                hinweise: [],
            },
        ],
        ...overrides,
    };
}

describe('parseOcrData', () => {
    it('macht die Befunde über die Lied-Id nachschlagbar', () => {
        const data = parseOcrData(datei());
        expect(data.count).toBe(2);
        expect(data.bySongId.get('127').bewertung).toBe('kleine_abweichung');
        expect(data.erzeugt).toBe('2026-08-10');
        expect(data.engine).toBe('tesseract');
        expect(data.dpi).toBe(300);
    });

    it('normalisiert die Lied-Id auf eine Zeichenkette', () => {
        // Im Dashboard ist lied.id eine Zahl, in der Datei eine Zeichenkette –
        // ohne Normalisierung fände der Nachschlag nie etwas.
        const data = parseOcrData(datei({ lieder: [{ song_id: 42, bewertung: 'identisch' }] }));
        expect(data.bySongId.get('42')).toBeTruthy();
        expect(data.bySongId.get(String(42))).toBeTruthy();
    });

    it('überspringt Einträge ohne Lied-Id', () => {
        const data = parseOcrData(
            datei({ lieder: [{ bewertung: 'identisch' }, { song_id: '9', bewertung: 'fehler' }] }),
        );
        expect(data.count).toBe(1);
    });

    it('weist ein fremdes Schema mit klarer Meldung ab', () => {
        expect(() => parseOcrData(datei({ schema: 'notenbild-strophe1/2' }))).toThrow(
            /Unbekanntes Format/,
        );
    });

    it('weist eine Datei ohne Liederliste ab', () => {
        expect(() => parseOcrData(datei({ lieder: null }))).toThrow(/lieder/);
    });

    it('weist an, was gar keine Befunddatei ist', () => {
        expect(() => parseOcrData(null)).toThrow();
        expect(() => parseOcrData('kein Objekt')).toThrow();
    });
});

describe('verdictMeta', () => {
    it('sortiert von auffällig nach unauffällig', () => {
        expect(VERDICT_ORDER[0]).toBe('stark_abweichend');
        expect(VERDICT_ORDER.at(-1)).toBe('identisch');
    });

    it('trennt Befunde von Unauffälligem', () => {
        expect(verdictMeta('stark_abweichend').problem).toBe(true);
        expect(verdictMeta('pruefen').problem).toBe(true);
        expect(verdictMeta('kleine_abweichung').problem).toBe(true);
        expect(verdictMeta('nur_formal').problem).toBe(false);
        expect(verdictMeta('identisch').problem).toBe(false);
    });

    it('kommt mit einer unbekannten Bewertung klar', () => {
        // Ein neues Skript könnte eine Bewertung mitbringen, die wir nicht kennen –
        // dann lieber neutral anzeigen als abstürzen.
        const meta = verdictMeta('ganz_neu');
        expect(meta.label).toBe('ganz_neu');
        expect(meta.problem).toBe(false);
    });
});

describe('Beschriftungen', () => {
    it('übersetzt die Schlüssel des Skripts', () => {
        expect(formalLabel('wortgrenze')).toBe('Wortgrenze');
        expect(artLabel('zusaetzlich_im_notenbild')).toBe('nur im Notenbild');
    });

    it('gibt Unbekanntes unverändert zurück', () => {
        expect(formalLabel('neu')).toBe('neu');
        expect(artLabel('neu')).toBe('neu');
    });
});
