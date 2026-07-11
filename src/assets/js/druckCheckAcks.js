// Lokal (im Browser) gespeicherte „Bestätigungen" für Druck-Check-Befunde.
//
// Manche Befunde sind fachlich gewollt (z. B. eine Abweichung, die durch eine
// Eigenheit des Drucks entsteht, oder eine bewusst abweichende Schreibweise).
// Der Nutzer kann einen Befund abhaken; er wird dann ausgeblendet und zählt nicht
// mehr als offenes Problem. Gespeichert wird der stabile Fingerprint (fp) eines
// Befunds – taucht derselbe Befund bei einer neuen PDF wieder auf, ist er weiter
// als „bestätigt" bekannt. Ändert sich der Inhalt (PDF oder DB), ändert sich der
// Fingerprint und der Befund erscheint erneut.

import { ref } from 'vue';

const STORAGE_KEY = 'druck-check-acks-v1';

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

// Modul-globaler, reaktiver Zustand – von allen Komponenten geteilt.
const acked = ref(new Set(load()));

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...acked.value]));
    } catch {
        /* localStorage nicht verfügbar – dann eben nur für diese Sitzung. */
    }
}

export function useDruckCheckAcks() {
    return {
        acked,
        isAcked: (fp) => !!fp && acked.value.has(fp),
        toggle(fp) {
            if (!fp) return;
            const next = new Set(acked.value);
            if (next.has(fp)) next.delete(fp);
            else next.add(fp);
            acked.value = next;
            persist();
        },
        clear() {
            acked.value = new Set();
            persist();
        },
    };
}
