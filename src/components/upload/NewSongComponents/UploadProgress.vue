<template>
  <v-card :loading="loading" title="Gesangbuchlied wird Hochgelanden">
    <v-card-text>
      <div class="text-h6 mb-5">Hochgeladene Elemente:</div>

      <v-card title="Gesangbuchlied" v-if="gesangbuchlied" class="mb-4">
        <v-card-text>
          <div>
            <strong>ID: </strong>{{ gesangbuchlied.id }} <strong>Titel: </strong
            >{{ gesangbuchlied.titel }}
          </div>

          <div class="d-flex flex-row">
            <v-card
              width="200"
              class="me-5"
              :title="'Kategorie ' + (index + 1)"
              v-for="(elem, index) of category_gesangbuchlied_mapping"
              :key="index"
            >
              <v-card-text>
                <div>
                  <div><strong>Kategorie </strong>{{ index + 1 }}:</div>
                  <div>
                    <strong>Gesangbuchlied: </strong>
                    {{ elem.gesangbuchlied_id }}
                  </div>
                  <div>
                    <strong>Kategorie: </strong> {{ elem.kategorie_id }}
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </div>
        </v-card-text>
      </v-card>

      <v-card title="Autoren" v-if="authors.length" class="mb-5">
        <v-card-text>
          <div class="d-flex flex-row flex-wrap">
            <v-card
              width="200"
              class="me-5 mb-5"
              :title="'Autor ' + (index + 1)"
              v-for="(elem, index) of authors"
              :key="index"
            >
              <v-card-text>
                <div>
                  <div><strong>ID: </strong>{{ elem.id }}</div>
                  <div><strong>Vorname: </strong>{{ elem.vorname }}</div>
                  <div><strong>Nachname: </strong>{{ elem.nachname }}</div>
                </div>
              </v-card-text>
            </v-card>
          </div>
        </v-card-text>
      </v-card>

      <v-card title="Text" v-if="text" class="mb-5">
        <v-card-text class="mb-0">
          <div>
            <div>
              <strong>ID: </strong>{{ text.id }} <strong>Text Titel: </strong
              >{{ text.titel }}
            </div>

            <div class="d-flex flex-row flex-wrap">
              <v-card
                width="200"
                class="me-5 mb-5"
                v-for="(elem, index) of text_author_mapping"
                :key="index"
                :title="'Text Author ' + (index + 1)"
              >
                <v-card-text>
                  Test
                  <div>
                    <div><strong>Text ID: </strong>{{ elem.text_id }},</div>
                    <div><strong>Autor ID: </strong>{{ elem.autor_id }}</div>
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-card title="Melodie" v-if="melodie">
        <v-card-text>
          <div class="mb-5">
            <strong>ID: </strong>{{ melodie.id }} <strong>Titel: </strong
            >{{ melodie.titel }}
          </div>

          <div class="text-h6">Melodie Autoren</div>
          <div class="d-flex flex-row flex-wrap">
            <v-card
              width="200"
              :title="'Melodie Autor ' + (index + 1)"
              class="me-5 mb-5"
              v-for="(elem, index) of melodie_author_mapping"
              :key="index"
            >
              <v-card-text>
                <div>
                  <div><strong>Melodie</strong> Autor {{ index + 1 }}:</div>
                  <div><strong>Melodie</strong> {{ elem.melodie_id }},</div>
                  <div><strong>Autor</strong> {{ elem.autor_id }}</div>
                </div>
              </v-card-text>
            </v-card>
          </div>

          <div class="text-h6">Melodie Datein</div>
          <div class="d-flex flex-row">
            <v-card
              width="200"
              :title="'Melodie File ' + (index + 1)"
              class="me-5 mb-5"
              v-for="(elem, index) of melodie_files"
              :key="index"
            >
              <v-card-text>
                <div>
                  <div>
                    <strong>Id:</strong>
                    {{ elem.melodie_id }}
                  </div>

                  <div>
                    <strong>File ID</strong>
                    {{ elem.directus_files_id }}
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </div>
        </v-card-text>
      </v-card>
    </v-card-text>
    <v-card-actions>
      <v-btn block color="primary" variant="tonal" @click="$emit('reset')"
        >Neues Lied anlegen</v-btn
      >
    </v-card-actions>
  </v-card>
</template>

<script>
export default {
  name: "UploadProgress",
  props: {
    loading: {
      type: Boolean,
      default: false,
    },
    gesangbuchlied: Object,
    text: Object,
    melodie: Object,
    category_gesangbuchlied_mapping: Array,
    authors: Array,
    text_author_mapping: Array,
    melodie_author_mapping: Array,
    melodie_files: Array,
    created_files: Array,
  },
};
</script>

<style scoped></style>
