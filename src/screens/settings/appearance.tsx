import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Check,
  ChevronLeft,
  Disc3,
  Moon,
  Smartphone,
  Sun,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../../components/text';
import {
  useAppTheme,
  type ResolvedThemeOption,
} from '../../contexts/theme-context';

const PREVIEW_COLORS = {
  light: {
    background: '#FFFFFF',
    surface: '#e8e8e8',
    text: '#0f172a',
    line: '#d8e0ea',
  },
  dark: {
    background: '#000000',
    surface: '#181818',
    text: '#f8fafc',
    line: '#3b3b3b',
  },
};

function ThemePreview({
  mode,
  accent,
}: {
  mode: ResolvedThemeOption;
  accent: string;
}) {
  const palette = PREVIEW_COLORS[mode];

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[previewStyles.screen, { backgroundColor: palette.background }]}
    >
      <View style={previewStyles.chrome}>
        <View style={[previewStyles.dot, { backgroundColor: accent }]} />
        <View
          style={[previewStyles.shortLine, { backgroundColor: palette.line }]}
        />
      </View>
      <Text style={[previewStyles.heading, { color: palette.text }]}>
        Your library
      </Text>
      <View style={previewStyles.albums}>
        <View style={[previewStyles.album, { backgroundColor: accent }]}>
          <Disc3 size={30} color={palette.background} strokeWidth={1.5} />
        </View>
        <View
          style={[previewStyles.album, { backgroundColor: palette.surface }]}
        >
          <Disc3 size={30} color={palette.line} strokeWidth={1.5} />
        </View>
      </View>
      <View
        style={[previewStyles.player, { backgroundColor: palette.surface }]}
      >
        <View style={[previewStyles.artwork, { backgroundColor: accent }]} />
        <View style={previewStyles.trackInfo}>
          <View
            style={[
              previewStyles.trackTitle,
              { backgroundColor: palette.text },
            ]}
          />
          <View
            style={[
              previewStyles.trackArtist,
              { backgroundColor: palette.line },
            ]}
          />
        </View>
        <View style={[previewStyles.playButton, { backgroundColor: accent }]} />
      </View>
      <View style={previewStyles.tabs}>
        {[accent, palette.line, palette.line].map((color, index) => (
          <View
            key={index}
            style={[previewStyles.tab, { backgroundColor: color }]}
          />
        ))}
      </View>
    </View>
  );
}

function AppearanceSettingsScreen() {
  const {
    theme: { colors },
    setThemeOption,
    themeOption,
    resolvedTheme,
  } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale >= 1.3;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: insets.top + 4,
          backgroundColor: colors.background,
        },
        header: {
          alignItems: 'flex-start',
          gap: 12,
          marginHorizontal: 16,
          marginBottom: 12,
        },
        backButton: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        title: {
          fontSize: 32,
          fontWeight: '100',
          color: colors.text,
          flexShrink: 1,
        },
        content: {
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 32,
          gap: 24,
        },
        introduction: { gap: 8 },
        eyebrow: {
          color: colors.primary,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.8,
        },
        headline: { color: colors.text, fontSize: 26, fontWeight: '600' },
        description: {
          color: colors.text,
          opacity: 0.65,
          fontSize: 14,
          lineHeight: 22,
        },
        section: { gap: 14 },
        sectionHeading: { gap: 4 },
        sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
        options: { flexDirection: stacked ? 'column' : 'row', gap: 12 },
        option: {
          flex: stacked ? undefined : 1,
          minWidth: 0,
          padding: 8,
          gap: 14,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: colors.subtle,
          backgroundColor: colors.secondLayerThin,
        },
        selectedOption: { borderColor: colors.textMuted },
        pressed: { backgroundColor: colors.secondLayerThinActive },
        optionFooter: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 2,
          paddingBottom: 2,
        },
        optionTitle: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
          flex: 1,
        },
        radio: {
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1.5,
          borderColor: colors.textMuted,
          alignItems: 'center',
          justifyContent: 'center',
        },
        selectedRadio: {
          backgroundColor: colors.text,
          borderColor: colors.text,
        },
        systemOption: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: colors.subtle,
          backgroundColor: colors.secondLayerThin,
          padding: 12,
        },
        systemIcon: {
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: colors.secondLayerThin,
          alignItems: 'center',
          justifyContent: 'center',
        },
        systemText: { flex: 1, minWidth: 0, gap: 4 },
        systemTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
        systemDescription: {
          color: colors.text,
          opacity: 0.65,
          fontSize: 12,
          lineHeight: 18,
        },
        status: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 16,
          borderRadius: 16,
          backgroundColor: colors.secondLayerThin,
        },
        statusText: {
          color: colors.text,
          opacity: 0.65,
          fontSize: 12,
          lineHeight: 18,
          flex: 1,
        },
      }),
    [colors, insets.top, insets.bottom, stacked],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          Appearance
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Color theme
            </Text>
            <Text style={styles.description}>
              Your choice applies throughout the app.
            </Text>
          </View>
          <View style={styles.options}>
            {(['light', 'dark'] as const).map(mode => {
              const selected = themeOption === mode;
              const Icon = mode === 'light' ? Sun : Moon;
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="radio"
                  accessibilityLabel={
                    mode === 'light' ? 'Light theme' : 'Dark theme'
                  }
                  accessibilityState={{ checked: selected }}
                  onPress={() => setThemeOption(mode)}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemePreview mode={mode} accent={colors.primary} />
                  <View style={styles.optionFooter}>
                    <Icon size={18} color={colors.text} />
                    <Text style={styles.optionTitle}>
                      {mode === 'light' ? 'Light' : 'Dark'}
                    </Text>
                    <View
                      style={[styles.radio, selected && styles.selectedRadio]}
                    >
                      {selected && (
                        <Check size={13} color={colors.background} strokeWidth={3} />
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel="System default theme"
            accessibilityHint="Automatically follow your device's light or dark appearance"
            accessibilityState={{ checked: themeOption === 'system' }}
            onPress={() => setThemeOption('system')}
            style={({ pressed }) => [
              styles.systemOption,
              pressed && styles.pressed,
            ]}
          >
            <Smartphone size={22} color={colors.text} />
            <View style={styles.systemText}>
              <Text style={styles.systemTitle}>Follow device</Text>
              <Text style={styles.systemDescription}>
                Switch automatically with your system appearance.
              </Text>
            </View>
            <View
              style={[
                styles.radio,
                themeOption === 'system' && styles.selectedRadio,
              ]}
            >
              {themeOption === 'system' && (
                <Check size={13} color={colors.background} strokeWidth={3} />
              )}
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  screen: { borderRadius: 12, padding: 12, gap: 10 },
  chrome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  shortLine: { width: 22, height: 3, borderRadius: 2 },
  heading: { fontSize: 11, fontWeight: '600' },
  albums: { flexDirection: 'row', gap: 8 },
  album: {
    flex: 1,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 7,
  },
  artwork: { width: 18, height: 18, borderRadius: 4 },
  trackInfo: { flex: 1, gap: 4 },
  trackTitle: { width: '80%', height: 3, borderRadius: 2 },
  trackArtist: { width: '55%', height: 3, borderRadius: 2 },
  playButton: { width: 10, height: 10, borderRadius: 5 },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 2 },
  tab: { width: 12, height: 4, borderRadius: 2 },
});

export default AppearanceSettingsScreen;
