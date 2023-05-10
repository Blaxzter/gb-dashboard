import axios from 'axios'

axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')

    if (token && config.no_auth === undefined) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    return config
  },

  (error) => {
    return Promise.reject(error)
  }
)

export default axios
