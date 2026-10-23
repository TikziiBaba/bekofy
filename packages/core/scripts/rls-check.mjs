// Oturum açmış kullanıcı gözünden RLS güvenlik testi (canlı veritabanı).
// Service role ile iki geçici hesap açar (@bekofy.test, e-posta gönderilmez), yetkisiz işlemleri dener,
// sonunda hesapları ve oluşturduğu her şeyi siler. Kullanım: npm run test:rls -w @bekofy/core
// Gerekli: kökteki .env içinde SUPABASE_SERVICE_ROLE_KEY.

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../../../', import.meta.url);
const env = { ...process.env };
if (existsSync(new URL('.env', root))) {
  for (const line of readFileSync(new URL('.env', root), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const config = readFileSync(new URL('packages/core/src/config.ts', root), 'utf8');
const URL_ = config.match(/SUPABASE_URL = '([^']+)'/)[1];
const ANON = config.match(/SUPABASE_ANON_KEY = '([^']+)'/)[1];
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY boş; test çalıştırılamaz.');
  process.exit(1);
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, noSession);
const tag = randomBytes(4).toString('hex');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });
const created = { users: [], songs: [], playlists: [], jams: [], files: [] };

async function makeUser(label) {
  const email = `rls-${label}-${tag}@bekofy.test`;
  const password = randomBytes(18).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `rls_${label}_${tag}` } });
  if (error) throw new Error(`Test hesabı açılamadı: ${error.message}`);
  created.users.push(data.user.id);
  const client = createClient(URL_, ANON, noSession);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`Test hesabıyla giriş yapılamadı: ${signIn.error.message}`);
  return { id: data.user.id, sb: client };
}

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

