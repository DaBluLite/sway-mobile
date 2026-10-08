/* eslint-disable react/no-unstable-nested-components */
import {
  ActivityIndicator,
  Linking,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {
  BottomTabBarProps,
  BottomTabNavigationOptions,
  BottomTabNavigationProp,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import {
  House,
  Library,
  LucideProps,
  Search,
  Settings,
} from 'lucide-react-native';
import {
  HomeScreen,
  LibraryScreen,
  NowPlayingScreen,
  SearchScreen,
  CarHomeScreen,
} from './screens';
import {
  NavigationContainer,
  RouteProp,
  ParamListBase,
  Theme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import TabBar from './components/tab-bar';
import { PlatformPressable } from '@react-navigation/elements';
import SetupScreen from './screens/setup';
import { AppSetupProvider, useAppSetup } from './contexts/app-setup-context';
import { SubsonicProvider } from './contexts/subsonic-context';
import { AudioPlayerProvider } from './contexts/audio-player-context';
import { bootstrapAudioPlayer } from './contexts/audio-player-bootstrap';
import { LibraryProvider } from './contexts/library-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useAppTheme } from './contexts/theme-context';
import { PlaylistsProvider } from './contexts/playlists-context';
import { FlyoutProvider } from './components/flyout-menu';
import SettingsNavigator from './screens/settings';
import { FavouritesProvider } from './contexts/favourites-context';
import { HistoryProvider } from './contexts/history-context';
import { CurationsProvider } from './contexts/curations-context';
import { CarHomeSlotsProvider } from './contexts/carhome-slots-context';
import { SleepTimerProvider } from './contexts/sleep-timer-context';
import LoginScreen from './screens/login';
import { PaperProvider } from 'react-native-paper';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { BtCodec } from './utils/btCodec';
import { UsbAudio } from './utils/usbAudio';
import { Alert } from 'react-native';
import { MainTabParamList, RootStackParamList } from './types';
import { AlertProvider } from './components/custom-alert';
import { handleSpotifyDeepLink } from './utils/spotify-deeplink';
import { BottomAura } from './components/bottom-aura';
import { useScreenCornerRadius } from './hooks/useScreenCornerRadius';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import {
  BitPerfectCelebrationProvider,
  useBitPerfectCelebration,
} from './contexts/bit-perfect-celebration-context';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Tab = createBottomTabNavigator<MainTabParamList>();

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AlertProvider>
          <AppSetupProvider>
            <AudioPlayerProvider>
              <BitPerfectCelebrationProvider>
                <SleepTimerProvider>
                  <SubsonicProvider>
                    <LibraryProvider>
                      <PlaylistsProvider>
                        <AppShell />
                      </PlaylistsProvider>
                    </LibraryProvider>
                  </SubsonicProvider>
                </SleepTimerProvider>
                <PlaybackAura />
              </BitPerfectCelebrationProvider>
            </AudioPlayerProvider>
          </AppSetupProvider>
        </AlertProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function PlaybackAura() {
  const radius = useScreenCornerRadius();
  const { visible, progress } = useBitPerfectCelebration();
  const animatedStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { zIndex: 100 }, animatedStyle]}
    >
      <BottomAura
        preset="flow"
        intensity={0.7}
        spread={46}
        speed={0.8}
        radius={radius}
        enabled={visible}
      />
    </Animated.View>
  );
}

function resumeTransferFlow() {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('Settings', { screen: 'TransferReview' });
}

