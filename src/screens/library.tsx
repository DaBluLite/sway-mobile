/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-catch-shadow */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/text';
import {
  Cog,
  Disc3,
  Heart,
  HeartMinus,
  List,
  ListMusic,
  ListPlus,
  ListStart,
  MicVocal,
  Play,
  Plus,
  Sparkles,
  Upload,
  User2,
} from 'lucide-react-native';
import { useSubsonic } from '../contexts/subsonic-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../contexts/theme-context';
import { useNavigation } from '@react-navigation/native';
import CommonAdvancedNavigator from '../components/common-advanced-navigator';
import TracksScreen from './library/tracks';
import AlbumsScreen from './library/albums';
import ArtistsScreen from './library/artists';
import PlaylistsScreen from './library/playlists';
import StationsScreen from './library/stations';
import CurationsScreen from './library/curations';
import CreatePlaylistScreen from './library/create-playlist';
import CreateCurationScreen from './library/create-curation';
import UploadSongsScreen from './library/upload-songs';
import { useLibrary } from '../contexts/library-context';
import { usePlaylists } from '../contexts/playlists-context';
import subsonicService from '../utils/subsonic';
import {
  SubsonicAlbum,
  SubsonicArtist,
  SubsonicPlaylist,
  SubsonicSong,
} from '../types/subsonic';
import { useFavourites } from '../contexts/favourites-context';
import { Radio } from 'lucide-react-native/icons';
import { CuratedCollection, useCurations } from '../contexts/curations-context';
import { useFlyout } from '../components/flyout-menu';
import { getItem, setItem, STORES } from '../utils/storage';
import { formatCount } from '../utils/format';
import TailwindGradientView from '../components/tailwind-gradient-view';
import { Alert } from '../components/custom-alert-api';
import { useAudioPlayer } from '../contexts/audio-player-context';
import { useCarHomeSlots } from '../contexts/carhome-slots-context';

const LIBRARY_RECENTS_KEY = 'library-recents-ids';

type LibraryFilter = 'all' | 'artists' | 'playlists' | 'albums' | 'curations';

const LIBRARY_FILTERS: { key: LibraryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'artists', label: 'Artists' },
  { key: 'playlists', label: 'Playlists' },
  { key: 'albums', label: 'Albums' },
  { key: 'curations', label: 'Curations' },
];

type LibraryListItem =
  | { id: 'liked-tracks'; type: 'liked-tracks'; trackCount: number }
  | { id: 'liked-stations'; type: 'liked-stations'; stationCount: number }
  | { id: string; type: 'playlist'; playlist: SubsonicPlaylist }
  | { id: string; type: 'artist'; artist: SubsonicArtist }
  | { id: string; type: 'album'; album: SubsonicAlbum }
  | { id: string; type: 'curation'; curation: CuratedCollection };

