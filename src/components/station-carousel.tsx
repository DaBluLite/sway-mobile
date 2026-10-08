import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { ActivityIndicator, FlatList, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Text from './text';
import { useAppTheme } from '../contexts/theme-context';
import { Station } from 'radio-browser-api';
import { StationCard } from './station-card';
import { CarouselSkeleton } from './carousel-skeleton';

interface StationCarouselProps {
  title: string;
  fetchStations: (offset: number, limit: number) => Promise<Station[]>;
}

const BATCH_SIZE = 15;
const CARD_GAP = 12;
const VISIBLE_CARDS = 2.75;
const FALLBACK_CARD_WIDTH = 156;

export const StationCarousel: React.FC<StationCarouselProps> = ({
  title,
  fetchStations,
}) => {
  const {
    theme: { colors },
    resolvedTheme: currentTheme,
  } = useAppTheme();
  const [stations, setStations] = useState<Station[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const isLoadingRef = useRef(false);
  const offsetRef = useRef(0);
  const stationIdsRef = useRef(new Set<string>());
  const fetchStationsRef = useRef(fetchStations);

  const cardWidth = useMemo(() => {
    if (carouselWidth <= 0) {
      return FALLBACK_CARD_WIDTH;
    }

    return Math.floor(
      (carouselWidth - CARD_GAP * (VISIBLE_CARDS - 1)) / VISIBLE_CARDS,
    );
  }, [carouselWidth]);

  const snapInterval = cardWidth + CARD_GAP;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: {
          color:
            currentTheme === 'dark'
              ? 'rgba(255, 255, 255, 0.4)'
              : 'rgba(0, 0, 0, 0.4)',
          fontSize: 12, // text-xs
          fontWeight: '600', // font-semibold
          letterSpacing: 1.2, // tracking-widest (0.1em × 12px)
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
  );

  const handleCarouselLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && nextWidth !== carouselWidth) {
      setCarouselWidth(nextWidth);
    }
  };

  useEffect(() => {
    fetchStationsRef.current = fetchStations;
  }, [fetchStations]);

  const loadMoreAlbums = useCallback(async () => {
    if (isLoadingRef.current || !hasMore) return;

    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      const newStations = await fetchStationsRef.current(
        offsetRef.current,
        BATCH_SIZE,
      );

      if (!Array.isArray(newStations)) {
        return;
      }

      const uniqueStations = newStations.filter(station => {
        if (stationIdsRef.current.has(station.id)) {
          return false;
        }

        stationIdsRef.current.add(station.id);
        return true;
      });

      if (newStations.length < BATCH_SIZE || uniqueStations.length === 0) {
        setHasMore(false);
      }

      if (uniqueStations.length > 0) {
        setStations(prev => [...prev, ...uniqueStations]);
        offsetRef.current += newStations.length;
      }
    } catch (error) {
      console.error('Failed to load stations:', error);
    } finally {
      setHasInitialized(true);
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [hasMore]);

  useEffect(() => {
    if (!hasInitialized && !isLoadingRef.current) {
      loadMoreAlbums();
    }
  }, [hasInitialized, loadMoreAlbums]);

  const renderFooter = () => {
    if (!isLoading || stations.length === 0) {
      return null;
    }

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  };

  const renderItem = useCallback(
    ({ item }: { item: Station }) => (
      <View style={styles.itemWrap}>
        <StationCard station={item} width={cardWidth} />
      </View>
    ),
    [styles, cardWidth],
  );

  return (
    <View style={{ gap: 12 }}>
      {title && (
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      )}

      <View style={styles.carousel} onLayout={handleCarouselLayout}>
        {!hasInitialized && stations.length === 0 ? (
          <View style={styles.skeletonWrap}>
            <CarouselSkeleton cardWidth={cardWidth} />
          </View>
        ) : (
          <FlatList
            horizontal
            data={stations}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No stations available.</Text>
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
  );
};
