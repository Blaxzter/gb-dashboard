// Utilities
import { defineStore } from "pinia";
import axios from "@/assets/js/axiossConfig";

import _ from "lodash";
import { status_mapping } from "@/assets/js/utils";

export const useAppStore = defineStore("app", {
  state: () => ({
    data_loaded: false,
    author: [],
    text: [],
    melodie: [],
    gesangbuchlied: [],
    arbeitskreis: [],
    kategorie: [],
    lizens: [],
    auftrag: [],
    termin: [],
    bewertungKleinerKreis: [],
    text_autor: [],
    melodie_autor: [],
    auftrags_typ: [],
    auftrags_category: [],
    melodie_file: [],
    gesangbuchlied_kategorie: [],
    file: [],
  }),
  getters: {
    get_data_loaded: (state) => state.data_loaded,

    authors: (state) => state.author,
    texts: (state) => state.text,
    melodies: (state) => state.melodie,
    gesangbuchlieder: (state) => state.gesangbuchlied,
    arbeitskreise: (state) => state.arbeitskreis,
    kategorien: (state) => state.kategorie,
    lizenzen: (state) => state.lizens,
    auftraege: (state) => state.auftrag,
    termine: (state) => state.termin,
    bewertungKleinerKreise: (state) => state.bewertungKleinerKreis,
    text_autors: (state) => state.text_autor,
    melodie_autors: (state) => state.melodie_autor,
    auftrags_typen: (state) => state.auftrags_typ,
    auftrags_categories: (state) => state.auftrags_category,
    melodie_files: (state) => state.melodie_file,
    gesangbuchlied_kategories: (state) => state.gesangbuchlied_kategorie,
    files: (state) => state.file,

    arbeitskreis_by_id: (state) => {
      return (id) => _.find(state.auftrag, (o) => o.id === id);
    },
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
        bewertungKleinerKreisResponse,
        // N to M tables
        textautorResponse,
        melodieautorResponse,
        melodieFilesResponse,
        gesangbuchliedKategoriesResponse,
        filesResponse,
        gesangbuchliedFilesResponse,
      ] = await Promise.all([
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/autor?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/text?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/melodie?limit=-1`),
        axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied?limit=-1`,
        ),
        axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/items/arbeitskreis?limit=-1`,
        ),
        axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/items/kategorie?limit=-1`,
        ),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/lizenz?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/auftrag?limit=-1`),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/items/termin?limit=-1`),
        axios.get(
          `${
            import.meta.env.VITE_BACKEND_URL
          }/items/bewertungKleinerKreis?limit=-1`,
        ),
        // N M tabelle
        axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/items/text_autor?limit=-1`,
        ),
        axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/items/melodie_autor?limit=-1`,
        ),
        axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/items/melodie_files?limit=-1`,
        ),
        axios.get(
          `${
            import.meta.env.VITE_BACKEND_URL
          }/items/gesangbuchlied_kategorie?limit=-1`,
        ),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/files?limit=-1`),
        axios.get(
          `${
            import.meta.env.VITE_BACKEND_URL
          }/items/gesangbuchlied_files?limit=-1`,
        ),
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
        bewertungKleinerKreis: bewertungKleinerKreisResponse.data.data,
        text_autor: textautorResponse.data.data,
        melodie_autor: melodieautorResponse.data.data,
        melodie_file: melodieFilesResponse.data.data,
        gesangbuchlied_kategorie: gesangbuchliedKategoriesResponse.data.data,
        file: filesResponse.data.data,
        gesangbuchlied_files: gesangbuchliedFilesResponse.data.data,
      };
    },

    update_store_local() {
      // call update_store with local data
      this.update_store(
        this.bewertungKleinerKreis,
        this.author,
        this.text_autor,
        this.auftrag,
        this.text,
        this.melodie_autor,
        this.melodie_file,
        this.file,
        this.melodie,
        this.arbeitskreis,
        this.termin,
        this.kategorie,
        this.gesangbuchlied_kategorie,
        this.gesangbuchlied,
        this.lizenz,
      );
    },

    update_store: function (
      bewertungKleinerKreis,
      author,
      text_autor,
      auftrag,
      text,
      melodie_autor,
      melodie_file,
      file,
      melodie,
      arbeitskreis,
      termin,
      kategorie,
      gesangbuchlied_kategorie,
      gesangbuchlied,
      lizenz,
      gesangbuchlied_files,
    ) {
      const bewertungKleinerKreisById = {
        ..._.keyBy(bewertungKleinerKreis, "id"),
        null: { bezeichner: "", rangfolge: -1 },
      };

      const authorById = { ..._.keyBy(author, "id"), null: "Keine" };
      const text_autor_grouped = {
        ..._.groupBy(text_autor, "text_id"),
        null: "Keine",
      };
      const auftragByText_id = {
        ..._.pickBy(
          _.groupBy(auftrag, "textId"),
          (val, key) => !(_.isNil(key) || _.isUndefined(key)),
        ),
        null: undefined,
      };
      text = _.map(text, (obj) => ({
        ...obj,
        authors: _.map(
          text_autor_grouped[obj.id],
          (elem) => authorById[elem.autor_id],
        ),
        auftrag: auftragByText_id[obj.id],
        bewertung_kleiner_kreis:
          bewertungKleinerKreisById[obj.bewertungKleinerKreis],
      }));
      text = _.map(text, (obj) => ({
        ...obj,
        author_name: _.map(
          obj.authors,
          (elem) =>
            `${elem.vorname} ${elem.nachname}` +
            (elem.geburtsjahr || elem.sterbejahr
              ? ` (${elem.geburtsjahr ? "*" + elem.geburtsjahr : ""} ${
                  elem.sterbejahr ? " - " + elem.sterbejahr : ""
                })`
              : ""),
        ).join(", "),
        strophen_connected: _.map(obj.strophenEinzeln, "strophe")?.join("\n\n"),
        strophen_connected_short: _.map(obj.strophenEinzeln, "strophe")
          ?.join(" ")
          .substring(0, 50),
        strophe_short: _.map(
          obj.strophenEinzeln?.slice(0, 3),
          (elem, idx) =>
            `${idx + 1}. ${elem?.strophe?.replace("\n", " ").substring(0, 30)}${
              elem?.strophe?.length > 15 ? "..." : ""
            }`,
        ).join(" "),
      }));
      text = _.map(text, (obj) => ({
        ...obj,
        autocomplete: obj.titel + obj.author_name + obj.strophe_short,
      }));

      const melodie_autor_grouped = {
        ..._.groupBy(melodie_autor, "melodie_id"),
        null: undefined,
      };
      const melodie_file_grouped = {
        ..._.groupBy(melodie_file, "melodie_id"),
        null: undefined,
      };
      const file_grouped = { ..._.keyBy(file, "id"), null: undefined };
      const auftragByMelodieID = {
        ..._.pickBy(
          _.groupBy(auftrag, "melodieId"),
          (val, key) => !(_.isNil(key) || _.isUndefined(key)),
        ),
        null: undefined,
      };
      melodie = _.map(melodie, (obj) => ({
        ...obj,
        authors: _.map(
          melodie_autor_grouped[obj.id],
          (elem) => authorById[elem.autor_id],
        ),
        files_urls: _.map(melodie_file_grouped[obj.id], "directus_files_id"),
        auftrag: auftragByMelodieID[obj.id],
        bewertung_kleiner_kreis:
          bewertungKleinerKreisById[obj.bewertungKleinerKreis],
      }));
      melodie = _.map(melodie, (obj) => ({
        ...obj,
        author_name: _.map(
          obj.authors,
          (elem) =>
            `${elem.vorname} ${elem.nachname}` +
            (elem.geburtsjahr || elem.sterbejahr
              ? ` (${elem.geburtsjahr ? "*" + elem.geburtsjahr : ""} ${
                  elem.sterbejahr ? " - " + elem.sterbejahr : ""
                })`
              : ""),
        ).join(", "),
        files: _.map(obj.files_urls, (elem) => file_grouped[elem]),
      }));
      melodie = _.map(melodie, (obj) => ({
        ...obj,
        autocomplete: obj.titel + obj.author_name,
      }));

      // Resolve id's to names
      const arbeitskreisById = {
        ..._.keyBy(arbeitskreis, "id"),
        null: undefined,
      };
      const textById = { ..._.keyBy(text, "id"), null: undefined };
      const melodieById = { ..._.keyBy(melodie, "id"), null: undefined };

      auftrag = _.map(auftrag, (obj) => ({
        ...obj,
        arbeitskreis_name: arbeitskreisById[obj.arbeitskreisId].name,
        text: textById[obj.textId],
        melodie: melodieById[obj.melodieId],
      }));

      const auftrags_typ = _.filter(
        _.uniq([
          ..._.map(auftrag, (obj) => obj.auftragsartMelodie),
          ..._.map(auftrag, (obj) => obj.auftragsartText),
        ]),
        null,
      );

      const auftrags_category = _.uniq(_.map(auftrag, "arbeitskreis_name"));

      termin = _.map(termin, (obj) => ({
        ...obj,
        arbeitskreis_name: arbeitskreisById[obj.arbeitskreisId].name,
      }));

      author = _.map(author, (obj) => ({
        ...obj,
        author_str:
          `${obj.vorname} ${obj.nachname}` +
          (obj.geburtsjahr || obj.sterbejahr
            ? ` (${obj.geburtsjahr ? "*" + obj.geburtsjahr : ""} ${
                obj.sterbejahr ? " - " + obj.sterbejahr : ""
              })`
            : ""),
      }));

      const kategorieById = { ..._.keyBy(kategorie, "id"), null: "Keine" };
      gesangbuchlied_kategorie = _.filter(
        _.map(gesangbuchlied_kategorie, (obj) => ({
          ...obj,
          kategorie_name: kategorieById[obj.kategorie_id],
        })),
        (elem) => elem.gesangbuchlied_id !== null,
      );

      const gesangbuchlied_kategorieBygesangbuchlied_id = {
        ..._.groupBy(gesangbuchlied_kategorie, "gesangbuchlied_id"),
        null: "Keine",
      };
      const gesangbuchlied_files_by_gesangbuchlied_id = {
        ..._.groupBy(gesangbuchlied_files, "gesangbuchlied_id"),
        null: "Keine",
      };

      gesangbuchlied = _.map(gesangbuchlied, (obj) => ({
        ...obj,
        status_mapped: status_mapping[obj.status],
        text: textById[obj.textId],
        melodie: melodieById[obj.melodieId],
        kategories: gesangbuchlied_kategorieBygesangbuchlied_id[obj.id],
        gesangbuchlied_satz_mit_melodie_und_text: _.map(
          gesangbuchlied_files_by_gesangbuchlied_id[obj.id],
          (elem) => file_grouped[elem.directus_files_id],
        ),

        // if undefined then 0, if auftrag exist and any has status not 'done' then 1 otherwise 2
        text_work_order: textById[obj.textId]?.auftrag
          ? textById[obj.textId]?.auftrag?.some(
              (elem) => elem.status !== "done",
            )
            ? 2
            : 1
          : 0,
        melodie_work_order: melodieById[obj.melodieId]?.auftrag
          ? melodieById[obj.melodieId]?.auftrag?.some(
              (elem) => elem.status !== "done",
            )
            ? 2
            : 1
          : 0,
        autocomplete: `${obj.titel} ${textById[obj.textId]?.autocomplete} ${
          melodieById[obj.melodieId]?.autocomplete
        }`,
        strophen_connected: _.map(
          textById[obj.textId]?.strophenEinzeln,
          "strophe",
        )
          ?.join(" ")
          ?.replace("\n", " ")
          ?.toLowerCase(),
        author_name:
          (textById[obj.textId]?.author_name
            ? `Text: ${textById[obj.textId]?.author_name}`
            : "") +
          (melodieById[obj.melodieId]?.author_name
            ? `Melodie: ${melodieById[obj.melodieId]?.author_name}`
            : ""),
        // if equal to title replace with ...
        gesangbuch_titel: `${
          obj?.liednummer2000 ? "(" + obj?.liednummer2000 + ") " : ""
        }${obj?.titel}`,
        text_titel: textById[obj.textId]?.titel,
        melodie_titel: melodieById[obj.melodieId]?.titel,
        // bewertung kleiner kreis
        bewertung_kleiner_kreis:
          bewertungKleinerKreisById[obj.bewertungKleinerKreis],
      }));

      this.author = author;
      this.text = text;
      this.melodie = melodie;
      this.gesangbuchlied = gesangbuchlied;
      this.arbeitskreis = arbeitskreis;
      this.kategorie = kategorie;
      this.lizenz = lizenz;
      this.auftrag = auftrag;
      this.termin = termin;
      this.text_autor = text_autor;
      this.melodie_autor = melodie_autor;
      this.auftrags_typ = auftrags_typ;
      this.auftrags_category = auftrags_category;
      this.melodie_file = melodie_file;
      this.file = file;
      this.gesangbuchlied_kategorie = gesangbuchlied_kategorie;
    },

    async loadData() {
      if (this.data_loaded) return;

      const dont_cache = import.meta.env.VITE_CACHE_BACKEND;

      let data = {};
      if (dont_cache !== "ON") {
        data = await this.fetchData();
      } else {
        let data = JSON.parse(localStorage.getItem("data"));

        if (!data) {
          // Load data from file or API request
          data = await this.fetchData(); // replace with your own function to load data
          // Set the data in localStorage to avoid requesting again
          localStorage.setItem("data", JSON.stringify(data));
        }
      }

      let {
        author,
        text,
        melodie,
        gesangbuchlied,
        arbeitskreis,
        kategorie,
        lizenz,
        auftrag,
        termin,
        bewertungKleinerKreis,
        text_autor,
        melodie_autor,
        melodie_file,
        gesangbuchlied_kategorie,
        file,
        gesangbuchlied_files,
      } = data;

      this.update_store(
        bewertungKleinerKreis,
        author,
        text_autor,
        auftrag,
        text,
        melodie_autor,
        melodie_file,
        file,
        melodie,
        arbeitskreis,
        termin,
        kategorie,
        gesangbuchlied_kategorie,
        gesangbuchlied,
        lizenz,
        gesangbuchlied_files,
      );
      console.log("Data loaded");
      this.data_loaded = true;
    },

    updateGesangbuchlied(gesangbuchlied) {
      // update gesangbuchlied with same id
      this.gesangbuchlied = this.gesangbuchlied.map((obj) => {
        if (obj.id === gesangbuchlied.id) {
          return gesangbuchlied;
        }
        return obj;
      });
    },

    // Add data to store
    addGesangbuchlied(gesangbuchlied) {
      this.gesangbuchlied.push(gesangbuchlied);
    },
    addMelodie(melodie) {
      this.melodie.push(melodie);
    },
    addText(text) {
      this.text.push(text);
    },
    addAuthor(author) {
      this.author.push(author);
    },
    addFile(file) {
      this.file.push(file);
    },
    addMelodieFile(melodie_file) {
      this.melodie_file.push(melodie_file);
    },
    addMelodieAutor(melodie_autor) {
      this.melodie_autor.push(melodie_autor);
    },
    addTextAutor(text_autor) {
      this.text_autor.push(text_autor);
    },
    addKategorieGesangbuchlied(gesangbuchlied_kategorie) {
      this.gesangbuchlied_kategorie.push(gesangbuchlied_kategorie);
    },

    // Individuall getters
    getAllFiles() {
      axios
        .get(`${import.meta.env.VITE_BACKEND_URL}/files?limit=-1`)
        .then((response) => {
          this.file = response.data.data;
        });
    },
  },
});
