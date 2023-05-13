// Composables
import { createRouter, createWebHistory } from 'vue-router'
import {useUserStore} from "@/store/user";

const routes = [
  {
    path: '/',
    component: () => import('@/layouts/new/Default.vue'),
    children: [
      {
        path: '/',
        redirect: '/dashboard',
        meta: { requiresAuth: true }
      },{
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import(/* webpackChunkName: "home" */ '@/views/DashboardView.vue'),
        meta: { requiresAuth: true }
      },{
        path: 'gesangbuchliedhochladen',
        name: 'GesangbuchliedHochladen',
        component: () => import(/* webpackChunkName: "home" */ '@/views/UploadFormView.vue'),
        meta: { requiresAuth: true }
      },{
        path: 'aenderunghochladen',
        name: 'AenderungHochladen',
        component: () => import(/* webpackChunkName: "home" */ '@/views/ChangeForm.vue'),
        meta: { requiresAuth: true }
      },{
        path: 'kalender',
        name: 'Kalender',
        component: () => import(/* webpackChunkName: "home" */ '@/views/KalenderView.vue'),
        meta: { requiresAuth: true }
      },{
        path: 'gesangbuchlieder',
        name: 'Gesangbuchlieder',
        component: () => import(/* webpackChunkName: "home" */ '@/views/SongOverviewView.vue'),
        meta: { requiresAuth: true }
      },{
        path: 'arbeitsauftraege',
        name: 'Arbeitsaufträge',
        component: () => import(/* webpackChunkName: "home" */ '@/views/WorkorderView.vue'),
        meta: { requiresAuth: true }
      },

    ],
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import(/* webpackChunkName: "home" */ '@/views/LoginPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/*',
    redirect: '/'
  },
  // 404 path to redirect to home
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
})

router.beforeEach((to, from, next) => {
  const user_store = useUserStore()
  if (to.matched.some((record) => record.meta.requiresAuth)) {
    if (user_store.is_logged_in) {
      next()
      return
    }
    console.log("Not logged in")
    next('/login')
    return
  }
  next()
})

export default router
