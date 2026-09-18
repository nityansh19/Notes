# Folio Backup and Recovery

Folio is a personal knowledge workspace, so user-created content should remain portable and recoverable.

## Backup goals

- Preserve note text and metadata.
- Preserve enough identifiers to rebuild relationships between notes.
- Keep exported data readable without requiring the original application.
- Avoid including secrets or unrelated local application state.

## Recovery principles

Imports should validate structure before replacing or merging existing data. Invalid records should be reported rather than silently discarded.

For destructive restore operations, create a clear boundary between current data and incoming backup data. The user should understand whether the action merges, replaces, or duplicates existing notes.

## Verification

After a restore, check note count, titles, body content, tags, links/relationships, timestamps, and search visibility.

## Development testing

Use synthetic notebooks with linked notes, duplicate titles, empty notes, long notes, tags, and special characters. Test both successful recovery and intentionally damaged backup files.
