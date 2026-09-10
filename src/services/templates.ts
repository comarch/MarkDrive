import { driveService } from "./googleDrive";
import { parseFrontmatter } from "../utils/frontmatter";

// Templates start a new document from an approved structure; snippets
// insert recurring fragments with variables such as the current date.

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  /** Drive file id for organization templates, built-ins have none. */
  fileId?: string;
}

export interface Snippet {
  id: string;
  name: string;
  description: string;
  content: string;
}

export interface SnippetVariables {
  date: string;
  author: string;
  title: string;
}

export const BUILT_IN_TEMPLATES: DocumentTemplate[] = [
  {
    id: "builtin-rfc",
    name: "RFC",
    description: "Request for comments: context, proposal, alternatives",
    content: `---
review-status: in-review
---

# RFC: {{title}}

- Author: {{author}}
- Date: {{date}}
- Status: Draft

## Summary

One paragraph explaining the proposal.

## Motivation

Which problem does this solve, and why now?

## Proposal

The change itself, in detail.

## Alternatives considered

What was rejected and why.

## Open questions

- [ ] Question one
`,
  },
  {
    id: "builtin-runbook",
    name: "Runbook",
    description: "Operational guide: alerts, diagnosis, recovery steps",
    content: `---
review-status: draft
---

# Runbook: {{title}}

- Owner: {{author}}
- Last reviewed: {{date}}

## Monitoring

Which dashboards and alerts cover this service?

## Diagnosis

1. Check the alert severity and affected scope.
2. Collect recent changes and deploys.
3. Compare with the last known good state.

## Recovery

Step-by-step actions to restore service.

## Escalation

Who to page, in which order, with which channels.
`,
  },
  {
    id: "builtin-postmortem",
    name: "Postmortem",
    description: "Incident review: timeline, impact, causes, actions",
    content: `---
review-status: in-review
---

# Postmortem: {{title}}

- Author: {{author}}
- Date: {{date}}

## Impact

Duration, affected users, and severity.

## Timeline

| Time | Event |
| ---- | ----- |
|      |       |

## Root causes

What made this possible.

## What went well

- Detection worked quickly.

## Action items

- [ ] Follow-up task with an owner
`,
  },
];

export const SNIPPETS: Snippet[] = [
  {
    id: "snippet-date",
    name: "Today's date",
    description: "Inserts the current date in ISO format",
    content: "{{date}}",
  },
  {
    id: "snippet-signature",
    name: "Signature",
    description: "Author and date footer",
    content: "\n---\n\nWritten by {{author}} on {{date}}.\n",
  },
  {
    id: "snippet-checklist",
    name: "Review checklist",
    description: "Standard review questions as a task list",
    content:
      "- [ ] Is the purpose clear in the first paragraph?\n- [ ] Are the examples correct?\n- [ ] Does anything contradict the rest of the document?\n",
  },
];

const VARIABLE_PATTERN = /\{\{(?:date|author|title)\}\}/g;

/**
 * Expands {{date}}, {{author}}, and {{title}} in template and snippet
 * content. Unknown variables are left untouched so custom placeholders
 * survive for manual editing.
 */
export function expandTemplateVariables(
  content: string,
  variables: SnippetVariables,
): string {
  return content.replace(VARIABLE_PATTERN, (name) => {
    switch (name) {
      case "{{date}}":
        return variables.date;
      case "{{author}}":
        return variables.author;
      default:
        return variables.title;
    }
  });
}

// Reading every candidate costs one GET; cap how many files the
// organization listing inspects.
const MAX_ORG_TEMPLATES = 25;

/**
 * Lists organization templates from the configured Drive folder.
 *
 * Returns metadata with file ids; content is fetched when the template
 * is used, so opening the modal stays fast.
 */
export async function listOrganizationTemplates(
  folderId: string,
): Promise<DocumentTemplate[]> {
  const files = await driveService.listMarkdownFilesInFolder(folderId);
  return files.slice(0, MAX_ORG_TEMPLATES).map((file) => ({
    id: `org-${file.id}`,
    name: file.name.replace(/\.(md|markdown)$/i, ""),
    description: `Organization template from Drive`,
    content: "",
    fileId: file.id,
  }));
}

/** Frontmatter fields of a template, for descriptions and labels. */
export function templateReviewStatus(content: string): string | null {
  const fields = parseFrontmatter(content).fields;
  const status = fields["review-status"];
  return typeof status === "string" ? status : null;
}
