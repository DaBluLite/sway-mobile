import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  GestureResponderEvent,
  Image,
  Pressable,
  ScrollView,
  ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Cast,
  Cast as CastIcon,
  ChevronDown,
  Disc3,
  EllipsisVertical,
  Heart,
  HeartMinus,
  List,
  ListMusic,
  MicVocal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  User2,
} from 'lucide-react-native';
import { useAudioPlayer } from '../contexts/audio-player-context';
import subsonicService from '../utils/subsonic';
import { useLibrary } from '../contexts/library-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useAppTheme } from '../contexts/theme-context';
import { useFavourites } from '../contexts/favourites-context';
import {
  AlbumArtResult,
  fetchTrackDataCached,
  LyricsResult,
  TrackInfo,
} from '../utils/lyrics';
import { SubsonicSong } from '../types/subsonic';
import { usePlaylists } from '../contexts/playlists-context';
import { useFlyout } from '../components/flyout-menu';
import { Station } from 'radio-browser-api';
import { useCurations } from '../contexts/curations-context';
import { useCarHomeSlots } from '../contexts/carhome-slots-context';
import { BtCodec } from '../utils/btCodec';
import { formatArtists } from '../utils/format';
import Text from '../components/text';

const DISMISS_THRESHOLD = 200;
const VELOCITY_THRESHOLD = 500;

