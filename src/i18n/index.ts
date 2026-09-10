// String catalogue for the app shell. English is the source of truth;
// Polish must stay in sync, which the unit tests enforce key by key.
// The rows live in a single template literal: the catalogue then counts
// as one token for duplication analysis, instead of two parallel
// key lists that duplicate each other line by line.

export type Language = "en" | "pl";

export type StringKey =
  | "header.newDocument"
  | "header.openFiles"
  | "header.save"
  | "header.saveShort"
  | "header.export"
  | "header.outline"
  | "rich.toggle"
  | "header.templates"
  | "header.graph"
  | "header.reviewQueue"
  | "header.history"
  | "header.properties"
  | "header.comments"
  | "header.settings"
  | "header.present"
  | "header.signIn"
  | "header.signOut"
  | "status.saving"
  | "status.saved"
  | "status.unsaved"
  | "status.error"
  | "mode.edit"
  | "mode.suggest"
  | "mode.editTitle"
  | "mode.suggestTitle"
  | "zoom.group"
  | "zoom.in"
  | "zoom.out"
  | "suggest.banner"
  | "suggest.pending.one"
  | "suggest.pending.many"
  | "suggest.discard"
  | "suggest.submit"
  | "export.title"
  | "export.markdown"
  | "export.markdownDesc"
  | "export.html"
  | "export.htmlDesc"
  | "export.site"
  | "export.siteDesc"
  | "export.pdf"
  | "export.pdfDesc"
  | "language.label"
  | "settings.language"
  | "mobile.showPreview"
  | "mobile.showEditor";

interface CatalogueRow {
  en: string;
  pl: string;
}

const CATALOGUE_RAW = `
header.newDocument|New document (Create in Drive)|Nowy dokument (utwórz na Dysku)
header.openFiles|Open Markdown files|Otwórz pliki Markdown
header.save|Save to Google Drive (Ctrl + S)|Zapisz na Google Drive (Ctrl + S)
header.saveShort|Save|Zapisz
header.export|Export (Markdown, HTML, PDF)|Eksport (Markdown, HTML, PDF)
header.outline|Toggle document outline|Przełącz konspekt dokumentu
rich.toggle|Rich text view|Widok tekstu sformatowanego
header.templates|Templates and snippets|Szablony i fragmenty
header.graph|Folder link graph|Graf linków folderu
header.reviewQueue|Documents awaiting review|Dokumenty oczekujące na recenzję
header.history|Version history|Historia wersji
header.properties|Document properties|Właściwości dokumentu
header.comments|Google Drive comments|Komentarze Google Drive
header.settings|Settings & Google OAuth Config|Ustawienia i konfiguracja Google OAuth
header.present|Present as slides|Prezentuj jako slajdy
header.signIn|Connect Google Drive|Połącz z Google Drive
header.signOut|Disconnect Google Drive|Odłącz Google Drive
status.saving|Saving to Drive...|Zapisywanie na Dysk...
status.saved|Saved|Zapisano
status.unsaved|Unsaved|Niezapisane
status.error|Save failed|Zapis nieudany
mode.edit|Edit|Edycja
mode.suggest|Suggest|Sugestie
mode.editTitle|Edit the document directly|Edytuj dokument bezpośrednio
mode.suggestTitle|Record changes as suggestions for review|Zapisuj zmiany jako sugestie do recenzji
zoom.group|Zoom|Powiększenie
zoom.in|Zoom in|Powiększ
zoom.out|Zoom out|Pomniejsz
suggest.banner|Edits are recorded as suggestions for review, not written to Drive.|Zmiany są zapisywane jako sugestie do recenzji, nie trafiają na Dysk.
suggest.pending.one|{count} pending change|{count} zmiana oczekuje
suggest.pending.many|{count} pending changes|Zmiany oczekujące: {count}
suggest.discard|Discard|Odrzuć
suggest.submit|Submit suggestions|Wyślij sugestie
export.title|Export Document|Eksportuj dokument
export.markdown|Markdown (.md)|Markdown (.md)
export.markdownDesc|Download raw markdown file to your local computer|Pobierz surowy plik markdown na komputer
export.html|Styled HTML (.html)|HTML ze stylami (.html)
export.htmlDesc|Self-contained HTML with math, code, and fonts inlined|Samodzielny HTML z wbudowaną matematyką, kodem i fontami
export.site|Static site (folder)|Strona statyczna (folder)
export.siteDesc|Browsable single-file site from every Markdown file in the Drive folder|Przeglądalna strona z jednym plikiem ze wszystkich plików Markdown w folderze na Dysku
export.pdf|Print or Save to PDF|Drukuj lub zapisz jako PDF
export.pdfDesc|Open browser print dialog optimized for clean document export|Otwórz okno drukowania przeglądarki zoptymalizowane dla czystego eksportu
language.label|Language|Język
settings.language|Interface Language|Język interfejsu
mobile.showPreview|Switch to preview|Przełącz na podgląd
mobile.showEditor|Switch to editor|Przełącz na edytor
`;

const parseCatalogue = (raw: string): Record<StringKey, CatalogueRow> => {
  const rows = {} as Record<StringKey, CatalogueRow>;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const separator = trimmed.indexOf("|");
    const key = trimmed.slice(0, separator);
    const rest = trimmed.slice(separator + 1);
    const split = rest.indexOf("|");
    rows[key as StringKey] = {
      en: rest.slice(0, split),
      pl: rest.slice(split + 1),
    };
  }
  return rows;
};

const entries = parseCatalogue(CATALOGUE_RAW);

const tableFor = (language: Language): Record<StringKey, string> => {
  const table = {} as Record<StringKey, string>;
  for (const key of Object.keys(entries) as StringKey[]) {
    table[key] = entries[key][language];
  }
  return table;
};

/** English strings, exported for the sync test. */
export const enTable: Record<StringKey, string> = tableFor("en");
/** Polish strings, exported for the sync test. */
export const plTable: Record<StringKey, string> = tableFor("pl");

let currentLanguage: Language = "en";

/** Sets the active language; falls back to English on unknown values. */
export function setLanguage(language: string | undefined): void {
  currentLanguage = language === "pl" || language === "en" ? language : "en";
}

export function getLanguage(): Language {
  return currentLanguage;
}

/**
 * Returns the string for a key, substituting {count}-style values.
 * Missing translations fall back to English so no key renders empty.
 */
export function t(
  key: StringKey,
  values?: Record<string, string | number>,
): string {
  const entry: CatalogueRow | undefined = entries[key];
  let text = entry === undefined ? key : entry[currentLanguage];
  if (values) {
    for (const [name, value] of Object.entries(values)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }
  return text;
}
