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
async function freshAcks(storage) {
    vi.resetModules();
    vi.stubGlobal('localStorage', storage);
    const { useDruckCheckAcks } = await import('./druckCheckAcks.js');
    return useDruckCheckAcks();
}

const KEY = 'druck-check-acks-v2';

describe('druckCheckAcks', () => {
    it('behält eigene Bestätigungen über einen Neustart hinweg', async () => {
        const storage = fakeStorage();
        const first = await freshAcks(storage);
        first.toggle('fp-1');
        expect(first.isAcked('fp-1')).toBe(true);

        const second = await freshAcks(storage);
        expect(second.isAcked('fp-1')).toBe(true);
        expect(second.ackedAtLabel('fp-1')).toMatch(/^bestätigt am /);
    });

    it('verwirft das alte Format (v1) und räumt den Schlüssel weg', async () => {
        const storage = fakeStorage({
            'druck-check-acks-v1': JSON.stringify(['fp-1', 'fp-2']),
        });
        const acks = await freshAcks(storage);
        expect(acks.isAcked('fp-1')).toBe(false);
        expect(acks.isAcked('fp-2')).toBe(false);
        expect(storage.getItem('druck-check-acks-v1')).toBeNull();
    });

    it('verwirft Einträge ohne aktuellen Schlüssel, behält die gültigen', async () => {
        const storage = fakeStorage();
        const first = await freshAcks(storage);
        first.toggle('gueltig');
        // Eintrag aus einer früheren Bestätigungs-Runde daneben legen.
        const stored = JSON.parse(storage.getItem(KEY));
        stored['veraltet'] = { v: 0, ts: 1 };
        storage.setItem(KEY, JSON.stringify(stored));

        const second = await freshAcks(storage);
        expect(second.isAcked('gueltig')).toBe(true);
        expect(second.isAcked('veraltet')).toBe(false);
    });

    it('toggle nimmt eine Bestätigung wieder zurück', async () => {
        const acks = await freshAcks(fakeStorage());
        acks.toggle('fp-1');
        acks.toggle('fp-1');
        expect(acks.isAcked('fp-1')).toBe(false);
        expect(acks.ackedAtLabel('fp-1')).toBe('');
    });

    it('setAcked und clear wirken auf mehrere Befunde', async () => {
        const storage = fakeStorage();
        const acks = await freshAcks(storage);
        acks.setAcked(['a', 'b', null], true);
        expect(acks.isAcked('a')).toBe(true);
        expect(acks.isAcked('b')).toBe(true);

        acks.setAcked(['a'], false);
        expect(acks.isAcked('a')).toBe(false);

        acks.clear();
        expect(acks.isAcked('b')).toBe(false);
        expect(JSON.parse(storage.getItem(KEY))).toEqual({});
    });
});
