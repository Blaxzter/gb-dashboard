// Utilities
import {defineStore} from 'pinia'
import axios from 'axios'

import _ from 'lodash'

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
    termin: [],
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
    termine: (state) => state.termin,

    arbeitskreis_by_id: (state) => {
      return (id) => _.find(state.auftrag, (o) => o.id === id)
    }
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
        terminResponse
      ] = await Promise.all([
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/autor?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/text?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/melodie?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/arbeitskreis?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/kategorie?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/lizenz?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/auftrag?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/termin?limit=-1`),
      ]);

      return {
        author: authorResponse.data.data,
        text: textResponse.data.data,
        melodie: melodieResponse.data.data,
        gesangbuchlied: gesangbuchliedResponse.data.data,
        arbeitskreis: arbeitskreisResponse.data.data,
        kategorie: kategorieResponse.data.data,
        lizenz: lizenzResponse.data.data,
        auftrag: auftragResponse.data.data,
        termin: terminResponse.data.data,
      };
    },

    async loadData() {

      const dont_cache = import.meta.env.VITE_CACHE_BACKEND

      let data = {};
      if (dont_cache !== 'ON') {
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

      let { author, text, melodie, gesangbuchlied, arbeitskreis, kategorie, lizenz, auftrag, termin } = data

      // Resolve id's to names
      const arbeitskreisById = {..._.keyBy(arbeitskreis, 'id'), null: 'Keinen'};
      const textById = {..._.keyBy(text, 'id'), null: 'Keine'};
      const melodieById = {..._.keyBy(melodie, 'id'), null: 'Keine'};
      console.log(textById)
      console.log(auftrag)
      auftrag = _.map(auftrag, obj => ({
        ...obj,
        arbeitskreis_name: arbeitskreisById[obj.arbeitskreisId].name,
        text_name: textById[obj.textId].titel,
        melodie_name: melodieById[obj.melodieId].titel,
      }));
      termin = _.map(termin, obj => ({
        ...obj,
        arbeitskreis_name: arbeitskreisById[obj.arbeitskreisId].name,
      }));

      author = _.map(author, obj => ({
        ...obj,
        author_str: `${obj.vorname} ${obj.nachname} ${obj.geburtsdatum}-${obj.sterbedatum}`,
      }));

      this.author = author
      this.text = text
      this.melodie = melodie
      this.gesangbuchlied = gesangbuchlied
      this.arbeitskreis = arbeitskreis
      this.kategorie = kategorie
      this.lizenz = lizenz
      this.auftrag = auftrag
      this.termin = termin
    }
  },
})
