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
    text_autor: [],
    melodie_autor: [],
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
    text_autors: (state) => state.text_autor,
    melodie_autors: (state) => state.melodie_autor,

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
        terminResponse,
        textautorResponse,
        melodieautorResponse,
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
        // N M tabelle
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/text_autor?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/melodie_autor?limit=-1`),
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
        text_autor: textautorResponse.data.data,
        melodie_autor: melodieautorResponse.data.data,
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

      let { author, text, melodie, gesangbuchlied, arbeitskreis, kategorie, lizenz, auftrag, termin, text_autor, melodie_autor } = data

      // Resolve id's to names
      const arbeitskreisById = {..._.keyBy(arbeitskreis, 'id'), null: 'Keinen'};
      const textById = {..._.keyBy(text, 'id'), null: 'Keine'};
      const melodieById = {..._.keyBy(melodie, 'id'), null: 'Keine'};
      const authorById = {..._.keyBy(author, 'id'), null: 'Keine'};
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
        author_str: `${obj.vorname} ${obj.nachname} ${obj.geburtsjahr ? obj.geburtsjahr : '?'}-${obj.sterbejahr ? obj.sterbejahr : '?'}`,
      }));

      const text_autor_grouped = {..._.groupBy(text_autor, 'text_id'), null: 'Keine'};
      text  = _.map(text, obj => ({
        ...obj,
        authors: _.map(text_autor_grouped[obj.id], (elem) => authorById[elem.autor_id]),
      }));
      text  = _.map(text, obj => ({
        ...obj,
        author_name: _.map(obj.authors, elem => `${elem.vorname} ${elem.nachname}` + (elem.geburtsjahr || elem.sterbejahr ? ` (${elem.geburtsjahr ? elem.geburtsjahr : ''} - ${elem.sterbejahr ? elem.sterbejahr : '?' })` : '')).join(", "),
        strophe_short: _.map(obj.strophen?.split('\n\n').slice(0, 3), (elem, idx) => `${idx + 1}. ${elem.substring(0, 30)}${elem.length > 15 ? '...' : ''}`).join(" "),
      }));
      text  = _.map(text, obj => ({
        ...obj,
        autocomplete: obj.titel + obj.author_name + obj.strophe_short
      }));

      const melodie_autor_grouped = {..._.groupBy(melodie_autor, 'melodie_id'), null: 'Keine'};
      melodie  = _.map(melodie, obj => ({
        ...obj,
        authors: _.map(melodie_autor_grouped[obj.id], (elem) => authorById[elem.autor_id]),
      }));
      melodie  = _.map(melodie, obj => ({
        ...obj,
        author_name: _.map(obj.authors, elem => `${elem.vorname} ${elem.nachname}` + (elem.geburtsjahr || elem.sterbejahr ? ` (${elem.geburtsjahr ? elem.geburtsjahr : ''} - ${elem.sterbejahr ? elem.sterbejahr : '?' })` : '')).join(", "),
      }));
      melodie  = _.map(melodie, obj => ({
        ...obj,
        autocomplete: obj.titel + obj.author_name
      }));

      gesangbuchlied = _.map(gesangbuchlied, obj => ({
        ...obj,
        text: textById[obj.textId],
        melodie: melodieById[obj.melodieId],
      }));

      console.log(kategorie)

      this.author = author
      this.text = text
      this.melodie = melodie
      this.gesangbuchlied = gesangbuchlied
      this.arbeitskreis = arbeitskreis
      this.kategorie = kategorie
      this.lizenz = lizenz
      this.auftrag = auftrag
      this.termin = termin
      this.text_autor = text_autor
      this.melodie_autor = melodie_autor
    }
  },
})
