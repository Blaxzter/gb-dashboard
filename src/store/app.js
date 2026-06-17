// Utilities
import { defineStore } from 'pinia';
import axios from '@/assets/js/axiossConfig';

import _ from 'lodash';
import { status_mapping } from '@/assets/js/utils';
import { formatAuthors } from '@/assets/js/authorFormat';
import router from '@/router';
import { useUserStore } from '@/store/user';

export const useAppStore = defineStore('app', {
    state: () => ({
        data_loaded: false,
        used_author: [],
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
        export_log: [],
        // Globale, in Directus persistierte Einstellungen (Singleton-Collection
        // „settings"). Aktuell: autoren_check = Liste der im Autoren-Datencheck als
        // erledigt markierten Autor-IDs (Issue #32). Wird nutzerübergreifend geteilt,
        // damit der Kleine Kreis die Liste gemeinsam abarbeiten kann.
        settings: {},
        currentRequests: [],
    }),
    getters: {
        get_data_loaded: (state) => state.data_loaded,
        used_authors: (state) => state.used_author,
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
        export_logs: (state) => state.export_log,
        settingsData: (state) => state.settings,

        arbeitskreis_by_id: (state) => {
            return (id) => _.find(state.auftrag, (o) => o.id === id);
        },
    },
    actions: {
        async fetchData() {
            // Cancel any existing requests
            this.cancelRequests();

            const requests = [
                { url: '/items/autor', label: 'author' },
                { url: '/items/text', label: 'text' },
                { url: '/items/melodie', label: 'melodie' },
                { url: '/items/gesangbuchlied', label: 'gesangbuchlied' },
                { url: '/items/arbeitskreis', label: 'arbeitskreis' },
                { url: '/items/kategorie', label: 'kategorie' },
                { url: '/items/lizenz', label: 'lizenz' },
                { url: '/items/auftrag', label: 'auftrag' },
                { url: '/items/termin', label: 'termin' },
                { url: '/items/bewertungKleinerKreis', label: 'bewertungKleinerKreis' },
                { url: '/items/text_autor', label: 'textautor' },
                { url: '/items/melodie_autor', label: 'melodieautor' },
                { url: '/items/melodie_files', label: 'melodieFiles' },
                {
                    url: '/items/gesangbuchlied_kategorie',
                    label: 'gesangbuchliedKategories',
                },
                { url: '/files', label: 'files' },
                { url: '/items/gesangbuchlied_files', label: 'gesangbuchliedFiles' },
            ];

            try {
                const responses = await Promise.all(
                    requests.map(({ url, label }) => {
                        const controller = new AbortController();
                        const request = axios.get(
                            `${import.meta.env.VITE_BACKEND_URL}${url}?limit=-1`,
                            { signal: controller.signal },
                        );

                        // Store the controller so we can cancel if needed
                        this.currentRequests.push(controller);

                        return request;
                    }),
                );

                // Clear the controllers array after successful completion
                this.currentRequests = [];

                return {
                    author: responses[0].data.data,
                    text: responses[1].data.data,
                    melodie: responses[2].data.data,
                    gesangbuchlied: responses[3].data.data,
                    arbeitskreis: responses[4].data.data,
                    kategorie: responses[5].data.data,
                    lizenz: responses[6].data.data,
                    auftrag: responses[7].data.data,
                    termin: responses[8].data.data,
                    bewertungKleinerKreis: responses[9].data.data,
                    text_autor: responses[10].data.data,
                    melodie_autor: responses[11].data.data,
                    melodie_file: responses[12].data.data,
                    gesangbuchlied_kategorie: responses[13].data.data,
                    file: responses[14].data.data,
                    gesangbuchlied_files: responses[15].data.data,
                };
            } catch (error) {
                if (error?.response?.status === 401) {
                    const userStore = useUserStore();
                    userStore.logout();
                }
                throw error;
            }
        },

        cancelRequests() {
            this.currentRequests.forEach((controller) => {
                controller.abort();
            });
            this.currentRequests = [];
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
                ..._.keyBy(bewertungKleinerKreis, 'id'),
                null: { bezeichner: '', rangfolge: -1 },
            };

            // Helper function to format individual author's years
            const formatYears = (author) => {
                const { geburtsjahr, sterbejahr } = author;
                if (!geburtsjahr && !sterbejahr) return '';

                const birthYear = geburtsjahr ? `*${geburtsjahr}` : '';
                const deathYear = sterbejahr ? ` - ${sterbejahr}` : '';
                return ` (${birthYear}${deathYear})`;
            };

            // Helper function to format author's full name and years
            const formatAuthor = (author) => {
                const fullName = `${author.vorname} ${author.nachname}`;
                const years = formatYears(author);
                return {
                    ...author,
                    name: `${fullName}${years}`,
                    author_str:
                        `${author.vorname} ${author.nachname}` +
                        (author.geburtsjahr || author.sterbejahr
                            ? ` (${author.geburtsjahr ? '*' + author.geburtsjahr : ''} ${
                                  author.sterbejahr ? ' - ' + author.sterbejahr : ''
                              })`
                            : ''),
                };
            };
            const format_author = _.map(author, formatAuthor);

            const authorById = { ..._.keyBy(format_author, 'id'), null: 'Keine' };

            // We need to add authors to the ursprungsAutor of the text_autor and melodie_autor tables
            text_autor = _.map(text_autor, (obj) => ({
                ...obj,
                ursprungsAutorObj: authorById[obj.ursprungsAutor],
            }));

            melodie_autor = _.map(melodie_autor, (obj) => ({
                ...obj,
                ursprungsAutorObj: authorById[obj.ursprungsAutor],
            }));

            // debugger;
            const text_autor_grouped = {
                ..._.groupBy(text_autor, 'text_id'),
                null: 'Keine',
            };
            const auftragByText_id = {
                ..._.pickBy(
                    _.groupBy(auftrag, 'textId'),
                    (val, key) => !(_.isNil(key) || _.isUndefined(key)),
                ),
                null: undefined,
            };

            text = _.map(text, (obj) => ({
                ...obj,
                authors: _.map(text_autor_grouped[obj.id], (elem) => {
                    return {
                        ...authorById[elem.autor_id],
                        ...elem,
                    };
                }),
                auftrag: auftragByText_id[obj.id],
                bewertung_kleiner_kreis: bewertungKleinerKreisById[obj.bewertungKleinerKreis],
            }));
            text = _.map(text, (obj) => ({
                ...obj,
                author_name: formatAuthors(obj.authors),
                strophen_connected: _.map(obj.strophenEinzeln, (elem) =>
                    elem?.strophe?.replaceAll('¬', ''),
                )?.join('\n\n'),
                strophen_connected_short: _.map(obj.strophenEinzeln, (elem) =>
                    elem?.strophe?.replaceAll('¬', ''),
                )
                    ?.join(' ')
                    .substring(0, 50),
                strophe_short: _.map(
                    obj.strophenEinzeln?.slice(0, 3),
                    (elem, idx) =>
                        `${idx + 1}. ${elem?.strophe?.replaceAll('¬', '')?.replace('\n', ' ').substring(0, 30)}${elem?.strophe?.length > 15 ? '...' : ''}`,
                ).join(' '),
            }));
            text = _.map(text, (obj) => ({
                ...obj,
                autocomplete: obj.titel + obj.author_name + obj.strophe_short,
            }));

            const melodie_autor_grouped = {
                ..._.groupBy(melodie_autor, 'melodie_id'),
                null: undefined,
            };
            const melodie_file_grouped = {
                ..._.groupBy(melodie_file, 'melodie_id'),
                null: undefined,
            };
            const file_grouped = { ..._.keyBy(file, 'id'), null: undefined };
            const auftragByMelodieID = {
                ..._.pickBy(
                    _.groupBy(auftrag, 'melodieId'),
                    (val, key) => !(_.isNil(key) || _.isUndefined(key)),
                ),
                null: undefined,
            };
            melodie = _.map(melodie, (obj) => ({
                ...obj,
                authors: _.map(melodie_autor_grouped[obj.id], (elem) => {
                    return { ...authorById[elem.autor_id], ...elem };
                }),
                silben_pro_strophe: obj.silben
                    ? obj.silben.split('-').reduce((sum, num) => {
                          const parsedNum = parseInt(num);
                          return sum + (isNaN(parsedNum) ? 0 : parsedNum);
                      }, 0) *
                      (obj.verse / obj.silben.split('-').length)
                    : 0,
                files_urls: _.map(melodie_file_grouped[obj.id], 'directus_files_id'),
                auftrag: auftragByMelodieID[obj.id],
                bewertung_kleiner_kreis: bewertungKleinerKreisById[obj.bewertungKleinerKreis],
            }));
            melodie = _.map(melodie, (obj) => ({
                ...obj,
                author_name: formatAuthors(obj.authors),
                files: _.map(obj.files_urls, (elem) => file_grouped[elem]),
            }));
            melodie = _.map(melodie, (obj) => ({
                ...obj,
                autocomplete: obj.titel + obj.author_name,
            }));

            // Resolve id's to names
            const arbeitskreisById = {
                ..._.keyBy(arbeitskreis, 'id'),
                null: undefined,
            };
            const textById = { ..._.keyBy(text, 'id'), null: undefined };
            const melodieById = { ..._.keyBy(melodie, 'id'), null: undefined };

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

            const auftrags_category = _.uniq(_.map(auftrag, 'arbeitskreis_name'));

            termin = _.map(termin, (obj) => ({
                ...obj,
                arbeitskreis_name: arbeitskreisById[obj.arbeitskreisId].name,
            }));

            const kategorieById = { ..._.keyBy(kategorie, 'id'), null: 'Keine' };
            gesangbuchlied_kategorie = _.filter(
                _.map(gesangbuchlied_kategorie, (obj) => ({
                    ...obj,
                    kategorie_name: kategorieById[obj.kategorie_id],
                })),
                (elem) => elem.gesangbuchlied_id !== null,
            );

            const gesangbuchlied_kategorieBygesangbuchlied_id = {
                ..._.groupBy(gesangbuchlied_kategorie, 'gesangbuchlied_id'),
                null: 'Keine',
            };
            const gesangbuchlied_files_by_gesangbuchlied_id = {
                ..._.groupBy(gesangbuchlied_files, 'gesangbuchlied_id'),
                null: 'Keine',
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
                notentext_file: obj.notentext ? file_grouped[obj.notentext] : null,
                notentext_seite2_file: obj.notentext_seite2
                    ? file_grouped[obj.notentext_seite2]
                    : null,
                notentext_mxml_file: obj.notentext_mxml
                    ? file_grouped[obj.notentext_mxml]
                    : null,
                // SVG-Notentext (Issue #19): die gebackene SVG liegt jetzt in einem
                // eigenen Feld, das PDF-Notenbild in notentext/notentext_seite2.
                notentext_svg_file: obj.notentext_svg ? file_grouped[obj.notentext_svg] : null,
                // Finale-Quelldatei (.musx/.mus) im eigenen Feld finale_file.
                finale_file_file: obj.finale_file ? file_grouped[obj.finale_file] : null,
                // MIDI-Trio (Vorspiel / Standard-Strophe / Letzte Strophe).
                midi_intro_file: obj.midi_intro ? file_grouped[obj.midi_intro] : null,
                midi_main_file: obj.midi_main ? file_grouped[obj.midi_main] : null,
                midi_outro_file: obj.midi_outro ? file_grouped[obj.midi_outro] : null,

                // if undefined then 0, if auftrag exist and any has status not 'done' then 1 otherwise 2
                text_work_order: textById[obj.textId]?.auftrag
                    ? textById[obj.textId]?.auftrag?.some((elem) => elem.status !== 'done')
                        ? 2
                        : 1
                    : 0,
                melodie_work_order: melodieById[obj.melodieId]?.auftrag
                    ? melodieById[obj.melodieId]?.auftrag?.some((elem) => elem.status !== 'done')
                        ? 2
                        : 1
                    : 0,
                autocomplete: `${obj.titel} ${textById[obj.textId]?.autocomplete} ${
                    melodieById[obj.melodieId]?.autocomplete
                }`,
                strophen_connected: _.map(textById[obj.textId]?.strophenEinzeln, 'strophe')
                    ?.join(' ')
                    ?.replaceAll('¬', '')
                    ?.replace('\n', ' ')
                    ?.toLowerCase(),
                authors: [
                    ...(textById[obj.textId]?.authors || []),
                    ...(melodieById[obj.melodieId]?.authors || []),
                ],
                author_name:
                    (textById[obj.textId]?.author_name
                        ? `Text: ${textById[obj.textId]?.author_name}`
                        : '') +
                    ' ' +
                    (melodieById[obj.melodieId]?.author_name
                        ? `Melodie: ${melodieById[obj.melodieId]?.author_name}`
                        : ''),
                // if equal to title replace with ...
                gesangbuch_titel: `${obj?.titel}${
                    obj?.liednummer2000 ? ' (' + obj?.liednummer2000 + ')' : ''
                }`,
                text_titel: textById[obj.textId]?.titel,
                melodie_titel: melodieById[obj.melodieId]?.titel,
                // bewertung kleiner kreis
                bewertung_kleiner_kreis: bewertungKleinerKreisById[obj.bewertungKleinerKreis],
                _has_liednummer2026:
                    obj.liednummer2026 !== null &&
                    obj.liednummer2026 !== undefined &&
                    obj.liednummer2026 !== ''
                        ? 1
                        : 0,
            }));

            this.used_author = _.uniqBy(
                _.flatMap(gesangbuchlied, (song) => song.authors),
                'autor_id',
            );

            this.author = format_author;
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
            if (dont_cache !== 'ON') {
                data = await this.fetchData();
            } else {
                let data = JSON.parse(localStorage.getItem('data'));

                if (!data) {
                    // Load data from file or API request
                    data = await this.fetchData(); // replace with your own function to load data
                    // Set the data in localStorage to avoid requesting again
                    localStorage.setItem('data', JSON.stringify(data));
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
            console.log('Data loaded');
            this.data_loaded = true;

            // Export-Log (Issue #22) separat & graceful nachladen – ein Fehlen der
            // Collection darf den App-Start nicht blockieren.
            this.loadExportLog();

            // Globale Settings (Singleton) ebenfalls graceful nachladen.
            this.loadSettings();
        },

        // Lädt die Singleton-Collection „settings". Graceful wie das Export-Log:
        // fehlt die Collection (404/403), bleiben die Settings leer statt zu crashen.
        async loadSettings() {
            try {
                const resp = await axios.get(
                    `${import.meta.env.VITE_BACKEND_URL}/items/settings`,
                );
                // Singleton -> data ist ein Objekt (kein Array).
                this.settings = resp.data.data || {};
            } catch (error) {
                if (error?.response?.status === 401) {
                    const userStore = useUserStore();
                    userStore.logout();
                    return;
                }
                console.warn(
                    'Settings konnten nicht geladen werden (Collection vorhanden?)',
                    error?.response?.status || error,
                );
                this.settings = {};
            }
        },

        // Schreibt die Liste der im Autoren-Datencheck als erledigt markierten
        // Autoren (Issue #32) in das JSON-Feld settings.autoren_check. Optimistisch:
        // der lokale Store wird sofort aktualisiert (instant UI), bei Fehler wieder
        // auf den vorherigen Stand zurückgerollt – der Aufrufer fängt den Fehler ab.
        async updateAutorenCheck(autorenCheck) {
            const prev = this.settings;
            this.settings = { ...this.settings, autoren_check: autorenCheck };
            try {
                const resp = await axios.patch(
                    `${import.meta.env.VITE_BACKEND_URL}/items/settings`,
                    { autoren_check: autorenCheck },
                );
                this.settings = resp.data.data || this.settings;
                return this.settings;
            } catch (error) {
                this.settings = prev;
                if (error?.response?.status === 401) {
                    const userStore = useUserStore();
                    userStore.logout();
                }
                throw error;
            }
        },

        // Lädt das Export-Log (Issue #22). Graceful: existiert die Collection in
        // Directus noch nicht (404/403), bleibt das Log leer, statt zu crashen.
        async loadExportLog() {
            try {
                const resp = await axios.get(
                    `${import.meta.env.VITE_BACKEND_URL}/items/export_log?limit=-1`,
                );
                this.export_log = resp.data.data || [];
            } catch (error) {
                if (error?.response?.status === 401) {
                    const userStore = useUserStore();
                    userStore.logout();
                    return;
                }
                console.warn(
                    'Export-Log konnte nicht geladen werden (Collection vorhanden?)',
                    error?.response?.status || error,
                );
                this.export_log = [];
            }
        },

        // Schreibt eine Export-Log-Zeile (Issue #22) und hängt das Ergebnis lokal
        // an. data_created/user_created setzt Directus serverseitig – nicht mitsenden.
        async addNotentextExport(payload) {
            const resp = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/items/export_log`,
                payload,
            );
            const created = resp.data.data;
            // user_created stammt serverseitig vom aktuellen Nutzer. Liefert die
            // Antwort das Feld nicht mit (z. B. eingeschränkte Feld-Leserechte),
            // stempeln wir die ID des aktuellen Nutzers nach, damit der neue
            // Eintrag sofort in der nach Nutzer gefilterten Historie auftaucht –
            // ohne Reload abwarten zu müssen.
            if (created && created.user_created == null) {
                const userStore = useUserStore();
                if (userStore.user_id) created.user_created = userStore.user_id;
            }
            this.export_log.push(created);
            return created;
        },

        // Löscht eine Export-Log-Zeile (Issue #22) und entfernt sie lokal.
        async deleteNotentextExport(id) {
            await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/items/export_log/${id}`);
            this.export_log = this.export_log.filter((entry) => entry.id !== id);
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
            axios.get(`${import.meta.env.VITE_BACKEND_URL}/files?limit=-1`).then((response) => {
                this.file = response.data.data;
            });
        },

        async updateGesangbuchliedTitel(gesangbuchliedId, titel) {
            const controller = new AbortController();
            this.currentRequests.push(controller);

            try {
                const response = await axios.patch(
                    `${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied/${gesangbuchliedId}`,
                    { titel },
                    { signal: controller.signal },
                );

                const index = this.gesangbuchlied.findIndex((g) => g.id === gesangbuchliedId);
                if (index !== -1) {
                    const lied = this.gesangbuchlied[index];
                    lied.titel = titel;
                    lied.gesangbuch_titel = `${titel}${
                        lied.liednummer2000 ? ' (' + lied.liednummer2000 + ')' : ''
                    }`;
                }

                this.currentRequests = this.currentRequests.filter((c) => c !== controller);
                return response.data;
            } catch (error) {
                if (error?.response?.status === 401) {
                    const userStore = useUserStore();
                    userStore.logout();
                }
                this.currentRequests = this.currentRequests.filter((c) => c !== controller);
                throw error;
            }
        },

        // Korrekturlesung der gesetzten Noten (1. Strophe unter den Noten) – Issue #21.
        async updateNotenKorrekturlesung(gesangbuchliedId, value) {
            const controller = new AbortController();
            this.currentRequests.push(controller);

            try {
                const response = await axios.patch(
                    `${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied/${gesangbuchliedId}`,
                    { korrekturlesung_notentext_1: value },
                    { signal: controller.signal },
                );

                const index = this.gesangbuchlied.findIndex((g) => g.id === gesangbuchliedId);
                if (index !== -1) {
                    this.gesangbuchlied[index].korrekturlesung_notentext_1 = value;
                }

                this.currentRequests = this.currentRequests.filter((c) => c !== controller);
                return response.data;
            } catch (error) {
                if (error?.response?.status === 401) {
                    const userStore = useUserStore();
                    userStore.logout();
                }
                this.currentRequests = this.currentRequests.filter((c) => c !== controller);
                throw error;
            }
        },

        async updateTextStrophes(textId, strophes, korrektur = null) {
            const controller = new AbortController();
            this.currentRequests.push(controller);

            // Korrekturlesungs-Felder, die optional mitgespeichert werden (Issue #20).
            const KORREKTUR_FELDER = [
                'korrekturlesung1',
                'korrekturlesung1_alle_Strophen',
                'korrekturlesung2',
            ];

            // Zeitpunkt der Textänderung – wird mitgespeichert, damit der
            // Notentext-Export erkennt, welche Lieder seit dem letzten Export
            // geänderten Text haben (Issue #22). Akzeptiert: leichtes
            // Over-Triggering bei reinen kiReview-Saves.
            const textChangedAt = new Date().toISOString();

            try {
                const payload = {
                    strophenEinzeln: strophes,
                    text_changed_at: textChangedAt,
                };

                // Nur die explizit übergebenen Korrekturlesungs-Flags patchen.
                if (korrektur && typeof korrektur === 'object') {
                    KORREKTUR_FELDER.forEach((feld) => {
                        if (korrektur[feld] !== undefined) payload[feld] = korrektur[feld];
                    });
                }

                const request = axios.patch(
                    `${import.meta.env.VITE_BACKEND_URL}/items/text/${textId}`,
                    payload,
                    { signal: controller.signal },
                );

                const response = await request;

                // Update local text object in store
                const textIndex = this.text.findIndex((t) => t.id === textId);
                if (textIndex !== -1) {
                    this.text[textIndex].strophenEinzeln = strophes;
                    this.text[textIndex].text_changed_at = textChangedAt;
                    if (korrektur && typeof korrektur === 'object') {
                        KORREKTUR_FELDER.forEach((feld) => {
                            if (korrektur[feld] !== undefined) {
                                this.text[textIndex][feld] = korrektur[feld];
                            }
                        });
                    }
                }

                // Remove controller from array after successful completion
                this.currentRequests = this.currentRequests.filter((c) => c !== controller);

                return response.data;
            } catch (error) {
                if (error?.response?.status === 401) {
                    const userStore = useUserStore();
                    userStore.logout();
                }
                // Remove controller from array on error as well
                this.currentRequests = this.currentRequests.filter((c) => c !== controller);
                throw error;
            }
        },

        // Autoren-Lebensdaten (Geburts-/Sterbejahr) in den Live-Datensatz schreiben.
        // Wird vom Autoren-Datenabgleich (KI-Review, Issue #32) genutzt: der Kleine
        // Kreis übernimmt einen ausgewählten Kandidaten / Vorschlag / manuelle Jahre.
        // Patcht nur die beiden vorhandenen Felder und aktualisiert den lokalen Store
        // (inkl. der abgeleiteten name/author_str), damit die UI sofort den neuen
        // Stand zeigt.
        async updateAutorLebensdaten(autorId, { geburtsjahr = null, sterbejahr = null }) {
            const controller = new AbortController();
            this.currentRequests.push(controller);

            try {
                const response = await axios.patch(
                    `${import.meta.env.VITE_BACKEND_URL}/items/autor/${autorId}`,
                    { geburtsjahr, sterbejahr },
                    { signal: controller.signal },
                );

                const index = this.author.findIndex((a) => a.id === autorId);
                if (index !== -1) {
                    const a = this.author[index];
                    a.geburtsjahr = geburtsjahr;
                    a.sterbejahr = sterbejahr;
                    const years =
                        geburtsjahr || sterbejahr
                            ? ` (${geburtsjahr ? '*' + geburtsjahr : ''}${
                                  sterbejahr ? ' - ' + sterbejahr : ''
                              })`
                            : '';
                    a.name = `${a.vorname} ${a.nachname}${years}`;
                    a.author_str = `${a.vorname} ${a.nachname}${years}`;
                }

                this.currentRequests = this.currentRequests.filter((c) => c !== controller);
                return response.data;
            } catch (error) {
                if (error?.response?.status === 401) {
                    const userStore = useUserStore();
                    userStore.logout();
                }
                this.currentRequests = this.currentRequests.filter((c) => c !== controller);
                throw error;
            }
        },
    },
});
