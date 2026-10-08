import { ActivityIndicator, Animated, KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from '../../components/text';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import subsonicService from '../../utils/subsonic';
import { useAppTheme } from '../../contexts/theme-context';
import { useKeyboardAnimation } from 'react-native-keyboard-controller';
import { ChevronLeft } from 'lucide-react-native';
import { useSubsonic } from '../../contexts/subsonic-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, SetupStackParamList } from '../../types';
import { CompositeScreenProps } from '@react-navigation/native';
import { useAppSetup } from '../../contexts/app-setup-context';

type SetupSubsonicNavigationProp = CompositeScreenProps<
  NativeStackScreenProps<SetupStackParamList, 'SetupSubsonic'>,
  NativeStackScreenProps<RootStackParamList>
>;

function SetupOpenSubsonicScreen({ navigation }: SetupSubsonicNavigationProp) {
  const {
    theme: { colors },
  } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { height } = useKeyboardAnimation();
  const { setSubsonicEnabled } = useSubsonic();
  const { completeSetup } = useAppSetup();
  const handleSave = async () => {
    if (!serverUrl || !username || !password) {
      setError('Please fill in server URL, username, and password');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const status = await subsonicService.setCredentials(
        username,
        password,
        serverUrl,
      );
      if (status.success) {
        setPassword('');
        setSubsonicEnabled(true);
        completeSetup();

        const parent = navigation.getParent();
        if (parent) {
          parent.reset({
            index: 0,
            routes: [{ name: 'Main' }],
          });
        }
      } else {
        setError(
          status.error ||
            'Failed to authenticate with the server. Please check your credentials and server URL.',
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred',
      );
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          gap: 32,
          paddingBottom: insets.bottom + 32,
          width: '100%',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
        },
        title: {
          color: colors.text,
          fontSize: 25,
          fontWeight: '300',
        },
        subtitle: {
          color: colors.textMuted,
          fontSize: 16,
          fontWeight: '300',
        },
        pageContainer: {
          maxHeight: 520,
          width: '100%',
          overflow: 'hidden',
          gap: 16,
          paddingHorizontal: 20,
        },
        form: {
          gap: 16,
        },
        fieldGroup: {
          gap: 8,
        },
        label: {
          color: colors.text,
          fontSize: 12,
          letterSpacing: 0.5,
          marginLeft: 4,
        },
        input: {
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#97979F29',
          backgroundColor: colors.secondLayerThin,
          color: colors.text,
          paddingHorizontal: 12,
          paddingVertical: 12,
        },
        statusText: {
          fontSize: 12,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        successText: {
          color: '#22c55e',
        },
        errorText: {
          color: '#ef4444',
        },
        actionRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 8,
        },
        iconButton: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#97979F29',
        },
        iconButtonAccent: {
          backgroundColor: 'rgba(34, 197, 94, 0.24)',
        },
        iconButtonDanger: {
          backgroundColor: 'rgba(239, 68, 68, 0.24)',
        },
        nextButtonContainer: {
          overflow: 'hidden',
          borderRadius: 64,
          textAlign: 'center',
          marginHorizontal: 32,
          position: 'absolute',
          bottom: 16 + insets.bottom,
          transform: [{ translateY: height }],
          left: 0,
          right: 0,
        },
        nextButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          paddingVertical: 16,
          flexShrink: 0,
          justifyContent: 'center',
          backgroundColor: colors.primary,
        },
        previousButtonContainer: {
          overflow: 'hidden',
          borderRadius: 64,
          borderColor: '#97979F0A',
          borderWidth: 1,
          backgroundColor: '#97979F29',
        },
        previousButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          flex: 1,
          paddingVertical: 16,
          paddingHorizontal: 16,
        },
        nextButtonText: {
          color: '#FFFFFF',
          fontSize: 16,
          textAlign: 'center',
          width: '100%',
        },
        row: {
          flexDirection: 'row',
        },
        backButton: {
          padding: 8,
          borderRadius: 64,
          marginRight: 8,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
          minWidth: 0,
          zIndex: 1000,
          marginLeft: 16,
          marginTop: insets.top + 16,
        },
        header: {
          marginLeft: 16,
        },
      }),
    [insets, colors, height],
  );

  return (
    <KeyboardAvoidingView
      behavior={'padding'}
      keyboardVerticalOffset={100}
      style={styles.container}
    >
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <ChevronLeft size={24} color={colors.text} />
      </Pressable>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Enter your OpenSubsonic credentials</Text>
      </View>
      <View style={styles.pageContainer}>
        {error && (
          <Text style={[styles.statusText, styles.errorText]}>{error}</Text>
        )}

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Server URL</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="https://your-server.com"
              placeholderTextColor="#A1A1AA"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              placeholder="Your username"
              placeholderTextColor="#A1A1AA"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor="#A1A1AA"
              style={styles.input}
            />
          </View>
        </View>
      </View>

      <Animated.View style={styles.nextButtonContainer}>
        <Pressable
          style={[styles.nextButton, loading ? { opacity: 0.5 } : {}]}
          android_ripple={{ color: 'rgba(34, 197, 94, 0.4)' }}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.text} size={16} />
          ) : (
            <Text style={styles.nextButtonText}>Log In</Text>
          )}
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

export default SetupOpenSubsonicScreen;
