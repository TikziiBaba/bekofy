// Hareket: süreler ve eğriler @bekofy/tokens'tan (masaüstü ve siteyle aynı). Reanimated'ın zamanlama ve yay
// animasyonları sistemdeki "animasyonları kaldır" ayarına varsayılan olarak uyar (ReduceMotion.System): ayar açıksa
// animasyon beklemeden son durumuna atlar.

import { dark } from '@bekofy/tokens';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Easing as RNEasing } from 'react-native';
import { Easing, FadeInDown, type WithSpringConfig } from 'react-native-reanimated';

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

/** Sekme geçişi (React Navigation, Animated tabanlı): aynı token süresi ve eğrisi. */
export const TAB_TRANSITION = {
  animation: 'timing' as const,
  config: { duration: DURATION.base, easing: RNEasing.bezier(...(dark.easing.standard as [number, number, number, number])) },
};

/** Dokunma geri bildirimi ve sürükleme bırakılınca yerine oturma: hızlı, hafif sekmeli. */
export const SPRING: WithSpringConfig = { damping: 20, stiffness: 260, mass: 0.8 };
/** Büyük yüzeyler (oynatıcı, alt sayfa): daha ağır, sekmesiz. */
export const SPRING_SHEET: WithSpringConfig = { damping: 28, stiffness: 240, mass: 1 };
/** Açılış: yüzey hedefini aşmadan yerine yumuşakça oturur (alttan boşluk görünmez). */
export const SPRING_OPEN: WithSpringConfig = { damping: 30, stiffness: 220, mass: 1, overshootClamping: true };

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

/** Liste ve kart girişi: kısa mesafeden yükselerek belirir; ilk sekiz öğe sırayla, sonrakiler beklemeden. */
export const enter = (index: number) =>
  anim(
    FadeInDown.delay(Math.min(index, 8) * 40)
      .duration(DURATION.moderate)
      .easing(EASE.emphasized)
      .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] }),
  );

/** Titreşim: cihaz desteklemiyorsa ya da kapalıysa sessizce geçer. */
export const haptic = {
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  select: () => void Haptics.selectionAsync().catch(() => undefined),
  heavy: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined),
};
