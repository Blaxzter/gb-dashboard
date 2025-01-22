import axios from "axios";

axios.interceptors.request.use(
  (config) => {

    let token = localStorage.getItem("access_token");

    // get token from enviroment variables
    if (
      import.meta.env.VITE_AUTH_TOKEN !== "CHANGE_THIS_AFTER_DIRECTUS_STARTED"
    ) {
      token = import.meta.env.VITE_AUTH_TOKEN;
    }

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
