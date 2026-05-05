<template>
    <v-container class="pa-4" fluid>
        <GesangbuchLiedComponent
            v-if="selectedSong"
            :selected-song="selectedSong"
            @close="goBack"
            @switch-song="switchSong"
        />
        <div v-else-if="!store.get_data_loaded" class="d-flex justify-center pa-12">
            <v-progress-circular indeterminate />
        </div>
        <v-alert v-else type="error" class="mt-4">
            Lied mit ID {{ $route.params.id }} nicht gefunden.
        </v-alert>
    </v-container>
</template>

<script>
import _ from 'lodash';
import { useAppStore } from '@/store/app';
import GesangbuchLiedComponent from '@/components/SongRelated/GesangbuchLiedComponent.vue';

export default {
    name: 'SongDetailView',
    components: { GesangbuchLiedComponent },
    data: () => ({
        store: useAppStore(),
    }),
    computed: {
        selectedSong() {
            const id = parseInt(this.$route.params.id);
            if (!id) return null;
            return _.find(this.store.gesangbuchlieder, { id });
        },
    },
    watch: {
        selectedSong: {
            immediate: true,
            handler(song) {
                if (song?.gesangbuch_titel) {
                    document.title = song.gesangbuch_titel;
                }
            },
        },
    },
    methods: {
        goBack() {
            if (window.history.length > 1) {
                this.$router.back();
            } else {
                this.$router.push('/gesangbuchlieder');
            }
        },
        switchSong(song) {
            this.$router.replace(`/lied/${song.id}`);
        },
    },
};
</script>
