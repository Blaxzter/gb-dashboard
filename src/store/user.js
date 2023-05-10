// Utilities
import { defineStore } from 'pinia'

import axios from "@/assets/js/axiossConfig"
import router from '@/router'
import {useAppStore} from "@/store/app";

const useUserStore = defineStore('user', {
	state: () => ({
		user: null,
	}),
	getters: {
		get_user: (state) => state.user,
		is_logged_in: (state) => state.user !== null,
	},
	actions: {
		login(authData) {
      const appstore = useAppStore()
			return axios({
				method: 'post',
				url: `${import.meta.env.VITE_BACKEND_URL}/auth/login`,
				data: {
          email: authData.username,
          password: authData.password
        },
			})
				.then((response) => {
					this.set_user_data(authData, response.data.data)
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

			localStorage.setItem('username', null)
			localStorage.setItem('access_token', null)
			localStorage.setItem('refresh_token', null)

			router.replace('/login')
		},
    autoLogin() {
      const appstore = useAppStore()
      let token = localStorage.getItem('access_token')
      let username = localStorage.getItem('username')
      let refresh_token = localStorage.getItem('refresh_token')

      if (!token || !username || token === 'null' || token == null) {
        return
      }

      //  check if token is expired
      axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/autor?limit=-1`)
        .catch(() => {
          localStorage.removeItem('access_token')
          axios.post(`${import.meta.env.VITE_BACKEND_URL}/auth/refresh`, {refresh_token: refresh_token})
            .then(response => {
              localStorage.setItem('access_token', response.data.data.access_token)
          })
         })

      this.user = {
        username: username,
        token: token,
        refresh_token: refresh_token,
      }
      appstore.loadData()
    },
		set_user_data(authData, response_data) {
			this.user = {
				username: authData.username,
        access_token: response_data.access_token,
				refresh_token: response_data.refresh_token,
			}

			localStorage.setItem('username', authData.username)
			localStorage.setItem('access_token', response_data.access_token)
			localStorage.setItem('refresh_token', response_data.refresh_token)
		}
	}
})

export { useUserStore }
