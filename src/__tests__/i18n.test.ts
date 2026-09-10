import { describe, expect, it } from "vitest";
import { setLanguage, t, type StringKey } from "../i18n";
import { enTable as en, plTable as pl } from "../i18n";

const enKeys = Object.keys(en) as StringKey[];
const plKeys = Object.keys(pl) as StringKey[];

describe("i18n catalogue", () => {
  it("keeps Polish translations in sync with English keys", () => {
    expect(plKeys.sort()).toEqual(enKeys.sort());
    for (const key of enKeys) {
      expect(pl[key]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("substitutes values into strings", () => {
    setLanguage("en");
    expect(t("suggest.pending.many", { count: 3 })).toBe("3 pending changes");
    setLanguage("pl");
    expect(t("suggest.pending.one", { count: 1 })).toBe("1 zmiana oczekuje");
  });

  it("falls back to English on unknown languages", () => {
    setLanguage("de");
    expect(t("status.saved")).toBe("Saved");
  });

  it("translates the shell strings distinctly", () => {
    setLanguage("pl");
    expect(t("mode.suggest")).toBe("Sugestie");
    expect(t("header.save")).toContain("Zapisz");
    expect(t("zoom.in")).toBe("Powiększ");
    setLanguage("en");
    expect(t("mode.suggest")).toBe("Suggest");
  });
});
