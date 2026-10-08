import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubsonicArtist, SubsonicSong } from '../types/subsonic';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Heart, ListMusic, ListStart, Play, Shuffle, User2, HeartMinus } from 'lucide-react-native';
import subsonicService from '../utils/subsonic';
import { useAudioPlayer } from '../contexts/audio-player-context';
import { useAppTheme } from '../contexts/theme-context';
import { FlyoutTrigger, useFlyout } from '../components/flyout-menu';
import { useLibrary } from '../contexts/library-context';
import { usePlaylists } from '../contexts/playlists-context';
import { AlbumCarousel } from '../components/album-carousel';
import { formatCount } from '../utils/format';

function formatDuration(duration: number): string {
  const safeDuration = Number.isFinite(duration)
    ? Math.max(0, Math.floor(duration))
    : 0;
  const minutes = Math.floor(safeDuration / 60);
  const seconds = safeDuration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function ArtistScreen({
  route,
}: {
  route: { params: { artist: SubsonicArtist; pageTitle: string } };
}) {
  const insets = useSafeAreaInsets();
  const {
    theme: { colors, shadows },
    resolvedTheme: currentTheme
  } = useAppTheme();
  const { openFlyout } = useFlyout();
  const navigation = useNavigation();
  const { playSong, shufflePlay, currentSongId, queueNext } = useAudioPlayer();
  const { playlists, addSongToPlaylist } = usePlaylists();
  const { isStarred, star, unstar } = useLibrary();

  const [artistData, setArtistData] = useState<SubsonicArtist>(
    route.params.artist,
  );
  const [topSongs, setTopSongs] = useState<SubsonicSong[]>([]);

  useEffect(() => {
    const loadArtist = async () => {
      const result = await subsonicService.getArtist(route.params.artist.id);
      if (!result.success || !result.data) {
        return;
      }

      const detailedArtist = result.data as SubsonicArtist;
      setArtistData(detailedArtist);

      const albums = detailedArtist.album ?? [];
      if (!albums.length) {
        setTopSongs([]);
        return;
      }

      const albumFetches = await Promise.all(
        albums.slice(0, 10).map(async album => {
          const albumResult = await subsonicService.getAlbum(album.id);
          if (!albumResult.success || !albumResult.data) {
            return [] as SubsonicSong[];
          }

          const detailedAlbum = albumResult.data as { song?: SubsonicSong[] };
          return detailedAlbum.song ?? [];
        }),
      );

      const mergedSongs = albumFetches
        .flat()
        .filter((song): song is SubsonicSong => Boolean(song?.id));

      const uniqueSongsMap = new Map<string, SubsonicSong>();
      mergedSongs.forEach(song => {
        if (!uniqueSongsMap.has(song.id)) {
          uniqueSongsMap.set(song.id, song);
        }
      });

      const sortedTopSongs = Array.from(uniqueSongsMap.values())
        .sort((a, b) => {
          const playCountA = a.playCount ?? 0;
          const playCountB = b.playCount ?? 0;
          if (playCountA !== playCountB) {
            return playCountB - playCountA;
          }
          return (b.year ?? 0) - (a.year ?? 0);
        })
        .slice(0, 15);

      setTopSongs(sortedTopSongs);
    };

    loadArtist().catch(() => undefined);
  }, [route.params.artist.id]);

  const albums = useMemo(() => artistData.album ?? [], [artistData.album]);

  const playTopSongs = async () => {
    if (!topSongs.length) return;
    playSong(topSongs, 0);
  };

  const shuffleTopSongs = async () => {
    if (!topSongs.length) return;
    shufflePlay(topSongs);
  };

  const openAddToPlaylistMenu = (song: SubsonicSong) => {
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
  };

  const openSongMenu = (song: SubsonicSong, index: number) => {
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
          onPress: () => playSong(topSongs, index),
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
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.background,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 160,
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
        title: {
          fontSize: 32,
          fontWeight: '300',
          color: colors.text,
          flexShrink: 1,
        },
        hero: {
          alignItems: 'center',
          marginBottom: 16,
        },
        artistBubble: {
          width: 180,
          height: 180,
          borderRadius: 999,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.secondLayerThin,
          marginBottom: 14,
          boxShadow: shadows.main,
        },
        artistInitial: {
          color: colors.textMuted,
          fontSize: 58,
          fontWeight: '700',
        },
        artistName: {
          color: colors.text,
          fontSize: 30,
          fontWeight: '800',
          textAlign: 'center',
        },
        metaText: {
          color: colors.textMuted,
          fontSize: 13,
          marginTop: 6,
          textAlign: 'center',
          opacity: 0.8,
        },
        favouritesButton: {
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          aspectRatio: 1,
          borderColor: colors.faint,
          borderWidth: 1,
          backgroundColor: colors.secondLayerThin,
        },
        actionsRow: {
          flexDirection: 'row',
          gap: 12,
          marginTop: 14,
          paddingHorizontal: 16,
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
        sectionTitle: {
          color:
            currentTheme === 'dark'
              ? 'rgba(255, 255, 255, 0.4)'
              : 'rgba(0, 0, 0, 0.4)',
          fontSize: 12,           // text-xs
          fontWeight: '600',      // font-semibold
          letterSpacing: 1.2,     // tracking-widest (0.1em × 12px)
          textTransform: 'uppercase',
          paddingHorizontal: 16,
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
        activeTrack: {
          color: colors.primary,
        },
        trackSubtitle: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 3,
        },
        trackDuration: {
          color: colors.textMuted,
          fontSize: 12,
          marginLeft: 8,
        },
        albumRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          borderBottomColor: colors.secondLayerThin,
          borderBottomWidth: 1,
        },
        albumCoverWrap: {
          width: 54,
          height: 54,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: colors.secondLayerThin,
          alignItems: 'center',
          justifyContent: 'center',
        },
        albumCover: {
          width: '100%',
          height: '100%',
        },
        albumFallback: {
          color: colors.textMuted,
          fontSize: 14,
        },
        albumTextWrap: {
          flex: 1,
          minWidth: 0,
        },
        albumTitle: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        albumMeta: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 3,
        },
        emptyText: {
          color: colors.textMuted,
          fontSize: 13,
          marginTop: 8,
        },
        coverWrap: {
          width: 220,
          height: 220,
          borderRadius: 220,
          overflow: 'hidden',
          backgroundColor: colors.card,
          marginBottom: 16,
          boxShadow: shadows.main,
        },
        coverImage: {
          width: '100%',
          height: '100%',
        },
      }),
    [colors, insets, shadows.main, currentTheme],
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>
          {route.params.pageTitle || 'Artist'}
        </Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.coverWrap}>
          <Image
            source={{
              uri: subsonicService.getCoverArtUrl(artistData.id) || '',
            }}
            style={styles.coverImage}
          />
        </View>
        <Text numberOfLines={2} style={styles.artistName}>
          {artistData.name}
        </Text>
        <Text style={styles.metaText}>{formatCount(albums.length, "album")}</Text>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={playTopSongs}
            style={[styles.actionButton, styles.playButton]}
          >
            <Play size={16} color={'#FFFFFF'} fill={'#FFFFFF'} />
            <Text style={styles.playButtonText}>Play Top Songs</Text>
          </Pressable>
          <Pressable
            onPress={shuffleTopSongs}
            style={[styles.actionButton, styles.shuffleButton]}
          >
            <Shuffle size={16} color={colors.text} />
            <Text style={styles.shuffleButtonText}>Shuffle</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (isStarred(artistData.id, 'artist')) {
                unstar({ albumId: artistData.id });
              } else {
                star({ albumId: artistData.id });
              }
            }}
            style={styles.favouritesButton}
          >
            <Heart
              size={16}
              color={
                isStarred(artistData.id, 'artist') ? '#ef4444' : colors.text
              }
              fill={
                isStarred(artistData.id, 'artist') ? '#ef4444' : 'transparent'
              }
            />
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginTop: 32
          }}
        >
          <Text style={styles.sectionTitle}>TOP SONGS</Text>
        </View>
        {topSongs.length === 0 ? (
          <Text style={styles.emptyText}>No top songs found.</Text>
        ) : null}
      </View>

      {topSongs.slice(0, 5).map((item, index) => {
        const isActive = currentSongId === item.id;
        return (
          <Pressable
            key={item.id}
            android_ripple={{ color: colors.secondLayerThin }}
            onPress={() => playSong(topSongs, index)}
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
                {item.album}
              </Text>
            </View>
            <Text style={styles.trackDuration}>
              {formatDuration(item.duration)}
            </Text>
            <FlyoutTrigger onPress={() => openSongMenu(item, index)} />
          </Pressable>
        );
      })}
      <View style={{ paddingLeft: 16, marginTop: 32 }}>
        <AlbumCarousel
          title="Discography"
          fetchAlbums={async () => {
            const artistAlbums = await subsonicService.getArtist(
              route.params.artist.id,
            );
            if (
              artistAlbums.success &&
              (artistAlbums.data as SubsonicArtist)?.album
            ) {
              return (
                (artistAlbums.data as SubsonicArtist).album?.map(album => ({
                  ...album,
                  title: album.name,
                })) ?? []
              );
            }
            return [];
          }}
        />
      </View>
    </ScrollView>
  );
}

export default ArtistScreen;
