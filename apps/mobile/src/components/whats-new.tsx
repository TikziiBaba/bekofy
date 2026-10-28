// Uygulama içi güncellemeyle gelen yenilikler, açılışta bir kez gösterilir. Son görülen kayıt cihazda saklanır.
// APK'nın kendi paketiyle açılışta (yeni kurulum ya da APK yükseltmesi) liste gösterilmeden görüldü sayılır.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import changelog from '@/lib/changelog.json';
import { useTheme } from '@/theme';
import { Sheet } from './sheet';
import { Button, T } from './ui';

type Entry = (typeof changelog)[number];

const KEY = 'bekofy-changelog';
const latest = Math.max(...changelog.map((e) => e.id));

async function pendingEntries(): Promise<Entry[]> {
  const seen = Number((await AsyncStorage.getItem(KEY)) ?? 0);
  if (Updates.isEmbeddedLaunch) {
    if (seen < latest) await AsyncStorage.setItem(KEY, String(latest));
    return [];
  }
  return changelog.filter((e) => e.id > seen).sort((a, b) => b.id - a.id);
}

export function WhatsNew() {
  const t = useTheme();
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    pendingEntries().then(setEntries, () => undefined);
  }, []);

  const close = () => {
    void AsyncStorage.setItem(KEY, String(latest)).catch(() => undefined);
    setEntries([]);
  };

  return (
    <Sheet open={entries.length > 0} onClose={close} title="Uygulama güncellendi">
      <View style={{ gap: t.space[4], paddingHorizontal: t.space[3], paddingTop: t.space[1] }}>
        {entries.map((e) => (
          <View key={e.id} style={{ gap: t.space[2] }}>
            {entries.length > 1 && (
              <T variant="labelMd" tone="tertiary">
                {new Date(e.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
              </T>
            )}
            {e.items.map((item) => (
              <View key={item} style={{ flexDirection: 'row', gap: t.space[3] }}>
                <View style={{ width: 6, height: 6, borderRadius: t.radius.full, marginTop: 8, backgroundColor: t.c.accent.default }} />
                <T tone="secondary" style={{ flex: 1 }}>
                  {item}
                </T>
              </View>
            ))}
          </View>
        ))}
        <Button label="Tamam" onPress={close} />
      </View>
    </Sheet>
  );
}
