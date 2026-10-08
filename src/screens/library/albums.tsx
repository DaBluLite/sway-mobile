import { useMemo, useCallback } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../../components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibrary } from '../../contexts/library-context';
import { useAppTheme } from '../../contexts/theme-context';
import subsonicService from '../../utils/subsonic';
import { useNavigation } from '@react-navigation/native';
import { FlyoutTrigger, useFlyout } from '../../components/flyout-menu';
import { useAudioPlayer } from '../../contexts/audio-player-context';
import { useCarHomeSlots } from '../../contexts/carhome-slots-context';
import { SubsonicAlbum, SubsonicSong } from '../../types/subsonic';

function AlbumsScreen() {
  const insets = useSafeAreaInsets();
  const {
    theme: { colors },
  } = useAppTheme();
  const { openFlyout } = useFlyout();
  const { starred, loading, error, refreshStarred, isStarred, star, unstar } =
    useLibrary();
  const { playSong, queueNext } = useAudioPlayer();
  const { openSaveToSlotMenu } = useCarHomeSlots();
  const navigation = useNavigation();

  const albums = starred?.album ?? [];

  const playAlbum = useCallback(async (album: SubsonicAlbum) => {
    const result = await subsonicService.getAlbum(album.id);
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to load album tracks');
    }

    const songs = (result.data as { song?: SubsonicSong[] }).song ?? [];
    if (!songs.length) {
      throw new Error('No tracks available in this album');
    }

    playSong(songs, 0);
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
        },
        {
          id: `slot-${album.id}`,
          label: 'Save to speed dial',
          onPress: () => openSaveToSlotMenu({ type: 'album', album }),
        },
      ],
    });
  }, [isStarred, navigation, openFlyout, openSaveToSlotMenu, playAlbum, queueAlbumNext, star, unstar]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: insets.top + 4,
          backgroundColor: colors.background,
        },
        title: {
          fontSize: 32,
          fontWeight: '300',
          color: colors.text,
          marginBottom: 16,
          paddingHorizontal: 16,
        },
        listContent: {
          paddingBottom: insets.bottom + 140,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 6,
          paddingHorizontal: 16,
        },
        coverWrap: {
          width: 64,
          height: 64,
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
          fontSize: 16,
        },
        textWrap: {
          flex: 1,
          minWidth: 0,
        },
        albumTitle: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        subtitle: {
          color: colors.textMuted,
          fontSize: 14,
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

  const renderItem = useCallback(({item}: { item: SubsonicAlbum, index: number }) => {
          const coverUri = item.coverArt
            ? subsonicService.getCoverArtUrl(item.coverArt)
            : null;
          return (
            <Pressable
              onLongPress={() => openAlbumMenu(item)}
              onPress={() =>
                navigation.navigate(...(['Album', { album: item }] as never))
              }
              style={styles.row}
            >
              <View style={styles.coverWrap}>
                {coverUri ? (
                  <Image source={{ uri: coverUri }} style={styles.coverImage} />
                ) : (
                  <Text style={styles.coverFallback}>◉</Text>
                )}
              </View>
              <View style={styles.textWrap}>
                <Text numberOfLines={1} style={styles.albumTitle}>
                  {item.name}
                </Text>
                <Text numberOfLines={1} style={styles.subtitle}>
                  {item.artists.map(artist => artist.name).join(', ')}
                </Text>
                <Text numberOfLines={1} style={styles.subtitle}>
                  {item.year}
                </Text>
              </View>
              <FlyoutTrigger onPress={() => openAlbumMenu(item)} />
            </Pressable>
          );
        }, [openAlbumMenu, navigation, styles.row, styles.coverWrap, styles.coverImage, styles.coverFallback, styles.textWrap, styles.albumTitle, styles.subtitle]);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Albums</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={albums}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={refreshStarred}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.helperText}>
            {loading ? 'Loading starred albums...' : 'No starred albums yet.'}
          </Text>
        }
      />
    </View>
  );
}

export default AlbumsScreen;
