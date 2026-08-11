// OCR-Befunde zum Strophe-1-Abgleich (Issue #99, Idee 3).
//
// Der maschinelle Abgleich läuft nicht hier, sondern in gb-scripts
// (`app/26-ocr-notenbild-strophe1.py`): Dort wird das Notenbild mit 300 dpi
// gerendert, per Tesseract gelesen und der erkannte Text gegen die 1. Strophe
// aus dem Redaktionssystem gehalten. Ergebnis ist eine JSON-Datei, die dieses
// Modul einliest und den Ansichten zur Verfügung stellt.
//
// Warum nicht im Browser? OCR über ~560 Notenbilder ist Rechenarbeit von
// Minuten bis Stunden und braucht eine Engine, die nicht ins Frontend gehört.
// Die Aufteilung hat außerdem einen fachlichen Vorteil: Die Befunde sind ein
// datierter Stand, den man weitergeben und mit dem man arbeiten kann – kein
// Ergebnis, das bei jedem Seitenaufruf leicht anders ausfällt.
//
// WICHTIG: Die Befunde sind ein Hinweis, kein Urteil. Tesseract liest einen
// Notensatz mit Silbentrennung und Notenlinien; Lesefehler wie „alle" -> „ale"
// sind die Regel, nicht die Ausnahme. Deshalb gilt hier durchweg: Der Mensch
// vergleicht, die Maschine sagt nur, wo sich das Hinsehen am ehesten lohnt.

import { ref } from 'vue';

// Die Befunddatei liegt in Directus (hochgeladen aus gb-scripts) und wird von
// dort geholt – so sehen alle denselben Stand, ohne dass jemand eine Datei ins
// Frontend kopieren muss. Ein neuer Lauf ersetzt üblicherweise dieselbe Datei;
// wird stattdessen eine neue angelegt, lässt sich die Id über die Umgebung
// nachziehen, ohne den Code anzufassen. Gleiches Vorgehen wie bei der
// KI-Review-Datei im Autoren-Datencheck.
export const OCR_FILE_ID =
    import.meta.env.VITE_STROPHE1_OCR_FILE_ID || '100fc0db-7dda-4be2-ae48-c35836719347';
// Nur dieses Schema wird verstanden. Ändert das Skript sein Format, soll die
// Ansicht das melden statt still Unsinn anzuzeigen.
export const OCR_SCHEMA = 'notenbild-strophe1/1';

// Bewertungen von „muss angesehen werden" nach „stimmt". `problem` steuert den
// Filter „nur Befunde"; `rank` die Sortierung.
export const VERDICTS = {
    stark_abweichend: {
        label: 'Stark abweichend',
        color: 'error',
        icon: 'mdi-alert-octagon',
        rank: 0,
        problem: true,
    },
    pruefen: {
        label: 'Prüfen',
        color: 'warning',
        icon: 'mdi-alert',
        rank: 1,
        problem: true,
    },
    kleine_abweichung: {
        label: 'Kleine Abweichung',
        color: 'info',
        icon: 'mdi-information',
        rank: 2,
        problem: true,
    },
    fehler: {
        label: 'Nicht lesbar',
        color: 'error',
        icon: 'mdi-image-broken-variant',
        rank: 3,
        problem: true,
    },
    keine_strophe: {
        label: 'Keine 1. Strophe',
        color: 'grey',
        icon: 'mdi-text-box-remove-outline',
        rank: 4,
        problem: true,
    },
    nur_formal: {
        label: 'Nur formale Unterschiede',
        color: 'success',
        icon: 'mdi-check',
        rank: 5,
        problem: false,
    },
    identisch: {
        label: 'Identisch',
        color: 'success',
        icon: 'mdi-check-all',
        rank: 6,
        problem: false,
    },
};

export const VERDICT_ORDER = Object.keys(VERDICTS).sort(
    (a, b) => VERDICTS[a].rank - VERDICTS[b].rank,
);

export function verdictMeta(key) {
    return (
        VERDICTS[key] || {
            label: key || 'unbekannt',
            color: 'grey',
            icon: 'mdi-help-circle-outline',
            rank: 99,
            problem: false,
        }
    );
}

// Was das Skript als „formal" verbucht: Unterschiede, die auf einem Notensatz
// mit Silbentrennung nichts beweisen. Sie werden nur gezählt, nicht aufgelistet.
const FORMAL_LABELS = {
    wortgrenze: 'Wortgrenze',
    gross_klein: 'Groß-/Kleinschreibung',
    zeichensetzung: 'Zeichensetzung',
    wiederholung: 'Wiederholung',
    ocr_verwechslung: 'OCR-Verwechslung',
};
export function formalLabel(key) {
    return FORMAL_LABELS[key] || key;
}

