/* eslint-disable react/no-unstable-nested-components */
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import Text from '../components/text';
import { SystemUi, NetworkType } from '../utils/systemUi';
import { useAppTheme } from '../contexts/theme-context';
import { useNavigation } from '@react-navigation/native';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import {
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  ChevronLeft,
  Wifi,
  WifiOff,
  SignalHigh,
  BluetoothConnected,
  BluetoothOff,
} from 'lucide-react-native';
import NowPlaying from './carhome/now-playing';
import subsonicService from '../utils/subsonic';
import { useAudioPlayer } from '../contexts/audio-player-context';

const Tab = createBottomTabNavigator();

function CarNavRail({
  state,
  navigation,
}: BottomTabBarProps) {
  const {
    theme: { colors },
  } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        navRail: {
          height: "100%",
          flexDirection: 'column',
          alignItems: 'center',
          paddingVertical: 76,
          gap: 8,
          width: 160,
        },
        navTab: {
          padding: 12,
          marginLeft: 8,
          width: 160,
          borderColor: 'transparent',
          borderRadius: 8
        },
        navTabActive: {
          backgroundColor: colors.background,
          borderColor: colors.textMuted,
        },
        navDot: {
          textAlign: "center",
          fontSize: 16,
          fontWeight: "800",
          textTransform: "uppercase",
          color: colors.textMuted,
        },
      }),
    [colors],
  );

  return (
    <View style={styles.navRail}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
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

        return (
          <Pressable
            key={route.key}
            style={[styles.navTab, isFocused && styles.navTabActive]}
            onPress={onPress}
          >
            <Text
              style={[
                styles.navDot,
                isFocused && { color: colors.primary },
              ]}
            >{route.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CarHomeScreen() {
  const {
    theme: { colors },
  } = useAppTheme();
  const navigation = useNavigation();

  const [batteryLevel, setBatteryLevel] = useState(100);
  const [networkType, setNetworkType] = useState<NetworkType>('none');
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const { currentSong, currentStationSong, currentStation } = useAudioPlayer()

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

  useEffect(() => {
    SystemUi.enterCarHomeUi?.().catch(() => undefined);

    const batteryListener = SystemUi.onBatteryLevel(setBatteryLevel);
    const networkListener = SystemUi.onNetworkType(setNetworkType);
    const bluetoothListener = SystemUi.onBluetoothState(setBluetoothConnected);

    return () => {
      batteryListener.remove();
      networkListener.remove();
      bluetoothListener.remove();
      SystemUi.exitCarHomeUi?.().catch(() => undefined);
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          paddingVertical: 16,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1001
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
        headerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 20,
        },
        backButton: {
          padding: 8,
          borderRadius: 64,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        title: {
          color: colors.text,
          fontSize: 24,
          fontWeight: '600',
        },
        statusItem: {
          alignItems: 'center',
          gap: 2,
        },
        statusLabel: {
          color: colors.textMuted,
          fontSize: 10,
        },
        content: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        text: {
          color: colors.textMuted,
          fontSize: 20,
          fontWeight: '600',
        },
        body: {
          flex: 1,
          flexDirection: 'row',
        },
      }),
    [colors],
  );

  const batteryIcon = () => {
    if (batteryLevel >= 100) return <BatteryFull size={24} color={colors.text} />;
    if (batteryLevel >= 80) return <BatteryFull size={24} color={colors.text} />;
    if (batteryLevel >= 40) return <BatteryMedium size={24} color={colors.text} />;
    if (batteryLevel >= 20) return <BatteryLow size={24} color={colors.text} />;
    return <Battery size={24} color={colors.text} />;
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            SystemUi.exitCarHomeUi?.().catch(() => undefined);
            navigation.goBack();
          }}
        >
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <View style={styles.headerActions}>
          <View style={styles.statusItem}>
            {batteryIcon()}
          </View>
          <View style={styles.statusItem}>
            {networkType === 'wifi' ? (
              <Wifi size={24} color={colors.text} />
            ) : networkType === 'cellular' ? (
              <SignalHigh size={24} color={colors.text} />
            ) : (
              <WifiOff size={24} color={colors.textMuted} />
            )}
          </View>
          <View style={styles.statusItem}>
            {bluetoothConnected ? (
              <BluetoothConnected size={24} color={colors.primary} />
            ) : (
              <BluetoothOff size={24} color={colors.textMuted} />
            )}
          </View>
        </View>
      </View>
      {coverUrl ? (
        <View style={StyleSheet.absoluteFill}>
          <Image
            source={{ uri: coverUrl }}
            style={styles.backgroundArtwork}
            blurRadius={24}
          />
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.backgroundOverlay} />

      <View style={styles.body}>
        <Tab.Navigator
          tabBar={props => <CarNavRail {...props} />}
          screenOptions={{
            headerShown: false,
            tabBarPosition: 'left',
            sceneStyle: {
              backgroundColor: "transparent"
            }
          }}
        >
          <Tab.Screen name="Now Playing" component={NowPlaying} />
        </Tab.Navigator>
      </View>
    </View>
  );
}

export default CarHomeScreen;
