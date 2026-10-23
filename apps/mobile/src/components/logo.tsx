import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { T } from './ui';

/** Bemol işareti (packages/brand/src/bekofy-mark.svg ile aynı yol). */
const MARK_PATH =
  'M25 14.5A6.5 6.5 0 0 1 38 14.5V85.5A6.5 6.5 0 0 1 25 85.5ZM31 48C55 34 84 42 76 64C71 79 50 88 31 92ZM38 60L38 78C48 75 62 70 65 63C68 54 52 50 38 60Z';

/** İşaret + "bekofy" yazısı; ekran okuyucuya "Bekofy" olarak okunur. */
export function Logo() {
  const t = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Bekofy" style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
      <Svg width={t.size.icon.lg} height={t.size.icon.lg} viewBox="0 0 100 100">
        <Path d={MARK_PATH} fill={t.c.logo} />
      </Svg>
      <T variant="titleLg" style={{ fontFamily: t.type.displayLg.fontFamily }}>
        bekofy
      </T>
    </View>
  );
}
