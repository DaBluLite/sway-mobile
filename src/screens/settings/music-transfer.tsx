import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Text from '../../components/text'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { useAppTheme } from '../../contexts/theme-context'
import {
  authorizeSpotify,
  hasSpotifyTokens,
} from '../../services/spotify-auth'

function MusicTransfer() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { theme: { colors } } = useAppTheme()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      await authorizeSpotify()
      navigation.navigate('TransferReview' as never)
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : 'Spotify authorization failed',
      )
    } finally {
      setConnecting(false)
    }
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: insets.top + 4,
          backgroundColor: colors.background,
        },
        headerRow: {
          alignItems: 'flex-start',
          gap: 8,
          marginBottom: 16,
          marginHorizontal: 16,
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
          fontWeight: '100',
          color: colors.text,
        },
        settingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.secondLayerThin,
          paddingHorizontal: 16,
        },
        textWrap: {
          flex: 1,
          minWidth: 0,
        },
        settingTitle: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        settingSubtitle: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 3,
        },
        sectionHeader: {
          flexDirection: 'column',
          gap: 2,
          marginBottom: 4,
          paddingHorizontal: 16,
        },
        sectionTitle: {
          color: colors.text,
          fontSize: 16,
        },
        errorText: {
          color: colors.notification,
          fontSize: 13,
          marginTop: 8,
          paddingHorizontal: 16,
        },
      }),
    [colors, insets],
  )

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Transfer Your Library</Text>
      </View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Select your music service</Text>
      </View>
      <Pressable
        onPress={handleConnect}
        disabled={connecting}
        android_ripple={{ color: colors.secondLayer }}
        style={styles.settingRow}
      >
        <View style={styles.textWrap}>
          <Text style={styles.settingTitle}>
            {connecting ? 'Connecting to Spotify…' : 'Spotify'}
          </Text>
          <Text style={styles.settingSubtitle}>
            {hasSpotifyTokens()
              ? 'Connected — continue to review your library'
              : 'Authorize to read your playlists, liked songs, albums and artists'}
          </Text>
        </View>
        {connecting && <ActivityIndicator color={colors.text} />}
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )
}

export default MusicTransfer
