import { useMemo, useState, useCallback } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../../components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/theme-context';
import subsonicService from '../../utils/subsonic';
import { useNavigation } from '@react-navigation/native';
import { usePlaylists } from '../../contexts/playlists-context';
import { useCarHomeSlots } from '../../contexts/carhome-slots-context';
import { FlyoutTrigger, useFlyout } from '../../components/flyout-menu';
import { SubsonicPlaylist, SubsonicSong } from '../../types/subsonic';
import { useAudioPlayer } from '../../contexts/audio-player-context';
import TextPromptModal from '../../components/text-prompt-modal';
import { Plus } from 'lucide-react-native';

function PlaylistsScreen() {
  const insets = useSafeAreaInsets();
  const {
    theme: { colors },
  } = useAppTheme();
  const { openFlyout } = useFlyout();
  const navigation = useNavigation();
  const { openSaveToSlotMenu } = useCarHomeSlots();
  const {
    playlists,
    loading,
    refreshPlaylists,
    deletePlaylist,
    updatePlaylist,
  } = usePlaylists();
  const { playSong } = useAudioPlayer();
  const [editingPlaylist, setEditingPlaylist] =
    useState<SubsonicPlaylist | null>(null);
  const [draftPlaylistName, setDraftPlaylistName] = useState('');

  const playPlaylist = useCallback(async (playlist: SubsonicPlaylist) => {
    const result = await subsonicService.getPlaylist(playlist.id);
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to load playlist tracks');
    }

    const songs = (result.data as { entry?: SubsonicSong[] }).entry ?? [];
    if (!songs.length) {
      throw new Error('No tracks available in this playlist');
    }

    playSong(songs, 0);
  }, [playSong]);

  const openPlaylistMenu = useCallback((playlist: SubsonicPlaylist) => {
    openFlyout({
      title: playlist.name,
      subtitle: `${playlist.songCount} tracks`,
      actions: [
        {
          id: `open-${playlist.id}`,
          label: 'Open playlist',
          onPress: () =>
            navigation.navigate(...(['Playlist', { playlist }] as never)),
        },
        {
          id: `play-${playlist.id}`,
          label: 'Play playlist',
          onPress: async () => {
            try {
              await playPlaylist(playlist);
            } catch (error) {
              Alert.alert(
                'Unable to play playlist',
                error instanceof Error ? error.message : 'Please try again.',
              );
            }
          },
        },
        {
          id: `edit-${playlist.id}`,
          label: 'Edit playlist',
          onPress: () => {
            setEditingPlaylist(playlist);
            setDraftPlaylistName(playlist.name);
          },
        },
        {
          id: `slot-${playlist.id}`,
          label: 'Save to speed dial',
          onPress: () =>
            openSaveToSlotMenu({ type: 'playlist', playlist }),
        },
        {
          id: `delete-${playlist.id}`,
          label: 'Delete playlist',
          destructive: true,
          onPress: () => {
            Alert.alert(
              'Delete playlist?',
              `This will permanently delete ${playlist.name}.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deletePlaylist(playlist.id);
                    } catch (error) {
                      Alert.alert(
                        'Unable to delete playlist',
                        error instanceof Error
                          ? error.message
                          : 'Please try again.',
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    });
  }, [deletePlaylist, navigation, openFlyout, openSaveToSlotMenu, playPlaylist]);

  const closeRenameModal = () => {
    setEditingPlaylist(null);
    setDraftPlaylistName('');
  };

  const saveRename = async () => {
    if (!editingPlaylist) return;
    const nextName = draftPlaylistName.trim();
    if (!nextName) {
      Alert.alert('Playlist name required', 'Please enter a playlist name.');
      return;
    }

    try {
      await updatePlaylist(editingPlaylist.id, nextName);
      closeRenameModal();
    } catch (error) {
      Alert.alert(
        'Unable to update playlist',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: insets.top + 4,
          paddingHorizontal: 16,
          backgroundColor: colors.background,
        },
        title: {
          fontSize: 32,
          fontWeight: '300',
          color: colors.text,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 12,
        },
        createButton: {
          padding: 8,
          borderRadius: 64,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        listContent: {
          paddingBottom: insets.bottom + 140,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.secondLayerThin,
        },
        coverWrap: {
          width: 56,
          height: 56,
          borderRadius: 8,
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
          fontWeight: '500',
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

  const renderItem = useCallback(({item}: { item: SubsonicPlaylist, index: number }) => {
          const coverUri = item.coverArt
            ? subsonicService.getCoverArtUrl(item.coverArt)
            : null;
          return (
            <Pressable
              onPress={() =>
                navigation.navigate(
                  ...(['Playlist', { playlist: item }] as never),
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
                <Text numberOfLines={1} style={styles.subtitle}>
                  by {item.owner}
                </Text>
                <Text numberOfLines={1} style={styles.subtitle}>
                  {item.songCount} tracks
                </Text>
              </View>
              <FlyoutTrigger onPress={() => openPlaylistMenu(item)} />
            </Pressable>
          );
        }, [navigation, openPlaylistMenu, styles.albumTitle, styles.coverFallback, styles.coverImage, styles.coverWrap, styles.row, styles.subtitle, styles.textWrap]);
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Playlists</Text>
        <Pressable
          style={styles.createButton}
          onPress={() => navigation.navigate('CreatePlaylist' as never)}
        >
          <Plus size={20} color={colors.text} />
        </Pressable>
      </View>
      <TextPromptModal
        visible={Boolean(editingPlaylist)}
        title="Edit playlist"
        value={draftPlaylistName}
        onChangeValue={setDraftPlaylistName}
        onCancel={closeRenameModal}
        onConfirm={saveRename}
        confirmLabel="Save"
        placeholder="Playlist name"
      />
      <FlatList
        data={playlists}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={refreshPlaylists}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.helperText}>
            {loading ? 'Loading playlists...' : 'No playlists yet.'}
          </Text>
        }
      />
    </View>
  );
}

export default PlaylistsScreen;
