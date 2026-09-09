import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd();
mkdirSync(resolve(root, 'work'), { recursive: true });
writeFileSync(
  resolve(root, 'work/wrangler-local.json'),
  JSON.stringify({
    name: 'folio-local',
    compatibility_date: '2026-05-15',
    d1_databases: [
      {
        binding: 'DB',
        database_name: 'site-creator-d1',
        database_id: '00000000-0000-4000-8000-000000000000',
        migrations_dir: '../drizzle',
      },
    ],
  }),
);
const cli = resolve(root, 'node_modules/wrangler/bin/wrangler.js');
const r = spawnSync(
  process.execPath,
  [
    cli,
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--config',
    'work/wrangler-local.json',
    '--persist-to',
    '.wrangler/state',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      WRANGLER_WRITE_LOGS: 'false',
    },
  },
);
process.exit(r.status || 0);
