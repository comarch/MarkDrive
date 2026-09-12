import { afterEach, describe, expect, it } from "vitest";
import { persistDraft, readPersistedDraft } from "../utils/draft";

const clearDraftStorage = () => {
  localStorage.removeItem("gdrive_md_draft");
  localStorage.removeItem("gdrive_md_last_title");
  localStorage.removeItem("gdrive_md_last_content");
};

afterEach(() => {
  clearDraftStorage();
});

describe("draft persistence", () => {
  it("keeps the title and content of one document together", () => {
    // Editing without renaming must not resurrect an older title from
    // a previously edited document on the next reload.
    persistDraft("Report A.md", "old content");
    persistDraft("Report A.md", "new content with spaces & polskie znaki");
    persistDraft("Report A.md", "final content");

    expect(readPersistedDraft("Welcome.md", "# default")).toEqual({
      title: "Report A.md",
      content: "final content",
    });
  });

  it("round-trips a rename and the edited content as one pair", () => {
    persistDraft("Old name.md", "body");
    persistDraft("Zażółć gęślą jaźń - raport #3.md", "body");

    expect(readPersistedDraft("Welcome.md", "# default")).toEqual({
      title: "Zażółć gęślą jaźń - raport #3.md",
      content: "body",
    });
  });

  it("falls back to the legacy split keys once", () => {
    localStorage.setItem("gdrive_md_last_title", "Legacy.md");
    localStorage.setItem("gdrive_md_last_content", "legacy body");

    expect(readPersistedDraft("Welcome.md", "# default")).toEqual({
      title: "Legacy.md",
      content: "legacy body",
    });
  });

  it("ignores a malformed pair and falls back to the legacy keys", () => {
    persistDraft("Pair.md", "pair body");
    // Corrupt the stored pair the way a truncated write would.
    localStorage.setItem(
      "gdrive_md_draft",
      localStorage.getItem("gdrive_md_draft")!.slice(0, 10),
    );
    localStorage.setItem("gdrive_md_last_title", "Legacy.md");
    localStorage.setItem("gdrive_md_last_content", "legacy body");

    expect(readPersistedDraft("Welcome.md", "# default")).toEqual({
      title: "Legacy.md",
      content: "legacy body",
    });
  });

  it("returns the defaults when nothing was ever stored", () => {
    expect(readPersistedDraft("Welcome.md", "# default")).toEqual({
      title: "Welcome.md",
      content: "# default",
    });
  });
});
