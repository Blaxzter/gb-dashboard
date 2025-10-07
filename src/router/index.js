// Composables
import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '@/store/user';

const routes = [
    {
        path: '/',
        component: () => import('@/layouts/new/DefaultLayout.vue'),
        meta: { requiresAuth: true },
        children: [
            {
                path: '/',
                redirect: '/dashboard',
            },
            {
                path: 'dashboard',
                name: 'Dashboard',
                component: () => import(/* webpackChunkName: "home" */ '@/views/DashboardView.vue'),
            },
            {
                path: 'gesangbuchliedhochladen',
                name: 'GesangbuchliedHochladen',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/UploadFormView.vue'),
            },
            {
                path: 'aenderunghochladen',
                name: 'AenderungHochladen',
                component: () => import(/* webpackChunkName: "home" */ '@/views/ChangeForm.vue'),
            },
            {
                path: 'kalender',
                name: 'Kalender',
                component: () => import(/* webpackChunkName: "home" */ '@/views/KalenderView.vue'),
            },
            {
                path: 'arbeitsauftraege',
                name: 'Arbeitsaufträge',
                component: () => import(/* webpackChunkName: "home" */ '@/views/WorkorderView.vue'),
            },
            {
                path: 'gesangbuchlieder/:id?',
                name: 'Gesangbuchlieder',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/SongOverviewView.vue'),
            },
            {
                path: 'fokusmodus',
                name: 'Fokusmodus',
                component: () => import(/* webpackChunkName: "home" */ '@/views/SingModeView.vue'),
            },
            {
                path: 'doppelteeintraege',
                name: 'DoubleEntries',
                component: () => import(/* webpackChunkName: "home" */ '@/views/DoubleEntries.vue'),
            },
            {
                path: 'missing-match',
                name: 'MissingMatches',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/MissingMatching.vue'),
            },
            {
                path: 'text-melodie-verteilung',
                name: 'TextMelodieVerteilung',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/TextMelodieVerteilung.vue'),
            },
            {
                path: 'korrektur-lesung',
                name: 'CorrectionReading',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/CorrectionView.vue'),
            },
        ],
    },
    {
        path: '/druckansicht',
        name: 'PrintView',
        component: () => import(/* webpackChunkName: "home" */ '@/views/PrintView.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/copyright-pruefen-druckansicht',
        name: 'CopyrightCheckPrintView',
        component: () =>
            import(/* webpackChunkName: "home" */ '@/views/CopyrightCheckPrintView.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import(/* webpackChunkName: "home" */ '@/views/LoginPage.vue'),
        meta: { requiresAuth: false },
    },
    {
        path: '/*',
        redirect: '/',
    },
    // 404 path to redirect to home
    {
        path: '/:pathMatch(.*)*',
        redirect: '/',
    },
];

const router = createRouter({
    history: createWebHistory(process.env.BASE_URL),
    routes,
});

router.beforeEach(async (to, from, next) => {
    const user_store = useUserStore();
    await user_store.autoLogin();
    if (to.matched.some((record) => record.meta.requiresAuth)) {
        if (user_store.is_logged_in) {
            next();
            return;
        }
        console.log('Not logged in');
        next('/login');
        return;
    }
    next();
});

export default router;
