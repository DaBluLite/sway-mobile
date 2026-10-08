import { useMemo } from 'react';
import { Pressable, PressableProps, StyleSheet, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TouchableScaleProps extends PressableProps {
  scale?: number;
  spring?: boolean;
  style?: ViewStyle | ViewStyle[];
}

function TouchableScale({
  children,
  style,
  scale = 0.95,
  spring = false,
  ...props
}: TouchableScaleProps) {
  const scaleValue = useSharedValue(1);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          transform: [{ scale: 1 }],
        },
      }),
    [],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  const animateIn = () => {
    scaleValue.value = spring
      ? withSpring(scale, { damping: 15, stiffness: 300 })
      : withTiming(scale, { duration: 100 });
  };

  const animateOut = () => {
    scaleValue.value = spring
      ? withSpring(1, { damping: 15, stiffness: 300 })
      : withTiming(1, { duration: 150 });
  };

  return (
    <AnimatedPressable
      {...props}
      style={[styles.base, animatedStyle, style]}
      onPressIn={event => {
        animateIn();
        props.onPressIn?.(event);
      }}
      onPressOut={event => {
        animateOut();
        props.onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

export default TouchableScale;
