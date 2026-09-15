# Folio

Folio is a private, desktop-first personal knowledge workspace built for notes, projects, journals, tasks, code snippets, bookmarks, and connected thinking.

## Current product scope

The application already includes rich editing, structured organization, search, backlinks, versioning, authenticated persistence, file handling, import/export, and a configurable workspace.

## Core capabilities

### Writing and editing

- Rich-text and Markdown editing
- Slash commands, headings, formatting, tables, task lists, collapsible blocks, and code highlighting
- Images and attachments
- Autosave plus explicit save
- Undo/redo
- Word count and reading time
- Version history
- Conflict rejection for overlapping edits

### Organization

- Notes, quick captures, ideas, documents, tasks, code snippets, bookmarks, journals, projects, and canvas items
- Custom collections
- Drag-and-drop collection assignment
- Pins and favorites
- Archive and trash
- Restore and confirmed permanent deletion

### Discovery and connections

- Search across titles, text, tags, and metadata
- Query filters such as `tag:python`, `type:journal`, and date filters
- `[[Note title]]` links
- Backlinks
- Zoomable and pannable graph view
- Project associations and milestones

### Workspace customization

- Grid, list, masonry, compact, and timeline layouts
- Journal calendar
- Light, dark, and system themes
- Accent color and editor typography controls
- Density and reduced-motion settings
- Configurable dashboard modules

### Import and export

- Markdown/text import
- Folio JSON import
- Markdown export
- JSON backup
- Browser print-to-PDF

## Tech stack

- React
- TypeScript
- Vinext
- Tiptap
- Cloudflare D1
- Cloudflare R2
- Drizzle
- Shadcn/Base UI primitives

## Data and privacy model

Folio is private by default.

- Every API route checks authenticated identity.
- Reads and writes are owner-scoped.
- Foreign-origin mutations are rejected.
- Uploaded files use opaque owner-scoped object keys.
- Downloads are authenticated and MIME-restricted.
- Private notes and uploaded files are not stored in this repository.

The application is **not end-to-end encrypted**. Offline synchronization, collaborative editing, and third-party identity providers are not implemented.

## Repository structure

```text
app/             Application routes, workspace UI, and global styles
components/      Reusable interface components
db/              Database schema and data helpers
drizzle/         Generated database migrations
lib/              Shared application logic
public/           Static assets
.openai/          Hosting configuration
```

## Run locally

Requires Node.js 22.13+ and npm.

```bash
npm ci
npm run db:migrate:local
npm run dev
```

Then open the local development URL printed in the terminal.

## Validate the project

```bash
npm run typecheck
npm run test:api
npm run build
```

Run `npm run test:api` only while the local development server is active. The API smoke test uses local test data and refuses non-local test URLs.

## Storage model

`db/schema.ts` defines normalized items, collections, tags, joins, links, versions, attachments, activity, and settings.

Typed metadata handles item-specific fields such as journal mood/location, task completion, bookmark information, canvas cards, and project milestones.

## Practical limits

- Very large vaults should eventually move toward server-side pagination and full-text indexing.
- The graph renders a bounded filtered set to keep the visualization readable.
- Attachment sizes remain subject to hosting-platform request and memory limits.
- Bookmark enrichment depends on the destination allowing browser CORS access.
- Interface copy is currently English.

## Development and deployment

The `.openai/hosting.json` manifest declares the D1 and R2 bindings used by the hosted application. Production migrations are generated with Drizzle and applied through the hosting workflow rather than at request time.

```bash
npm run db:generate
npm run db:migrate:local
```

Review generated SQL before publishing and do not rewrite migrations that have already been applied.

## Product direction

Folio is meant to feel like one coherent personal knowledge system, not a collection of disconnected note-taking screens. New features should strengthen capture, organization, retrieval, or connection without making the workspace harder to understand.
