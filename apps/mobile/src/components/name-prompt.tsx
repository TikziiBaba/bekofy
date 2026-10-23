// Tek alanlı ad sorma penceresi (yeni liste, yeniden adlandır).

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { Field } from './field';
import { Button, T } from './ui';

export function NamePrompt({
  open,
  title,
  label,
  initial = '',
  confirmLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  initial?: string;
  confirmLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const t = useTheme();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(initial);
      setError(null);
    }
  }, [open, initial]);

  async function submit() {
    const name = value.trim();
    if (!name) return setError(`${label} boş olamaz.`);
    setBusy(true);
    try {
      await onSubmit(name.slice(0, 100));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi. Tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Vazgeç" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: t.c.scrim }]} />
        <View accessibilityViewIsModal style={{ width: '88%', maxWidth: 420, gap: t.space[5], padding: t.space[6], borderRadius: t.radius.xl, backgroundColor: t.c.surface.raised, borderColor: t.c.glass.edge, borderWidth: t.size.border.hairline }}>
          <T variant="titleMd" accessibilityRole="header">
            {title}
          </T>
          <Field label={label} value={value} onChangeText={setValue} error={error} autoFocus maxLength={100} returnKeyType="done" onSubmitEditing={() => void submit()} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: t.space[2], flexWrap: 'wrap' }}>
            <Button variant="ghost" label="Vazgeç" onPress={onClose} />
            <Button label={confirmLabel} loading={busy} onPress={() => void submit()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
