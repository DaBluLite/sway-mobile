/** eslint-disable react-native/no-inline-styles */
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';
import { useAudioPlayer } from '../contexts/audio-player-context';
import subsonicService from '../utils/subsonic';
import { Disc3, Heart, Pause, Play, SkipForward } from 'lucide-react-native';
import { useAppTheme } from '../contexts/theme-context';
import { useFavourites } from '../contexts/favourites-context';
import { useSubsonic } from '../contexts/subsonic-context';
import LinearGradient from 'react-native-linear-gradient';
import TouchableScale from './touchable-scale';
import { formatArtists } from '../utils/format';
import Text from './text';
import { BitPerfectLabel } from './bit-perfect-label';

function TabBar({
  state,
  descriptors,
  navigation,
}: {
  state: ReturnType<typeof createBottomTabNavigator>['getStateForRoute'];
  descriptors: ReturnType<typeof createBottomTabNavigator>['getDescriptor'];
  navigation: ReturnType<typeof createBottomTabNavigator>['navigation'];
}) {
  const {
    theme: { colors, shadows },
  } = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const { subsonicEnabled } = useSubsonic();
  const { isFavourite, toggleFavourite } = useFavourites();
  const {
    currentSong,
    currentStation,
    currentStationSong,
    isPlaying,
    playNext,
    resume,
    pause,
  } = useAudioPlayer();
  const colorScheme = useAppTheme().resolvedTheme
  const [coverError, setCoverError] = useState(false);
  const openNowPlaying = () => {
    navigation.navigate('NowPlaying' as never);
  };

  useEffect(() => {
    // Reset cover error state when song or station changes
    setCoverError(false);
  }, [currentSong?.id, currentStation?.id, currentStationSong]);

  const coverUrl = useMemo(() => {
    if (currentSong) {
      return subsonicService.getCoverArtUrl(currentSong.id);
    } else if (currentStationSong && currentStationSong.albumArt) {
      return currentStationSong.albumArt.imageUrl;
    } else if (currentStation) {
      return currentStation.favicon;
    } else {
      return null;
    }
  }, [currentStationSong, currentSong, currentStation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          bottom: 0,
          position: 'absolute',
          boxShadow: shadows.main,
          left: 0,
          right: 0,
          padding: 4,
          paddingBottom: bottom,
          gap: 4,
        },
        item: {
          flex: 1,
          padding: 12,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          borderWidth: 1,
          borderColor: 'transparent',
          borderRadius: 18,
        },
        itemWrapper: {
          flex: 1,
          borderRadius: 18,
          overflow: 'hidden',
        },
        miniPlayer: {
          flexDirection: 'row',
          gap: 8,
          padding: 8,
          borderRadius: 12,
          flex: 1,
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.secondLayer,
        },
        miniPlayerInfoWrap: {
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
        },
        miniPlayerTextWrap: {
          flexDirection: 'column',
          gap: 2,
          flex: 1,
          minWidth: 0,
        },
        miniPlayerControls: {
          flexDirection: 'row',
          gap: 16,
          alignItems: 'center',
          flexShrink: 0,
        },
        gradient: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 150, // adjust to taste
        }
      }),
    [bottom, shadows.main, colors],
  );

  return (
    <>
      <View style={styles.container}>
        <LinearGradient
          colors={[colorScheme === "dark" ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,0.8)', 'transparent']}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={styles.gradient}
        />
        {(currentSong || currentStation || isPlaying) && (
          <View
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <TouchableScale
              onPress={openNowPlaying}
              android_ripple={{ color: colors.secondLayerThinActive }}
              style={styles.miniPlayer}
            >
              <View style={styles.miniPlayerInfoWrap}>
                {coverError ? (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 4,
                      backgroundColor: colors.secondLayerThin,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Disc3
                      size={16}
                      color={colors.text}
                      />
                  </View>
                ) : (
                  <Image
                    source={{ uri: coverUrl || undefined }}
                    style={{ width: 48, height: 48, borderRadius: 4 }}
                    onError={() => setCoverError(true)}
                  />
                )}
                <View style={styles.miniPlayerTextWrap}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: 'bold',
                      overflow: 'hidden',
                    }}
                    numberOfLines={1}
                  >
                    {currentSong?.title ||
                      currentStationSong?.track?.title ||
                      currentStation?.name ||
                      'Unknown Title'}
                  </Text>
                  {(currentSong || currentStationSong) && (
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 14,
                        opacity: 0.7,
                      }}
                      numberOfLines={1}
                    >
                      {currentSong
                        ? formatArtists(currentSong.artists) || 'Unknown Artist'
                        : currentStationSong &&
                          currentStationSong.track &&
                          currentStationSong.track.artist
                        ? currentStationSong.track.artist
                        : ''}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.miniPlayerControls}>
                {currentSong && (
                  <Pressable
                    onPress={playNext}
                    android_ripple={{
                      color: colors.secondLayerThin,
                      borderless: true,
                      radius: 24,
                    }}
                    style={{ padding: 8, borderRadius: 64 }}
                  >
                    <SkipForward size={20} color={colors.text} />
                  </Pressable>
                )}
                {currentStation && (
                  <Pressable
                    onPress={() => toggleFavourite(currentStation)}
                    android_ripple={{
                      color: colors.secondLayerThin,
                      borderless: true,
                      radius: 24,
                    }}
                    style={{ padding: 12, borderRadius: 64 }}
                  >
                    <Heart
                      size={20}
                      color={
                        isFavourite(currentStation.id) ? '#ef4444' : colors.text
                      }
                      fill={isFavourite(currentStation.id) ? '#ef4444' : 'none'}
                    />
                  </Pressable>
                )}
                <Pressable
                  onPress={() => {
                    if (isPlaying) {
                      pause();
                    } else {
                      resume();
                    }
                  }}
                  android_ripple={{
                    color: colors.secondLayerThin,
                    borderless: true,
                    radius: 24,
                  }}
                  style={{
                    padding: 8,
                    borderRadius: 64,
                  }}
                >
                  {isPlaying ? (
                    <Pause size={20} color={colors.text} />
                  ) : (
                    <Play size={20} color={colors.text} />
                  )}
                </Pressable>
              </View>
            </TouchableScale>
          </View>
        )}
        <View style={{ flexDirection: 'row', flex: 1, gap: 8 }}>
          {state.routes
            .filter((route: { name: string }) => {
              if (!subsonicEnabled) {
                if (route.name === 'Radio') return false;
                return true;
              } else return true;
            })
            .map(
              (
                route: {
                  key: string;
                  name: string;
                  params?: Record<string, unknown>;
                },
                index: number,
              ) => {
                const { options } = descriptors[route.key];

                const activeIndex = state.index;

                const isFocused = activeIndex === index;

                const onPress = () => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });

                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                };

                const onLongPress = () => {
                  navigation.emit({
                    type: 'tabLongPress',
                    target: route.key,
                  });
                };

                return (
                  <View key={route.key} style={styles.itemWrapper}>
                    <TouchableScale
                      accessibilityState={isFocused ? { selected: true } : {}}
                      accessibilityLabel={options.tabBarAccessibilityLabel}
                      testID={options.tabBarButtonTestID}
                      scale={0.9}
                      onPress={onPress}
                      onLongPress={onLongPress}
                      style={[
                        styles.item,
                      ]}
                    >
                      {options.tabBarIcon &&
                        options.tabBarIcon({
                          focused: isFocused,
                          color: isFocused ? colors.text : colors.textMuted,
                          size: 24
                        })}
                      <Text style={{ color: isFocused ? colors.text : colors.textMuted }}>{route.name}</Text>
                    </TouchableScale>
                  </View>
                );
              },
            )}
        </View>
        <BitPerfectLabel />
      </View>
    </>
  );
}

export default TabBar;
