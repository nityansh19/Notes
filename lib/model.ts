export type Item = {
  id: string;
  type: string;
  title: string;
  content: string;
  markdown: string;
  collection_id: string | null;
  project_id: string | null;
  metadata: Record<string, any>;
  pinned: number;
  favorite: number;
  status: string;
  created: string;
  updated: string;
  revision: number;
  tags: string[];
};
export type Collection = {
  id: string;
  name: string;
  color: string;
  position: number;
  pinned: number;
};
export type Attachment = {
  id: string;
  item_id: string | null;
  name: string;
  mime: string;
  size: number;
  created: string;
};
export type Vault = {
  items: Item[];
  collections: Collection[];
  files: Attachment[];
  activity: any[];
  settings: Record<string, any>;
  user: { name: string; email: string };
};
export const types = [
  'note',
  'quick',
  'journal',
  'checklist',
  'task',
  'bookmark',
  'code',
  'idea',
  'document',
  'project',
  'canvas',
] as const;
export const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
export function searchItems(
  items: Item[],
  query: string,
  collections: Collection[] = [],
) {
  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return items.filter((item) =>
    tokens.every((token) => {
      const [key, ...parts] = token.split(':');
      const value = parts.join(':').replaceAll('"', '').toLowerCase();
      if (value) {
        if (key === 'tag')
          return item.tags.some((t) => t.toLowerCase().includes(value));
        if (key === 'type') return item.type === value;
        if (key === 'collection')
          return collections.some(
            (c) =>
              c.id === item.collection_id &&
              c.name.toLowerCase().includes(value),
          );
        if (key === 'created')
          return value === 'today'
            ? new Date(item.created).toDateString() ===
                new Date().toDateString()
            : item.created.startsWith(value);
        if (key === 'before') return item.created.slice(0, 10) < value;
        if (key === 'after') return item.created.slice(0, 10) > value;
      }
      const hay = [
          item.title,
          item.markdown,
          JSON.stringify(item.metadata),
          ...item.tags,
        ]
          .join(' ')
          .toLowerCase(),
        needle = token.toLowerCase();
      if (hay.includes(needle)) return true;
      if (needle.length < 3) return false;
      let i = 0;
      for (const ch of hay) {
        if (ch === needle[i]) i++;
        if (i === needle.length) return true;
      }
      return false;
    }),
  );
}
