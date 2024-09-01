interface Song {
  id: number;
  status: string;
  userCreated: string;
  dateCreated: Date;
  userUpdated: string;
  dateUpdated: Date;
  textId: number;
  melodieId: number;
  titel: string;
  liednummer2000: number | null;
  melodieGeaendert: boolean;
  textGeaendert: boolean;
  anmerkung: string | null;
  externerLink: string | null;
  linkCloud: string;
  bewertungKleinerKreis: number;
  bewertungAnmerkung: string | null;
  rueckfrageAutor: string | null;
  einreicherName: string | null;
  liedHatAenderung: boolean;
  kategorieId: number[];
  gesangbuchliedSatzMitMelodieUndText: any[];  // Needs further definition or replacement with appropriate types
  statusMapped: string;
  text: Text;
  melodie: Melodie;
  textWorkOrder: number;
  melodieWorkOrder: number;
  autocomplete: string;
  strophenConnected: string;
  authorName: string;
  gesangbuchTitel: string;
  textTitel: string;
  melodieTitel: string;
  bewertungKleinerKreisDetails: BewertungKleinerKreis;
  kategories: Kategorie[]; // Newly added field
}

interface BewertungKleinerKreis {
  id: number;
  bezeichner: string;
  rangfolge: number;
}

interface File {
  id: string;
  storage: string;
  filenameDisk: string;
  filenameDownload: string;
  title: string;
  type: string;
  folder: string | null;
  uploadedBy: string;
  uploadedOn: Date;
  modifiedBy: string | null;
  modifiedOn: Date | null;
  charset: string | null;
  filesize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  embed: string | null;
  description: string | null;
  location: string | null;
  tags: string | null;
  metadata: string | null;
  focalPointX: number | null;
  focalPointY: number | null;
}

interface Kategorie {
  id: number;
  gesangbuchliedId: number;
  kategorieId: number;
  kategorieName: KategorieName;
}

interface KategorieName {
  id: number;
  name: string;
  gesangbuchliedId: number | null;
  typ: string | null;
}


interface Text {
  id: number;
  status: string;
  userCreated: string;
  dateCreated: Date;
  userUpdated: string;
  dateUpdated: Date;
  quelle: string | null;
  quelllink: string | null;
  titel: string;
  lizenzId: number | null;
  anmerkung: string | null;
  rueckfrageAutor: string | null;
  bewertungKleinerKreis: number;
  bewertungAnmerkung: string | null;
  strophenEinzeln: Strophe[];
  autorId: number[];
  authors: Author[];
  auftrag: Auftrag[]; // Added to include details about tasks related to this text
  bewertungKleinerKreisDetails: BewertungKleinerKreis;
  authorName: string;
  strophenConnected: string;
  strophenConnectedShort: string;
  stropheShort: string;
  autocomplete: string;
}

interface Strophe {
  strophe: string;
  aenderungsvorschlag: string | null;
  anmerkung: string | null;
}

interface Melodie {
  id: number;
  status: string;
  userCreated: string;
  dateCreated: Date;
  userUpdated: string;
  dateUpdated: Date;
  quelle: string | null;
  quelllink: string | null;
  lizenzId: number | null;
  titel: string;
  anmerkung: string | null;
  rueckfrageAutor: string | null;
  bewertungKleinerKreis: number | null;
  bewertungAnmerkung: string | null;
  abcMelodie: any[]; // Details for melody notation if applicable
  noten: number[];
  autorId: number[];
  authors: Author[];
  filesUrls: string[];
  bewertungKleinerKreisDetails: BewertungKleinerKreis;
  authorName: string;
  files: File[];
}


interface Auftrag {
  id: number;
  status: string;
  userCreated: string;
  dateCreated: Date;
  userUpdated: string;
  dateUpdated: Date;
  textId: number;
  melodieId: number | null;
  anmerkung: string;
  arbeitskreisId: number;
  abgabetermin: Date | null;
  auftraggeberId: number;
  auftragsartMelodie: string | null;
  auftragsartText: string;
}

interface Author {
  id: number;
  vorname: string;
  nachname: string;
  geburtsjahr: number;
  sterbejahr: number | null;
  status: string;
}
