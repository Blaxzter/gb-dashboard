import { describe, expect, it } from 'vitest';
import { classifyNotenPdf, PDF_KIND_CHORALBUCH, PDF_KIND_GESANGBUCH } from './notenPdfKind.js';

// Seitengrößen, wie sie in den echten Dateien stehen (pdfinfo).
const GESANGBUCH_PAGE = { width: 340.2, height: 498.84 };
const CHORALBUCH_PAGE = { width: 841.92, height: 595.32 };

describe('classifyNotenPdf', () => {
    it('erkennt den Gesangbuchsatz am Buchformat 120 × 176 mm', () => {
        const r = classifyNotenPdf({
            pages: [GESANGBUCH_PAGE],
            title: 'Mit Gott.musx',
            producer: 'Microsoft: Print To PDF',
        });
        expect(r.kind).toBe(PDF_KIND_GESANGBUCH);
        expect(r.confidence).toBe('sicher');
        expect(r.format).toBe('120 × 176 mm, hoch');
        expect(r.warnings).toEqual([]);
    });

    it('erkennt den Choralbuchsatz an A4 quer', () => {
        const r = classifyNotenPdf({
            pages: [CHORALBUCH_PAGE],
            title: 'Nun ruhen alle Wälder.musx',
            producer: 'Microsoft: Print To PDF',
        });
        expect(r.kind).toBe(PDF_KIND_CHORALBUCH);
        expect(r.confidence).toBe('sicher');
        expect(r.format).toBe('297 × 210 mm, quer');
        expect(r.reasons.join(' ')).toContain('Nun ruhen alle Wälder.musx');
    });

    it('rät bei fremdem Format nach der Ausrichtung und markiert das', () => {
        // A4 hoch
        const hoch = classifyNotenPdf({ pages: [{ width: 595.32, height: 841.92 }] });
        expect(hoch.kind).toBe(PDF_KIND_GESANGBUCH);
        expect(hoch.confidence).toBe('vermutet');
        // A5 quer
        const quer = classifyNotenPdf({ pages: [{ width: 595.32, height: 419.53 }] });
        expect(quer.kind).toBe(PDF_KIND_CHORALBUCH);
        expect(quer.confidence).toBe('vermutet');
    });

    it('warnt bei mehrseitigem Gesangbuchsatz (Seite 2 fehlt sonst im Druck)', () => {
        const r = classifyNotenPdf({ pages: [GESANGBUCH_PAGE, GESANGBUCH_PAGE] });
        expect(r.kind).toBe(PDF_KIND_GESANGBUCH);
        expect(r.warnings).toHaveLength(1);
        expect(r.warnings[0]).toContain('Seite 2');
    });

    it('warnt bei mehrseitigem Choralbuchsatz', () => {
        const r = classifyNotenPdf({ pages: [CHORALBUCH_PAGE, CHORALBUCH_PAGE] });
        expect(r.kind).toBe(PDF_KIND_CHORALBUCH);
        expect(r.warnings).toHaveLength(1);
    });

    it('kommt mit leerem PDF zurecht', () => {
        const r = classifyNotenPdf({ pages: [] });
        expect(r.confidence).toBe('vermutet');
        expect(r.warnings).toHaveLength(1);
    });
});
