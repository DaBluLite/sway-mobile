import { ReactNode, useMemo } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { tailwindGradientToConfig } from '../utils/tailwind-gradient'

interface TailwindGradientViewProps {
  gradientClass: string
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

function TailwindGradientView({ gradientClass, style, children }: TailwindGradientViewProps) {
  const gradientConfig = useMemo(() => tailwindGradientToConfig(gradientClass), [gradientClass])

  return (
    <View style={[styles.container, style]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient
            id="tailwindGradient"
            x1={`${gradientConfig.start.x * 100}%`}
            y1={`${gradientConfig.start.y * 100}%`}
            x2={`${gradientConfig.end.x * 100}%`}
            y2={`${gradientConfig.end.y * 100}%`}
          >
            <Stop offset="0%" stopColor={gradientConfig.colors[0]} />
            <Stop offset="100%" stopColor={gradientConfig.colors[1]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tailwindGradient)" />
      </Svg>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
})

export default TailwindGradientView
