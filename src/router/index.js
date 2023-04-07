// Composables
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('@/layouts/new/Default.vue'),
    children: [
      {
        path: '*',
        name: 'Dashboard',
        component: () => import(/* webpackChunkName: "home" */ '@/views/DashboardView.vue'),
      },{
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import(/* webpackChunkName: "home" */ '@/views/DashboardView.vue'),
      },{
        path: 'hochladen',
        name: 'Neues Gesangbuchlied',
        component: () => import(/* webpackChunkName: "home" */ '@/views/UploadFormView.vue'),
      },{
        path: 'kalender',
        name: 'Kalender',
        component: () => import(/* webpackChunkName: "home" */ '@/views/KalenderView.vue'),
      },{
        path: 'gesangbuchlieder',
        name: 'Gesangbuchlieder',
        component: () => import(/* webpackChunkName: "home" */ '@/views/SongOverviewView.vue'),
      },{
        path: 'arbeitsauftraege',
        name: 'Arbeitsaufträge',
        component: () => import(/* webpackChunkName: "home" */ '@/views/WorkorderView.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
})

export default router
