// Utilities
import {defineStore} from 'pinia'
import axios from 'axios'

import _ from 'lodash'
import {status_mapping} from "@/assets/js/utils";

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
    auftrags_typ: [],
    auftrags_category: [],
    melodie_file: [],
    file: [],
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
    auftrags_typen: (state) => state.auftrags_typ,
    auftrags_categories: (state) => state.auftrags_category,
    melodie_files: (state) => state.melodie_file,
    files: (state) => state.file,

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
        melodieFilesResponse,
        filesResponse,
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
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/melodie_files?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/files?limit=-1`),
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
        melodie_file: melodieFilesResponse.data.data,
        file: filesResponse.data.data,
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

      let { author, text, melodie, gesangbuchlied, arbeitskreis, kategorie, lizenz, auftrag, termin, text_autor, melodie_autor, melodie_file, file} = data

      const authorById = {..._.keyBy(author, 'id'), null: 'Keine'};
      const text_autor_grouped = {..._.groupBy(text_autor, 'text_id'), null: 'Keine'};
      text  = _.map(text, obj => ({
        ...obj,
        authors: _.map(text_autor_grouped[obj.id], (elem) => authorById[elem.autor_id]),
      }));
      text  = _.map(text, obj => ({
        ...obj,
        author_name: _.map(obj.authors, elem => `${elem.vorname} ${elem.nachname}` + (elem.geburtsjahr || elem.sterbejahr ? ` (${elem.geburtsjahr ? elem.geburtsjahr : ''} - ${elem.sterbejahr ? elem.sterbejahr : '?' })` : '')).join(", "),
        strophen_connected: _.map(obj.strophenEinzeln, 'strophe')?.join('\n\n'),
        strophen_connected_short: _.map(obj.strophenEinzeln, 'strophe')?.join(' ').substring(0, 50),
        strophe_short: _.map(obj.strophenEinzeln?.slice(0, 3), (elem, idx) => `${idx + 1}. ${elem.strophe.substring(0, 30)}${elem.length > 15 ? '...' : ''}`).join(" "),
      }));
      text  = _.map(text, obj => ({
        ...obj,
        autocomplete: obj.titel + obj.author_name + obj.strophe_short
      }));

      const melodie_autor_grouped = {..._.groupBy(melodie_autor, 'melodie_id'), null: undefined};
      const melodie_file_grouped = {..._.groupBy(melodie_file, 'melodie_id'), null: undefined};
      const file_grouped = {..._.keyBy(file, 'id'), null: undefined};
      console.log(file_grouped)
      console.log(melodie_file_grouped)
      melodie  = _.map(melodie, obj => ({
        ...obj,
        authors: _.map(melodie_autor_grouped[obj.id], (elem) => authorById[elem.autor_id]),
        files_urls: _.map(melodie_file_grouped[obj.id], 'directus_files_id'),
      }));
      melodie  = _.map(melodie, obj => ({
        ...obj,
        author_name: _.map(obj.authors, elem => `${elem.vorname} ${elem.nachname}` + (elem.geburtsjahr || elem.sterbejahr ? ` (${elem.geburtsjahr ? elem.geburtsjahr : ''} - ${elem.sterbejahr ? elem.sterbejahr : '?' })` : '')).join(", "),
        files: _.map(obj.files_urls, elem => file_grouped[elem]),
      }));
      console.log(melodie)
      melodie  = _.map(melodie, obj => ({
        ...obj,
        autocomplete: obj.titel + obj.author_name
      }));

      // Resolve id's to names
      const arbeitskreisById = {..._.keyBy(arbeitskreis, 'id'), null: undefined};
      const textById = {..._.keyBy(text, 'id'), null: undefined};
      const melodieById = {..._.keyBy(melodie, 'id'), null: undefined};

      auftrag = _.map(auftrag, obj => ({
        ...obj,
        arbeitskreis_name: arbeitskreisById[obj.arbeitskreisId].name,
        text: textById[obj.textId],
        melodie: melodieById[obj.melodieId],
      }));

      const auftrags_typ = _.filter(_.uniq([
        ..._.map(auftrag, obj => obj.auftragsartMelodie),
        ..._.map(auftrag, obj => obj.auftragsartText)
      ]), null);

      const auftrags_category = _.uniq(_.map(auftrag, 'arbeitskreis_name'));

      termin = _.map(termin, obj => ({
        ...obj,
        arbeitskreis_name: arbeitskreisById[obj.arbeitskreisId].name,
      }));

      author = _.map(author, obj => ({
        ...obj,
        author_str: `${obj.vorname} ${obj.nachname} ${obj.geburtsjahr ? obj.geburtsjahr : '?'}-${obj.sterbejahr ? obj.sterbejahr : '?'}`,
      }));


      gesangbuchlied = _.map(gesangbuchlied, obj => ({
        ...obj,
        status_mapped: status_mapping[obj.status],
        text: textById[obj.textId],
        melodie: melodieById[obj.melodieId],
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
      this.text_autor = text_autor
      this.melodie_autor = melodie_autor
      this.auftrags_typ = auftrags_typ
      this.auftrags_category = auftrags_category
      this.melodie_file = melodie_file
      this.file = file
    }
  },
})
