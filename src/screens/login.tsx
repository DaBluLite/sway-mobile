import { Animated, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/text';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import subsonicService from '../utils/subsonic';
import { useAppTheme } from '../contexts/theme-context';
import { KeyboardAvoidingView, useKeyboardAnimation } from 'react-native-keyboard-controller';

function LoginScreen() {
  const {
    theme: { colors },
  } = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const navigation = useNavigation();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const { height } = useKeyboardAnimation();
  const handleSave = async () => {
    if (!serverUrl || !username || !password) {
      setError('Please fill in server URL, username, and password');
      setStatusMsg(null);
      return;
    }

    setError(null);
    setStatusMsg('Saving...');

    try {
      const status = await subsonicService.setCredentials(
        username,
        password,
        serverUrl,
      );
      if (status.success) {
        setStatusMsg('Credentials saved successfully');
        setPassword('');

        navigation.navigate('Main' as never);
      } else {
        setError(
          status.error ||
            'Failed to authenticate with the server. Please check your credentials and server URL.',
        );
        setStatusMsg(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred',
      );
      setStatusMsg(null);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          gap: 16,
          paddingBottom: bottom + 32,
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        },
        title: {
          color: colors.text,
          fontSize: 30,
          fontWeight: '100',
          textAlign: 'center',
        },
        pageContainer: {
          maxHeight: 520,
          width: '100%',
          overflow: 'hidden',
          gap: 16,
          paddingHorizontal: 20,
        },
        form: {
          gap: 12,
        },
        fieldGroup: {
          gap: 6,
        },
        label: {
          color: colors.text,
          opacity: 0.7,
          fontSize: 12,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
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
          borderColor: '#97979F0A',
          borderWidth: 1,
          backgroundColor: 'rgba(34, 197, 94, 0.24)',
          textAlign: 'center',
          marginHorizontal: 16,
          position: 'absolute',
          bottom: 16 + bottom,
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
      }),
    [bottom, colors.secondLayerThin, colors.text, height],
  );

  return (
    <KeyboardAvoidingView behavior={"padding"} keyboardVerticalOffset={100} style={styles.container}>
      <Text style={styles.title}>Log in to Subsonic</Text>
      <View style={styles.pageContainer}>
        {error && (
          <Text style={[styles.statusText, styles.errorText]}>{error}</Text>
        )}

        {statusMsg && !error && (
          <Text style={[styles.statusText, styles.successText]}>
            {statusMsg}
          </Text>
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
              placeholder="admin"
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
              placeholder="••••••••"
              placeholderTextColor="#A1A1AA"
              style={styles.input}
            />
          </View>
        </View>
      </View>

      <Animated.View style={styles.nextButtonContainer}>
        <Pressable
          style={styles.nextButton}
          android_ripple={{ color: 'rgba(34, 197, 94, 0.4)' }}
          onPress={handleSave}
        >
          <Text style={styles.nextButtonText}>Log In</Text>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

export default LoginScreen;
