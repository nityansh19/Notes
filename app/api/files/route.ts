import { database, bucket, identity, json, errorResponse } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const user = await identity(request, true),
      data = await request.formData(),
      file = data.get('file'),
      itemId = data.get('itemId');
    if (!(file instanceof File))
      return new Response('Choose a file.', { status: 400 });
    if (
      itemId &&
      !(await database()
        .prepare('SELECT id FROM items WHERE id=? AND owner=?')
        .bind(String(itemId), user.userId)
        .first())
    )
      return new Response('Note not found', { status: 404 });
    const id = crypto.randomUUID(),
      key = `${user.userId}/${id}`;
    await bucket().put(key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    });
    try {
      await database()
        .prepare(
          'INSERT INTO attachments(id,owner,item_id,name,mime,size,created) VALUES(?,?,?,?,?,?,?)',
        )
        .bind(
          id,
          user.userId,
          itemId || null,
          file.name,
          file.type || 'application/octet-stream',
          file.size,
          new Date().toISOString(),
        )
        .run();
    } catch (e) {
      await bucket().delete(key);
      throw e;
    }
    return json({
      id,
      name: file.name,
      mime: file.type,
      size: file.size,
      url: `/api/files?id=${id}`,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function GET(request: Request) {
  try {
    const user = await identity(request),
      id = new URL(request.url).searchParams.get('id'),
      meta = await database()
        .prepare('SELECT * FROM attachments WHERE id=? AND owner=?')
        .bind(id, user.userId)
        .first<any>();
    if (!meta) return new Response('Not found', { status: 404 });
    const file = await bucket().get(`${user.userId}/${id}`);
    if (!file) return new Response('Not found', { status: 404 });
    const safeInline = [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/avif',
    ].includes(meta.mime);
    return new Response(file.body, {
      headers: {
        'Content-Type': safeInline ? meta.mime : 'application/octet-stream',
        'Content-Disposition': `${safeInline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
