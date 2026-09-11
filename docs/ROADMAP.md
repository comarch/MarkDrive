# Roadmap and implementation plan

Derived from the [competitive analysis](./COMPETITIVE_ANALYSIS.md). Priorities
answer one question: what has to exist before a Google Workspace team picks
MarkQuire over Google Docs, a Drive add-on, or Obsidian.

Each item lists the approach, the code it touches, the main risk, and the
condition that closes it. Every item also carries focused regression coverage in
`src/__tests__/` with Google API calls mocked, per the project standards.

## Principles

- Google Drive stays the backend. Content, permissions, comments, and revisions
  belong to Drive, not to a MarkQuire service.
- The core application stays backend-free. Capabilities that cannot work without
  a server move behind an optional, self-hosted companion service.
- Markdown stays the stored artifact. No feature may require a proprietary
  container.
- Outbound network paths are opt-in, documented in
  [the security model](./SECURITY_MODEL.md), and switchable at build time
  through `VITE_FEATURE_*` flags.
- No telemetry, ever.

## Progress

All 32 items are implemented in this working tree:

| Item                            | Status      |
| ------------------------------- | ----------- |
| 1. Save conflict detection      | Implemented |
| 2. Version history              | Implemented |
| 3. Image paste and upload       | Implemented |
| 4. Search and replace           | Implemented |
| 5. Drive file switching         | Implemented |
| 6. Cross-document links         | Implemented |
| 7. Interactive task checkboxes  | Implemented |
| 8. YAML frontmatter             | Implemented |
| 9. Extended Markdown            | Implemented |
| 10. Table editing               | Implemented |
| 11. DOCX and Google Docs export | Implemented |
| 12. Offline queue               | Implemented |
| 13. Reach: mobile, a11y, i18n   | Implemented |
| 14. Self-contained HTML export  | Implemented |
| 15. Suggestion mode             | Implemented |
| 16. Revision diff with comments | Implemented |
| 17. Review workflow             | Implemented |
| 18. Templates and snippets      | Implemented |
| 19. Structure tools             | Implemented |
| 20. Wikilinks, backlinks, graph | Implemented |
| 21. Presentation and publishing | Implemented |
| 22. Diagrams and math depth     | Implemented |
| 23. Authoring quality checks    | Implemented |
| 24. Google Docs-style interface | Implemented |
| 25. WYSIWYG editing mode        | Implemented |
| 26. Gemini integration          | Implemented |
| 27. Real-time co-editing        | Implemented |
| 28. Change notifications        | Implemented |
| 29. Search index                | Implemented |
| 30. Integrations                | Implemented |
| 31. Compliance features         | Implemented |
| 32. Companion service itself    | Implemented |

Regression coverage lives in `src/__tests__/` with Google API calls
mocked, the companion suite runs on `node --test` in `companion/test/`,
and Playwright covers the interactive flows in `e2e/`, including a
two-author co-editing session through a live companion relay.

## P0: data safety and expected parity

### 1. Save conflict detection

**Approach.** Read `headRevisionId` with the file metadata, keep it in editor
state, and send it back as a precondition check before every write. On mismatch,
stop the auto-save and open a three-way merge dialog with the local text, the
remote text, and the common ancestor.
**Touches.** `src/services/googleDrive.ts`, `src/services/driveState.ts`,
`src/App.tsx`, new `src/components/Modals/ConflictModal.tsx`.
**Risk.** Silent data loss today, so this ships before any collaboration work.
**Done.** Two sessions editing one file cannot overwrite each other unnoticed.

### 2. Version history

**Approach.** Use Drive `revisions.list` and `revisions.get` with `alt=media` to
list, preview, and restore earlier content. Render a side-by-side text diff of
any two revisions.
**Touches.** `src/services/googleDrive.ts`, new
`src/components/Modals/HistorySidebar.tsx`, new `src/utils/diff.ts`.
**Risk.** Revision retention depends on the Drive plan; the empty state must say
so instead of looking broken.
**Done.** A user can compare two revisions and restore one into the open file.

