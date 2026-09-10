# Competitive analysis

Public product information checked in September 2026. This document records who
competes with Comarch MarkQuire, where the product already wins, and which gaps
feed [the roadmap](./ROADMAP.md).

## Method

Competitors are grouped by the channel they reach the user through, because the
buying decision differs per channel. A Drive add-on competes for the same click
as MarkQuire. A desktop editor competes for the author's habit. Google Docs
competes for the organization's default.

## Ring 1: same channel (Drive UI and Workspace Marketplace)

| Product                            | Strength                                                     | Missing against MarkQuire                                    |
| ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Markdown Viewer and Editor         | Editor, live preview, highlighting, TeX, flowcharts          | Anchored Drive comment threads, review workflow              |
| Markee Markdown Editor             | Drive-integrated editing                                     | Review workflow, diagrams, self-hosting                      |
| Markdown Viewer for Google Drive   | Renders `.md` straight from Drive                            | Editing                                                      |
| mark-drive.com                     | Viewer, highlighting, Mermaid, PDF export, no server storage | Editing, comments                                            |
| StackEdit                          | Mature editor, Drive and Dropbox sync, publishing            | Drive comment threads, native New and Open with entry points |
| Docs to Markdown and Pro variants  | Two-way conversion, bulk jobs, git export                    | Markdown authoring and review                                |
| Markdown to Docs                   | Markdown to Google Docs conversion                           | Markdown as the stored source of truth                       |
| Markdown Tools                     | Heading numbering and table of contents                      | Everything else                                              |
| Browser extensions (Drive preview) | Zero-setup rendering in Drive preview                        | Editing, comments, export, organization deployment           |

Ring 1 is crowded with viewers and converters. None of them combines Drive entry
points, Markdown storage, and passage-level review.

## Ring 2: collaborative Markdown outside Drive

| Product            | Strength                                             | Missing against MarkQuire                            |
| ------------------ | ---------------------------------------------------- | ---------------------------------------------------- |
| HackMD, CodiMD     | Real-time co-editing, slides, book mode, publishing  | Files live outside Drive, separate permission model  |
| HedgeDoc           | Self-hosted real-time editor, diagrams, slides, AGPL | No Drive lifecycle, no Drive comments                |
| CryptPad, Etherpad | Real-time editing with strong privacy posture        | Markdown review workflow, Drive integration          |
| Unmarkdown         | Multi-destination formatted publishing               | Authoring and review inside the organization's Drive |

Ring 2 wins on simultaneous editing. It loses whenever Drive must stay the
system of record and Workspace administration must own access.

## Ring 3: substitutes

| Product                     | Strength                                                                | Why teams still need MarkQuire                                |
| --------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| Google Docs                 | Native, free, Markdown import and export since 2024, built-in Gemini    | Stored artifact is a Doc, not a portable `.md` file           |
| Notion, Confluence, Outline | Wiki structure, database views, mature review features                  | Separate platform, separate permissions, format lock-in       |
| Obsidian, Typora, Zettlr    | Wikilinks, backlinks, graph, canvas, plugin ecosystems, offline comfort | Reviewers need a browser and Drive-native comment threads     |
| GitHub and GitLab web edit  | Review through pull requests, history, code proximity                   | Non-technical reviewers do not have or want repository access |

Google Docs is the strategic threat, not the add-ons. Since Markdown import and
export shipped, "just use Docs and export Markdown" became a defensible answer
for teams that do not care which file is authoritative.

## Where MarkQuire wins today

1. Drive is the system of record: file lifecycle, permissions, and comments stay
   in Google Drive.
2. The stored artifact is standard Markdown, not a proprietary document model.
3. Review happens on exact passages through Drive comment threads.
4. The deployment is open source, self-hostable, and free of telemetry.

No competitor in any ring holds all four at once.

## Gap analysis

| Gap                                             | Who exposes it                     | Roadmap item |
| ----------------------------------------------- | ---------------------------------- | ------------ |
| No version history or restore                   | Google Docs, GitHub                | P0           |
| Last write wins on concurrent save              | Every real-time competitor         | P0           |
| No image paste or upload                        | Docs, HackMD, StackEdit            | P0           |
| No cross-document links or Drive file switching | Obsidian, Notion, Confluence       | P0 and P1    |
| No suggestion mode                              | Google Docs                        | P1           |
| No wikilinks, backlinks, or graph               | Obsidian                           | P1           |
| No slides, book mode, or publishing             | HackMD, HedgeDoc, Obsidian Publish | P1           |
| Interface does not match Workspace expectations | Google Docs and Sheets             | P1           |
| No AI assistance                                | Google Docs with Gemini, Notion AI | P1           |
| No simultaneous editing or presence             | HackMD, HedgeDoc, CryptPad, Docs   | P2           |
| No change notifications or chat integrations    | Docs, Confluence, Notion           | P2           |

## Constraints discovered during analysis

- Product names may not embed Google product names. Marketplace review rejects
  improper trademark use in the app name, and the Drive branding guide requires
  the full "Google Drive" wording rather than an abbreviation. This removed the
  earlier MarkDrive name, which also collided with existing projects in the same
  niche.
- Material patterns may be reused, but Google logos, product iconography, and
  anything implying Google endorsement may not.
- Google Sans is proprietary and cannot be redistributed with the application.
  Roboto Flex with Material Symbols is the closest license-safe substitute.
- The Drive Realtime API no longer exists, so simultaneous editing requires a
  separate synchronization service.

## Architecture consequence

MarkQuire has no application backend by design. Google Drive holds the content,
permissions, comments, and revisions, and the browser talks to Google directly.
That choice is what makes "no data in our systems" true, and it is documented in
the [security model](./SECURITY_MODEL.md).

The cost is explicit: no simultaneous editing, no change webhooks, no server-side
search index, and no AI proxy. The roadmap keeps the core backend-free and moves
those four capabilities behind an optional companion service.
