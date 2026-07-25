// Lokal (im Browser) gespeicherte „Bestätigungen" für Druck-Check-Befunde.
//
// Manche Befunde sind fachlich gewollt (z. B. eine Abweichung, die durch eine
// Eigenheit des Drucks entsteht, oder eine bewusst abweichende Schreibweise).
// Der Nutzer kann einen Befund abhaken; er wird dann ausgeblendet und zählt nicht
// mehr als offenes Problem. Gespeichert wird der stabile Fingerprint (fp) eines
// Befunds – taucht derselbe Befund bei einer neuen PDF wieder auf, ist er weiter
// als „bestätigt" bekannt. Ändert sich der Inhalt (PDF oder DB), ändert sich der
// Fingerprint und der Befund erscheint erneut.
//
// Speicherformat (v2): je Fingerprint ein Eintrag { v, ts }. Das `v` ist der
// „Schlüssel" des Eintrags – beim Laden zählt nur, was den aktuellen Schlüssel
// trägt, alles andere wird verworfen. So lassen sich alle Bestätigungen einmalig
// für alle zurücksetzen, indem ACK_VERSION erhöht wird. Nötig geworden, weil
// Befunde reihenweise weggeklickt statt geprüft wurden; seitdem hängt am
// Bestätigen zusätzlich eine Rückfrage (siehe AckConfirmDialog.vue).

import { ref } from 'vue';

const STORAGE_KEY = 'druck-check-acks-v2';
// Altes Format (flache Liste von Fingerprints, ohne Schlüssel) – wird beim ersten
// Laden entfernt und damit zurückgesetzt.
const LEGACY_KEYS = ['druck-check-acks-v1'];
// Erhöhen ⇒ alle bestehenden Bestätigungen verfallen (Reset für alle Browser).
const ACK_VERSION = 1;

function load() {
    try {
        for (const key of LEGACY_KEYS) localStorage.removeItem(key);
        const raw = localStorage.getItem(STORAGE_KEY);
        const obj = raw ? JSON.parse(raw) : null;
        const out = new Map();
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
        for (const [fp, entry] of Object.entries(obj)) {
            // Ohne gültigen Schlüssel: verworfen (Reset).
            if (!fp || !entry || entry.v !== ACK_VERSION) continue;
            out.set(fp, { v: ACK_VERSION, ts: entry.ts ?? null });
        }
        return out;
    } catch {
        return new Map();
    }
}

// Modul-globaler, reaktiver Zustand – von allen Komponenten geteilt.
// Map: fingerprint -> { v, ts }
const acked = ref(load());

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(acked.value)));
    } catch {
        /* localStorage nicht verfügbar – dann eben nur für diese Sitzung. */
    }
}

function newEntry() {
    return { v: ACK_VERSION, ts: Date.now() };
}

export function useDruckCheckAcks() {
    return {
        acked,
        isAcked: (fp) => !!fp && acked.value.has(fp),
        // „bestätigt am 25.07.2026" – damit man alten Bestätigungen ansieht, wie
        // lange sie schon mitlaufen. Leer, wenn nicht (mehr) bestätigt.
        ackedAtLabel(fp) {
            const ts = fp ? acked.value.get(fp)?.ts : null;
            if (!ts) return '';
            return `bestätigt am ${new Date(ts).toLocaleDateString('de-DE')}`;
        },
        toggle(fp) {
            if (!fp) return;
            const next = new Map(acked.value);
            if (next.has(fp)) next.delete(fp);
            else next.set(fp, newEntry());
            acked.value = next;
            persist();
        },
        // Alle Befunde eines Liedes auf einmal bestätigen bzw. wieder öffnen.
        setAcked(fps, value) {
            const next = new Map(acked.value);
            for (const fp of fps) {
                if (!fp) continue;
                if (value) next.set(fp, newEntry());
                else next.delete(fp);
            }
            acked.value = next;
            persist();
        },
        clear() {
            acked.value = new Map();
            persist();
        },
    };
}
