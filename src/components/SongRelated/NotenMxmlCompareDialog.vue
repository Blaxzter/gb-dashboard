<script setup>
// Notenbild und MusicXML nebeneinander: links das SVG aus der Noten-PDF
// (gb-scripts/app/30), rechts die MusicXML, mit OpenSheetMusicDisplay gesetzt.
// Darüber der Liedtext-Abgleich aus den Checks; die Wörter, die nur in der
// MusicXML stehen, sind im rechten Notensatz rot markiert. So sieht man, ob eine
// MusicXML noch zum Notensatz passt, ohne Finale zu öffnen.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { liedtextBefund } from '@/assets/js/gesangbuchChecks.js';
import { lyricsToMark, readMusicXml } from '@/assets/js/notenAbgleich';
import { musicXmlText } from '@/assets/js/notenAbgleichLoader';
import { useStrophe1Ocr } from '@/assets/js/strophe1Ocr.js';

const props = defineProps({
    selectedSong: { type: Object, required: true },
});

const backendUrl = import.meta.env.VITE_BACKEND_URL;
const dialog = ref(false);

const svgUrl = computed(() =>
    props.selectedSong?.notentext_svg
        ? `${backendUrl}/assets/${props.selectedSong.notentext_svg}`
        : null,
);
// Script 30 lädt kein neues SVG hoch, solange die MusicXML nicht zur Noten-PDF
// passt – dann steht links noch das Bild einer älteren PDF.
const svgVeraltet = computed(() => {
    const svg = props.selectedSong?.notentext_svg_file?.uploaded_on;
    const pdfs = [props.selectedSong?.notentext_file, props.selectedSong?.notentext_seite2_file]
        .map((f) => f?.uploaded_on)
        .filter(Boolean);
    return !!svg && pdfs.some((pdf) => new Date(pdf) > new Date(svg));
});
const pdfUrl = computed(() =>
    props.selectedSong?.notentext ? `${backendUrl}/assets/${props.selectedSong.notentext}` : null,
);

// Ein Zoom für beide Seiten: Er macht SVG und Notensatz-Fläche gleich breiter.
// Den OSMD-Zoom bindet render() an die Breite der Fläche, damit OSMD bei jedem
// Zoom dieselben Systeme setzt – bei 0.9 auf 775px blieben die Umbrüche aus der
// MusicXML erhalten (größer bricht OSMD lange Systeme zusätzlich um).
const OSMD_ZOOM_PER_PX = 0.9 / 775;
const zoom = ref(1);
function zoomBy(step) {
    zoom.value = Math.min(2.5, Math.max(0.5, Math.round((zoom.value + step) * 100) / 100));
}

const osmdHost = ref(null);
const loading = ref(false);
const error = ref('');
const score = ref(null);
let osmd = null;

const ocr = useStrophe1Ocr();
const befund = computed(() => {
    if (!score.value || ocr.status.value !== 'ready') return null;
    return liedtextBefund(
        props.selectedSong,
        ocr.findingFor(props.selectedSong),
        score.value.words,
    );
});

async function build() {
    error.value = '';
    score.value = null;
    loading.value = true;
    ocr.loadOnce();
    try {
        const resp = await fetch(`${backendUrl}/assets/${props.selectedSong.notentext_mxml}`);
        if (!resp.ok) throw new Error(`Download fehlgeschlagen (${resp.status})`);
        const xml = await musicXmlText(await resp.arrayBuffer());
        score.value = readMusicXml(xml);
        await nextTick();
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
        osmd = new OpenSheetMusicDisplay(osmdHost.value, {
            autoResize: false,
            backend: 'svg',
            drawTitle: false,
            drawSubtitle: false,
            drawComposer: false,
            drawLyricist: false,
            drawPartNames: false,
            drawMeasureNumbers: false,
            drawLyrics: true,
            // Systemumbrüche wie im Notensatz (app/31 schreibt sie in die MusicXML).
            newSystemFromXML: true,
        });
        const rules = osmd.EngravingRules;
        if (rules) {
            rules.PageLeftMargin = 1;
            rules.PageRightMargin = 1;
            rules.PageTopMargin = 1;
            rules.PageBottomMargin = 1;
        }
        await osmd.load(xml);
        render();
    } catch (e) {
        error.value = e?.message || String(e);
    } finally {
        loading.value = false;
    }
}

