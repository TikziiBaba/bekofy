// "Oluştur" menüsü (alt çubuktaki artı): çalma listesi, ortak liste, Jam ve çalan sırayı listeye kaydetme.

import { saveQueueAsPlaylist } from '@bekofy/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, ListMusic, Radio, Save, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { keys, useCreatePlaylist } from '@/lib/data';
import { usePlayer } from '@/lib/player';
import { routes } from '@/lib/routes';
import { useAuthed } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/theme';
import { NamePrompt } from './name-prompt';
import { Sheet } from './sheet';
import { Tappable } from './tappable';
import { T } from './ui';

type Kind = 'playlist' | 'shared' | 'queue';

function Option({ icon: Icon, title, description, onPress }: { icon: LucideIcon; title: string; description: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      scaleTo={0.98}
      android_ripple={{ color: t.c.state.pressed }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[4], padding: t.space[3], borderRadius: t.radius.lg, overflow: 'hidden' }}
    >
      <View style={{ width: t.size.artwork.sm, height: t.size.artwork.sm, borderRadius: t.radius.full, backgroundColor: t.c.fill.muted, alignItems: 'center', justifyContent: 'center' }}>
        <Icon color={t.c.text.primary} size={t.size.icon.md} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="labelMd">{title}</T>
        <T variant="bodySm" tone="secondary">
          {description}
        </T>
      </View>
      <ChevronRight color={t.c.text.secondary} size={t.size.icon.sm} />
    </Tappable>
  );
}

export function CreateMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuthed();
  const p = usePlayer();
  const qc = useQueryClient();
  const create = useCreatePlaylist();
  const [naming, setNaming] = useState<Kind | null>(null);
  const queue = p.items.slice(Math.max(p.index, 0));

  const ask = (kind: Kind) => {
    onClose();
    setNaming(kind);
  };

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Oluştur">
        <View style={{ gap: 2 }}>
          <Option icon={ListMusic} title="Çalma listesi" description="Sevdiğin şarkıları bir araya topla." onPress={() => ask('playlist')} />
          <Option icon={Users} title="Ortak çalma listesi" description="Arkadaşlarınla birlikte düzenle." onPress={() => ask('shared')} />
          <Option
            icon={Radio}
            title="Jam"
            description="Arkadaşlarınla aynı anda dinle."
            onPress={() => {
              onClose();
              router.push(routes.jam);
            }}
          />
          {queue.length > 1 ? <Option icon={Save} title="Sırayı listeye kaydet" description={`Çalan ve sıradaki ${queue.length} şarkıyı yeni bir liste yap.`} onPress={() => ask('queue')} /> : null}
        </View>
      </Sheet>
      <NamePrompt
        open={naming !== null}
        title={naming === 'shared' ? 'Yeni ortak liste' : naming === 'queue' ? 'Sırayı listeye kaydet' : 'Yeni çalma listesi'}
        label="Liste adı"
        initial={naming === 'queue' ? `Sıram, ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}` : ''}
        confirmLabel="Oluştur"
        onClose={() => setNaming(null)}
        onSubmit={async (name) => {
          const list = naming === 'queue' ? await saveQueueAsPlaylist(sb, user.id, name, queue.map((s) => s.id)) : await create.mutateAsync(name);
          void qc.invalidateQueries({ queryKey: keys.playlists(user.id) });
          showToast(`${name} oluşturuldu`);
          // Ortak liste: düzenleme ekranında birlikte düzenleyecek kişileri eklemeye hazır açılır.
          router.push(naming === 'shared' ? routes.playlistEdit(list.id) : routes.playlist(list.id));
          setNaming(null);
        }}
      />
    </>
  );
}