function LibraryScreenInternal() {
  const {
    theme: { colors },
  } = useAppTheme();
  const { subsonicEnabled } = useSubsonic();
  const { starred, loading, error, refreshStarred, isStarred, unstar, star } = useLibrary();
  const {
    playlists,
    createPlaylist,
    loading: playlistsLoading,
    refreshPlaylists,
  } = usePlaylists();
  const { favourites } = useFavourites();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { collections } = useCurations();
  const { openFlyout } = useFlyout();
  const { queueNext, playSong } = useAudioPlayer();
  const { openSaveToSlotMenu } = useCarHomeSlots();

  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<LibraryFilter>('all');

  const queueAlbumNext = useCallback(async (albumId: string) => {
    const result = await subsonicService.getAlbum(albumId);
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

  const handlePlayAlbum = useCallback(async (albumId: string) => {
    try {
      const albumDetails = await subsonicService.getAlbum(albumId);
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
              await handlePlayAlbum(album.id);
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
              await queueAlbumNext(album.id);
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
  }, [handlePlayAlbum, isStarred, navigation, openFlyout, openSaveToSlotMenu, queueAlbumNext, star, unstar]);

  useEffect(() => {
    const storedRecentIds =
      getItem<string[]>(STORES.SETTINGS, LIBRARY_RECENTS_KEY) ?? [];
    setRecentIds(storedRecentIds);
  }, []);

  const libraryItems = useMemo<LibraryListItem[]>(() => {
    const tracks = starred?.song ?? [];
    const artists = starred?.artist ?? [];
    const albums = starred?.album ?? [];

    const unsorted = [
      subsonicEnabled ? {
        id: 'liked-tracks',
        type: 'liked-tracks',
        trackCount: tracks.length,
      } : null,
      {
        id: 'liked-stations',
        type: 'liked-stations',
        stationCount: favourites.length,
      },
      ...playlists.map(playlist => ({
        id: `playlist-${playlist.id}`,
        type: 'playlist' as const,
        playlist,
      })),
      ...artists.map(artist => ({
        id: `artist-${artist.id}`,
        type: 'artist' as const,
        artist,
      })),
      ...albums.map(album => ({
        id: `album-${album.id}`,
        type: 'album' as const,
        album,
      })),
      ...collections.map(curation => ({
        id: `curation-${curation.id}`,
        type: 'curation' as const,
        curation
      }))
    ].filter(Boolean) as LibraryListItem[];

    const recencyIndex = new Map<string, number>();
    recentIds.forEach((id, index) => {
      recencyIndex.set(id, index);
    });

    return [...unsorted].sort((a, b) => {
      const aIndex = recencyIndex.get(a.id);
      const bIndex = recencyIndex.get(b.id);

      if (aIndex === undefined && bIndex === undefined) return 0;
      if (aIndex === undefined) return 1;
      if (bIndex === undefined) return -1;
      return aIndex - bIndex;
    });
  }, [playlists, starred, subsonicEnabled, favourites, collections, recentIds]);

  const filteredItems = useMemo<LibraryListItem[]>(() => {
    if (filter === 'all') return libraryItems;

    return libraryItems.filter(item => {
      switch (filter) {
        case 'artists':
          return item.type === 'artist';
        case 'playlists':
          return item.type === 'playlist' || item.type === 'liked-tracks';
        case 'albums':
          return item.type === 'album';
        case 'curations':
          return item.type === 'curation' || item.type === 'liked-stations';
        default:
          return true;
      }
    });
  }, [libraryItems, filter]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingTop: insets.top + 4,
          backgroundColor: colors.background,
        },
        listContent: {
          paddingBottom: insets.bottom + 260,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingHorizontal: 16,
          marginBottom: 12,
        },
        title: {
          flex: 1,
          minWidth: 0,
          fontSize: 32,
          fontWeight: '100',
          color: colors.text,
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
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        artwork: {
          width: 56,
          height: 56,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: colors.secondLayerThin,
          alignItems: 'center',
          justifyContent: 'center',
        },
        likedArtwork: {
          backgroundColor: colors.primary,
        },
        artistArtwork: {
          borderRadius: 64,
        },
        artworkImage: {
          width: '100%',
          height: '100%',
        },
        textWrap: {
          flex: 1,
          minWidth: 0,
        },
        itemTitle: {
          color: colors.text,
          fontSize: 15,
          lineHeight: 20,
          fontWeight: 'semibold',
        },
        subtitle: {
          color: colors.textMuted,
          fontSize: 12,
          lineHeight: 16,
          marginTop: 4,
        },
        helperText: {
          color: colors.textMuted,
          fontSize: 14,
          textAlign: 'center',
          marginTop: 24,
          paddingHorizontal: 24,
        },
        filtersRow: {
          paddingHorizontal: 16,
          marginBottom: 8,
          gap: 8,
        },
        filtersScroll: {
          flexGrow: 0,
          flexShrink: 0,
        },
        filterPill: {
          paddingHorizontal: 16,
          paddingVertical: 6,
          borderRadius: 9999,
          borderWidth: 1,
          borderColor: colors.faint,
          backgroundColor: colors.secondLayerThin,
          alignItems: 'center',
          justifyContent: 'center',
        },
        filterPillActive: {
          backgroundColor: colors.text,
        },
        filterPillText: {
          color: colors.textMuted,
          fontSize: 12,
          fontWeight: '600',
          lineHeight: 24,
        },
        filterPillTextActive: {
          color: colors.secondLayer,
        },
        errorText: {
          color: colors.notification,
          fontSize: 14,
          textAlign: 'center',
          marginBottom: 12,
          paddingHorizontal: 24,
        },
      }),
    [colors, insets],
  );

  const refreshLibrary = async () => {
    await Promise.all([refreshStarred(), refreshPlaylists()]);
  };

  const renderArtwork = useCallback((item: LibraryListItem) => {
    if (item.type === 'liked-tracks') {
    return (
        <TailwindGradientView gradientClass='bg-linear-to-bl from-green-500 to-green-700' style={[styles.artwork, styles.likedArtwork]}>
          <Heart size={24} color="#FFFFFF" fill="#FFFFFF" />
        </TailwindGradientView>
      );
    }

    if (item.type === 'liked-stations') {
      return (
        <TailwindGradientView gradientClass='bg-linear-to-bl from-yellow-500 to-yellow-700' style={[styles.artwork, styles.likedArtwork]}>
          <Radio size={24} color="#FFFFFF" />
        </TailwindGradientView>
      );
    }

    if (item.type === 'playlist') {
      const coverUri = item.playlist.coverArt
        ? subsonicService.getCoverArtUrl(item.playlist.coverArt, 56)
        : null;

      return (
        <View style={styles.artwork}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.artworkImage} />
          ) : (
            <ListMusic size={24} color={colors.textMuted} />
          )}
        </View>
      );
    }

    if (item.type === 'curation') {
      return (
        <TailwindGradientView gradientClass={item.curation.color} style={styles.artwork}>
          <Text style={{ fontSize: 24 }}>{item.curation.icon}</Text>
        </TailwindGradientView>
      );
    }

    if (item.type === 'artist') {
      const coverUri = subsonicService.getCoverArtUrl(item.artist.id, 56);

      return (
        <View style={[styles.artwork, styles.artistArtwork]}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.artworkImage} />
          ) : (
            <MicVocal size={24} color={colors.textMuted} />
          )}
        </View>
      );
    }

    const coverUri = item.album.coverArt
      ? subsonicService.getCoverArtUrl(item.album.coverArt, 56)
      : null;

    return (
      <View style={styles.artwork}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.artworkImage} />
        ) : (
          <Disc3 size={24} color={colors.textMuted} />
        )}
      </View>
    );
  }, [styles.artwork, styles.artworkImage, styles.likedArtwork, styles.artistArtwork, colors.textMuted]);

  const renderText = useCallback((item: LibraryListItem) => {
    if (item.type === 'liked-tracks') {
      return (
        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={styles.itemTitle}>
            Liked Tracks
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            Playlist • {formatCount(item.trackCount, 'track')}
          </Text>
        </View>
      );
    }

    if (item.type === 'liked-stations') {
      return (
        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={styles.itemTitle}>
            Liked Stations
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            Curarion • {formatCount(item.stationCount, 'station')}
          </Text>
        </View>
      );
    }

    if (item.type === 'playlist') {
      return (
        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={styles.itemTitle}>
            {item.playlist.name}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            Playlist • {item.playlist.owner} •{' '}
            {formatCount(item.playlist.songCount, 'track')}
          </Text>
        </View>
      );
    }

    if (item.type === 'curation') {
      return (
        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={styles.itemTitle}>
            {item.curation.name}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            Curation • {formatCount(item.curation.stations.length, 'station')}
          </Text>
        </View>
      );
    }

    if (item.type === 'artist') {
      return (
        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={styles.itemTitle}>
            {item.artist.name}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            Artist
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.textWrap}>
        <Text numberOfLines={1} style={styles.itemTitle}>
          {item.album.name}
        </Text>
        <Text numberOfLines={1} style={styles.subtitle}>
          Album • {item.album.artists.map(artist => artist.name).join(', ')}
        </Text>
      </View>
    );
  }, [styles.itemTitle, styles.subtitle, styles.textWrap]);

  const openItem = useCallback((item: LibraryListItem) => {
    const nextRecentIds = [
      item.id,
      ...recentIds.filter(existingId => existingId !== item.id),
    ];
    setRecentIds(nextRecentIds);
    setItem(STORES.SETTINGS, LIBRARY_RECENTS_KEY, nextRecentIds);

    if (item.type === 'liked-tracks') {
      navigation.navigate('Tracks' as never);
      return;
    }

    if (item.type === 'liked-stations') {
      navigation.navigate('Stations' as never);
      return;
    }

    if (item.type === 'playlist') {
      navigation.navigate(
        ...([
          'Playlist',
          { playlist: item.playlist, pageTitle: item.playlist.name },
        ] as never),
      );
      return;
    }

    if (item.type === 'curation') {
      navigation.navigate(
        ...([
          'Curation',
          { curation: item.curation, pageTitle: item.curation.name },
        ] as never),
      );
      return;
    }

    if (item.type === 'artist') {
      navigation.navigate(
        ...([
          'ArtistDetail',
          { artist: item.artist, pageTitle: item.artist.name },
        ] as never),
      );
      return;
    }

    navigation.navigate(
      ...(['Album', { album: item.album, pageTitle: item.album.name }] as never),
    );
  }, [navigation, recentIds]);

  const renderItem = useCallback(({ item }: any) => (
          <Pressable android_ripple={{ color: colors.secondLayerThin }} style={styles.row} onPress={() => openItem(item)} onLongPress={() => {
            switch (item.type) {
              case "album":
                openAlbumMenu(item.album)
            }
          }}>
            {renderArtwork(item)}
            {renderText(item)}
          </Pressable>
        ), [colors.secondLayerThin, openItem, openAlbumMenu, renderArtwork, renderText, styles]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={styles.title}>
          Library
        </Text>
        <View style={styles.headerActions}>
          {subsonicEnabled ? (
            <Pressable
              style={styles.iconButton}
              onPress={() => {
                openFlyout({
                  actions: [
                    {
                      id: 'create-playlist',
                      label: 'Create playlist',
                      onPress: async () => {
                        const newPlaylist = await createPlaylist(
                          `My playlist #${playlists.length + 2}`
                        );
                        if (newPlaylist) {
                          navigation.navigate(
                            ...(['Playlist', { playlist: newPlaylist }] as never),
                          );
                        } else {
                          Alert.alert('Failed to create playlist', 'Please try again.');
                        }
                      },
                      icon: ListPlus
                    },
                    {
                      id: 'create-curation',
                      label: 'Create curation',
                      onPress: () => navigation.navigate('CreateCuration' as never),
                      icon: Sparkles
                    },
                    {
                      id: 'upload-songs',
                      label: 'Upload songs',
                      onPress: () => navigation.navigate('UploadSongs' as never),
                      icon: Upload
                    },
                  ],
                })
              }}
            >
              <Plus size={24} color={colors.text} />
            </Pressable>
          ) : null}
          <Pressable
            style={styles.iconButton}
            onPress={() => navigation.getParent()?.navigate('Settings' as never)}
          >
            <Cog size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersRow}
      >
        {LIBRARY_FILTERS.map(({ key, label }) => {
          const isActive = filter === key;
          return (
            <Pressable
              key={key}
              style={[
                styles.filterPill,
                isActive && styles.filterPillActive,
              ]}
              onPress={() => setFilter(key)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  isActive && styles.filterPillTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={loading || playlistsLoading}
        onRefresh={refreshLibrary}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.helperText}>
            {subsonicEnabled
              ? 'Your liked tracks, playlists, artists, and albums will appear here.'
              : 'Connect an OpenSubsonic server to build your library.'}
          </Text>
        }
      />
    </View>
  );
}

function LibraryScreen() {
  return (
    <CommonAdvancedNavigator
      screens={[
        { name: 'LibraryMain', component: LibraryScreenInternal },
        { name: 'Tracks', component: TracksScreen },
        { name: 'Albums', component: AlbumsScreen },
        { name: 'Artist', component: ArtistsScreen },
        { name: 'Playlists', component: PlaylistsScreen },
        { name: 'CreatePlaylist', component: CreatePlaylistScreen },
        { name: 'Stations', component: StationsScreen },
        { name: 'Curations', component: CurationsScreen },
        { name: 'CreateCuration', component: CreateCurationScreen },
        { name: 'UploadSongs', component: UploadSongsScreen },
      ]}
    />
  );
}

export default LibraryScreen;
