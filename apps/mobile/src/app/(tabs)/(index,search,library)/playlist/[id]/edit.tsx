// Liste düzenleme (yalnızca sahibi): kapak fotoğrafı, ad, açıklama, gizlilik, birlikte düzenleyenler, şarkı sırası,
// listeyi silme. Değişiklikler "Kaydet"e basınca birlikte yazılır; kaydetmeden çıkılırsa sorulur.

import {
  addCollaborator,
  deletePlaylist,
  getPlaylist,
  imageProblem,
  playlistCollaborators,
  playlistSongs,
  removeCollaborator,
  removeSongFromPlaylist,
  reorderPlaylist,
  searchProfiles,
  updatePlaylist,
  uploadPlaylistCover,
  type SongSummary,
} from '@bekofy/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { Camera, ImageOff, ImagePlus, Trash2, UserPlus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import { Loadable } from '@/components/blocks';
import { Cover } from '@/components/cover';
import { Field } from '@/components/field';
import { Ambient, Section } from '@/components/screen';
import { Sheet, SheetItem } from '@/components/sheet';
import { SortableSongs } from '@/components/sortable-songs';
import { Tappable } from '@/components/tappable';
import { Button, IconButton, Notice, T } from '@/components/ui';
import { keys } from '@/lib/data';
import { haptic } from '@/lib/motion';
import { useAuthed } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/theme';

const DESCRIPTION_MAX = 300;

type CoverChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'new'; uri: string; type: string; size: number };

export default function EditPlaylist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({
    queryKey: ['playlist-edit', id],
    gcTime: 0,
    queryFn: () => load(id),
  });
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.surface.page }}>
      <Ambient />
      <View style={{ paddingTop: insets.top + t.space[4], paddingHorizontal: t.space[4], flex: q.data ? 1 : undefined }}>
        <Loadable query={q} label="Liste">
          {(data) => <Editor {...data} />}
        </Loadable>
      </View>
    </View>
  );
}