function render() {
    if (!osmd || !osmdHost.value) return;
    osmd.zoom = OSMD_ZOOM_PER_PX * osmdHost.value.clientWidth;
    osmd.render();
    markWords();
}

// Die Wörter, die nur in der MusicXML stehen, im Notensatz rot einfärben – nur
// die Vorkommen, die sich im Abgleich nach Reihenfolge nicht zuordnen lassen
// (sonst würde bei „Dein“ → „dein“ jedes „dein“ des Lieds rot).
function markWords() {
    const onlyXml = befund.value?.onlyXml || [];
    const text = ocr.findingFor(props.selectedSong)?.strophe_1_notenbild;
    if (!onlyXml.length || !text || !osmd?.GraphicSheet) return;
    const words = scoreWords();
    const marked = lyricsToMark(
        text,
        words.map((w) => w.text),
        onlyXml,
    );
    for (const i of marked) {
        for (const node of words[i].nodes) {
            // SVGNode ist eine <g>; die Farbe steht als fill am <text>.
            for (const el of node?.querySelectorAll('text') || []) {
                el.style.fill = 'rgb(var(--v-theme-error))';
                el.style.fontWeight = 'bold';
            }
        }
    }
}

// Die Wörter des gesetzten Liedtexts in Leserichtung, je mit den SVG-Knoten
// ihrer Silben. OSMD fasst die Silben eines Worts als LyricWord zusammen
// (einsilbige Wörter haben keins); gemalt wird jede Silbe als eigenes Label.
function scoreWords() {
    const words = [];
    const byWord = new Map();
    for (const measures of osmd.GraphicSheet.MeasureList || []) {
        for (const measure of measures || []) {
            for (const entry of measure?.staffEntries || []) {
                for (const lyric of entry.LyricsEntries || []) {
                    const word = lyric.LyricsEntry?.Word;
                    const node = lyric.GraphicalLabel?.SVGNode;
                    if (word && byWord.has(word)) {
                        byWord.get(word).nodes.push(node);
                        continue;
                    }
                    const item = {
                        text: word
                            ? word.Syllables.map((s) => s.Text).join('')
                            : lyric.LyricsEntry?.Text || '',
                        nodes: [node],
                    };
                    if (word) byWord.set(word, item);
                    words.push(item);
                }
            }
        }
    }
    return words;
}

function teardown() {
    try {
        osmd?.clear();
    } catch {
        // OSMD räumt beim Schließen nicht immer sauber auf – egal, der Host
        // verschwindet mit dem Dialog.
    }
    osmd = null;
}

watch(dialog, (open) => {
    if (open) build();
    else teardown();
});
// Erst die neue Breite abwarten, dann neu setzen.
watch(zoom, () => nextTick(render));
// Kommt der Abgleich erst nach dem Rendern (Befunddatei noch geladen), die
// Markierung nachholen.
watch(befund, () => markWords());
onBeforeUnmount(teardown);
</script>

