import { createJam, findJamByCode, formatJamCode, jamParticipants, joinJam } from '@bekofy/core';
import { Button, ConfirmDialog, Field, IconButton, Input, Notice, StatusPill } from '@bekofy/ui';
import { useQuery } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Avatar } from '../components/avatar';
import { PageTitle, Section } from '../components/blocks';
import { showToast } from '../components/toast';
import { enterJam, exitJam, useJam } from '../lib/jam';
import { usePlayer } from '../lib/player';
import { href } from '../lib/router';
import { useAuthed } from '../lib/session';

export function JamScreen() {
  const { sb, user } = useAuthed();
  const jam = useJam();
  const p = usePlayer();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'join' | 'exit' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const participants = useQuery({
    queryKey: ['jam-people', jam.session?.id],
    enabled: Boolean(jam.session),
    queryFn: () => jamParticipants(sb, jam.session!.id),
    refetchInterval: 10_000,
  });

  async function start() {
    setBusy('create');
    setError(null);
    try {
      await enterJam(sb, user.id, await createJam(sb, user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Jam başlatılamadı.');
    } finally {
      setBusy(null);
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    setCodeError(null);
    setError(null);
    setBusy('join');
    try {
      const session = await findJamByCode(sb, code);
      if (!session) {
        setCodeError('Bu kodla bir Jam bulunamadı. Kodu kontrol et: 6 karakter, örnek ABC-234.');
        document.getElementById('jam-code')?.focus();
        return;
      }
      await joinJam(sb, session.id, user.id);
      await enterJam(sb, user.id, session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Jam'e katılınamadı.");
    } finally {
      setBusy(null);
    }
  }

  if (!jam.session) {
    return (
      <div className="flex max-w-[calc(var(--size-layout-panel)*2.4)] flex-col gap-8">
        <PageTitle>Jam</PageTitle>
        <p className="max-w-(--size-layout-measure) text-fg-muted">Jam'de oturum sahibinin çaldığı şarkı, herkeste aynı anda ilerler. Başlat ve kodu paylaş ya da bir arkadaşının koduyla katıl.</p>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section aria-labelledby="jam-start" className="glass-panel flex flex-col items-start gap-4 rounded-ui-xl p-6">
            <h2 id="jam-start" className="type-title-md">
              Jam başlat
            </h2>
            <p className="text-fg-muted">Sen çalarsın, arkadaşların dinler.</p>
            <Button loading={busy === 'create'} onClick={start}>
              Jam başlat
            </Button>
          </section>
          <section aria-labelledby="jam-join" className="glass-panel flex flex-col gap-4 rounded-ui-xl p-6">
            <h2 id="jam-join" className="type-title-md">
              Koda katıl
            </h2>
            <form onSubmit={join} noValidate className="flex flex-col gap-4">
              <Field id="jam-code" label="Jam kodu" hint="Örnek: ABC-234" error={codeError}>
                {(f) => <Input {...f} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} className="type-mono uppercase" />}
              </Field>
              <Button type="submit" variant="secondary" loading={busy === 'join'} className="self-start">
                Katıl
              </Button>
            </form>
          </section>
        </div>
      </div>
    );
  }

  const pretty = formatJamCode(jam.session.code);
  return (
    <div className="flex flex-col gap-8">
      <PageTitle>Jam</PageTitle>
      <section aria-labelledby="jam-live" className="glass-panel flex flex-col gap-5 rounded-ui-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="jam-live" className="type-title-lg">
            {jam.isHost ? 'Jam’in açık' : 'Jam’e katıldın'}
          </h2>
          <StatusPill tone={jam.connected ? 'ok' : 'pending'}>{jam.connected ? 'Bağlı' : 'Bağlanıyor'}</StatusPill>
        </div>
        <p className="text-fg-muted">{jam.isHost ? 'Arkadaşların bu kodla katılır. Ne çalarsan herkeste aynı anda çalar.' : 'Oturum sahibinin çaldığı şarkı sende de çalar.'}</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-3 rounded-pill bg-fill py-2 ps-4 pe-2 type-mono text-(length:--font-size-xl) tracking-[0.08em]" aria-label={`Katılım kodu ${jam.session.code.split('').join(' ')}`}>
            {pretty}
            <IconButton
              size="sm"
              label="Kodu kopyala"
              onClick={() => void navigator.clipboard.writeText(pretty).then(() => showToast('Kod kopyalandı'), () => showToast('Kopyalanamadı'))}
            >
              <Copy aria-hidden="true" />
            </IconButton>
          </span>
        </div>
        {p.current ? (
          <p className="type-body-sm">
            Çalıyor: <strong>{p.current.title}</strong> · {p.current.artist}
          </p>
        ) : jam.isHost ? (
          <p className="type-body-sm text-fg-muted">
            Bir şarkı çal; Jam'dekiler de duyar. <a href={href({ name: 'search', q: '' })} className="text-accent-fg hover:underline">Şarkı ara</a>
          </p>
        ) : (
          <p className="type-body-sm text-fg-muted">Oturum sahibi henüz bir şey çalmıyor.</p>
        )}
      </section>

      <Section id="jam-people" title="Katılımcılar">
        <ul className="flex flex-wrap gap-4">
          {participants.data?.map((u) => (
            <li key={u.id} className="flex items-center gap-2 type-label-md">
              <Avatar src={u.avatar_url} name={u.username} className="size-(--size-control-md)" />
              <span className="flex flex-col">
                <span>{u.username ?? 'adsız'}</span>
                {u.id === jam.session?.host_id ? <small className="type-caption text-fg-muted">Oturum sahibi</small> : null}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <div>
        <Button variant={jam.isHost ? 'destructive' : 'secondary'} onClick={() => setConfirm(true)}>
          {jam.isHost ? "Jam'i bitir" : "Jam'den ayrıl"}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title={jam.isHost ? 'Jam bitirilsin mi?' : "Jam'den ayrılmak istiyor musun?"}
        description={jam.isHost ? 'Herkesin bağlantısı kesilir ve kod geçersiz olur.' : 'Müzik sende çalmaya devam eder ama artık eşitlenmez.'}
        confirmLabel={jam.isHost ? "Jam'i bitir" : 'Ayrıl'}
        tone={jam.isHost ? 'destructive' : 'primary'}
        busy={busy === 'exit'}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy('exit');
          await exitJam();
          setBusy(null);
          setConfirm(false);
        }}
      />
    </div>
  );
}
