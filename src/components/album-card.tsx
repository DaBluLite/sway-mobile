import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Text from './text';
import { Disc3, Heart, HeartMinus, List, ListStart, Play, User2 } from 'lucide-react-native';
import { useAudioPlayer } from '../contexts/audio-player-context';
import { SubsonicAlbum, SubsonicSong } from '../types/subsonic';
import subsonicService from '../utils/subsonic';
import { useAppTheme } from '../contexts/theme-context';
import { useLibrary } from '../contexts/library-context';
import { useCarHomeSlots } from '../contexts/carhome-slots-context';
import { useFlyout } from './flyout-menu';
import { Alert } from './custom-alert-api';
import TouchableScale from './touchable-scale';

// Extending SubsonicAlbum to handle both getAlbumList and getAlbum response structures
type ExtendedAlbum = SubsonicAlbum & { title: string };

interface AlbumCardProps {
  album: ExtendedAlbum;
  width: number;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({
  album,
  width,
}: AlbumCardProps) => {
  const {
    theme: { colors },
  } = useAppTheme();
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const { isStarred, star, unstar } = useLibrary();
  const { playSong, queueNext } = useAudioPlayer();
  const navigation = useNavigation();
  const { openFlyout } = useFlyout();
  const { openSaveToSlotMenu } = useCarHomeSlots();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width,
        },
        imageContainer: {
          width: '100%',
          aspectRatio: 1,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: colors.secondLayerThin,
          position: 'relative',
        },
        image: {
          width: '100%',
          height: '100%',
        },
        fallback: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: {
          color: colors.text,
          fontSize: 12,
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
  );

  useEffect(() => {
    const url = album.coverArt
      ? subsonicService.getCoverArtUrl(album.coverArt, width)
      : null;
    setCoverUrl(url);
  }, [album.coverArt, width]);

  const queueAlbumNext = useCallback(async () => {
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
  }, [album.id, queueNext]);

  const handlePlay = useCallback(async () => {
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
  }, [album.id, playSong]);

  const openAlbumMenu = useCallback(() => {
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
              await handlePlay();
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
              await queueAlbumNext();
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
  }, [
    album,
    handlePlay,
    isStarred,
    navigation,
    openFlyout,
    openSaveToSlotMenu,
    queueAlbumNext,
    star,
    unstar,
  ]);

  const artistNames = album.artists.map(artist => artist.name).join(', ');

  const handleNavigate = () => {
    navigation.navigate(...(['Album', { album }] as never));
  };

  return (
    <TouchableScale
      onLongPress={openAlbumMenu}
      onPress={handleNavigate}
      style={styles.card}
    >
      <View style={styles.imageContainer}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.image} />
        ) : (
          <View style={styles.fallback}>
            <Disc3 size={22} color={colors.text} opacity={0.25} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {album.title || album.name}
      </Text>
      <Text numberOfLines={1} style={styles.artists}>
        {artistNames}
      </Text>
    </TouchableScale>
  );
};
