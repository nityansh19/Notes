import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull().default(''),
    markdown: text('markdown').notNull().default(''),
    collectionId: text('collection_id'),
    projectId: text('project_id'),
    metadata: text('metadata').notNull().default('{}'),
    pinned: integer('pinned').notNull().default(0),
    favorite: integer('favorite').notNull().default(0),
    status: text('status').notNull().default('active'),
    created: text('created').notNull(),
    updated: text('updated').notNull(),
    revision: integer('revision').notNull().default(1),
  },
  (t) => [
    index('idx_items_owner_status').on(t.owner, t.status),
    index('idx_items_owner_collection').on(t.owner, t.collectionId),
  ],
);
export const collections = sqliteTable(
  'collections',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    position: integer('position').notNull().default(0),
    pinned: integer('pinned').notNull().default(0),
  },
  (t) => [index('idx_collections_owner').on(t.owner)],
);
export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
  },
  (t) => [index('idx_tags_owner_name').on(t.owner, t.name)],
);
export const itemTags = sqliteTable(
  'item_tags',
  { itemId: text('item_id').notNull(), tagId: text('tag_id').notNull() },
  (t) => [primaryKey({ columns: [t.itemId, t.tagId] })],
);
export const links = sqliteTable(
  'links',
  { source: text('source').notNull(), target: text('target').notNull() },
  (t) => [primaryKey({ columns: [t.source, t.target] })],
);
export const versions = sqliteTable(
  'versions',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id').notNull(),
    owner: text('owner').notNull(),
    snapshot: text('snapshot').notNull(),
    created: text('created').notNull(),
  },
  (t) => [index('idx_versions_item_owner').on(t.itemId, t.owner)],
);
export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    itemId: text('item_id'),
    name: text('name').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    created: text('created').notNull(),
  },
  (t) => [index('idx_attachments_owner').on(t.owner)],
);
export const activity = sqliteTable(
  'activity',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    itemId: text('item_id'),
    title: text('title').notNull(),
    action: text('action').notNull(),
    created: text('created').notNull(),
  },
  (t) => [index('idx_activity_owner_created').on(t.owner, t.created)],
);
export const settings = sqliteTable('settings', {
  owner: text('owner').primaryKey(),
  value: text('value').notNull().default('{}'),
});
