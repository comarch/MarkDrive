# Compatibility

MarkQuire is a browser SPA and a self-hosted Google Workspace integration.

## Supported baseline

| Dimension               | Supported baseline          | Validation                                         |
| ----------------------- | --------------------------- | -------------------------------------------------- |
| Development runtime     | Node.js 22                  | `.nvmrc`, local validation, and CI                 |
| Package manager         | npm with committed lockfile | `npm ci`                                           |
| Browser language target | ES2020                      | TypeScript and production build                    |
| Google API              | Google Drive API v3         | Mocked contract tests and manual integration setup |
| Drive files             | `.md` and `.markdown`       | Application file lifecycle                         |
| Deployment              | Static files over HTTPS     | Vite build and Nginx container                     |

## Browser policy

MarkQuire targets maintained desktop browsers with ES2020, module script,
`fetch`, `URL`, and Web Storage support.

Current automated validation compiles the browser application but does not run
a cross-browser end-to-end matrix. Chromium on macOS is used for manual visual
smoke checks. Firefox, Safari, mobile browsers, and assistive technology need a
documented test result before support is claimed.

## Google Workspace policy

Production Drive integration requires:

- a Google Cloud project;
- Google Drive API enabled;
- a Web OAuth client;
- an authorized HTTPS JavaScript origin;
- Drive UI integration for supported MIME types and extensions;
- user and administrator permission to install the application.

Google policy, browser privacy controls, and Workspace administrator settings
remain external dependencies.

## Unsupported combinations

- Internet Explorer and browsers without ES modules;
- direct production use over plain HTTP, except localhost development;
- simultaneous text co-editing;
- offline synchronization with Google Drive;
- files the signed-in user cannot edit or comment on;
- public Marketplace publication without the required Google review.

## Compatibility changes

A runtime, browser target, OAuth scope, Drive API, file format, or deployment
baseline change requires:

1. an explicit compatibility review;
2. migration notes when users must act;
3. tests for the new minimum;
4. README and setup guide updates;
5. rollback steps.
