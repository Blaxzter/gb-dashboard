// Utilities
import { defineStore } from 'pinia'
import axios from 'axios'

export const useAppStore = defineStore('app', {
  state: () => ({
    author: [],
    text: [],
    melodie: [],
    gesangbuchlied: [],
    arbeitskreis: [],
    kategorie: [],
    lizens: [],
    auftrag: [],
  }),
  getters: {
    authors: (state) => state.author,
    texts: (state) => state.text,
    melodies: (state) => state.melodie,
    gesangbuchlieder: (state) => state.gesangbuchlied,
    arbeitskreise: (state) => state.arbeitskreis,
    kategorien: (state) => state.kategorie,
    lizenzen: (state) => state.lizens,
    auftraege: (state) => state.auftrag,
  },
  actions: {
    async fetchData() {
      const [
        authorResponse,
        textResponse,
        melodieResponse,
        gesangbuchliedResponse,
        arbeitskreisResponse,
        kategorieResponse,
        lizenzResponse,
        auftragResponse,
      ] = await Promise.all([
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/autor?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/text?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/melodie?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/arbeitskreis?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/kategorie?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/lizenz?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/auftrag?limit=-1`),
      ]);

      const data = {
        author: authorResponse.data.data,
        text: textResponse.data.data,
        melodie: melodieResponse.data.data,
        gesangbuchlied: gesangbuchliedResponse.data.data,
        arbeitskreis: arbeitskreisResponse.data.data,
        kategorie: kategorieResponse.data.data,
        lizenz: lizenzResponse.data.data,
        auftrag: auftragResponse.data.data,
      }

      return data;
    },


    async loadData() {

      const dont_cache = import.meta.env.VITE_BACKEND_URL

      let data = {};
      if (dont_cache) {
        data = await this.fetchData();
      } else {
        let data = JSON.parse(localStorage.getItem('data'));

        if (!data) {
          console.log("Load API");

          // Load data from file or API request
          data = await this.fetchData(); // replace with your own function to load data
          // Set the data in localStorage to avoid requesting again
          localStorage.setItem('data', JSON.stringify(data));
        }
      }

      const { author, text, melodie, gesangbuchlied, arbeitskreis, kategorie, lizenz, auftrag } = data

      this.author = author
      this.text = text
      this.melodie = melodie
      this.gesangbuchlied = gesangbuchlied
      this.arbeitskreis = arbeitskreis
      this.kategorie = kategorie
      this.lizenz = lizenz
      this.auftrag = auftrag
    }
  },
})