### 3. Image paste and upload

**Approach.** Intercept paste and drop in CodeMirror, upload the binary to the
same Drive folder through a multipart create, then insert Markdown pointing at
the resulting file. Keep a plain URL path for users without upload rights.
**Touches.** `src/components/Editor/CodeMirrorEditor.tsx`,
`src/services/googleDrive.ts`, `src/components/Editor/EditorToolbar.tsx`.
**Risk.** `drive.file` grants no access to previously existing images, and Drive
image links need the correct sharing state to render for reviewers.
**Done.** Pasting a screenshot produces a rendered image for every reviewer of
the document.

### 4. Search and replace

**Approach.** Wire the existing `@codemirror/search` dependency into a visible
panel with regex, case, and whole-word options, plus replace and replace all.
**Touches.** `src/components/Editor/CodeMirrorEditor.tsx`,
`src/components/Editor/EditorToolbar.tsx`.
**Risk.** Low. The dependency is already installed.
**Done.** Regex replace works and undoes as a single history step.

### 5. Drive file switching

**Approach.** Query `files.list` for Markdown MIME types and extensions, show a
recent-files list backed by `viewedByMeTime`, and open a selected file without
leaving the app. Offer the Google Picker as an alternative entry point for files
the app has not touched.
**Touches.** `src/services/googleDrive.ts`, new
`src/components/Modals/FileBrowserModal.tsx`, `src/App.tsx`.
**Risk.** `drive.file` hides files the app never opened, so the Picker path must
exist for discovery.
**Done.** A user moves between Markdown documents without returning to Drive.

### 6. Cross-document links

**Approach.** Resolve relative Markdown links against the current file's parent
folder, map them to file identifiers, and open them in place. Unresolved links
render as broken with a clear reason.
**Touches.** `src/components/Preview/markdownParser.ts`,
`src/services/googleDrive.ts`, `src/App.tsx`.
**Risk.** Resolution costs API calls, so results need caching per session.
**Done.** A folder of linked Markdown files behaves like a small handbook.

### 7. Interactive task checkboxes

**Approach.** Make preview checkboxes write back into the source line instead of
toggling only the rendered DOM, reusing the existing anchor mapping.
**Touches.** `src/components/Preview/MarkdownPreview.tsx`,
`src/components/Preview/markdownParser.ts`, `src/App.tsx`.
**Risk.** Line mapping must survive edits made while the preview is scrolled.
**Done.** Ticking a box in the preview changes the stored Markdown.

### 8. YAML frontmatter

**Approach.** Parse leading frontmatter, hide it from the preview, and expose the
fields in a small properties panel. Unknown keys are preserved untouched.
**Touches.** `src/components/Preview/markdownParser.ts`, new
`src/components/Editor/PropertiesPanel.tsx`, `src/types/editor.ts`.
**Risk.** Round-tripping must not reorder or reformat keys the user wrote.
**Done.** Frontmatter survives an open, edit, and save cycle byte for byte.

### 9. Extended Markdown

**Approach.** Add footnotes, definition lists, and callout blocks through
markdown-it plugins, keeping the DOMPurify allowlist authoritative.
**Touches.** `src/components/Preview/markdownParser.ts`,
`src/utils/exportUtils.ts`, `src/index.css`.
**Risk.** Every new plugin widens the sanitizer surface and needs an XSS test.
**Done.** New syntax renders in preview, exported HTML, and print output.

### 10. Table editing

**Approach.** Add a table context toolbar for row and column operations,
alignment, and sorting. Convert tab-separated clipboard content from Sheets or
Excel into a Markdown table on paste.
**Touches.** `src/components/Editor/CodeMirrorEditor.tsx`,
`src/components/Modals/InsertTableModal.tsx`, new `src/utils/tableUtils.ts`.
**Risk.** Reformatting must not disturb surrounding text or code fences.
**Done.** A pasted spreadsheet range becomes a valid aligned Markdown table.

### 11. DOCX and Google Docs export

