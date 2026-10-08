import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/text';
import { useAppTheme } from '../contexts/theme-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, HeartMinus, List, ListMusic, ListStart, Play, Search, User2 } from 'lucide-react-native';
import subsonicService from '../utils/subsonic';
import {
  SubsonicAlbum,
  SubsonicArtist,
  SubsonicSearchResult,
  SubsonicSong,
} from '../types/subsonic';
import { useAudioPlayer } from '../contexts/audio-player-context';
import { useNavigation } from '@react-navigation/native';
import { Station } from 'radio-browser-api';
import { useSubsonic } from '../contexts/subsonic-context';
import CommonAdvancedNavigator from '../components/common-advanced-navigator';
import GenreScreen from './genre';
import TouchableScale from '../components/touchable-scale';
import { useLibrary } from '../contexts/library-context';
import { usePlaylists } from '../contexts/playlists-context';
import { useFlyout } from '../components/flyout-menu';
import { useCarHomeSlots } from '../contexts/carhome-slots-context';
import { formatTags } from '../utils/format';
import { useFavourites } from '../contexts/favourites-context';
import { useCurations } from '../contexts/curations-context';

function useSearchScreenInternal() {
  const {
    theme: { colors },
  } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { loggedIn, subsonicEnabled } = useSubsonic();
  const [isLoading, setIsLoading] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const { playSong, play, queueNext } = useAudioPlayer();
  const [searchQuery, setSearchQuery] = useState('');
  const navigation = useNavigation();
  const [subsonicResults, setSubsonicResults] =
    useState<SubsonicSearchResult | null>(null);
  const [stationResults, setStationResults] = useState<Station[]>([]);
  const { isStarred, star, unstar } = useLibrary();
  const { addSongToPlaylist, playlists } = usePlaylists();
  const { openFlyout } = useFlyout();
  const { openSaveToSlotMenu } = useCarHomeSlots();
  const { isFavourite, toggleFavourite } = useFavourites();
  const { collections, addStationToCollection } = useCurations();

  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || query.trim().length < 3) return;

      setIsLoading(true);

      try {
        const promises: Promise<any>[] = [
          fetch(
            `https://sway.dablulite.dev/api/radio/search?name=${encodeURIComponent(
              query,
            )}&limit=20`,
          )
            .then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
            .catch(() => []),
        ];

        if (loggedIn && subsonicEnabled) {
          promises.push(subsonicService.search({ query, size: 20 }));
        }

        const [stations, subsonic] = await Promise.all(promises);

        setStationResults(stations || []);
        if (subsonic?.success) {
          setSubsonicResults(subsonic.data);
        } else {
          setSubsonicResults(null);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [loggedIn, subsonicEnabled],
  );

  useEffect(() => {
    if (searchQuery) {
      performSearch(searchQuery);
    }
  }, [performSearch, searchQuery]);

  useEffect(() => {
    if (subsonicEnabled && loggedIn) {
      subsonicService.getGenres().then(result => {
        if (result.success && result.data && Array.isArray(result.data)) {
          setGenres(result.data.map(g => g.value));
        }
      });
    }
  }, []);

  type SearchResultItem =
    | { type: 'album'; data: SubsonicAlbum }
    | { type: 'artist'; data: SubsonicArtist }
    | { type: 'song'; data: SubsonicSong }
    | { type: 'station'; data: Station };
  function buildResultsList(
    subsonicSearchResults: SubsonicSearchResult | null,
    stations: Station[],
  ): SearchResultItem[] {
    const items: SearchResultItem[] = [];

    if (subsonicSearchResults) {
      if (
        subsonicSearchResults.artist &&
        subsonicSearchResults.artist.length > 0
      ) {
        subsonicSearchResults.artist.forEach(a =>
          items.push({ type: 'artist', data: a }),
        );
      }
      if (
        subsonicSearchResults.album &&
        subsonicSearchResults.album.length > 0
      ) {
        subsonicSearchResults.album.forEach(a =>
          items.push({ type: 'album', data: a }),
        );
      }
      if (subsonicSearchResults.song && subsonicSearchResults.song.length > 0) {
        subsonicSearchResults.song.forEach(s =>
          items.push({ type: 'song', data: s }),
        );
      }
    }

    if (stations.length > 0) {
      stations.forEach(s => items.push({ type: 'station', data: s }));
    }

    return items;
  }

  const openAddToPlaylistMenu = useCallback((song: SubsonicSong) => {
    openFlyout({
      title: 'Add to playlist',
      subtitle: song.title,
      actions: playlists.length
        ? playlists.map(playlist => ({
            id: `playlist-${playlist.id}`,
            label: playlist.name,
            onPress: async () => {
              try {
                await addSongToPlaylist(playlist.id, song.id);
              } catch (err) {
                Alert.alert(
                  'Failed to add song',
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
  }, [addSongToPlaylist, openFlyout, playlists]);

  const openSongMenu = useCallback((song: SubsonicSong, index: number) => {
    const songIsStarred = isStarred(song.id, 'song');
    const coverUrl = subsonicService.getCoverArtUrl(song.coverArt);

    openFlyout({
      title: song.title,
      subtitle: song.album,
      coverUrl: coverUrl || undefined,
      actions: [
        {
          id: `play-${song.id}`,
          label: 'Play now',
          onPress: () => playSong([song], index),
          icon: Play
        },
        {
          id: `artist-${song.id}`,
          label: 'Go to artist',
          onPress: async () => {
            if (song.artists.length === 1) {
              navigation.navigate(
                ...([
                  'ArtistDetail',
                  {
                    artist: song.artists[0],
                    pageTitle: song.artists[0].name,
                  },
                ] as never),
              );
            } else if (song.artists.length > 1) {
              openFlyout({
                title: 'Artist',
                actions: song.artists.map(artist => ({
                  id: `artist-${artist.id}`,
                  label: artist.name,
                  onPress: () =>
                    navigation.navigate(
                      ...([
                        'ArtistDetail',
                        { artist, pageTitle: artist.name },
                      ] as never),
                    ),
                })),
              });
            }
          },
          icon: User2
        },
        {
          id: `next-${song.id}`,
          label: 'Play next',
          onPress: () => queueNext(song),
          icon: ListStart
        },
        {
          id: `fav-${song.id}`,
          label: songIsStarred ? 'Remove from favourites' : 'Add to favourites',
          onPress: async () => {
            if (songIsStarred) {
              await unstar({ id: song.id });
              return;
            }

            await star({ id: song.id });
          },
          icon: songIsStarred ? HeartMinus : Heart
        },
        {
          id: `playlist-${song.id}`,
          label: 'Add to playlist',
          onPress: () => openAddToPlaylistMenu(song),
          icon: ListMusic
        },
      ],
    });
  }, [isStarred, navigation, openAddToPlaylistMenu, openFlyout, playSong, queueNext, star, unstar]);

  const playAlbum = useCallback(async (album: SubsonicAlbum) => {
    try {
      const albumDetails = await subsonicService.getAlbum(album.id);
      const songs =
        (albumDetails.data as { song?: SubsonicSong[] } | undefined)?.song ??
        [];
      if (songs?.length) {
        playSong(songs, 0);
      }
    } catch (error) {
      console.warn('Failed to play album from card', error);
    }
  }, [playSong]);

  const queueAlbumNext = useCallback(async (album: SubsonicAlbum) => {
    const result = await subsonicService.getAlbum(album.id);
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to load album tracks');
    }

    const songs = (result.data as { song?: SubsonicSong[] }).song ?? [];
    if (!songs.length) {
      throw new Error('No tracks available in this album');
    }

    const orderedSongs = [...songs].reverse();
    orderedSongs.forEach(song => queueNext(song));
  }, [queueNext]);

  const openAlbumMenu = useCallback((album: SubsonicAlbum) => {
    const albumIsStarred = isStarred(album.id, 'album');

    openFlyout({
      title: album.name,
      subtitle: album.artist,
      coverUrl: subsonicService.getCoverArtUrl(album.id) || undefined,
      actions: [
        {
          id: `play-${album.id}`,
          label: 'Play album',
          onPress: async () => {
            try {
              await playAlbum(album);
            } catch (err) {
              Alert.alert(
                'Unable to play album',
                err instanceof Error ? err.message : 'Please try again.',
              );
            }
          },
          icon: Play
        },
        {
          id: `artist-${album.id}`,
          label: 'Go to artist',
          onPress: async () => {
            if (album.artists.length === 1) {
              navigation.navigate(
                ...([
                  'ArtistDetail',
                  {
                    artist: album.artists[0],
                    pageTitle: album.artists[0].name,
                  },
                ] as never),
              );
            } else if (album.artists.length > 1) {
              openFlyout({
                title: 'Artist',
                actions: album.artists.map(artist => ({
                  id: `artist-${artist.id}`,
                  label: artist.name,
                  onPress: () =>
                    navigation.navigate(
                      ...([
                        'ArtistDetail',
                        { artist, pageTitle: artist.name },
                      ] as never),
                    ),
                })),
              });
            }
          },
          icon: User2
        },
        {
          id: `queue-${album.id}`,
          label: 'Queue album next',
          onPress: async () => {
            try {
              await queueAlbumNext(album);
            } catch (err) {
              Alert.alert(
                'Unable to queue album',
                err instanceof Error ? err.message : 'Please try again.',
              );
            }
          },
          icon: ListStart
        },
        {
          id: `favourite-${album.id}`,
          label: albumIsStarred
            ? 'Remove from favourites'
            : 'Add to favourites',
          onPress: async () => {
            if (albumIsStarred) {
              await unstar({ albumId: album.id });
              return;
            }

            await star({ albumId: album.id });
          },
          icon: albumIsStarred ? HeartMinus : Heart
        },
        {
          id: `slot-${album.id}`,
          label: 'Save to speed dial',
          onPress: () => openSaveToSlotMenu({ type: 'album', album }),
          icon: List
        },
      ],
    });
  }, [isStarred, navigation, openFlyout, openSaveToSlotMenu, playAlbum, queueAlbumNext, star, unstar]);

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
  }, [addStationToCollection, collections, openFlyout]);

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
  }, [isFavourite, openAddToCurationMenu, openFlyout, openSaveToSlotMenu, play, toggleFavourite]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingTop: insets.top + 4,
          paddingBottom: insets.bottom + 64,
          paddingHorizontal: 16,
          gap: 16,
        },
        title: {
          fontSize: 12,
          fontWeight: '500',
          color: colors.text,
          opacity: 0.5,
          textTransform: 'uppercase',
        },
        input: {
          borderRadius: 64,
          paddingLeft: 48,
          borderWidth: 1,
          flex: 1,
          borderColor: colors.faint,
          backgroundColor: colors.secondLayerThin,
          color: colors.text,
          paddingHorizontal: 12,
          paddingVertical: 16,
        },
        searchItem: {
          borderRadius: 12,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        coverArt: {
          width: 64,
          height: 64,
          borderRadius: 12,
        },
      }),
    [colors, insets],
  );
  const renderItem2 = useCallback(({ item }: { item: string }) => (
    <TouchableScale
                        onPress={() => {
                          navigation.navigate(...["Genre", {
                            genre: item
                          }] as never)
                        }}
                        style={{
                          flex: 1,
                          marginRight: 6,
                          paddingHorizontal: 24,
                          paddingVertical: 32,
                          borderRadius: 12,
                          backgroundColor: colors.secondLayerThin,
                        }}
                      >
                        <Text style={{ color: colors.text, textAlign: "center" }}>{item}</Text>
                      </TouchableScale>
        ), [colors.secondLayerThin, colors.text, navigation]);

  const renderItem = useCallback(({ item }: { item: SearchResultItem, index: number }) => {
            switch (item.type) {
              case 'album':
                return (
                  <Pressable
                    onLongPress={() => openAlbumMenu(item.data)}
                    onPress={() => {
                      navigation.navigate(
                        ...([
                          'Album',
                          {
                            album: item.data,
                            pageTitle: item.data.name,
                          },
                        ] as never),
                      );
                    }}
                    android_ripple={{
                      color: colors.secondLayerThinActive,
                      borderless: false,
                    }}
                    style={styles.searchItem}
                  >
                    <Image
                    src={subsonicService.getCoverArtUrl(item.data.id, 64) || undefined}
                      style={[styles.coverArt, { backgroundColor: colors.secondLayerThin }]}
                    />
                    <View style={{ flexDirection: 'column', gap: 4 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: 'semibold',
                          fontSize: 16,
                        }}
                      >
                        {item.data.name}
                      </Text>
                      <Text
                        style={{ color: colors.textMuted, fontSize: 12 }}
                      >
                        Album by{' '}
                        {item.data.artists.map(a => a.name).join(', ')}
                      </Text>
                    </View>
                  </Pressable>
                );
              case 'artist':
                return (
                    <Pressable
                      onPress={() => {
                        navigation.navigate(
                          ...([
                            'ArtistDetail',
                            {
                              artist: item.data,
                              pageTitle: item.data.name,
                            },
                          ] as never),
                        );
                      }}
                      android_ripple={{
                        color: colors.secondLayerThinActive,
                        borderless: false,
                      }}
                      style={styles.searchItem}
                    >
                    <Image
                      src={subsonicService.getCoverArtUrl(item.data.id, 64) || undefined}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 64,
                          backgroundColor: colors.secondLayerThin,
                        }}
                      />
                      <View style={{ flexDirection: 'column', gap: 4 }}>
                        <Text
                          style={{
                            color: colors.text,
                            fontWeight: 'semibold',
                            fontSize: 16,
                          }}
                        >
                          {item.data.name}
                        </Text>
                      </View>
                    </Pressable>
                );
              case 'song':
                return (
                  <Pressable
                    onLongPress={() => openSongMenu(item.data, 0)}
                    onPress={() => playSong([item.data], 0)}
                    android_ripple={{
                      color: colors.secondLayerThinActive,
                      borderless: false,
                    }}
                    style={styles.searchItem}
                  >
                    <Image
                    src={subsonicService.getCoverArtUrl(item.data.id, 64) || undefined}
                      style={[styles.coverArt, { backgroundColor: colors.secondLayerThin }]}
                    />
                    <View style={{ flexDirection: 'column', gap: 4 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: 'semibold',
                          fontSize: 16,
                        }}
                      >
                        {item.data.title}
                      </Text>
                      <Text
                        style={{ color: colors.textMuted, fontSize: 12 }}
                      >
                        Track by{' '}
                        {item.data.artists.map(a => a.name).join(', ')}
                      </Text>
                    </View>
                  </Pressable>
                );
              case 'station':
                return (
                  <Pressable
                    onPress={() => play(item.data)}
                    onLongPress={() => openStationMenu(item.data)}
                    android_ripple={{
                      color: colors.secondLayerThinActive,
                      borderless: false,
                    }}
                    style={styles.searchItem}
                  >
                    <Image
                      source={{ uri: item.data.favicon || undefined }}
                      style={[styles.coverArt, { backgroundColor: colors.secondLayerThin }]}
                    />
                    <View style={{ flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: 'semibold',
                          fontSize: 16,
                          overflow: 'hidden',
                          minWidth: 0,
                        }}
                        numberOfLines={2}
                      >
                        {item.data.name}
                      </Text>
                      <Text
                        style={{ color: colors.textMuted, fontSize: 12 }}
                      >
                        {item.data.country}
                      </Text>
                    </View>
                  </Pressable>
                );
            }
          }, [colors.secondLayerThin, colors.secondLayerThinActive, colors.text, colors.textMuted, navigation, openAlbumMenu, openSongMenu, openStationMenu, play, playSong, styles.coverArt, styles.searchItem]);
  return (
    <View style={styles.container}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <Search
          size={20}
          color={colors.textMuted}
          style={{ position: 'absolute', left: 16 }}
        />
        <TextInput
          style={styles.input}
          placeholder="Search..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>
      {!searchQuery ? (
        <>
          {subsonicEnabled && loggedIn && <Text style={styles.title}>Genres</Text>}
          <FlatList
                data={genres}
                keyExtractor={(item, i) => item + i}
            numColumns={2}
            contentContainerStyle={{ gap: 8 }}
                renderItem={renderItem2}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
              />
        </>
      ) : (
        <FlatList
          refreshing={isLoading}
          style={{ marginHorizontal: -12 }}
          contentContainerStyle={{ paddingBottom: 160 }}
          data={buildResultsList(subsonicResults, stationResults)}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

function SearchScreen() {
  return (
    <CommonAdvancedNavigator
      screens={[
        {
          name: 'SearchInner',
          component: useSearchScreenInternal,
        },
        {
          name: 'Genre',
          component: GenreScreen,
          initialParams: {
            genre: 'Anime'
          }
        }
      ]}
    />
  );
}

export default SearchScreen;
