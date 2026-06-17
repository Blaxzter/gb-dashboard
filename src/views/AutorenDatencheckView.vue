<template>
    <v-container>
        <!-- Kopf -->
        <div class="d-flex align-center mb-2">
            <div class="text-h4">Autoren-Datencheck</div>
            <v-btn
                icon="mdi-help-circle-outline"
                variant="text"
                color="primary"
                class="ms-1"
                title="Wie funktioniert diese Ansicht?"
                @click="helpOpen = true"
            />
        </div>
        <p class="text-body-2 text-medium-emphasis mb-6" style="max-width: 820px">
            Die KI hat die Geburts- und Sterbejahre von {{ reviewData.length || '…' }} Autoren gegen
            <strong>GND</strong>, <strong>Wikidata</strong> und das Web abgeglichen (Issue #32).
            Hier lassen sich Verdikt, Belege und Quellen je Autor prüfen und die korrigierten Jahre
            direkt in den Live-Datensatz übernehmen.
        </p>

        <!-- Ladezustand / Fehler -->
        <v-alert
            v-if="loadError"
            type="error"
            variant="tonal"
            class="mb-4"
            :text="`Die Review-Datei konnte nicht geladen werden: ${loadError}`"
        />
        <div v-if="loading" class="d-flex flex-column align-center my-12">
            <v-progress-circular indeterminate color="primary" size="48" />
            <span class="text-body-2 text-medium-emphasis mt-3">Lade KI-Review …</span>
        </div>

        <template v-if="!loading && !loadError">
            <!-- 1. Übersichtsband -->
            <v-row class="mb-6" align="stretch">
                <!-- Verdikt-Donut -->
                <v-col cols="12" sm="6" md="3">
                    <v-card variant="outlined" rounded="lg" class="h-100">
                        <v-card-text>
                            <div class="text-overline mb-1">Verdikt-Verteilung</div>
                            <div class="donut-wrap">
                                <Doughnut :data="donutData" :options="donutOptions" />
                                <div class="donut-center">
                                    <div class="text-h4 font-weight-bold">
                                        {{ reviewData.length }}
                                    </div>
                                    <div class="text-caption text-medium-emphasis">Autoren</div>
                                </div>
                            </div>
                            <div class="d-flex flex-wrap ga-1 mt-3 justify-center">
                                <v-chip
                                    v-for="v in verdictList"
                                    :key="v.key"
                                    size="x-small"
                                    :color="v.color"
                                    :variant="
                                        selectedVerdicts.includes(v.key) ? 'flat' : 'outlined'
                                    "
                                    :prepend-icon="v.icon"
                                    @click="toggleVerdict(v.key)"
                                >
                                    {{ v.label }}: {{ v.count }}
                                </v-chip>
                            </div>
                        </v-card-text>
                    </v-card>
                </v-col>

                <!-- Konfidenz-Histogramm -->
                <v-col cols="12" sm="6" md="3">
                    <v-card variant="outlined" rounded="lg" class="h-100">
                        <v-card-text>
                            <div class="text-overline mb-1">KI-Konfidenz</div>
                            <div class="chart-wrap">
                                <Bar :data="histData" :options="histOptions" />
                            </div>
                            <div class="text-caption text-medium-emphasis mt-2">
                                Wie sicher die KI bei ihrem Verdikt ist.
                            </div>
                        </v-card-text>
                    </v-card>
                </v-col>

                <!-- Quellenabdeckung + Methode -->
                <v-col cols="12" sm="6" md="3">
                    <v-card variant="outlined" rounded="lg" class="h-100">
                        <v-card-text>
                            <div class="text-overline mb-2">Quellen geprüft</div>
                            <div v-for="s in sourceCoverage" :key="s.key" class="mb-2">
                                <div class="d-flex align-center text-caption mb-1">
                                    <v-icon :icon="s.icon" size="small" class="me-1" />
                                    <span>{{ s.label }}</span>
                                    <v-spacer />
                                    <span class="text-medium-emphasis"
                                        >{{ s.count }} / {{ reviewData.length }}</span
                                    >
                                </div>
                                <v-progress-linear
                                    :model-value="pct(s.count, reviewData.length)"
                                    :color="s.color"
                                    height="8"
                                    rounded
                                />
                            </div>
                            <v-divider class="my-3" />
                            <div class="d-flex flex-wrap ga-1">
                                <v-chip
                                    size="x-small"
                                    variant="tonal"
                                    color="primary"
                                    prepend-icon="mdi-robot"
                                >
                                    KI genutzt: {{ stats.llmTrue }}
                                </v-chip>
                                <v-chip size="x-small" variant="tonal" prepend-icon="mdi-robot-off">
                                    Regelbasiert: {{ stats.llmFalse }}
                                </v-chip>
                            </div>
                        </v-card-text>
                    </v-card>
                </v-col>

                <!-- Handlungsbedarf -->
                <v-col cols="12" sm="6" md="3">
                    <v-card variant="outlined" rounded="lg" class="h-100">
                        <v-card-text class="d-flex align-center ga-4">
                            <v-progress-circular
                                :model-value="pct(stats.needsAction, reviewData.length)"
                                :size="76"
                                :width="7"
                                color="warning"
                            >
                                <span class="text-h6 font-weight-bold">{{
                                    stats.needsAction
                                }}</span>
                            </v-progress-circular>
                            <div>
                                <div class="text-overline mb-1">Handlungs&shy;bedarf</div>
                                <div class="d-flex flex-column ga-1">
                                    <v-chip
                                        size="x-small"
                                        color="success"
                                        variant="tonal"
                                        prepend-icon="mdi-check-decagram"
                                    >
                                        angewendet: {{ stats.applied }}
                                    </v-chip>
                                    <v-chip
                                        size="x-small"
                                        variant="tonal"
                                        prepend-icon="mdi-help-rhombus-outline"
                                    >
                                        ohne Vorschlag: {{ stats.noSuggestion }}
                                    </v-chip>
                                </div>
                            </div>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>

            <!-- 2. Filter-/Sortierleiste -->
            <v-card variant="flat" rounded="lg" border class="mb-4">
                <v-card-text>
                    <!-- Zeile 1: prominente Suche -->
                    <div class="d-flex align-center ga-3 mb-3">
                        <v-text-field
                            v-model="search"
                            placeholder="Autor, Lied oder Beruf suchen …"
                            prepend-inner-icon="mdi-magnify"
                            variant="outlined"
                            hide-details
                            clearable
                            class="flex-grow-1"
                        />
                        <v-chip
                            v-if="doneCount"
                            variant="tonal"
                            color="success"
                            size="large"
                            prepend-icon="mdi-check-circle"
                            title="Als erledigt markiert"
                        >
                            {{ doneCount }} erledigt
                        </v-chip>
                        <v-chip variant="tonal" color="primary" size="large">
                            {{ filtered.length }} / {{ reviewData.length }}
                        </v-chip>
                    </div>
                    <!-- Zeile 2: Verdikt-Filter, Schalter, Sortierung -->
                    <div>
                        <div class="d-flex flex-wrap align-center ga-3">
                            <v-chip-group
                                v-model="selectedVerdicts"
                                multiple
                                selected-class="text-white"
                            >
                                <v-chip
                                    v-for="v in verdictList"
                                    :key="v.key"
                                    :value="v.key"
                                    :color="v.color"
                                    size="small"
                                    filter
                                >
                                    {{ v.label }}
                                </v-chip>
                            </v-chip-group>
                            <v-spacer />
                            <v-select
                                v-model="sortBy"
                                :items="sortOptions"
                                density="compact"
                                variant="outlined"
                                hide-details
                                label="Sortierung"
                                style="max-width: 230px; min-width: 200px"
                            />
                        </div>
                        <div class="d-flex flex-wrap align-center ga-3">
                            <v-switch
                                v-model="onlyAction"
                                color="warning"
                                density="compact"
                                hide-details
                                label="Nur Handlungsbedarf"
                            />
                            <v-switch
                                v-model="onlyWithRein"
                                color="success"
                                density="compact"
                                hide-details
                                :disabled="!songsLoaded"
                                label="Nur mit angenommenem Lied"
                            />
                            <v-switch
                                v-model="hideDone"
                                color="primary"
                                density="compact"
                                hide-details
                                label="Erledigte ausblenden"
                            />
                        </div>
                    </div>
                </v-card-text>
            </v-card>

            <!-- 3. Arbeitsbereich: Liste + Detail -->
            <v-row>
                <!-- Master-Liste -->
                <v-col cols="12" md="5" lg="4">
                    <v-card
                        variant="outlined"
                        rounded="lg"
                        :style="mdAndUp ? 'position: sticky; top: 16px' : ''"
                    >
                        <v-list
                            density="comfortable"
                            class="autor-list"
                            :style="
                                mdAndUp ? 'max-height: calc(100vh - 48px); overflow-y: auto' : ''
                            "
                        >
                            <template v-if="filtered.length">
                                <v-list-item
                                    v-for="rec in filtered"
                                    :key="rec.autor_id"
                                    :active="rec.autor_id === selectedId"
                                    color="primary"
                                    rounded="lg"
                                    :class="['mb-1', { 'autor-done': isDone(rec.autor_id) }]"
                                    @click="selectAuthor(rec.autor_id)"
                                >
                                    <template #prepend>
                                        <v-badge
                                            :model-value="isDone(rec.autor_id)"
                                            color="success"
                                            icon="mdi-check"
                                            location="bottom end"
                                            offset-x="3"
                                            offset-y="3"
                                            bordered
                                        >
                                            <v-avatar
                                                size="34"
                                                variant="tonal"
                                                :color="vmeta(rec.verdict).color"
                                            >
                                                <v-icon size="small">{{
                                                    vmeta(rec.verdict).icon
                                                }}</v-icon>
                                            </v-avatar>
                                        </v-badge>
                                    </template>
                                    <v-list-item-title class="text-body-2 font-weight-medium">
                                        {{ rec.vorname }} {{ rec.nachname }}
                                    </v-list-item-title>
                                    <v-list-item-subtitle class="text-caption">
                                        {{ lifespan(rec.liveBirth, rec.liveDeath) }}
                                    </v-list-item-subtitle>
                                    <template #append>
                                        <div class="d-flex flex-column align-end ga-1">
                                            <v-chip
                                                size="x-small"
                                                :color="confidenceColor(rec.confidence)"
                                                variant="tonal"
                                            >
                                                {{ confPct(rec.confidence) }}
                                            </v-chip>
                                            <v-icon
                                                v-if="rec.applied"
                                                color="success"
                                                size="small"
                                                title="Live-Datensatz entspricht dem KI-Vorschlag"
                                            >
                                                mdi-check-decagram
                                            </v-icon>
                                            <v-icon
                                                v-else-if="rec.needsAction"
                                                color="warning"
                                                size="small"
                                                title="Handlungsbedarf"
                                            >
                                                mdi-pencil-alert
                                            </v-icon>
                                        </div>
                                    </template>
                                </v-list-item>
                            </template>
                            <v-alert v-else type="info" variant="tonal" class="ma-2">
                                Keine Autoren für die aktuelle Auswahl.
                            </v-alert>
                        </v-list>
                    </v-card>
                </v-col>

                <!-- Detail-Panel -->
                <v-col cols="12" md="7" lg="8">
                    <v-card
                        v-if="selectedRecord"
                        variant="outlined"
                        rounded="lg"
                        border
                        :style="`border-inline-start: 4px solid ${vmeta(selectedRecord.verdict).hex}`"
                    >
                        <!-- Kopf -->
                        <v-card-item>
                            <template #prepend>
                                <v-avatar
                                    size="48"
                                    variant="tonal"
                                    :color="vmeta(selectedRecord.verdict).color"
                                >
                                    <v-icon>{{ vmeta(selectedRecord.verdict).icon }}</v-icon>
                                </v-avatar>
                            </template>
                            <v-card-title class="text-h6">
                                {{ selectedRecord.vorname }} {{ selectedRecord.nachname }}
                            </v-card-title>
                            <v-card-subtitle class="d-flex align-center flex-wrap ga-2">
                                <span class="autor-id">Autor #{{ selectedRecord.autor_id }}</span>
                                <v-chip
                                    v-if="songsLoaded && selectedRecord.reinCount"
                                    size="x-small"
                                    color="success"
                                    variant="tonal"
                                    prepend-icon="mdi-music-note"
                                >
                                    {{ selectedRecord.reinCount }} angenommen
                                </v-chip>
                                <v-chip
                                    v-if="songsLoaded && selectedRecord.otherCount"
                                    size="x-small"
                                    variant="tonal"
                                >
                                    +{{ selectedRecord.otherCount }} weitere
                                </v-chip>
                            </v-card-subtitle>
                            <template #append>
                                <div class="d-flex flex-column align-end ga-1">
                                    <v-chip
                                        :color="vmeta(selectedRecord.verdict).color"
                                        variant="flat"
                                        :prepend-icon="vmeta(selectedRecord.verdict).icon"
                                    >
                                        {{ vmeta(selectedRecord.verdict).label }}
                                    </v-chip>
                                    <div class="d-flex align-center ga-2 mt-1">
                                        <v-progress-circular
                                            :model-value="(selectedRecord.confidence || 0) * 100"
                                            :size="40"
                                            :width="4"
                                            :color="confidenceColor(selectedRecord.confidence)"
                                        >
                                            <span class="text-caption">{{
                                                confPct(selectedRecord.confidence)
                                            }}</span>
                                        </v-progress-circular>
                                        <v-chip
                                            size="x-small"
                                            variant="tonal"
                                            :color="selectedRecord.used_llm ? 'primary' : undefined"
                                            :prepend-icon="
                                                selectedRecord.used_llm
                                                    ? 'mdi-robot'
                                                    : 'mdi-robot-off'
                                            "
                                        >
                                            {{ selectedRecord.used_llm ? 'KI' : 'Regelbasiert' }}
                                        </v-chip>
                                    </div>
                                </div>
                            </template>
                        </v-card-item>

                        <v-divider />

                        <v-card-text>
                            <!-- Lieder des Autors (Live-Daten; angenommen = Rein, wie andere Ansichten) -->
                            <div class="mb-3">
                                <div class="text-overline mb-1">Lieder im Gesangbuch</div>
                                <div v-if="!songsLoaded" class="text-caption text-disabled">
                                    lädt …
                                </div>
                                <template v-else-if="totalSongCount">
                                    <div class="d-flex flex-wrap ga-1">
                                        <v-chip
                                            v-for="s in shownSongs"
                                            :key="s.id"
                                            size="x-small"
                                            label
                                            variant="tonal"
                                            :color="s.rein ? 'success' : undefined"
                                            :prepend-icon="s.rein ? 'mdi-check' : undefined"
                                        >
                                            {{ s.titel }}
                                        </v-chip>
                                    </div>
                                    <v-btn
                                        v-if="hiddenSongCount > 0 || showAllSongs"
                                        variant="text"
                                        size="x-small"
                                        class="mt-1 px-1"
                                        :prepend-icon="
                                            showAllSongs ? 'mdi-chevron-up' : 'mdi-chevron-down'
                                        "
                                        @click="showAllSongs = !showAllSongs"
                                    >
                                        {{
                                            showAllSongs
                                                ? 'Weniger anzeigen'
                                                : `Alle ${totalSongCount} anzeigen` +
                                                  (selectedRecord.otherCount
                                                      ? ` (inkl. ${selectedRecord.otherCount} nicht angenommen)`
                                                      : '')
                                        }}
                                    </v-btn>
                                </template>
                                <div v-else class="text-caption text-disabled">
                                    Keine zugeordneten Lieder im Gesangbuch.
                                </div>
                            </div>

                            <!-- Jahres-Vergleich -->
                            <v-card variant="tonal" rounded="lg" class="pa-3 mb-3 year-compare">
                                <v-btn
                                    v-if="canEditLive && !editMode"
                                    icon="mdi-pencil"
                                    size="x-small"
                                    variant="text"
                                    color="primary"
                                    class="year-compare-edit"
                                    title="Lebensdaten bearbeiten"
                                    @click="startEdit"
                                />
                                <v-row dense align="center" class="text-center">
                                    <v-col cols="12" :sm="editMode ? 'auto' : true">
                                        <div class="text-overline text-medium-emphasis">
                                            Snapshot (JSON)
                                        </div>
                                        <div class="text-subtitle-1 font-weight-medium">
                                            {{
                                                lifespan(
                                                    selectedRecord.snapshotBirth,
                                                    selectedRecord.snapshotDeath,
                                                )
                                            }}
                                        </div>
                                    </v-col>
                                    <v-col
                                        cols="12"
                                        sm="auto"
                                        class="d-none d-sm-flex justify-center"
                                    >
                                        <v-icon color="medium-emphasis">mdi-arrow-right</v-icon>
                                    </v-col>
                                    <v-col cols="12" :sm="editMode ? 'auto' : true">
                                        <div class="text-overline text-medium-emphasis">
                                            KI-Vorschlag
                                        </div>
                                        <div
                                            class="text-subtitle-1 font-weight-medium"
                                            :class="
                                                selectedRecord.hasSuggestion
                                                    ? 'text-primary'
                                                    : 'text-disabled'
                                            "
                                        >
                                            <template v-if="selectedRecord.hasSuggestion">
                                                {{
                                                    lifespan(
                                                        selectedRecord.suggestedBirth,
                                                        selectedRecord.suggestedDeath,
                                                    )
                                                }}
                                            </template>
                                            <template v-else-if="selectedRecord.verdict === 'ok'"
                                                >bestätigt</template
                                            >
                                            <template v-else>—</template>
                                        </div>
                                    </v-col>
                                    <v-col
                                        cols="12"
                                        sm="auto"
                                        class="d-none d-sm-flex justify-center"
                                    >
                                        <v-icon color="medium-emphasis">mdi-arrow-right</v-icon>
                                    </v-col>
                                    <v-col cols="12" sm="">
                                        <div class="text-overline text-medium-emphasis">
                                            Live (DB)
                                        </div>
                                        <!-- Bearbeiten: nur die beiden Felder; Speichern/Abbrechen unten rechts -->
                                        <div
                                            v-if="editMode"
                                            class="d-flex ga-2 justify-center flex-wrap"
                                        >
                                            <v-text-field
                                                v-model="manualBirth"
                                                type="number"
                                                label="geboren"
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                                clearable
                                                min="1"
                                                max="2199"
                                                step="1"
                                                style="width: 150px"
                                            />
                                            <v-text-field
                                                v-model="manualDeath"
                                                type="number"
                                                label="gestorben"
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                                clearable
                                                min="1"
                                                max="2199"
                                                step="1"
                                                style="width: 150px"
                                            />
                                        </div>
                                        <!-- Anzeige -->
                                        <div v-else class="text-subtitle-1 font-weight-bold">
                                            <template v-if="selectedRecord.liveFound">
                                                {{
                                                    lifespan(
                                                        selectedRecord.liveBirth,
                                                        selectedRecord.liveDeath,
                                                    )
                                                }}
                                            </template>
                                            <span v-else-if="!authorsLoaded" class="text-disabled"
                                                >lädt …</span
                                            >
                                            <span v-else class="text-disabled">nicht gefunden</span>
                                        </div>
                                    </v-col>
                                </v-row>

                                <div class="d-flex flex-wrap ga-2 mt-2 justify-center">
                                    <v-chip
                                        v-if="selectedRecord.snapshotDiffersLive"
                                        size="x-small"
                                        color="info"
                                        variant="tonal"
                                    >
                                        DB ≠ Snapshot
                                    </v-chip>
                                    <v-chip
                                        v-if="selectedRecord.applied"
                                        size="x-small"
                                        color="success"
                                        variant="tonal"
                                        prepend-icon="mdi-check-decagram"
                                    >
                                        Live aktuell
                                    </v-chip>
                                </div>

                                <!-- Optionaler Jahres-Zeitstrahl -->
                                <div v-if="yearStrip" class="year-strip mt-3">
                                    <div
                                        v-for="(lane, i) in yearStrip.lanes"
                                        :key="i"
                                        class="strip-row"
                                    >
                                        <div class="strip-label">{{ lane.label }}</div>
                                        <div class="strip-track">
                                            <div
                                                v-if="lane.type === 'bar'"
                                                class="strip-bar"
                                                :style="{
                                                    left: lane.left + '%',
                                                    width: lane.width + '%',
                                                    backgroundColor: lane.color,
                                                    borderStyle: lane.dashed ? 'dashed' : 'solid',
                                                }"
                                            />
                                            <div
                                                v-else
                                                class="strip-point"
                                                :style="{
                                                    left: lane.left + '%',
                                                    backgroundColor: lane.color,
                                                }"
                                                :title="String(lane.single)"
                                            />
                                        </div>
                                    </div>
                                    <div class="strip-axis">
                                        <span>{{ yearStrip.min }}</span>
                                        <span>{{ yearStrip.max }}</span>
                                    </div>
                                </div>

                                <!-- Aktionszeile: Bearbeiten -> Speichern/Abbrechen rechts;
                                     Ansicht -> KI-Vorschlag übernehmen -->
                                <div class="d-flex flex-wrap align-center ga-2 mt-3">
                                    <template v-if="editMode">
                                        <span class="text-caption text-medium-emphasis">
                                            Leere Felder entfernen das jeweilige Jahr.
                                        </span>
                                        <v-spacer />
                                        <v-btn size="small" variant="text" @click="cancelEdit">
                                            Abbrechen
                                        </v-btn>
                                        <v-btn
                                            size="small"
                                            color="primary"
                                            variant="flat"
                                            prepend-icon="mdi-content-save"
                                            :loading="applying === 'manual'"
                                            :disabled="
                                                !canApplyYears || !manualValid || !manualChangesLive
                                            "
                                            @click="saveManual"
                                        >
                                            Speichern
                                        </v-btn>
                                    </template>
                                    <template v-else>
                                        <v-btn
                                            color="primary"
                                            variant="flat"
                                            size="small"
                                            prepend-icon="mdi-robot"
                                            :loading="applying === 'suggestion'"
                                            :disabled="!canApplyYears || !suggestionChangesLive"
                                            @click="
                                                applyYears(
                                                    'suggestion',
                                                    selectedRecord.suggestedBirth,
                                                    selectedRecord.suggestedDeath,
                                                )
                                            "
                                        >
                                            KI-Vorschlag übernehmen
                                        </v-btn>
                                        <span
                                            v-if="selectedRecord.verdict === 'not_a_person'"
                                            class="text-caption text-error"
                                        >
                                            Kein Personendatensatz – Jahre nicht anwendbar.
                                        </span>
                                    </template>
                                </div>
                            </v-card>

                            <!-- Begründung -->
                            <v-alert
                                :type="vmeta(selectedRecord.verdict).alert"
                                variant="tonal"
                                class="mb-3"
                                prepend-icon="mdi-robot"
                            >
                                <div class="text-subtitle-2 mb-1">
                                    {{
                                        selectedRecord.used_llm
                                            ? 'KI-Begründung'
                                            : 'Regelbasierte Begründung'
                                    }}
                                </div>
                                <div class="text-body-2">
                                    {{ selectedRecord.reasoning || 'Keine Begründung hinterlegt.' }}
                                </div>
                                <div class="d-flex flex-wrap ga-1 mt-3">
                                    <v-chip
                                        v-for="s in sourceChips(selectedRecord)"
                                        :key="s.key"
                                        size="x-small"
                                        :color="s.checked ? s.color : undefined"
                                        :variant="s.checked ? 'flat' : 'outlined'"
                                        :prepend-icon="s.checked ? 'mdi-check' : s.icon"
                                    >
                                        {{ s.label }}
                                    </v-chip>
                                </div>
                            </v-alert>

                            <!-- Von KI gewählter Kandidat -->
                            <template v-if="selectedRecord.chosen">
                                <div class="d-flex align-center mb-2">
                                    <v-chip color="primary" size="small" prepend-icon="mdi-star"
                                        >Von KI gewählt</v-chip
                                    >
                                </div>
                                <AutorKandidatCard
                                    :candidate="selectedRecord.chosen"
                                    chosen
                                    :live-birth="selectedRecord.liveBirth"
                                    :live-death="selectedRecord.liveDeath"
                                    :applying-key="applying"
                                    :can-apply="canApplyYears"
                                    @apply="onCandidateApply"
                                />
                            </template>
                            <v-alert
                                v-else-if="selectedRecord.verdict !== 'not_a_person'"
                                type="info"
                                variant="tonal"
                                class="mb-3"
                            >
                                Die KI hat keinen Kandidaten ausgewählt.
                            </v-alert>

                            <!-- Alle Kandidaten -->
                            <div class="text-overline mt-4 mb-1">
                                Kandidaten ({{ (selectedRecord.candidates || []).length }})
                            </div>
                            <template v-if="(selectedRecord.candidates || []).length">
                                <AutorKandidatCard
                                    v-for="(c, i) in selectedRecord.candidates"
                                    :key="i"
                                    :candidate="c"
                                    :chosen="isChosen(c)"
                                    :live-birth="selectedRecord.liveBirth"
                                    :live-death="selectedRecord.liveDeath"
                                    :applying-key="applying"
                                    :can-apply="canApplyYears"
                                    @apply="onCandidateApply"
                                />
                            </template>
                            <v-alert v-else type="info" variant="tonal">
                                Keine Kandidaten in den geprüften Quellen gefunden.
                            </v-alert>
                        </v-card-text>

                        <v-divider />

                        <!-- Erledigt-Markierung ganz unten rechts: abschließende Aktion,
                             nachdem der Autor geprüft wurde. Nutzerübergreifend gespeichert. -->
                        <v-card-actions>
                            <v-spacer />
                            <v-btn
                                :color="isDone(selectedRecord.autor_id) ? 'success' : undefined"
                                :variant="isDone(selectedRecord.autor_id) ? 'flat' : 'tonal'"
                                :prepend-icon="
                                    isDone(selectedRecord.autor_id)
                                        ? 'mdi-check-circle'
                                        : 'mdi-checkbox-marked-circle-outline'
                                "
                                :loading="savingDone"
                                title="Nutzerübergreifend gespeichert"
                                @click="toggleDone(selectedRecord.autor_id)"
                            >
                                {{
                                    isDone(selectedRecord.autor_id)
                                        ? 'Erledigt'
                                        : 'Als erledigt markieren'
                                }}
                            </v-btn>
                        </v-card-actions>
                    </v-card>

                    <v-card
                        v-else
                        variant="outlined"
                        rounded="lg"
                        class="d-flex align-center justify-center"
                        min-height="240"
                    >
                        <div class="text-medium-emphasis">Autor links auswählen.</div>
                    </v-card>
                </v-col>
            </v-row>
        </template>

        <v-snackbar
            v-model="snackbar.show"
            :color="snackbar.color"
            timeout="3500"
            location="bottom right"
        >
            {{ snackbar.text }}
        </v-snackbar>

        <AutorDatencheckHilfe v-model="helpOpen" />
    </v-container>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { storeToRefs } from 'pinia';
