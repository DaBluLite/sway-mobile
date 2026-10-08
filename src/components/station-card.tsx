import { useMemo, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from './text'
import { useAudioPlayer } from '../contexts/audio-player-context'
import { Station } from 'radio-browser-api'
import { useFavourites } from '../contexts/favourites-context'
import { useHistory } from '../contexts/history-context'
import { useAppTheme } from '../contexts/theme-context'
import { useFlyout } from './flyout-menu'
import { useCarHomeSlots } from '../contexts/carhome-slots-context'
import { useCurations } from '../contexts/curations-context'
import { formatTags } from '../utils/format'
import { Radio } from 'lucide-react-native/icons'
import { Heart, HeartMinus, List, ListMusic, Play } from 'lucide-react-native'

interface StationCardProps {
  station: Station
  width: number
}

export const StationCard: React.FC<StationCardProps> = ({ station, width }: StationCardProps) => {
  const { theme: { colors } } = useAppTheme()
  const [faviconError, setFaviconError] = useState(false)
  const { isFavourite, toggleFavourite } = useFavourites()
  const { addToHistory } = useHistory()
  const { play } = useAudioPlayer()
  const { openSaveToSlotMenu } = useCarHomeSlots()
  const { openFlyout } = useFlyout()
  const { collections, addStationToCollection } = useCurations()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width,
        },
        imageContainer: {
          width: "100%",
          aspectRatio: 1,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: colors.secondLayerThin,
          position: 'relative',
        },
        image: {
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        },
        fallback: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        overlay: {
          position: 'absolute',
          right: 8,
          bottom: 8,
          left: 8,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
        },
        playButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        starButton: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
          marginTop: 10,
        },
        artists: {
          color: colors.text,
          opacity: 0.65,
          fontSize: 12,
          marginTop: 2,
        },
      }),
    [colors, width],
  )

  const openAddToCurationMenu = () => {
    openFlyout({
      title: 'Add to curation',
      subtitle: station.name,
      actions: collections.length
        ? collections.map(collection => ({
            id: `collection-${collection.id}`,
            label: collection.name,
            onPress: async () => {
              try {
                addStationToCollection(collection.id, station);
              } catch (err) {
                Alert.alert(
                  'Failed to add station',
                  err instanceof Error ? err.message : 'Please try again.',
                );
              }
            },
          }))
        : [
            {
              id: 'no-playlists',
              label: 'No playlists available',
              onPress: () => undefined,
              disabled: true,
            },
          ],
    });
  };

  const openStationMenu = () => {
    const songIsStarred = isFavourite(station.id);

    openFlyout({
      title: station.name,
      subtitle: formatTags(station.tags),
      coverUrl: station.favicon || undefined,
      actions: [
        {
          id: `play-${station.id}`,
          label: 'Play',
          onPress: () => play(station),
          icon: Play
        },
        {
          id: `fav-${station.id}`,
          label: songIsStarred ? 'Remove from favourites' : 'Add to favourites',
          onPress: async () => {
            toggleFavourite(station);
          },
          icon: songIsStarred ? HeartMinus : Heart
        },
        {
          id: `playlist-${station.id}`,
          label: 'Add to curation',
          onPress: openAddToCurationMenu,
          icon: ListMusic
        },
        {
          id: `slot-${station.id}`,
          label: 'Save to speed dial',
          onPress: () =>
            openSaveToSlotMenu({ type: 'station', station }),
          icon: List
        },
      ],
    });
  };

  return (
    <Pressable onPress={() => {
      play(station);
      addToHistory(station);
    }} style={styles.card} onLongPress={openStationMenu}>
      <View style={styles.imageContainer}>
        {!faviconError && station.favicon ? (
          <Image src={station.favicon} onError={() => setFaviconError(true)} style={styles.image} />
        ) : (
          <View style={styles.fallback}>
            <Radio size={48} color={colors.text} opacity={0.5} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {station.name}
      </Text>
      <Text numberOfLines={1} style={styles.artists}>
        {formatTags(station.tags || [])}
      </Text>
    </Pressable>
  )
}
