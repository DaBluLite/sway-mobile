import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from '../../components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibrary } from '../../contexts/library-context';
import { useAudioPlayer } from '../../contexts/audio-player-context';
import { useAppTheme } from '../../contexts/theme-context';
import subsonicService from '../../utils/subsonic';
import { FlyoutTrigger, useFlyout } from '../../components/flyout-menu';
import { usePlaylists } from '../../contexts/playlists-context';
import { SubsonicSong } from '../../types/subsonic';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowDownUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  Disc3,
  Heart,
  HeartMinus,
  ListMusic,
  ListStart,
  Play,
  Search,
  Shuffle,
  User2,
  X,
} from 'lucide-react-native';
import { formatCount } from '../../utils/format';
import Blank from '../../components/icons/blank';

function TracksScreen() {
  const insets = useSafeAreaInsets();
  const {
    theme: { colors },
  } = useAppTheme();
  const { openFlyout } = useFlyout();
  const { starred, loading, error, refreshStarred, star, unstar, isStarred } =
    useLibrary();
  const { playlists, addSongToPlaylist, createPlaylist } = usePlaylists();
  const navigation = useNavigation();
  const { playSong, currentSongId, queueNext, shufflePlay } = useAudioPlayer();

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<
    'default' | 'title' | 'artist' | 'duration' | 'album' | 'added'
  >('default');
  const [sortDesc, setSortDesc] = useState(false);

  const tracks = useMemo(() => {
    if (!starred || !starred.song) {
      return [];
    }

    let result = starred.song;

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
          case 'added': {
            const aTime = a.created ? new Date(a.created).getTime() : 0;
            const bTime = b.created ? new Date(b.created).getTime() : 0;
            cmp = aTime - bTime;
            break;
          }
        }
        if (cmp === 0) {
          cmp = a.track - b.track;
        }
        return sortDesc ? -cmp : cmp;
      });
    }

    return result;
  }, [starred, searchQuery, sortMode, sortDesc]);

  const openSortMenu = () => {
    const options: { id: string; label: string; enabled: boolean }[] = [
      { id: 'default', label: 'Default', enabled: sortMode === 'default' },
      { id: 'title', label: 'Title', enabled: sortMode === 'title' },
      { id: 'artist', label: 'Artist', enabled: sortMode === 'artist' },
      { id: 'album', label: 'Album', enabled: sortMode === 'album' },
      { id: 'duration', label: 'Duration', enabled: sortMode === 'duration' },
      { id: 'added', label: 'Date added', enabled: sortMode === 'added' },
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
              const next = option.id as Exclude<typeof sortMode, 'default'>;
              setSortMode(next);
              // Date added: default to most recent first (descending)
              setSortDesc(next === 'added');
            }
          },
          icon: option.enabled ? Check : Blank,
        })),
        ...(sortMode !== 'default'
          ? [
              {
                id: 'sort-dir',
                label:
                  sortMode === 'added'
                    ? sortDesc
                      ? 'Most recent first'
                      : 'Least recent first'
                    : sortDesc
                      ? 'Descending'
                      : 'Ascending',
                onPress: () => setSortDesc(prev => !prev),
                icon: sortDesc ? ArrowDownUp : ArrowUpDown,
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
          marginBottom: 4,
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

        hero: {
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
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
        favouritesButton: {
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          flexShrink: 0,
          padding: 12,
          aspectRatio: 1,
          borderColor: colors.subtle,
          borderWidth: 1,
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
        input: {
          borderRadius: 64,
          borderWidth: 1,
          borderColor: '#97979F29',
          backgroundColor: colors.secondLayerThin,
          color: colors.text,
          paddingHorizontal: 12,
          paddingVertical: 8,
          flex: 1,
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
      }),
    [colors, insets],
  );

  const openAddToPlaylistMenu = useCallback((song: SubsonicSong) => {
    openFlyout({
      title: 'Add to playlist',
      subtitle: song.title,
      actions: [
        ...playlists.map(playlist => ({
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
        })),
        {
          id: 'create-playlist',
          label: 'Create new playlist',
          onPress: async () => {
            const newPlaylist = await createPlaylist(
              `My playlist #${playlists.length + 2}`,
              [song.id],
            );
            if (newPlaylist) {
              navigation.navigate(
                ...(['Playlist', { playlist: newPlaylist }] as never),
              );
            } else {
              Alert.alert('Failed to create playlist', 'Please try again.');
            }
          },
        },
      ],
    });
  }, [openFlyout, playlists, addSongToPlaylist, createPlaylist, navigation]);

  const openSongMenu = useCallback((song: SubsonicSong, index: number) => {
    const songIsStarred = isStarred(song.id, 'song');

    openFlyout({
      title: song.title,
      subtitle: `${song.artist} • ${song.album}`,
      coverUrl: subsonicService.getCoverArtUrl(song.coverArt) || undefined,
      actions: [
        {
          id: `play-${song.id}`,
          label: 'Play now',
          onPress: () => playSong(tracks, index),
          icon: Play,
        },
        {
          id: `play-next-${song.id}`,
          label: 'Play next',
          onPress: () => queueNext(song),
          icon: ListStart,
        },
        {
          id: `album-${song.id}`,
          label: 'Go to album',
          onPress: async () => {
            try {
              const res = await subsonicService.getAlbum(song.albumId);
              if (res.success && res.data) {
                navigation.navigate(
                  ...([
                    'Album',
                    { album: res.data as any, pageTitle: song.album },
                  ] as never),
                );
              }
            } catch (err) {
              Alert.alert(
                'Failed to load album',
                err instanceof Error ? err.message : 'Please try again.',
              );
            }
          },
          icon: Disc3,
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
          icon: User2,
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
          icon: songIsStarred ? HeartMinus : Heart,
        },
        {
          id: `playlist-${song.id}`,
          label: 'Add to playlist',
          onPress: () => openAddToPlaylistMenu(song),
          icon: ListMusic,
        },
      ],
    });
  }, [isStarred, openFlyout, playSong, tracks, queueNext, navigation, star, unstar, openAddToPlaylistMenu]);

  const playShuffled = async () => {
    if (!tracks.length) return;
    shufflePlay(tracks);
  };

  const renderItem = useCallback(({item, index}: any) => {
          const isActive = currentSongId === item.id;
          const coverUri = item.coverArt
            ? subsonicService.getCoverArtUrl(item.coverArt)
            : null;
          return (
            <Pressable
              onLongPress={() => openSongMenu(item, index)}
              onPress={() => playSong(tracks, index)}
              android_ripple={{ color: colors.secondLayer }}
              style={styles.row}
            >
              <View style={styles.coverWrap}>
                {coverUri ? (
                  <Image source={{ uri: coverUri }} style={styles.coverImage} />
                ) : (
                  <Text style={styles.coverFallback}>♪</Text>
                )}
              </View>
              <View style={styles.textWrap}>
                <Text
                  numberOfLines={1}
                  style={[styles.trackTitle, isActive && styles.activeTitle]}
                >
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={styles.subtitle}>
                  {item.artist}
                </Text>
              </View>
              <FlyoutTrigger onPress={() => openSongMenu(item, index)} />
            </Pressable>
          );
        }, [styles, colors, playSong, tracks, currentSongId, openSongMenu]);
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
              style={[styles.headerButton, { padding: 4 }]}
              hitSlop={8}
            >
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text numberOfLines={1} style={styles.title}>
                Tracks
              </Text>
              <Text style={styles.metaText}>
                {formatCount(tracks.length, 'tracks')}
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

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={tracks}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={refreshStarred}
        ListHeaderComponent={
          <View style={styles.hero}>
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => playSong(tracks, 0)}
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
          <Text style={styles.helperText}>
            {loading ? 'Loading starred tracks...' : 'No starred tracks yet.'}
          </Text>
        }
      />
    </View>
  );
}

export default TracksScreen;
