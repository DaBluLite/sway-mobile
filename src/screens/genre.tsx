import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/text';
import { useAppTheme } from '../contexts/theme-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import subsonicService from '../utils/subsonic';
import {
  SubsonicAlbum,
  SubsonicArtist,
  SubsonicSong,
} from '../types/subsonic';
import { useAudioPlayer } from '../contexts/audio-player-context';
import { useNavigation } from '@react-navigation/native';
import { useSubsonic } from '../contexts/subsonic-context';
import { ChevronLeft, Heart, HeartMinus, ListMusic, ListStart, Play, User2 } from 'lucide-react-native';
import { useFlyout } from '../components/flyout-menu';
import { useLibrary } from '../contexts/library-context';
import { Alert } from '../components/custom-alert-api';
import { usePlaylists } from '../contexts/playlists-context';

function useGenreScreen({
  route: { params: { genre } }
}: {
  route: { params: { genre: string } }
}) {
  const {
    theme: { colors },
  } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { loggedIn, subsonicEnabled } = useSubsonic();
  const [isLoading, setIsLoading] = useState(false);
  const { playSong, queueNext } = useAudioPlayer();
  const { isStarred, star, unstar } = useLibrary();
  const { openFlyout } = useFlyout();
  const { addSongToPlaylist, playlists } = usePlaylists();
  const navigation = useNavigation();
  const [subsonicResults, setSubsonicResults] =
    useState<SubsonicSong[]>([]);

  const performSearch = useCallback(
    async () => {
      if (!subsonicEnabled || !loggedIn || !genre) return;

      setIsLoading(true);

      try {
        const res = await subsonicService.getSongsByGenre(genre)

        if (res?.length) {
          setSubsonicResults(res);
        } else {
          setSubsonicResults([]);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [genre, loggedIn, subsonicEnabled],
  );

  useEffect(() => {
    if (genre) {
      performSearch();
    }
  }, [performSearch, genre]);

  type SearchResultItem =
    | { type: 'album'; data: SubsonicAlbum }
    | { type: 'artist'; data: SubsonicArtist }
    | { type: 'song'; data: SubsonicSong };
  function buildResultsList(
    subsonicSearchResults: SubsonicSong[],
  ): SearchResultItem[] {
    const items: SearchResultItem[] = [];

    if (subsonicSearchResults) {
      subsonicSearchResults.forEach(s =>
        items.push({ type: 'song', data: s }),
      );
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
          flex: 1,
          minWidth: 0,
          fontSize: 32,
          fontWeight: '100',
          color: colors.text,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        },
        headerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        iconButton: {
          padding: 8,
          borderRadius: 64,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
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
  const renderItem = useCallback(({item}: { item: SearchResultItem; index: number }) => {
            switch (item.type) {
              case 'album':
                return (
                  <View
                    style={{
                      borderRadius: 12,
                      marginBottom: 4,
                      overflow: 'hidden',
                      paddingHorizontal: 16,
                    }}
                  >
                    <Pressable
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
                      style={{ borderRadius: 12, padding: 12 }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 12,
                          alignItems: 'center',
                        }}
                      >
                        <Image
                          source={{
                            uri:
                              subsonicService.getCoverArtUrl(item.data.id) ||
                              undefined,
                          }}
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 4,
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
                          <Text
                            style={{ color: colors.textMuted, fontSize: 12 }}
                          >
                            Album by{' '}
                            {item.data.artists.map(a => a.name).join(', ')}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  </View>
                );
              case 'artist':
                return (
                  <View
                    style={{
                      borderRadius: 12,
                      marginBottom: 4,
                      overflow: 'hidden',
                      paddingHorizontal: 16,
                    }}
                  >
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
                      style={{ borderRadius: 12, padding: 12 }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 12,
                          alignItems: 'center',
                        }}
                      >
                        <Image
                          source={{
                            uri:
                              subsonicService.getCoverArtUrl(item.data.id) ||
                              undefined,
                          }}
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
                      </View>
                    </Pressable>
                  </View>
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
            }
          }, [colors.secondLayerThin, colors.secondLayerThinActive, colors.text, colors.textMuted, navigation, playSong, subsonicResults]);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              navigation.goBack();
            }}
          >
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
        </View>
        <Text numberOfLines={1} style={styles.title}>
          {genre}
        </Text>
      </View>
      {genre && (
        <FlatList
          refreshing={isLoading}
          style={{ marginHorizontal: -12 }}
          contentContainerStyle={{ paddingBottom: 160 }}
          data={buildResultsList(subsonicResults)}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

export default useGenreScreen;
