import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubsonicAlbum, SubsonicSong } from '../types/subsonic';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  EllipsisVertical,
  Heart,
  HeartMinus,
  List,
  ListMusic,
  ListStart,
  Play,
  Shuffle,
  User2,
} from 'lucide-react-native';
import subsonicService from '../utils/subsonic';
import { useAudioPlayer } from '../contexts/audio-player-context';
import { useAppTheme } from '../contexts/theme-context';
import { FlyoutTrigger, useFlyout } from '../components/flyout-menu';
import { useLibrary } from '../contexts/library-context';
import { usePlaylists } from '../contexts/playlists-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useCarHomeSlots } from '../contexts/carhome-slots-context';
import Text from '../components/text';
import TouchableScale from '../components/touchable-scale';

function formatDuration(duration: number): string {
  const safeDuration = Number.isFinite(duration)
    ? Math.max(0, Math.floor(duration))
    : 0;
  const minutes = Math.floor(safeDuration / 60);
  const seconds = safeDuration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function AlbumScreen({
  route,
}: {
  route: { params: { album: SubsonicAlbum; pageTitle: string } };
}) {
  const insets = useSafeAreaInsets();
  const {
    theme: { colors, shadows },
  } = useAppTheme();
  const { openFlyout } = useFlyout();
  const navigation = useNavigation();
  const { playSong, shufflePlay, currentSongId, queueNext } = useAudioPlayer();
  const { playlists, addSongToPlaylist } = usePlaylists();
  const { isStarred, star, unstar } = useLibrary();
  const { openSaveToSlotMenu } = useCarHomeSlots();

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
        },
        backButton: {
          padding: 8,
          borderRadius: 64,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
          minWidth: 0,
          position: 'absolute',
          left: 16,
          top: insets.top + 16,
          zIndex: 1000,
        },
        menuButton: {
          padding: 8,
          borderRadius: 64,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
          minWidth: 0,
          position: 'absolute',
          right: 16,
          top: insets.top + 16,
          zIndex: 1000,
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
          fontSize: 20,
          fontWeight: '800',
        },
        artistText: {
          color: colors.textMuted,
          fontSize: 15,
          marginTop: 6,
        },
        metaText: {
          color: colors.textMuted,
          fontSize: 13,
          marginTop: 4,
          opacity: 0.8,
        },
        qualityText: {
          color: "#b3b3b3",
          fontSize: 10,
          paddingHorizontal: 8,
          borderRadius: 24,
          boxShadow: shadows.glass,
          borderWidth: 1,
          borderColor: colors.faint,
          backgroundColor: colors.secondLayerThin,
          letterSpacing: 0.5,
          fontWeight: '600',
          paddingVertical: 4,
          marginTop: 4,
          flex: 0,
          alignSelf: 'flex-start',
        },
        qualityTextCD: {
          backgroundColor: '#0EA5E940',
          color: '#7DD3FC',
        },
        qualityTextLossless: {
          backgroundColor: '#c2b80040',
          color: '#c2af00',
        },
        actionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexShrink: 0,
        },
        actionButton: {
          padding: 12,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        },
        playButton: {
          padding: 16,
          backgroundColor: '#16a34a',
          marginLeft: 8,
        },
        favouritesButton: {
          padding: 16,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          aspectRatio: 1,
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
          paddingHorizontal: 16,
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
        cdQuality: {
          color: '#7DD3FC',
        },
        losslessQuality: {
          color: '#c2af00',
        },
        trackDuration: {
          color: colors.textMuted,
          fontSize: 12,
          marginLeft: 8,
        },
        listContent: {
          paddingBottom: insets.bottom + 160,
        },
        artworkBlur: {
          width: '100%',
          height: '100%',
          aspectRatio: 1,
        },
        infoRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          paddingHorizontal: 20,
          minWidth: 0,
          gap: 12,
        },
        infoColumn: {
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          flexShrink: 1,
        },
      }),
    [colors.background, colors.card, colors.faint, colors.primary, colors.secondLayerThin, colors.text, colors.textMuted, insets.bottom, insets.top, shadows.glass, shadows.main],
  );

  const [albumData, setAlbumData] = useState<SubsonicAlbum>(route.params.album);
  const [coverUrl, setCoverUrl] = useState<string | null>(
    route.params.album.coverArt
      ? subsonicService.getCoverArtUrl(route.params.album.coverArt)
      : null,
  );

  useEffect(() => {
    const nextCover = albumData.coverArt
      ? subsonicService.getCoverArtUrl(albumData.coverArt)
      : null;
    setCoverUrl(nextCover);
  }, [albumData.coverArt]);

  const openAddToPlaylistMenu = useCallback(
    (song: SubsonicSong) => {
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
    },
    [addSongToPlaylist, openFlyout, playlists],
  );

  const openSongMenu = useCallback(
    (song: SubsonicSong, index: number) => {
      const songIsStarred = isStarred(song.id, 'song');
      const songs = albumData.song ?? []

      openFlyout({
        title: song.title,
        subtitle: song.artist,
        coverUrl: coverUrl || undefined,
        actions: [
          {
            id: `play-${song.id}`,
            label: 'Play now',
            onPress: () => playSong(songs, index),
            icon: Play
          },
          {
            id: `next-${song.id}`,
            label: 'Play next',
            onPress: () => queueNext(song),
            icon: ListStart
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
            id: `fav-${song.id}`,
            label: songIsStarred
              ? 'Remove from favourites'
              : 'Add to favourites',
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
            id: `add-${song.id}`,
            label: 'Add to playlist',
            onPress: () => openAddToPlaylistMenu(song),
            icon: ListMusic,
          },
        ],
      });
    },
    [isStarred, albumData.song, openFlyout, coverUrl, playSong, queueNext, navigation, star, unstar, openAddToPlaylistMenu],
  );

  const isCdQuality =
    albumData.song && albumData.song.length ? (albumData.song[0].bitDepth === 16 && albumData.song[0].samplingRate === 44100) : false;
  const isLosslessQuality =
    albumData.song && albumData.song.length ? (albumData.song[0].bitDepth > 16 || albumData.song[0].samplingRate > 44100): false;

  const renderItem = useCallback(
    ({ item, index }: { item: SubsonicSong; index: number }) => {
      const isActive = currentSongId === item.id;
      const songs = albumData.song ?? []

      return (
        <Pressable
          android_ripple={{ color: colors.secondLayerThin }}
          onPress={() => playSong(songs, index)}
          style={styles.trackRow}
        >
          <Text style={styles.trackIndex}>{index + 1}</Text>
          <View style={styles.trackTextWrap}>
            <Text
              numberOfLines={1}
              style={[styles.trackTitle, isActive && styles.activeTrack, isActive && isCdQuality && styles.cdQuality, isActive && isLosslessQuality && styles.losslessQuality]}
            >
              {item.title}
            </Text>
            <Text numberOfLines={1} style={styles.trackSubtitle}>
              {item.artists.map(artist => artist.name).join(', ')}
            </Text>
          </View>
          <Text style={styles.trackDuration}>
            {formatDuration(item.duration)}
          </Text>
          <FlyoutTrigger onPress={() => openSongMenu(item, index)} />
        </Pressable>
      );
    },
    [albumData.song, colors.secondLayerThin, currentSongId, isCdQuality, isLosslessQuality, openSongMenu, playSong, styles.activeTrack, styles.cdQuality, styles.losslessQuality, styles.trackDuration, styles.trackIndex, styles.trackRow, styles.trackSubtitle, styles.trackTextWrap, styles.trackTitle],
  );

  useEffect(() => {
    let mounted = true;

    const loadAlbum = async () => {
      const result = await subsonicService.getAlbum(route.params.album.id);
      if (!mounted || !result.success || !result.data) {
        return;
      }

      const detailedAlbum = result.data as SubsonicAlbum;
      if (detailedAlbum?.song?.length) {
        setAlbumData(detailedAlbum);
      }
    };

    loadAlbum().catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, [route.params.album.id]);

  const artistNames =
    albumData.artists?.map(artist => artist.name).join(', ') ||
    albumData.artist;

  const playShuffled = async () => {
    if (!albumData.song.length) return;
    shufflePlay(albumData.song);
  };

  const queueAlbumNext = useCallback(async () => {
    const songs = albumData.song ?? [];
    const orderedSongs = [...songs].reverse();
    orderedSongs.forEach(song => queueNext(song));
  }, [albumData.song, queueNext]);

  const openAlbumMenu = useCallback(() => {
    const albumIsStarred = isStarred(albumData.id, 'album');
    const songs = albumData.song ?? []

    openFlyout({
      title: albumData.name,
      subtitle: albumData.artist,
      coverUrl: subsonicService.getCoverArtUrl(albumData.id) || undefined,
      actions: [
        {
          id: `play-${albumData.id}`,
          label: 'Play album',
          onPress: async () => {
            try {
              playSong(songs, 0);
            } catch (err) {
              Alert.alert(
                'Unable to play album',
                err instanceof Error ? err.message : 'Please try again.',
              );
            }
          },
          icon: Play,
        },
        {
          id: `artist-${albumData.id}`,
          label: 'Go to artist',
          onPress: async () => {
            if (albumData.artists.length === 1) {
              navigation.navigate(
                ...([
                  'ArtistDetail',
                  {
                    artist: albumData.artists[0],
                    pageTitle: albumData.artists[0].name,
                  },
                ] as never),
              );
            } else if (albumData.artists.length > 1) {
              openFlyout({
                title: 'Artist',
                actions: albumData.artists.map(artist => ({
                  id: `artist-${artist.id}`,
                  label: albumData.name,
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
          id: `queue-${albumData.id}`,
          label: 'Queue album next',
          onPress: async () => {
            try {
              await queueAlbumNext();
            } catch (err) {
              Alert.alert(
                'Unable to queue album',
                err instanceof Error ? err.message : 'Please try again.',
              );
            }
          },
          icon: ListStart,
        },
        {
          id: `favourite-${albumData.id}`,
          label: albumIsStarred
            ? 'Remove from favourites'
            : 'Add to favourites',
          onPress: async () => {
            if (albumIsStarred) {
              await unstar({ albumId: albumData.id });
              return;
            }

            await star({ albumId: albumData.id });
          },
          icon: albumIsStarred ? HeartMinus : Heart,
        },
        {
          id: `slot-${albumData.id}`,
          label: 'Save to speed dial',
          onPress: () =>
            openSaveToSlotMenu({ type: 'album', album: albumData }),
          icon: List,
        },
      ],
    });
  }, [albumData, playSong, isStarred, navigation, openFlyout, openSaveToSlotMenu, queueAlbumNext, star, unstar]);

  const songs = albumData.song ?? [];

  return (
    <View style={styles.container}>
      <View
        style={[
          {
            aspectRatio: 1,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 0,
          },
        ]}
      >
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            blurRadius={24}
            style={styles.artworkBlur}
          />
        ) : null}
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
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <ChevronLeft size={24} color={colors.text} />
      </Pressable>
      <Pressable onPress={openAlbumMenu} style={styles.menuButton}>
        <EllipsisVertical size={24} color={colors.text} />
      </Pressable>

      <FlatList
        style={{ flex: 1, zIndex: 1 }}
        contentContainerStyle={styles.listContent}
        data={songs}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <View style={styles.hero}>
            <View style={styles.coverWrap}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.coverImage} />
              ) : null}
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoColumn}>
                  <Text numberOfLines={1} style={styles.albumTitle}>
                    {albumData.name}
                  </Text>
                <Text numberOfLines={1} style={styles.artistText}>
                  {artistNames}
                </Text>
                <Text style={styles.metaText}>
                  {songs.length} tracks • {formatDuration(albumData.duration)}
                </Text>
                <Text style={[styles.qualityText, isCdQuality && styles.qualityTextCD, isLosslessQuality && styles.qualityTextLossless]}>
                  {isCdQuality && 'Lossless'}
                  {isLosslessQuality && 'Hi-Res Lossless'}
                </Text>
              </View>
              <View style={styles.actionsRow}>
                <TouchableScale
                  onPress={() => {
                    if (isStarred(albumData.id, 'album')) {
                      unstar({ albumId: albumData.id });
                    } else {
                      star({ albumId: albumData.id });
                    }
                  }}
                  style={styles.favouritesButton}
                >
                  <Heart
                    size={20}
                    color={
                      isStarred(albumData.id, 'album') ? '#ef4444' : colors.text
                    }
                    fill={
                      isStarred(albumData.id, 'album') ? '#ef4444' : 'transparent'
                    }
                  />
                </TouchableScale>
                <TouchableScale
                  onPress={playShuffled}
                  style={[styles.actionButton]}
                >
                  <Shuffle size={20} color={colors.text} />
                </TouchableScale>
                <TouchableScale
                  onPress={() => playSong(songs, 0)}
                  style={[styles.actionButton, styles.playButton]}
                >
                  <Play size={16} color={'#FFFFFF'} fill={'#FFFFFF'} />
                </TouchableScale>
              </View>
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

export default AlbumScreen;
