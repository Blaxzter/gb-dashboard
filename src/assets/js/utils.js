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
  archived: "Archiviert",
};

function gesangbuch_kategorie_name_to_icon(gesangbuch_kategorie_name) {
  if (gesangbuch_kategorie_name === "Kinder") return "mdi-teddy-bear";
  if (gesangbuch_kategorie_name === "Jugend") return "mdi-skateboarding";
  if (gesangbuch_kategorie_name === "Weihnachten") return "mdi-pine-tree";
  if (gesangbuch_kategorie_name === "Heimgang") return "mdi-grave-stone";
  if (gesangbuch_kategorie_name === "Abendlied") return "mdi-weather-night";
  if (gesangbuch_kategorie_name === "Advent") return "mdi-candle";
  if (gesangbuch_kategorie_name === "Abendmahl") return "mdi-glass-wine";
  if (gesangbuch_kategorie_name === "Heiligabend") return "mdi-pine-tree";
  if (gesangbuch_kategorie_name === "Joseph Weißenberg – Geburtstag")
    return "mdi-image-filter-hdr";
  if (gesangbuch_kategorie_name === "Sakrament des Sterbens / Abschiedsfeie")
    return "";
  if (gesangbuch_kategorie_name === "Sakrament des Abendmahls") return "";
  if (gesangbuch_kategorie_name === "Joseph Weißenberg – Geburtstag (24.08.)")
    return "";
  if (gesangbuch_kategorie_name === "Palmsonntag") return "mdi-palm-tree";
  if (gesangbuch_kategorie_name === "Karfreitag") return "mdi-cross";
  if (gesangbuch_kategorie_name === "Ostersonntag") return "mdi-egg-easter";
  if (gesangbuch_kategorie_name === "Kirchentag") return "mdi-balloon";
  if (gesangbuch_kategorie_name === "Jahreswechsel") return "mdi-firework";
  if (gesangbuch_kategorie_name === "Sakrament der Taufe")
    return "mdi-human-baby-changing-table";
  if (gesangbuch_kategorie_name === "Konfirmation") return "mdi-account-group";
  if (gesangbuch_kategorie_name === "Trauung") return "";
  if (gesangbuch_kategorie_name === "Verpflichtung") return "";
  if (gesangbuch_kategorie_name === "Freundschaft") return "";
  if (gesangbuch_kategorie_name === "Friedensstadt") return "";
  if (gesangbuch_kategorie_name === "Joseph Weißenberg – Verurteilung (13.08.)")
    return "";
  if (gesangbuch_kategorie_name === "Joseph Weißenberg – Heimgang (06.03.)")
    return "";
  if (gesangbuch_kategorie_name === "Pfingsten") return "";
  if (gesangbuch_kategorie_name === "Erntedank") return "";
  if (gesangbuch_kategorie_name === "Ewigkeitssonntag (Totensonntag)")
    return "";
  if (gesangbuch_kategorie_name === "Passion") return "";
  if (gesangbuch_kategorie_name === "Gemeinschaft") return "";
  if (gesangbuch_kategorie_name === "Loblied") return "";
  if (gesangbuch_kategorie_name === "Stille") return "";
  if (gesangbuch_kategorie_name === "Christi Himmelfahrt") return "";
  return null;
}

const rang_to_color = {
  1: '#E35169',
  2: '#FFA439',
  3: '#00D1B9',
  4: '#00DB04',
  5: '#B9C32C',
}

const chart_colors = ['#1ba3c6', '#2cb5c0', '#30bcad', '#21B087', '#33a65c', '#57a337', '#a2b627', '#d5bb21', '#f8b620', '#f89217', '#f06719', '#e03426', '#f64971', '#fc719e', '#eb73b3', '#ce69be', '#a26dc2', '#7873c0', '#4f7cba']

export {
  work_group_icon,
  auftrag_type_to_name,
  status_mapping,
  gesangbuch_kategorie_name_to_icon,
  rang_to_color,
  chart_colors
};
