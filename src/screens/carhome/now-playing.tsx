import { useMemo, useState } from 'react';
import { Alert, GestureResponderEvent, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../../components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react-native';
import { useAudioPlayer } from '../../contexts/audio-player-context';
import subsonicService from '../../utils/subsonic';
import { useAppTheme } from '../../contexts/theme-context';
import {
  CarHomeSlotItem,
  useCarHomeSlots,
} from '../../contexts/carhome-slots-context';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function useNowPlaying() {
  const {
    theme: { colors, shadows },
  } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [progressBarWidth, setProgressBarWidth] = useState(1);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [seekPreviewRatio, setSeekPreviewRatio] = useState(0);
  const { slots, playSlot, clearSlot } = useCarHomeSlots();

  const handlePress = (item: CarHomeSlotItem | null, index: number) => {
    if (!item) return;
    playSlot(index).catch(err => {
      Alert.alert(
        'Unable to play',
        err instanceof Error ? err.message : 'Please try again.',
      );
    });
  };

  const handleLongPress = (index: number) => {
    Alert.alert('Remove speed dial?', 'This will clear this slot.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => clearSlot(index),
      },
    ]);
  };

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
    pause,
    resume,
    toggleShuffle,
    setRepeat,
    seek,
  } = useAudioPlayer();

  const title =
    currentSong?.title ??
    currentStationSong?.track.title.trim() ??
    currentStation?.name ??
    'Nothing is playing';
  const subtitle =
    currentSong?.artist ?? currentStationSong?.track.artist.trim() ?? '';

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

  function slotTitle(item: CarHomeSlotItem | null): string {
    if (!item) return '';
    switch (item.type) {
      case 'playlist':
        return item.playlist.name;
      case 'album':
        return item.album.name;
      case 'station':
        return item.station.name;
    }
  }

  const repeatColor = repeat === 'off' ? colors.textMuted : '#FFFFFF';
  const songBitDepth = currentSong?.bitDepth || 0;
  const songSamplingRate = currentSong?.samplingRate || 0;
  const stationBitrate = currentStation?.bitrate || 0;

  const isCdQuality =
    (songBitDepth === 16 && songSamplingRate === 44100) ||
    stationBitrate === 1411;
  const isLosslessQuality =
    songBitDepth > 16 || songSamplingRate > 44100 || stationBitrate > 1411;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          justifyContent: "flex-end"
        },
        content: {
          flex: 1,
          paddingTop: insets.top + 30,
          paddingBottom: insets.bottom + 20,
          paddingLeft: 20,
          paddingRight: insets.right || insets.left || 20
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
          backgroundColor: 'rgba(0, 0, 0, 0.48)',
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
          color: colors.text,
          fontSize: 12,
          fontWeight: '600',
          minWidth: 0,
          overflow: 'hidden',
          textAlign: 'center',
        },
        headerSubtitle: {
          alignSelf: 'stretch',
          color: colors.textMuted,
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
          width: 200,
          aspectRatio: 1,
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: colors.secondLayerThin,
          alignItems: 'center',
          justifyContent: 'center',
        },
        artwork: {
          width: '100%',
          height: '100%',
        },
        fallbackArtworkText: {
          color: colors.textMuted,
          fontSize: 14,
        },
        title: {
          color: '#FFFFFF',
          fontSize: 24,
          fontWeight: '500',
        },
        subtitle: {
          color: colors.textMuted,
          fontSize: 16,
          marginTop: 6,
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
        progressTapArea: {
          height: 20,
          justifyContent: 'center',
          marginTop: 20
        },
        progressTrack: {
          height: 5,
          borderRadius: 999,
          backgroundColor: colors.textMuted,
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
          color: colors.textMuted,
          fontSize: 12,
          fontVariant: ['tabular-nums'],
        },
        qualityText: {
          color: colors.textMuted,
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
          justifyContent: 'flex-start',
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
    [insets.top, insets.bottom, insets.right, insets.left, colors.secondLayerThin, colors.text, colors.textMuted, colors.faint, shadows.glass],
  );

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            alignItems: 'flex-end',
            minWidth: 0,
          }}
        >
          <View style={styles.artworkWrap}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={styles.artwork} />
            ) : (
              <Text style={styles.fallbackArtworkText}>
                No artwork available
              </Text>
            )}
          </View>
          <View style={{ flex: 1, justifyContent: 'space-between' }}>
            <View style={styles.controlsRow}>
              {currentSong && (
                <>
                  <Pressable
                    onPress={toggleShuffle}
                    style={[
                      styles.iconButton,
                      shuffle && styles.bottomRowButtonActive,
                    ]}
                  >
                    <Shuffle
                      size={22}
                      color={shuffle ? '#FFFFFF' : colors.textMuted}
                    />
                  </Pressable>

                  <Pressable onPress={playPrevious} style={styles.iconButton}>
                    <SkipBack size={26} color={'#FFFFFF'} />
                  </Pressable>
                </>
              )}

              {currentSong && (
                <>
                  <Pressable onPress={playNext} style={styles.iconButton}>
                    <SkipForward size={26} color={'#FFFFFF'} />
                  </Pressable>

                  <Pressable
                    onPress={handleRepeatPress}
                    style={[
                      styles.iconButton,
                      (repeat === 'queue' || repeat === 'track') &&
                        styles.bottomRowButtonActive,
                    ]}
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
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                minWidth: 0,
              }}
            >
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
            </View>
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
      </View>
      <View
        style={{
          flexDirection: 'row',
          zIndex: 10010,
          backgroundColor: colors.secondLayer,
          gap: 1,
          marginRight: insets.right || insets.left,
          marginLeft: 20,
          marginBottom: 8,
          borderRadius: 8,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.secondLayerThin
        }}
      >
        {slots.map((slot, slotPos) => {
          const slotKey = slot ? `${slot.type}-${(slot as any).id ?? slotTitle(slot)}` : `empty-${slotPos}`;
          return (
            <Pressable
              onLongPress={() => handleLongPress(slotPos)}
              key={slotKey}
              style={{ paddingVertical: 16, flex: 1, paddingHorizontal: 8, backgroundColor: colors.background }}
              android_ripple={{ color: colors.secondLayerThin }}
              onPress={() => handlePress(slot, slotPos)}
            >
              <Text
                style={{ color: colors.text, textAlign: 'center', fontWeight: "800", textTransform: "uppercase" }}
                numberOfLines={1}
              >
                {slotTitle(slot)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default useNowPlaying;
