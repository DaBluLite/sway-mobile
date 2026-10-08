import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Text from './text';
import { SubsonicAlbum, SubsonicSong } from '../types/subsonic';
import { useAppTheme } from '../contexts/theme-context';
import subsonicService from '../utils/subsonic';
import { useAudioPlayer } from '../contexts/audio-player-context';
import { useNavigation } from '@react-navigation/native';
import { Play } from 'lucide-react-native/icons';
import TouchableScale from './touchable-scale';

type ExtendedAlbum = SubsonicAlbum & { title: string };

interface FeaturedAlbumProps {
  title: string;
  fetchRandomAlbums: (size?: number) => Promise<ExtendedAlbum[]>;
  onExpand?: () => void;
}

export const FeaturedAlbum: React.FC<FeaturedAlbumProps> = ({
  fetchRandomAlbums,
}) => {
  const {
    theme: { colors },
    resolvedTheme: currentTheme,
  } = useAppTheme();
  const [album, setAlbum] = useState<ExtendedAlbum | null>(null);
  const [_, setIsLoading] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined);
  const isFetchingRef = useRef(false);
  const { playSong } = useAudioPlayer();
  const navigation = useNavigation();

  const handleNavigate = () => {
    navigation.navigate(...(['Album', { album }] as never));
  };

  const handlePlay = useCallback(async () => {
    if (!album) return;
    try {
      const albumDetails = await subsonicService.getAlbum(album.id);
      const songs =
        (albumDetails.data as { song?: SubsonicSong[] } | undefined)?.song ??
        [];
      if (songs?.length) {
        playSong(songs, 0);
      }
    } catch (error) {
      console.warn('Failed to play album from card', error);
    }
  }, [album, playSong]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          position: "absolute",
          padding: 16,
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 8,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0
        },
        container: {
          borderWidth: 1,
          borderRadius: 16,
          overflow: 'hidden',
          borderColor:
            currentTheme === 'dark'
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(0, 0, 0, 0.08)',
        },
        header: {
          marginBottom: 16,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
        title: {
          color:
            currentTheme === 'dark'
              ? 'rgba(255, 255, 255, 0.4)'
              : 'rgba(0, 0, 0, 0.4)',
          fontSize: 12,           // text-xs
          fontWeight: '600',      // font-semibold
          letterSpacing: 1.2,     // tracking-widest (0.1em × 12px)
          textTransform: 'uppercase',
        },
        cardWrap: {
          width: '100%',
        },
        hintText: {
          marginTop: 10,
          textAlign: 'center',
          color: colors.textMuted,
          fontSize: 12,
        },
        albumCover: {
          objectFit: 'cover',
          width: '100%',
          height: '100%',
        },
        coverWrapper: {
          height: 200,
        },
        coverOverlay: {
          position: 'absolute',
          inset: 0,
          backgroundColor:
            currentTheme === 'dark'
              ? 'rgba(0, 0, 0, 0.5)'
              : 'rgba(255, 255, 255, 0.3)',
        },
        overlayInfo: {
          flex: 1,
          flexShrink: 1,
          minWidth: 0,
        },
        overlayControls: {
          flexShrink: 0,
          marginLeft: 8,
        },
        albumInfo: {
          fontSize: 10,
          fontWeight: 'semibold',
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          marginBottom: 4,
          color:
            currentTheme === 'dark'
              ? 'rgba(255, 255, 255, 0.6)'
              : 'rgba(0, 0, 0, 0.5)',
        },
        albumTitle: {
          fontWeight: 'semibold',
          color: currentTheme === 'dark' ? '#FFFFFF' : '#000000',
          fontSize: 18,
          lineHeight: 28,
        },
        albumArtist: {
          fontSize: 14,
          lineHeight: 20,
          color:
            currentTheme === 'dark'
              ? 'rgba(255, 255, 255, 0.6)'
              : 'rgba(0, 0, 0, 0.5)',
        },
        infoBox: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          justifyContent: 'space-between',
          alignItems: 'center',
          flexDirection: 'row',
        },
        albumTracks: {
          color:
            currentTheme === 'dark'
              ? 'rgba(255, 255, 255, 0.4)'
              : 'rgba(0, 0, 0, 0.4)',
        },
        playButton: {
          backgroundColor: '#16a34a', // green-600
          paddingHorizontal: 12, // px-4
          paddingVertical: 12, // py-1.5
          borderRadius: 9999, // rounded-full
        },
        playButtonText: {
          color: '#ffffff'
        },
      }),
    [colors, currentTheme],
  );

  const loadMoreAlbums = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      const newAlbum = await fetchRandomAlbums(1);
      if (Array.isArray(newAlbum) && newAlbum.length > 0) {
        setAlbum(newAlbum[0]);
      }
    } catch (error) {
      console.error('Failed to fetch random albums:', error);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [fetchRandomAlbums]);

  useEffect(() => {
    if (!album) return;
    const url = album.coverArt
      ? subsonicService.getCoverArtUrl(album.coverArt) || undefined
      : undefined;
    setCoverUrl(url);
  }, [album]);

  useEffect(() => {
    loadMoreAlbums();
  }, [loadMoreAlbums]);

  if (!album) return null;

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.title}>Featured</Text>
      <TouchableScale onPress={handleNavigate} style={styles.container}>
        <View style={styles.coverWrapper}>
          <Image style={styles.albumCover} src={coverUrl} />
          <View style={styles.coverOverlay} />
          <View style={styles.overlay}>
            <View style={styles.overlayInfo}>
              <Text style={styles.albumInfo}>Album · {album.year}</Text>
              <Text style={styles.albumTitle}>{album.name}</Text>
              <Text style={styles.albumArtist}>{album.artist}</Text>
            </View>
            <View style={styles.overlayControls}>
              <TouchableScale
                onPress={handlePlay}
                style={styles.playButton}
              >
                <Play color={"#ffffff"} size={20} />
              </TouchableScale>
            </View>
          </View>
        </View>
      </TouchableScale>
    </View>
  );
};
