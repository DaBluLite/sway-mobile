import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import Text from '../../components/text';
import { Alert } from '../../components/custom-alert-api';
import { useAppTheme } from '../../contexts/theme-context';
import { useAudioPlayer } from '../../contexts/audio-player-context';
import {
  clearStorageCache,
  formatStorageBytes,
  getStorageStats,
  releaseStoragePlayback,
  type StorageStats,
} from '../../services/storage-service';

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unable to access storage. Please try again.';
}

export default function StorageSettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    theme: { colors },
  } = useAppTheme();
  const { stop, clearQueue, isPlaying, currentSongId, currentStation, queue } =
    useAudioPlayer();
  const needsPlaybackRelease =
    isPlaying || !!currentSongId || !!currentStation || queue.length > 0;
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);
  const confirming = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current || confirming.current) {
      return;
    }
    busy.current = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const next = await getStorageStats();
      if (mounted.current) {
        setStats(next);
      }
    } catch (err) {
      if (mounted.current) {
        setError(errorMessage(err));
      }
    } finally {
      busy.current = false;
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') {
          refresh();
        }
      });
      return () => subscription.remove();
    }, [refresh]),
  );

  const clear = useCallback(async () => {
    confirming.current = false;
    if (busy.current || !mounted.current) {
      return;
    }
    busy.current = true;
    setClearing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await clearStorageCache({
        releasePlayback: () => releaseStoragePlayback({ stop, clearQueue }),
      });
      if (mounted.current) {
        setStats(result.stats);
        if (result.retainedTemporaryPaths.length > 0) {
          const message =
            'Playback was stopped and the queue was cleared. Other cache files were cleared, but temporary playback files were kept because the player cannot confirm download cancellation. Wait a moment, then retry. Their presence alone does not mean a download is active.';
          setError(message);
          Alert.alert(
            'Cache partly cleared',
            result.failedPaths.length > 0
              ? `${message} Some other cache files also could not be removed.`
              : message,
          );
        } else if (result.failedPaths.length > 0) {
          const message =
            'Some cache files could not be removed. Usage has been refreshed; please try again later.';
          setError(message);
          Alert.alert('Cache partly cleared', message);
        } else {
          setNotice(
            result.stats.cacheBytes > 0
              ? 'Cache cleared. Some temporary files have already been recreated by the app.'
              : 'Cache cleared.',
          );
        }
      }
    } catch (err) {
      // A failed or blocked clear may still have removed some files.
      try {
        const next = await getStorageStats();
        if (mounted.current) {
          setStats(next);
        }
      } catch {
        if (mounted.current) {
          setStats(null);
        }
      }
      if (mounted.current) {
        const message = errorMessage(err);
        setError(message);
        Alert.alert('Unable to clear cache', message);
      }
    } finally {
      busy.current = false;
      if (mounted.current) {
        setClearing(false);
      }
    }
  }, [stop, clearQueue]);

  const confirmClear = useCallback(() => {
    if (busy.current || confirming.current) {
      return;
    }
    confirming.current = true;
    const cancel = () => {
      confirming.current = false;
    };
    Alert.alert(
      needsPlaybackRelease ? 'Stop playback and clear cache?' : 'Clear cache?',
      'Playback will stop, queued tracks will be removed and your playback position will be lost. Remove temporary playback audio and cached images? They will be downloaded again as needed. Settings, credentials, your library and files saved outside the app cache will not be removed. Cache downloads will be asked to cancel; temporary files that cannot be safely released will be kept for a later retry.',
      [
        { text: 'Cancel', style: 'cancel', onPress: cancel },
        {
          text: needsPlaybackRelease ? 'Stop and clear cache' : 'Clear cache',
          style: 'destructive',
          onPress: () => {
            clear();
          },
        },
      ],
      { cancelable: true, onDismiss: cancel },
    );
  }, [clear, needsPlaybackRelease]);

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
        title: { fontSize: 32, fontWeight: '100', color: colors.text },
        content: {
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 140,
          gap: 16,
        },
        row: {
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.secondLayerThin,
          gap: 6,
        },
        label: { color: colors.text, fontSize: 15, fontWeight: '600' },
        value: { color: colors.text, fontSize: 26, fontWeight: '300' },
        description: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
        error: { color: colors.notification, fontSize: 14, lineHeight: 20 },
        button: {
          padding: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.faint,
          backgroundColor: colors.secondLayerThin,
          alignItems: 'center',
        },
        destructive: {
          color: colors.notification,
          fontSize: 15,
          fontWeight: '600',
        },
        disabled: { opacity: 0.5 },
      }),
    [colors, insets],
  );
  const disabled = loading || clearing;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Storage</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              refresh();
            }}
            tintColor={colors.text}
          />
        }
      >
        <View style={styles.row}>
          <Text style={styles.label}>App cache</Text>
          <Text style={styles.value}>
            {stats ? formatStorageBytes(stats.cacheBytes) : '—'}
          </Text>
          <Text style={styles.description}>
            Disk usage of temporary app files, including playback audio and
            cached images.
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Available device space</Text>
          <Text style={styles.value}>
            {stats ? formatStorageBytes(stats.freeBytes) : '—'}
          </Text>
          {stats && (
            <Text style={styles.description}>
              of {formatStorageBytes(stats.totalBytes)} total device storage
            </Text>
          )}
        </View>
        {(loading || clearing) && (
          <View accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.text} />
            <Text style={styles.description}>
              {clearing ? 'Clearing cache…' : 'Reading storage…'}
            </Text>
          </View>
        )}
        {error && (
          <View accessibilityLiveRegion="polite">
            <Text style={styles.error}>{error}</Text>
            {stats && (
              <Text style={styles.description}>
                Values reflect the last successful storage read.
              </Text>
            )}
          </View>
        )}
        {notice && (
          <Text accessibilityLiveRegion="polite" style={styles.description}>
            {notice}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          style={[styles.button, disabled && styles.disabled]}
          onPress={() => {
            refresh();
          }}
        >
          <Text style={styles.label}>Refresh</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          style={[styles.button, disabled && styles.disabled]}
          onPress={confirmClear}
        >
          <Text style={styles.destructive}>Clear cache</Text>
        </Pressable>
        <Text style={styles.description}>
          Settings, credentials, your library and files saved outside the app
          cache are kept.
          Cache may grow again during normal use. Clearing stops playback and
          removes queued tracks after confirmation. Unreleased temporary
          download files are kept; wait and retry rather than restarting the
          app.
        </Text>
      </ScrollView>
    </View>
  );
}
