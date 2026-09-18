# Folio Search and Indexing

Search should help users retrieve knowledge quickly without changing or rewriting the source notes.

## Searchable content

At minimum, note titles and body text should be searchable. Tags, labels, or relationship metadata can be indexed when they improve retrieval and remain understandable to the user.

## Indexing rules

- Index normalized text while preserving the original note content.
- A saved edit should eventually replace stale search terms.
- Deleted notes must disappear from results.
- Empty or whitespace-only content should not create noisy index entries.
- Search failure must not damage stored notes.

## Ranking direction

Prefer clear deterministic signals first: exact title matches, title word matches, tag matches, then body-content matches. More advanced ranking can be layered on later.

## Testing

Include partial words, mixed case, punctuation, duplicate titles, large notes, recently edited notes, deleted notes, and zero-result queries.
