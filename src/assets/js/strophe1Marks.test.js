import { describe, expect, it, vi } from 'vitest';

// Minimaler localStorage-Ersatz – die Logik-Tests laufen im Node-Env.
function fakeStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        map,
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k),
    };
}

// Das Modul liest den Speicher beim Import – für jeden Fall neu laden.
async function freshMarks(storage) {
    vi.resetModules();
    vi.stubGlobal('localStorage', storage);
    const { useStrophe1Marks } = await import('./strophe1Marks.js');
    return useStrophe1Marks();
}

const KEY = 'strophe1-abgleich-v1';

describe('strophe1Marks', () => {
    it('behält Markierungen über einen Neustart hinweg', async () => {
        const storage = fakeStorage();
        const first = await freshMarks(storage);
        first.set('lied-1', true);
        expect(first.isMarked('lied-1')).toBe(true);

        const second = await freshMarks(storage);
        expect(second.isMarked('lied-1')).toBe(true);
        expect(second.count()).toBe(1);
    });

    it('nimmt eine Markierung wieder zurück', async () => {
        const marks = await freshMarks(fakeStorage());
        marks.toggle('lied-1');
        expect(marks.isMarked('lied-1')).toBe(true);
        marks.toggle('lied-1');
        expect(marks.isMarked('lied-1')).toBe(false);
        expect(marks.count()).toBe(0);
    });

    it('verwirft Einträge einer fremden Version', async () => {
        const storage = fakeStorage({
            [KEY]: JSON.stringify({ alt: { v: 0, ts: 1 }, neu: { v: 1, ts: 2 } }),
        });
        const marks = await freshMarks(storage);
        expect(marks.isMarked('alt')).toBe(false);
        expect(marks.isMarked('neu')).toBe(true);
    });

    it('überlebt kaputten Speicherinhalt', async () => {
        const marks = await freshMarks(fakeStorage({ [KEY]: 'kein JSON' }));
        expect(marks.count()).toBe(0);
        marks.set('lied-1', true);
        expect(marks.isMarked('lied-1')).toBe(true);
    });

    it('ignoriert leere Schlüssel', async () => {
        const marks = await freshMarks(fakeStorage());
        marks.set('', true);
        expect(marks.count()).toBe(0);
        expect(marks.isMarked('')).toBe(false);
    });

    it('setzt alles zurück', async () => {
        const marks = await freshMarks(fakeStorage());
        marks.set('a', true);
        marks.set('b', true);
        marks.clear();
        expect(marks.count()).toBe(0);
    });

    it('nennt das Datum der Markierung', async () => {
        const marks = await freshMarks(fakeStorage());
        marks.set('a', true);
        expect(marks.markedAtLabel('a')).toMatch(/^abgeglichen am /);
        expect(marks.markedAtLabel('b')).toBe('');
    });
});
