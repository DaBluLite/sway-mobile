import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from '../../components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from '../../contexts/audio-player-context';
import { useAppTheme } from '../../contexts/theme-context';
import { FlyoutTrigger, useFlyout } from '../../components/flyout-menu';
import { useFavourites } from '../../contexts/favourites-context';
import { useCarHomeSlots } from '../../contexts/carhome-slots-context';
import { Station } from 'radio-browser-api';
import { useCurations } from '../../contexts/curations-context';
import { ArrowDownUp, ArrowUpDown, Check, ChevronLeft, Heart, HeartMinus, List, ListMusic, Play, Search, X } from 'lucide-react-native';
import { formatCount, formatTags } from '../../utils/format';
import { useNavigation } from '@react-navigation/native';
import Blank from '../../components/icons/blank';

function StationsScreen() {
  const insets = useSafeAreaInsets();
  const {
    theme: { colors },
  } = useAppTheme();
  const { openFlyout } = useFlyout();
  const { favourites, toggleFavourite, isFavourite } = useFavourites();
  const { collections, addStationToCollection } = useCurations();
  const { play, currentStation } = useAudioPlayer();
  const { openSaveToSlotMenu } = useCarHomeSlots();
  const navigation = useNavigation();

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'default' | 'name' | 'tags'>('default');
  const [sortDesc, setSortDesc] = useState(false);

  const visibleStations = useMemo(() => {
    let result = favourites;

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
  }, [favourites, searchQuery, sortMode, sortDesc]);

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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: insets.top + 4,
          backgroundColor: colors.background,
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
        metaText: {
          color: colors.textMuted,
          fontSize: 13,
          opacity: 0.8,
        },
        title: {
          fontSize: 32,
          fontWeight: '300',
          color: colors.text,
          flexShrink: 1,
        },
        listContent: {
          paddingBottom: insets.bottom + 140,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 16,
          paddingRight: 8,
          paddingVertical: 8,
        },
        coverWrap: {
          width: 52,
          height: 52,
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: colors.secondLayerThin,
          alignItems: 'center',
          justifyContent: 'center',
        },
        coverImage: {
          width: '100%',
          height: '100%',
        },
        coverFallback: {
          color: colors.textMuted,
          fontSize: 14,
        },
        textWrap: {
          flex: 1,
          minWidth: 0,
        },
        trackTitle: {
          color: colors.text,
          fontSize: 15,
        },
        activeTitle: {
          color: colors.primary,
        },
        subtitle: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 3,
        },
        duration: {
          color: colors.textMuted,
          fontSize: 12,
          marginLeft: 8,
        },
        helperText: {
          color: colors.textMuted,
          fontSize: 14,
          textAlign: 'center',
          marginTop: 16,
        },
        errorText: {
          color: colors.notification,
          fontSize: 14,
          textAlign: 'center',
          marginTop: 16,
        },
      }),
    [colors, insets],
  );

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
  }, [openFlyout, collections, addStationToCollection]);

  const openStationMenu = useCallback((station: Station) => {
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
          onPress: () => openAddToCurationMenu(station),
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
  }, [openFlyout, play, isFavourite, toggleFavourite, openAddToCurationMenu, openSaveToSlotMenu]);

  const renderItem = useCallback(
    ({ item }: { item: Station }) => {
      const isActive = currentStation && currentStation.id === item.id;
      return (
        <Pressable android_ripple={{ color: colors.secondLayerThin }} onLongPress={() => openStationMenu(item)} onPress={() => play(item)} style={styles.row}>
          <View style={styles.coverWrap}>
            <Image source={{ uri: item.favicon }} style={styles.coverImage} />
          </View>
          <View style={styles.textWrap}>
            <Text numberOfLines={1} style={[styles.trackTitle, isActive && styles.activeTitle]}>
              {item.name}
            </Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {item.tags.map(tag => tag.slice(0, 1).toUpperCase() + tag.slice(1)).join(', ')}
            </Text>
          </View>
          <FlyoutTrigger onPress={() => openStationMenu(item)} />
        </Pressable>
      );
    },
    [colors.secondLayerThin, currentStation, openStationMenu, play, styles],
  );

  return (
    <View style={styles.container}>
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
                Stations
              </Text>
              <Text style={styles.metaText}>
                {formatCount(favourites.length, "station")}
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
        data={visibleStations}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.helperText}>No favourite stations yet.</Text>
        }
      />
    </View>
  );
}

export default StationsScreen;