import {
    Chart as ChartJS,
    ArcElement,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
} from 'chart.js';
import { Doughnut, Bar } from 'vue-chartjs';

import axios from '@/assets/js/axiossConfig';
import { useAppStore } from '@/store/app.js';
import { AUTOR_VEROEFFENTLICHT_STATUS } from '@/assets/js/gesangbuchChecks.js';
import AutorKandidatCard from '@/components/autor/AutorKandidatCard.vue';
import AutorDatencheckHilfe from '@/components/autor/AutorDatencheckHilfe.vue';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Statische Review-Datei in Directus (Issue #32). Über Env überschreibbar, damit
// eine neue Auswertung ohne Code-Deploy eingespielt werden kann.
const REVIEW_FILE_ID =
    import.meta.env.VITE_AUTOR_REVIEW_FILE_ID || '18b768e4-1ac6-41dc-b325-09dc112bacc0';

// Alle sechs Verdikte, die das Prüf-Skript erzeugen kann (Reihenfolge = Dringlichkeit).
// Die aktuelle Datei nutzt nur ok/mismatch/not_found/not_a_person; incomplete und
// ambiguous sind für künftige Auswertungen vorbereitet.
const VERDICTS = {
    mismatch: {
        label: 'Abweichung',
        color: 'warning',
        icon: 'mdi-alert',
        alert: 'warning',
        hex: '#FB8C00',
        rank: 0,
    },
    ambiguous: {
        label: 'Unklar',
        color: 'deep-purple',
        icon: 'mdi-help-rhombus',
        alert: 'warning',
        hex: '#7E57C2',
        rank: 1,
    },
    incomplete: {
        label: 'Unvollständig',
        color: 'amber-darken-2',
        icon: 'mdi-calendar-alert',
        alert: 'warning',
        hex: '#FFB300',
        rank: 2,
    },
    not_found: {
        label: 'Nicht gefunden',
        color: 'blue-grey',
        icon: 'mdi-help-circle',
        alert: 'info',
        hex: '#78909C',
        rank: 3,
    },
    not_a_person: {
        label: 'Keine Person',
        color: 'error',
        icon: 'mdi-account-off',
        alert: 'error',
        hex: '#E53935',
        rank: 4,
    },
    ok: {
        label: 'Stimmt überein',
        color: 'success',
        icon: 'mdi-check-circle',
        alert: 'success',
        hex: '#4CAF50',
        rank: 5,
    },
};
const vmeta = (v) =>
    VERDICTS[v] || {
        label: v,
        color: 'grey',
        icon: 'mdi-help',
        alert: 'info',
        hex: '#9E9E9E',
        rank: 9,
    };

const route = useRoute();
const router = useRouter();
const { mdAndUp } = useDisplay();
const appStore = useAppStore();
const { authors, gesangbuchlieder, settingsData } = storeToRefs(appStore);

const reviewData = ref([]);
const loading = ref(true);
const loadError = ref(null);

const search = ref('');
const selectedVerdicts = ref(Object.keys(VERDICTS));
const onlyAction = ref(false);
const onlyWithRein = ref(true);
const hideDone = ref(true);
const showAllSongs = ref(false);
const SONG_PREVIEW_LIMIT = 8;
const sortBy = ref('urgency');
const sortOptions = [
    { title: 'Dringlichkeit', value: 'urgency' },
    { title: 'Konfidenz aufsteigend', value: 'conf_asc' },
    { title: 'Konfidenz absteigend', value: 'conf_desc' },
    { title: 'Name A–Z', value: 'name' },
    { title: 'Größte Jahres-Abweichung', value: 'deviation' },
];

const selectedId = ref(null);
const manualBirth = ref(null);
const manualDeath = ref(null);
const editMode = ref(false);
const applying = ref(null);
const snackbar = ref({ show: false, color: 'success', text: '' });

// Erklär-Dialog: einmalig beim ersten Besuch automatisch öffnen, danach nur noch
// über das Hilfe-Symbol. Merker pro Browser.
const INTRO_SEEN_KEY = 'autoren_datencheck_intro_seen';
const helpOpen = ref(false);

// „Erledigt“-Status – nutzerübergreifend in Directus persistiert
// (settings.autoren_check, Issue #32), damit der Kleine Kreis die Liste gemeinsam
// systematisch abarbeiten kann. Das JSON-„Tags“-Feld speichert Strings, daher
// alle Vergleiche/Schreibvorgänge über String(id) normalisieren.
const doneIds = computed(() => {
    const v = settingsData.value?.autoren_check;
    return Array.isArray(v) ? v.map(String) : [];
});
// Verhindert überlappende PATCHes auf den Singleton während ein Speichern läuft.
const savingDone = ref(false);

// --- Helpers --------------------------------------------------------------
const confPct = (c) => (c == null ? '–' : `${Math.round(c * 100)}%`);
const pct = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);
// Lebensdaten freundlich darstellen – ohne *- und †-Symbole (vgl. Issue #18):
//   beide:        1798–1874
//   nur geboren:  geb. 1798
//   nur gestorben: gest. 1874
//   keine:        ohne Jahresangabe
const lifespan = (b, d) => {
    if (b != null && d != null) return `${b}–${d}`;
    if (b != null) return `geb. ${b}`;
    if (d != null) return `gest. ${d}`;
    return 'ohne Jahresangabe';
};
// Parst eine Jahreszahl. Leeres Feld -> null (= bewusst leeren im Manuell-Pfad).
// Nicht-ganzzahlige oder unplausible Eingaben (z. B. exponentiell "1e3",
// Kommazahlen, Negativwerte) werden zu null verworfen, statt falsche Jahre wie
// parseInt("1e3") === 1 in den Live-Datensatz zu schreiben.
const toYearOrNull = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 && n < 2200 ? n : null;
};
// Prüft, ob ein nicht-leeres Feld gültig parst (für die Validierung der Eingabe).
const isValidYearInput = (v) => v == null || v === '' || toYearOrNull(v) != null;
const eqYear = (a, b) => (a ?? null) === (b ?? null);
const sameYears = (b1, d1, b2, d2) => eqYear(b1, b2) && eqYear(d1, d2);
const confidenceColor = (c) =>
    c == null
        ? 'grey'
        : c >= 0.9
          ? 'success'
          : c >= 0.7
            ? 'warning'
            : c > 0
              ? 'deep-orange'
              : 'grey';
