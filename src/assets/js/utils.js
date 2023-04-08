const work_group_icon = {
  Text: "mdi-file-document-outline",
  Melodie: "mdi-music",
  Jugend: "mdi-account-group",
  Kinder: "mdi-teddy-bear",
  IT: "mdi-laptop",
  "Kleiner Kreis": "mdi-record-circle-outline",
  Allgemein: "mdi-all-inclusive",
  "Großer AK Gesangbuch": "mdi-dots-circle",
  Layout: "mdi-page-layout-header-footer",
};

const auftrag_type_to_name = {
  textUeberarbeitung: "Textüberarbeitung nötig",
  textBrauchtMelodie: "Text benötigt noch eine Melodie",
  rueckfrageAutor: "Rückfrage an Autor",
  sonstiges: "Sonstiges",
  melodieUeberarbeitung: "Melodieüberarbeitung nötig",
  melodieBrauchtText: "Melodie benötigt noch einen Text",
};

const status_mapping = {
  draft: "Entwurf",
  published: "Veröffentlicht",
  uploaded: "Eingereicht via Formular",
  "back-to-author": "Rückfrage/Auftrag an Autor",
  "archived": "Archiviert",
};

export { work_group_icon, auftrag_type_to_name, status_mapping };
