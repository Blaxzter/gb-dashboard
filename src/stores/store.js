import { defineStore } from "pinia";
import axios from "axios";

export const useStore = defineStore("store", {
  state: () => ({
    /** @type {{ id: number, vorname: string, nachname: string, geburtsjahr: number, sterbejahr: number }[]} */
    author: [],
  }),
  getters: {
    authors(state) {
      return state.author;
    },
  },
  actions: {
    async fetchData() {
      await axios
        .get("http://159.223.250.4/items/autor?limit=-1")
        .then((response) => {
          this.author = response.data.data;
          console.log(this.author);
        })
        .catch((error) => {
          alert(error);
          console.log(error);
        });
    },
  },
});
