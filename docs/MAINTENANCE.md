# Folio Maintenance Guide

## Database changes

- Update the Drizzle schema first.
- Generate a new migration instead of editing an applied migration.
- Review generated SQL before applying it.
- Test migrations against local project state before production deployment.

## Notes and attachments

- Keep ownership checks on every read and write path.
- Preserve version history behavior when changing note persistence.
- Keep attachment downloads authenticated and owner-scoped.
- Do not weaken MIME/type restrictions for convenience.

## Search and graph

- Re-test title, body, tag, collection, and date filters after search changes.
- Keep large-result rendering incremental.
- Preserve graph limits or add a replacement performance strategy before increasing them.

## UI changes

- Verify keyboard navigation and dialog behavior.
- Test light, dark, and system themes.
- Check editor content with long notes, tables, code blocks, and attachments.

## Before deployment

Run type checks, the production build, and the API smoke test against local development only. Review authentication, origin checks, file protection, and migration status before publishing.
