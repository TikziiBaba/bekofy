// Hareket: süreler ve eğriler @bekofy/tokens'tan (masaüstü ve siteyle aynı). Reanimated'ın zamanlama ve yay
// animasyonları sistemdeki "animasyonları kaldır" ayarına varsayılan olarak uyar (ReduceMotion.System): ayar açıksa
// animasyon beklemeden son durumuna atlar.

import { dark } from '@bekofy/tokens';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';
import { Easing, type WithSpringConfig } from 'react-native-reanimated';

export const DURATION = dark.duration;

const bezier = (k: keyof typeof dark.easing) => {
  const [a, b, c, d] = dark.easing[k] as [number, number, number, number];
  return Easing.bezier(a, b, c, d);
};

export const EASE = {
  standard: bezier('standard'),
  enter: bezier('enter'),
  exit: bezier('exit'),
  emphasized: bezier('emphasized'),
};

/** Dokunma geri bildirimi ve sürükleme bırakılınca yerine oturma: hızlı, hafif sekmeli. */
export const SPRING: WithSpringConfig = { damping: 20, stiffness: 260, mass: 0.8 };
/** Büyük yüzeyler (oynatıcı, alt sayfa): daha ağır, sekmesiz. */
export const SPRING_SHEET: WithSpringConfig = { damping: 28, stiffness: 240, mass: 1 };

let reduced = false;
void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
  reduced = v;
});
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
  reduced = v;
});

/**
 * Giriş/çıkış (layout) animasyonu: sistemde hareket azaltılmışsa hiç bağlanmaz. Reanimated o durumda animasyonu
 * atlarken öğeyi görünmez bırakabiliyor (Android'de görüldü); bağlanmayınca öğe doğrudan son hâliyle çizilir.
 */
export const anim = <A>(a: A): A | undefined => (reduced ? undefined : a);

/** Titreşim: cihaz desteklemiyorsa ya da kapalıysa sessizce geçer. */
export const haptic = {
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  select: () => void Haptics.selectionAsync().catch(() => undefined),
  heavy: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined),
};
