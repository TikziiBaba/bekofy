// Yılın özeti: hikaye kartları. Ekranın sol kenarına dokun geri, geri kalanına dokun ileri; düğmeler de var.

import { formatCount, yearSummary, type ListeningSummary } from '@bekofy/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, T } from '@/components/ui';
import { useAuthed } from '@/lib/session';
import { sb } from '@/lib/supabase';
import { useTheme } from '@/theme';

const PERSONA: Record<NonNullable<ListeningSummary['persona']>, [string, string]> = {
  'gece-kusu': ['Gece kuşu', 'Müziğin çoğunu gece yarısından sonra dinledin.'],
  sabahci: ['Sabahçı', 'Günün ilk saatleri senin müzik zamanın.'],
  gunduz: ['Gündüz dinleyicisi', 'Öğle ve ikindi saatlerinde müzik hep açık.'],
  aksamci: ['Akşamcı', 'Akşamları müzikle kapatıyorsun.'],
};

type Line = ['big' | 'displayLg' | 'titleXl' | 'titleSm' | 'bodyLg', string];
interface Story {
  inverse?: boolean;
  lines: Line[];
}

function storiesFor(s: ListeningSummary, year: number): Story[] {
  if (s.plays === 0) return [{ lines: [['titleXl', `${year} özetin henüz boş`], ['bodyLg', 'Şarkı dinledikçe burada yılın birikir.']] }];
  const song = s.topSongs[0];
  const artist = s.topArtists[0];
  return [
    { lines: [['bodyLg', `${year} yılında`], ['big', formatCount(s.totalMinutes)], ['bodyLg', 'dakika müzik dinledin.']] },
    ...(song ? [{ inverse: true, lines: [['bodyLg', 'En çok dinlediğin şarkı'], ['displayLg', song.title], ['bodyLg', `${song.plays} kez`]] as Line[] }] : []),
    ...(artist ? [{ lines: [['bodyLg', 'Yılın sanatçısı'], ['displayLg', artist.name], ['bodyLg', `${artist.minutes} dakika`]] as Line[] }] : []),
    ...(s.persona ? [{ inverse: true, lines: [['bodyLg', 'Dinleme kişiliğin'], ['displayLg', PERSONA[s.persona][0]], ['bodyLg', `${PERSONA[s.persona][1]} Dinlemelerinin %${s.personaShare}'i bu saatlerde.`]] as Line[] }] : []),
    { lines: [['bodyLg', 'En çok dinlediğin şarkılar'], ...s.topSongs.map((x, n) => ['titleSm', `${n + 1}. ${x.title}`] as Line)] },
  ];
}

export default function Wrapped() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthed();
  const year = new Date().getFullYear();
  const q = useQuery({ queryKey: ['wrapped', user.id, year], queryFn: () => yearSummary(sb, user.id, year) });
  const [i, setI] = useState(0);
  const close = () => router.back();

  const stories: Story[] = q.data ? storiesFor(q.data, year) : [{ lines: [['bodyLg', q.error ? 'Özet alınamadı. Daha sonra tekrar dene.' : 'Özetin hazırlanıyor']] }];
  const story = stories[Math.min(i, stories.length - 1)]!;
  // Nane zeminde metin accent.on, ters zeminde text.inverse: iki temada da kontrastlı.
  const fg = story.inverse ? t.c.text.inverse : t.c.accent.on;
  const last = i >= stories.length - 1;
  const go = (d: number) => setI((v) => Math.min(Math.max(v + d, 0), stories.length - 1));

  return (
    <View style={{ flex: 1, backgroundColor: story.inverse ? t.c.surface.inverse : t.c.accent.default, paddingTop: insets.top + t.space[2], paddingBottom: insets.bottom + t.space[4], paddingHorizontal: t.space[5], gap: t.space[4] }}>
      <View accessible={false} style={{ flexDirection: 'row', gap: t.space[1] }}>
        {stories.map((_, n) => (
          <View key={n} style={{ flex: 1, height: t.space[1], borderRadius: t.radius.full, backgroundColor: fg, opacity: n <= i ? 1 : 0.3 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T variant="labelMd" style={{ color: fg }}>{`Bekofy ${year}`}</T>
        <IconButton icon={X} label="Kapat" color={fg} onPress={close} />
      </View>
      <Pressable accessible={false} onPress={(e) => go(e.nativeEvent.locationX < 96 ? -1 : 1)} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View accessible accessibilityLiveRegion="polite" accessibilityLabel={story.lines.map((l) => l[1]).join('. ')} style={{ gap: t.space[3] }}>
          {story.lines.map(([v, text], n) => (
            <T key={n} variant={v === 'big' ? 'displayXl' : v} style={[{ color: fg }, v === 'big' && { fontSize: 72, lineHeight: 76 }]}>
              {text}
            </T>
          ))}
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.space[3] }}>
        <StoryButton label="Önceki" color={fg} disabled={i === 0} onPress={() => go(-1)} />
        <StoryButton label={last ? 'Bitir' : 'Sonraki'} color={fg} filled onPress={() => (last ? close() : go(1))} bg={story.inverse ? t.c.surface.inverse : t.c.accent.default} />
      </View>
    </View>
  );
}

/** Hikaye düğmesi: zeminin rengine göre çerçeveli ya da dolu (dolu olanın yazısı zemin rengindedir). */
function StoryButton({ label, color, onPress, disabled = false, filled = false, bg }: { label: string; color: string; onPress: () => void; disabled?: boolean; filled?: boolean; bg?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: t.size.touch + 4,
        justifyContent: 'center',
        paddingHorizontal: t.space[5],
        borderRadius: t.radius.full,
        borderWidth: t.size.border.hairline,
        borderColor: color,
        backgroundColor: filled ? color : 'transparent',
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <T variant="labelMd" style={{ color: filled ? bg : color }}>
        {label}
      </T>
    </Pressable>
  );
}