const isChosen = (c) =>
    !!selectedRecord.value?.chosen &&
    c.source === selectedRecord.value.chosen.source &&
    c.ref_id === selectedRecord.value.chosen.ref_id;

const authorsLoaded = computed(() => authors.value.length > 0);
const authorById = computed(() => {
    const map = {};
    for (const a of authors.value) map[a.id] = a;
    return map;
});

// „Rein“ = vom Kleinen Kreis angenommen (gleiche Logik wie die übrigen Ansichten).
const isRein = (bezeichner) => !!bezeichner && bezeichner.toLowerCase().includes('rein');
const songsLoaded = computed(() => gesangbuchlieder.value.length > 0);

// Lieder je Autor aus den LIVE-Daten ableiten (Text- bzw. Melodie-Autor),
// dedupliziert pro Gesangbuchlied und getrennt nach angenommen (Rein) / übrig.
// Wir nutzen die Live-Zuordnung statt des statischen titles-Feldes, damit die
// Anzeige mit den anderen Ansichten übereinstimmt und die Bewertung bekannt ist.
const songsByAutor = computed(() => {
    const map = {};
    const seen = {};
    for (const lied of gesangbuchlieder.value) {
        const ids = new Set();
        for (const a of lied.text?.authors || []) if (a.autor_id != null) ids.add(a.autor_id);
        for (const a of lied.melodie?.authors || []) if (a.autor_id != null) ids.add(a.autor_id);
        if (!ids.size) continue;
        const titel = lied.titel || lied.text?.titel || lied.melodie?.titel || '(ohne Titel)';
        const rein = isRein(lied.bewertung_kleiner_kreis?.bezeichner);
        for (const id of ids) {
            if (!map[id]) {
                map[id] = { rein: [], other: [] };
                seen[id] = new Set();
            }
            if (seen[id].has(lied.id)) continue;
            seen[id].add(lied.id);
            (rein ? map[id].rein : map[id].other).push({ id: lied.id, titel });
        }
    }
    const byTitel = (a, b) => a.titel.localeCompare(b.titel, 'de');
    for (const id in map) {
        map[id].rein.sort(byTitel);
        map[id].other.sort(byTitel);
    }
    return map;
});

