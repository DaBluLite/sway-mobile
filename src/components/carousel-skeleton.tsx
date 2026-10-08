import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { useAppTheme } from '../contexts/theme-context'

const CARD_GAP = 12

interface CardSkeletonProps {
  width: number
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ width }) => {
  const {
    theme: { colors },
  } = useAppTheme()
  const opacity = useRef(new Animated.Value(0.5)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  return (
    <View style={[styles.card, { width }]}>
      <Animated.View
        style={[
          styles.imagePlaceholder,
          { backgroundColor: colors.secondLayerThin, opacity },
        ]}
      />
      <Animated.View
        style={[
          styles.linePlaceholder,
          {
            backgroundColor: colors.secondLayerThin,
            width: '78%',
            marginTop: 10,
            opacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.linePlaceholder,
          {
            backgroundColor: colors.secondLayerThin,
            width: '52%',
            marginTop: 6,
            opacity,
          },
        ]}
      />
    </View>
  )
}

interface CarouselSkeletonProps {
  cardWidth: number
  count?: number
}

export const CarouselSkeleton: React.FC<CarouselSkeletonProps> = ({
  cardWidth,
  count = 4,
}) => {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={index < count - 1 ? { marginRight: CARD_GAP } : undefined}
        >
          <CardSkeleton width={cardWidth} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingLeft: 20,
    paddingRight: CARD_GAP,
  },
  card: {
    gap: 0,
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  linePlaceholder: {
    height: 10,
    borderRadius: 6,
  },
})