function useDelayedMount(isActive: boolean, duration = 200) {
  const [shouldMount, setShouldMount] = useState(isActive);
  const [isVisible, setIsVisible] = useState(isActive);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isActive) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setShouldMount(true);
      // defer visible to next tick so transition triggers
      const id = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setIsVisible(false);
    timeoutRef.current = setTimeout(() => setShouldMount(false), duration);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isActive, duration]);

  return { shouldMount, isVisible };
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function QueueItem({
  openSongMenu,
  playFromQueue,
  item,
  currentSongId,
  position = 'after',
}: {
  openSongMenu: (item: SubsonicSong) => void;
  playFromQueue: (songId: string) => void;
  item: SubsonicSong;
  currentSongId: string | null;
  position?: 'before' | 'after';
}) {
  const {
    theme: { colors },
  } = useAppTheme();
  const [coverError, setCoverError] = useState(false);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 8,
          paddingHorizontal: 16,
          opacity: position === 'before' ? 0.6 : 1,
        },
        coverWrap: {
          width: 48,
          height: 48,
          borderRadius: 4,
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
          color: "#b3b3b3",
          fontSize: 14,
        },
        textWrap: {
          flex: 1,
          minWidth: 0,
        },
        trackTitle: {
          color: "#FFFFFF",
          fontSize: 15,
        },
        activeTitle: {
          color: colors.primary,
        },
        subtitle: {
          color: "#b3b3b3",
          fontSize: 12,
          marginTop: 3,
        },
      }),
    [
      colors.primary,
      colors.secondLayerThin,
      position,
    ],
  );
  const isActive = currentSongId === item.id;
  const coverUri = subsonicService.getCoverArtUrl(item.coverArt, 48);
  return (
    <Pressable
      onLongPress={() => openSongMenu(item)}
      onPress={() => playFromQueue(item.id)}
      style={styles.row}
      android_ripple={{ color: colors.secondLayerThin }}
    >
      <View style={styles.coverWrap}>
        {coverUri && !coverError ? (
          <Image src={coverUri} onError={(e) => {
            setCoverError(true)
            console.warn(e.nativeEvent.error)
          }} style={styles.coverImage} />
        ) : (
          <Disc3 color={"#FFFFFF"} size={16}/>
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
          {formatArtists(item.artists)}
        </Text>
      </View>
    </Pressable>
  );
}

function HistoryItem({
  active = false,
  station,
  item,
}: {
  active: boolean;
  station: Station;
  item:
    | {
        type: 'song';
        track: TrackInfo;
        albumArt: AlbumArtResult;
      }
    | {
        type: 'intermission';
      };
}) {
  const {
    theme: { colors },
  } = useAppTheme();
  const [coverError, setCoverError] = useState(false);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 8,
          paddingHorizontal: 16,
        },
        coverWrap: {
          width: 48,
          height: 48,
          borderRadius: 4,
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
          color: "#b3b3b3",
          fontSize: 14,
        },
        textWrap: {
          flex: 1,
          minWidth: 0,
        },
        trackTitle: {
          color: "#FFFFFF",
          fontSize: 15,
        },
        activeTitle: {
          color: colors.primary,
        },
        subtitle: {
          color: "#b3b3b3",
          fontSize: 12,
          marginTop: 3,
        },
      }),
    [colors.primary, colors.secondLayerThin],
  );
  const coverUri =
    item.type === 'song' ? item.albumArt.imageUrl : station.favicon || null;
  return (
    <Pressable style={styles.row}>
      <View style={styles.coverWrap}>
        {coverUri && !coverError ? (
          <Image
            source={{ uri: coverUri }}
            style={styles.coverImage}
            onError={() => setCoverError(true)}
          />
        ) : (
          <Text style={styles.coverFallback}>♪</Text>
        )}
      </View>
      <View style={styles.textWrap}>
        <Text
          numberOfLines={1}
          style={[styles.trackTitle, active && styles.activeTitle]}
        >
          {item.type === 'song' ? item.track.title : 'Intermission'}
        </Text>
        {item.type === 'song' && (
          <Text numberOfLines={1} style={styles.subtitle}>
            {item.track.artist}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function CastScreen({ styles, isVisible, coverUrl }: { styles: { [style: string]: { [key: string]: any } }, isVisible: boolean, coverUrl: string | null }) {
  const { castDevices, castState, connectedCastDevice, isCasting, castStartSession, castEndSession } = useAudioPlayer();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  return <Animated.View style={[styles.lyricsScreen, isVisible && styles.lyricsScreenOpen, { transitionProperty: ['opacity','transform'], transitionDuration: '200ms', transitionTimingFunction: 'ease-in-out' }]}>
    {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.backgroundArtwork} blurRadius={46} /> : <View style={[styles.backgroundArtwork, { backgroundColor: "#000000" }]} />}
    <View pointerEvents="none" style={styles.backgroundOverlaySecondary} />
    <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingVertical: 16, gap: 12 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: '500', paddingHorizontal: 0, paddingBottom: 8 }}>Cast</Text>
      {isCasting && connectedCastDevice && (
        <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, gap: 8 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 14 }}>Connected to {connectedCastDevice.name}</Text>
          <Pressable onPress={() => castEndSession()} style={{ backgroundColor: '#ef4444', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Disconnect</Text>
          </Pressable>
        </View>
      )}
      {castState === 'connecting' && <ActivityIndicator color="#FFFFFF" />}
      {castDevices.length === 0 ? (
        <View style={styles.lyricsCenterState}><Text style={styles.lyricsStateText}>{castState === 'no_devices_available' ? 'No Cast devices found' : 'Searching for devices...'}</Text></View>
      ) : (
        castDevices.map(d => (
          <Pressable key={d.id} onPress={async () => { setLoadingId(d.id); try { await castStartSession(d.id); } catch (e) { Alert.alert('Cast failed', e instanceof Error ? e.message : String(e)); } finally { setLoadingId(null); } }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
            <Cast size={20} color="#FFFFFF" />
            <View style={{ flex: 1 }}><Text style={{ color: "#FFFFFF", fontSize: 15 }}>{d.name}</Text>{d.modelName ? <Text style={{ color: "#b3b3b3", fontSize: 12 }}>{d.modelName}</Text> : null}</View>
            {loadingId === d.id ? <ActivityIndicator color="#FFFFFF" /> : connectedCastDevice?.id === d.id ? <Text style={{ color: "#22c55e", fontSize: 12 }}>Connected</Text> : null}
          </Pressable>
        ))
      )}
    </ScrollView>
  </Animated.View>;
}

function LyricsScreen({ styles, isVisible, coverUrl, currentTime, currentStationSong, currentSong, currentStation, seek }: { styles: { [style: string]: { [key: string]: any } }, isVisible: boolean, coverUrl: string | null, title: string, subtitle: string, setActiveSubScreen(screen: 'player' | 'lyrics' | 'queue' | 'cast'): void, navigation: any, currentTime: number, currentStationSong: { track: TrackInfo; albumArt: AlbumArtResult } | null, currentSong: SubsonicSong | null, currentStation: Station | null, seek(time: number): void }) {
  const [lyricsResult, setLyricsResult] = useState<LyricsResult | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);
  const lyricsScrollRef = useRef<ScrollViewInstance | null>(null);
  const lyricLineOffsetsRef = useRef<Record<number, number>>({});

  const lyricsArtist =
    formatArtists(currentSong?.artists || []) ??
    currentStationSong?.track.artist.trim() ??
    '';
  const lyricsTitle =
    currentSong?.title?.trim() ?? currentStationSong?.track.title.trim() ?? '';
  const lyricsTrackKey = currentSong
    ? `${currentSong.id}:${lyricsArtist}:${lyricsTitle}`
    : currentStation
    ? `${currentStation.id}:${lyricsArtist}:${lyricsTitle}`
    : null;

  const syncedLyrics = currentSong ? lyricsResult?.syncedLyrics : null;
  const plainLyrics = lyricsResult?.lyrics ?? null;
  const activeLyricIndex = useMemo(() => {
    if (!syncedLyrics || syncedLyrics.length === 0) return -1;
    let index = -1;
    for (let i = 0; i < syncedLyrics.length; i += 1) {
      if (currentTime >= syncedLyrics[i].time) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [currentTime, syncedLyrics]);

  useEffect(() => {
    if (!isVisible || activeLyricIndex < 0) return;

    const y = lyricLineOffsetsRef.current[activeLyricIndex];
    if (typeof y !== 'number') return;

    lyricsScrollRef.current?.scrollTo({
      y: Math.max(0, y - 140),
      animated: true,
    });
  }, [activeLyricIndex, isVisible]);

  useEffect(() => {
    let isMounted = true;

    if (!lyricsTrackKey || !lyricsArtist || !lyricsTitle) {
      setLyricsResult(null);
      setLyricsError(null);
      setLyricsLoading(false);
      return;
    }

    const loadLyrics = async () => {
      try {
        setLyricsLoading(true);
        setLyricsError(null);
        lyricLineOffsetsRef.current = {};

        const result = await fetchTrackDataCached(
          `${lyricsArtist} - ${lyricsTitle}`,
          lyricsArtist,
          lyricsTitle,
        );

        if (!isMounted) return;

        setLyricsResult(
          currentSong
            ? result.lyrics
            : {
                ...result.lyrics,
                source:
                  result.lyrics.source &&
                  result.lyrics.source.replace(' (synced)', ''),
              },
        );

        if (!result.lyrics.lyrics && !result.lyrics.syncedLyrics) {
          setLyricsError(result.lyrics.error ?? 'Lyrics not found');
        }
      } catch {
        if (!isMounted) return;
        setLyricsResult(null);
        setLyricsError('Failed to load lyrics');
      } finally {
        if (!isMounted) return;
        setLyricsLoading(false);
      }
    };

    loadLyrics();

    return () => {
      isMounted = false;
    };
  }, [
    lyricsTrackKey,
    lyricsArtist,
    lyricsTitle,
    currentStationSong,
    currentSong,
    currentStation,
  ]);

  return <Animated.View
    style={[
      styles.lyricsScreen,
      isVisible && styles.lyricsScreenOpen,
      {
        transitionProperty: ['opacity', 'transform'],
        transitionDuration: '200ms',
        transitionTimingFunction: 'ease-in-out',
      },
    ]}
  >
    {coverUrl ? (
      <Image
        source={{ uri: coverUrl }}
        style={styles.backgroundArtwork}
        blurRadius={46}
      />
    ) : <View
      style={[styles.backgroundArtwork, { backgroundColor: "#000000" }]}
    />}
    <View
      pointerEvents="none"
      style={styles.backgroundOverlaySecondary}
    />
    {lyricsLoading ? (
      <View style={styles.lyricsCenterState}>
        <ActivityIndicator color="#FFFFFF" />
        <Text style={styles.lyricsStateText}>Loading lyrics...</Text>
      </View>
    ) : lyricsError ? (
      <View style={styles.lyricsCenterState}>
        <Text style={styles.lyricsStateText}>{lyricsError}</Text>
      </View>
    ) : syncedLyrics && syncedLyrics.length > 0 ? (
      <ScrollView
        ref={lyricsScrollRef}
        style={styles.lyricsScroll}
        contentContainerStyle={styles.syncedLyricsContent}
      >
        {syncedLyrics.map((line, index) => (
          <Animated.Text
            key={`${line.time}-${line.text}`}
            suppressHighlighting
            onPress={() => {
              if (!currentSong || !line.time) return;
              seek(line.time);
            }}
            onLayout={event => {
              lyricLineOffsetsRef.current[index] =
                event.nativeEvent.layout.y;
            }}
            style={[
              styles.syncedLyricLine,
              index === activeLyricIndex &&
                styles.syncedLyricLineActive,
              {
                transitionProperty: ['transform', 'color'],
                transitionDuration: '500ms',
                transitionTimingFunction: 'ease-in-out',
              },
            ]}
          >
            {line.text}
          </Animated.Text>
        ))}
      </ScrollView>
    ) : plainLyrics ? (
      <ScrollView
        style={styles.lyricsScroll}
        contentContainerStyle={styles.plainLyricsContent}
      >
        <Text style={styles.plainLyricsText}>{plainLyrics}</Text>
      </ScrollView>
    ) : (
      <View style={styles.lyricsCenterState}>
        <Text style={styles.lyricsStateText}>
          No lyrics available for this track.
        </Text>
      </View>
    )}

    {lyricsResult?.source && <View style={styles.lyricsFooter}>
      <Text style={styles.lyricsSourceText}>
        Source: {lyricsResult?.source ?? 'Unknown'}
      </Text>
    </View>}
  </Animated.View>
}

function NowPlayingScreen() {
  const navigation = useNavigation();
  const {
    theme: { colors, shadows },
  } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [progressBarWidth, setProgressBarWidth] = useState(1);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [seekPreviewRatio, setSeekPreviewRatio] = useState(0);
  const [activeSubScreen, setActiveSubScreen] = useState<
    'player' | 'lyrics' | 'queue' | 'cast'
  >('player');

  const translateY = useSharedValue(0);
  const scrollRef = useRef<any>(undefined);

  // Mount with delay so close animation can finish before unmount (except main player)
  const { shouldMount: shouldMountLyrics, isVisible: isLyricsVisible } = useDelayedMount(activeSubScreen === 'lyrics');
  const { shouldMount: shouldMountCast, isVisible: isCastVisible } = useDelayedMount(activeSubScreen === 'cast');
  const { shouldMount: shouldMountQueue, isVisible: isQueueVisible } = useDelayedMount(activeSubScreen === 'queue');

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(
      translateY.value,
      [0, 300],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // Slides the screen down while fading, then navigates back once the
  // animation has completed. Used by the drag, the close button and the
  // hardware back button so every close path fades.
  const closePlayer = useCallback(() => {
    translateY.value = withTiming(
      800,
      { duration: 400, easing: Easing.in(Easing.cubic) },
      isFinished => {
        if (isFinished) scheduleOnRN(navigation.goBack);
      },
    );
  }, [navigation.goBack, translateY]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-100, 100])
    .onChange(e => {
      // Only allow dragging down
      translateY.value = Math.max(0, translateY.value + e.changeY);
    })
    .onEnd(e => {
      const shouldDismiss =
        translateY.value > DISMISS_THRESHOLD ||
        e.velocityY > VELOCITY_THRESHOLD;

      if (shouldDismiss) {
        scheduleOnRN(closePlayer);
      } else {
        translateY.value = withSpring(0, {
          damping: 25,
          stiffness: 300,
          mass: 1,
          overshootClamping: true,
        });
      }
    })
    .simultaneousWithExternalGesture(scrollRef);

  const {
    currentSong,
    currentStation,
    currentStationSong,
    currentTime,
    duration,
    isPlaying,
    isSeekable,
    shuffle,
    repeat,
    playNext,
    playPrevious,
    playFromQueue,
    pause,
    resume,
    toggleShuffle,
    setRepeat,
    seek,
    queue,
    stationPlayHistory,
  } = useAudioPlayer();

  const { isFavourite, toggleFavourite } = useFavourites();

  const title =
    currentSong?.title ??
    currentStationSong?.track.title.trim() ??
    currentStation?.name ??
    'Nothing is playing';
  const subtitle =
    currentSong?.artists ? formatArtists(currentSong?.artists || []) : currentStationSong?.track.artist.trim() ?? '';

  const coverUrl = useMemo(() => {
    if (currentSong?.coverArt) {
      return subsonicService.getCoverArtUrl(currentSong.coverArt);
    }

    if (currentStationSong) return currentStationSong.albumArt.imageUrl;

    if (currentStation?.favicon) {
      return currentStation.favicon;
    }

    return null;
  }, [currentStationSong, currentSong, currentStation]);

  const progress =
    duration > 0 ? Math.max(0, Math.min(currentTime / duration, 1)) : 0;
  const visualProgress = isDraggingSeek ? seekPreviewRatio : progress;

  const updateSeekPreview = (event: GestureResponderEvent) => {
    if (!isSeekable || duration <= 0 || progressBarWidth <= 0) {
      return;
    }

    const nextRatio = Math.max(
      0,
      Math.min(event.nativeEvent.locationX / progressBarWidth, 1),
    );
    setSeekPreviewRatio(nextRatio);
  };

  const commitSeek = () => {
    if (!isSeekable || duration <= 0) {
      setIsDraggingSeek(false);
      return;
    }

    seek(seekPreviewRatio * duration);
    setIsDraggingSeek(false);
  };

  const handleRepeatPress = async () => {
    if (repeat === 'off') {
      setRepeat('track');
      return;
    }

    if (repeat === 'track') {
      setRepeat('queue');
      return;
    }

    setRepeat('off');
  };

  const repeatColor = repeat === 'off' ? "#b3b3b3" : '#FFFFFF';
  const songBitDepth = currentSong?.bitDepth || 0;
  const songSamplingRate = currentSong?.samplingRate || 0;
  const stationBitrate = currentStation?.bitrate || 0;
  const [isCodecSynced, setCodecSynced] = useState(false);
  const [usbDirect, setUsbDirect] = useState(false);
  const [usbState, setUsbState] = useState<any>(null);

  useEffect(() => {
    async function checkSync() {
      setCodecSynced(false);
      setUsbDirect(false);
      // Bluetooth
      try { const c = await BtCodec.getCurrentCodecInfo(); if (c.bitsPerSample === songBitDepth && c.sampleRate === songSamplingRate) setCodecSynced(true); } catch {}
      // USB - best-effort DIRECT flag from UsbAudioModule playback state
      try {
        const { UsbAudio } = await import('../utils/usbAudio');
        const st = await UsbAudio.getPlaybackState();
        setUsbState(st);
        if (st?.exclusiveGranted && st?.directSupported && st?.appliedSampleRate === songSamplingRate && st?.appliedBitDepth === songBitDepth) setUsbDirect(true);
        // also update on live param changes
        const sub = UsbAudio.addListener('UsbAudioParamsApplied', (p: any) => {
          if (p.appliedSampleRate === songSamplingRate && p.appliedBitDepth === songBitDepth && p.directSupported) setUsbDirect(true); else setUsbDirect(false);
        });
        return () => sub.remove();
      } catch {}
    }
    const cleanup = checkSync();
    return () => { (cleanup as any)?.then?.((fn: any) => fn?.()); };
  }, [songBitDepth, songSamplingRate]);

  const isCdQuality =
    (songBitDepth === 16 && songSamplingRate === 44100) ||
    stationBitrate === 1411;
  const isLosslessQuality =
    songBitDepth > 16 || songSamplingRate > 44100 || stationBitrate > 1411;

  const { isStarred, star, unstar } = useLibrary();
  const { playlists, addSongToPlaylist } = usePlaylists();
  const { openFlyout } = useFlyout();
  const { collections, addStationToCollection } = useCurations();
  const { openSaveToSlotMenu } = useCarHomeSlots();

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

  const openSongMenu = (song: SubsonicSong) => {
    const songIsStarred = isStarred(song.id, 'song');

    openFlyout({
      title: song.title,
      subtitle: `${song.artist} • ${song.album}`,
      coverUrl: subsonicService.getCoverArtUrl(song.coverArt) || undefined,
      actions: [
        {
          id: `album-${song.id}`,
          label: 'Go to album',
          icon: Disc3,
          onPress: async () => {
            try {
              const res = await subsonicService.getAlbum(song.albumId);
              if (res.success && res.data) {
                navigation.navigate(
                  ...([
                    'Main',
                    {
                      screen: 'Home',
                      params: {
                        screen: 'Album',
                        params: {
                          album: res.data as any,
                          pageTitle: song.album,
                        },
                      },
                    },
                    false,
                    true
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
        },
        {
          id: `artist-${song.id}`,
          label: 'Go to artist',
          icon: User2,
          onPress: async () => {
            if (song.artists.length === 1) {
              navigation.navigate(
                ...([
                  'Main',
                  {
                    screen: 'Home',
                    params: {
                      screen: 'ArtistDetail',
                      params: {
                        artist: song.artists[0],
                        pageTitle: song.artists[0].name,
                      },
                    },
                  },
                  false,
                  true
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
                        'Main',
                        {
                          screen: 'Home',
                          params: {
                            screen: 'ArtistDetail',
                            params: {
                              artist,
                              pageTitle: artist.name,
                            },
                          },
                        },
                        false,
                        true
                      ] as never),
                    ),
                })),
              });
            }
          },
        },
        {
          id: `fav-${song.id}`,
          icon: songIsStarred ? HeartMinus : Heart,
          label: songIsStarred ? 'Remove from favourites' : 'Add to favourites',
          onPress: async () => {
            if (songIsStarred) {
              await unstar({ id: song.id });
              return;
            }

            await star({ id: song.id });
          },
        },
        {
          id: `playlist-${song.id}`,
          icon: ListMusic,
          label: 'Add to playlist',
          onPress: () => openAddToPlaylistMenu(song),
        },
        {
          id: `slot-${song.albumId}`,
          label: 'Save album to speed dial',
          icon: List,
          onPress: async () => {
            try {
              const res = await subsonicService.getAlbum(song.albumId);
              if (res.success && res.data) {
                openSaveToSlotMenu({ type: 'album', album: res.data as any });
              }
            } catch (err) {
              Alert.alert(
                'Failed to load album',
                err instanceof Error ? err.message : 'Please try again.',
              );
            }
          }
        },
      ],
    });
  };

  const openAddToCurationMenu = (station: Station) => {
    openFlyout({
      title: 'Add to curation',
      subtitle: station.name,
      actions: collections.length
        ? collections.map(collection => ({
            id: `collection-${collection.id}`,
            label: collection.name,
            onPress: async () => {
              try {
                addStationToCollection(collection.id, station);
              } catch (err) {
                Alert.alert(
                  'Failed to add station',
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

  const openStationMenu = (station: Station) => {
    const stationIsStarred = isFavourite(station.id);

    openFlyout({
      title: station.name,
      actions: [
        {
          id: `fav-${station.id}`,
          label: stationIsStarred
            ? 'Remove from favourites'
            : 'Add to favourites',
          icon: stationIsStarred ? HeartMinus : Heart,
          onPress: async () => {
            toggleFavourite(station);
          },
        },
        {
          id: `playlist-${station.id}`,
          icon: ListMusic,
          label: 'Add to curation',
          onPress: () => openAddToCurationMenu(station),
        },
        {
          id: `slot-${station.id}`,
          label: 'Save to speed dial',
          icon: List,
          onPress: () => openSaveToSlotMenu({ type: 'station', station }),
        },
      ],
    });
  };

  useEffect(() => {
    const onBackPress = () => {
      if (activeSubScreen === 'player') {
        closePlayer();
      } else {
        setActiveSubScreen('player');
      }

      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );

    return () => backHandler.remove();
  }, [activeSubScreen, closePlayer]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.background,
        },
        content: {
          flex: 1,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 20,
        },
        backgroundArtwork: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          filter: 'brightness(0.5)',
        },
        backgroundOverlay: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.12)',
        },
        backgroundOverlaySecondary: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.12)',
        },
        bottomControls: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          bottom: insets.bottom + 10,
          position: 'absolute',
          left: 0,
          right: 0,
          gap: 16,
          zIndex: 1001,
        },
        bottomRowButton: {
          borderRadius: 12,
          padding: 12,
        },
        bottomRowButtonActive: {
          backgroundColor: colors.secondLayerThin,
        },
        header: {
          alignSelf: 'stretch',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          minHeight: 44,
          minWidth: 0,
          overflow: 'hidden',
          zIndex: 1001
        },
        dragHandle: {
          width: 44,
          height: 5,
          borderRadius: 999,
          backgroundColor: colors.secondLayerThin,
          marginBottom: 12,
        },
        headerRow: {
          alignSelf: 'stretch',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          minWidth: 0,
          overflow: 'hidden',
        },
        headerTextWrap: {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          maxWidth: '100%',
          justifyContent: 'center',
          gap: 4,
          alignItems: 'stretch',
          paddingHorizontal: 4,
          overflow: 'hidden',
        },
        headerTitle: {
          alignSelf: 'stretch',
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: '600',
          minWidth: 0,
          overflow: 'hidden',
          textAlign: 'center',
        },
        headerSubtitle: {
          alignSelf: 'stretch',
          color: "#b3b3b3",
          fontSize: 12,
          minWidth: 0,
          overflow: 'hidden',
          textAlign: 'center',
        },
        closeButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        artworkWrap: {
          width: '100%',
          aspectRatio: 1,
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: colors.secondLayerThin,
          marginBottom: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        artwork: {
          width: '100%',
          height: '100%',
        },
        fallbackArtworkText: {
          color: "#b3b3b3",
          fontSize: 14,
        },
        title: {
          color: '#FFFFFF',
          fontSize: 24,
          fontWeight: '500',
        },
        subtitle: {
          color: "#b3b3b3",
          fontSize: 16,
          marginTop: 6,
          marginBottom: 20,
        },
        trackMetaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginVertical: 12,
        },
        trackTextWrap: {
          justifyContent: 'center',
          flex: 1,
          minWidth: 0,
        },
        favoriteButton: {
          flexShrink: 0,
        },
        trackActionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        lyricsButton: {
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        lyricsButtonText: {
          color: '#FFFFFF',
          fontSize: 12,
          fontWeight: '600',
        },
        lyricsScreen: {
          flex: 1,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          paddingTop: insets.top + 76,
          paddingBottom: insets.bottom + 56,
          transformOrigin: 'bottom',
          opacity: 0,
          pointerEvents: 'none',
        },
        lyricsScreenOpen: {
          opacity: 1,
          pointerEvents: 'auto',
        },
        lyricsCenterState: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
        },
        lyricsStateText: {
          color: "#b3b3b3",
          textAlign: 'center',
          fontSize: 14,
        },
        lyricsScroll: {
          flex: 1,
          paddingHorizontal: 16,
        },
        syncedLyricsContent: {
          paddingVertical: 24,
          paddingHorizontal: 12,
          gap: 14,
        },
        syncedLyricLine: {
          fontSize: 20,
          lineHeight: 28,
          textAlign: 'center',
          color: "#b3b3b3",
        },
        syncedLyricLineActive: {
          color: '#FFFFFF',
          fontWeight: '700',
          transform: [{ scale: 1.05 }],
          textShadowColor: '#FFFFFF40',
          textShadowRadius: 10,
          textShadowOffset: { width: 1, height: 1 },
        },
        plainLyricsContent: {
          paddingVertical: 18,
          paddingHorizontal: 4,
        },
        plainLyricsText: {
          color: '#FFFFFF',
          fontSize: 16,
          lineHeight: 24,
          textAlign: 'center',
        },
        lyricsFooter: {
          marginVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        },
        lyricsSourceText: {
          color: "#b3b3b3",
          fontSize: 12,
        },
        lyricsBackButton: {
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 8,
          backgroundColor: colors.secondLayerThin,
        },
        lyricsBackButtonText: {
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: '600',
        },
        progressTapArea: {
          height: 20,
          justifyContent: 'center',
        },
        progressTrack: {
          height: 5,
          borderRadius: 999,
          backgroundColor: "#b3b3b3",
          overflow: 'hidden',
        },
        progressFill: {
          height: '100%',
          backgroundColor: '#FFFFFF',
        },
        timeRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 8,
          alignItems: 'center',
        },
        timeText: {
          color: "#b3b3b3",
          fontSize: 12,
          fontVariant: ['tabular-nums'],
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
        },
        qualityTextCD: {
          backgroundColor: '#0EA5E940',
          color: '#7DD3FC',
        },
        qualityTextLossless: {
          backgroundColor: '#c2b80040',
          color: '#c2af00',
        },
        controlsRow: {
          marginTop: 28,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: currentSong ? 'space-between' : 'center',
        },
        iconButton: {
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
        },
        playButton: {
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
        },
        disabled: {
          opacity: 0.5,
        },
      }),
    [
      colors.background,
      colors.secondLayerThin,
      colors.faint,
      insets.top,
      insets.bottom,
      shadows.glass,
      currentSong,
    ],
  );

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.root, animatedStyle]}>
        {coverUrl ? (
          <View style={StyleSheet.absoluteFill}>
            <Image
              source={{ uri: coverUrl }}
              style={styles.backgroundArtwork}
              blurRadius={46}
            />
          </View>
        ) : null}
        <View pointerEvents="none" style={styles.backgroundOverlay} />

        <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.dragHandle} />
          <View style={styles.headerRow}>
            <Pressable
              onPress={closePlayer}
              style={styles.closeButton}
            >
              <ChevronDown size={26} color={'#FFFFFF'} />
            </Pressable>
            <View style={styles.headerTextWrap}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.headerTitle}
              >
                Playing {title}
              </Text>
              {subtitle !== '' && (
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.headerSubtitle}
                >
                  {subtitle}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => {
                if (currentSong) {
                  openSongMenu(currentSong);
                } else if (currentStation) {
                  openStationMenu(currentStation);
                }
              }}
              style={styles.closeButton}
            >
              <EllipsisVertical size={26} color={'#FFFFFF'} />
            </Pressable>
          </View>
        </View>

          <View style={styles.artworkWrap}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={styles.artwork} />
            ) : (
              <Text style={styles.fallbackArtworkText}>
                No artwork available
              </Text>
            )}
          </View>

          <View style={styles.trackMetaRow}>
            <View style={styles.trackTextWrap}>
              <Text numberOfLines={1} style={styles.title}>
                {title}
              </Text>
              {subtitle !== '' && (
                <Text numberOfLines={1} style={styles.subtitle}>
                  {subtitle}
                </Text>
              )}
            </View>
            <View style={styles.trackActionRow}>
              <Pressable
                style={styles.favoriteButton}
                onPress={() => {
                  if (currentSong) {
                    if (isStarred(currentSong.id, 'song')) {
                      unstar({ id: currentSong.id });
                    } else {
                      star({ id: currentSong.id });
                    }
                  }
                  if (currentStation) {
                    toggleFavourite(currentStation);
                  }
                }}
              >
                <Heart
                  size={24}
                  color={
                    (
                      currentSong
                        ? isStarred(currentSong?.id ?? '', 'song')
                        : currentStation && isFavourite(currentStation?.id)
                    )
                      ? '#ef4444'
                      : "#FFFFFF"
                  }
                  fill={
                    (
                      currentSong
                        ? isStarred(currentSong?.id ?? '', 'song')
                        : currentStation && isFavourite(currentStation?.id)
                    )
                      ? '#ef4444'
                      : 'transparent'
                  }
                />
              </Pressable>
            </View>
          </View>
          {currentSong ? (
            <>
              <View
                onLayout={event =>
                  setProgressBarWidth(event.nativeEvent.layout.width)
                }
                onStartShouldSetResponder={() => isSeekable}
                onResponderGrant={event => {
                  setIsDraggingSeek(true);
                  updateSeekPreview(event);
                }}
                onResponderMove={updateSeekPreview}
                onResponderRelease={commitSeek}
                onResponderTerminate={commitSeek}
                style={[styles.progressTapArea, !isSeekable && styles.disabled]}
              >
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${visualProgress * 100}%` },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <Text
                  style={[
                    styles.qualityText,
                    isCdQuality && styles.qualityTextCD,
                    isLosslessQuality && styles.qualityTextLossless,
                  ]}
                >
                  {songBitDepth}BIT {(songSamplingRate / 1000).toFixed(1)}KHZ
                  {isCodecSynced || usbDirect ? ' • DIRECT' : usbState?.connected ? ' • MIX' : ''}
                </Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </>
          ) : (
            currentStation &&
            currentStation.bitrate &&
            currentStation.bitrate > 0 && (
              <View style={[styles.timeRow, { marginHorizontal: 'auto' }]}>
                <Text
                  style={[
                    styles.qualityText,
                    isCdQuality && styles.qualityTextCD,
                    isLosslessQuality && styles.qualityTextLossless,
                  ]}
                >
                  {currentStation.bitrate}KBPS{' '}
                    {currentStation.codec.toUpperCase()}
                </Text>
              </View>
            )
          )}

          <View style={styles.controlsRow}>
            {currentSong && (
              <>
                <Pressable onPress={toggleShuffle} style={[styles.iconButton, shuffle && styles.bottomRowButtonActive]}>
                  <Shuffle
                    size={22}
                    color={shuffle ? '#FFFFFF' : "#b3b3b3"}
                  />
                </Pressable>

                <Pressable onPress={playPrevious} style={styles.iconButton}>
                  <SkipBack size={26} color={'#FFFFFF'} />
                </Pressable>
              </>
            )}

            <Pressable
              onPress={isPlaying ? pause : resume}
              style={styles.playButton}
            >
              {isPlaying ? (
                <Pause size={34} color={'#000000'} />
              ) : (
                <Play size={34} color={'#000000'} />
              )}
            </Pressable>

            {currentSong && (
              <>
                <Pressable onPress={playNext} style={styles.iconButton}>
                  <SkipForward size={26} color={'#FFFFFF'} />
                </Pressable>

                <Pressable
                  onPress={handleRepeatPress}
                  style={[styles.iconButton, (repeat === "queue" || repeat === "track") && styles.bottomRowButtonActive]}
                >
                  {repeat === 'track' ? (
                    <Repeat1 size={22} color={repeatColor} />
                  ) : (
                    <Repeat size={22} color={repeatColor} />
                  )}
                </Pressable>
              </>
            )}
          </View>
          {shouldMountLyrics && (
            <LyricsScreen isVisible={isLyricsVisible} setActiveSubScreen={setActiveSubScreen} styles={styles} coverUrl={coverUrl} title={title} subtitle={subtitle} navigation={navigation} currentTime={currentTime} currentStationSong={currentStationSong} currentSong={currentSong} currentStation={currentStation} seek={seek} />
          )}
          {shouldMountCast && <CastScreen isVisible={isCastVisible} styles={styles} coverUrl={coverUrl} />}
          {shouldMountQueue && queue.length > 0 && currentSong && (
            <Animated.View
              style={[
                styles.lyricsScreen,
                isQueueVisible && styles.lyricsScreenOpen,
                {
                  transitionProperty: ['opacity', 'transform'],
                  transitionDuration: '200ms',
                  transitionTimingFunction: 'ease-in-out',
                },
              ]}
            >
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl }}
                  style={styles.backgroundArtwork}
                  blurRadius={46}
                />
              ) : <View
                style={[styles.backgroundArtwork, { backgroundColor: "#000000" }]}
              />}
              <View
                pointerEvents="none"
                style={styles.backgroundOverlaySecondary}
              />
              <FlatList
                ref={scrollRef}
                data={queue}
                keyExtractor={item => item.id}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 16 }}
                ListHeaderComponent={
                  <Text style={{
                    color: "#FFFFFF",
                    fontSize: 24,
                    fontWeight: '500',
                    paddingHorizontal: 16,
                    paddingBottom: 8,
                  }}>Queue</Text>
                }
                renderItem={({ item, index }) => {
                  const currentIndex = queue.findIndex(s => s.id === currentSong.id);
                  const position: 'before' | 'after' = index < currentIndex ? 'before' : 'after';
                  return (
                    <QueueItem
                      item={item}
                      openSongMenu={openSongMenu}
                      playFromQueue={playFromQueue}
                      currentSongId={currentSong.id}
                      position={position}
                    />
                  );
                }}
              />
            </Animated.View>
          )}
          {shouldMountQueue && currentStation && !currentSong && (
            <Animated.View
              style={[
                styles.lyricsScreen,
                isQueueVisible && styles.lyricsScreenOpen,
                {
                  transitionProperty: ['opacity', 'transform'],
                  transitionDuration: '200ms',
                  transitionTimingFunction: 'ease-in-out',
                },
              ]}
            >
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl }}
                  style={styles.backgroundArtwork}
                  blurRadius={46}
                />
              ) : <View
                style={[styles.backgroundArtwork, { backgroundColor: "#000000" }]}
              />}
              <View
                pointerEvents="none"
                style={styles.backgroundOverlaySecondary}
              />
              {stationPlayHistory.length ? (
                <>
                  <ScrollView
                    style={{
                      gap: 12,
                      height: '100%',
                      flex: 1,
                    }}
                  >
                    <Text style={{
                      color: "#FFFFFF",
                      fontSize: 20,
                      fontWeight: '500',
                      paddingHorizontal: 16,
                      paddingBottom: 8,
                    }}>History</Text>
                    {stationPlayHistory.map((item, i) => (
                      <HistoryItem
                        key={`${item.type}-${i}`}
                        item={item}
                        active={stationPlayHistory.length - 1 === i}
                        station={currentStation}
                      />
                    ))}
                  </ScrollView>
                </>
              ) : (
                <View style={styles.lyricsCenterState}>
                  <Text style={styles.lyricsStateText}>
                    No play history available for this station.
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
          <View style={styles.bottomControls}>
            <Pressable
              onPress={() => {
                if (activeSubScreen === 'queue') {
                  setActiveSubScreen('player');
                } else {
                  setActiveSubScreen('queue');
                }
              }}
              style={[
                styles.bottomRowButton,
                activeSubScreen === 'queue' && styles.bottomRowButtonActive,
              ]}
            >
              <ListMusic size={20} color={'#FFFFFF'} />
            </Pressable>

            <Pressable
              onPress={() => {
                if (activeSubScreen === 'lyrics') {
                  setActiveSubScreen('player');
                } else {
                  setActiveSubScreen('lyrics');
                }
              }}
              style={[
                styles.bottomRowButton,
                activeSubScreen === 'lyrics' && styles.bottomRowButtonActive,
              ]}
            >
              <MicVocal size={20} color={'#FFFFFF'} />
            </Pressable>

            <Pressable
              onPress={() => {
                if (activeSubScreen === 'cast') {
                  setActiveSubScreen('player');
                } else {
                  setActiveSubScreen('cast');
                }
              }}
              style={[
                styles.bottomRowButton,
                activeSubScreen === 'cast' && styles.bottomRowButtonActive,
              ]}
            >
              <CastIcon size={20} color={'#FFFFFF'} />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default NowPlayingScreen;
