// Utilities
import { defineStore } from "pinia";

import axios from "@/assets/js/axiossConfig";
import router from "@/router";
import { useAppStore } from "@/store/app";
import moment from "moment";

const useUserStore = defineStore("user", {
  state: () => ({
    user: null,
    kleiner_kreis: false,
    kleiner_kreis_ansicht: false,
  }),
  getters: {
    get_user: (state) => state.user,
    is_logged_in: (state) => state.user !== null,
    is_kleiner_kreis: (state) => state.kleiner_kreis,
    is_kleiner_kreis_ansicht: (state) => state.kleiner_kreis_ansicht,
  },
  actions: {
    toggle_kleiner_kreis_ansicht() {
      this.kleiner_kreis_ansicht = !this.kleiner_kreis_ansicht;
      localStorage.setItem(
        "kleiner_kreis_ansicht",
        this.kleiner_kreis_ansicht ? "true" : "false",
      );
    },

    login(authData, remember_me) {
      const appstore = useAppStore();

      // check if authData.username is AK-Gesangbuch or Kleiner-AK and set username accordingly
      let username = authData.username;
      if (authData.username === "AK-Gesangbuch") {
        username = "info@johannische-kirche.org";
      } else if (authData.username === "Kleiner-AK") {
        username = "gesangbuch2026@ml.johannische-kirche.org";
      }

      return axios({
        method: "post",
        url: `${import.meta.env.VITE_BACKEND_URL}/auth/login`,
        data: {
          email: username,
          password: authData.password,
        },
      })
        .then((response) => {
          if (
            username === "gesangbuch2026@ml.johannische-kirche.org" ||
            username === "mail@fabraham.dev"
          ) {
            this.kleiner_kreis = true;
            localStorage.setItem("kleiner_kreis", "true");
            this.kleiner_kreis_ansicht =
              localStorage.getItem("kleiner_kreis_ansicht") === "true";
          }

          this.set_user_data(authData, response.data.data, remember_me);
          appstore.loadData();
        })
        .catch((error) => {
          throw error;
        });
    },
    logout() {
      this.user = null;
      localStorage.removeItem("username");
      localStorage.removeItem("kleiner_kreis");

      router.replace("/login");
    },
    async autoLogin() {
      const appstore = useAppStore();
      let username = localStorage.getItem("username");

      if (!username) {
        return;
      }

      this.kleiner_kreis_ansicht =
        localStorage.getItem("kleiner_kreis_ansicht") === "true";
      this.kleiner_kreis = localStorage.getItem("kleiner_kreis") === "true";

      this.user = {
        username: username,
      };
      console.log("Auto login successful");
      appstore.loadData();
    },
    set_user_data(authData, response_data, remember_me) {
      this.user = {
        username: authData.username,
      };

      if (remember_me) {
        localStorage.setItem("username", authData.username);
      }
    },
  },
});

export { useUserStore };
