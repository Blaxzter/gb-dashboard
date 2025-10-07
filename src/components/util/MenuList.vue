<template>
    <v-list :rounded="rounded ? 'lg' : 'none'" :lines="false" nav>
        <v-list-item
            v-for="(item, i) in filtered_list"
            :key="i"
            :to="item.route"
            :class="{ 'mb-3': item.marginButton }"
        >
            <template v-if="item.icon" #prepend>
                <v-icon :icon="item.icon" />
            </template>

            <v-list-item-title class="text-wrap">
                <span :class="{ 'text-subtitle-1': !item.icon }" v-html="item.name"> </span>
            </v-list-item-title>
        </v-list-item>
        <v-divider class="my-2" />
        <v-list-item link variant="flat" @click="logout">
            <template #prepend>
                <v-icon class="text-red">mdi-logout</v-icon>
            </template>

            <v-list-item-title class="text-wrap">
                <span class="text-red"> Logout </span>
            </v-list-item-title>
        </v-list-item>
    </v-list>
</template>

<script>
import { useUserStore } from '@/store/user';

export default {
    name: 'MenuList',
    props: {
        rounded: {
            type: Boolean,
            default: false,
        },
    },
    data: () => ({
        userStore: useUserStore(),
        links: [
            {
                name: 'Dashboard',
                route: '/dashboard',
                icon: 'mdi-home',
                marginButton: true,
                public: true,
            },
            {
                name: 'Kalender',
                route: '/kalender',
                icon: 'mdi-calendar-month',
                marginButton: true,
                public: true,
            },
            {
                name: 'Gesangbuch<wbr>lieder',
                route: '/gesangbuchlieder',
                icon: 'mdi-music',
                marginButton: true,
                public: true,
            },
            {
                name: 'Fokusmodus',
                route: '/fokusmodus',
                icon: 'mdi-microphone-variant',
                marginButton: true,
                public: true,
            },
            {
                name: 'Arbeitsaufträge',
                route: '/arbeitsauftraege',
                icon: 'mdi-file-document-outline',
                marginButton: true,
                public: true,
            },
            {
                name: 'Hochladen',
                route: '',
                icon: null,
                marginButton: false,
                public: true,
            },
            {
                name: 'Lied/Text/Melodie <wbr>hochladen',
                route: '/gesangbuchliedhochladen',
                icon: 'mdi-upload',
                marginButton: false,
                public: true,
            },
            {
                name: 'Änderung eintragen',
                route: '/aenderunghochladen',
                icon: 'mdi-pencil',
                marginButton: true,
                public: true,
            },
            {
                name: 'Kleiner Kreis',
                route: '',
                icon: null,
                marginButton: false,
                public: false,
            },
            {
                name: 'Doppelte Einträge',
                route: '/doppelteeintraege',
                icon: 'mdi-content-copy',
                marginButton: true,
                public: false,
            },
            {
                name: 'Verlorene Einträge',
                route: '/missing-match',
                icon: 'mdi-select-search',
                marginButton: true,
                public: false,
            },
            {
                name: 'Text Melodie Verteilung',
                route: '/text-melodie-verteilung',
                icon: 'mdi-chart-bar',
                marginButton: true,
                public: false,
            },
        ],
    }),
    computed: {
        filtered_list() {
            return this.links.filter((item) => {
                return item.public ? true : this.isKleinerKreis;
            });
        },
        isKleinerKreis() {
            return this.userStore.is_kleiner_kreis;
        },
    },
    methods: {
        logout() {
            this.userStore.logout();
        },
    },
};
</script>

<style scoped></style>
