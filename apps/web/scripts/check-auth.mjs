// Oturumlu sayfaları geçici bir admin hesabıyla denetler (check.mjs --auth), sonunda hesabı siler.
// Kullanım: çalışan site varken  node apps/web/scripts/check-auth.mjs [--only=metin]

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const env = Object.fromEntries(readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const url = readFileSync(join(ROOT, 'packages/core/src/config.ts'), 'utf8').match(/SUPABASE_URL = '([^']+)'/)[1];
const sb = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const tag = randomBytes(3).toString('hex');
const email = `e2e-check-${tag}@bekofy.test`;
const password = `${randomBytes(12).toString('base64url')}9a`;
const created = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) throw new Error(created.error.message);
const id = created.data.user.id;
let status = 1;
try {
  const p = await sb.from('profiles').insert({ id, username: `e2e_check_${tag}`, role: 'admin' });
  if (p.error) throw new Error(p.error.message);
  const r = spawnSync(process.execPath, [join(ROOT, 'apps/web/scripts/check.mjs'), '--auth', ...process.argv.slice(2)], {
    env: { ...process.env, BEKOFY_CHECK_EMAIL: email, BEKOFY_CHECK_PASSWORD: password },
    stdio: 'inherit',
  });
  status = r.status ?? 1;
} finally {
  await sb.from('user_access_logs').delete().eq('user_id', id);
  await sb.from('profiles').delete().eq('id', id);
  const d = await sb.auth.admin.deleteUser(id);
  const left = ((await sb.auth.admin.listUsers({ perPage: 1000 })).data?.users ?? []).filter((u) => u.email === email).length;
  console.log(d.error || left ? `TEMİZLİK SORUNU: ${d.error?.message ?? 'hesap kaldı'}` : 'Geçici admin hesabı silindi.');
  process.exitCode = status;
}
