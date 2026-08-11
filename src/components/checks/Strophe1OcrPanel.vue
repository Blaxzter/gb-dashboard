<script setup>
// Maschineller Befund zu einem Lied (Issue #99, Idee 3).
//
// Zeigt, was der OCR-Lauf aus gb-scripts über dieses Lied sagt: eine Bewertung,
// die abweichenden Wörter und – auf Wunsch – den Text, den Tesseract aus dem
// Notenbild gelesen hat.
//
// Der Ton ist bewusst zurückhaltend. Ein Notensatz ist für OCR schweres Gelände:
// Silbentrennung, Notenlinien, Bindebögen. „Kleine Abweichung" heißt deshalb
// meistens „Tesseract hat sich verlesen" und nicht „hier stimmt etwas nicht".
// Die Liste sagt, wo hinzusehen sich lohnt – entscheiden muss der Mensch.

import { computed } from 'vue';
import { artLabel, formalLabel, verdictMeta } from '@/assets/js/strophe1Ocr.js';
import '@/styles/gb-optima.css';

const props = defineProps({
    finding: { type: Object, required: true },
    // Druckfassung: knapp, schwarzweiß, ohne Bedienelemente.
    print: { type: Boolean, default: false },
    // Den erkannten Text mitzeigen (am Schirm zuschaltbar).
    showOcrText: { type: Boolean, default: false },
});

const meta = computed(() => verdictMeta(props.finding?.bewertung));
const abweichungen = computed(() => props.finding?.abweichungen || []);
const hinweise = computed(() => props.finding?.hinweise || []);
const formal = computed(() => Object.entries(props.finding?.gewichte_formal || {}));
const similarity = computed(() => {
    const v = props.finding?.aehnlichkeit;
    return typeof v === 'number' ? `${(v * 100).toFixed(1)} %` : '';
});
</script>

<template>
    <div class="ocr" :class="{ 'ocr--print': print }">
        <div class="ocr-head">
            <v-icon v-if="!print" :color="meta.color" size="small">{{ meta.icon }}</v-icon>
            <span class="ocr-verdict">{{ meta.label }}</span>
            <span v-if="similarity" class="ocr-meta">Übereinstimmung {{ similarity }}</span>
            <span v-if="abweichungen.length" class="ocr-meta">
                {{ abweichungen.length }} abweichende Stelle(n)
            </span>
            <v-spacer v-if="!print" />
            <span v-if="!print" class="ocr-meta">maschinell gelesen · nur ein Hinweis</span>
        </div>

        <!-- Die abweichenden Wörter: das eigentlich Nützliche. -->
        <table v-if="abweichungen.length" class="ocr-table">
            <thead>
                <tr>
                    <th>Redaktionssystem</th>
                    <th>Notenbild (gelesen)</th>
                    <th class="ocr-art">Art</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(a, i) in abweichungen" :key="i">
                    <td class="ocr-word">{{ a.redaktionssystem || '—' }}</td>
                    <td class="ocr-word">{{ a.notenbild || '—' }}</td>
                    <td class="ocr-art">{{ artLabel(a.art) }}</td>
                </tr>
            </tbody>
        </table>

        <div v-else-if="meta.rank > 4" class="ocr-none">
            Keine inhaltlichen Abweichungen gefunden.
        </div>

        <!-- Formale Unterschiede zählt das Skript nur, weil sie auf einem
             Notensatz mit Silbentrennung nichts beweisen. -->
        <div v-if="formal.length" class="ocr-formal">
            <span class="ocr-meta">Nur formal:</span>
            <span v-for="[key, count] in formal" :key="key" class="ocr-chip">
                {{ formalLabel(key) }} ({{ count }})
            </span>
        </div>

        <ul v-if="hinweise.length" class="ocr-hints">
            <li v-for="(h, i) in hinweise" :key="i">{{ h }}</li>
        </ul>

        <div v-if="showOcrText && finding.strophe_1_notenbild" class="ocr-raw">
            <div class="ocr-meta mb-1">Aus dem Notenbild gelesen:</div>
            <p class="ocr-raw-text">{{ finding.strophe_1_notenbild }}</p>
        </div>
    </div>
</template>

<style scoped>
.ocr {
    border: 1px solid rgba(var(--v-border-color), 0.35);
    border-radius: 4px;
    padding: 10px 12px;
}
.ocr-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 6px;
}
.ocr-verdict {
    font-weight: 700;
    font-size: 0.9rem;
}
.ocr-meta {
    font-size: 0.75rem;
    color: rgba(var(--v-theme-on-surface), 0.6);
}

.ocr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
}
.ocr-table th {
    text-align: left;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(var(--v-theme-on-surface), 0.55);
    font-weight: 600;
    padding: 2px 8px 2px 0;
}
.ocr-table td {
    padding: 2px 8px 2px 0;
    border-top: 1px solid rgba(var(--v-border-color), 0.25);
    vertical-align: top;
}
/* Die verglichenen Wörter im Wortbild des Notensatzes – wie der Strophentext
   daneben, damit ein Unterschied auffällt und nicht in zwei Schriften untergeht. */
.ocr-word {
    font-family: 'GbOptima', Optima, Candara, 'Gill Sans', 'Trebuchet MS', sans-serif;
    font-size: 1rem;
}
.ocr-art {
    font-size: 0.75rem;
    color: rgba(var(--v-theme-on-surface), 0.6);
    white-space: nowrap;
}
.ocr-none {
    font-size: 0.8rem;
    color: rgba(var(--v-theme-on-surface), 0.6);
}

.ocr-formal {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
}
.ocr-chip {
    font-size: 0.72rem;
    padding: 1px 7px;
    border-radius: 10px;
    background: rgba(var(--v-theme-on-surface), 0.07);
}
.ocr-hints {
    margin: 8px 0 0;
    padding-left: 18px;
    font-size: 0.78rem;
    color: rgba(var(--v-theme-on-surface), 0.7);
}
.ocr-raw {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(var(--v-border-color), 0.25);
}
.ocr-raw-text {
    margin: 0;
    font-family: 'GbOptima', Optima, Candara, 'Gill Sans', 'Trebuchet MS', sans-serif;
    font-size: 0.95rem;
    line-height: 1.6;
    color: rgba(var(--v-theme-on-surface), 0.85);
}

/* --- Druck ---------------------------------------------------------------- */
/* Auf dem Korrekturbogen steht der Befund klein unter dem Strophentext: ein
   Fingerzeig für die Person mit dem Rotstift, kein zweiter Hauptdarsteller. */
.ocr--print {
    border: none;
    border-top: 1px solid #bbb;
    border-radius: 0;
    padding: 3mm 0 0;
    color: #333;
}
.ocr--print .ocr-verdict,
.ocr--print .ocr-meta,
.ocr--print .ocr-art,
.ocr--print .ocr-none {
    font-size: 8.5pt;
    color: #555;
}
.ocr--print .ocr-verdict {
    color: #000;
}
.ocr--print .ocr-table {
    font-size: 9pt;
}
.ocr--print .ocr-table th {
    color: #666;
    font-size: 7pt;
}
.ocr--print .ocr-table td {
    border-top: 1px solid #ddd;
}
.ocr--print .ocr-word {
    font-size: 10pt;
    color: #000;
}
.ocr--print .ocr-chip {
    background: #eee;
    font-size: 7.5pt;
}
.ocr--print .ocr-hints {
    font-size: 8pt;
    color: #555;
}
</style>