function AppShell() {
  const { resolvedTheme, navigationTheme, theme } = useAppTheme();

  const paperTheme = {
    dark: false,
    roundness: 4,
    colors: theme.colors,
  };

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      if (handleSpotifyDeepLink(event.url)) {
        resumeTransferFlow();
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    Linking.getInitialURL()
      .then(url => {
        if (url && handleSpotifyDeepLink(url)) {
          resumeTransferFlow();
        }
      })
      .catch(error => {
        console.warn('Failed to read initial URL', error);
      });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    bootstrapAudioPlayer().catch(error => {
      console.warn('Failed to bootstrap audio player', error);
    });
  }, []);

  useEffect(() => {
    const connectBtCodec = async () => {
      try {
        if (Platform.OS !== 'android') return;

        if (Platform.Version >= 31) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
        }

        await BtCodec.connect();

        // Auto CDM association for any already-connected headphones/headset
        // Native CdmModule also listens for future connects, this handles the
        // cold-start case where headphones were connected before app launch.
        try {
          const { CdmModule } = require('react-native').NativeModules;
          if (CdmModule?.associateConnected) {
            await CdmModule.associateConnected();
          }
          if (__DEV__ && CdmModule?.debugState) {
            const st = await CdmModule.debugState();
            console.log('[CDM] debugState', st);
          }
        } catch (e) {
          console.warn('CDM auto-associate failed', e);
        }
      } catch (error) {
        console.warn('Failed to connect BtCodecModule', error);
      }
    };

    connectBtCodec();
    // Auto-prompt for USB DAC: when a DAC is attached, ask to enable exclusive/bit-perfect
    const sub = UsbAudio.addListener(
      'UsbAudioDeviceAttached',
      (devices: any) => {
        const name =
          Array.isArray(devices) && devices[0]?.name
            ? devices[0].name
            : 'USB DAC';
        Alert.alert(
          'USB DAC detected',
          `${name} connected. Enable exclusive bit-perfect playback?`,
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Enable',
              onPress: async () => {
                try {
                  await UsbAudio.requestExclusive();
                } catch {}
                // persist preference for next launches
                try {
                  const { setItem, STORES } = require('./utils/storage');
                  setItem(STORES.SETTINGS, 'audio-player-exclusive', true);
                  setItem(STORES.SETTINGS, 'audio-player-bit-perfect', true);
                } catch {}
              },
            },
          ],
        );
      },
    );
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <KeyboardProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <NavigationContainer ref={navigationRef} theme={navigationTheme}>
            <FlyoutProvider>
              <FavouritesProvider>
                <HistoryProvider>
                  <CurationsProvider>
                    <CarHomeSlotsProvider>
                      <PaperProvider theme={paperTheme}>
                        <AppContent />
                      </PaperProvider>
                    </CarHomeSlotsProvider>
                  </CurationsProvider>
                </HistoryProvider>
              </FavouritesProvider>
            </FlyoutProvider>
          </NavigationContainer>
        </GestureHandlerRootView>
      </KeyboardProvider>
    </>
  );
}

function renderTabBar(props: BottomTabBarProps) {
  return <TabBar {...props} />;
}

function useIcon(
  Icon: React.ForwardRefExoticComponent<
    LucideProps & React.RefAttributes<SVGSVGElement>
  >,
): (props: {
  route: RouteProp<ParamListBase, string>;
  navigation: BottomTabNavigationProp<ParamListBase, string>;
  theme: Theme;
}) => BottomTabNavigationOptions {
  return (__: {
    route: RouteProp<ParamListBase, string>;
    navigation: BottomTabNavigationProp<ParamListBase, string>;
    theme: Theme;
  }) => ({
    tabBarIcon({ size, color }) {
      return <Icon size={size} color={color} />;
    },
  });
}

function MainContent() {
  const {
    theme: { colors },
  } = useAppTheme();
  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{
        animation: 'shift',
        headerShown: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          color: colors.text,
          fontSize: 26,
        },
      }}
    >
      <Tab.Screen
        options={{
          tabBarIcon({ size, color }) {
            return <House size={size} color={color} />;
          },
          header() {
            return null;
          },
        }}
        name="Home"
        component={HomeScreen}
      />
      <Tab.Screen
        options={{
          tabBarIcon({ size, color }) {
            return <Library size={size} color={color} />;
          },
          headerRight() {
            return (
              <View
                style={{ marginRight: 8, borderRadius: 64, overflow: 'hidden' }}
              >
                <PlatformPressable style={{ padding: 4 }} onPress={() => {}}>
                  <Settings size={24} color={colors.text} />
                </PlatformPressable>
              </View>
            );
          },
        }}
        name="Library"
        component={LibraryScreen}
      />
      <Tab.Screen
        options={useIcon(Search)}
        name="Search"
        component={SearchScreen}
      />
    </Tab.Navigator>
  );
}

function BlankScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Blank'>) {
  const {
    theme: { colors },
  } = useAppTheme();

  const { setupCompleted } = useAppSetup();

  useEffect(() => {
    if (setupCompleted === false) {
      navigation.replace('Setup', { screen: 'Welcome' });
    } else if (setupCompleted === true) {
      navigation.replace('Main', { screen: 'Home' });
    }
  }, [setupCompleted, navigation]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={colors.text} size={48} />
    </View>
  );
}

function AppContent() {
  return (
    <Stack.Navigator
      screenOptions={{
        header() {
          return null;
        },
      }}
    >
      <Stack.Screen
        name="Blank"
        options={{ animation: 'fade' }}
        component={BlankScreen}
      />
      <Stack.Screen name="Main" component={MainContent} />
      <Stack.Screen name="Settings" component={SettingsNavigator} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="NowPlaying"
        component={NowPlayingScreen}
        options={{
          animation: 'slide_from_bottom',
          headerShown: false,
          presentation: 'transparentModal',
        }}
      />
      <Stack.Screen name="Setup" component={SetupScreen} />
      <Stack.Screen name="CarHome" component={CarHomeScreen} />
    </Stack.Navigator>
  );
}

export default App;
