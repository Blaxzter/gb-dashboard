<template>
    <!-- Erklär-Dialog für den Autoren-Datencheck. Erscheint einmalig beim ersten
         Öffnen der Ansicht und ist über das Hilfe-Symbol jederzeit wieder aufrufbar. -->
    <v-dialog v-model="open" max-width="760" scrollable>
        <v-card rounded="lg">
            <v-card-item class="pe-2">
                <template #prepend>
                    <v-avatar color="primary" variant="tonal">
                        <v-icon>mdi-information-outline</v-icon>
                    </v-avatar>
                </template>
                <v-card-title class="text-wrap">So funktioniert der Autoren-Datencheck</v-card-title>
                <v-card-subtitle class="text-wrap">
                    Kurz erklärt – auch ohne Technik-Vorwissen
                </v-card-subtitle>
                <template #append>
                    <v-btn icon="mdi-close" variant="text" @click="open = false" />
                </template>
            </v-card-item>

            <v-divider />

            <v-card-text style="max-height: 70vh">
                <!-- Wozu -->
                <p class="text-body-2 mb-4">
                    Bei vielen Autor:innen im Gesangbuch waren die <strong>Geburts- und
                    Sterbejahre</strong> unsicher oder unvollständig. Eine automatische Prüfung hat
                    deshalb jede Person mit verlässlichen Nachschlagewerken abgeglichen. Diese
                    Ansicht zeigt das Ergebnis – du prüfst es und kannst korrigierte Jahre mit einem
                    Klick übernehmen.
                </p>

                <!-- Woher die Daten kommen -->
                <div class="text-subtitle-2 mb-2 d-flex align-center">
                    <v-icon size="small" color="primary" class="me-2">mdi-database-search</v-icon>
                    Woher kommen die Daten?
                </div>
                <p class="text-body-2 mb-2">
                    Ein Skript hat jeden Namen automatisch in frei zugänglichen, anerkannten Quellen
                    nachgeschlagen:
                </p>
                <v-list density="compact" class="bg-transparent pa-0 mb-2">
                    <v-list-item class="px-0">
                        <template #prepend>
                            <v-icon color="indigo" class="me-2">mdi-library</v-icon>
                        </template>
                        <v-list-item-title class="text-body-2 font-weight-medium">GND</v-list-item-title>
                        <v-list-item-subtitle class="text-wrap">
                            Gemeinsame Normdatei der Deutschen Nationalbibliothek – das maßgebliche
                            Verzeichnis für Personen (Theolog:innen, Dichter:innen, Komponist:innen).
                        </v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item class="px-0">
                        <template #prepend>
                            <v-icon color="teal" class="me-2">mdi-database</v-icon>
                        </template>
                        <v-list-item-title class="text-body-2 font-weight-medium">Wikidata</v-list-item-title>
                        <v-list-item-subtitle class="text-wrap">
                            Die offene Wissensdatenbank hinter Wikipedia.
                        </v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item class="px-0">
                        <template #prepend>
                            <v-icon color="blue-grey" class="me-2">mdi-web</v-icon>
                        </template>
                        <v-list-item-title class="text-body-2 font-weight-medium">Web-Suche</v-list-item-title>
                        <v-list-item-subtitle class="text-wrap">
                            Nur als Rückfallebene, falls GND und Wikidata nichts finden.
                        </v-list-item-subtitle>
                    </v-list-item>
                </v-list>
                <v-alert type="info" variant="tonal" density="compact" class="mb-4">
                    Eine lokale KI hilft nur bei der <strong>Zuordnung</strong> – also welche von
                    mehreren gleichnamigen Personen gemeint ist – und nutzt dafür die dem Autor
                    zugeordneten Lied-Titel als Hinweis. Wichtig: Die KI <strong>erfindet keine
                    Jahre</strong>; sie bewertet nur, was die Quellen liefern.
                </v-alert>

                <!-- Begriffe -->
                <div class="text-subtitle-2 mb-2 d-flex align-center">
                    <v-icon size="small" color="primary" class="me-2">mdi-book-open-variant</v-icon>
                    Die wichtigsten Begriffe
                </div>
                <v-list density="compact" class="bg-transparent pa-0 mb-4">
                    <v-list-item v-for="t in terms" :key="t.term" class="px-0">
                        <v-list-item-title class="text-body-2 font-weight-medium">
                            {{ t.term }}
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-wrap">
                            <span v-html="t.desc" />
                        </v-list-item-subtitle>
                    </v-list-item>
                </v-list>

                <!-- Verdikte -->
                <div class="text-subtitle-2 mb-2 d-flex align-center">
                    <v-icon size="small" color="primary" class="me-2">mdi-label-multiple-outline</v-icon>
                    Die Verdikte (Einschätzungen)
                </div>
                <div class="mb-4">
                    <div v-for="v in verdicts" :key="v.label" class="d-flex align-start mb-2">
                        <v-chip
                            :color="v.color"
                            size="small"
                            variant="flat"
                            :prepend-icon="v.icon"
                            class="me-3 flex-shrink-0 verdict-chip"
                        >
                            {{ v.label }}
                        </v-chip>
                        <span class="text-body-2">{{ v.desc }}</span>
                    </div>
                </div>

                <!-- Was kann ich tun -->
                <div class="text-subtitle-2 mb-2 d-flex align-center">
                    <v-icon size="small" color="primary" class="me-2">mdi-cursor-default-click</v-icon>
                    Was kann ich tun?
                </div>
                <p class="text-body-2 mb-0">
                    Pro Autor kannst du geprüfte Jahre in den <strong>Live-Datensatz</strong>
                    übernehmen: den <strong>KI-Vorschlag</strong> (Knopf unter dem Jahres-Vergleich)
                    oder die Jahre eines bestimmten <strong>Kandidaten</strong> (Knopf an der
                    Kandidaten-Karte). Über den <strong>Stift (✏️)</strong> oben rechts am
                    Jahres-Vergleich kannst du die Live-Jahre auch <strong>direkt bearbeiten</strong>
                    und speichern. Jeder Kandidat verlinkt direkt auf seine Quelle. Unter jedem Autor
                    siehst du außerdem seine Lieder im Gesangbuch (angenommene zuerst). Für Einträge,
                    die keine Person sind, ist das Bearbeiten der Jahre bewusst gesperrt.
                </p>
                <p class="text-body-2 mt-2 mb-0">
                    Unten rechts in der Detailansicht hakst du mit <strong>„Als erledigt
                    markieren“</strong> geprüfte Autoren ab. Diese Markierung wird
                    <strong>zentral gespeichert und für alle geteilt</strong> – so sieht das ganze
                    Team, welche Autoren schon abgearbeitet sind. Das hilft beim systematischen
                    Durcharbeiten; über den Schalter „Erledigte ausblenden“ blendest du erledigte
                    Autoren aus.
                </p>
            </v-card-text>

            <v-divider />

            <v-card-actions>
                <v-spacer />
                <v-btn color="primary" variant="flat" @click="open = false">Verstanden</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const open = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v),
});

