import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';
import { useBitPerfectCelebration } from '../contexts/bit-perfect-celebration-context';
import { useAppTheme } from '../contexts/theme-context';
import Text from './text';

export function BitPerfectLabel() {
  const { visible, progress } = useBitPerfectCelebration();
  const {
    theme: { colors },
  } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    height: 18 * progress.value,
    // Cancel the tab bar's gap when this row is fully collapsed.
    marginTop: -4 * (1 - progress.value),
    transform: [{ translateY: reducedMotion ? 0 : 8 * (1 - progress.value) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[styles.container, animatedStyle]}
    >
      <Text style={[styles.text, { color: colors.textMuted }]}>
        Bit-Perfect Mode
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
