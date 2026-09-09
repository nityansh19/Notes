import assert from 'node:assert/strict';
const base = process.env.FOLIO_TEST_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw Error('Run against a local development vault only.');
const headers = {
  cookie: '__sites_local_auth=1',
  'content-type': 'application/json',
  origin: base,
};
async function call(body, expected = 200, method = 'POST') {
  const r = await fetch(base + '/api/vault', {
    method,
    headers,
    body: JSON.stringify(body),
  });
  assert.equal(r.status, expected, await r.clone().text());
  return expected === 200 ? r.json() : null;
}
assert.equal(
  (await fetch(base + '/api/vault')).status,
  401,
  'Anonymous reads must be rejected',
);
assert.equal(
  (
    await fetch(base + '/api/vault', {
      method: 'POST',
      headers: { ...headers, origin: 'https://foreign.example' },
      body: '{}',
    })
  ).status,
  403,
  'Cross-origin writes must be rejected',
);
const id = crypto.randomUUID(),
  now = new Date().toISOString();
const note = {
  id,
  type: 'note',
  title: 'API verification',
  content: JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Original thought' }],
      },
    ],
  }),
  markdown: 'Original thought',
  tags: ['verification'],
  metadata: {},
  pinned: 0,
  favorite: 0,
  status: 'active',
  created: now,
  updated: now,
  revision: 0,
};
let saved = await call({ action: 'save', item: note });
assert.equal(saved.revision, 1);
const first = { ...note, ...saved };
saved = await call({
  action: 'save',
  item: { ...first, title: 'Revised thought', tags: ['updated'] },
});
assert.equal(saved.revision, 2);
await call({ action: 'save', item: first }, 409);
const history = await (
  await fetch(base + `/api/vault?history=${id}`, { headers })
).json();
assert.equal(history.versions.length, 1);
assert.equal(history.versions[0].snapshot.title, 'API verification');
assert.deepEqual(history.versions[0].snapshot.tags, ['verification']);
const current = {
  ...first,
  ...saved,
  title: 'Revised thought',
  tags: ['updated'],
};
const race = await Promise.all([
  fetch(base + '/api/vault', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'save',
      item: { ...current, title: 'Concurrent A' },
    }),
  }),
  fetch(base + '/api/vault', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'save',
      item: { ...current, title: 'Concurrent B' },
    }),
  }),
]);
assert.deepEqual(
  race.map((r) => r.status).sort(),
  [200, 409],
  'Only one concurrent save may succeed',
);
const data = await (await fetch(base + '/api/vault', { headers })).json();
const latest = data.items.find((n) => n.id === id);
assert.equal(latest.revision, 3);
assert.deepEqual(latest.tags, ['updated']);
await call(
  { action: 'save', item: { ...latest, content: '<script>bad</script>' } },
  400,
);
await call({ id }, 400, 'DELETE');
const form = new FormData();
form.set(
  'file',
  new File(['private attachment'], 'verification.txt', { type: 'text/plain' }),
);
form.set('itemId', id);
const upload = await fetch(base + '/api/files', {
  method: 'POST',
  headers: { cookie: headers.cookie, origin: base },
  body: form,
});
assert.equal(upload.status, 200, await upload.clone().text());
const file = await upload.json();
assert.equal((await fetch(base + file.url)).status, 401);
const attachment = await fetch(base + file.url, { headers });
assert.equal(attachment.status, 200);
assert.equal(await attachment.text(), 'private attachment');
assert.match(attachment.headers.get('content-disposition'), /^attachment/);
saved = await call({ action: 'save', item: { ...latest, status: 'trash' } });
await call({ id }, 200, 'DELETE');
const after = await (await fetch(base + '/api/vault', { headers })).json();
assert.ok(!after.items.some((n) => n.id === id));
assert.equal(after.files.find((f) => f.id === file.id).item_id, null);
console.log(
  'PASS: authentication, origin checks, durable CRUD, tag history, stale and concurrent revisions, malformed input, attachment security, trash and permanent deletion.',
);