const ART_LABELS = {
    geaendert: 'geändert',
    zusaetzlich_im_notenbild: 'nur im Notenbild',
    fehlt_im_notenbild: 'fehlt im Notenbild',
};
export function artLabel(key) {
    return ART_LABELS[key] || key;
}

/**
 * Die JSON-Datei des Skripts in eine nachschlagbare Form bringen.
 *
 * Die Zuordnung läuft über `song_id` – im Dashboard ist die Lied-Id eine Zahl,
 * in der Datei eine Zeichenkette. Beides wird auf Zeichenketten normalisiert,
 * sonst findet der Nachschlag nie etwas.
 *
 * @throws {Error} bei fremdem oder kaputtem Format – mit einem Text, der in die
 *         Oberfläche darf.
 */
export function parseOcrData(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error('Die Datei enthält keine Befunde.');
    }
    if (raw.schema !== OCR_SCHEMA) {
        throw new Error(
            `Unbekanntes Format „${raw.schema || '—'}" – erwartet wird „${OCR_SCHEMA}". ` +
                'Vermutlich stammt die Datei aus einer anderen Fassung des OCR-Skripts.',
        );
    }
    if (!Array.isArray(raw.lieder)) {
        throw new Error('In der Datei fehlt die Liste „lieder".');
    }

    const bySongId = new Map();
    for (const entry of raw.lieder) {
        if (entry?.song_id == null) continue;
        bySongId.set(String(entry.song_id), entry);
    }
    return {
        erzeugt: raw.erzeugt || '',
        engine: raw.ocr?.engine || '',
        dpi: raw.ocr?.dpi || null,
        summary: raw.zusammenfassung || {},
        bySongId,
        count: bySongId.size,
    };
}

// --- Laden ------------------------------------------------------------------
// Modul-globaler Zustand: Liste, Detail und Druckansicht teilen sich einen
// Datensatz, statt die Datei dreimal zu holen.
//
// status: 'idle' | 'loading' | 'ready' | 'missing' | 'error'
// 'missing' ist kein Fehler: Gibt es die Datei (noch) nicht, soll die Ansicht
// ohne Befunde benutzbar bleiben, ohne eine rote Meldung zu zeigen. Alles andere
// – kein Zugriff, kaputte Datei, fremdes Format – ist einer Meldung wert, denn
// da lässt sich etwas tun.
const status = ref('idle');
const error = ref('');
const data = ref(null);

export function ocrFileUrl() {
    return `${import.meta.env.VITE_BACKEND_URL}/assets/${OCR_FILE_ID}`;
}

async function loadOnce() {
    if (status.value === 'loading' || status.value === 'ready') return;
    status.value = 'loading';
    error.value = '';
    try {
        const resp = await fetch(ocrFileUrl(), { cache: 'no-cache' });
        if (resp.status === 404) {
            status.value = 'missing';
            return;
        }
        if (!resp.ok) {
            // 403 heißt: Datei da, aber die Rolle darf sie nicht lesen. Das als
            // „nicht vorhanden" zu zeigen, würde die Suche in die falsche Ecke
            // schicken.
            throw new Error(`Die Befunddatei ist nicht abrufbar (HTTP ${resp.status}).`);
        }
        const text = await resp.text();
        // Manche Zwischenstationen liefern statt der Datei eine Fehlerseite mit
        // Status 200 – das wäre sonst ein irreführender „kaputte Datei"-Fehler.
        if (/^\s*</.test(text)) {
            status.value = 'missing';
            return;
        }
        data.value = parseOcrData(JSON.parse(text));
        status.value = 'ready';
    } catch (e) {
        console.error('OCR-Befunde konnten nicht geladen werden', e);
        error.value = e?.message || String(e);
        status.value = 'error';
    }
}

// Datei von Hand einlesen – für einen frisch erzeugten Stand, ohne ihn erst
// ausliefern zu müssen.
async function loadFromFile(file) {
    status.value = 'loading';
    error.value = '';
    try {
        data.value = parseOcrData(JSON.parse(await file.text()));
        status.value = 'ready';
    } catch (e) {
        console.error('OCR-Befunde konnten nicht gelesen werden', e);
        error.value = e?.message || String(e);
        status.value = 'error';
        data.value = null;
    }
}

export function useStrophe1Ocr() {
    return {
        status,
        error,
        data,
        loadOnce,
        loadFromFile,
        // Befund zu einem Lied – null, solange nichts geladen ist.
        findingFor: (lied) => {
            if (!data.value || lied?.id == null) return null;
            return data.value.bySongId.get(String(lied.id)) || null;
        },
    };
}
