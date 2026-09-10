export type ViewMode = "split" | "editor" | "preview";

export interface OutlineItem {
  id: string;
  text: string;
  level: number;
  line: number;
}

export interface SelectionInfo {
  from: number;
  to: number;
  text: string;
  line: number;
  coords?: {
    top: number;
    left: number;
  };
}

export interface AppSettings {
  googleClientId: string;
  autoSaveIntervalMs: number;
  theme: "light" | "dark" | "system";
  fontSize: number;
  syncScroll: boolean;
}
