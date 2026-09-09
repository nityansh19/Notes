import { database, identity, json, errorResponse } from '@/lib/server';
import { types } from '@/lib/model';
export const dynamic = 'force-dynamic';
const unpack = (row: any) => ({
  ...row,
  metadata: JSON.parse(row.metadata || '{}'),
  tags: JSON.parse(row.tags || '[]'),
});
export async function GET(request: Request) {
  try {
    const user = await identity(request),
      db = database(),
      url = new URL(request.url),
      history = url.searchParams.get('history');
    if (history)
      return json({
        versions: (
          await db
            .prepare(
              'SELECT id,snapshot,created FROM versions WHERE item_id=? AND owner=? ORDER BY created DESC LIMIT 100',
            )
            .bind(history, user.userId)
            .all()
        ).results.map((v: any) => ({ ...v, snapshot: JSON.parse(v.snapshot) })),
      });
    const [items, collections, files, activity, prefs] = await Promise.all([
      db
        .prepare(
          `SELECT i.*,COALESCE((SELECT json_group_array(t.name) FROM item_tags it JOIN tags t ON t.id=it.tag_id WHERE it.item_id=i.id),'[]') AS tags FROM items i WHERE i.owner=? ORDER BY i.updated DESC`,
        )
        .bind(user.userId)
        .all(),
      db
        .prepare(
          'SELECT * FROM collections WHERE owner=? ORDER BY position,name',
        )
        .bind(user.userId)
        .all(),
      db
        .prepare(
          'SELECT * FROM attachments WHERE owner=? ORDER BY created DESC',
        )
        .bind(user.userId)
        .all(),
      db
        .prepare(
          'SELECT * FROM activity WHERE owner=? ORDER BY created DESC LIMIT 100',
        )
        .bind(user.userId)
        .all(),
      db
        .prepare('SELECT value FROM settings WHERE owner=?')
        .bind(user.userId)
        .first<{ value: string }>(),
    ]);
    return json({
      items: items.results.map(unpack),
      collections: collections.results,
      files: files.results,
      activity: activity.results,
      settings: JSON.parse(prefs?.value || '{}'),
      user: { name: user.fullName || 'Your workspace', email: user.email },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await identity(request, true),
      db = database(),
      body = (await request.json()) as any,
      owner = user.userId,
      now = new Date().toISOString();
    if (body.action === 'settings') {
      if (!body.value || typeof body.value !== 'object')
        return json({ error: 'Invalid settings' });
      await db
        .prepare(
          'INSERT INTO settings(owner,value) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET value=excluded.value',
        )
        .bind(owner, JSON.stringify(body.value))
        .run();
      return json({ ok: true });
    }
    if (body.action === 'collection') {
      const id = body.id || crypto.randomUUID();
      if (typeof body.name !== 'string' || !body.name.trim())
        return Response.json(
          { error: 'Give the collection a name.' },
          { status: 400 },
        );
      const old = await db
        .prepare('SELECT owner FROM collections WHERE id=?')
        .bind(id)
        .first<{ owner: string }>();
      if (old && old.owner !== owner)
        return new Response('Not found', { status: 404 });
      await db
        .prepare(
          'INSERT INTO collections(id,owner,name,color,position,pinned) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=excluded.color,position=excluded.position,pinned=excluded.pinned WHERE owner=excluded.owner',
        )
        .bind(
          id,
          owner,
          body.name.trim(),
          /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : '#638771',
          body.position || 0,
          body.pinned ? 1 : 0,
        )
        .run();
      return json({ id });
    }
    if (body.action === 'opened') {
      const item = await db
        .prepare('SELECT title FROM items WHERE id=? AND owner=?')
        .bind(body.id, owner)
        .first<{ title: string }>();
      if (item)
        await db
          .prepare(
            'INSERT INTO activity(id,owner,item_id,title,action,created) VALUES(?,?,?,?,?,?)',
          )
          .bind(crypto.randomUUID(), owner, body.id, item.title, 'opened', now)
          .run();
      return json({ ok: true });
    }
    if (body.action !== 'save')
      return new Response('Unknown action', { status: 400 });
    const item = body.item;
    if (
      !item ||
      !types.includes(item.type) ||
      typeof item.title !== 'string' ||
      typeof item.content !== 'string' ||
      typeof item.markdown !== 'string' ||
      !Array.isArray(item.tags)
    )
      return Response.json({ error: 'Invalid note.' }, { status: 400 });
    try {
      const doc = JSON.parse(item.content);
      if (doc.type !== 'doc') throw Error();
    } catch {
      return Response.json({ error: 'Invalid document.' }, { status: 400 });
    }
    const id = item.id || crypto.randomUUID();
    const previous = await db
      .prepare('SELECT * FROM items WHERE id=?')
      .bind(id)
      .first<any>();
    if (previous && previous.owner !== owner)
      return new Response('Not found', { status: 404 });
    if (previous && item.revision !== previous.revision)
      return Response.json(
        { error: 'This note changed in another tab. Reopen it before saving.' },
        { status: 409 },
      );
    for (const [field, table] of [
      ['collection_id', 'collections'],
      ['project_id', 'items'],
    ] as const) {
      if (
        item[field] &&
        !(await db
          .prepare(`SELECT id FROM ${table} WHERE id=? AND owner=?`)
          .bind(item[field], owner)
          .first())
      )
        return new Response('Related record not found', { status: 404 });
    }
    const previousTags = previous
      ? (
          await db
            .prepare(
              'SELECT t.name FROM tags t JOIN item_tags it ON it.tag_id=t.id WHERE it.item_id=?',
            )
            .bind(id)
            .all<{ name: string }>()
        ).results.map((t) => t.name)
      : [];
    const revision = (previous?.revision || 0) + 1;
    const queries = [];
    if (previous)
      queries.push(
        db
          .prepare(
            'INSERT INTO versions(id,item_id,owner,snapshot,created) VALUES(?,?,?,?,?)',
          )
          .bind(
            id + ':' + previous.revision,
            id,
            owner,
            JSON.stringify({ ...previous, tags: previousTags }),
            now,
          ),
      );
    queries.push(
      db
        .prepare(
          `INSERT INTO items(id,owner,type,title,content,markdown,collection_id,project_id,metadata,pinned,favorite,status,created,updated,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,title=excluded.title,content=excluded.content,markdown=excluded.markdown,collection_id=excluded.collection_id,project_id=excluded.project_id,metadata=excluded.metadata,pinned=excluded.pinned,favorite=excluded.favorite,status=excluded.status,updated=excluded.updated,revision=excluded.revision WHERE owner=excluded.owner`,
        )
        .bind(
          id,
          owner,
          item.type,
          item.title,
          item.content,
          item.markdown,
          item.collection_id || null,
          item.project_id || null,
          JSON.stringify(item.metadata || {}),
          item.pinned ? 1 : 0,
          item.favorite ? 1 : 0,
          ['active', 'archived', 'trash'].includes(item.status)
            ? item.status
            : 'active',
          previous?.created || now,
          now,
          revision,
        ),
    );
    queries.push(db.prepare('DELETE FROM item_tags WHERE item_id=?').bind(id));
    for (const name of [
      ...new Set<string>(
        item.tags
          .filter((t: any) => typeof t === 'string' && t.trim())
          .map((t: string) => t.trim()),
      ),
    ]) {
      const existing = await db
        .prepare('SELECT id FROM tags WHERE owner=? AND name=?')
        .bind(owner, name)
        .first<{ id: string }>();
      const tagId = existing?.id || crypto.randomUUID();
      if (!existing)
        queries.push(
          db
            .prepare('INSERT INTO tags(id,owner,name) VALUES(?,?,?)')
            .bind(tagId, owner, name),
        );
      queries.push(
        db
          .prepare('INSERT INTO item_tags(item_id,tag_id) VALUES(?,?)')
          .bind(id, tagId),
      );
    }
    queries.push(db.prepare('DELETE FROM links WHERE source=?').bind(id));
    for (const match of item.markdown.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const target = await db
        .prepare('SELECT id FROM items WHERE owner=? AND title=?')
        .bind(owner, match[1])
        .first<{ id: string }>();
      if (target)
        queries.push(
          db
            .prepare('INSERT OR IGNORE INTO links(source,target) VALUES(?,?)')
            .bind(id, target.id),
        );
    }
    queries.push(
      db
        .prepare(
          'INSERT INTO activity(id,owner,item_id,title,action,created) VALUES(?,?,?,?,?,?)',
        )
        .bind(
          crypto.randomUUID(),
          owner,
          id,
          item.title,
          previous ? 'edited' : 'created',
          now,
        ),
    );
    await db.batch(queries);
    return json({
      id,
      revision,
      updated: now,
      created: previous?.created || now,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const user = await identity(request, true),
      db = database(),
      { id } = (await request.json()) as { id: string };
    const item = await db
      .prepare('SELECT id FROM items WHERE id=? AND owner=? AND status=?')
      .bind(id, user.userId, 'trash')
      .first();
    if (!item) return new Response('Move to Trash first.', { status: 400 });
    await db.batch([
      db.prepare('DELETE FROM item_tags WHERE item_id=?').bind(id),
      db.prepare('DELETE FROM links WHERE source=? OR target=?').bind(id, id),
      db
        .prepare('DELETE FROM versions WHERE item_id=? AND owner=?')
        .bind(id, user.userId),
      db
        .prepare(
          'UPDATE attachments SET item_id=NULL WHERE item_id=? AND owner=?',
        )
        .bind(id, user.userId),
      db
        .prepare(
          'UPDATE items SET project_id=NULL WHERE project_id=? AND owner=?',
        )
        .bind(id, user.userId),
      db
        .prepare('DELETE FROM items WHERE id=? AND owner=?')
        .bind(id, user.userId),
    ]);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