// --- Merge Review + Live --------------------------------------------------
const merged = computed(() =>
    reviewData.value.map((rec) => {
        const live = authorById.value[rec.autor_id] || null;
        const liveBirth = live?.geburtsjahr ?? null;
        const liveDeath = live?.sterbejahr ?? null;
        const snapshotBirth = rec.on_file_birth ?? null;
        const snapshotDeath = rec.on_file_death ?? null;
        const suggestedBirth = rec.suggested_birth ?? null;
        const suggestedDeath = rec.suggested_death ?? null;
        const hasSuggestion = suggestedBirth != null || suggestedDeath != null;
        // Live-abhängige Ableitungen erst berechnen, sobald die Autoren geladen
        // sind – sonst zeigt das Dashboard während des Ladens fälschlich „alles
        // offen / DB ≠ Snapshot“, weil live* noch null ist.
        const loaded = authorsLoaded.value;
        const applied =
            loaded &&
            hasSuggestion &&
            sameYears(liveBirth, liveDeath, suggestedBirth, suggestedDeath);
        const snapshotDiffersLive =
            loaded && !sameYears(liveBirth, liveDeath, snapshotBirth, snapshotDeath);
        const needsAction = loaded
            ? rec.verdict !== 'ok' || (hasSuggestion && !applied)
            : rec.verdict !== 'ok';
        const songs = songsByAutor.value[rec.autor_id];
        const reinCount = songs?.rein.length || 0;
        const otherCount = songs?.other.length || 0;
        return {
            ...rec,
            live,
            liveFound: !!live,
            reinCount,
            otherCount,
            hasReinSong: reinCount > 0,
            liveBirth,
            liveDeath,
            snapshotBirth,
            snapshotDeath,
            suggestedBirth,
            suggestedDeath,
            hasSuggestion,
            applied,
            snapshotDiffersLive,
            needsAction,
        };
    }),
);

