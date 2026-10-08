import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from '../../components/text'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Globe, Lock } from 'lucide-react-native'
import { useAppTheme } from '../../contexts/theme-context'
import { getItem, setItem, STORES } from '../../utils/storage'

function NaviloadSettingsScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { theme: { colors } } = useAppTheme()

  const [url, setUrl] = useState(() =>
    getItem<string>(STORES.NAVILOAD_CREDENTIALS, 'url') ?? '',
  )
  const [password, setPassword] = useState(() =>
    getItem<string>(STORES.NAVILOAD_CREDENTIALS, 'password') ?? '',
  )

  const updateUrl = (value: string) => {
    setUrl(value)
    setItem(STORES.NAVILOAD_CREDENTIALS, 'url', value)
  }

  const updatePassword = (value: string) => {
    setPassword(value)
    setItem(STORES.NAVILOAD_CREDENTIALS, 'password', value)
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: insets.top + 4,
          backgroundColor: colors.background,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
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
        fieldRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 8,
          paddingHorizontal: 16,
        },
        inputWrap: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: colors.faint,
          borderRadius: 12,
          backgroundColor: colors.secondLayerThin,
        },
        label: {
          color: colors.textMuted,
          fontSize: 13,
          fontWeight: '600',
          marginBottom: 6,
          marginHorizontal: 16,
          marginTop: 12,
        },
        input: {
          flex: 1,
          color: colors.text,
          fontSize: 15,
          paddingVertical: 12,
        },
      }),
    [colors, insets],
  )

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Naviload</Text>
      </View>

      <Text style={styles.label}>URL</Text>
      <View style={styles.fieldRow}>
        <View style={styles.inputWrap}>
          <Globe size={18} color={colors.textMuted} />
          <TextInput
            value={url}
            onChangeText={updateUrl}
            placeholder="https://naviload.example.com/upload"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
        </View>
      </View>

      <Text style={styles.label}>Password</Text>
      <View style={styles.fieldRow}>
        <View style={styles.inputWrap}>
          <Lock size={18} color={colors.textMuted} />
          <TextInput
            value={password}
            onChangeText={updatePassword}
            placeholder="Upload password"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={styles.input}
          />
        </View>
      </View>
    </View>
  )
}

export default NaviloadSettingsScreen