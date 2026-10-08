import { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from '../../components/text'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { useAppTheme } from '../../contexts/theme-context'
import { usePlaylists } from '../../contexts/playlists-context'

function parseSongIds(value: string): string[] {
  return value
    .split(/[\n,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function CreatePlaylistScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const { theme: { colors } } = useAppTheme()
  const { createPlaylist } = usePlaylists()

  const [name, setName] = useState('')
  const [songIdsInput, setSongIdsInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top + 4,
          paddingHorizontal: 16,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        },
        backButton: {
          padding: 8,
          borderRadius: 64,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        title: {
          fontSize: 32,
          fontWeight: '100',
          color: colors.text,
        },
        content: {
          paddingBottom: insets.bottom + 140,
        },
        fieldLabel: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 8,
          marginTop: 12,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.faint,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.text,
          backgroundColor: colors.secondLayerThin,
        },
        multilineInput: {
          minHeight: 110,
          textAlignVertical: 'top',
        },
        helperText: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 6,
          lineHeight: 18,
        },
        createButton: {
          marginTop: 24,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
        },
        createButtonDisabled: {
          opacity: 0.6,
        },
        createButtonText: {
          color: '#ffffff',
          fontSize: 15,
          fontWeight: '700',
        },
      }),
    [colors, insets],
  )

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      Alert.alert('Playlist name required', 'Please enter a playlist name.')
      return
    }

    const songIds = parseSongIds(songIdsInput)

    try {
      setIsSaving(true)
      await createPlaylist(trimmedName, songIds)
      navigation.goBack()
    } catch (error) {
      Alert.alert('Unable to create playlist', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Create Playlist</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="My Playlist"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoCapitalize="sentences"
          autoCorrect
          returnKeyType="done"
        />

        <Text style={styles.fieldLabel}>Initial Song IDs (optional)</Text>
        <TextInput
          value={songIdsInput}
          onChangeText={setSongIdsInput}
          placeholder="song-id-1, song-id-2"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.multilineInput]}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.helperText}>
          You can provide song IDs separated by commas, spaces, or new lines.
        </Text>

        <Pressable
          onPress={handleCreate}
          style={[styles.createButton, isSaving && styles.createButtonDisabled]}
          disabled={isSaving}
        >
          <Text style={styles.createButtonText}>{isSaving ? 'Creating...' : 'Create Playlist'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

export default CreatePlaylistScreen