const terms = [
    {
        term: 'Snapshot (JSON)',
        desc:
            'Der eingefrorene Stand der gespeicherten Jahre zum Zeitpunkt der Prüfung. Die ' +
            'Prüfergebnisse liegen als „JSON“ vor – ein einfaches, maschinenlesbares Datenformat. ' +
            'Diese Datei wird einmal erzeugt und ändert sich nicht, bis eine neue Prüfung läuft.',
    },
    {
        term: 'Live (DB)',
        desc:
            'Der aktuelle Stand in der echten Datenbank. Weicht er vom Snapshot ab, wurde der ' +
            'Eintrag seit der Prüfung bearbeitet. Beim Übernehmen schreibst du genau hierhin.',
    },
    {
        term: 'KI-Vorschlag',
        desc: 'Die aus den Quellen belegten, korrigierten Jahre.',
    },
    {
        term: 'Kandidaten',
        desc:
            'In GND/Wikidata gefundene Personen mit passendem Namen. <strong>Namensgüte</strong> = ' +
            'wie gut der Name übereinstimmt; <strong>Relevanz</strong> = ob der Beruf zu einer ' +
            'Lied-/Kirchenlied-Person passt (Theologe, Dichter, Komponist …).',
    },
    {
        term: 'Von KI gewählt',
        desc:
            'Der Kandidat, den die KI – auch anhand der zugeordneten Lied-Titel – für die richtige ' +
            'Person hält.',
    },
    {
        term: 'Konfidenz',
        desc: 'Wie sicher die Auswertung bei ihrer Einschätzung ist (0–100 %).',
    },
];

// Spiegelt die Verdikt-Logik des Prüf-Skripts wider.
const verdicts = [
    {
        label: 'Stimmt überein',
        color: 'success',
        icon: 'mdi-check-circle',
        desc: 'Eine verlässliche Quelle bestätigt die hinterlegten Jahre.',
    },
    {
        label: 'Abweichung',
        color: 'warning',
        icon: 'mdi-alert',
        desc: 'Eine Quelle widerspricht den hinterlegten Jahren deutlich – hier lohnt eine Korrektur.',
    },
    {
        label: 'Unvollständig',
        color: 'amber-darken-2',
        icon: 'mdi-calendar-alert',
        desc: 'Ein Jahr fehlt im Datenbestand; die Quelle liefert es.',
    },
    {
        label: 'Unklar',
        color: 'deep-purple',
        icon: 'mdi-help-rhombus',
        desc: 'Mehrere gleichnamige Personen mit unterschiedlichen Jahren – die Identität ist nicht eindeutig.',
    },
    {
        label: 'Nicht gefunden',
        color: 'blue-grey',
        icon: 'mdi-help-circle',
        desc: 'Kein Treffer in den geprüften Quellen.',
    },
    {
        label: 'Keine Person',
        color: 'error',
        icon: 'mdi-account-off',
        desc: 'Der Eintrag ist ein Ort, eine Quelle oder eine Gruppe (z. B. „Nürnberg 1676“) – keine datierbare Person.',
    },
];
</script>

<style scoped>
.verdict-chip {
    min-width: 150px;
}

/* Vuetify kürzt v-list-item-title/-subtitle standardmäßig per -webkit-line-clamp
   bzw. white-space:nowrap mit „…“. Im Erklärtext sollen die Beschreibungen aber
   vollständig umbrechen. */
:deep(.v-list-item-subtitle) {
    display: block;
    overflow: visible;
    -webkit-line-clamp: unset;
    white-space: normal;
}
:deep(.v-list-item-title) {
    white-space: normal;
    overflow: visible;
}
</style>