<template>
    <v-tooltip
        v-if="selectedSong?.notentext_mxml"
        text="Notenbild und MusicXML vergleichen"
        location="bottom"
    >
        <template #activator="{ props: tip }">
            <v-btn
                icon="mdi-compare-horizontal"
                v-bind="tip"
                variant="text"
                color="primary"
                @click="dialog = true"
            />
        </template>
    </v-tooltip>

    <v-dialog v-model="dialog" width="95vw" max-width="1600" scrollable>
        <v-card>
            <v-card-title class="d-flex align-center ga-2 flex-wrap">
                <span class="me-auto">
                    Notenbild ↔ MusicXML – {{ selectedSong.gesangbuch_titel }}
                </span>
                <v-btn
                    icon="mdi-magnify-minus-outline"
                    size="small"
                    variant="text"
                    title="Verkleinern"
                    @click="zoomBy(-0.25)"
                />
                <span class="text-body-2">{{ Math.round(zoom * 100) }} %</span>
                <v-btn
                    icon="mdi-magnify-plus-outline"
                    size="small"
                    variant="text"
                    title="Vergrößern"
                    @click="zoomBy(0.25)"
                />
                <v-btn icon="mdi-close" size="small" variant="text" @click="dialog = false" />
            </v-card-title>

            <div class="px-4 pb-2">
                <v-alert
                    v-if="svgVeraltet"
                    type="warning"
                    variant="tonal"
                    density="compact"
                    class="mb-2"
                >
                    Das Notenbild-SVG ist älter als die Noten-PDF und zeigt noch die alte Fassung –
                    meist, weil die MusicXML nicht zur neuen PDF passt und Script 30 das SVG deshalb
                    nicht ersetzt hat. Die aktuelle Fassung zeigt „PDF öffnen“.
                </v-alert>
                <v-alert v-if="befund?.hinweis" type="info" variant="tonal" density="compact">
                    {{ befund.hinweis }}
                </v-alert>
                <v-alert
                    v-else-if="befund && !befund.onlyPdf.length && !befund.onlyXml.length"
                    type="success"
                    variant="tonal"
                    density="compact"
                >
                    Liedtext (1. Strophe) im Notenbild und in der MusicXML gleich.
                </v-alert>
                <v-alert v-else-if="befund" type="warning" variant="tonal" density="compact">
                    <div v-if="befund.onlyPdf.length">
                        <strong>Nur im Notenbild:</strong>
                        {{ befund.onlyPdf.map((w) => `„${w}“`).join(', ') }}
                    </div>
                    <div v-if="befund.onlyXml.length">
                        <strong>Nur in MusicXML</strong> (rechts rot markiert):
                        {{ befund.onlyXml.map((w) => `„${w}“`).join(', ') }}
                    </div>
                </v-alert>
            </div>

            <v-divider />

            <v-card-text class="pa-0">
                <div class="compare-grid">
                    <div class="compare-col">
                        <div class="compare-head">
                            Notenbild (SVG aus der Noten-PDF)
                            <a v-if="pdfUrl" :href="pdfUrl" target="_blank" class="ms-2"
                                >PDF öffnen</a
                            >
                        </div>
                        <img
                            v-if="svgUrl"
                            :src="svgUrl"
                            :style="{ width: `${zoom * 100}%` }"
                            class="compare-svg"
                            alt="Notenbild"
                        />
                        <div v-else class="text-medium-emphasis pa-4">
                            Kein Notenbild-SVG vorhanden (gb-scripts/app/30).
                        </div>
                    </div>
                    <div class="compare-col">
                        <div class="compare-head">MusicXML</div>
                        <v-progress-linear v-if="loading" indeterminate color="primary" />
                        <v-alert v-if="error" type="error" variant="tonal" class="ma-4">
                            MusicXML konnte nicht geladen werden: {{ error }}
                        </v-alert>
                        <div
                            ref="osmdHost"
                            class="compare-osmd"
                            :style="{ width: `${zoom * 100}%` }"
                        />
                    </div>
                </div>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.compare-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 60vh;
}
.compare-col {
    overflow: auto;
    max-height: 75vh;
    padding: 0 12px 12px;
}
.compare-col + .compare-col {
    border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.compare-head {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 8px 0;
    font-size: 0.85rem;
    font-weight: 600;
    background: rgb(var(--v-theme-surface));
}
/* Notensatz bleibt schwarz auf weiß, auch im dunklen Theme. */
.compare-svg,
.compare-osmd {
    display: block;
    background: #fff;
}
@media (max-width: 900px) {
    .compare-grid {
        grid-template-columns: 1fr;
    }
    .compare-col + .compare-col {
        border-left: none;
    }
}
</style>