**Approach.** Generate DOCX in the browser from the parsed token stream. For
Google Docs, upload the Markdown with `mimeType` conversion so Drive performs the
import, then link the created Doc.
**Touches.** `src/utils/exportUtils.ts`,
`src/components/Modals/ExportModal.tsx`, `src/services/googleDrive.ts`.
**Risk.** A new document generation dependency enters the supply chain and needs
audit and pinning.
**Done.** Reviewers who refuse Markdown receive a file they accept.

### 12. Offline queue

**Approach.** Turn the demo fallback into a real offline mode: service worker
shell caching, an IndexedDB write queue, and replay against Drive with the
conflict check from item 1 on reconnect.
**Touches.** `src/services/driveState.ts`, `src/services/googleDrive.ts`, new
`src/services/offlineQueue.ts`, `vite.config.ts`.
**Risk.** A queue that replays blindly is worse than no queue. Conflict handling
is a hard dependency.
**Done.** Edits made with the network down reach Drive after reconnect, or fail
loudly.

### 13. Reach: mobile, accessibility, localization

**Approach.** Add a single-pane responsive layout with a mode switch, complete
keyboard operation, focus and contrast fixes, ARIA labels on toolbar controls,
and an English and Polish string catalogue.
**Touches.** all components, `src/index.css`, new `src/i18n/`.
**Risk.** Localization refactors touch every component, so it lands before the
interface redesign rather than after.
**Done.** The app is usable on a tablet, by keyboard only, and in Polish.

### 14. Self-contained HTML export

**Approach.** Inline KaTeX and highlight styles from local dependencies instead
of linking `cdn.jsdelivr.net` and `cdnjs.cloudflare.com`.
**Touches.** `src/utils/exportUtils.ts`, `docs/SECURITY_MODEL.md`.
**Risk.** Larger export files, which is the correct trade for offline and
data-loss-prevention review.
**Done.** Exported HTML renders with no outbound requests.

## P1: differentiators

### 15. Suggestion mode

**Approach.** Add an editing mode that records changes as a proposed patch stored
in a Drive comment thread rather than in the file. Reviewers accept or reject
each hunk; acceptance applies it to the Markdown.
**Touches.** `src/services/googleComments.ts`, `src/components/Comments/*`,
`src/components/Editor/CodeMirrorEditor.tsx`, new `src/utils/patch.ts`.
**Risk.** Patches must survive edits made after the suggestion was written, so
each hunk needs context anchoring and an unresolvable state.
**Done.** A reviewer without Markdown knowledge proposes wording that the author
accepts with one click.

### 16. Revision diff with comments

**Approach.** Combine the diff from item 2 with comment anchors so review
discussion appears next to the change it refers to.
**Touches.** `src/utils/diff.ts`, `src/components/Comments/CommentsSidebar.tsx`.
**Risk.** Anchors drift between revisions and need a fallback presentation.
**Done.** A reviewer sees what changed since the last read, with the discussion
attached.

### 17. Review workflow

**Approach.** Mentions in comment bodies, a document status field in frontmatter,
a queue view of documents awaiting review, and shareable deep links to a passage.
**Touches.** `src/components/Comments/*`, `src/services/googleComments.ts`,
`src/App.tsx`, `src/services/driveState.ts`.
**Risk.** Notification delivery belongs to Drive; the app must not promise mail
it does not send.
**Done.** A review can be requested, tracked, and closed without leaving the app.

### 18. Templates and snippets

**Approach.** Ship RFC, runbook, and postmortem templates, allow organization
templates from a configured Drive folder, and add snippets with variables such as
date and author.
**Touches.** `src/utils/sampleDocument.ts`, new `src/services/templates.ts`,
`src/components/Header/AppHeader.tsx`.
**Risk.** Template folder access depends on `drive.file` and may need the Picker.
**Done.** A new document starts from an approved organization template.

### 19. Structure tools

**Approach.** Drag and drop section reordering in the outline, optional heading
numbering, and generated tables of contents.
**Touches.** `src/components/Modals/OutlineSidebar.tsx`,
`src/components/Preview/markdownParser.ts`.
**Risk.** Reordering rewrites large text ranges and must be a single undo step.
**Done.** Moving a heading moves its whole section.

