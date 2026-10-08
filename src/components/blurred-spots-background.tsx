/* eslint-disable no-bitwise */
import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { useAppTheme } from '../contexts/theme-context';

type Spot = {
  id: string;
  cx: number;
  cy: number;
  r: number;
  color: string;
  opacity: number;
};

type BlurredSpotsBackgroundProps = {
  count?: number;
  colors?: string[];
  seed?: number;
  minRadius?: number;
  maxRadius?: number;
  style?: object;
  backgroundColor?: string;
};

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function BlurredSpotsBackground({
  count = 6,
  colors = ['#22c55e', '#4ade80', '#ffffff', '#16a34a'],
  seed,
  minRadius = 0.18,
  maxRadius = 0.38,
  style,
  backgroundColor,
}: BlurredSpotsBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const { theme: { colors: themeColors } } = useAppTheme();

  const spots = useMemo<Spot[]>(() => {
    const rand = seed !== undefined ? mulberry32(seed) : Math.random;
    const shortSide = Math.min(width, height);

    return Array.from({ length: count }).map((_, i) => {
      const r = shortSide * (minRadius + rand() * (maxRadius - minRadius));
      return {
        id: `spot-${seed ?? 'rand'}-${i}`,
        cx: rand() * width,
        cy: rand() * height,
        r,
        color: colors[Math.floor(rand() * colors.length)],
        opacity: 0.25 + rand() * 0.35, // 0.25 - 0.6
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, width, height, seed]);

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: backgroundColor ?? themeColors.background }, style]}
      pointerEvents="none"
    >
      <Svg width={width} height={height}>
        <Defs>
          {spots.map((spot) => (
            <RadialGradient
              key={`gradient-${spot.id}`}
              id={`grad-${spot.id}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              {/* Added a midpoint stop for a softer, more "Gaussian" falloff */}
              <Stop offset="0%" stopColor={spot.color} stopOpacity={spot.opacity} />
              <Stop offset="60%" stopColor={spot.color} stopOpacity={spot.opacity * 0.5} />
              <Stop offset="100%" stopColor={spot.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>

        {spots.map((spot) => (
          <Circle
            key={spot.id}
            cx={spot.cx}
            cy={spot.cy}
            r={spot.r}
            fill={`url(#grad-${spot.id})`}
          />
        ))}
      </Svg>
    </View>
  );
}
