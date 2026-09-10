export const SAMPLE_MARKDOWN = `# Welcome to Comarch MarkQuire

Drive-native Markdown authoring and review for **Google Workspace teams**.

---

## Features

- **Stay in Google Drive**: Open, create, rename, and auto-save portable Markdown files.
- **Review exact passages**: Add anchored Drive comments, replies, and resolutions.
- **Keep content portable**: Standard Markdown stays the source of truth.
- **Rich Markdown Formatting**: GFM (GitHub Flavored Markdown), Tables, Task Lists.
- **LaTeX Math Formulas**: Powered by KaTeX.
- **Diagrams & Flowcharts**: Mermaid sequence diagrams, flowcharts, and mindmaps.
- **Document Outline**: Automatic Table of Contents.
- **Export Options**: Download Markdown, Styled HTML, or Print to PDF.

---

## 1. Text Formatting & Typography

You can write with *italics*, **bold**, ***bold italics***, or ~~strikethrough~~.
Subscript: H~2~O, Superscript: X^2^.

> "Simplicity is the prerequisite for reliability."
> - Edsger W. Dijkstra

---

## 2. Lists & Tasks

### Task List
- [x] Integrate with Google Drive UI "New" and "Open with"
- [x] Review exact text with Google Drive comment threads
- [x] Implement live side-by-side preview with synchronized scrolling
- [ ] Export directly to team Google Workspace Drive folder

### Nested Lists
1. First item
   - Sub-item A
   - Sub-item B
2. Second item
3. Third item

---

## 3. Data Tables

| Service | Supported | Storage | Notes |
| :--- | :---: | :---: | :--- |
| Google Drive | Yes | Cloud | Full integration with Drive UI |
| Comments API | Yes | Drive Metadata | Threads, replies, resolution |
| Local Drafts | Yes | Browser | Offline safety cache |

---

## 4. Code Highlighting

Here is a TypeScript snippet:

\`\`\`typescript
interface DriveCommentThread {
  id: string;
  author: string;
  content: string;
  quotedText?: string;
  resolved: boolean;
}

function resolveDiscussion(commentId: string): Promise<boolean> {
  console.log(\`Resolving thread \${commentId}\`);
  return Promise.resolve(true);
}
\`\`\`

---

## 5. Mathematical Formulas (KaTeX)

Inline formula: $E = mc^2$ and Euler's identity $e^{i\\pi} + 1 = 0$.

Display equations:

$$
\\frac{n!}{r!(n-r)!} = \\binom{n}{r}
$$

$$
\\mathbf{X} = \\begin{pmatrix}
x_{11} & x_{12} & \\cdots & x_{1n} \\\\
x_{21} & x_{22} & \\cdots & x_{2n} \\\\
\\vdots & \\vdots & \\ddots & \\vdots \\\\
x_{m1} & x_{m2} & \\cdots & x_{mn}
\\end{pmatrix}
$$

---

## 6. Diagrams (Mermaid)

### Flowchart
\`\`\`mermaid
graph TD
    A[Google Drive UI] -->|Open With / New| B(Markdown App)
    B --> C{Authenticated?}
    C -->|Yes| D[Load File & Comments]
    C -->|No| E[Google OAuth 2.0]
    E --> D
    D --> F[Live Editor & Preview]
    F -->|Edit & Comment| G[Sync back to Drive]
\`\`\`

### Sequence Diagram
\`\`\`mermaid
sequenceDiagram
    actor User
    participant Editor as Markdown Editor
    participant API as Google Drive API

    User->>Editor: Selects text & writes comment
    Editor->>API: POST /drive/v3/files/{id}/comments
    API-->>Editor: 201 Created (Comment Thread)
    Editor-->>User: Displays anchored comment card
\`\`\`

---

*Tip: Select any text above and click "Add Comment" to start a discussion thread!*
`;