const filtered = computed(() => {
    const q = (search.value || '').trim().toLowerCase();
    let arr = merged.value.filter((r) => {
        if (selectedVerdicts.value.length && !selectedVerdicts.value.includes(r.verdict))
            return false;
        if (onlyAction.value && !r.needsAction) return false;
        // Nur Autoren mit mind. einem angenommenen Lied (Rein). Greift erst, wenn
        // die Lied-Daten geladen sind, sonst würde es alle ausblenden.
        if (onlyWithRein.value && songsLoaded.value && !r.hasReinSong) return false;
        if (hideDone.value && isDone(r.autor_id)) return false;
        if (q) {
            const songs = songsByAutor.value[r.autor_id];
            const hay = [
                r.name,
                r.vorname,
                r.nachname,
                ...(r.candidates || []).map((c) => c.label),
                ...(r.candidates || []).flatMap((c) => c.occupations || []),
                ...(songs ? [...songs.rein, ...songs.other].map((s) => s.titel) : []),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    const dev = (r) =>
        Math.abs((r.suggestedBirth ?? r.snapshotBirth ?? 0) - (r.snapshotBirth ?? 0)) +
        Math.abs((r.suggestedDeath ?? r.snapshotDeath ?? 0) - (r.snapshotDeath ?? 0));

    arr = [...arr];
    switch (sortBy.value) {
        case 'conf_asc':
            arr.sort((a, b) => (a.confidence ?? 0) - (b.confidence ?? 0));
            break;
        case 'conf_desc':
            arr.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
            break;
        case 'name':
            arr.sort((a, b) =>
                `${a.nachname} ${a.vorname}`.localeCompare(`${b.nachname} ${b.vorname}`, 'de'),
            );
            break;
        case 'deviation':
            arr.sort((a, b) => dev(b) - dev(a));
            break;
        default: // urgency
            arr.sort(
                (a, b) =>
                    vmeta(a.verdict).rank - vmeta(b.verdict).rank ||
                    (a.confidence ?? 0) - (b.confidence ?? 0) ||
                    `${a.nachname}`.localeCompare(`${b.nachname}`, 'de'),
            );
    }
    return arr;
});

const selectedRecord = computed(
    () => merged.value.find((r) => r.autor_id === selectedId.value) || null,
);
const doneCount = computed(() => merged.value.filter((r) => isDone(r.autor_id)).length);

// Lieder des ausgewählten Autors für die Detailanzeige.
const selectedSongs = computed(
    () => songsByAutor.value[selectedId.value] || { rein: [], other: [] },
);
const totalSongCount = computed(
    () => selectedSongs.value.rein.length + selectedSongs.value.other.length,
);
// Standard: nur angenommene (Rein) Lieder, auf SONG_PREVIEW_LIMIT gekürzt.
// „Alle anzeigen“ blendet zusätzlich die übrigen (nicht angenommenen) Lieder ein.
const shownSongs = computed(() => {
    const { rein, other } = selectedSongs.value;
    if (showAllSongs.value) {
        return [
            ...rein.map((s) => ({ ...s, rein: true })),
            ...other.map((s) => ({ ...s, rein: false })),
        ];
    }
    return rein.slice(0, SONG_PREVIEW_LIMIT).map((s) => ({ ...s, rein: true }));
});
const hiddenSongCount = computed(() => totalSongCount.value - shownSongs.value.length);

const canApplyYears = computed(
    () =>
        !!selectedRecord.value?.liveFound &&
        selectedRecord.value?.verdict !== 'not_a_person' &&
        applying.value === null,
);
// Direktes Bearbeiten der Live-Jahre erlaubt? (Stift im Kopfbereich)
const canEditLive = computed(
    () => !!selectedRecord.value?.liveFound && selectedRecord.value?.verdict !== 'not_a_person',
);

// Beim Übernehmen aus einer Quelle (Kandidat/KI-Vorschlag) bedeutet ein
// fehlendes Jahr (null) „Live-Wert beibehalten“ statt „löschen“ – so wird ein
// bekanntes Geburts-/Sterbejahr nie versehentlich durch eine Quelle ohne dieses
// Jahr überschrieben. Nur der Manuell-Pfad löscht leere Felder explizit.
const mergeYears = (rec, b, d) => ({
    geburtsjahr: b == null ? rec.liveBirth ?? null : b,
    sterbejahr: d == null ? rec.liveDeath ?? null : d,
});
const wouldChangeLive = (rec, b, d) => !eqYear(b, rec.liveBirth) || !eqYear(d, rec.liveDeath);

// KI-Vorschlag: nach Merge-Logik wirksam und verändert den Live-Datensatz?
const suggestionChangesLive = computed(() => {
    const r = selectedRecord.value;
    if (!r || !r.hasSuggestion) return false;
    const m = mergeYears(r, r.suggestedBirth, r.suggestedDeath);
    return wouldChangeLive(r, m.geburtsjahr, m.sterbejahr);
});

// Manuell: gültige Eingabe + tatsächliche Änderung gegenüber Live.
const manualValid = computed(
    () => isValidYearInput(manualBirth.value) && isValidYearInput(manualDeath.value),
);
const manualChangesLive = computed(() => {
    const r = selectedRecord.value;
    if (!r) return false;
    return wouldChangeLive(r, toYearOrNull(manualBirth.value), toYearOrNull(manualDeath.value));
});

// --- Dashboard-Statistik --------------------------------------------------
const stats = computed(() => {
    const data = merged.value;
    const verdictCounts = { ok: 0, mismatch: 0, not_found: 0, not_a_person: 0 };
    let gnd = 0,
        wikidata = 0,
        web = 0,
        llmTrue = 0,
        llmFalse = 0;
    let needsAction = 0,
        applied = 0,
        noSuggestion = 0;
    const conf = { zero: 0, low: 0, mid: 0, high: 0 };
    for (const r of data) {
        verdictCounts[r.verdict] = (verdictCounts[r.verdict] || 0) + 1;
        const sc = r.sources_checked || [];
        if (sc.includes('gnd')) gnd += 1;
        if (sc.includes('wikidata')) wikidata += 1;
        if (sc.includes('web')) web += 1;
        if (r.used_llm) llmTrue += 1;
        else llmFalse += 1;
        if (r.needsAction) needsAction += 1;
        if (r.applied) applied += 1;
        if (!r.hasSuggestion && !(r.candidates || []).length) noSuggestion += 1;
        // Unbekannte Konfidenz (null) nicht als 0 % zählen – das wäre eine andere
        // Aussage. Aktuell hat die Datei keine null-Werte, der Guard hält den
        // Balken aber korrekt, falls künftig welche auftreten.
        const c = r.confidence;
        if (c == null) {
            /* unbekannt: nicht im Histogramm zählen */
        } else if (c <= 0) conf.zero += 1;
        else if (c < 0.7) conf.low += 1;
        else if (c < 0.9) conf.mid += 1;
        else conf.high += 1;
    }
    return {
        verdictCounts,
        gnd,
        wikidata,
        web,
        llmTrue,
        llmFalse,
        needsAction,
        applied,
        noSuggestion,
        conf,
    };
});

// Nur tatsächlich vorkommende Verdikte zeigen (kein Ballast durch leere
// Kategorien); Reihenfolge folgt dem rank aus VERDICTS.
const verdictList = computed(() =>
    Object.entries(VERDICTS)
        .map(([key, m]) => ({
            key,
            label: m.label,
            color: m.color,
            icon: m.icon,
            hex: m.hex,
            count: stats.value.verdictCounts[key] || 0,
        }))
        .filter((v) => v.count > 0),
);

const sourceCoverage = computed(() => [
    { key: 'gnd', label: 'GND', icon: 'mdi-library', color: 'indigo', count: stats.value.gnd },
    {
        key: 'wikidata',
        label: 'Wikidata',
        icon: 'mdi-database',
        color: 'teal',
        count: stats.value.wikidata,
    },
    { key: 'web', label: 'Web', icon: 'mdi-web', color: 'blue-grey', count: stats.value.web },
]);

const sourceChips = (rec) => {
    const checked = rec.sources_checked || [];
    return [
        {
            key: 'gnd',
            label: 'GND',
            icon: 'mdi-library',
            color: 'indigo',
            checked: checked.includes('gnd'),
        },
        {
            key: 'wikidata',
            label: 'Wikidata',
            icon: 'mdi-database',
            color: 'teal',
            checked: checked.includes('wikidata'),
        },
        {
            key: 'web',
            label: 'Web',
            icon: 'mdi-web',
            color: 'blue-grey',
            checked: checked.includes('web'),
        },
    ];
};

// --- Charts ---------------------------------------------------------------
const donutData = computed(() => ({
    labels: verdictList.value.map((v) => v.label),
    datasets: [
        {
            data: verdictList.value.map((v) => v.count),
            backgroundColor: verdictList.value.map((v) => v.hex),
            borderWidth: 0,
        },
    ],
}));
const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: { legend: { display: false } },
};

const histData = computed(() => ({
    labels: ['0%', '<70%', '70–89%', '≥90%'],
    datasets: [
        {
            data: [
                stats.value.conf.zero,
                stats.value.conf.low,
                stats.value.conf.mid,
                stats.value.conf.high,
            ],
            backgroundColor: ['#9E9E9E', '#FF7043', '#FB8C00', '#4CAF50'],
            borderRadius: 4,
        },
    ],
}));
const histOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
        y: { beginAtZero: true, ticks: { stepSize: 5, precision: 0 } },
        x: { grid: { display: false } },
    },
};

// --- Jahres-Zeitstrahl ----------------------------------------------------
const yearStrip = computed(() => {
    const r = selectedRecord.value;
    if (!r || r.verdict === 'not_a_person') return null;
    const lanes = [];
    const add = (label, b, d, color, dashed = false) => {
        if (b == null && d == null) return;
        lanes.push({ label, b, d, color, dashed });
    };
    add('Live', r.liveBirth, r.liveDeath, '#1867C0');
    if (r.snapshotDiffersLive) add('Snapshot', r.snapshotBirth, r.snapshotDeath, '#B0BEC5', true);
    if (r.hasSuggestion)
        add('KI-Vorschlag', r.suggestedBirth, r.suggestedDeath, vmeta(r.verdict).hex);
    if (!lanes.length) return null;

    const years = [];
    for (const l of lanes) {
        if (l.b != null) years.push(l.b);
        if (l.d != null) years.push(l.d);
    }
    for (const c of r.candidates || []) {
        if (c.birth_year != null) years.push(c.birth_year);
        if (c.death_year != null) years.push(c.death_year);
    }
    let min = Math.min(...years);
    let max = Math.max(...years);
    if (min === max) {
        min -= 10;
        max += 10;
    }
    const pad = Math.max(5, Math.round((max - min) * 0.1));
    min -= pad;
    max += pad;
    const span = max - min || 1;
    const at = (y) => Math.max(0, Math.min(100, ((y - min) / span) * 100));

    const out = lanes.map((l) => {
        if (l.b != null && l.d != null) {
            const left = at(l.b);
            return { ...l, type: 'bar', left, width: Math.max(2, at(l.d) - left) };
        }
        const y = l.b != null ? l.b : l.d;
        return { ...l, type: 'point', left: at(y), single: y };
    });
    return { min: Math.round(min), max: Math.round(max), lanes: out };
});

// --- Aktionen -------------------------------------------------------------
// Kandidat/„Von KI gewählt“: Merge-Logik (fehlende Jahre = Live beibehalten).
function onCandidateApply({ key, birth, death }) {
    applyYears(key, birth, death, { clearNulls: false });
}

function toggleVerdict(key) {
    const set = new Set(selectedVerdicts.value);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    selectedVerdicts.value = [...set];
}

function selectAuthor(id) {
    selectedId.value = id;
    if (String(route.params.id) !== String(id)) {
        router.replace({ name: 'AutorenDatencheck', params: { id: String(id) } });
    }
}

async function applyYears(targetKey, b, d, { clearNulls = false } = {}) {
    const r = selectedRecord.value;
    if (!r) return false;
    // Sicherheitsnetz: für „Keine Person“ niemals Lebensdaten schreiben.
    if (r.verdict === 'not_a_person') return false;
    applying.value = targetKey;
    const parsedB = toYearOrNull(b);
    const parsedD = toYearOrNull(d);
    // clearNulls (Manuell): leere Felder löschen das Jahr (null).
    // Sonst (Quelle): fehlendes Jahr behält den bestehenden Live-Wert.
    const { geburtsjahr, sterbejahr } = clearNulls
        ? { geburtsjahr: parsedB, sterbejahr: parsedD }
        : mergeYears(r, parsedB, parsedD);
    try {
        await appStore.updateAutorLebensdaten(r.autor_id, { geburtsjahr, sterbejahr });
        snackbar.value = {
            show: true,
            color: 'success',
            text: `Lebensdaten gespeichert: ${r.nachname} (${lifespan(geburtsjahr, sterbejahr)})`,
        };
        return true;
    } catch (e) {
        snackbar.value = { show: true, color: 'error', text: 'Speichern fehlgeschlagen.' };
        return false;
    } finally {
        applying.value = null;
    }
}

// --- Erledigt-Status (in Directus persistiert) -------------------------------
const isDone = (id) => doneIds.value.includes(String(id));
async function toggleDone(id) {
    if (savingDone.value) return;
    const key = String(id);
    const wasDone = doneIds.value.includes(key);
    const next = wasDone ? doneIds.value.filter((x) => x !== key) : [...doneIds.value, key];

    // Beim Markieren: wenn Erledigte ausgeblendet sind und der aktuell gewählte
    // Autor erledigt wird, gleich zum nächsten offenen springen (Durcharbeiten).
    // Den Nachfolger anhand der NOCH ungefilterten Liste bestimmen (vor dem Save).
    let nextId = null;
    if (!wasDone && hideDone.value && id === selectedId.value) {
        const list = filtered.value;
        const idx = list.findIndex((r) => r.autor_id === id);
        const rest = list.filter((r) => r.autor_id !== id);
        nextId = (rest[idx] || rest[idx - 1] || rest[0])?.autor_id ?? null;
    }

    savingDone.value = true;
    try {
        await appStore.updateAutorenCheck(next);
        // Beim Markieren als erledigt zusätzlich den Autor-Status auf
        // „Veröffentlicht" (published) setzen – dient intern als
        // „ist korrekturgelesen"-Marker (Issue #44). Nur beim Markieren, nicht beim
        // Zurücknehmen. Schlägt nur das Status-Setzen fehl, bleibt der Erledigt-Haken
        // gültig; der Nutzer wird gewarnt.
        if (!wasDone) {
            try {
                await appStore.updateAutorStatus(id, AUTOR_VEROEFFENTLICHT_STATUS);
            } catch (statusError) {
                snackbar.value = {
                    show: true,
                    color: 'warning',
                    text: 'Als erledigt markiert, aber der Autor-Status konnte nicht auf „Veröffentlicht" gesetzt werden.',
                };
            }
        }
        if (nextId != null) selectAuthor(nextId);
    } catch (e) {
        snackbar.value = {
            show: true,
            color: 'error',
            text: 'Erledigt-Status konnte nicht gespeichert werden.',
        };
    } finally {
        savingDone.value = false;
    }
}

// --- Inline-Bearbeitung der Live-Jahre (Stift im Jahres-Vergleich) --------
function startEdit() {
    const r = selectedRecord.value;
    manualBirth.value = r?.liveBirth ?? null;
    manualDeath.value = r?.liveDeath ?? null;
    editMode.value = true;
}
function cancelEdit() {
    const r = selectedRecord.value;
    manualBirth.value = r?.liveBirth ?? null;
    manualDeath.value = r?.liveDeath ?? null;
    editMode.value = false;
}
async function saveManual() {
    const ok = await applyYears('manual', manualBirth.value, manualDeath.value, {
        clearNulls: true,
    });
    if (ok) editMode.value = false;
}

// --- Laden + Routen-Sync --------------------------------------------------
function restoreOrDefaultSelection() {
    const idParam = route.params.id;
    if (idParam != null && idParam !== '') {
        const idNum = parseInt(idParam, 10);
        if (merged.value.some((r) => r.autor_id === idNum)) {
            selectedId.value = idNum;
            return;
        }
    }
    // Standard: erstes Element der dringlichkeits-sortierten Handlungsbedarf-Menge.
    const firstAction = filtered.value.find((r) => r.needsAction);
    selectedId.value = (firstAction || filtered.value[0])?.autor_id ?? null;
}

async function loadReview() {
    loading.value = true;
    loadError.value = null;
    try {
        const resp = await axios.get(
            `${import.meta.env.VITE_BACKEND_URL}/assets/${REVIEW_FILE_ID}`,
        );
        const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        reviewData.value = Array.isArray(data) ? data : [];
    } catch (e) {
        loadError.value = e?.message || 'Unbekannter Fehler';
    } finally {
        loading.value = false;
        restoreOrDefaultSelection();
    }
}

// Manuelle Felder mit den Live-Werten vorbelegen – sowohl beim Autorwechsel als
// auch, wenn die Live-Daten ERST NACH der Auswahl eintreffen (Lade-Reihenfolge).
// An die abgeleiteten Live-Jahre gekoppelt, damit nach einem späten Laden nicht
// versehentlich leere Felder eine gültige Lebensdaten-Zeile überschreiben.
watch(
    () => [
        selectedRecord.value?.autor_id,
        selectedRecord.value?.liveBirth,
        selectedRecord.value?.liveDeath,
    ],
    () => {
        const r = selectedRecord.value;
        manualBirth.value = r?.liveBirth ?? null;
        manualDeath.value = r?.liveDeath ?? null;
    },
    { immediate: true },
);

// Beim Autorwechsel die Lieder-Liste einklappen und die Bearbeitung beenden.
watch(selectedId, () => {
    showAllSongs.value = false;
    editMode.value = false;
});

// Gegenrichtung des Routen-Syncs: ändert sich der :id-Parameter bei gemountetem
// View (Deep-Link, Browser-Zurück/Vor), die Auswahl mitführen.
watch(
    () => route.params.id,
    (idParam) => {
        if (idParam == null || idParam === '') return;
        const idNum = parseInt(idParam, 10);
        if (
            !Number.isNaN(idNum) &&
            idNum !== selectedId.value &&
            merged.value.some((r) => r.autor_id === idNum)
        ) {
            selectedId.value = idNum;
        }
    },
);

// Falls die Live-Autoren später als das Review laden, eine Default-Auswahl setzen.
watch(authors, () => {
    if (selectedId.value == null && reviewData.value.length) restoreOrDefaultSelection();
});

onMounted(() => {
    // Beim allerersten Öffnen den Erklär-Dialog zeigen (genau einmal pro Browser).
    if (localStorage.getItem(INTRO_SEEN_KEY) !== '1') {
        helpOpen.value = true;
        localStorage.setItem(INTRO_SEEN_KEY, '1');
    }
});

onMounted(loadReview);
</script>

<style scoped lang="scss">
/* Als erledigt markierte Autoren in der Liste dezent hervorheben: leichter
   Grünschleier + grüner Akzentstreifen links (per inset-Shadow, damit er der
   abgerundeten Ecke folgt) + durchgestrichener Name. Die aktive Auswahl behält
   ihre Primär-Hervorhebung (daher :not(--active)). */
.autor-done:not(.v-list-item--active) {
    opacity: 0.82;
    background: rgba(var(--v-theme-success), 0.07);
    box-shadow: inset 3px 0 0 0 rgb(var(--v-theme-success));
}
.autor-done:not(.v-list-item--active) :deep(.v-list-item-title) {
    text-decoration: line-through;
    text-decoration-color: rgba(var(--v-theme-success), 0.55);
}

/* Bearbeiten-Stift in der oberen rechten Ecke des Jahres-Vergleichs. */
.year-compare {
    position: relative;
}
.year-compare-edit {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 1;
}
.donut-wrap {
    position: relative;
    height: 150px;
}
.donut-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}
.chart-wrap {
    height: 150px;
}
.autor-id {
    font-family: monospace;
}

/* Jahres-Zeitstrahl */
.year-strip {
    border-top: 1px dashed rgba(0, 0, 0, 0.12);
    padding-top: 8px;
}
.strip-row {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
}
.strip-label {
    width: 84px;
    flex: 0 0 84px;
    font-size: 0.7rem;
    color: rgba(0, 0, 0, 0.6);
}
.strip-track {
    position: relative;
    flex: 1 1 auto;
    height: 16px;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
}
.strip-bar {
    position: absolute;
    top: 3px;
    height: 10px;
    min-width: 6px;
    border-radius: 4px;
    border-width: 1px;
    border-color: rgba(0, 0, 0, 0.18);
    opacity: 0.9;
}
.strip-point {
    position: absolute;
    top: 3px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transform: translateX(-50%);
}
.strip-axis {
    display: flex;
    justify-content: space-between;
    margin-left: 84px;
    font-size: 0.65rem;
    color: rgba(0, 0, 0, 0.5);
}
</style>
