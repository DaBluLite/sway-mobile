import { useEffect, useMemo, useState, useCallback } from 'react';
import { FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubsonicPlaylist, SubsonicSong } from '../types/subsonic';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowDownUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  EllipsisVertical,
  Play,
  Search,
  Shuffle,
  X,
} from 'lucide-react-native';
import subsonicService from '../utils/subsonic';
import { useAudioPlayer } from '../contexts/audio-player-context';
import { useAppTheme } from '../contexts/theme-context';
import { FlyoutTrigger, useFlyout } from '../components/flyout-menu';
import { useLibrary } from '../contexts/library-context';
import { usePlaylists } from '../contexts/playlists-context';
import { Alert } from '../components/custom-alert-api';
import Blank from '../components/icons/blank';

function formatDuration(duration: number): string {
  const safeDuration = Number.isFinite(duration)
    ? Math.max(0, Math.floor(duration))
    : 0;
  const minutes = Math.floor(safeDuration / 60);
  const seconds = safeDuration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function PlaylistScreen({
  route,
}: {
  route: { params: { playlist: SubsonicPlaylist; pageTitle: string } };
}) {
  const insets = useSafeAreaInsets();
  const {
    theme: { colors, shadows },
  } = useAppTheme();
  const { openFlyout } = useFlyout();
  const navigation = useNavigation();
  const { playSong, shufflePlay, currentSongId, queueNext } = useAudioPlayer();
  const { playlists, addSongToPlaylist, deletePlaylist } = usePlaylists();
  const { isStarred, star, unstar } = useLibrary();

  const [playlistData, setPlaylistData] = useState<SubsonicPlaylist>(
    route.params.playlist,
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(
    route.params.playlist.coverArt
      ? subsonicService.getCoverArtUrl(route.params.playlist.coverArt)
      : null,
  );

  useEffect(() => {
    const nextCover = playlistData.coverArt
      ? subsonicService.getCoverArtUrl(playlistData.coverArt)
      : null;
    setCoverUrl(nextCover);
  }, [playlistData.coverArt]);

  useEffect(() => {
    let mounted = true;

    const loadPlaylist = async () => {
      const result = await subsonicService.getPlaylist(
        route.params.playlist.id,
      );
      if (!mounted || !result.success || !result.data) {
        return;
      }

      const detailedPlaylist = result.data as SubsonicPlaylist;
      if (detailedPlaylist?.entry?.length) {
        setPlaylistData(detailedPlaylist);
      }
    };

    loadPlaylist().catch(() => undefined);
  return () => {
      mounted = false;
    };
  }, [route.params.playlist.id]);

  const songs = useMemo(() => playlistData.entry ?? [], [playlistData.entry]);
  const artistNames = playlistData.owner;

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<
    'default' | 'title' | 'artist' | 'album' | 'duration'
  >('default');
  const [sortDesc, setSortDesc] = useState(false);

  const visibleSongs = useMemo(() => {
    let result = songs;

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        song =>
          song.title.toLowerCase().includes(query) ||
          song.artist.toLowerCase().includes(query) ||
          song.album.toLowerCase().includes(query),
      );
    }

    if (sortMode !== 'default') {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortMode) {
          case 'title':
            cmp = a.title.localeCompare(b.title);
            break;
          case 'artist':
            cmp = a.artist.localeCompare(b.artist);
            break;
          case 'album':
            cmp = a.album.localeCompare(b.album);
            break;
          case 'duration':
            cmp = a.duration - b.duration;
            break;
        }
        if (cmp === 0) {
          cmp = a.track - b.track;
        }
        return sortDesc ? -cmp : cmp;
      });
    }

    return result;
  }, [songs, searchQuery, sortMode, sortDesc]);

  const openPlaylistMenu = () => {
    openFlyout({
      title: playlistData.name,
      subtitle: `Owner: ${playlistData.owner}`,
      actions: [
        { id: 'play-all', label: 'Play all', onPress: playAll },
        { id: 'shuffle-play', label: 'Shuffle play', onPress: playShuffled },
        {
          id: 'delete-playlist',
          label: 'Delete playlist',
          onPress: deletePlaylistAlert,
          destructive: true,
        },
      ],
    });
  };

  function deletePlaylistAlert() {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete the playlist "${playlistData.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlaylist(playlistData.id);
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                'Failed to delete playlist',
                error instanceof Error ? error.message : 'Please try again.',
              );
            }
          },
        },
      ],
      { cancelable: true },
    );
  }

  const openSortMenu = () => {
    const options = [
      { id: 'default', label: 'Default', enabled: sortMode === 'default' },
      { id: 'title', label: 'Title', enabled: sortMode === 'title' },
      { id: 'artist', label: 'Artist', enabled: sortMode === 'artist' },
      { id: 'album', label: 'Album', enabled: sortMode === 'album' },
      { id: 'duration', label: 'Duration', enabled: sortMode === 'duration' },
    ];

    openFlyout({
      title: 'Sort tracks',
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

  const playAll = async () => {
    if (!visibleSongs.length) return;
    playSong(visibleSongs, 0);
  };

  const playShuffled = async () => {
    if (!visibleSongs.length) return;
    shufflePlay(visibleSongs);
  };

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
  }, [openFlyout, playlists, addSongToPlaylist]);

  const openSongMenu = useCallback((song: SubsonicSong, index: number) => {
    const songIsStarred = isStarred(song.id, 'song');

    openFlyout({
      title: song.title,
      subtitle: song.artist,
      actions: [
        {
          id: `play-${song.id}`,
          label: 'Play now',
          onPress: () => playSong(visibleSongs, index),
        },
        {
          id: `next-${song.id}`,
          label: 'Play next',
          onPress: () => queueNext(song),
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
        },
        {
          id: `playlist-${song.id}`,
          label: 'Add to playlist',
          onPress: () => openAddToPlaylistMenu(song),
        },
      ],
    });
  }, [isStarred, openFlyout, playSong, visibleSongs, queueNext, star, unstar, openAddToPlaylistMenu]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
        },
        headerRow: {
          alignItems: 'center',
          flexDirection: 'row',
          marginBottom: 20,
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
        },
        coverImage: {
          width: '100%',
          height: '100%',
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
          marginTop: 4,
          textAlign: 'center',
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
          paddingVertical: 12,
          borderBottomColor: colors.secondLayerThin,
          borderBottomWidth: 1,
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
              onPress={() => playSong(visibleSongs, index)}
              style={styles.trackRow}
            >
              <Text style={styles.trackIndex}>{index + 1}</Text>
              <View style={styles.trackTextWrap}>
                <Text
                  numberOfLines={1}
                  style={[styles.trackTitle, isActive && styles.activeTrack]}
                >
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={styles.trackSubtitle}>
                  {item.artist}
                </Text>
              </View>
              <Text style={styles.trackDuration}>
                {formatDuration(item.duration)}
              </Text>
              <FlyoutTrigger onPress={() => openSongMenu(item, index)} />
            </Pressable>
          );
        }, [currentSongId, styles.trackRow, styles.trackIndex, styles.trackTextWrap, styles.trackTitle, styles.activeTrack, styles.trackSubtitle, styles.trackDuration, playSong, visibleSongs, openSongMenu]);

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
              placeholder="Search tracks..."
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
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.title}>
                {route.params.pageTitle}
              </Text>
            </View>
            <Pressable onPress={openPlaylistMenu} style={styles.headerButton}>
              <EllipsisVertical size={20} color={colors.text} />
            </Pressable>
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
        data={visibleSongs}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <View style={styles.hero}>
            <View style={styles.coverWrap}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.coverImage} />
              ) : null}
            </View>

            <Text numberOfLines={2} style={styles.albumTitle}>
              {playlistData.name}
            </Text>
            <Text numberOfLines={1} style={styles.artistText}>
              {artistNames}
            </Text>
            <Text style={styles.metaText}>
              {visibleSongs.length} tracks •{' '}
              {formatDuration(playlistData.duration)}
            </Text>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={playAll}
                style={[styles.actionButton, styles.playButton]}
              >
                <Play size={16} color={'#FFFFFF'} fill={'#FFFFFF'} />
                <Text style={styles.playButtonText}>Play</Text>
              </Pressable>
              <Pressable
                onPress={playShuffled}
                style={[styles.actionButton, styles.shuffleButton]}
              >
                <Shuffle size={16} color={colors.text} />
                <Text style={styles.shuffleButtonText}>Shuffle</Text>
              </Pressable>
            </View>
          </View>
        }
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

export default PlaylistScreen;
