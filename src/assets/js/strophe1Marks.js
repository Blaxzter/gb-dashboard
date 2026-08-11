// Lokal (im Browser) gespeicherte „abgeglichen"-Markierungen für den
// Strophe-1-Abgleich (Issue #99).
//
// Bewusst NICHT in der Datenbank: Das Redaktionssystem kennt kein Feld dafür,
// und der Abgleich ist Arbeitsstand einer Person, kein Datum des Liedes. Wer
// eine Liste abarbeitet, will sehen, was er selbst schon angesehen hat – genau
// dafür reicht der Browser-Speicher. Gespeichert wird der Schlüssel aus
// strophe1Abgleich.abgleichKey(); ändert sich Notenbild oder Strophentext,
// ändert sich der Schlüssel und das Lied gilt wieder als offen.
//
// Speicherformat: je Schlüssel ein Eintrag { v, ts }. `v` ist die Version des
// Eintrags – beim Laden zählt nur, was die aktuelle Version trägt. Damit lassen
// sich alle Markierungen einmalig für alle zurücksetzen, indem MARK_VERSION
// erhöht wird (analog zu druckCheckAcks.js).

import { ref } from 'vue';

const STORAGE_KEY = 'strophe1-abgleich-v1';
const MARK_VERSION = 1;

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const obj = raw ? JSON.parse(raw) : null;
        const out = new Map();
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
        for (const [key, entry] of Object.entries(obj)) {
            if (!key || !entry || entry.v !== MARK_VERSION) continue;
            out.set(key, { v: MARK_VERSION, ts: entry.ts ?? null });
        }
        return out;
    } catch {
        return new Map();
    }
}

// Modul-globaler, reaktiver Zustand – Liste und Detailansicht teilen ihn sich.
const marked = ref(load());

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(marked.value)));
    } catch {
        /* localStorage nicht verfügbar – dann eben nur für diese Sitzung. */
    }
}

function setMark(key, value) {
    if (!key) return;
    const next = new Map(marked.value);
    if (value) next.set(key, { v: MARK_VERSION, ts: Date.now() });
    else next.delete(key);
    marked.value = next;
    persist();
}

export function useStrophe1Marks() {
    return {
        marked,
        count: () => marked.value.size,
        isMarked: (key) => !!key && marked.value.has(key),
        // „abgeglichen am 09.08.2026" – damit man einer alten Markierung ansieht,
        // wie lange sie schon steht.
        markedAtLabel(key) {
            const ts = key ? marked.value.get(key)?.ts : null;
            if (!ts) return '';
            return `abgeglichen am ${new Date(ts).toLocaleDateString('de-DE')}`;
        },
        set: setMark,
        toggle: (key) => setMark(key, !marked.value.has(key)),
        clear() {
            marked.value = new Map();
            persist();
        },
    };
}
