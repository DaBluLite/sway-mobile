import { useMemo, useState, useCallback } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowDownUp, ArrowUpDown, Check, ChevronLeft, Search, X } from 'lucide-react-native';
import { useAudioPlayer } from '../contexts/audio-player-context';
import { useAppTheme } from '../contexts/theme-context';
import { FlyoutTrigger, useFlyout } from '../components/flyout-menu';
import { CuratedCollection, useCurations } from '../contexts/curations-context';
import { Station } from 'radio-browser-api';
import { useFavourites } from '../contexts/favourites-context';
import { useCarHomeSlots } from '../contexts/carhome-slots-context';
import TailwindGradientView from '../components/tailwind-gradient-view';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { formatCount } from '../utils/format';
import Blank from '../components/icons/blank';

function CurationScreen({
  route,
}: {
  route: { params: { curation: CuratedCollection; pageTitle: string } };
}) {
  const insets = useSafeAreaInsets();
  const {
    theme: { colors, shadows },
  } = useAppTheme();
  const { openFlyout } = useFlyout();
  const { toggleFavourite, isFavourite } = useFavourites();
  const navigation = useNavigation();
  const { collections, addStationToCollection } = useCurations();
  const { play, currentSongId } = useAudioPlayer();
  const { openSaveToSlotMenu } = useCarHomeSlots();

  const curationStations = route.params.curation.stations;
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'default' | 'name' | 'tags'>('default');
  const [sortDesc, setSortDesc] = useState(false);

  const visibleStations = useMemo(() => {
    let result = curationStations;

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        station =>
          station.name.toLowerCase().includes(query) ||
          station.tags.some(tag => tag.toLowerCase().includes(query)),
      );
    }

    if (sortMode !== 'default') {
      result = [...result].sort((a, b) => {
        const cmp =
          sortMode === 'name'
            ? a.name.localeCompare(b.name)
            : a.tags.join(', ').localeCompare(b.tags.join(', '));
        return sortDesc ? -cmp : cmp;
      });
    }

    return result;
  }, [curationStations, searchQuery, sortMode, sortDesc]);

  const openSortMenu = () => {
    const options = [
      { id: 'default', label: 'Default', enabled: sortMode === 'default' },
      { id: 'name', label: 'Name', enabled: sortMode === 'name' },
      { id: 'tags', label: 'Tags', enabled: sortMode === 'tags' },
    ];

    openFlyout({
      title: 'Sort stations',
      actions: [
        ...options.map(option => ({
          id: `sort-${option.id}`,
          label: option.label,
          onPress: () => {
            if (option.id === 'default') {
              setSortMode('default');
              setSortDesc(false);
            } else {
              setSortMode(option.id as Exclude<typeof sortMode, 'default'>);
              setSortDesc(false);
            }
          },
          icon: option.enabled ? Check : Blank,
        })),
        ...(sortMode !== 'default'
          ? [
              {
                id: 'sort-dir',
                label: sortDesc ? 'Ascending' : 'Descending',
                onPress: () => setSortDesc(prev => !prev),
                icon: ArrowDownUp,
              },
            ]
          : []),
      ],
    });
  };

  const openAddToCurationMenu = useCallback((station: Station) => {
    openFlyout({
      title: 'Add to curation',
      subtitle: station.name,
      actions: collections.length
        ? collections.map(collection => ({
            id: `collection-${collection.id}`,
            label: collection.name,
            onPress: async () => {
              try {
                await addStationToCollection(collection.id, station);
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
  }, [collections, addStationToCollection, openFlyout]);

  const openStationMenu = useCallback((station: Station) => {
    const stationIsStarred = isFavourite(station.id);

    openFlyout({
      title: station.name,
      subtitle: station.id,
      actions: [
        {
          id: `play-${station.id}`,
          label: 'Play',
          onPress: () => play(station),
        },
        {
          id: `fav-${station.id}`,
          label: stationIsStarred
            ? 'Remove from favourites'
            : 'Add to favourites',
          onPress: async () => {
            toggleFavourite(station);
          },
        },
        {
          id: `playlist-${station.id}`,
          label: 'Add to curation',
          onPress: () => openAddToCurationMenu(station),
        },
        {
          id: `slot-${station.id}`,
          label: 'Save to speed dial',
          onPress: () => openSaveToSlotMenu({ type: 'station', station }),
        },
      ],
    });
  }, [isFavourite, openFlyout, openAddToCurationMenu, play, toggleFavourite, openSaveToSlotMenu]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top + 8,
        },
        headerRow: {
          alignItems: 'center',
          flexDirection: 'row',
          marginBottom: 20,
          paddingHorizontal: 16,
        },
        backButton: {
          padding: 8,
          borderRadius: 64,
          marginRight: 8,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        headerButton: {
          padding: 8,
          borderRadius: 64,
          marginLeft: 8,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        searchRow: {
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
          borderRadius: 64,
          paddingHorizontal: 12,
        },
        searchInput: {
          flex: 1,
          color: colors.text,
          paddingVertical: 8,
          fontSize: 15,
          padding: 0,
        },
        title: {
          fontSize: 32,
          fontWeight: '300',
          color: colors.text,
          flexShrink: 1,
        },
        hero: {
          alignItems: 'center',
          marginBottom: 20,
        },
        coverWrap: {
          width: 220,
          height: 220,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: colors.card,
          marginBottom: 16,
          boxShadow: shadows.main,
          justifyContent: 'center',
          alignItems: 'center',
        },
        coverImage: {
          width: '100%',
          height: '100%',
        },
        coverIcon: {
          fontSize: 72,
          color: '#ffffff',
          textShadowColor: 'rgba(0,0,0,0.35)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 3,
          position: 'absolute',
        },
        albumTitle: {
          color: colors.text,
          fontSize: 28,
          fontWeight: '800',
          textAlign: 'center',
        },
        artistText: {
          color: colors.textMuted,
          fontSize: 15,
          marginTop: 6,
          textAlign: 'center',
        },
        metaText: {
          color: colors.textMuted,
          fontSize: 13,
          opacity: 0.8,
        },
        actionsRow: {
          flexDirection: 'row',
          gap: 12,
          marginTop: 14,
          width: '100%',
        },
        actionButton: {
          flex: 1,
          borderRadius: 999,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        playButton: {
          backgroundColor: '#16a34a',
        },
        shuffleButton: {
          backgroundColor: colors.secondLayerThin,
        },
        playButtonText: {
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: '700',
        },
        shuffleButtonText: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '700',
        },
        songsHeader: {
          color: colors.textMuted,
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 8,
          marginTop: 6,
          letterSpacing: 0.4,
        },
        trackRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 16,
          paddingRight: 8,
          paddingVertical: 8,
        },
        trackIndex: {
          width: 24,
          color: colors.textMuted,
          fontSize: 13,
        },
        trackTextWrap: {
          flex: 1,
          minWidth: 0,
        },
        trackTitle: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        trackSubtitle: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 3,
        },
        activeTrack: {
          color: colors.primary,
        },
        trackDuration: {
          color: colors.textMuted,
          fontSize: 12,
          marginLeft: 8,
        },
        listContent: {
          paddingBottom: insets.bottom + 160,
        },
      }),
    [colors, insets, shadows.main],
  );

  const renderItem = useCallback(({item, index}: any) => {
          const isActive = currentSongId === item.id;
          return (
            <Pressable
              onLongPress={() => openStationMenu(item)}
              android_ripple={{ color: colors.secondLayerThin }}
              onPress={() => play(item)}
              style={styles.trackRow}
            >
              <Text style={styles.trackIndex}>{index + 1}</Text>
              <View style={styles.trackTextWrap}>
                <Text
                  numberOfLines={1}
                  style={[styles.trackTitle, isActive && styles.activeTrack]}
                >
                  {item.name}
                </Text>
                <Text numberOfLines={1} style={styles.trackSubtitle}>
                  {item.tags.join(', ')}
                </Text>
              </View>
              <FlyoutTrigger onPress={() => openStationMenu(item)} />
            </Pressable>
          );
        }, [colors.secondLayerThin, currentSongId, openStationMenu, play, styles.activeTrack, styles.trackIndex, styles.trackRow, styles.trackSubtitle, styles.trackTextWrap, styles.trackTitle]);
  return (
    <View style={styles.container}>
      <View
        style={[
          {
            width: '100%',
            height: 160,
            maxWidth: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 0,
          },
        ]}
      >
        <TailwindGradientView
          gradientClass={route.params.curation.color}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
        <Svg
          height="100%"
          width="100%"
          style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
        >
          <Defs>
            <LinearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={colors.background} stopOpacity="0" />
              <Stop
                offset="100%"
                stopColor={colors.background}
                stopOpacity="1"
              />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#grad)" />
        </Svg>
      </View>

      <View style={styles.headerRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        {searchActive ? (
          <View style={styles.searchRow}>
            <Search size={18} color={colors.textMuted} />
            <TextInput
              autoFocus
              style={styles.searchInput}
              placeholder="Search stations..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            <Pressable
              onPress={() => {
                setSearchActive(false);
                setSearchQuery('');
              }}
              style={styles.headerButton}
              hitSlop={8}
            >
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text numberOfLines={1} style={styles.title}>
                {route.params.curation.icon || '🎵'} {route.params.pageTitle}
              </Text>
              <Text style={styles.metaText}>
                {formatCount(visibleStations.length, "station")}
              </Text>
            </View>
            <Pressable onPress={openSortMenu} style={styles.headerButton}>
              <ArrowUpDown size={20} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => setSearchActive(true)}
              style={styles.headerButton}
            >
              <Search size={20} color={colors.text} />
            </Pressable>
          </>
        )}
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        data={visibleStations}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.metaText}>
            No tracks available for this album.
          </Text>
        }
      />
    </View>
  );
}

export default CurationScreen;
