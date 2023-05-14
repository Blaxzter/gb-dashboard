import axios from 'axios'
import router from "@/router";
import {useUserStore} from "@/store/user";
import _ from "lodash";


axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')

    console.log('interceptor')

    if (token && config.no_auth === undefined) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    return config
  },

  (error) => {
    return Promise.reject(error)
  }
)

axios.interceptors.response.use(
  (response) => {
    return response;
  },

  (error) => {
    // if error code is 401 and TOKEN_EXPIRED
    if (error.response.status === 401 && _.some(error.response.data.errors, {extensions: {code: 'TOKEN_EXPIRED'}})) {
      console.log('session expired')
      const userStore = useUserStore()
      userStore.session_expired = true
      userStore.logout()
      router.push('/login')
    }

    return Promise.reject(error);
  }
)

export default axios
