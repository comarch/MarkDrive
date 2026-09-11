import { describe, expect, it } from "vitest";
import {
  BUILT_IN_TEMPLATES,
  SNIPPETS,
  expandTemplateVariables,
  templateReviewStatus,
} from "../services/templates";

describe("built-in templates", () => {
  it("ships RFC, runbook, and postmortem", () => {
    expect(BUILT_IN_TEMPLATES.map((t) => t.name)).toEqual([
      "RFC",
      "Runbook",
      "Postmortem",
    ]);
  });

  it("every template declares a review status in frontmatter", () => {
    for (const template of BUILT_IN_TEMPLATES) {
      expect(templateReviewStatus(template.content)).toMatch(
        /^(draft|in-review|approved)$/,
      );
    }
  });

  it("uses template variables the expander knows", () => {
    for (const template of BUILT_IN_TEMPLATES) {
      expect(template.content).toContain("{{date}}");
      expect(template.content).toContain("{{author}}");
      expect(template.content).toContain("{{title}}");
    }
  });
});

describe("expandTemplateVariables", () => {
  const variables = {
    date: "2026-09-10",
    author: "Tomasz Author",
    title: "Pricing changes",
  };

  it("expands all known variables", () => {
    expect(
      expandTemplateVariables("{{title}} by {{author}} on {{date}}", variables),
    ).toBe("Pricing changes by Tomasz Author on 2026-09-10");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(expandTemplateVariables("keep {{custom}} here", variables)).toBe(
      "keep {{custom}} here",
    );
  });

  it("handles text without variables", () => {
    expect(expandTemplateVariables("plain text", variables)).toBe("plain text");
  });
});

describe("snippets", () => {
  it("ships date, signature, and checklist snippets", () => {
    expect(SNIPPETS.map((s) => s.id)).toEqual([
      "snippet-date",
      "snippet-signature",
      "snippet-checklist",
    ]);
  });

  it("snippets use expandable variables only", () => {
    for (const snippet of SNIPPETS) {
      const unknown = snippet.content.match(
        /\{\{(?!date|author|title)[^}]+\}\}/g,
      );
      expect(unknown).toBeNull();
    }
  });
});
