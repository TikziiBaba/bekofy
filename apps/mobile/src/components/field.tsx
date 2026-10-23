// Etiketli metin kutusu: etiket her zaman görünür, hata metni kutunun altında ve ekran okuyucuya okunur.

import { forwardRef, useState } from 'react';
import { TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme';
import { T } from './ui';

export const Field = forwardRef<TextInputInstance, TextInputProps & { label: string; error?: string | null; hint?: string }>(function Field({ label, error, hint, style, onFocus, onBlur, ...props }, ref) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error ? t.c.feedback.danger.text : focused ? t.c.focus : t.c.border.strong;
  return (
    <View style={{ gap: t.space['1-5'] }}>
      <T variant="labelMd">{label}</T>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={t.c.text.tertiary}
        selectionColor={t.c.accent.default}
        cursorColor={t.c.accent.text}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          t.type.bodyMd,
          {
            color: t.c.text.primary,
            minHeight: t.size.control.lg,
            paddingHorizontal: t.space[4],
            borderRadius: t.radius.control,
            borderWidth: focused || error ? t.size.border.strong : t.size.border.hairline,
            borderColor: border,
            backgroundColor: t.c.fill.subtle,
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <T variant="bodySm" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : hint ? (
        <T variant="bodySm" tone="secondary">
          {hint}
        </T>
      ) : null}
    </View>
  );
});
