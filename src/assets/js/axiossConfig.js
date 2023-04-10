import axios from "axios";

const instance = axios.create();


instance.defaults.headers.common["Authorization"] = `Bearer ${import.meta.env.VITE_AUTH_TOKEN}`;

export default instance;
