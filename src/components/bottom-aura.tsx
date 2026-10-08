import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { AURA_PRESETS, AURA_SHADER, safeNumber, type AuraPreset } from './aura-shader';

const effect = (() => {
  const compiled = Skia.RuntimeEffect.Make(AURA_SHADER);
  if (!compiled) throw new Error('BottomAura: Skia could not compile the aurora shader.');
  return compiled;
})();

export type BottomAuraProps = {
  preset?: AuraPreset;
  intensity?: number;
  /** Bloom depth in React Native layout points. */
  spread?: number;
  speed?: number;
  radius?: number;
  paused?: boolean;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Place last inside the screen's outermost View, outside its SafeAreaView. */
export function BottomAura({ preset = 'flow', intensity, spread, speed, radius = 38, paused = false, enabled = true, style }: BottomAuraProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [reducedMotion, setReducedMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const elapsed = useSharedValue(0);
  const defaults = AURA_PRESETS[preset];
  const brightness = safeNumber(intensity ?? defaults.intensity, defaults.intensity, 0, 2);
  const depth = safeNumber(spread ?? defaults.spread, defaults.spread, 8, 140);
  const rate = safeNumber(speed ?? defaults.speed, defaults.speed, 0, 3);
  const corner = safeNumber(radius, 38, 0, 200);

  useEffect(() => {
    let mounted = true;
    let changed = false;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted && !changed) setReducedMotion(value); }).catch(() => {});
    const motionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { changed = true; setReducedMotion(value); });
    const appSubscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { mounted = false; motionSubscription.remove(); appSubscription.remove(); };
  }, []);

  const frame = useFrameCallback(info => {
    'worklet';
    elapsed.value += Math.min(info.timeSincePreviousFrame ?? 0, 64) / 1000 * rate;
  }, false);
  useEffect(() => {
    frame.setActive(enabled && foreground && !paused && !reducedMotion && rate > 0 && size.width > 0 && size.height > 0);
    return () => frame.setActive(false);
  }, [frame, enabled, foreground, paused, reducedMotion, rate, size.width, size.height]);

  const uniforms = useDerivedValue(() => ({
    resolution: [size.width, size.height], time: elapsed.value,
    intensity: brightness * (reducedMotion ? 0.65 : 1), spread: depth, radius: corner,
  }), [size.width, size.height, brightness, reducedMotion, depth, corner]);

  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[StyleSheet.absoluteFill, { zIndex: 100 }, style]}
    onLayout={({ nativeEvent }) => setSize({ width: nativeEvent.layout.width + 1, height: nativeEvent.layout.height })}>
    {enabled && size.width > 0 && size.height > 0 && <Canvas style={StyleSheet.absoluteFill}>
      <Fill><Shader source={effect} uniforms={uniforms} /></Fill>
    </Canvas>}
  </View>;
}
