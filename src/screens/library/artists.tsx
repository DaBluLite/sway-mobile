import { useMemo, useCallback } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../../components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibrary } from '../../contexts/library-context';
import { useAppTheme } from '../../contexts/theme-context';
import subsonicService from '../../utils/subsonic';
import { useNavigation } from '@react-navigation/native';
import { FlyoutTrigger, useFlyout } from '../../components/flyout-menu';
import { SubsonicArtist } from '../../types/subsonic';

function ArtistsScreen() {
  const insets = useSafeAreaInsets();
  const {
    theme: { colors },
  } = useAppTheme();
  const { openFlyout } = useFlyout();
  const { starred, loading, error, refreshStarred, isStarred, star, unstar } =
    useLibrary();
  const navigation = useNavigation();

  const artists = starred?.artist ?? [];

  const openArtistMenu = useCallback((artist: SubsonicArtist) => {
    const artistIsStarred = isStarred(artist.id, 'artist');

    openFlyout({
      title: artist.name,
      coverUrl: subsonicService.getCoverArtUrl(artist.id) || undefined,
      actions: [
        {
          id: `open-${artist.id}`,
          label: 'Open artist',
          onPress: () =>
            navigation.navigate(
              ...([
                'ArtistDetail',
                { artist, pageTitle: artist.name },
              ] as never),
            ),
        },
        {
          id: `favourite-${artist.id}`,
          label: artistIsStarred
            ? 'Remove from favourites'
            : 'Add to favourites',
          onPress: async () => {
            if (artistIsStarred) {
              await unstar({ artistId: artist.id });
              return;
            }

            await star({ artistId: artist.id });
          },
        },
      ],
    });
  }, [navigation, openFlyout, star, unstar, isStarred]);

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
          width: 56,
          height: 56,
          borderRadius: 64,
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

  const renderItem = useCallback(({item}: { item: SubsonicArtist, index: number }) => {
          const coverUri = subsonicService.getCoverArtUrl(item.id);
          return (
            <Pressable
              onPress={() =>
                navigation.navigate(
                  ...([
                    'ArtistDetail',
                    { artist: item, pageTitle: item.name },
                  ] as never),
                )
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
              </View>
              <FlyoutTrigger onPress={() => openArtistMenu(item)} />
            </Pressable>
          );
        }, [navigation, openArtistMenu, styles.albumTitle, styles.coverFallback, styles.coverImage, styles.coverWrap, styles.row, styles.textWrap]);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Artists</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={artists}
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

export default ArtistsScreen;