try {
  const a = await makeUser('a');
  const b = await makeUser('b');

  // 1) Profil: kayıtta admin olunamaz, sonradan rol/premium/askı değiştirilemez, normal alanlar değişir.
  await a.sb.from('profiles').insert({ id: a.id, username: `rls_a_${tag}`, role: 'admin', is_premium: true });
  const prof = await a.sb.from('profiles').select('role, is_premium, is_banned').eq('id', a.id).single();
  check('kayıtta admin rolüyle profil açılamaz (rol "user" olur)', prof.data?.role === 'user' && prof.data?.is_premium === false, JSON.stringify(prof.data));
  await b.sb.from('profiles').insert({ id: b.id, username: `rls_b_${tag}` });
  for (const [field, value] of [['role', 'admin'], ['is_premium', true]]) {
    const res = await a.sb.from('profiles').update({ [field]: value }).eq('id', a.id).select();
    const after = await admin.from('profiles').select(field).eq('id', a.id).single();
    check(`kullanıcı kendi ${field} alanını değiştiremez`, res.error?.code === '42501' && after.data?.[field] !== value, res.error?.code ?? 'hata yok');
  }
  await admin.from('profiles').update({ is_banned: true }).eq('id', a.id);
  const unban = await a.sb.from('profiles').update({ is_banned: false }).eq('id', a.id).select();
  const banned = await admin.from('profiles').select('is_banned').eq('id', a.id).single();
  check('askıya alınan kullanıcı kendi askısını kaldıramaz', unban.error?.code === '42501' && banned.data?.is_banned === true, unban.error?.code ?? 'hata yok');
  await admin.from('profiles').update({ is_banned: false }).eq('id', a.id);
  const bio = await a.sb.from('profiles').update({ bio: 'test' }).eq('id', a.id).select('bio').single();
  check('kullanıcı kendi bio alanını değiştirebilir', bio.data?.bio === 'test', bio.error?.message ?? '');
  const other = await a.sb.from('profiles').update({ bio: 'ele geçirildi' }).eq('id', b.id).select();
  check('kullanıcı başkasının profilini değiştiremez', !other.error && other.data.length === 0);

  // 2) Çalma listeleri: düzenleyici yalnız düzenleyicisi olduğu listeye yazar; gizli liste sahibine ve düzenleyicisine görünür.
  const song = (await admin.from('songs').select('id').eq('status', 'approved').limit(2)).data;
  const mk = async (owner, name) => {
    const r = await owner.sb.from('playlists').insert({ user_id: owner.id, name: `${name} ${tag}`, is_public: false }).select('id').single();
    if (r.error) throw new Error(`Liste oluşturulamadı: ${r.error.message}`);
    created.playlists.push(r.data.id);
    return r.data.id;
  };
  const pa = await mk(a, 'rls A gizli');
  const pb = await mk(b, 'rls B ortak');
  const pc = await mk(b, 'rls B kapalı');
  const addCollab = await b.sb.from('playlist_collaborators').insert({ playlist_id: pb, user_id: a.id });
  check('liste sahibi düzenleyici ekleyebilir', !addCollab.error, addCollab.error?.message ?? '');
  const intoShared = await a.sb.from('playlist_songs').insert({ playlist_id: pb, song_id: song[0].id, position: 0 });
  check('düzenleyici kendi listesine şarkı ekleyebilir', !intoShared.error, intoShared.error?.message ?? '');
  const reorder = await a.sb.from('playlist_songs').upsert({ playlist_id: pb, song_id: song[0].id, position: 5 });
  check('düzenleyici sıralamayı değiştirebilir', !reorder.error, reorder.error?.message ?? '');
  const intoOther = await a.sb.from('playlist_songs').insert({ playlist_id: pc, song_id: song[1].id, position: 0 });
  check('düzenleyici, düzenleyicisi OLMADIĞI listeye yazamaz (eski hata)', intoOther.error?.code === '42501', intoOther.error?.code ?? 'yazdı');
  check('başkasının gizli listesi görünmez', ((await b.sb.from('playlists').select('id').eq('id', pa)).data ?? []).length === 0);
  check('düzenleyici gizli ortak listeyi görür (eskiden göremiyordu)', ((await a.sb.from('playlists').select('id').eq('id', pb)).data ?? []).length === 1);
  check('gizli listenin şarkıları yabancıya görünmez', ((await createClient(URL_, ANON, noSession).from('playlist_songs').select('song_id').eq('playlist_id', pb)).data ?? []).length === 0);

  // 3) Avatars: yalnız kendi klasörü, yalnız görsel.
  const up = (sb, path, body = PNG, contentType = 'image/png') => sb.storage.from('avatars').upload(path, body, { contentType, upsert: true });
  const own = await up(a.sb, `${a.id}/rls-${tag}.png`);
  if (!own.error) created.files.push(`${a.id}/rls-${tag}.png`);
  check('kendi klasörüne görsel yükleyebilir', !own.error, own.error?.message ?? '');
  const foreign = await up(a.sb, `${b.id}/rls-${tag}.png`);
  if (!foreign.error) created.files.push(`${b.id}/rls-${tag}.png`);
  check('başkasının klasörüne yükleyemez', Boolean(foreign.error), foreign.error?.message ?? 'yükledi');
  const rootFile = await up(a.sb, `rls-${tag}.png`);
  if (!rootFile.error) created.files.push(`rls-${tag}.png`);
  check('alanın köküne yükleyemez (admin dışı)', Boolean(rootFile.error), rootFile.error?.message ?? 'yükledi');
  const html = await up(a.sb, `${a.id}/rls-${tag}.html`, Buffer.from('<script>alert(1)</script>'), 'text/html');
  if (!html.error) created.files.push(`${a.id}/rls-${tag}.html`);
  check('görsel olmayan dosya yüklenemez', Boolean(html.error), html.error?.message ?? 'yükledi');

  // 4) Şarkılar: kullanıcı ekleyemez; sanatçı ekler ama "pending" girer.
  const asUser = await a.sb.from('songs').insert({ title: `rls ${tag}`, artist: 'rls', file_path: 'https://example.com/x.mp3' }).select('id');
  if (asUser.data?.[0]) created.songs.push(asUser.data[0].id);
  check('normal kullanıcı şarkı ekleyemez', asUser.error?.code === '42501', asUser.error?.code ?? 'ekledi');
  await admin.from('profiles').update({ role: 'artist' }).eq('id', b.id);
  const asArtist = await b.sb.from('songs').insert({ title: `rls ${tag}`, artist: 'rls', file_path: 'https://example.com/x.mp3', status: 'approved' }).select('id, status').single();
  if (asArtist.data) created.songs.push(asArtist.data.id);
  check('sanatçı yüklemesi onay bekler ("approved" istese de "pending")', asArtist.data?.status === 'pending', asArtist.error?.message ?? asArtist.data?.status);

  // 5) Jam: yabancı güncelleyemez/silemez; katılımcı günceller; yalnız sahibi bitirir.
  const jam = await a.sb.from('jam_sessions').insert({ code: tag.slice(0, 6).toUpperCase(), host_id: a.id }).select('id').single();
  if (jam.error) throw new Error(`Jam açılamadı: ${jam.error.message}`);
  created.jams.push(jam.data.id);
  const strangerUpdate = await b.sb.from('jam_sessions').update({ current_position: 99 }).eq('id', jam.data.id).select();
  check('katılımcı olmayan Jam durumunu değiştiremez', !strangerUpdate.error && strangerUpdate.data.length === 0);
  await b.sb.from('jam_participants').insert({ session_id: jam.data.id, user_id: b.id });
  const memberUpdate = await b.sb.from('jam_sessions').update({ current_position: 42 }).eq('id', jam.data.id).select('current_position');
  check('katılımcı Jam durumunu güncelleyebilir', memberUpdate.data?.[0]?.current_position === 42, memberUpdate.error?.message ?? '');
  const memberDelete = await b.sb.from('jam_sessions').delete().eq('id', jam.data.id).select();
  check('katılımcı Jam\'i bitiremez', !memberDelete.error && memberDelete.data.length === 0);
  const hostDelete = await a.sb.from('jam_sessions').delete().eq('id', jam.data.id).select();
  check('sahip Jam\'i bitirebilir', hostDelete.data?.length === 1, hostDelete.error?.message ?? '');

  // 6) Takip: kendini takip edemez, başkasını takip eder.
  const self = await a.sb.from('follows').insert({ follower_id: a.id, following_id: a.id });
  check('kendini takip edemez', self.error?.code === '42501', self.error?.code ?? 'ekledi');
  const fol = await a.sb.from('follows').insert({ follower_id: a.id, following_id: b.id });
  check('başkasını takip edebilir', !fol.error, fol.error?.message ?? '');
  const impersonate = await a.sb.from('follows').insert({ follower_id: b.id, following_id: a.id });
  check('başkası adına takip edemez', impersonate.error?.code === '42501', impersonate.error?.code ?? 'ekledi');
} catch (e) {
  check('test akışı', false, e.message);
} finally {
  // Temizlik: ne olursa olsun geçici hesaplar ve oluşturdukları silinir.
  const leftovers = [];
  if (created.files.length) {
    const r = await admin.storage.from('avatars').remove(created.files);
    if (r.error) leftovers.push(`dosyalar: ${r.error.message}`);
  }
  if (created.songs.length) await admin.from('songs').delete().in('id', created.songs);
  if (created.jams.length) await admin.from('jam_sessions').delete().in('id', created.jams);
  if (created.playlists.length) {
    await admin.from('playlist_songs').delete().in('playlist_id', created.playlists);
    await admin.from('playlist_collaborators').delete().in('playlist_id', created.playlists);
    await admin.from('playlists').delete().in('id', created.playlists);
  }
  if (created.users.length) {
    await admin.from('follows').delete().or(created.users.map((id) => `follower_id.eq.${id},following_id.eq.${id}`).join(','));
    await admin.from('jam_participants').delete().in('user_id', created.users);
    await admin.from('profiles').delete().in('id', created.users);
    for (const id of created.users) {
      const r = await admin.auth.admin.deleteUser(id);
      if (r.error) leftovers.push(`hesap ${id}: ${r.error.message}`);
    }
  }
  const remaining = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).in('id', created.users.length ? created.users : ['00000000-0000-0000-0000-000000000000']),
    admin.from('playlists').select('id', { count: 'exact', head: true }).ilike('name', `%${tag}%`),
    admin.from('songs').select('id', { count: 'exact', head: true }).ilike('title', `%${tag}%`),
  ]);
  const left = remaining.reduce((n, r) => n + (r.count ?? 0), 0);
  check('temizlik: geçici hesaplar ve verileri silindi', left === 0 && leftovers.length === 0, leftovers.join('; ') || `${left} kayıt kaldı`);

  for (const r of results) console.log(`${r.ok ? 'OK  ' : 'HATA'} ${r.name}${r.ok || !r.detail ? '' : ` -> ${r.detail}`}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} kontrol geçti.`);
  process.exitCode = failed ? 1 : 0;
}
