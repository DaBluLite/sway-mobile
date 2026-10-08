import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/text';
import { SubsonicAlbum } from '../types/subsonic';
import subsonicService from '../utils/subsonic';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useSubsonic } from '../contexts/subsonic-context';
import { AlbumCarousel } from '../components/album-carousel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSetup } from '../contexts/app-setup-context';
import { Cog, Car } from 'lucide-react-native';
import CommonStackNavigator from '../components/common-stack-navigator';
import { useAppTheme } from '../contexts/theme-context';
import { useHistory } from '../contexts/history-context';
import { Station } from 'radio-browser-api';
import { FeaturedAlbum } from '../components/featured-album';
import { getGreeter, getGreeting } from '../utils/greeting';
import { StationCarousel } from '../components/station-carousel';
import { FeaturedStation } from '../components/featured-station';

type ExtendedAlbum = SubsonicAlbum & { title: string };

function HomeScreenInternal() {
  const { subsonicEnabled, loggedIn } = useSubsonic();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    theme: { colors },
    resolvedTheme: currentTheme
  } = useAppTheme();
  const { selectedCountry } = useAppSetup();
  const { getRecentStations } = useHistory();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey(key => key + 1);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top
        },
        greeting: {
          color:
            currentTheme === 'dark'
              ? 'rgba(255, 255, 255, 0.4)'
              : 'rgba(0, 0, 0, 0.4)',
          fontSize: 12,           // text-xs
          fontWeight: '600',      // font-semibold
          letterSpacing: 1.2,     // tracking-widest (0.1em × 12px)
          textTransform: 'uppercase',
          marginBottom: 4
        },
        greeter: {
          color:
            currentTheme === 'dark'
              ? 'rgba(255, 255, 255)'
              : 'rgba(0, 0, 0)',
          fontSize: 24,
          lineHeight: 32,
          fontWeight: '600',
          flex: 1,
          flexShrink: 1,
          minWidth: 0,
        },
        container: {
          paddingBottom: insets.bottom + 160,
          paddingHorizontal: 20,
          gap: 32
        },
        headerContainer: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: insets.top + 4,
          paddingBottom: 16,
          paddingLeft: 16,
          paddingRight: 16,
          backgroundColor: colors.background,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'flex-end',
        },
        title: {
          fontSize: 32,
          fontWeight: '100',
          color: colors.text,
        },
        settingsButton: {
          padding: 8,
          borderRadius: 64,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        carButton: {
          padding: 8,
          borderRadius: 64,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        headerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        nextButtonContainer: {
          overflow: 'hidden',
          borderRadius: 64,
          borderColor: '#97979F0A',
          borderWidth: 1,
          backgroundColor: 'rgba(34, 197, 94, 0.24)',
        },
        nextButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingVertical: 12,
          paddingHorizontal: 24,
          justifyContent: 'center',
        },
        nextButtonText: {
          color: '#FFFFFF',
          fontSize: 16,
        },
        greetingWrapper: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0
        }
      }),
    [insets, colors, currentTheme],
  );

  const fetchMostPlayedAlbums = async (offset: number, size: number) => {
    const result = await subsonicService.getMostPlayed({
      offset: offset.toString(),
      size: size.toString(),
    });

    if (result.success && result.data) {
      return (result.data as { album: ExtendedAlbum[] }).album;
    }

    return [];
  };

  const fetchRandomAlbums = useCallback(
    async (size = 10): Promise<ExtendedAlbum[]> => {
      const result = await subsonicService.getRandomAlbums({
        size: size.toString(),
      });

      if (result.success && result.data) {
        return result.data as ExtendedAlbum[];
      }
      return [];
    },
    [],
  );

  const fetchNewlyAddedAlbums = async (offset: number, size: number) => {
    const result = await subsonicService.getNewlyAddedAlbums({
      offset: offset.toString(),
      size: size.toString(),
    });

    if (result.success && result.data) {
      return result.data as ExtendedAlbum[];
    }

    return [];
  };

  const recentlyPlayed = useMemo(
    () => getRecentStations(10),
    [getRecentStations],
  );

  const fetchRecentlyPlayed = useCallback(
    async (offset: number, limit: number): Promise<Station[]> => {
      // Return slice of recently played stations based on offset/limit
      return recentlyPlayed.slice(offset, offset + limit);
    },
    [recentlyPlayed],
  );

  // Fetch trending stations (ordered by recent clicks/trending)
  const fetchTrendingStations = useCallback(
    async (offset: number, limit: number) => {
      try {
        const response = await fetch(
          `https://sway.dablulite.dev/api/radio/search?limit=${limit}&offset=${offset}&order=clicktrend&reverse=true`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        throw error;
      }
    },
    [],
  );

  // Fetch recently added/changed stations
  const fetchRecentlyAdded = useCallback(
    async (offset: number, limit: number) => {
      try {
        const response = await fetch(
          `https://sway.dablulite.dev/api/radio/search?limit=${limit}&offset=${offset}&order=changetimestamp&reverse=true`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        throw error;
      }
    },
    [],
  );

  const fetchTopLocalStations = useCallback(
    async (offset: number, limit: number) => {
      try {
        const response = await fetch(
          `https://sway.dablulite.dev/api/radio/search?limit=${limit}&offset=${offset}&order=clickcount&reverse=true&countrycode=${selectedCountry}`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        throw error;
      }
    },
    [selectedCountry],
  );

  const fetchTopMusicStations = useCallback(
    async (offset: number, limit: number) => {
      try {
        const response = await fetch(
          `https://sway.dablulite.dev/api/radio/search?limit=${limit}&offset=${offset}&order=clickcount&reverse=true&countrycode=${selectedCountry}&tag=music`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        throw error;
      }
    },
    [selectedCountry],
  );

  const fetchLocalPopStations = useCallback(
    async (offset: number, limit: number) => {
      try {
        const response = await fetch(
          `https://sway.dablulite.dev/api/radio/search?limit=${limit}&offset=${offset}&order=clickcount&reverse=true&countrycode=${selectedCountry}&tag=pop`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        throw error;
      }
    },
    [selectedCountry],
  );

  const fetchLocalNewsStations = useCallback(
    async (offset: number, limit: number) => {
      try {
        const response = await fetch(
          `https://sway.dablulite.dev/api/radio/search?limit=${limit}&offset=${offset}&order=clickcount&reverse=true&countrycode=${selectedCountry}&tag=news`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        throw error;
      }
    },
    [selectedCountry],
  );

  const fetchTopNewsStations = useCallback(
    async (offset: number, limit: number) => {
      try {
        const response = await fetch(
          `https://sway.dablulite.dev/api/radio/search?limit=${limit}&offset=${offset}&order=clickcount&reverse=true&tag=news`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        throw error;
      }
    },
    [],
  );

  const fetchTopRockStations = useCallback(
    async (offset: number, limit: number) => {
      try {
        const response = await fetch(
          `https://sway.dablulite.dev/api/radio/search?limit=${limit}&offset=${offset}&order=clickcount&reverse=true&tag=rock&countrycode=${selectedCountry}`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        throw error;
      }
    },
    [selectedCountry],
  );

  const fetchTopSportsStations = useCallback(
    async (offset: number, limit: number) => {
      try {
        const response = await fetch(
          `https://sway.dablulite.dev/api/radio/search?limit=${limit}&offset=${offset}&order=clickcount&reverse=true&tag=sports&countrycode=${selectedCountry}`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        throw error;
      }
    },
    [selectedCountry],
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: 8 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textMuted}
            progressBackgroundColor={colors.background}
            colors={[colors.primary]}
          />
        }
        scrollEventThrottle={16}
      >
        <View style={styles.greetingWrapper}>
          <View style={{ minWidth: 0, flexShrink: 1, flex: 1 }}>
            <Text numberOfLines={1} style={styles.greeting}>
              {getGreeting(subsonicService.username || "Guest")}
            </Text>
            <Text style={styles.greeter}>
              {getGreeter()}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.carButton}
              onPress={() =>
                navigation
                  .getParent()
                  ?.getParent()
                  ?.navigate('CarHome' as never)
              }
            >
              <Car size={24} color={colors.text} />
            </Pressable>
            <Pressable
              style={styles.settingsButton}
              onPress={() =>
                navigation
                  .getParent()
                  ?.getParent()
                  ?.navigate('Settings' as never)
              }
            >
              <Cog size={24} color={colors.text} />
            </Pressable>
          </View>
        </View>
        {loggedIn && subsonicEnabled ? (
          <FeaturedAlbum
            key={`featured-${refreshKey}`}
            title="Featured" fetchRandomAlbums={fetchRandomAlbums}
          />
        ) : (<FeaturedStation key={`featured-station-${refreshKey}`} title='Featured' fetchRandomStations={fetchTrendingStations} />)}
        {loggedIn && subsonicEnabled && (
          <AlbumCarousel
            key={`most-played-${refreshKey}`}
            title="Most Played Albums"
            fetchAlbums={fetchMostPlayedAlbums}
          />
        )}
        {loggedIn && subsonicEnabled && (
          <AlbumCarousel
            key={`newly-added-${refreshKey}`}
            title="Newly Added Albums"
            fetchAlbums={fetchNewlyAddedAlbums}
          />
        )}
        {recentlyPlayed.length > 0 && (
          <StationCarousel
            key={`recently-played-${refreshKey}`}
            title="Recently Played Stations"
            fetchStations={fetchRecentlyPlayed}
          />
        )}
        <StationCarousel
          key={`trending-${refreshKey}`}
          title="Trending Stations"
          fetchStations={fetchTrendingStations}
        />
        <StationCarousel
          key={`top-local-${refreshKey}`}
          title="Top Local"
          fetchStations={fetchTopLocalStations}
        />
        <StationCarousel
          key={`top-music-${refreshKey}`}
          title="Top Music Stations"
          fetchStations={fetchTopMusicStations}
        />
        <StationCarousel
          key={`newly-added-stations-${refreshKey}`}
          title="Newly Added Stations"
          fetchStations={fetchRecentlyAdded}
        />
        <StationCarousel
          key={`news-${refreshKey}`}
          title="News Stations"
          fetchStations={fetchTopNewsStations}
        />
        <StationCarousel
          key={`local-news-${refreshKey}`}
          title="Local News Stations"
          fetchStations={fetchLocalNewsStations}
        />
        <StationCarousel
          key={`pop-${refreshKey}`}
          title="Pop Music Stations"
          fetchStations={fetchLocalPopStations}
        />
        <StationCarousel
          key={`rock-${refreshKey}`}
          title="Local Rock Stations"
          fetchStations={fetchTopRockStations}
        />
        <StationCarousel
          key={`sports-${refreshKey}`}
          title="Sports Stations"
          fetchStations={fetchTopSportsStations}
        />
      </ScrollView>
    </View>
  );
}

function HomeScreen() {
  return (
    <CommonStackNavigator Screen={HomeScreenInternal} screenName="HomeMain" />
  );
}

export default HomeScreen;
