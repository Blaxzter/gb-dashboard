<script>
import VuePdfEmbed from 'vue-pdf-embed';
import VuePdfApp from 'vue3-pdf-app';
// import this to use default icons for buttons
import 'vue3-pdf-app/dist/icons/main.css';

export default {
    name: 'MediaComponent',
    components: { VuePdfEmbed, VuePdfApp },
    props: {
        file: {
            type: Object,
            required: true,
        },
        screenMode: {
            type: String,
            default: null,
        },
        maxHeight: {
            type: Number,
            default: null,
        },
    },
    emits: ['fullscreen_pdf'],
    data: () => ({
        maxWidth: 100,
        config: {
            secondaryToolbar: {
                cursorSelectTool: false,
                secondaryPresentationMode: false,
            },
            toolbar: {
                toolbarViewerRight: {
                    openFile: false,
                },
            },
        },
    }),
    watch: {
        file() {
            console.log('file changed');
        },
    },
    methods: {
        changeToHandTool(pdfApp) {
            pdfApp.pdfCursorTools.switchTool(1);
        },
        is_audio(file) {
            // include audio and add opus
            return file.type.includes('audio') || file.type.includes('application/octet-stream');
        },
        is_opus(file) {
            return file.type.includes('application/octet-stream');
        },
        is_video(file) {
            return file.type.includes('video');
        },
        is_image(file) {
            return file.type.includes('image');
        },
        getPdfUrl(file_id) {
            return `${import.meta.env.VITE_BACKEND_URL}/assets/${file_id}.pdf`;
        },
        getImgUrl(file_id) {
            return `${import.meta.env.VITE_BACKEND_URL}/assets/${file_id}`;
        },
        fullscreen_pdf(event, file) {
            this.$emit('fullscreen_pdf', event, file);
        },
    },
};
</script>

<template>
    <div
        v-if="screenMode === 'sing-mode' && file?.type !== 'application/pdf'"
        style="position: absolute; z-index: 20"
        class="pl-5 pt-2 position-relative"
    >
        <v-btn
            icon="mdi-magnify-minus-outline"
            variant="text"
            :disabled="maxWidth === 20"
            color="primary"
            @click="maxWidth = maxWidth - 5 < 20 ? maxWidth : maxWidth - 5"
        />
        <v-btn
            icon="mdi-magnify-plus-outline"
            variant="text"
            :disabled="maxWidth === 100"
            color="primary"
            @click="maxWidth = maxWidth + 5 > 100 ? maxWidth : maxWidth + 5"
        />
    </div>
    <div v-if="file?.type === 'application/pdf'" class="h-100">
        <div v-if="screenMode === 'sing-mode'" class="h-100">
            <vue-pdf-app
                ref="pdfApp"
                :config="config"
                :pdf="getPdfUrl(file.id)"
                theme="light"
                @pages-rendered="changeToHandTool"
            ></vue-pdf-app>
        </div>
        <div
            v-else
            class="d-flex align-center justify-center fill-height"
            :class="{ 'bg-grey': screenMode !== 'sing-mode' && screenMode !== 'print' }"
        >
            <vue-pdf-embed
                :height="screenMode === 'print' && maxHeight ? maxHeight : 300"
                :source="getPdfUrl(file.id)"
                :page="1"
                :style="screenMode === 'print' ? '' : 'cursor: pointer'"
                @click="screenMode !== 'print' ? fullscreen_pdf($event, file) : null"
            />
        </div>
    </div>
    <div v-else-if="is_audio(file)" class="d-flex flex-column align-center justify-center h-100">
        <div>
            <div class="text-h6 mb-3">
                {{ file.title }}
            </div>
            <div class="d-flex align-center justify-center">
                <v-icon class="me-4" size="40">mdi-music-note-eighth</v-icon>
                <audio controls>
                    <source
                        v-if="is_opus(file)"
                        :src="getImgUrl(file.id)"
                        type="audio/ogg; codecs=opus"
                    />
                    <source v-else :src="getImgUrl(file.id)" :type="file.type" />
                </audio>
            </div>
        </div>
    </div>
    <div v-else-if="is_video(file)" class="d-flex flex-column align-center justify-center h-100">
        <div>
            <div class="text-h6 mb-3">
                {{ file.title }}
            </div>
            <div class="d-flex align-center justify-center">
                <div :style="{ maxWidth: `${maxWidth}%` }">
                    <video controls>
                        <source :src="getImgUrl(file.id)" :type="file.type" />
                    </video>
                </div>
            </div>
        </div>
    </div>
    <div
        v-else-if="is_image(file) && (screenMode === 'sing-mode' || screenMode === 'print')"
        class="d-flex flex-column align-center h-100"
        :class="{ 'pt-5': screenMode === 'sing-mode' }"
    >
        <div :class="{ 'pa-10': screenMode === 'sing-mode' }">
            <div v-if="screenMode === 'sing-mode'" class="text-h6 mb-3">
                {{ file.title }}
            </div>
            <div class="d-flex align-center justify-center">
                <div
                    :style="{
                        maxWidth: `${maxWidth}%`,
                        maxHeight: screenMode === 'print' && maxHeight ? `${maxHeight}px` : 'none'
                    }"
                >
                    <img
                        :src="getImgUrl(file.id)"
                        alt="Bild"
                        :style="{
                            maxHeight: screenMode === 'print' && maxHeight ? `${maxHeight}px` : '100%',
                            maxWidth: '100%',
                            objectFit: 'contain'
                        }"
                    />
                </div>
            </div>
        </div>
    </div>
    <div v-else>
        <div class="d-flex flex-column align-center justify-center h-100">
            <v-icon size="40">mdi-file</v-icon>
            <div class="text-h6">
                {{ file.title }}
            </div>
            <div class="text-subtitle-2">
                Dieses Dateiformat wird aktuell noch nicht unterstützt.
            </div>
            <div class="text-subtitle-2">
                {{ file.type }}
                {{ is_image(file) }}
            </div>
        </div>
    </div>
</template>

<style scoped></style>
