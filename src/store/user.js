// Utilities
import { defineStore } from 'pinia'

import axios from "@/assets/js/axiossConfig"
import router from '@/router'
import {useAppStore} from "@/store/app";

const useUserStore = defineStore('user', {
	state: () => ({
		user: null,
    kleiner_kreis: false,
    kleiner_kreis_ansicht: false,
    session_expired: false,
	}),
	getters: {
		get_user: (state) => state.user,
		is_logged_in: (state) => state.user !== null,
    is_kleiner_kreis: (state) => state.kleiner_kreis,
    is_kleiner_kreis_ansicht: (state) => state.kleiner_kreis_ansicht,
	},
	actions: {
    toggle_kleiner_kreis_ansicht() {
      this.kleiner_kreis_ansicht = !this.kleiner_kreis_ansicht
      localStorage.setItem('kleiner_kreis_ansicht', this.kleiner_kreis_ansicht ? "true" : "false")
    },

		login(authData, remember_me) {
      const appstore = useAppStore()

      // check if authData.username is AK-Gesangbuch or Kleiner-AK and set username accordingly
      let username = authData.username
      if (authData.username === 'AK-Gesangbuch') {
        username = 'info@johannische-kirche.org'
      } else if (authData.username === 'Kleiner-AK') {
        username = 'gesangbuch2026@ml.johannische-kirche.org'
      }

			return axios({
				method: 'post',
				url: `${import.meta.env.VITE_BACKEND_URL}/auth/login`,
				data: {
          email: username,
          password: authData.password
        },
			})
				.then((response) => {
          if (username === 'gesangbuch2026@ml.johannische-kirche.org' || username === 'mail@fabraham.dev') {
            this.kleiner_kreis = true
            localStorage.setItem('kleiner_kreis', "true")
            this.kleiner_kreis_ansicht = localStorage.getItem('kleiner_kreis_ansicht') === 'true'
          }

          this.set_user_data(authData, response.data.data, remember_me)
          this.session_expired = false
          appstore.loadData()
				})
				.catch((error) => {
					throw error
				})
		},
		logout() {
			this.user = null
			localStorage.removeItem('username')
			localStorage.removeItem('access_token')
			localStorage.removeItem('refresh_token')
      localStorage.removeItem('kleiner_kreis')

			router.replace('/login')
		},
    async autoLogin() {
      const appstore = useAppStore()
      let token = localStorage.getItem('access_token')
      let username = localStorage.getItem('username')
      let refresh_token = localStorage.getItem('refresh_token')

      if (!token || !username || token === 'null' || token == null) {
        return
      }

      this.kleiner_kreis_ansicht = localStorage.getItem('kleiner_kreis_ansicht') === 'true'
      this.kleiner_kreis = localStorage.getItem('kleiner_kreis') === 'true'

      //  check if token is expired
      await this.refreshToken()

      this.user = {
        username: username,
        token: token,
        refresh_token: refresh_token,
      }
      appstore.loadData()
    },
    async refreshToken() {
      let refresh_token = localStorage.getItem('refresh_token')
      if (refresh_token && refresh_token !== 'null' && refresh_token !== null) {
        console.log('refreshing token')
        await axios.post(`${import.meta.env.VITE_BACKEND_URL}/auth/refresh`, {refresh_token: refresh_token}, {no_auth: true})
          .then(response => {
            localStorage.setItem('access_token', response.data.data.access_token)
            localStorage.setItem('refresh_token', response.data.data.refresh_token)
          })
      }
    },
		set_user_data(authData, response_data, remember_me) {
			this.user = {
				username: authData.username,
        access_token: response_data.access_token,
				refresh_token: response_data.refresh_token,
			}

      if (remember_me) {
        localStorage.setItem('refresh_token', response_data.refresh_token)
      }
      localStorage.setItem('username', authData.username)
      localStorage.setItem('access_token', response_data.access_token)
		}
	}
})

export { useUserStore }