### 20. Wikilinks, backlinks, graph

**Approach.** Support `[[wikilink]]` resolution inside the current Drive folder,
build a backlink index per session, and render a folder-level link graph.
**Touches.** `src/components/Preview/markdownParser.ts`, new
`src/services/linkIndex.ts`, new `src/components/Modals/GraphModal.tsx`.
**Risk.** Index building costs API calls; scope it to the folder and cache it.
**Done.** Obsidian-style linking works on files stored in Drive.

### 21. Presentation and publishing

**Approach.** Slide mode from horizontal rules or heading levels, book mode over
a folder, and a static site export that a team can publish from a Drive folder.
**Touches.** new `src/components/Present/`, `src/utils/exportUtils.ts`.
**Risk.** Publishing invites scope creep toward a hosting product. Export only.
**Done.** A document presents as slides and a folder exports as a browsable site.

### 22. Diagrams and math depth

**Approach.** Add PlantUML and Graphviz rendering, embed Excalidraw scenes, and
support KaTeX macros with equation numbering.
**Touches.** `src/components/Preview/markdownParser.ts`, new
`src/components/Preview/diagramRenderers.ts`.
**Risk.** PlantUML normally needs a server. Ship the WebAssembly path or leave it
to the companion service instead of calling a public renderer.
**Done.** Diagram coverage matches the technical documentation use case with no
third-party rendering endpoint.

### 23. Authoring quality checks

**Approach.** Inline markdownlint diagnostics, Polish and English spell checking,
and a link checker for internal and external targets.
**Touches.** new `src/services/lint.ts`,
`src/components/Editor/CodeMirrorEditor.tsx`.
**Risk.** Dictionary size affects bundle weight, so load dictionaries on demand.
**Done.** Style and broken-link problems surface while writing.

### 24. Google Docs-style interface

**Approach.** Rebuild the shell to match Workspace expectations: title row with
file name, star, folder, and save state; a menu bar; a pill toolbar; a mode
switch for editing, suggesting, and viewing; a Share button that opens Drive
sharing; a page-like centered canvas with zoom; an outline drawer; comment cards
in the right margin connected to the anchored text. Adopt Material 3 tokens,
Roboto Flex, and Material Symbols.
**Touches.** `src/components/Header/AppHeader.tsx`,
`src/components/Editor/EditorToolbar.tsx`, `src/components/Comments/*`,
`src/index.css`, `tailwind.config.js`, `docs/BRAND.md`, `docs/assets/`.
**Risk.** Google Sans is proprietary and stays out. Material patterns are fine,
but Google logos, product iconography, and anything implying endorsement are not,
and Marketplace review rejects trademark misuse. All screenshots and the brand
kit need recapturing after this lands.
**Done.** A Google Docs user recognizes the layout without training, and no
Google brand asset ships in the bundle.

### 25. WYSIWYG editing mode

**Approach.** Add a rich editing mode over the same Markdown source so toolbar
actions produce formatted text rather than visible syntax, keeping the source
view as an equal alternative. Evaluate CodeMirror decorations against a
ProseMirror-based editor before committing.
**Touches.** `src/components/Editor/`, `src/App.tsx`, `src/types/editor.ts`.
**Risk.** The largest item on this roadmap and the one most likely to break
round-trip fidelity. It needs a fidelity test corpus before implementation.
**Done.** A non-technical reviewer edits a document without seeing Markdown
syntax, and the saved file stays byte-stable for untouched sections.

### 26. Gemini integration

**Approach.** Feature-flagged assistant covering drafting, rewriting, shortening,
grammar, Polish and English translation, document and comment-thread summaries,
table generation from prose, Mermaid generation from a description, questions
about the open document, and a changelog from a revision diff. The strongest
combination with item 15: turn a reviewer comment into a suggested patch the
author accepts in one click.

Three connection modes, in order of preference:

| Mode                        | Key location                          | Suits                                 | Cost                                      |
| --------------------------- | ------------------------------------- | ------------------------------------- | ----------------------------------------- |
| Firebase AI Logic           | none in the client, Google-side proxy | Default for a backend-free deployment | Requires a Firebase project and App Check |
| User-supplied key           | browser storage, like the client ID   | Individual and evaluation use         | Any injected script can read the key      |
| Vertex AI through companion | server                                | Enterprises with data controls        | Requires the companion service            |

**Touches.** new `src/services/ai.ts`, new `src/components/AI/`,
`src/components/Modals/SettingsModal.tsx`, `docs/SECURITY_MODEL.md`,
`docs/USER_GUIDE.md`.
**Risk.** This is the first feature that sends document content to a third party.
It must be off by default, announced in the interface, documented as a network
path, and disabled entirely by a build flag. Gemini in Drive cannot be reused by
a third-party application, so there is no shortcut.
**Done.** A self-hoster can enable assistance without shipping a key to the
browser, and can build a bundle with the whole feature compiled out.

## P2: needs the companion service

### 27. Real-time co-editing and presence

**Approach.** Yjs documents relayed over WebSocket, Drive remaining the
durability layer through debounced snapshots, presence and cursors on top.
**Risk.** The Drive Realtime API is gone, so this cannot be backend-free.
**Done.** Two authors type in one document without conflict dialogs.

### 28. Change notifications

**Approach.** Register `changes.watch` against a public HTTPS endpoint and push
updates to connected clients.
**Risk.** Channel expiry and renewal need scheduled work.
**Done.** A user sees that a document changed without reloading.

### 29. Search index

**Approach.** Index Markdown content per organization for fast cross-document
search, ranking, and backlinks beyond a single folder.
**Risk.** An index stores document content outside Drive, which contradicts the
zero-custody promise unless the organization hosts it.
**Done.** Full-text search across a Drive corpus returns in interactive time.

### 30. Integrations

**Approach.** Slack and Teams notifications, Jira and Linear linking, two-way git
synchronization for documentation repositories.
**Risk.** Each integration adds credentials and its own failure modes.
**Done.** Review activity reaches the tools the team already watches.

### 31. Compliance features

**Approach.** Audit log export, retention configuration, and data-loss-prevention
hooks for organizations that require them.
**Risk.** Compliance claims need legal review before publication.
**Done.** An administrator can answer who changed what and when.

### 32. Companion service itself

**Approach.** One optional, self-hosted service with a documented contract,
providing exactly four capabilities: CRDT relay, Drive change webhooks, AI proxy,
and search index. Distributed as a container next to the SPA, disabled unless
configured, and never required for P0 or P1 features.
**Touches.** new top-level service directory, `Dockerfile`, `nginx.conf`,
`docs/SECURITY_MODEL.md`, `GOOGLE_WORKSPACE_SETUP.md`.
**Risk.** The moment the core depends on it, the main differentiator disappears.
The boundary is a release-blocking rule, not a preference.
**Done.** A deployment without the companion still delivers every P0 and P1
feature.

## Sequencing

| Phase | Items              | Unlocks                                                 |
| ----- | ------------------ | ------------------------------------------------------- |
| 1     | 1, 2, 3, 7, 4      | Nobody loses work; the editor stops feeling like a demo |
| 2     | 5, 6, 8, 10, 14, 9 | Drive becomes a workspace rather than a single file     |
| 3     | 15, 16, 17, 18     | Review beats Google Docs on Markdown                    |
| 4     | 24, 13, 25         | Non-technical users stop needing training               |
| 5     | 20, 21, 19, 22, 23 | Obsidian and HackMD arguments disappear                 |
| 6     | 26                 | Feature parity with Gemini in Google Docs               |
| 7     | 11, 12             | Export and offline reach                                |
| 8     | 27 to 32           | Real-time and enterprise integration, opt-in only       |

## Non-goals

- Becoming a hosting or publishing platform.
- Storing document content in a MarkQuire-operated service.
- Any telemetry or usage analytics.
- Supporting a proprietary document format as the stored artifact.
- Requiring the companion service for core authoring and review.
