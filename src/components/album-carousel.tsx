import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { ActivityIndicator, FlatList, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Text from './text'
import { AlbumCard } from './album-card'
import { CarouselSkeleton } from './carousel-skeleton'
import { SubsonicAlbum } from '../types/subsonic'
import { useAppTheme } from '../contexts/theme-context'

type ExtendedAlbum = SubsonicAlbum & { title: string }

interface AlbumCarouselProps {
  title: string
  fetchAlbums: (offset: number, limit: number) => Promise<ExtendedAlbum[]>
}

const BATCH_SIZE = 15
const CARD_GAP = 12
const VISIBLE_CARDS = 2.75
const FALLBACK_CARD_WIDTH = 156

export const AlbumCarousel: React.FC<AlbumCarouselProps> = ({
  title,
  fetchAlbums,
}) => {
  const { theme: { colors }, resolvedTheme: currentTheme } = useAppTheme()
  const [albums, setAlbums] = useState<ExtendedAlbum[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [carouselWidth, setCarouselWidth] = useState(0)
  const isLoadingRef = useRef(false)
  const offsetRef = useRef(0)
  const albumIdsRef = useRef(new Set<string>())
  const fetchAlbumsRef = useRef(fetchAlbums)

  const cardWidth = useMemo(() => {
    if (carouselWidth <= 0) {
      return FALLBACK_CARD_WIDTH
    }

    return Math.floor(
      (carouselWidth - CARD_GAP * (VISIBLE_CARDS - 1)) / VISIBLE_CARDS,
    )
  }, [carouselWidth])

  const snapInterval = cardWidth + CARD_GAP

  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: {
          color:
            currentTheme === 'dark'
              ? 'rgba(255, 255, 255, 0.4)'
              : 'rgba(0, 0, 0, 0.4)',
          fontSize: 12,           // text-xs
          fontWeight: '600',      // font-semibold
          letterSpacing: 1.2,     // tracking-widest (0.1em × 12px)
          textTransform: 'uppercase',
        },
        expandButton: {
          padding: 4,
          borderRadius: 64,
        },
        carousel: {
          overflow: 'visible',
          marginHorizontal: -20,
        },
        listContent: {
          paddingRight: CARD_GAP,
          paddingLeft: 20,
        },
        itemWrap: {
          marginRight: CARD_GAP,
        },
        skeletonWrap: {
          minHeight: cardWidth + 28,
          justifyContent: 'center',
        },
        footerLoader: {
          width: 48,
          alignItems: 'center',
          justifyContent: 'center',
        },
        emptyText: {
          color: colors.text,
          opacity: 0.65,
          fontSize: 14,
        },
      }),
    [cardWidth, colors, currentTheme],
  )

  const handleCarouselLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width
    if (nextWidth > 0 && nextWidth !== carouselWidth) {
      setCarouselWidth(nextWidth)
    }
  }

  useEffect(() => {
    fetchAlbumsRef.current = fetchAlbums
  }, [fetchAlbums])

  const loadMoreAlbums = useCallback(async () => {
    if (isLoadingRef.current || !hasMore) return

    isLoadingRef.current = true
    setIsLoading(true)

    try {
      const newAlbums = await fetchAlbumsRef.current(offsetRef.current, BATCH_SIZE)

      if (!Array.isArray(newAlbums)) {
        return
      }

      const uniqueAlbums = newAlbums.filter(album => {
        if (albumIdsRef.current.has(album.id)) {
          return false
        }

        albumIdsRef.current.add(album.id)
        return true
      })

      if (newAlbums.length < BATCH_SIZE || uniqueAlbums.length === 0) {
        setHasMore(false)
      }

      if (uniqueAlbums.length > 0) {
        setAlbums(prev => [...prev, ...uniqueAlbums])
        offsetRef.current += newAlbums.length
      }
    } catch (error) {
      console.error('Failed to load albums:', error)
    } finally {
      setHasInitialized(true)
      setIsLoading(false)
      isLoadingRef.current = false
    }
  }, [hasMore])

  useEffect(() => {
    if (!hasInitialized && !isLoadingRef.current) {
      loadMoreAlbums()
    }
  }, [hasInitialized, loadMoreAlbums])

  const renderItem = useCallback(({ item }: { item: ExtendedAlbum }) => (
    <View style={styles.itemWrap}>
      <AlbumCard album={item} width={cardWidth} />
    </View>
  ), [styles, cardWidth])

  const renderFooter = () => {
    if (!isLoading || albums.length === 0) {
      return null
    }

  return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.text} />
      </View>
    )
  }

  return (
    <View style={{ gap: 12 }}>
      {title && (
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      )}

      <View style={styles.carousel} onLayout={handleCarouselLayout}>
        {!hasInitialized && albums.length === 0 ? (
          <View style={styles.skeletonWrap}>
            <CarouselSkeleton cardWidth={cardWidth} />
          </View>
        ) : (
          <FlatList
            horizontal
            data={albums}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No albums available.</Text>
            }
            contentContainerStyle={styles.listContent}
            showsHorizontalScrollIndicator={false}
            snapToInterval={snapInterval}
            snapToAlignment="start"
            decelerationRate="normal"
            onEndReached={loadMoreAlbums}
            onEndReachedThreshold={0.75}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            updateCellsBatchingPeriod={80}
            windowSize={5}
            removeClippedSubviews
          />
        )}
      </View>
    </View>
  )
}
