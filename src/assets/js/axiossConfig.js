import axios from "axios";

axios.interceptors.request.use(
  (config) => {
    // get token from enviroment variables
    const token = import.meta.env.VITE_AUTH_TOKEN;

    if (token && config.no_auth === undefined) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  },

  (error) => {
    return Promise.reject(error);
  },
);

export default axios;