function Editor({ list, songs, people }: Awaited<ReturnType<typeof load>>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const { user } = useAuthed();
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? '');
  const [isPublic, setPublic] = useState(list.is_public);
  const [cover, setCover] = useState<CoverChange>({ kind: 'keep' });
  const [order, setOrder] = useState<SongSummary[]>(songs);
  const [collabs, setCollabs] = useState(people);
  const [coverMenu, setCoverMenu] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [done, setDone] = useState<false | 'saved' | 'deleted'>(false);

  const coverUri = cover.kind === 'new' ? cover.uri : cover.kind === 'remove' ? null : (list.cover_url ?? songs[0]?.cover_url ?? null);
  const orderChanged = order.length !== songs.length || order.some((s, i) => s.id !== songs[i]?.id);
  const dirty = name.trim() !== list.name || description.trim() !== (list.description ?? '') || isPublic !== list.is_public || cover.kind !== 'keep' || orderChanged;

  // Kaydedilmemiş değişiklikle çıkılırsa sor (geri tuşu, geri hareketi, Vazgeç).
  usePreventRemove(dirty && !done, ({ data }) =>
    Alert.alert('Değişiklikler kaydedilmedi', 'Çıkarsan yaptığın değişiklikler kaybolur.', [
      { text: 'Düzenlemeye devam et', style: 'cancel' },
      { text: 'Kaydetmeden çık', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]),
  );

  // Kaydedildi ya da silindi: engel kalktıktan sonra çık.
  useEffect(() => {
    if (done === 'saved') router.back();
    if (done === 'deleted') router.dismissTo('/library');
  }, [done]);

  async function pickCover() {
    setCoverMenu(false);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const type = a.mimeType ?? 'image/jpeg';
    const size = a.fileSize ?? new File(a.uri).size ?? 0;
    const problem = imageProblem({ type, size });
    if (problem) return setError(problem);
    setError(null);
    setCover({ kind: 'new', uri: a.uri, type, size });
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Liste adı boş olamaz.');
      return;
    }
    setNameError(null);
    setError(null);
    setBusy(true);
    try {
      let cover_url = list.cover_url;
      if (cover.kind === 'new') cover_url = await uploadPlaylistCover(sb, user.id, list.id, { type: cover.type, size: cover.size, bytes: await new File(cover.uri).arrayBuffer() });
      if (cover.kind === 'remove') cover_url = null;
      await updatePlaylist(sb, list.id, { name: trimmed.slice(0, 100), description: description.trim().slice(0, DESCRIPTION_MAX) || null, is_public: isPublic, cover_url });
      for (const s of songs.filter((s) => !order.some((o) => o.id === s.id))) await removeSongFromPlaylist(sb, list.id, s.id);
      if (orderChanged && order.length) await reorderPlaylist(sb, list.id, order.map((s) => s.id));
      void qc.invalidateQueries({ queryKey: keys.playlist(list.id) });
      void qc.invalidateQueries({ queryKey: keys.playlists(user.id) });
      haptic.tap();
      showToast('Liste kaydedildi');
      setDone('saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi. Tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  const confirmDelete = () =>
    Alert.alert('Liste silinsin mi?', `${list.name} ve içindeki sıralama kalıcı olarak silinir. Şarkılar kütüphanede kalır.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Listeyi sil',
        style: 'destructive',
        onPress: () =>
          void deletePlaylist(sb, list.id).then(
            () => {
              void qc.invalidateQueries({ queryKey: keys.playlists(user.id) });
              showToast(`${list.name} silindi`);
              setDone('deleted');
            },
            (e: unknown) => setError(e instanceof Error ? e.message : 'Silinemedi.'),
          ),
      },
    ]);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -t.space[3] }}>
        <IconButton icon={X} label="Vazgeç" color={t.c.text.primary} onPress={() => router.back()} />
        <T variant="titleSm" accessibilityRole="header">
          Listeyi düzenle
        </T>
        <Button label="Kaydet" loading={busy} disabled={!dirty} onPress={() => void save()} style={{ minHeight: t.size.control.md, paddingHorizontal: t.space[4] }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: t.space[8], paddingTop: t.space[4], paddingBottom: insets.bottom + t.space[16] }}>
        {error ? <Notice tone="danger">{error}</Notice> : null}

        <Tappable accessibilityRole="button" accessibilityLabel="Kapak fotoğrafını değiştir" onPress={() => setCoverMenu(true)} scaleTo={0.97} style={{ alignSelf: 'center' }}>
          <Cover uri={coverUri} size={t.size.artwork.lg + t.space[6]} />
          <View style={{ position: 'absolute', right: t.space[2], bottom: t.space[2], flexDirection: 'row', alignItems: 'center', gap: t.space[1], paddingHorizontal: t.space[3], minHeight: t.size.control.sm, borderRadius: t.radius.full, backgroundColor: t.c.surface.inverse }}>
            <Camera color={t.c.text.inverse} size={t.size.icon.xs} />
            <T variant="labelSm" tone="inverse">
              Değiştir
            </T>
          </View>
        </Tappable>

        <View style={{ gap: t.space[5] }}>
          <Field label="Ad" value={name} onChangeText={setName} error={nameError} maxLength={100} returnKeyType="next" />
          <Field
            label="Açıklama"
            hint={`${description.length}/${DESCRIPTION_MAX}`}
            value={description}
            onChangeText={setDescription}
            maxLength={DESCRIPTION_MAX}
            multiline
            placeholder="Bu liste ne zaman dinlenir? Bir iki cümle yaz."
            style={{ minHeight: 96, paddingTop: t.space[3], textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[4] }}>
            <View style={{ flex: 1 }}>
              <T variant="labelMd">Herkese açık</T>
              <T variant="bodySm" tone="secondary">
                Açıksa profilinde görünür ve aramada bulunur.
              </T>
            </View>
            <Switch accessibilityLabel="Herkese açık" value={isPublic} onValueChange={setPublic} trackColor={{ false: t.c.fill.muted, true: t.c.accent.default }} thumbColor={t.c.text.primary} />
          </View>
        </View>

        <Section title="Birlikte düzenleyenler" action={<Button variant="ghost" icon={UserPlus} label="Kişi ekle" onPress={() => setInviting(true)} />}>
          {collabs.length ? (
            <View style={{ gap: t.space[1] }}>
              {collabs.map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
                  <Avatar uri={c.avatar_url} name={c.username} />
                  <T variant="labelMd" numberOfLines={1} style={{ flex: 1 }}>
                    @{c.username ?? 'adsız'}
                  </T>
                  <IconButton
                    icon={X}
                    label={`Düzenleyicilerden çıkar: ${c.username ?? 'adsız'}`}
                    onPress={() =>
                      void removeCollaborator(sb, list.id, c.id).then(
                        () => setCollabs((v) => v.filter((x) => x.id !== c.id)),
                        () => showToast('Çıkarılamadı. Tekrar dene.'),
                      )
                    }
                  />
                </View>
              ))}
            </View>
          ) : (
            <T variant="bodySm" tone="secondary">
              Eklediğin kişiler bu listeye şarkı ekleyip çıkarabilir. Liste onların kitaplığında "ortak" olarak görünür.
            </T>
          )}
        </Section>

        <Section title={`Şarkılar (${order.length})`}>
          {order.length ? (
            <>
              <T variant="bodySm" tone="secondary" style={{ marginTop: -t.space[2] }}>
                Sırayı değiştirmek için sağdaki tutamaktan sürükle.
              </T>
              <SortableSongs
                songs={order}
                onMove={(from, to) =>
                  setOrder((v) => {
                    const next = [...v];
                    const [moved] = next.splice(from, 1);
                    next.splice(to, 0, moved!);
                    return next;
                  })
                }
                onRemove={(index) => setOrder((v) => v.filter((_, i) => i !== index))}
              />
            </>
          ) : (
            <T variant="bodySm" tone="secondary">
              Listede şarkı yok.
            </T>
          )}
        </Section>

        <Button variant="destructive" icon={Trash2} label="Listeyi sil" onPress={confirmDelete} />
      </ScrollView>

      <Sheet open={coverMenu} onClose={() => setCoverMenu(false)} title="Kapak fotoğrafı">
        <SheetItem icon={ImagePlus} label="Galeriden seç" onPress={() => void pickCover()} />
        {coverUri && cover.kind !== 'remove' && (cover.kind === 'new' || list.cover_url) ? (
          <SheetItem
            icon={ImageOff}
            label="Kapağı kaldır"
            tone="danger"
            onPress={() => {
              setCoverMenu(false);
              setCover({ kind: 'remove' });
            }}
          />
        ) : null}
      </Sheet>

      <InviteSheet
        open={inviting}
        onClose={() => setInviting(false)}
        exclude={new Set([user.id, ...collabs.map((c) => c.id)])}
        onAdd={async (p) => {
          await addCollaborator(sb, list.id, p.id);
          setCollabs((v) => [...v, { ...p, added_at: new Date().toISOString() }]);
          showToast(`@${p.username} artık bu listeyi düzenleyebilir`);
        }}
      />
    </KeyboardAvoidingView>
  );
}

type Person = { id: string; username: string | null; avatar_url: string | null };

function InviteSheet({ open, onClose, exclude, onAdd }: { open: boolean; onClose: () => void; exclude: Set<string>; onAdd: (p: Person) => Promise<void> }) {
  const t = useTheme();
  const [term, setTerm] = useState('');
  const q = useQuery({
    queryKey: ['invite-search', term.trim()],
    enabled: open && term.trim().length >= 2,
    queryFn: () => searchProfiles(sb, term.trim(), { limit: 10 }),
  });
  const results = (q.data ?? []).filter((p) => !exclude.has(p.id));

  return (
    <Sheet open={open} onClose={onClose} title="Kişi ekle">
      <View style={{ paddingHorizontal: t.space[3], gap: t.space[3] }}>
        <TextInput
          value={term}
          onChangeText={setTerm}
          accessibilityLabel="Kullanıcı adı ara"
          placeholder="Kullanıcı adı"
          placeholderTextColor={t.c.text.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[t.type.bodyMd, { color: t.c.text.primary, minHeight: t.size.control.lg, paddingHorizontal: t.space[4], borderRadius: t.radius.control, borderWidth: t.size.border.hairline, borderColor: t.c.border.strong, backgroundColor: t.c.fill.subtle }]}
        />
        <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
          {term.trim().length < 2 ? (
            <T variant="bodySm" tone="secondary">
              En az iki harf yaz.
            </T>
          ) : q.isLoading ? (
            <T variant="bodySm" tone="secondary">
              Aranıyor
            </T>
          ) : results.length ? (
            results.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3], minHeight: t.size.control.xl }}>
                <Avatar uri={p.avatar_url} name={p.username} />
                <T variant="labelMd" numberOfLines={1} style={{ flex: 1 }}>
                  @{p.username}
                </T>
                <Button
                  variant="secondary"
                  label="Ekle"
                  accessibilityLabel={`Ekle: @${p.username}`}
                  onPress={() =>
                    void onAdd(p).then(
                      () => {
                        setTerm('');
                        onClose();
                      },
                      (e: unknown) => showToast(e instanceof Error ? e.message : 'Eklenemedi.'),
                    )
                  }
                />
              </View>
            ))
          ) : (
            <T variant="bodySm" tone="secondary">
              Bu adla kimse bulunamadı.
            </T>
          )}
        </ScrollView>
      </View>
    </Sheet>
  );
}

async function load(id: string) {
  const [list, songs, people] = await Promise.all([getPlaylist(sb, id), playlistSongs(sb, id), playlistCollaborators(sb, id)]);
  return { list, songs, people };
}
