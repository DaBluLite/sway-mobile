import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ExternalLink } from 'lucide-react-native';
import Text from '../../components/text';
import SwayWordmark from '../../components/sway-wordmark';
import { Alert } from '../../components/custom-alert-api';
import { useAppTheme } from '../../contexts/theme-context';
import { version } from '../../../package.json';

const policies = [
  { label: 'Terms of Service', url: 'https://sway.dablulite.dev/tos' },
  { label: 'Privacy Policy', url: 'https://sway.dablulite.dev/privacy' },
];

async function openPolicy(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      'Unable to open link',
      'Please try again or open this URL in your browser:\n' + url,
    );
  }
}

export default function AboutSettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    theme: { colors },
    resolvedTheme,
  } = useAppTheme();
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
          gap: 8,
          marginBottom: 32,
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
        content: {
          paddingBottom: insets.bottom + 32,
        },
        description: {
          paddingHorizontal: 16,
          paddingBottom: 24,
          gap: 12,
        },
        wordmark: {
          width: '100%',
          maxWidth: 280,
          aspectRatio: 1513 / 334,
        },
        body: {
          fontSize: 15,
          lineHeight: 22,
          color: colors.textMuted,
        },
        link: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          paddingHorizontal: 16,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.secondLayerThin,
        },
        linkText: {
          flex: 1,
          fontSize: 18,
          color: colors.text,
        },
      }),
    [colors, insets],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>About</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.description}>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="Sway Music"
            style={styles.wordmark}
          >
            <SwayWordmark
              variant={resolvedTheme === 'dark' ? 'light' : 'dark'}
              width="100%"
              height="100%"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          </View>

          <Text style={styles.body}>
            Your music and internet radio in one place.
          </Text>
        </View>
        {policies.map(({ label, url }) => (
          <Pressable
            key={url}
            accessibilityRole="link"
            accessibilityLabel={label}
            accessibilityHint="Opens in your browser"
            onPress={() => openPolicy(url)}
            android_ripple={{ color: colors.secondLayerThin }}
            style={styles.link}
          >
            <Text style={styles.linkText}>{label}</Text>
            <ExternalLink size={20} color={colors.text} />
          </Pressable>
        ))}
        <View
          accessible
          accessibilityLabel={`Version ${version}`}
          style={styles.link}
        >
          <Text style={styles.linkText}>Version</Text>
          <Text style={styles.body}>{version}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
